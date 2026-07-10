// backend/controllers/payment.controller.js
// HTTP layer for payments — thin, delegates all logic to payment.service.js.

const paymentService = require("../services/payment.service");
const ApiResponse    = require("../utils/ApiResponse");

/**
 * @desc    Record a new payment
 * @route   POST /api/payments
 * @access  Private — owner, manager
 */
const createPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.createPayment(req.body, req.user);
    res.status(201).json(
      new ApiResponse(201, { payment }, "Payment recorded successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all payments (paginated)
 * @route   GET /api/payments
 * @access  Private
 * @query   ?agencyId=  ?page=1  ?limit=50
 */
const getPayments = async (req, res, next) => {
  try {
    const result = await paymentService.getPayments(req.query);
    res.status(200).json(
      new ApiResponse(200, result, "Payments fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single payment by ID
 * @route   GET /api/payments/:id
 * @access  Private
 */
const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    res.status(200).json(
      new ApiResponse(200, { payment }, "Payment fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { createPayment, getPayments, getPaymentById };
