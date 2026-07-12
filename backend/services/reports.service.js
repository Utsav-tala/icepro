// backend/services/reports.service.js
// Analytics/reports business logic — a single MongoDB aggregation ($match + $facet)
// that returns KPI totals plus a filter-dependent breakdown table (and, when nothing
// is filtered, a second "top agencies" table).
//
// Financial model (see models/Bill.js + services/bill.service.js):
//   item.amount = qty * rate * (1 - disc/100)   ← disc is a PERCENTAGE (0–100)
//   bill.subtotal   = Σ item.amount
//   bill.discountAmt= optional bill-level flat discount (usually 0)
//   bill.total      = subtotal - discountAmt     ← the net billed revenue
// Therefore:
//   revenue (product/agency) = Σ item.amount
//   totalRevenue (KPI)       = Σ bill.total
//   totalDiscounts (KPI)     = Σ(qty*rate) - Σ bill.total   (per-item disc% + bill-level)

const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const { balanceBearingBills } = require("../constants");

// Round to 2 decimals, coercing null/NaN to 0 (kills float noise from Σ of .toFixed(2) values)
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Parse a "YYYY-MM-DD" string into a LOCAL Date at a day boundary.
// Parsing via components avoids the UTC-midnight off-by-one that `new Date("2026-07-01")`
// causes, and matches how dashboard.service.js builds local day boundaries.
const parseLocalDate = (str, endOfDay = false) => {
  const [y, m, d] = String(str).split("-").map(Number);
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
};

// Resolve the effective [start, end] range. Default = 1st of current month → end of today.
const resolveRange = (startDate, endDate) => {
  const now = new Date();
  const start = startDate
    ? parseLocalDate(startDate, false)
    : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = endDate
    ? parseLocalDate(endDate, true)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
};

// Format a Date back to YYYY-MM-DD (local) for the meta echo
const fmtDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Attach percentOfTotal to each row, relative to the sum of that table's own revenue.
// Divide-by-zero guarded (returns 0 for every row when the table total is 0).
const withPercent = (rows, revenueKey) => {
  const denom = rows.reduce((sum, row) => sum + (row[revenueKey] || 0), 0);
  return rows.map((row) => ({
    ...row,
    percentOfTotal: denom > 0 ? r2((row[revenueKey] / denom) * 100) : 0,
  }));
};

// ── Main entry ──────────────────────────────────────────────────────────────────
const getReportData = async ({ startDate, endDate, agencyId, productName } = {}) => {
  const { start, end } = resolveRange(startDate, endDate);
  const cleanProduct = productName ? String(productName).trim() : "";

  // ── $match: date range (+ agency if given) ──
  // Pending orders and cancelled bills are excluded: neither is realised revenue, and
  // counting a pending order here would inflate every KPI on this page.
  const match = {
    createdAt: { $gte: start, $lte: end },
    status:    balanceBearingBills(),
  };
  if (agencyId) match.agencyId = new mongoose.Types.ObjectId(agencyId);

  // ── KPI facet: one $group, no unwind needed ──
  const kpiFacet = [
    {
      $group: {
        _id: null,
        totalRevenue:   { $sum: "$total" },
        totalInvoices:  { $sum: 1 },
        // Inner $sum sums the embedded array; outer $sum accumulates across bills
        totalBoxesSold: { $sum: { $sum: "$items.qty" } },
        // Gross list value (pre-discount) = Σ per item (qty * rate)
        totalGross: {
          $sum: {
            $sum: {
              $map: {
                input: "$items",
                as: "it",
                in: { $multiply: ["$$it.qty", "$$it.rate"] },
              },
            },
          },
        },
      },
    },
  ];

  // ── Breakdown facets, built conditionally per scenario ──
  const facet = { kpis: kpiFacet };

  if (cleanProduct) {
    // Product selected → which agencies bought this product
    facet.agenciesForProduct = [
      { $unwind: "$items" },
      { $match: { "items.name": cleanProduct } },
      {
        $group: {
          _id: "$agencyName",
          boxesBought: { $sum: "$items.qty" },
          revenue:     { $sum: "$items.amount" },
        },
      },
      { $sort: { boxesBought: -1 } },
    ];
  } else {
    // No product → product-wise breakdown
    facet.products = [
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          boxesSold: { $sum: "$items.qty" },
          revenue:   { $sum: "$items.amount" },
        },
      },
      { $sort: { revenue: -1 } },
    ];
    // …and, when no agency filter either, a "top agencies overall" table
    if (!agencyId) {
      facet.agencies = [
        { $unwind: "$items" },
        {
          $group: {
            _id: "$agencyName",
            totalBoxes:   { $sum: "$items.qty" },
            totalRevenue: { $sum: "$items.amount" },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ];
    }
  }

  const [agg = {}] = await Bill.aggregate([{ $match: match }, { $facet: facet }]);

  // ── KPIs ──
  const rawKpi = (agg.kpis && agg.kpis[0]) || {};
  const totalRevenue = r2(rawKpi.totalRevenue);
  const totalGross = r2(rawKpi.totalGross);
  const kpis = {
    totalRevenue,
    totalBoxesSold: r2(rawKpi.totalBoxesSold),
    // All discounts extended to customers (per-item disc% + any bill-level discountAmt)
    totalDiscounts: r2(Math.max(0, totalGross - totalRevenue)),
    totalInvoices: rawKpi.totalInvoices || 0,
  };

  // ── Tables + scenario ──
  let scenario;
  let primaryTable;
  let secondaryTable = null;

  if (cleanProduct) {
    scenario = "agencies-for-product";
    primaryTable = withPercent(
      (agg.agenciesForProduct || []).map((row) => ({
        agencyName:     row._id || "—",
        boxesBought:    r2(row.boxesBought),
        revenue:        r2(row.revenue),
        avgPricePerBox: row.boxesBought > 0 ? r2(row.revenue / row.boxesBought) : 0,
      })),
      "revenue"
    );
  } else {
    primaryTable = withPercent(
      (agg.products || []).map((row) => ({
        name:           row._id || "—",
        boxesSold:      r2(row.boxesSold),
        revenue:        r2(row.revenue),
        avgPricePerBox: row.boxesSold > 0 ? r2(row.revenue / row.boxesSold) : 0,
      })),
      "revenue"
    );
    if (!agencyId) {
      scenario = "products+agencies";
      secondaryTable = withPercent(
        (agg.agencies || []).map((row) => ({
          agencyName:     row._id || "—",
          totalBoxes:     r2(row.totalBoxes),
          totalRevenue:   r2(row.totalRevenue),
          avgPricePerBox: row.totalBoxes > 0 ? r2(row.totalRevenue / row.totalBoxes) : 0,
        })),
        "totalRevenue"
      );
    } else {
      scenario = "products";
    }
  }

  return {
    kpis,
    primaryTable,
    secondaryTable,
    meta: {
      scenario,
      startDate: fmtDate(start),
      endDate:   fmtDate(end),
      filters:   { agencyId: agencyId || null, productName: cleanProduct || null },
    },
  };
};

module.exports = { getReportData };
