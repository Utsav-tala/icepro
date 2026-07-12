// backend/validators/inventory.validator.js
// Validation rules for inventory endpoints using express-validator.

const { body, query, validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");
const { STOCK_MOVEMENT_TYPES, MANUAL_MOVEMENT_SIGNS } = require("../constants");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const extractedErrors = errors.array().map((err) => ({
    field:   err.path,
    message: err.msg,
  }));
  return next(new ApiError(400, "Validation failed", extractedErrors));
};

// Only the types a human is allowed to enter. `sale` is absent on purpose — it is
// derived from bill state by inventory.service.js and must never be typed in by hand.
const MANUAL_TYPES = Object.keys(MANUAL_MOVEMENT_SIGNS);

// ── Record a manual stock movement ────────────────────────────────────────────
const createMovementValidation = [
  body("productId")
    .notEmpty().withMessage("Product ID is required")
    .isMongoId().withMessage("Invalid product ID format"),

  body("type")
    .notEmpty().withMessage("Movement type is required")
    .isIn(MANUAL_TYPES)
    .withMessage(`Movement type must be one of: ${MANUAL_TYPES.join(", ")}`),

  // Signed, because `adjustment` is a correction and must be able to go either way.
  // The service enforces the stricter rule for every other type: their direction comes
  // from the type, so a negative qty is rejected there rather than silently flipped.
  body("qty")
    .notEmpty().withMessage("Quantity is required")
    .isFloat().withMessage("Quantity must be a number")
    .custom((v) => Number(v) !== 0).withMessage("Quantity cannot be zero"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Notes cannot exceed 500 characters"),

  validate,
];

// ── Movement ledger query ─────────────────────────────────────────────────────
const movementQueryValidation = [
  query("productId")
    .optional()
    .isMongoId().withMessage("Invalid product ID format"),

  query("type")
    .optional()
    .isIn(Object.values(STOCK_MOVEMENT_TYPES))
    .withMessage(`Type must be one of: ${Object.values(STOCK_MOVEMENT_TYPES).join(", ")}`),

  query("startDate")
    .optional()
    .isISO8601().withMessage("startDate must be a valid date (YYYY-MM-DD)"),

  query("endDate")
    .optional()
    .isISO8601().withMessage("endDate must be a valid date (YYYY-MM-DD)"),

  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 200 }).withMessage("Limit must be between 1 and 200"),

  validate,
];

module.exports = { createMovementValidation, movementQueryValidation };
