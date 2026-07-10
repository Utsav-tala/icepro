// backend/utils/helpers.js
// Server-side utility functions migrated from the frontend src/helpers.js.
// Only the logic that belongs on the backend is here.
// printInvoice() and shareWhatsApp() intentionally stay on the frontend.

// ── Indian Financial Year ─────────────────────────────────────────────────────
// India FY: April 1 → March 31
// Example: April 2025 → March 2026 = "25-26"
// Used by bill.service.js for invoice number generation + FY rollover detection.
function getCurrentFY() {
  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth() + 1; // 1-based
  const startYear = month >= 4 ? year : year - 1;
  const endYear   = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

// ── Amount to Words ───────────────────────────────────────────────────────────
// Converts a number to Indian English words with paise.
// e.g. toWords(1501.50) → "One Thousand Five Hundred One And 50/100 Paise Only"
// Used in invoice generation (future Phase 4).
function toWords(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (!n || n === 0) return "Zero Only";

  function chunk(num) {
    if (num === 0) return "";
    if (num < 20)  return ones[num] + " ";
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] + " " : " ");
  }

  const amt      = Math.round(n * 100) / 100;
  const intPart  = Math.floor(amt);
  const decPart  = Math.round((amt - intPart) * 100);

  let w = "";
  if (intPart >= 10000000) w += chunk(Math.floor(intPart / 10000000)) + "Crore ";
  if (intPart >= 100000)   w += chunk(Math.floor((intPart % 10000000) / 100000)) + "Lakh ";
  if (intPart >= 1000)     w += chunk(Math.floor((intPart % 100000) / 1000)) + "Thousand ";
  if (intPart >= 100)      w += chunk(Math.floor((intPart % 1000) / 100)) + "Hundred ";
  w += chunk(intPart % 100);
  if (decPart > 0) w += `And ${decPart}/100 Paise`;

  return w.trim() + " Only";
}

// ── Balance Computation ───────────────────────────────────────────────────────
// Used by agency.service.js and dashboard.service.js.
// Prefer MongoDB aggregation pipelines for bulk queries; use this for single-agency calc.
// balance > 0 → agency owes money (outstanding)
// balance < 0 → agency has advance credit
function computeBalance(totalBilled, totalPaid) {
  return totalBilled - totalPaid;
}

module.exports = { getCurrentFY, toWords, computeBalance };
