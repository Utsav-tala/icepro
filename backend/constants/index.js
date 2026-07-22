// backend/constants/index.js
// Single source of truth for all enum values used across models, middleware, and services.
// Import: const { ROLES, BILL_TYPES, ... } = require("../constants")

const ROLES = Object.freeze({
  OWNER:   "owner",
  MANAGER: "manager",
});

const BILL_TYPES = Object.freeze({
  GST:     "gst",      // TAX INVOICE — VMP/YY-YY/XXXX series
  NON_GST: "nongst",   // INVOICE     — GB/YY-YY/XXXX series
});

const AGENCY_STATUS = Object.freeze({
  ACTIVE:   "active",
  INACTIVE: "inactive",
});

// ── Bill lifecycle ────────────────────────────────────────────────────────────
// pending   → an ORDER. Reserves stock (committed) but has NO financial effect:
//             no invoice number, no Transaction row, not counted in agency balance.
//             Freely editable, which is safe precisely because no money is booked.
// delivered → a real INVOICE. Invoice number assigned, Transaction row written,
//             physical stock (onHand) leaves. Immutable from here on.
// cancelled → reverses whatever the bill was still holding.
//
// New bills default to `pending` (bill.service.js:createBill) — billing is order-first.
// `status: "delivered"` is still accepted so a bill can be raised and shipped in one
// step, but the frontend no longer does that: it takes the order, then delivers or
// cancels it from the Billing screen.
const BILL_STATUS = Object.freeze({
  PENDING:   "pending",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
});

// ── Inventory ─────────────────────────────────────────────────────────────────
// Every stock change is an immutable StockMovement row carrying TWO signed deltas:
//   onHandDelta    → physical boxes in the freezer
//   committedDelta → boxes promised to pending (undelivered) bills
// available = onHand - committed  (DERIVED, never stored). available < 0 is the
// production signal: we have promised more than we physically have.
const STOCK_MOVEMENT_TYPES = Object.freeze({
  OPENING:    "opening",     // Initial stock count             onHand +
  PRODUCTION: "production",  // Manufactured stock              onHand +
  SALE:       "sale",        // Driven by a bill               (see BILL_STOCK_EFFECTS)
  RETURN:     "return",      // Agency returned unsold stock    onHand +
  DAMAGE:     "damage",      // Melt, freezer failure, expiry   onHand -
  ADJUSTMENT: "adjustment",  // Physical stock-count correction onHand ±
});

// The sign of a MANUAL movement is derived from its type — never taken from the
// client. This kills a whole class of bug where "damage: +50 boxes" silently ADDS
// stock. `adjustment` is the sole exception: it is a correction, so it must accept
// a signed quantity.
const MANUAL_MOVEMENT_SIGNS = Object.freeze({
  [STOCK_MOVEMENT_TYPES.OPENING]:    1,
  [STOCK_MOVEMENT_TYPES.PRODUCTION]: 1,
  [STOCK_MOVEMENT_TYPES.RETURN]:     1,
  [STOCK_MOVEMENT_TYPES.DAMAGE]:    -1,
  [STOCK_MOVEMENT_TYPES.ADJUSTMENT]: 0,   // 0 = caller supplies the sign
});

// What a bill in a given status is "holding" per unit of quantity. The stock engine
// diffs these between the previous and next bill state — see inventory.service.js.
//   pending   holds a commitment, but the boxes are still physically in the freezer
//   delivered holds nothing: the boxes are gone, the commitment is discharged
//   cancelled holds nothing
const BILL_STOCK_EFFECTS = Object.freeze({
  [BILL_STATUS.PENDING]:   { onHand:  0, committed:  1 },
  [BILL_STATUS.DELIVERED]: { onHand: -1, committed:  0 },
  [BILL_STATUS.CANCELLED]: { onHand:  0, committed:  0 },
});

const STOCK_REF_TYPES = Object.freeze({
  BILL:   "bill",     // Movement was caused by a bill state change
  MANUAL: "manual",   // Movement was entered by a user
});

// ── The one rule for "which bills are real money?" ────────────────────────────
// A pending bill is an ORDER: it reserves stock but books no money. A cancelled bill
// books none either. ONLY these two are excluded — everything that sums Bill.total
// (agency balance, dashboard, reports) must use this filter, or a pending order would
// silently inflate revenue and outstanding.
//
// Written as $nin rather than an equality match on "delivered" ON PURPOSE: bills created
// before the inventory migration have NO status field at all, and MongoDB treats a
// missing field as null — which $nin matches. So legacy bills keep counting even if
// scripts/backfillProductIds.js has not been run yet. An equality match on "delivered"
// would silently zero out every agency's outstanding balance on unmigrated data.
//
// Returns a FRESH object each call so a shared query fragment can never be mutated by
// the driver and leak across concurrent queries.
const balanceBearingBills = () => ({
  $nin: [BILL_STATUS.PENDING, BILL_STATUS.CANCELLED],
});

const TRANSACTION_TYPES = Object.freeze({
  BILL:    "bill",
  PAYMENT: "payment",
});

// Invoice number prefixes (matches current Firestore implementation exactly)
const INVOICE_PREFIXES = Object.freeze({
  GST:     "VMP",   // VMP/25-26/0001
  NON_GST: "GB",    // GB/25-26/0001
});

module.exports = {
  ROLES,
  BILL_TYPES,
  BILL_STATUS,
  AGENCY_STATUS,
  TRANSACTION_TYPES,
  INVOICE_PREFIXES,
  STOCK_MOVEMENT_TYPES,
  MANUAL_MOVEMENT_SIGNS,
  BILL_STOCK_EFFECTS,
  STOCK_REF_TYPES,
  balanceBearingBills,
};
