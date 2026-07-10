// backend/models/Settings.js
// Single-document pattern — one settings document for the entire application.
// Replaces four separate Firestore documents:
//   settings/signup, settings/business, settings/bank, settings/appConfig
//
// Usage: Always use Settings.getSettings() helper — never create multiple documents.

const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    signup: {
      secretCode: { type: String, trim: true, default: "" },
    },
    business: {
      companyName: { type: String, trim: true, default: "VRUNDAVAN MILK PRODUCTS" },
      address:     { type: String, trim: true, default: "DHORAJI ROAD, KALAVAD (SHITALA)" },
      phone:       { type: String, trim: true, default: "95125 50255" },
      gstin:       { type: String, trim: true, default: "24AARFV6273D1ZV" },
    },
    bank: {
      bankName:  { type: String, trim: true, default: "" },
      accountNo: { type: String, trim: true, default: "" },
      ifsc:      { type: String, trim: true, default: "" },
    },
    appConfig: {
      productsSeedDone:  { type: Boolean, default: false },
      cleanedDuplicates: { type: Boolean, default: false },
      seededAt:          { type: Date },
      reseededAt:        { type: Date },
      reseededBy:        { type: String, trim: true },
    },
    updatedBy: {
      type:    String,
      trim:    true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// ── Static helper: always return the single settings document ─────────────────
// Creates it with defaults on first call if it doesn't exist yet.
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});  // Creates with all defaults
  }
  return settings;
};

const Settings = mongoose.model("Settings", settingsSchema);
module.exports = Settings;
