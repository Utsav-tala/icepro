// backend/models/Payment.js
// Stores all payment records — replaces Firestore `payments` collection.
// Supports three payment modes: cash, bank transfer, or both.

const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    agencyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Agency",
      required: [true, "Agency is required"],
    },
    agencyName: {
      type:     String,
      required: true,
      trim:     true,   // Denormalized for display
    },
    cashAmt: {
      type:    Number,
      default: 0,
      min:     [0, "Cash amount cannot be negative"],
    },
    bankAmt: {
      type:    Number,
      default: 0,
      min:     [0, "Bank amount cannot be negative"],
    },
    total: {
      type:     Number,
      required: [true, "Total payment amount is required"],
      min:      [0.01, "Payment total must be greater than 0"],  // cashAmt + bankAmt
    },
    prevBalance: {
      type:    Number,
      default: 0,       // Outstanding at the time of recording this payment
    },
    newBalance: {
      type:    Number,
      required: true,   // prevBalance - total (can be negative = advance credit)
    },
    notes: {
      type:    String,
      trim:    true,
      default: "",
    },
    recordedBy: {
      type:    String,
      trim:    true,
      default: "",      // Denormalized user display name
    },
    recordedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",     // replaces recordedByUid from Firestore
    },
  },
  {
    timestamps: true,
  }
);

// ── Validation: at least one of cashAmt or bankAmt must be > 0 ────────────────
paymentSchema.pre("validate", function (next) {
  if (this.cashAmt <= 0 && this.bankAmt <= 0) {
    this.invalidate("cashAmt", "At least one of cash or bank amount must be greater than 0");
  }
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────────
paymentSchema.index({ agencyId: 1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;
