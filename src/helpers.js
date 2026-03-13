export function friendlyError(code) {
  const map = {
    "auth/email-already-in-use":   "This email is already registered.",
    "auth/invalid-email":          "Invalid email address.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password.",
    "auth/invalid-credential":     "Incorrect email or password.",
    "auth/too-many-requests":      "Too many attempts. Please wait a few minutes.",
    "auth/network-request-failed": "Network error. Check your internet.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

export function genInvNo() {
  return `GB/${Math.floor(Math.random() * 9000) + 1000}`;
}

export function computeBalance(agencyId, bills, payments) {
  const billed = bills
    .filter(b => b.agencyId === agencyId)
    .reduce((s, b) => s + (b.total || 0), 0);
  const paid = payments
    .filter(p => p.agencyId === agencyId)
    .reduce((s, p) => s + (p.total || 0), 0);
  return billed - paid;
}

export function balanceDisplay(bal) {
  if (bal > 0)  return { label: "Outstanding",    color: "#c8181e", display: `-Rs.${bal.toLocaleString()}` };
  if (bal < 0)  return { label: "Advance Credit", color: "#065f46", display: `+Rs.${Math.abs(bal).toLocaleString()}` };
  return              { label: "Settled",         color: "#065f46", display: "Rs.0" };
}

export function toWords(n) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens  = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (!n || n === 0) return "Zero Only";
  function chunk(num) {
    if (num === 0) return "";
    if (num < 20)  return ones[num] + " ";
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] + " " : " ");
  }
  const amt     = Math.round(n * 100) / 100;
  const intPart = Math.floor(amt);
  const decPart = Math.round((amt - intPart) * 100);
  let w = "";
  if (intPart >= 10000000) w += chunk(Math.floor(intPart / 10000000)) + "Crore ";
  if (intPart >= 100000)   w += chunk(Math.floor((intPart % 10000000) / 100000)) + "Lakh ";
  if (intPart >= 1000)     w += chunk(Math.floor((intPart % 100000) / 1000)) + "Thousand ";
  if (intPart >= 100)      w += chunk(Math.floor((intPart % 1000) / 100)) + "Hundred ";
  w += chunk(intPart % 100);
  if (decPart > 0) w += `And ${decPart}/100 Paise`;
  return w.trim() + " Only";
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT INVOICE
//
// Page capacity (verified against Chrome print with URL bar + page numbers):
//   Chrome eats ~70px top + ~40px bottom = ~110px overhead per print page.
//   A4 at 96dpi = 1123px. Usable ≈ 1123 - 110 = ~1013px.
//   (Conservative estimate used: ~920px to be safe with any margin settings.)
//
//   Page 1 fixed overhead:
//     co-header ~85px + inv-bar ~22px + bill-grid ~80px + table-head ~19px = 206px
//   Footer fixed overhead:
//     bank-row ~60px + prevbal ~35px + words ~25px + note/grand ~44px + terms/sign ~90px = 254px
//   Available for item rows on page 1: 920 - 206 - 254 = 460px → 460/20 = 23 rows
//   ROWS_P1 = 20  (3 row safety buffer)
//
//   Continuation page fixed overhead:
//     co-header ~85px + cont-bar ~22px + table-head ~19px = 126px
//   Available for rows: 920 - 126 - 254 = 540px → 540/20 = 27 rows
//   ROWS_CONT = 24 (3 row safety buffer)
//
//   Example: 36 items → page 1: items 1-20 (no footer), page 2: items 21-36
//            (16 items + 8 blank rows + footer) → EXACTLY 2 PDF pages ✓
//   Example:  2 items → page 1: 2 items + 18 blank rows + footer → 1 PDF page ✓
// ─────────────────────────────────────────────────────────────────────────────
export function printInvoice(bill, agency) {
  const items      = bill.items || [];
  const subtotal   = Number(bill.subtotal) || items.reduce((s, it) => s + (it.amount || 0), 0);
  const discAmt    = Number(bill.discountAmt) || 0;
  const discPct    = subtotal > 0 ? ((discAmt / subtotal) * 100).toFixed(2) : "0.00";
  const billAmt    = subtotal - discAmt;
  const prevBal    = Number(bill.prevBalance) || 0;
  const advUsed    = Number(bill.advanceUsed) || 0;
  const grandTotal = Math.max(0, billAmt + prevBal - advUsed);
  const totalQty   = items.reduce((s, it) => s + Number(it.qty || 0), 0);
  const dateStr    = bill.createdAt?.toDate?.()?.toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit", year:"numeric" })
                     || new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit", year:"numeric" });

  // ── Row capacity (see comment block above for math) ───────────────────────
  const ROWS_P1   = 20;   // items that fit on page 1 alongside footer
  const ROWS_CONT = 24;   // items that fit on continuation pages alongside footer

  // Fill page 1 first, then continuation pages (no even split)
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

  // ── Company header (every page) ───────────────────────────────────────────
  const coHeader = `
    <div class="co-header">
      <img src="${window.location.origin}/logo.png" class="co-logo" onerror="this.style.display='none'"/>
      <div class="co-text">
        <div class="co-name">VRUNDAVAN MILK PRODUCTS</div>
        <div class="co-addr">DHORAJI ROAD, KALAVAD (SHITALA) &nbsp;|&nbsp; Mo: 95125 50255</div>
      </div>
    </div>`;

  // ── Table column header ───────────────────────────────────────────────────
  const thead = `
    <thead>
      <tr>
        <th class="th" style="width:38px;">SrNo</th>
        <th class="th thl">Product Name</th>
        <th class="th" style="width:62px;">HSN/SAC</th>
        <th class="th" style="width:56px;">Qty</th>
        <th class="th" style="width:68px;">Rate</th>
        <th class="th" style="width:50px;">GST %</th>
        <th class="th" style="width:80px;">Amount</th>
      </tr>
    </thead>`;

  // ── Filled item rows ──────────────────────────────────────────────────────
  function buildRows(pageItems, srStart) {
    return pageItems.map((it, i) => `
      <tr style="background:${(srStart + i) % 2 === 0 ? "#ffffff" : "#fffafa"};">
        <td class="td tdc">${srStart + i + 1}</td>
        <td class="td tdl" style="font-weight:600;">${it.name}</td>
        <td class="td tdc">${it.hsn || ""}</td>
        <td class="td tdc">${Number(it.qty || 0).toFixed(3)}</td>
        <td class="td tdr">${Number(it.rate || 0).toFixed(2)}</td>
        <td class="td tdc"></td>
        <td class="td tdr" style="font-weight:700;">${Number(it.amount || 0).toFixed(2)}</td>
      </tr>`).join("");
  }

  // ── Blank rows — pads last page so footer stays at bottom of A4 ──────────
  // Each blank row is exactly 20px (same as item rows) so the layout is uniform.
  // Row count is capped at page capacity so total never overflows A4.
  function buildBlankRows(count) {
    if (count <= 0) return "";
    return Array.from({ length: count }, () =>
      `<tr style="height:20px;">
        <td class="td tdc"></td><td class="td tdl"></td>
        <td class="td tdc"></td><td class="td tdc"></td>
        <td class="td tdr"></td><td class="td tdc"></td>
        <td class="td tdr"></td>
       </tr>`
    ).join("");
  }

  // ── Footer — last page only ───────────────────────────────────────────────
  // Layout matches physical Vrundavan bill:
  //   Row A: Bank details (left) | Sub Total / Discount (right)
  //   Row B: Previous Balance ... Closing Balance  (full width)
  //   Row C: Bill Amount in words  (full width)
  //   Row D: Note (left) | Grand Total box (right)  ← matches screenshot
  //   Row E: Terms & Condition (left) | For VRUNDAVAN + Signatory (right)
  const footerHTML = `
    <div class="foot-bank-row">
      <div class="bank-sec">
        <div class="bank-row"><span class="bank-lbl">Bank Name</span><span>: AXIS BANK LTD</span></div>
        <div class="bank-row"><span class="bank-lbl">Bank A/c. No.</span><span>: 919020042817580</span></div>
        <div class="bank-row"><span class="bank-lbl">RTGS/IFSC Code</span><span>: UTIB0001316</span></div>
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
      <b>Bill Amount :</b>&nbsp;&nbsp;<i>${toWords(grandTotal)}</i>
    </div>

    <div class="foot-note-grand-row">
      <div class="note-sec">
        <b>Note :</b>&nbsp;${bill.notes || ""}
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
        <div class="for-label">For, VRUNDAVAN MILK PRODUCTS</div>
        <div style="flex:1;"></div>
        <div class="auth-label">(Authorised Signatory)</div>
      </div>
    </div>`;

  // ── Assemble all pages ────────────────────────────────────────────────────
  let allPagesHTML = "";
  let srStart = 0;

  pages.forEach((pageItems, pi) => {
    const isFirst    = pi === 0;
    const isLast     = pi === totalPages - 1;
    const capacity   = isFirst ? ROWS_P1 : ROWS_CONT;
    // Blank rows only on the last page, capped at remaining capacity
    const blankCount = isLast ? Math.max(0, capacity - pageItems.length) : 0;
    const cumQty     = items.slice(0, srStart + pageItems.length)
                            .reduce((s, it) => s + Number(it.qty || 0), 0);

    const tfoot = isLast
      ? `<tfoot>
           <tr>
             <td colspan="3" class="td tdl">
               <span style="font-size:10px;font-weight:700;color:#555;">GSTIN No.: 24AARFV6273D1ZV</span>
             </td>
             <td class="td tdc" style="font-weight:800;font-size:11px;">${totalQty.toFixed(3)}</td>
             <td colspan="2" class="td tdr" style="font-weight:800;font-size:11px;">Sub Total</td>
             <td class="td tdr" style="font-weight:800;font-size:11px;">${subtotal.toFixed(2)}</td>
           </tr>
         </tfoot>`
      : `<tfoot>
           <tr style="background:#f5f5f5;">
             <td colspan="7" class="td tdl" style="font-size:9px;color:#888;font-style:italic;">
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
        <span class="inv-bar-mid">TAX INVOICE</span>
        <span class="inv-bar-right"><span class="orig-badge">Original</span></span>
      </div>
      <div class="bill-grid">
        <div class="bill-to">
          <div class="fld-lbl">M/S.</div>
          <div style="font-size:15px;font-weight:800;margin:2px 0 4px;">${agency?.name || bill.agencyName || "—"}</div>
          <div style="font-size:11px;color:#444;margin-top:1px;">${agency?.phone || ""}</div>
          <div style="font-size:11px;font-weight:700;margin-top:1px;">${agency?.city || ""}</div>
          <div style="font-size:10px;color:#555;margin-top:2px;">Place of Supply : 24-Gujarat</div>
          ${agency?.gst ? `<div style="font-size:10px;color:#555;margin-top:2px;">GSTIN: ${agency.gst}</div>` : ""}
        </div>
        <div class="bill-inv">
          <div style="margin-bottom:8px;">
            <div class="fld-lbl">INVOICE NO.</div>
            <div style="font-size:14px;font-weight:800;">: &nbsp;${bill.billNo}</div>
          </div>
          <div style="margin-bottom:8px;">
            <div class="fld-lbl">DATE</div>
            <div style="font-size:14px;font-weight:800;">: &nbsp;${dateStr}</div>
          </div>
          ${bill.createdByName ? `
          <div>
            <div class="fld-lbl">PREPARED BY</div>
            <div style="font-size:12px;font-weight:600;">: &nbsp;${bill.createdByName}</div>
          </div>` : ""}
        </div>
      </div>
      ` : `
      <div class="cont-bar">
        <span>
          <b>Invoice:</b> ${bill.billNo} &nbsp;|&nbsp;
          <b>Date:</b> ${dateStr} &nbsp;|&nbsp;
          <b>M/s.</b> ${agency?.name || bill.agencyName}
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
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Invoice ${bill.billNo} — ${agency?.name || bill.agencyName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Nunito',sans-serif;color:#111;background:#fff;font-size:11px;}

    .page{max-width:820px;margin:0 auto;padding:10px 14px;border:2px solid #444;}
    .pg-break{page-break-after:always;border-bottom:none;}
    .no-print{margin-bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;}

    /* Company header */
    .co-header{display:flex;align-items:center;justify-content:center;gap:12px;padding:5px 0 6px;border-bottom:3px double #333;}
    .co-logo{height:54px;width:auto;}
    .co-name{font-family:'Playfair Display',serif;font-size:24px;font-weight:800;text-align:center;}
    .co-addr{font-size:10px;color:#444;text-align:center;margin-top:2px;}

    /* TAX INVOICE bar */
    .inv-bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;background:#111;color:#fff;padding:4px 12px;margin:5px 0 0;}
    .inv-bar-left{font-size:11px;font-weight:700;}
    .inv-bar-mid{font-size:14px;font-weight:800;letter-spacing:4px;text-align:center;}
    .inv-bar-right{font-size:11px;font-weight:700;text-align:right;}
    .orig-badge{border:1px solid #fff;padding:2px 8px;display:inline-block;}

    /* Bill-to section */
    .bill-grid{display:grid;grid-template-columns:1fr 200px;border:1px solid #ccc;border-top:none;}
    .bill-to{padding:6px 10px;border-right:1px solid #ccc;}
    .bill-inv{padding:6px 10px;}
    .fld-lbl{font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.3px;margin-bottom:1px;}

    /* Continuation header bar */
    .cont-bar{display:flex;justify-content:space-between;background:#f0f0f0;border:1px solid #ccc;border-top:none;padding:4px 10px;font-size:10px;color:#333;}

    /* Items table */
    .inv-table{width:100%;border-collapse:collapse;font-size:11px;}
    .th{background:#222;color:#fff;padding:5px 6px;font-size:9px;font-weight:700;text-transform:uppercase;border:1px solid #444;text-align:center;}
    .thl{text-align:left;}
    .td{border:1px solid #ddd;padding:3px 6px;height:20px;}
    .tdc{text-align:center;}
    .tdl{text-align:left;}
    .tdr{text-align:right;}
    tfoot td{background:#f0f0f0;font-weight:700;border:1px solid #ccc;padding:5px 7px;}

    /* ── Footer rows — layout matches physical Vrundavan bill exactly ── */

    /* Row A: Bank (left) | Sub Total + Discount (right) */
    .foot-bank-row{display:grid;grid-template-columns:1fr 230px;border:1px solid #ccc;border-top:none;}
    .bank-sec{padding:6px 10px;border-right:1px solid #ccc;}
    .bank-row{display:flex;gap:4px;margin-bottom:2px;font-size:10px;}
    .bank-lbl{font-weight:700;min-width:100px;color:#555;}
    .totals-sec{padding:6px 10px;}
    .trow{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dashed #eee;font-size:11px;}
    .trow:last-child{border-bottom:none;}

    /* Row B: Previous Balance / Closing Balance */
    .foot-prevbal-row{border:1px solid #ccc;border-top:none;padding:6px 10px;display:flex;align-items:center;gap:6px;}
    .prevbal-val{font-size:15px;font-weight:800;color:#222;}
    .closing-val{font-size:20px;font-weight:800;color:#c8181e;}

    /* Row C: Bill Amount in words */
    .foot-words-row{border:1px solid #ccc;border-top:none;padding:5px 10px;font-size:10px;line-height:1.5;}

    /* Row D: Note (left) | Grand Total box (right) — matches screenshot */
    .foot-note-grand-row{display:grid;grid-template-columns:1fr 230px;border:1px solid #ccc;border-top:none;min-height:34px;}
    .note-sec{padding:6px 10px;border-right:1px solid #ccc;font-size:10px;font-weight:700;}
    .grand-sec{padding:5px 10px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;}
    .grand-label{font-size:10px;font-weight:800;color:#222;margin-bottom:1px;text-transform:uppercase;letter-spacing:0.5px;}
    .grand-val{font-family:'Playfair Display',serif;font-size:19px;font-weight:800;color:#c8181e;}

    /* Row E: Terms (left) | For VRUNDAVAN + Signatory (right) */
    .foot-terms-sign-row{display:grid;grid-template-columns:1fr 200px;border:1px solid #ccc;border-top:none;}
    .terms-sec{padding:6px 10px;border-right:1px solid #ccc;font-size:9px;color:#444;line-height:1.5;}
    .sign-sec{padding:6px 10px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;min-height:58px;}
    .for-label{font-size:10px;font-weight:700;color:#333;}
    .auth-label{font-size:10px;color:#333;}

    @media print {
      .no-print{display:none!important;}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .page{border:none;padding:6px;max-width:100%;}
      .pg-break{page-break-after:always;}
    }
  </style></head><body>

  <div class="no-print">
    <button onclick="window.print()"
      style="background:#c8181e;color:#fff;border:none;padding:9px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">
      🖨️ Print / Save as PDF
    </button>
    <button onclick="window.close()"
      style="background:#eee;color:#333;border:none;padding:9px 16px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif;">
      ✕ Close
    </button>
    ${totalPages > 1
      ? `<span style="background:#fff3cd;border:1px solid #ffc107;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;color:#856404;">
           📄 ${totalPages} pages
         </span>`
      : ""}
    <span style="background:#f0f9ff;border:1px solid #bae6fd;padding:6px 12px;border-radius:8px;font-size:10px;color:#0369a1;">
      💡 In print dialog: set Margins to <b>Minimum</b> &amp; uncheck <b>Headers and footers</b>
    </span>
  </div>

  ${allPagesHTML}

  </body></html>`;

  const w = window.open("", "_blank", "width=920,height=820,scrollbars=yes");
  if (w) { w.document.write(html); w.document.close(); }
  else alert("Allow pop-ups for this site to open invoices.");
}

// ── WhatsApp bill share ───────────────────────────────────────────────────────
export function shareWhatsApp(bill, agency) {
  const items    = bill.items || [];
  const sub      = Number(bill.subtotal) || items.reduce((s, it) => s + (it.amount || 0), 0);
  const disc     = Number(bill.discountAmt) || 0;
  const billAmt  = sub - disc;
  const prevBal  = Number(bill.prevBalance) || 0;
  const advUsed  = Number(bill.advanceUsed) || 0;
  const grandTotal = Math.max(0, billAmt + prevBal - advUsed);
  const date     = bill.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || new Date().toLocaleDateString("en-IN");
  const lines    = items.map((it, i) =>
    `  ${i + 1}. ${it.name}\n     Qty: ${it.qty}  x  Rs.${it.rate}  =  *Rs.${it.amount}*`
  ).join("\n");

  let totals = `Sub Total         : Rs. ${sub.toFixed(2)}\n`;
  if (disc > 0)    totals += `Discount          : Rs. ${disc.toFixed(2)}\n`;
  totals            += `Current Bill      : Rs. ${billAmt.toFixed(2)}\n`;
  if (prevBal > 0) totals += `Previous Balance  : Rs. ${prevBal.toFixed(2)}\n`;
  if (advUsed > 0) totals += `Advance Deducted  : Rs. ${advUsed.toFixed(2)}\n`;

  const msg = `*VRUNDAVAN MILK PRODUCTS*
DHORAJI ROAD, KALAVAD (SHITALA)
Mo: 95125 50255
━━━━━━━━━━━━━━━━━━━━
*TAX INVOICE / DEBIT MEMO*
━━━━━━━━━━━━━━━━━━━━
Invoice No : ${bill.billNo}
Date       : *${date}*
M/s        : *${agency?.name || bill.agencyName}*
City       : ${agency?.city || ""}

*ITEMS:*
${lines}
━━━━━━━━━━━━━━━━━━━━
${totals}━━━━━━━━━━━━━━━━━━━━
*TOTAL DUE : Rs. ${grandTotal.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━
_${toWords(grandTotal)}_

Thank you for your business!
AXIS BANK | A/c: 919020042817580 | IFSC: UTIB0001316`;

  const phone = agency?.phone?.replace(/\D/g, "");
  const url   = phone
    ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}
