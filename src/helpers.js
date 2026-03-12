// src/helpers.js

// ── Friendly Firebase auth errors ─────────────────────────────────────────────
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

// ── Invoice number generator: GB/XXXX ────────────────────────────────────────
export function genInvNo() {
  return `GB/${Math.floor(Math.random() * 9000) + 1000}`;
}

// ── Number to Indian words ────────────────────────────────────────────────────
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

// ── Print Invoice (opens new window with full A4 HTML) ────────────────────────
export function printInvoice(bill, agency) {
  const items    = bill.items || [];
  const subtotal = Number(bill.subtotal) || items.reduce((s, it) => s + (it.amount || 0), 0);
  const discAmt  = Number(bill.discountAmt) || 0;
  const discPct  = subtotal > 0 ? ((discAmt / subtotal) * 100).toFixed(2) : "0.00";
  const prevBal  = Number(bill.prevBalance) || 0;
  const grand    = subtotal - discAmt + prevBal;
  const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0);
  const dateStr  = bill.createdAt?.toDate?.()?.toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit", year:"numeric" })
                   || new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"2-digit", year:"numeric" });

  const itemRows = items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#fffafa"}">
      <td style="text-align:center;border:1px solid #ddd;padding:6px 8px;">${i + 1}</td>
      <td style="text-align:left;border:1px solid #ddd;padding:6px 8px;font-weight:600;">${it.name}</td>
      <td style="text-align:center;border:1px solid #ddd;padding:6px 8px;">${it.hsn || ""}</td>
      <td style="text-align:center;border:1px solid #ddd;padding:6px 8px;">${Number(it.qty || 0).toFixed(3)}</td>
      <td style="text-align:right;border:1px solid #ddd;padding:6px 8px;">${Number(it.rate || 0).toFixed(2)}</td>
      <td style="text-align:center;border:1px solid #ddd;padding:6px 8px;"></td>
      <td style="text-align:right;border:1px solid #ddd;padding:6px 8px;font-weight:700;">${Number(it.amount || 0).toFixed(2)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Invoice ${bill.billNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Nunito',sans-serif;color:#111;background:#fff;font-size:13px;}
    .page{max-width:820px;margin:0 auto;padding:16px;border:2px solid #444;}
    .no-print{margin-bottom:14px;display:flex;gap:10px;}
    .co-header{display:flex;align-items:center;justify-content:center;gap:16px;padding:10px 0 8px;border-bottom:3px double #333;}
    .co-name{font-family:'Playfair Display',serif;font-size:26px;font-weight:800;letter-spacing:0.5px;text-align:center;}
    .co-addr{font-size:12px;color:#444;text-align:center;margin-top:3px;}
    .inv-bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;background:#111;color:#fff;padding:5px 12px;margin:8px 0 0;}
    .inv-bar-left{font-size:12px;font-weight:700;}
    .inv-bar-mid{font-size:15px;font-weight:800;letter-spacing:4px;text-align:center;}
    .inv-bar-right{font-size:11px;font-weight:700;text-align:right;}
    .orig-badge{border:1px solid #fff;padding:2px 10px;display:inline-block;}
    .bill-grid{display:grid;grid-template-columns:1fr 220px;border:1px solid #ccc;border-top:none;}
    .bill-to{padding:10px 14px;border-right:1px solid #ccc;}
    .bill-inv{padding:10px 14px;}
    .fld{font-size:10px;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:1px;}
    .fval{font-size:13px;font-weight:700;margin-bottom:6px;}
    .fval-sm{font-size:11px;color:#444;margin-top:1px;}
    table{width:100%;border-collapse:collapse;font-size:12px;}
    thead th{background:#222;color:#fff;padding:7px 8px;font-size:11px;font-weight:700;text-transform:uppercase;border:1px solid #444;}
    tfoot td{background:#f0f0f0;font-weight:700;border:1px solid #ccc;padding:7px 8px;}
    .bottom-grid{display:grid;grid-template-columns:1fr 230px;border:1px solid #ccc;border-top:none;}
    .bank-sec{padding:10px 14px;border-right:1px solid #ccc;font-size:11px;}
    .bank-row{display:flex;gap:6px;margin-bottom:4px;}
    .bank-lbl{font-weight:700;min-width:90px;color:#555;}
    .totals-sec{padding:10px 14px;}
    .trow{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #e5e5e5;font-size:13px;}
    .trow:last-child{border-bottom:none;}
    .trow.grand{border-top:2px solid #111;border-bottom:none;margin-top:4px;padding-top:6px;}
    .trow.grand span:first-child{font-family:'Playfair Display',serif;font-weight:800;font-size:14px;}
    .trow.grand span:last-child{font-family:'Playfair Display',serif;font-weight:800;font-size:16px;}
    .closing-row{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ccc;border-top:none;padding:8px 14px;align-items:center;font-size:12px;}
    .closing-bal{font-size:19px;font-weight:800;color:#c8181e;text-align:right;}
    .words-row{border:1px solid #ccc;border-top:none;padding:8px 14px;font-size:12px;}
    .note-row{border:1px solid #ccc;border-top:none;padding:6px 14px;font-size:12px;}
    .footer-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ccc;border-top:none;}
    .terms-sec{padding:10px 14px;border-right:1px solid #ccc;font-size:10px;color:#444;}
    .terms-sec ol{padding-left:14px;}
    .terms-sec li{margin-bottom:3px;}
    .sign-sec{padding:10px 14px;text-align:right;font-size:12px;}
    .sign-sec .for{font-size:11px;color:#555;margin-bottom:36px;}
    .gstin-note{font-size:10px;color:#555;}
    @media print{.no-print{display:none!important;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  </style></head><body>
  <div class="page">
    <div class="no-print">
      <button onclick="window.print()" style="background:#c8181e;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#eee;color:#333;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">✕ Close</button>
    </div>
    <div class="co-header">
      <img src="${window.location.origin}/logo.png" style="height:68px;width:auto;" onerror="this.style.display='none'"/>
      <div>
        <div class="co-name">VRUNDAVAN MILK PRODUCTS</div>
        <div class="co-addr">DHORAJI ROAD, KALAVAD (SHITALA) &nbsp;|&nbsp; Mo: 95125 50255</div>
      </div>
    </div>
    <div class="inv-bar">
      <span class="inv-bar-left">Debit Memo</span>
      <span class="inv-bar-mid">TAX INVOICE</span>
      <span class="inv-bar-right"><span class="orig-badge">Original</span></span>
    </div>
    <div class="bill-grid">
      <div class="bill-to">
        <div class="fld">M/s.</div>
        <div class="fval" style="font-size:16px;">${agency?.name || bill.agencyName || "—"}</div>
        <div class="fval-sm">${agency?.phone || ""}</div>
        <div class="fval-sm" style="font-weight:700;">${agency?.city || ""}</div>
        <div class="fval-sm">Place of Supply : 24-Gujarat</div>
        ${agency?.gst ? `<div class="gstin-note" style="margin-top:4px;">GSTIN: ${agency.gst}</div>` : ""}
      </div>
      <div class="bill-inv">
        <div style="margin-bottom:10px;">
          <div class="fld">Invoice No.</div>
          <div class="fval">: &nbsp;${bill.billNo}</div>
        </div>
        <div>
          <div class="fld">Date</div>
          <div class="fval">: &nbsp;${dateStr}</div>
        </div>
        ${bill.createdByName ? `<div style="margin-top:8px;"><div class="fld">Prepared By</div><div class="fval" style="font-size:12px;">: &nbsp;${bill.createdByName}</div></div>` : ""}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:38px;">SrNo</th>
          <th style="text-align:left;">Product Name</th>
          <th style="width:68px;">HSN/SAC</th>
          <th style="width:58px;">Qty</th>
          <th style="width:70px;">Rate</th>
          <th style="width:54px;">GST %</th>
          <th style="width:82px;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:left;">
            <span class="gstin-note">GSTIN No.: 24AARFV6273D1ZV</span>
          </td>
          <td style="text-align:center;font-weight:800;">${totalQty.toFixed(3)}</td>
          <td colspan="2" style="text-align:right;font-weight:800;">Sub Total</td>
          <td style="text-align:right;font-weight:800;">${subtotal.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="bottom-grid">
      <div class="bank-sec">
        <div class="bank-row"><span class="bank-lbl">Bank Name</span><span>: AXIS BANK LTD</span></div>
        <div class="bank-row"><span class="bank-lbl">Bank A/c. No.</span><span>: 919020042817580</span></div>
        <div class="bank-row"><span class="bank-lbl">RTGS/IFSC Code</span><span>: UTIB0001316</span></div>
      </div>
      <div class="totals-sec">
        <div class="trow"><span>Sub Total</span><span>${subtotal.toFixed(2)}</span></div>
        <div class="trow" style="color:#c8181e;"><span>Discount &nbsp;<b>${discPct}%</b></span><span>${discAmt.toFixed(2)}</span></div>
        ${prevBal > 0 ? `<div class="trow" style="color:#d97706;"><span>Previous Balance</span><span>${prevBal.toFixed(2)}</span></div>` : ""}
        <div class="trow grand"><span>Grand Total</span><span>${grand.toFixed(2)}</span></div>
      </div>
    </div>
    <div class="closing-row">
      <div><b>Previous Balance :</b>&nbsp;&nbsp;<b style="font-size:14px;">${prevBal.toFixed(2)}</b>&nbsp;&nbsp;&nbsp;<b>Closing Balance :</b></div>
      <div class="closing-bal">-${grand.toFixed(2)}</div>
    </div>
    <div class="words-row"><b>Bill Amount :</b>&nbsp;&nbsp;<i>${toWords(grand)}</i></div>
    ${bill.notes ? `<div class="note-row"><b>Note :</b>&nbsp;${bill.notes}</div>` : "<div class='note-row'><b>Note :</b>&nbsp;</div>"}
    <div class="footer-grid">
      <div class="terms-sec">
        <b>Terms &amp; Condition :</b>
        <ol style="margin-top:5px;">
          <li>Goods once sold will not be taken back.</li>
          <li>Interest @18% p.a. will be charged if payment is not made within due date.</li>
          <li>Our risk and responsibility ceases as soon as the goods leave our premises.</li>
          <li>Subject to 'Kalavad' Jurisdiction only. E.&amp;O.E</li>
        </ol>
      </div>
      <div class="sign-sec">
        <div class="for">For, VRUNDAVAN MILK PRODUCTS</div>
        <div>(Authorised Signatory)</div>
      </div>
    </div>
  </div>
  </body></html>`;

  const w = window.open("", "_blank", "width=920,height=820,scrollbars=yes");
  if (w) { w.document.write(html); w.document.close(); }
  else alert("Allow pop-ups for this site to open invoices.");
}

// ── WhatsApp bill share ───────────────────────────────────────────────────────
export function shareWhatsApp(bill, agency) {
  const items = bill.items || [];
  const sub   = Number(bill.subtotal) || items.reduce((s, it) => s + (it.amount || 0), 0);
  const disc  = Number(bill.discountAmt) || 0;
  const prev  = Number(bill.prevBalance) || 0;
  const grand = sub - disc + prev;
  const date  = bill.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || new Date().toLocaleDateString("en-IN");
  const lines = items.map((it, i) =>
    `  ${i + 1}. ${it.name}\n     Qty: ${it.qty}  ×  Rs.${it.rate}  =  *Rs.${it.amount}*`
  ).join("\n");

  const msg = `🍦 *VRUNDAVAN MILK PRODUCTS*
DHORAJI ROAD, KALAVAD (SHITALA)
Mo: 95125 50255
━━━━━━━━━━━━━━━━━━━━
📋 *TAX INVOICE / DEBIT MEMO*
━━━━━━━━━━━━━━━━━━━━
*Invoice No :* ${bill.billNo}
*Date       :* ${date}
*M/s        :* ${agency?.name || bill.agencyName}
*City       :* ${agency?.city || ""}

*ITEMS:*
${lines}
━━━━━━━━━━━━━━━━━━━━
Sub Total         : Rs. ${sub.toFixed(2)}
Discount          : Rs. ${disc.toFixed(2)}${prev > 0 ? `\nPrev. Balance     : Rs. ${prev.toFixed(2)}` : ""}
━━━━━━━━━━━━━━━━━━━━
*💰 GRAND TOTAL   : Rs. ${grand.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━
_${toWords(grand)}_

🙏 Thank you for your business!
AXIS BANK | A/c: 919020042817580 | IFSC: UTIB0001316`;

  const phone = agency?.phone?.replace(/\D/g, "");
  const url   = phone
    ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}
