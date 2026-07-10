// backend/models/Bill.js
// Stores all generated invoices — replaces Firestore `bills` collection.
// Bill numbers are generated atomically via Counter.js (replaces Firestore runTransaction).
// Two series:
//   GST     → TAX INVOICE   → VMP/25-26/0001
//   Non-GST → INVOICE       → GB/25-26/0001

const mongoose = require("mongoose");
const { BILL_TYPES } = require("../constants");

// ── Line-item sub-schema ──────────────────────────────────────────────────────
// Matches the `lockedItems` array structure from BillModal.js exactly.
const billItemSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true },
    qty:    { type: Number, required: true, min: 0 },
    rate:   { type: Number, required: true, min: 0 },
    disc:   { type: Number, default: 0, min: 0, max: 100 }, // discount %
    amount: { type: Number, required: true, min: 0 },       // qty * rate * (1 - disc/100)
  },
  { _id: false } // No separate _id for sub-documents
);

// ── Bill schema ───────────────────────────────────────────────────────────────
const billSchema = new mongoose.Schema(
  {
    billNo: {
      type:     String,
      required: [true, "Bill number is required"],
      unique:   true,   // Critical — prevents duplicate invoice numbers
      trim:     true,
    },
    billType: {
      type:     String,
      required: [true, "Bill type is required"],
      enum:     Object.values(BILL_TYPES),  // ["gst", "nongst"]
    },
    agencyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Agency",
      required: [true, "Agency is required"],
    },
    agencyName: {
      type:     String,
      required: true,
      trim:     true,   // Denormalized for invoice printing without extra DB lookup
    },
    items: {
      type:     [billItemSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message:  "Bill must have at least one item",
      },
    },
    subtotal: {
      type:    Number,
      required: true,
      min:     0,       // Gross total before any discount
    },
    discountAmt: {
      type:    Number,
      default: 0,
      min:     0,
    },
    total: {
      type:    Number,
      required: true,
      min:     0,       // Bill amount after discount: subtotal - discountAmt
    },
    prevBalance: {
      type:    Number,
      default: 0,       // Outstanding carried forward at the time of bill creation
    },
    advanceUsed: {
      type:    Number,
      default: 0,       // Advance credit consumed: negative balance absorbed into this bill
    },
    grandTotal: {
      type:    Number,
      required: true,
      min:     0,       // total + prevBalance - advanceUsed
    },
    notes: {
      type:    String,
      trim:    true,
      default: "",
    },
    createdByName: {
      type:    String,
      trim:    true,
      default: "",      // Denormalized for display without user lookup
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",     // replaces createdByUid from Firestore
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Note: billNo already has unique:true inline — no need for schema.index()
// Compound { agencyId, createdAt } follows the Equality→Range rule: it serves both
// agency-scoped balance lookups AND the reports aggregation's "agency X within a
// date range" match. Its agencyId prefix also covers agency-only queries, so a
// standalone { agencyId: 1 } index is redundant.
billSchema.index({ agencyId: 1, createdAt: -1 });
billSchema.index({ billType: 1 });
billSchema.index({ createdAt: -1 });         // Date-sorted listing (newest first)

const Bill = mongoose.model("Bill", billSchema);
module.exports = Bill;
