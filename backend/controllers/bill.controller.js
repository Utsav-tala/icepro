// backend/controllers/bill.controller.js
// HTTP layer for bills — thin, delegates all logic to bill.service.js.

const billService = require("../services/bill.service");
const ApiResponse = require("../utils/ApiResponse");

/**
 * @desc    Create a new bill (invoice)
 * @route   POST /api/bills
 * @access  Private — owner, manager
 */
const createBill = async (req, res, next) => {
  try {
    const bill = await billService.createBill(req.body, req.user);
    res.status(201).json(
      new ApiResponse(201, { bill }, `Bill ${bill.billNo} created successfully`)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all bills (paginated)
 * @route   GET /api/bills
 * @access  Private
 * @query   ?agencyId=  ?billType=gst|nongst  ?search=  ?page=1  ?limit=50
 */
const getBills = async (req, res, next) => {
  try {
    const result = await billService.getBills(req.query);
    res.status(200).json(
      new ApiResponse(200, result, "Bills fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single bill by ID
 * @route   GET /api/bills/:id
 * @access  Private
 */
const getBillById = async (req, res, next) => {
  try {
    const bill = await billService.getBillById(req.params.id);
    res.status(200).json(
      new ApiResponse(200, { bill }, "Bill fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { createBill, getBills, getBillById };
