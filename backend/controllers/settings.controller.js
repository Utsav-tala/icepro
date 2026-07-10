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
    res.status(200).json(
      new ApiResponse(200, { settings }, "Settings fetched successfully")
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
