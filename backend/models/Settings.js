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
      // THE authoritative signup secret code. `SIGNUP_SECRET` in .env only BOOTSTRAPS
      // this on first run (see getSettings below) — after that the database wins, so the
      // owner can rotate the code from the Settings page and have it actually take effect.
      //
      // It used to be the other way round: this field existed and was editable, but
      // auth.service read process.env.SIGNUP_SECRET and ignored it entirely. Changing the
      // code in the UI did nothing — the old .env value kept working and the new one never
      // did. Worse than a missing feature: an owner rotating a leaked code hadn't.
      //
      // NEVER returned to a non-owner — see settings.controller.js.
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

  // One-time bootstrap: seed the signup code from .env if the database has none yet.
  // This runs only while the field is empty, so once the owner sets a code from the
  // Settings page, changing SIGNUP_SECRET in .env can never silently override it.
  if (!settings.signup?.secretCode && process.env.SIGNUP_SECRET) {
    settings.signup.secretCode = process.env.SIGNUP_SECRET;
    await settings.save();
  }

  return settings;
};

const Settings = mongoose.model("Settings", settingsSchema);
module.exports = Settings;
