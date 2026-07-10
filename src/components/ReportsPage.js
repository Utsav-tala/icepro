// src/components/ReportsPage.js
// 📊 Reports — analytics page powered by the GET /api/reports aggregation endpoint.
// Filter bar (date preset / agency / product) → KPI cards → dynamic breakdown table(s).

import { useState, useEffect, useMemo } from "react";
import api from "../api";
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

  // ── Print ───────────────────────────────────────────────────────────────────
  function handlePrint() {
    if (!data || !kpis) return;
    printReport({ kpis, meta, primary, secondary: data.secondaryTable || [], primaryTitle, agencyLabel, productLabel });
  }

  return (
    <div className="fi">
      <div className="page-header-sticky">
        <PageHeader
          title="📊 Reports"
          sub="Analytics &amp; Insights"
          action={
            <button className="btn btn-yellow" onClick={handlePrint} disabled={!hasData}>
              🖨️ Print Report
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

// ── Print report in a new window (same pattern as printInvoice in helpers.js) ───
function printReport({ kpis, meta, primary, secondary, primaryTitle, agencyLabel, productLabel }) {
  const fmtRs  = (n) => "Rs. " + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const fmtNum = (n) => (Number(n) || 0).toLocaleString("en-IN");
  const fmtPct = (n) => (Number(n) || 0).toFixed(1) + "%";
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  const isProd = meta?.scenario === "agencies-for-product";
  const primaryCols = isProd
    ? ["#", "Agency Name", "Boxes Bought", "Revenue", "% of Sales", "Avg / Box"]
    : ["#", "Product Name", "Boxes Sold", "Revenue", "% of Rev", "Avg / Box"];
  const primaryRows = primary.map((r, i) => [
    i + 1,
    esc(isProd ? r.agencyName : r.name),
    fmtNum(isProd ? r.boxesBought : r.boxesSold),
    fmtRs(r.revenue),
    fmtPct(r.percentOfTotal),
    fmtRs(r.avgPricePerBox),
  ]);

  const buildTable = (heading, cols, rows) => `
    <h2>${heading}</h2>
    <table>
      <thead><tr>${cols.map((c, i) => `<th class="${i === 0 ? "" : i === 1 ? "l" : "r"}">${c}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${i === 0 ? "" : i === 1 ? "l" : "r"}">${cell}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>`;

  let secondaryHTML = "";
  if (meta?.scenario === "products+agencies" && secondary.length > 0) {
    const secRows = secondary.map((r, i) => [
      i + 1, esc(r.agencyName), fmtNum(r.totalBoxes), fmtRs(r.totalRevenue), fmtPct(r.percentOfTotal), fmtRs(r.avgPricePerBox),
    ]);
    secondaryHTML = buildTable("🏢 Top Agencies", ["#", "Agency Name", "Total Boxes", "Revenue", "% of Biz", "Avg / Box"], secRows);
  }

  const kpiCards = [
    ["Total Revenue", fmtRs(kpis.totalRevenue)],
    ["Total Boxes Sold", fmtNum(kpis.totalBoxesSold)],
    ["Total Discounts", fmtRs(kpis.totalDiscounts)],
    ["Total Invoices", fmtNum(kpis.totalInvoices)],
  ].map(([l, v]) => `<div class="kpi"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div></div>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>ICEPRO Report — ${esc(meta?.startDate)} to ${esc(meta?.endDate)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Nunito','Segoe UI',sans-serif;color:#1a0505;padding:24px;font-size:12px;}
    .head{text-align:center;border-bottom:3px double #c8181e;padding-bottom:10px;margin-bottom:14px;}
    .head h1{font-size:22px;color:#9e1015;}
    .head .meta{font-size:11px;color:#6b3333;margin-top:4px;}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}
    .kpi{border:1px solid #f0dada;border-top:3px solid #c8181e;border-radius:10px;padding:12px 14px;}
    .kpi-l{font-size:10px;text-transform:uppercase;color:#a07070;font-weight:700;letter-spacing:.5px;}
    .kpi-v{font-size:18px;font-weight:800;color:#1a0505;margin-top:6px;}
    h2{font-size:14px;color:#9e1015;margin:18px 0 8px;}
    table{width:100%;border-collapse:collapse;margin-bottom:8px;}
    th{background:#222;color:#fff;font-size:10px;text-transform:uppercase;padding:6px 8px;text-align:center;border:1px solid #444;}
    td{border:1px solid #ddd;padding:5px 8px;text-align:center;}
    th.l,td.l{text-align:left;} th.r,td.r{text-align:right;}
    tbody tr:nth-child(even){background:#fffafa;}
    .no-print{margin-bottom:16px;display:flex;gap:10px;}
    .no-print button{border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
    .btn-p{background:#c8181e;color:#fff;} .btn-c{background:#eee;color:#333;}
    @media print{.no-print{display:none!important;}body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  </style></head><body>
    <div class="no-print">
      <button class="btn-p" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button class="btn-c" onclick="window.close()">✕ Close</button>
    </div>
    <div class="head">
      <h1>VRUNDAVAN ICE CREAM — Sales Report</h1>
      <div class="meta">${esc(meta?.startDate)} &nbsp;to&nbsp; ${esc(meta?.endDate)} &nbsp;|&nbsp; ${esc(agencyLabel)} &nbsp;|&nbsp; ${esc(productLabel)}</div>
    </div>
    <div class="kpis">${kpiCards}</div>
    ${buildTable(primaryTitle, primaryCols, primaryRows)}
    ${secondaryHTML}
  </body></html>`;

  const w = window.open("", "_blank", "width=920,height=820,scrollbars=yes");
  if (w) { w.document.write(html); w.document.close(); }
  else alert("Allow pop-ups for this site to print the report.");
}
