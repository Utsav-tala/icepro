// backend/models/Agency.js
// Stores distributor/agency profiles — replaces Firestore `agencies` collection.
//
// ⚠️ IMPORTANT: `outstanding` is intentionally NOT stored here.
// Outstanding balance is always computed: sum(bills.total) - sum(payments.total)
// for a given agencyId. Storing it would create stale-data consistency bugs.

const mongoose  = require("mongoose");
const { AGENCY_STATUS } = require("../constants");

const agencySchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, "Agency name is required"],
      trim:     true,
    },
    owner: {
      type:     String,
      required: [true, "Owner name is required"],
      trim:     true,
    },
    phone: {
      type:     String,
      required: [true, "Phone number is required"],
      trim:     true,
    },
    city: {
      type:     String,
      required: [true, "City is required"],
      trim:     true,
    },
    email: {
      type:    String,
      trim:    true,
      default: "",
      lowercase: true,
    },
    creditLimit: {
      type:    Number,
      default: 100000,
      min:     [0, "Credit limit cannot be negative"],
    },
    address: {
      type:    String,
      trim:    true,
      default: "",
    },
    gst: {
      type:    String,
      trim:    true,
      default: "",  // GSTIN — optional; only GST-registered agencies have this
    },
    totalShops: {
      type:    Number,
      default: 0,
      min:     [0, "Total shops cannot be negative"],
    },
    status: {
      type:    String,
      enum:    Object.values(AGENCY_STATUS),  // ["active", "inactive"]
      default: AGENCY_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
agencySchema.index({ name: 1 });    // Search and sort
agencySchema.index({ status: 1 }); // Active/inactive filter (very common query)
agencySchema.index({ city: 1 });   // Future: geographic filtering

const Agency = mongoose.model("Agency", agencySchema);
module.exports = Agency;
