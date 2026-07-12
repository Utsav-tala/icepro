// backend/models/Product.js
// Stores ice cream product catalog — replaces Firestore `products` collection.

const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, "Product name is required"],
      trim:     true,
    },
    rate: {
      type:     Number,
      required: [true, "Non-GST rate is required"],
      min:      [0, "Rate cannot be negative"],
    },
    rateGst: {
      type:     Number,
      required: [true, "GST rate is required"],
      min:      [0, "GST Rate cannot be negative"],
    },
    discount: {
      type:     Number,
      required: true,
      default:  14,     // Default 14% as per current business rule
      min:      [0,   "Discount cannot be negative"],
      max:      [100, "Discount cannot exceed 100%"],
    },
    unitsPerBox: {
      type:    Number,
      default: 0,
      min:     [0, "Units per box cannot be negative"],
    },

    // ── Inventory counters ────────────────────────────────────────────────────
    // A denormalized CACHE of the StockMovement ledger, updated in the same Mongoose
    // session as the movement row so the two can never diverge on a partial write.
    // The ledger remains the source of truth — POST /api/inventory/reconcile replays
    // it and rebuilds these two fields if drift is ever suspected.
    //
    // Deliberately NOT capped at min: 0. Both counters are allowed to go negative,
    // and a negative `available` is a feature, not an error — it is the production
    // signal ("we have promised more than we have"). See StockMovement.js.
    onHand: {
      type:    Number,
      default: 0,       // Physical boxes in the freezer
    },
    committed: {
      type:    Number,
      default: 0,       // Boxes promised to pending (undelivered) bills
    },
    lowStockThreshold: {
      type:    Number,
      default: 0,       // Flag the product when available <= this. 0 = only flag when negative.
      min:     [0, "Low stock threshold cannot be negative"],
    },

    isActive: {
      type:    Boolean,
      default: true,    // Soft delete — set false instead of deleting
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },   // `available` must survive serialization to the client
    toObject: { virtuals: true },
  }
);

// ── Virtual: available ────────────────────────────────────────────────────────
// The number that actually matters when deciding whether you can promise stock to a
// customer. Derived, never stored — one less field that can drift out of sync.
//   available < 0  → PRODUCTION REQUIRED. We owe more boxes than we physically hold.
productSchema.virtual("available").get(function () {
  return (this.onHand || 0) - (this.committed || 0);
});

// ── Indexes ───────────────────────────────────────────────────────────────────
productSchema.index({ name: 1 });       // Search and sort by name
productSchema.index({ isActive: 1 });   // Filter active products

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
