// backend/controllers/settings.controller.js
// HTTP layer for settings.

const settingsService = require("../services/settings.service");
const ApiResponse     = require("../utils/ApiResponse");

/**
 * @desc    Get application settings
 * @route   GET /api/settings
 * @access  Private
 */
const getSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings();

    // ⚠️ The signup secret code must NEVER reach a non-owner.
    // This endpoint is `protect` only — every logged-in user can call it, and Dashboard.js
    // fetches it on load for ALL users (it needs business + bank details to print invoices).
    // It used to return the whole document, so the plaintext signup code was sitting in
    // every manager's browser: read it from the network tab, invite anyone you like.
    // Business and bank details are genuinely needed by everyone; the secret code is not.
    const isOwner = req.user?.role === "owner";
    const payload = settings.toObject();
    if (!isOwner) delete payload.signup;

    res.status(200).json(
      new ApiResponse(200, { settings: payload }, "Settings fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update application settings
 * @route   PUT /api/settings
 * @access  Private — owner only
 */
const updateSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateSettings(req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, { settings }, "Settings updated successfully")
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { getSettings, updateSettings };
