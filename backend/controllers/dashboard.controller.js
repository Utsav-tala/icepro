// backend/controllers/dashboard.controller.js
// HTTP layer for dashboard.

const dashboardService = require("../services/dashboard.service");
const ApiResponse      = require("../utils/ApiResponse");

/**
 * @desc    Get dashboard metrics
 * @route   GET /api/dashboard
 * @access  Private
 */
const getDashboardMetrics = async (req, res, next) => {
  try {
    const metrics = await dashboardService.getDashboardMetrics();
    res.status(200).json(
      new ApiResponse(200, metrics, "Dashboard metrics fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardMetrics };
