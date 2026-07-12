// backend/models/Bill.js
// Stores all generated invoices — replaces Firestore `bills` collection.
// Bill numbers are generated atomically via Counter.js (replaces Firestore runTransaction).
// Two series:
//   GST     → TAX INVOICE   → VMP/25-26/0001
//   Non-GST → INVOICE       → GB/25-26/0001

const mongoose = require("mongoose");
const { BILL_TYPES, BILL_STATUS } = require("../constants");

// ── Line-item sub-schema ──────────────────────────────────────────────────────
// Matches the `lockedItems` array structure from BillModal.js exactly.
const billItemSchema = new mongoose.Schema(
  {
    // Hard link to the catalog. Inventory CANNOT work without this — deducting stock
    // by matching a free-text `name` against the Product collection is far too fragile.
    // Optional rather than required because legacy bills predate inventory and may
    // reference products that were since renamed or deleted; scripts/backfillProductIds.js
    // fills in what it can match and leaves the rest null. A null productId simply means
    // the line moves no stock.
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Product",
    },
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
    // NOT required, and NOT unique inline — see the partial index at the bottom.
    // A `pending` bill is an order, not an invoice: it carries no invoice number.
    // The number is burned from the Counter only at delivery, so cancelling an order
    // no longer leaves a permanent gap in the GST series (which auditors dislike).
    billNo: {
      type: String,
      trim: true,
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
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    // Defaults to `delivered`, which preserves today's behaviour EXACTLY: a new bill
    // is an invoice the moment it is created — number assigned, Transaction written,
    // physical stock out. The `pending` path is fully implemented in the stock engine
    // (inventory.service.js) but nothing takes it until its UI is built.
    //
    //   pending   → an ORDER. Reserves stock, no invoice number, no Transaction row,
    //               NOT counted in the agency balance. Freely editable — which is safe
    //               precisely because no money is booked against it yet.
    //   delivered → a real INVOICE. Immutable.
    //   cancelled → releases whatever the bill was still holding.
    status: {
      type:    String,
      enum:    Object.values(BILL_STATUS),
      default: BILL_STATUS.DELIVERED,
      index:   true,
    },
    deliveredAt: {
      type: Date,       // Set when status transitions to `delivered`
    },

    // ── Optimistic locking ────────────────────────────────────────────────────
    // The moment bills become editable, two users editing the same pending bill can
    // silently clobber each other — and far worse, the second edit would compute its
    // stock delta against a STALE baseline, corrupting the ledger permanently.
    // An edit must send the revision it read; the service rejects a mismatch with 409.
    revision: {
      type:    Number,
      default: 0,
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
// billNo is unique ONLY among bills that actually have one. A plain `unique: true`
// would reject the second pending bill, because every pending bill has billNo unset
// and MongoDB treats two missing values as a duplicate. A partial index scoped to
// string values sidesteps that while still making duplicate invoice numbers impossible.
//
// ⚠️  This REPLACES the old plain-unique `billNo_1` index. Mongoose will not drop the
// old one for you — run `node scripts/backfillProductIds.js` once, which swaps it.
billSchema.index(
  { billNo: 1 },
  {
    unique: true,
    partialFilterExpression: { billNo: { $type: "string" } },
  }
);

// Compound { agencyId, createdAt } follows the Equality→Range rule: it serves both
// agency-scoped balance lookups AND the reports aggregation's "agency X within a
// date range" match. Its agencyId prefix also covers agency-only queries, so a
// standalone { agencyId: 1 } index is redundant.
billSchema.index({ agencyId: 1, createdAt: -1 });
billSchema.index({ billType: 1 });
billSchema.index({ createdAt: -1 });         // Date-sorted listing (newest first)

const Bill = mongoose.model("Bill", billSchema);
module.exports = Bill;
