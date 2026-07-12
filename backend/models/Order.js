// backend/models/Order.js
// Stores agency orders awaiting approval — replaces Firestore `orders` collection.
// Workflow: pending → approved (auto-creates a Bill) or rejected.
// Confirmed in codebase: Dashboard.js line 323 uses `orders` collection actively.

const mongoose = require("mongoose");
const { ORDER_STATUS } = require("../constants");

// ── Line-item sub-schema (same structure as Bill.items) ───────────────────────
const orderItemSchema = new mongoose.Schema(
  {
    // Hard catalog link, same as Bill.items[].productId — kept in step so that when
    // this module is finally implemented it can drive inventory without a schema change.
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Product",
    },
    name:   { type: String, required: true },
    qty:    { type: Number, required: true, min: 0 },
    rate:   { type: Number, required: true, min: 0 },
    disc:   { type: Number, default: 0, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    agencyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Agency",
      required: [true, "Agency is required"],
    },
    agencyName: {
      type:     String,
      required: true,
      trim:     true,
    },
    items: {
      type:     [orderItemSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message:  "Order must have at least one item",
      },
    },
    total: {
      type:     Number,
      required: [true, "Order total is required"],
      min:      0,
    },
    status: {
      type:    String,
      enum:    Object.values(ORDER_STATUS),  // ["pending", "approved", "rejected"]
      default: ORDER_STATUS.PENDING,
    },
    notes: {
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
orderSchema.index({ status: 1 });        // Pending orders filter (dashboard KPI)
orderSchema.index({ agencyId: 1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
