// backend/validators/bill.validator.js
// Validation rules for bill creation endpoint.

const { body, param, validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");
const { BILL_TYPES, BILL_STATUS } = require("../constants");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const extractedErrors = errors.array().map((err) => ({
    field:   err.path,
    message: err.msg,
  }));
  return next(new ApiError(400, "Validation failed", extractedErrors));
};

// ── Create bill validation ─────────────────────────────────────────────────────
const createBillValidation = [
  body("agencyId")
    .notEmpty().withMessage("Agency ID is required")
    .isMongoId().withMessage("Invalid agency ID format"),

  body("billType")
    .notEmpty().withMessage("Bill type is required")
    .isIn(Object.values(BILL_TYPES))
    .withMessage(`Bill type must be one of: ${Object.values(BILL_TYPES).join(", ")}`),

  // Only pending and delivered may be created. `cancelled` is a transition, not a
  // starting state. Omitting this defaults to `delivered` — today's behaviour.
  body("status")
    .optional()
    .isIn([BILL_STATUS.PENDING, BILL_STATUS.DELIVERED])
    .withMessage(`Status must be ${BILL_STATUS.PENDING} or ${BILL_STATUS.DELIVERED}`),

  body("items")
    .isArray({ min: 1 }).withMessage("Bill must have at least one item"),

  // Optional so legacy clients still work, but the frontend always sends it — without
  // it the line moves no stock, because inventory cannot safely match on a free-text name.
  body("items.*.productId")
    .optional()
    .isMongoId().withMessage("Invalid product ID format"),

  body("items.*.name")
    .trim()
    .notEmpty().withMessage("Each item must have a name"),

  body("items.*.qty")
    .isFloat({ min: 0.01 }).withMessage("Each item quantity must be greater than 0"),

  body("items.*.rate")
    .isFloat({ min: 0 }).withMessage("Each item rate must be a non-negative number"),

  body("items.*.disc")
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage("Item discount must be between 0 and 100"),

  body("items.*.amount")
    .isFloat({ min: 0 }).withMessage("Each item amount must be a non-negative number"),

  body("discountAmt")
    .optional()
    .isFloat({ min: 0 }).withMessage("Discount amount must be non-negative"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Notes cannot exceed 500 characters"),

  validate,
];

// ── ObjectId param check ──────────────────────────────────────────────────────
const idParamValidation = [
  param("id").isMongoId().withMessage("Invalid bill ID format"),
  validate,
];

module.exports = { createBillValidation, idParamValidation };
