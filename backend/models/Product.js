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
    isActive: {
      type:    Boolean,
      default: true,    // Soft delete — set false instead of deleting
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
productSchema.index({ name: 1 });       // Search and sort by name
productSchema.index({ isActive: 1 });   // Filter active products

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
