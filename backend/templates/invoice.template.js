// backend/templates/invoice.template.js
// Server-side port of the client `printInvoice()` in frontend/src/helpers.js.
// Produces a complete, print-ready HTML string for a single bill — Puppeteer
// renders this to a pixel-perfect A4 PDF (emulateMediaType('print')).
//
// Differences from the client version (intentional):
//   • Logo is embedded as a base64 data URI (no network access inside Puppeteer).
//   • All user-supplied strings are HTML-escaped (agency/item names, notes).
//   • Dates come from a real JS Date (bill.createdAt), not a Firestore Timestamp.
//   • No "no-print" toolbar / window.open — this is headless rendering only.
//
// billType: "gst"    → TAX INVOICE  (HSN/SAC + GST% columns, GSTIN, VMP series)
// billType: "nongst" → INVOICE      (no GST columns, no GSTIN, GB series)
//
// Pagination capacity (kept identical to the verified client values):
//   ROWS_P1   = 20  (first page — has the bill-to/invoice grid overhead)
//   ROWS_CONT = 24  (continuation pages — lighter header)

const { logoDataUri, fontsCss } = require("./assets");

// ── HTML escape — user strings must never break the markup or inject nodes ────
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

// ── Amount in words (Indian system) — ported from helpers.js:toWords ──────────
function toWords(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (!n || n === 0) return "Zero Only";
  const chunk = (num) => {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] + " " : " ");
  };
  const amt = Math.round(n * 100) / 100;
  const intPart = Math.floor(amt);
  const decPart = Math.round((amt - intPart) * 100);
  let w = "";
  if (intPart >= 10000000) w += chunk(Math.floor(intPart / 10000000)) + "Crore ";
  if (intPart >= 100000) w += chunk(Math.floor((intPart % 10000000) / 100000)) + "Lakh ";
  if (intPart >= 1000) w += chunk(Math.floor((intPart % 100000) / 1000)) + "Thousand ";
  if (intPart >= 100) w += chunk(Math.floor((intPart % 1000) / 100)) + "Hundred ";
  w += chunk(intPart % 100);
  if (decPart > 0) w += `And ${decPart}/100 Paise`;
  return w.trim() + " Only";
}

const ROWS_P1   = 20;
const ROWS_CONT = 24;

/**
 * Build the full invoice HTML document for a bill.
 * @param {object} bill     Bill document (plain object) — items, totals, billNo, createdAt…
 * @param {object} agency   Populated agency (name, city, phone, gst) — may be null
 * @param {object} settings Settings document — business + bank sections
 * @returns {string} complete <html> document
 */
