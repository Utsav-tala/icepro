// backend/controllers/agency.controller.js
// HTTP layer for agencies — parses req, calls service, sends ApiResponse.

const agencyService = require("../services/agency.service");
const ApiResponse   = require("../utils/ApiResponse");

/**
 * @desc    Get all agencies
 * @route   GET /api/agencies
 * @access  Private
 * @query   ?search=  ?status=active|inactive  ?withBalance=true
 */
const getAgencies = async (req, res, next) => {
  try {
    const agencies = await agencyService.getAgencies(req.query);
    res.status(200).json(
      new ApiResponse(200, { agencies, total: agencies.length }, "Agencies fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single agency by ID (always includes outstanding balance)
 * @route   GET /api/agencies/:id
 * @access  Private
 */
const getAgencyById = async (req, res, next) => {
  try {
    const agency = await agencyService.getAgencyById(req.params.id);
    res.status(200).json(
      new ApiResponse(200, { agency }, "Agency fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new agency
 * @route   POST /api/agencies
 * @access  Private — owner, manager
 */
const createAgency = async (req, res, next) => {
  try {
    const agency = await agencyService.createAgency(req.body);
    res.status(201).json(
      new ApiResponse(201, { agency }, "Agency created successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update agency details
 * @route   PUT /api/agencies/:id
 * @access  Private — owner, manager
 */
const updateAgency = async (req, res, next) => {
  try {
    const agency = await agencyService.updateAgency(req.params.id, req.body);
    res.status(200).json(
      new ApiResponse(200, { agency }, "Agency updated successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle agency status (active / inactive)
 * @route   PATCH /api/agencies/:id/status
 * @access  Private — owner only
 * @body    { status: "active" | "inactive" }
 */
const toggleAgencyStatus = async (req, res, next) => {
  try {
    const agency = await agencyService.toggleAgencyStatus(req.params.id, req.body.status);
    res.status(200).json(
      new ApiResponse(200, { agency }, `Agency marked as ${agency.status}`)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get transaction history for a specific agency
 * @route   GET /api/agencies/:id/transactions
 * @access  Private
 * @query   ?type=bill|payment  ?page=1  ?limit=50
 */
const getAgencyTransactions = async (req, res, next) => {
  try {
    const result = await agencyService.getAgencyTransactions(req.params.id, req.query);
    res.status(200).json(
      new ApiResponse(200, result, "Transactions fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  toggleAgencyStatus,
  getAgencyTransactions,
};
