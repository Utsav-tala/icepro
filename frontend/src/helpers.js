// src/helpers.js
export function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Invalid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes.",
    "auth/network-request-failed": "Network error. Check your internet.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ── Financial year helper ─────────────────────────────────────────────────────
// In India, FY runs April 1 → March 31.
// April 2025 → March 2026 = "25-26"
export function getCurrentFY() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

// ── Balance helpers ───────────────────────────────────────────────────────────
export function computeBalance(agencyId, bills, payments) {
  const id = String(agencyId);
  const billed = bills
    .filter(b => String(b.agencyId) === id)
    .reduce((s, b) => s + (b.total || 0), 0);
  const paid = payments
    .filter(p => String(p.agencyId) === id)
    .reduce((s, p) => s + (p.total || 0), 0);
  return billed - paid;
}

export function balanceDisplay(bal) {
  if (bal > 0) return { label: "Outstanding", color: "#c8181e", display: `-Rs.${bal.toLocaleString()}` };
  if (bal < 0) return { label: "Advance Credit", color: "#065f46", display: `+Rs.${Math.abs(bal).toLocaleString()}` };
  return { label: "Settled", color: "#065f46", display: "Rs.0" };
}

export function toWords(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (!n || n === 0) return "Zero Only";
  function chunk(num) {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] + " " : " ");
  }
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

// ── WhatsApp bill share ───────────────────────────────────────────────────────
export function shareWhatsApp(bill, agency, settings) {
  const billType = bill.billType || "nongst";
  const isGST = billType === "gst";

  const items = bill.items || [];
  // Derive gross/net/discount per item from line data — the stored `disc` field is
  // unreliable (0 on legacy bills), so the real discount % comes from gross vs net.
  const rows = items.map((it) => {
    const gross = Number(it.qty) * Number(it.rate);
    const netAmt = Number(it.amount != null ? it.amount : gross);
    const discAmt = Math.max(0, gross - netAmt);
    const discPct = gross > 0 ? (discAmt / gross) * 100 : 0;
    return { it, gross, netAmt, discAmt, discPct };
  });
  const sub = rows.reduce((s, r) => s + r.gross, 0);          // GROSS subtotal
  const billAmt = rows.reduce((s, r) => s + r.netAmt, 0);     // NET current bill
  const disc = sub - billAmt;                                 // total per-item discount
  const prevBal = Number(bill.prevBalance) || 0;   // signed: >0 owes, <0 advance
  const advUsed = Number(bill.advanceUsed) || 0;   // display only
  // Signed prevBalance already reduces the bill for advance credit — don't also
  // subtract advUsed (that would double-count the advance).
  const grandTotal = Math.max(0, billAmt + prevBal);
  const date = bill.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || new Date().toLocaleDateString("en-IN");
  const lines = rows.map(({ it, gross, netAmt, discAmt, discPct }, i) => {
    const discLine = discPct > 0
      ? `\n     🏷️ ${discPct.toFixed(1)}% disc  |  Discount Amt: Rs.${discAmt.toFixed(0)}  |  ${gross.toFixed(0)} - ${discAmt.toFixed(0)} = *Rs.${netAmt.toFixed(2)}*`
      : `  =  *Rs.${netAmt.toFixed(2)}*`;
    const grossLine = discPct > 0
      ? `Rs.${gross.toFixed(0)}`
      : `*Rs.${netAmt.toFixed(2)}*`;
    return `  ${i + 1}. ${it.name}\n     Qty: ${it.qty}  ×  Rs.${it.rate}  =  ${grossLine}${discLine}`;
  }).join("\n");

  let totals = `Sub Total         : Rs. ${sub.toFixed(2)}\n`;
  if (disc > 0) totals += `Discount          : Rs. ${disc.toFixed(2)}\n`;
  totals += `Current Bill      : Rs. ${billAmt.toFixed(2)}\n`;
  if (prevBal > 0) totals += `Previous Balance  : Rs. ${prevBal.toFixed(2)}\n`;
  if (advUsed > 0) totals += `Advance Deducted  : Rs. ${advUsed.toFixed(2)}\n`;

  const bz = settings?.business || {};
  const cName = bz.companyName || "VRUNDAVAN MILK PRODUCTS";
  const cAddr = bz.address || "DHORAJI ROAD, KALAVAD (SHITALA)";
  const cPhone = bz.phone || "95125 50255";

  const bk = settings?.bank || {};
  const bName = bk.bankName || "AXIS BANK";
  const bAcc = bk.accountNo || "919020042817580";
  const bIfsc = bk.ifsc || "UTIB0001316";

  // Header line differs by bill type
  const invoiceHeader = isGST ? "TAX INVOICE / DEBIT MEMO" : "INVOICE / DEBIT MEMO";

  const msg = `*${cName}*
${cAddr}
Mo: ${cPhone}
━━━━━━━━━━━━━━━━━━━━
*${invoiceHeader}*
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
${bName} | A/c: ${bAcc} | IFSC: ${bIfsc}`;

  const phone = agency?.phone?.replace(/\D/g, "");
  const url = phone
    ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}