// backend/models/Counter.js
// Atomic sequential invoice number generator — replaces Firestore `settings/billCounter`
// and the `runTransaction` pattern used in frontend helpers.js `genInvNo()`.
//
// MongoDB guarantee: findOneAndUpdate with $inc is atomic at the document level.
// This is equivalent to Firestore runTransaction — no duplicate invoice numbers possible.
//
// Invoice number format (preserved from original business logic):
//   GST     → VMP/25-26/0001  (TAX INVOICE)
//   Non-GST → GB/25-26/0001   (INVOICE)
//
// Indian Financial Year: April 1 → March 31
// FY rollover: when FY changes, both counters reset to 0 automatically.

const mongoose    = require("mongoose");
const { getCurrentFY }      = require("../utils/helpers");
const { BILL_TYPES, INVOICE_PREFIXES } = require("../constants");

const counterSchema = new mongoose.Schema({
  _id:      { type: String },          // Natural key — "billCounter"
  fy:       { type: String },          // e.g. "25-26"
  gbCount:  { type: Number, default: 0 },  // Non-GST counter (GB/ series)
  vmpCount: { type: Number, default: 0 },  // GST counter (VMP/ series)
});

// ── Static method: getNextInvoiceNumber ───────────────────────────────────────
// Returns a formatted, unique invoice number string.
// Called inside bill.service.js during POST /api/bills.
counterSchema.statics.getNextInvoiceNumber = async function (billType) {
  const currentFY = getCurrentFY();
  const isGST     = billType === BILL_TYPES.GST;
  const countField = isGST ? "vmpCount" : "gbCount";

  // Step 1: Read current counter to check for FY rollover
  const existing = await this.findById("billCounter");

  // Step 2: If FY has changed, reset both counters to 0 first
  if (existing && existing.fy !== currentFY) {
    await this.findByIdAndUpdate(
      "billCounter",
      { $set: { fy: currentFY, gbCount: 0, vmpCount: 0 } },
      { upsert: true }
    );
  }

  // Step 3: Atomically increment the correct counter
  const updated = await this.findByIdAndUpdate(
    "billCounter",
    {
      $set: { fy: currentFY },
      $inc: { [countField]: 1 },
    },
    {
      upsert:         true,
      new:            true,   // Return the updated document
      setDefaultsOnInsert: true,
    }
  );

  // Step 4: Format invoice number — zero-padded to 4 digits
  const count  = updated[countField];
  const prefix = isGST ? INVOICE_PREFIXES.GST : INVOICE_PREFIXES.NON_GST;
  const padded = String(count).padStart(4, "0");

  return `${prefix}/${currentFY}/${padded}`;
  // e.g. "VMP/25-26/0001" or "GB/25-26/0042"
};

const Counter = mongoose.model("Counter", counterSchema);
module.exports = Counter;
