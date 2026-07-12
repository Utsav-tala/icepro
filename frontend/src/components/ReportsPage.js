// src/components/ReportsPage.js
// 📊 Reports — analytics page powered by the GET /api/reports aggregation endpoint.
// Filter bar (date preset / agency / product) → KPI cards → dynamic breakdown table(s).

import { useState, useEffect, useMemo } from "react";
import api, { printReportPdf } from "../api";
import { C } from "../constants";
import { SC, Spin, PageHeader, Lbl } from "./UI";

// ── Display formatters ────────────────────────────────────────────────────────
const rs  = (n) => `Rs.${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const num = (n) => (Number(n) || 0).toLocaleString("en-IN");
const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

const PRESETS = [
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "thisYear",  label: "This Year" },
  { id: "custom",    label: "Custom Range" },
];

// Plain-JS local date math — no date library. Returns YYYY-MM-DD strings.
function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function computeRange(preset, customStart, customEnd) {
  const now = new Date();
  if (preset === "lastMonth") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0); // day 0 = last day of prev month
    return { startDate: fmt(s), endDate: fmt(e) };
  }
  if (preset === "thisYear") {
    return { startDate: fmt(new Date(now.getFullYear(), 0, 1)), endDate: fmt(now) };
  }
  if (preset === "custom") {
    return { startDate: customStart || "", endDate: customEnd || "" };
  }
  // thisMonth (default)
  return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now) };
}

// ── Generic breakdown table ───────────────────────────────────────────────────
// columns: [{ label, w, align, render(row,i), cellStyle(row,i) }]
function ReportTable({ title, sub, columns, rows }) {
  const template = columns.map((c) => c.w).join(" ");
  const minWidth = 600;
  return (
    <div className="card" style={{ padding: 0, marginBottom: 18 }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, background: "#fff8f8", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: C.textLight, fontWeight: 700 }}>{sub}</span>}
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth }}>
          <div style={{ display: "grid", gridTemplateColumns: template, gap: 8, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: "#fffdfd" }}>
            {columns.map((c, i) => (
              <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", textAlign: c.align || "left" }}>{c.label}</div>
            ))}
          </div>
          {rows.map((row, ri) => (
            <div key={ri} className="tr" style={{ display: "grid", gridTemplateColumns: template, gap: 8, alignItems: "center" }}>
              {columns.map((c, ci) => (
                <div key={ci} style={{ textAlign: c.align || "left", overflow: "hidden", textOverflow: "ellipsis", ...(c.cellStyle ? c.cellStyle(row, ri) : {}) }}>
                  {c.render(row, ri)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Column builders per scenario ─────────────────────────────────────────────────
const idxCol = {
  label: "#", w: "40px", align: "left",
  render: (_r, i) => i + 1,
  cellStyle: () => ({ fontSize: 11, color: C.textLight, fontWeight: 700 }),
};
const nameCol = (label, key) => ({
  label, w: "minmax(160px,1fr)", align: "left",
  render: (r) => r[key],
  cellStyle: () => ({ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }),
});
const boxesCol = (label, key) => ({
  label, w: "110px", align: "right",
  render: (r) => num(r[key]),
  cellStyle: () => ({ fontSize: 13, fontWeight: 700, color: C.text }),
});
const revenueCol = (key) => ({
  label: "Revenue", w: "120px", align: "right",
  render: (r) => rs(r[key]),
  cellStyle: () => ({ fontSize: 13, fontWeight: 800, color: C.redDark }),
});
const pctCol = (label) => ({
  label, w: "90px", align: "right",
  render: (r) => pct(r.percentOfTotal),
  cellStyle: () => ({ fontSize: 12, fontWeight: 700, color: "#1e40af" }),
});
const avgCol = {
  label: "Avg ₹/Box", w: "100px", align: "right",
  render: (r) => rs(r.avgPricePerBox),
  cellStyle: () => ({ fontSize: 12, fontWeight: 700, color: "#065f46" }),
};

export function ReportsPage({ agencies = [], products = [] }) {
  const [preset,      setPreset]      = useState("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [agencyId,    setAgencyId]    = useState("");
  const [productName, setProductName] = useState("");
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");

  const { startDate, endDate } = useMemo(
    () => computeRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const sortedAgencies = useMemo(
    () => [...agencies].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [agencies]
  );
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [products]
  );

  // ── Fetch (debounced + stale-response guarded) ──────────────────────────────
  useEffect(() => {
    // Wait for both dates before firing a custom-range query
    if (preset === "custom" && (!startDate || !endDate)) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    const t = setTimeout(async () => {
      try {
        const params = {};
        if (startDate)   params.startDate   = startDate;
        if (endDate)     params.endDate     = endDate;
        if (agencyId)    params.agencyId    = agencyId;
        if (productName) params.productName = productName;

        const res = await api.get("/reports", { params });
        if (cancelled) return;
        if (res.success) setData(res.data);
        else setError(res.message || "Failed to load report.");
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load report. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(t); };
  }, [startDate, endDate, agencyId, productName, preset]);

  const kpis    = data?.kpis;
  const meta    = data?.meta;
  const primary = data?.primaryTable || [];
  const hasData = primary.length > 0;

  const agencyLabel  = agencyId ? (agencies.find((a) => a.id === agencyId)?.name || "Selected Agency") : "All Agencies";
  const productLabel = productName || "All Products";

  // ── Primary table columns depend on scenario ────────────────────────────────
  let primaryTitle = "📦 Product-Wise Breakdown";
  let primaryColumns = [idxCol, nameCol("Product Name", "name"), boxesCol("Boxes Sold", "boxesSold"), revenueCol("revenue"), pctCol("% of Rev"), avgCol];
  if (meta?.scenario === "agencies-for-product") {
    primaryTitle = `🏢 Agencies Buying — ${productLabel}`;
    primaryColumns = [idxCol, nameCol("Agency Name", "agencyName"), boxesCol("Boxes Bought", "boxesBought"), revenueCol("revenue"), pctCol("% of Sales"), avgCol];
  }
  const secondaryColumns = [idxCol, nameCol("Agency Name", "agencyName"), boxesCol("Total Boxes", "totalBoxes"), revenueCol("totalRevenue"), pctCol("% of Biz"), avgCol];

  // ── Print — opens the server-rendered report PDF in a new tab (print or save) ──
  const [pdfLoading, setPdfLoading] = useState(false);
  async function handlePrint() {
    if (!hasData || pdfLoading) return;
    setPdfLoading(true);
    try {
      const params = {};
      if (startDate)   params.startDate   = startDate;
      if (endDate)     params.endDate     = endDate;
      if (agencyId)    params.agencyId    = agencyId;
      if (productName) params.productName = productName;
      await printReportPdf(params);
    } catch (err) {
      alert(err?.message || "Could not open the report PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="fi">
      <div className="page-header-sticky">
        <PageHeader
          title="📊 Reports"
          sub="Analytics &amp; Insights"
          action={
            <button className="btn btn-yellow" onClick={handlePrint} disabled={!hasData || pdfLoading}>
              {pdfLoading ? "⏳ Generating…" : "🖨️ Print Report"}
            </button>
          }
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={preset === p.id ? "btn btn-red" : "btn btn-ghost"}
              style={{ fontSize: 12, padding: "8px 16px" }}
              onClick={() => setPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <Lbl>Start Date</Lbl>
              <input type="date" className="inp" value={customStart} max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div>
              <Lbl>End Date</Lbl>
              <input type="date" className="inp" value={customEnd} min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <Lbl>Agency</Lbl>
            <select className="sel" value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
              <option value="">All Agencies</option>
              {sortedAgencies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Lbl>Product</Lbl>
            <select className="sel" value={productName} onChange={(e) => setProductName(e.target.value)}>
              <option value="">All Products</option>
              {sortedProducts.map((p) => (
                <option key={p.id || p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {meta && (
          <div style={{ marginTop: 14, fontSize: 11, color: C.textLight, fontWeight: 600 }}>
            📅 {meta.startDate} → {meta.endDate} &nbsp;·&nbsp; {agencyLabel} &nbsp;·&nbsp; {productLabel}
            {loading && <span style={{ marginLeft: 8, color: C.red }}><Spin /> Updating…</span>}
          </div>
        )}
      </div>

      {/* ── Error (non-blocking) ── */}
      {error && <div className="err-box" style={{ marginBottom: 18 }}>⚠️ {error}</div>}

      {/* ── First-load spinner ── */}
      {loading && !data ? (
        <div style={{ textAlign: "center", padding: 60, color: C.textLight }}>
          <span className="spin" style={{ fontSize: 16 }}>⏳</span> &nbsp;Generating report…
        </div>
      ) : kpis ? (
        <>
          {/* ── KPI cards ── */}
          <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
            <SC label="Total Revenue"    value={rs(kpis.totalRevenue)}    icon="💰" color={C.redDark} accent={C.red}    sub="net billed" />
            <SC label="Total Boxes Sold" value={num(kpis.totalBoxesSold)} icon="📦" color="#1e40af"  accent="#3b82f6"  sub="units billed" />
            <SC label="Total Discounts"  value={rs(kpis.totalDiscounts)}  icon="🏷️" color="#b45309"  accent={C.yellow} sub="vs list price" />
            <SC label="Total Invoices"   value={num(kpis.totalInvoices)}  icon="🧾" color="#065f46"  accent="#10b981"  sub="bills in range" />
          </div>

          {/* ── Tables / empty state ── */}
          {!hasData ? (
            <div className="empty-state card">
              <div className="icon">🔍</div>
              <p>No data found for the selected filters.</p>
            </div>
          ) : (
            <>
              <ReportTable
                title={primaryTitle}
                sub={`${primary.length} ${meta?.scenario === "agencies-for-product" ? "agencies" : "products"}`}
                columns={primaryColumns}
                rows={primary}
              />
              {meta?.scenario === "products+agencies" && (data.secondaryTable || []).length > 0 && (
                <ReportTable
                  title="🏢 Top Agencies"
                  sub={`${data.secondaryTable.length} agencies`}
                  columns={secondaryColumns}
                  rows={data.secondaryTable}
                />
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
