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

const ORDER_STATUS = Object.freeze({
  PENDING:  "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const AGENCY_STATUS = Object.freeze({
  ACTIVE:   "active",
  INACTIVE: "inactive",
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
  ORDER_STATUS,
  AGENCY_STATUS,
  TRANSACTION_TYPES,
  INVOICE_PREFIXES,
};