function buildInvoiceHTML(bill, agency = {}, settings = {}) {
  const billType = bill.billType || "nongst";
  const isGST    = billType === "gst";

  // Derive gross / net / discount PER ITEM from the ground-truth line data
  // (qty, rate, amount). The stored `disc` field is unreliable — legacy bills have
  // disc=0 while the discount is baked into `amount` — so we recompute the real
  // discount % from gross vs net. This keeps the DISC% column and every total
  // correct for legacy, current, and future bills alike.
  const rawItems = bill.items || [];
  const items = rawItems.map((it) => {
    const qty   = Number(it.qty || 0);
    const rate  = Number(it.rate || 0);
    const gross = qty * rate;                                   // list value (pre-discount)
    const net   = Number(it.amount != null ? it.amount : gross); // what's actually charged
    const discAmt = Math.max(0, gross - net);
    const discPct = gross > 0 ? (discAmt / gross) * 100 : 0;
    return { ...it, qty, rate, gross, net, discPct };
  });

  const subtotal    = items.reduce((s, it) => s + it.gross, 0);   // GROSS subtotal (Σ qty*rate)
  const netSubtotal = items.reduce((s, it) => s + it.net, 0);     // net = current bill amount
  const discAmt     = subtotal - netSubtotal;                     // total per-item discount
  const discPct     = subtotal > 0 ? ((discAmt / subtotal) * 100).toFixed(2) : "0.00";
  const billAmt     = netSubtotal;
  const prevBal     = Number(bill.prevBalance) || 0;   // signed: >0 owes, <0 advance
  const advUsed     = Number(bill.advanceUsed) || 0;   // display only
  // Use the SIGNED prevBalance directly — advance credit is already negative here,
  // so adding it reduces the bill. Subtracting advUsed too would double-count.
  const grandTotal  = Math.max(0, billAmt + prevBal);
  const totalQty    = items.reduce((s, it) => s + it.qty, 0);
  const dateStr    = new Date(bill.createdAt || Date.now()).toLocaleDateString("en-IN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  // ── Split items across pages ──────────────────────────────────────────────
  const pages = [];
  if (items.length <= ROWS_P1) {
    pages.push(items);
  } else {
    pages.push(items.slice(0, ROWS_P1));
    let rem = items.slice(ROWS_P1);
    while (rem.length > 0) {
      pages.push(rem.slice(0, ROWS_CONT));
      rem = rem.slice(ROWS_CONT);
    }
  }
  const totalPages = pages.length;

  // ── Company header ────────────────────────────────────────────────────────
  const b      = settings?.business || {};
  const cName  = esc(b.companyName || "VRUNDAVAN MILK PRODUCTS");
  const cAddr  = esc(b.address || "DHORAJI ROAD, KALAVAD (SHITALA)");
  const cPhone = esc(b.phone || "95125 50255");
  const cGst   = esc(b.gstin || "24AARFV6273D1ZV");

  const logoImg = logoDataUri
    ? `<img src="${logoDataUri}" class="co-logo"/>`
    : "";

  const coHeader = `
    <div class="co-header">
      ${logoImg}
      <div class="co-text">
        <div class="co-name">${cName}</div>
        <div class="co-addr">${cAddr} &nbsp;|&nbsp; Mo: ${cPhone}</div>
      </div>
    </div>`;

  // ── Table column header ───────────────────────────────────────────────────
  const thead = isGST ? `
    <thead>
      <tr>
        <th class="th" style="width:38px;">SrNo</th>
        <th class="th thl">Product Name</th>
        <th class="th" style="width:62px;">HSN/SAC</th>
        <th class="th" style="width:56px;">Qty</th>
        <th class="th" style="width:68px;">Rate</th>
        <th class="th" style="width:46px;">Disc %</th>
        <th class="th" style="width:50px;">GST %</th>
        <th class="th" style="width:80px;">Amount</th>
      </tr>
    </thead>` : `
    <thead>
      <tr>
        <th class="th" style="width:38px;">SrNo</th>
        <th class="th thl">Product Name</th>
        <th class="th" style="width:70px;">Qty</th>
        <th class="th" style="width:80px;">Rate</th>
        <th class="th" style="width:56px;">Disc %</th>
        <th class="th" style="width:90px;">Amount</th>
      </tr>
    </thead>`;

  // AMOUNT column shows the GROSS line value (qty*rate); the DISC% column shows the
  // real per-item discount; the bill-level Discount line below subtracts to the net.
  const buildRows = (pageItems, srStart) =>
    pageItems.map((it, i) => isGST ? `
      <tr style="background:${(srStart + i) % 2 === 0 ? "#ffffff" : "#fffafa"};">
        <td class="td tdc">${srStart + i + 1}</td>
        <td class="td tdl" style="font-weight:600;">${esc(it.name)}</td>
        <td class="td tdc">${esc(it.hsn || "")}</td>
        <td class="td tdc">${it.qty.toFixed(3)}</td>
        <td class="td tdr">${it.rate.toFixed(2)}</td>
        <td class="td tdc" style="color:#065f46;font-weight:700;">${it.discPct > 0 ? it.discPct.toFixed(1) + "%" : "—"}</td>
        <td class="td tdc"></td>
        <td class="td tdr" style="font-weight:700;">${it.gross.toFixed(2)}</td>
      </tr>` : `
      <tr style="background:${(srStart + i) % 2 === 0 ? "#ffffff" : "#fffafa"};">
        <td class="td tdc">${srStart + i + 1}</td>
        <td class="td tdl" style="font-weight:600;">${esc(it.name)}</td>
        <td class="td tdc">${it.qty.toFixed(3)}</td>
        <td class="td tdr">${it.rate.toFixed(2)}</td>
        <td class="td tdc" style="color:#065f46;font-weight:700;">${it.discPct > 0 ? it.discPct.toFixed(1) + "%" : "—"}</td>
        <td class="td tdr" style="font-weight:700;">${it.gross.toFixed(2)}</td>
      </tr>`
    ).join("");

  const buildBlankRows = (count) => {
    if (count <= 0) return "";
    const blankRow = isGST
      ? `<tr style="height:20px;"><td class="td tdc"></td><td class="td tdl"></td><td class="td tdc"></td><td class="td tdc"></td><td class="td tdr"></td><td class="td tdc"></td><td class="td tdc"></td><td class="td tdr"></td></tr>`
      : `<tr style="height:20px;"><td class="td tdc"></td><td class="td tdl"></td><td class="td tdc"></td><td class="td tdr"></td><td class="td tdc"></td><td class="td tdr"></td></tr>`;
    return Array.from({ length: count }, () => blankRow).join("");
  };

  // ── Footer ────────────────────────────────────────────────────────────────
  const bk    = settings?.bank || {};
  const bName = esc(bk.bankName || "AXIS BANK LTD");
  const bAcc  = esc(bk.accountNo || "919020042817580");
  const bIfsc = esc(bk.ifsc || "UTIB0001316");

  const footerHTML = `
    <div class="foot-bank-row">
      <div class="bank-sec">
        <div class="bank-row"><span class="bank-lbl">Bank Name</span><span>: ${bName}</span></div>
        <div class="bank-row"><span class="bank-lbl">Bank A/c. No.</span><span>: ${bAcc}</span></div>
        <div class="bank-row"><span class="bank-lbl">RTGS/IFSC Code</span><span>: ${bIfsc}</span></div>
      </div>
      <div class="totals-sec">
        <div class="trow"><span>Sub Total</span><span>${subtotal.toFixed(2)}</span></div>
        <div class="trow" style="color:#c8181e;">
          <span>Discount &nbsp;<b>${discPct}%</b></span>
          <span>${discAmt.toFixed(2)}</span>
        </div>
        ${prevBal > 0 ? `<div class="trow" style="color:#c8181e;font-weight:700;"><span>Previous Balance</span><span>+ ${prevBal.toFixed(2)}</span></div>` : ""}
        ${advUsed > 0 ? `<div class="trow" style="color:#065f46;font-weight:700;"><span>Advance Deducted</span><span>- ${advUsed.toFixed(2)}</span></div>` : ""}
      </div>
    </div>

    <div class="foot-prevbal-row">
      <span class="fld-lbl">PREVIOUS BALANCE :</span>
      <span class="prevbal-val">${prevBal > 0 ? prevBal.toFixed(2) : "0.00"}</span>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      <span class="fld-lbl">CLOSING BALANCE :</span>
      <span class="closing-val">-${grandTotal.toFixed(2)}</span>
    </div>

    <div class="foot-words-row">
      <b>Bill Amount :</b>&nbsp;&nbsp;<i>${esc(toWords(grandTotal))}</i>
    </div>

    <div class="foot-note-grand-row">
      <div class="note-sec">
        <b>Note :</b>&nbsp;${esc(bill.notes || "")}
      </div>
      <div class="grand-sec">
        <div class="grand-label">Grand Total</div>
        <div class="grand-val">${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
      </div>
    </div>

    <div class="foot-terms-sign-row">
      <div class="terms-sec">
        <b>Terms &amp; Condition :</b>
        <ol style="margin-top:4px;padding-left:14px;">
          <li>Goods once sold will not be taken back.</li>
          <li>Interest @18% p.a. will be charged if payment is not made within due date.</li>
          <li>Our risk and responsibility ceases as soon as the goods leave our premises.</li>
          <li>"Subject to 'Kalavad' Jurisdiction only. E.&amp;O.E"</li>
        </ol>
      </div>
      <div class="sign-sec">
        <div class="for-label">For, ${cName}</div>
        <div style="flex:1;"></div>
        <div class="auth-label">(Authorised Signatory)</div>
      </div>
    </div>`;

  const invBarCenter = isGST ? "TAX INVOICE" : "INVOICE";
  const agencyName   = esc(agency?.name || bill.agencyName || "—");

  // ── Assemble all pages ────────────────────────────────────────────────────
  let allPagesHTML = "";
  let srStart = 0;

  pages.forEach((pageItems, pi) => {
    const isFirst = pi === 0;
    const isLast  = pi === totalPages - 1;
    const capacity = isFirst ? ROWS_P1 : ROWS_CONT;
    const blankCount = isLast ? Math.max(0, capacity - pageItems.length) : 0;
    const cumQty = items.slice(0, srStart + pageItems.length)
      .reduce((s, it) => s + Number(it.qty || 0), 0);

    const colSpanTotal = isGST ? 8 : 6;
    const colSpanLeft  = isGST ? 3 : 2;
    const colSpanMid   = isGST ? 3 : 2;

    const tfoot = isLast
      ? `<tfoot>
           <tr>
             <td colspan="${colSpanLeft}" class="td tdl">
               ${isGST ? `<span style="font-size:10px;font-weight:700;color:#555;">GSTIN No.: ${cGst}</span>` : ""}
             </td>
             <td class="td tdc" style="font-weight:800;font-size:11px;">${totalQty.toFixed(3)}</td>
             <td colspan="${colSpanMid}" class="td tdr" style="font-weight:800;font-size:11px;">Sub Total</td>
             <td class="td tdr" style="font-weight:800;font-size:11px;">${subtotal.toFixed(2)}</td>
           </tr>
         </tfoot>`
      : `<tfoot>
           <tr style="background:#f5f5f5;">
             <td colspan="${colSpanTotal}" class="td tdl" style="font-size:9px;color:#888;font-style:italic;">
               Page ${pi + 1} of ${totalPages} &nbsp;·&nbsp;
               Cumulative Qty: ${cumQty.toFixed(3)} &nbsp;·&nbsp;
               Continued on next page...
             </td>
           </tr>
         </tfoot>`;

    allPagesHTML += `
    <div class="page${isLast ? "" : " pg-break"}">
      ${coHeader}

      ${isFirst ? `
      <div class="inv-bar">
        <span class="inv-bar-left">Debit Memo</span>
        <span class="inv-bar-mid">${invBarCenter}</span>
        <span class="inv-bar-right"><span class="orig-badge">Original</span></span>
      </div>
      <div class="bill-grid">
        <div class="bill-to">
          <div class="fld-lbl">M/S.</div>
          <div style="font-size:15px;font-weight:800;margin:2px 0 4px;">${agencyName}</div>
          <div style="font-size:11px;color:#444;margin-top:1px;">${esc(agency?.phone || "")}</div>
          <div style="font-size:11px;font-weight:700;margin-top:1px;">${esc(agency?.city || "")}</div>
          <div style="font-size:10px;color:#555;margin-top:2px;">Place of Supply : 24-Gujarat</div>
          ${isGST && agency?.gst ? `<div style="font-size:10px;color:#555;margin-top:2px;">GSTIN: ${esc(agency.gst)}</div>` : ""}
        </div>
        <div class="bill-inv">
          <div style="margin-bottom:8px;">
            <div class="fld-lbl">INVOICE NO.</div>
            <div style="font-size:14px;font-weight:800;">: &nbsp;${esc(bill.billNo)}</div>
          </div>
          <div style="margin-bottom:8px;">
            <div class="fld-lbl">DATE</div>
            <div style="font-size:14px;font-weight:800;">: &nbsp;${dateStr}</div>
          </div>
          ${isGST ? `<div style="margin-bottom:8px;"><div class="fld-lbl">BILL TYPE</div><div style="font-size:11px;font-weight:700;color:#c8181e;">: &nbsp;GST INVOICE</div></div>` : `<div style="margin-bottom:8px;"><div class="fld-lbl">BILL TYPE</div><div style="font-size:11px;font-weight:700;color:#555;">: &nbsp;NON-GST</div></div>`}
          ${bill.createdByName ? `
          <div>
            <div class="fld-lbl">PREPARED BY</div>
            <div style="font-size:12px;font-weight:600;">: &nbsp;${esc(bill.createdByName)}</div>
          </div>` : ""}
        </div>
      </div>
      ` : `
      <div class="cont-bar">
        <span>
          <b>Invoice:</b> ${esc(bill.billNo)} &nbsp;|&nbsp;
          <b>Date:</b> ${dateStr} &nbsp;|&nbsp;
          <b>M/s.</b> ${agencyName}
        </span>
        <span style="font-weight:700;">Page ${pi + 1} of ${totalPages}</span>
      </div>
      `}

      <table class="inv-table">
        ${thead}
        <tbody>
          ${buildRows(pageItems, srStart)}
          ${buildBlankRows(blankCount)}
        </tbody>
        ${tfoot}
      </table>

      ${isLast ? footerHTML : ""}
    </div>`;

    srStart += pageItems.length;
  });

  // ── Full HTML document ────────────────────────────────────────────────────
  // Fonts (Playfair Display + Nunito) are inlined via fontsCss — Puppeteer has no
  // network, so they must be embedded to match the app's on-screen branding.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Invoice ${esc(bill.billNo)} — ${agencyName}</title>
  <style>
    ${fontsCss}
    @page { size: A4; margin: 6mm; }
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Nunito',Arial,sans-serif;color:#111;background:#fff;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}

    .page{padding:6px;}
    .pg-break{page-break-after:always;}

    .co-header{display:flex;align-items:center;justify-content:center;gap:12px;padding:5px 0 6px;border-bottom:3px double #333;}
    .co-logo{height:54px;width:auto;}
    .co-name{font-family:'Playfair Display',serif;font-size:24px;font-weight:800;text-align:center;letter-spacing:.5px;}
    .co-addr{font-size:10px;color:#444;text-align:center;margin-top:2px;}

    .inv-bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;background:#111;color:#fff;padding:4px 12px;margin:5px 0 0;}
    .inv-bar-left{font-size:11px;font-weight:700;}
    .inv-bar-mid{font-size:14px;font-weight:800;letter-spacing:4px;text-align:center;}
    .inv-bar-right{font-size:11px;font-weight:700;text-align:right;}
    .orig-badge{border:1px solid #fff;padding:2px 8px;display:inline-block;}

    .bill-grid{display:grid;grid-template-columns:1fr 200px;border:1px solid #ccc;border-top:none;}
    .bill-to{padding:6px 10px;border-right:1px solid #ccc;}
    .bill-inv{padding:6px 10px;}
    .fld-lbl{font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.3px;margin-bottom:1px;}

    .cont-bar{display:flex;justify-content:space-between;background:#f0f0f0;border:1px solid #ccc;border-top:none;padding:4px 10px;font-size:10px;color:#333;}

    .inv-table{width:100%;border-collapse:collapse;font-size:11px;}
    .th{background:#222;color:#fff;padding:5px 6px;font-size:9px;font-weight:700;text-transform:uppercase;border:1px solid #444;text-align:center;}
    .thl{text-align:left;}
    .td{border:1px solid #ddd;padding:3px 6px;height:20px;}
    .tdc{text-align:center;}
    .tdl{text-align:left;}
    .tdr{text-align:right;}
    tfoot td{background:#f0f0f0;font-weight:700;border:1px solid #ccc;padding:5px 7px;}

    .foot-bank-row{display:grid;grid-template-columns:1fr 230px;border:1px solid #ccc;border-top:none;}
    .bank-sec{padding:6px 10px;border-right:1px solid #ccc;}
    .bank-row{display:flex;gap:4px;margin-bottom:2px;font-size:10px;}
    .bank-lbl{font-weight:700;min-width:100px;color:#555;}
    .totals-sec{padding:6px 10px;}
    .trow{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dashed #eee;font-size:11px;}
    .trow:last-child{border-bottom:none;}

    .foot-prevbal-row{border:1px solid #ccc;border-top:none;padding:6px 10px;display:flex;align-items:center;gap:6px;}
    .prevbal-val{font-size:15px;font-weight:800;color:#222;}
    .closing-val{font-size:20px;font-weight:800;color:#c8181e;}

    .foot-words-row{border:1px solid #ccc;border-top:none;padding:5px 10px;font-size:10px;line-height:1.5;}

    .foot-note-grand-row{display:grid;grid-template-columns:1fr 230px;border:1px solid #ccc;border-top:none;min-height:34px;}
    .note-sec{padding:6px 10px;border-right:1px solid #ccc;font-size:10px;font-weight:700;}
    .grand-sec{padding:5px 10px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;}
    .grand-label{font-size:10px;font-weight:800;color:#222;margin-bottom:1px;text-transform:uppercase;letter-spacing:0.5px;}
    .grand-val{font-family:'Playfair Display',serif;font-size:19px;font-weight:800;color:#c8181e;}

    .foot-terms-sign-row{display:grid;grid-template-columns:1fr 200px;border:1px solid #ccc;border-top:none;}
    .terms-sec{padding:6px 10px;border-right:1px solid #ccc;font-size:9px;color:#444;line-height:1.5;}
    .sign-sec{padding:6px 10px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;min-height:58px;}
    .for-label{font-size:10px;font-weight:700;color:#333;}
    .auth-label{font-size:10px;color:#333;}
  </style></head><body>
  ${allPagesHTML}
  </body></html>`;
}

module.exports = { buildInvoiceHTML };
