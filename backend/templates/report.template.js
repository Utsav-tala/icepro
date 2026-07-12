// backend/templates/report.template.js
// Server-side port of the client `printReport()` in frontend/src/components/ReportsPage.js.
// Renders the analytics report (KPI cards + primary/secondary breakdown tables)
// to a print-ready HTML string for Puppeteer → A4 PDF.
//
// Input `report` is exactly the shape returned by reports.service.js:getReportData():
//   { kpis, primaryTable, secondaryTable, meta:{ scenario, startDate, endDate, filters } }

const { logoDataUri, fontsCss } = require("./assets");

const esc    = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtRs  = (n) => "Rs. " + Math.round(Number(n) || 0).toLocaleString("en-IN");
const fmtNum = (n) => (Number(n) || 0).toLocaleString("en-IN");
const fmtPct = (n) => (Number(n) || 0).toFixed(1) + "%";

/**
 * Build the full report HTML document.
 * @param {object} report   Output of getReportData()
 * @param {object} settings Settings document (business section — company name)
 * @param {object} labels   Optional { agencyLabel, productLabel } for the meta line
 * @returns {string} complete <html> document
 */
function buildReportHTML(report, settings = {}, labels = {}) {
  const { kpis = {}, primaryTable = [], secondaryTable = [], meta = {} } = report || {};
  const cName = esc(settings?.business?.companyName || "VRUNDAVAN MILK PRODUCTS");
  const agencyLabel  = esc(labels.agencyLabel  || (meta?.filters?.agencyId ? "Filtered Agency" : "All Agencies"));
  const productLabel = esc(labels.productLabel || (meta?.filters?.productName ? meta.filters.productName : "All Products"));

  const isProd = meta?.scenario === "agencies-for-product";

  const primaryCols = isProd
    ? ["#", "Agency Name", "Boxes Bought", "Revenue", "% of Sales", "Avg / Box"]
    : ["#", "Product Name", "Boxes Sold", "Revenue", "% of Rev", "Avg / Box"];
  const primaryRows = primaryTable.map((r, i) => [
    i + 1,
    esc(isProd ? r.agencyName : r.name),
    fmtNum(isProd ? r.boxesBought : r.boxesSold),
    fmtRs(r.revenue),
    fmtPct(r.percentOfTotal),
    fmtRs(r.avgPricePerBox),
  ]);
  const primaryTitle = isProd ? `Agencies that bought ${productLabel}` : "Product-wise Sales";

  const buildTable = (heading, cols, rows) => `
    <h2>${heading}</h2>
    <table>
      <thead><tr>${cols.map((c, i) => `<th class="${i === 0 ? "" : i === 1 ? "l" : "r"}">${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.length
          ? rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${i === 0 ? "" : i === 1 ? "l" : "r"}">${cell}</td>`).join("")}</tr>`).join("")
          : `<tr><td colspan="${cols.length}" style="text-align:center;color:#999;padding:14px;">No data for this range</td></tr>`}
      </tbody>
    </table>`;

  let secondaryHTML = "";
  if (meta?.scenario === "products+agencies" && secondaryTable.length > 0) {
    const secRows = secondaryTable.map((r, i) => [
      i + 1, esc(r.agencyName), fmtNum(r.totalBoxes), fmtRs(r.totalRevenue), fmtPct(r.percentOfTotal), fmtRs(r.avgPricePerBox),
    ]);
    secondaryHTML = buildTable("Top Agencies", ["#", "Agency Name", "Total Boxes", "Revenue", "% of Biz", "Avg / Box"], secRows);
  }

  const kpiCards = [
    ["Total Revenue", fmtRs(kpis.totalRevenue)],
    ["Total Boxes Sold", fmtNum(kpis.totalBoxesSold)],
    ["Total Discounts", fmtRs(kpis.totalDiscounts)],
    ["Total Invoices", fmtNum(kpis.totalInvoices)],
  ].map(([l, v]) => `<div class="kpi"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div></div>`).join("");

  const logoImg = logoDataUri ? `<img src="${logoDataUri}" class="logo"/>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>ICEPRO Report — ${esc(meta?.startDate)} to ${esc(meta?.endDate)}</title>
  <style>
    ${fontsCss}
    @page { size: A4; margin: 10mm; }
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Nunito',Arial,sans-serif;color:#1a0505;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .head{display:flex;align-items:center;justify-content:center;gap:14px;text-align:center;border-bottom:3px double #c8181e;padding-bottom:10px;margin-bottom:14px;}
    .head .logo{height:52px;width:auto;}
    .head h1{font-family:'Playfair Display',serif;font-size:22px;color:#9e1015;}
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
    .foot{margin-top:18px;text-align:center;font-size:9px;color:#999;}
  </style></head><body>
    <div class="head">
      ${logoImg}
      <div>
        <h1>${cName} — Sales Report</h1>
        <div class="meta">${esc(meta?.startDate)} &nbsp;to&nbsp; ${esc(meta?.endDate)} &nbsp;|&nbsp; ${agencyLabel} &nbsp;|&nbsp; ${productLabel}</div>
      </div>
    </div>
    <div class="kpis">${kpiCards}</div>
    ${buildTable(primaryTitle, primaryCols, primaryRows)}
    ${secondaryHTML}
    <div class="foot">Generated by ICEPRO ERP · ${new Date().toLocaleString("en-IN")}</div>
  </body></html>`;
}

module.exports = { buildReportHTML };
