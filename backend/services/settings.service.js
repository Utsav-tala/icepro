// backend/services/settings.service.js
// Business logic for application settings.

const Settings = require("../models/Settings");

// ── Get Settings ──────────────────────────────────────────────────────────────
const getSettings = async () => {
  // Uses the static method on the schema which ensures the document exists
  const settings = await Settings.getSettings();
  return settings;
};

// ── Update Settings ───────────────────────────────────────────────────────────
const updateSettings = async (data, updatedByUser) => {
  const settings = await Settings.getSettings();

  // Update signup settings
  if (data.signup) {
    if (data.signup.secretCode !== undefined) {
      settings.signup.secretCode = data.signup.secretCode;
    }
  }

  // Update business details
  if (data.business) {
    const b = data.business;
    if (b.companyName !== undefined) settings.business.companyName = b.companyName;
    if (b.address     !== undefined) settings.business.address     = b.address;
    if (b.phone       !== undefined) settings.business.phone       = b.phone;
    if (b.gstin       !== undefined) settings.business.gstin       = b.gstin;
  }

  // Update bank details
  if (data.bank) {
    const bk = data.bank;
    if (bk.bankName  !== undefined) settings.bank.bankName  = bk.bankName;
    if (bk.accountNo !== undefined) settings.bank.accountNo = bk.accountNo;
    if (bk.ifsc      !== undefined) settings.bank.ifsc      = bk.ifsc;
  }

  // Record who updated it
  if (updatedByUser) {
    settings.updatedBy = `${updatedByUser.firstName} ${updatedByUser.lastName || ""}`.trim();
  }

  await settings.save();
  return settings;
};

module.exports = { getSettings, updateSettings };
