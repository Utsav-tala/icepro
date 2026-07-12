// backend/models/StockMovement.js
// Immutable inventory ledger — the source of truth for all stock.
//
// Same shape and philosophy as Transaction.js: every stock change appends a row here
// and NOTHING is ever updated or deleted. Product.onHand / Product.committed are a
// denormalized CACHE of this ledger, kept in sync inside the same Mongoose session.
// If the two ever disagree, the ledger wins — POST /api/inventory/reconcile replays
// this collection and rebuilds both counters.
//
// ── Why TWO delta columns ─────────────────────────────────────────────────────
// A single stock number cannot answer both questions this business asks:
//   "how many boxes are physically in the freezer?"  → onHand
//   "how many can I still promise to a customer?"    → available = onHand - committed
//
// onHandDelta    → physical boxes moving in/out of the freezer
// committedDelta → boxes promised to pending (undelivered) bills
//
//   Production +10           → onHand +10, committed   0
//   Order taken (10 boxes)   → onHand   0, committed +10   (nothing has shipped yet)
//   Order edited 10 → 15     → onHand   0, committed  +5
//   Order cancelled          → onHand   0, committed -10
//   Delivered                → onHand -10, committed -10   (available unchanged — correct:
//                                                            shipping stock you had already
//                                                            promised does not change what
//                                                            you can promise next)
//   Damage / melt            → onHand  -5, committed   0
//   Return from agency       → onHand  +5, committed   0
//
// Summing onHandDelta gives onHand; summing committedDelta gives committed. The whole
// ledger is replayable from zero, which is what makes reconcile possible.

const mongoose = require("mongoose");
const {
  STOCK_MOVEMENT_TYPES,
  STOCK_REF_TYPES,
} = require("../constants");

const stockMovementSchema = new mongoose.Schema(
  {
    productId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Product",
      required: [true, "Product is required"],
    },
    productName: {
      type:     String,
      required: true,
      trim:     true,   // Denormalized so the ledger reads correctly even if a product
                        // is later renamed or deactivated (same reason Bill stores agencyName)
    },
    type: {
      type:     String,
      required: [true, "Movement type is required"],
      enum:     Object.values(STOCK_MOVEMENT_TYPES),
    },

    // ── The two signed deltas ─────────────────────────────────────────────────
    onHandDelta: {
      type:     Number,
      required: true,
      default:  0,      // + boxes into the freezer, - boxes out
    },
    committedDelta: {
      type:     Number,
      required: true,
      default:  0,      // + boxes promised to pending bills, - boxes released
    },

    // ── Balance snapshots AFTER this movement ─────────────────────────────────
    // Not strictly needed (the ledger is replayable) but makes the movement history
    // drawer readable without re-summing, and makes drift obvious during reconcile.
    onHandAfter: {
      type:     Number,
      required: true,
    },
    committedAfter: {
      type:     Number,
      required: true,
    },

    // ── Provenance ────────────────────────────────────────────────────────────
    refType: {
      type:    String,
      enum:    Object.values(STOCK_REF_TYPES),   // ["bill", "manual"]
      default: STOCK_REF_TYPES.MANUAL,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Bill",     // Set when refType === "bill"
    },
    billNo: {
      type: String,
      trim: true,       // Denormalized for display. Null for pending bills, which have
                        // no invoice number yet — see Bill.js.
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
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Primary access pattern: movement history for one product, newest first.
// The productId prefix also covers product-only queries (reconcile), so a standalone
// { productId: 1 } index would be redundant — same Equality→Range reasoning as Bill.js.
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });  // "wastage this month" style rollups
stockMovementSchema.index({ refId: 1 });                // "which movements did bill X cause?"
stockMovementSchema.index({ createdAt: -1 });           // Global ledger listing

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
module.exports = StockMovement;
