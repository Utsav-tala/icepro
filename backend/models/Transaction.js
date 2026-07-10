// backend/models/Transaction.js
// Replaces Firestore `agencies/{id}/transactions` sub-collection.
// In MongoDB there are no native sub-collections; this is a top-level collection
// referenced by agencyId. Every bill creation and payment recording writes here.

const mongoose = require("mongoose");
const { TRANSACTION_TYPES, BILL_TYPES } = require("../constants");

const transactionSchema = new mongoose.Schema(
  {
    agencyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Agency",
      required: [true, "Agency is required"],
    },
    type: {
      type:     String,
      required: [true, "Transaction type is required"],
      enum:     Object.values(TRANSACTION_TYPES),  // ["bill", "payment"]
    },

    // ── Bill transaction fields ────────────────────────────────────────────────
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Bill",
      // Required when type === "bill" — enforced in service layer
    },
    billNo: {
      type: String,
      trim: true,
    },
    billType: {
      type: String,
      enum: [...Object.values(BILL_TYPES), null],  // ["gst", "nongst"] or absent
    },
    advanceUsed: {
      type:    Number,
      default: 0,
    },

    // ── Payment transaction fields ─────────────────────────────────────────────
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Payment",
      // Required when type === "payment" — enforced in service layer
    },
    balance: {
      type: Number,
      // newBalance after payment — present for type === "payment"
    },

    // ── Shared fields ──────────────────────────────────────────────────────────
    amount: {
      type:     Number,
      required: [true, "Transaction amount is required"],
    },
    prevBalance: {
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
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Primary access pattern: get all transactions for an agency, sorted newest first
transactionSchema.index({ agencyId: 1, createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ billId: 1 });
transactionSchema.index({ paymentId: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
