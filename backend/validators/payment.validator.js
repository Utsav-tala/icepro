// backend/validators/payment.validator.js
// Validation rules for payment recording endpoint.

const { body, param, validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const extractedErrors = errors.array().map((err) => ({
    field:   err.path,
    message: err.msg,
  }));
  return next(new ApiError(400, "Validation failed", extractedErrors));
};

// ── Create payment validation ──────────────────────────────────────────────────
const createPaymentValidation = [
  body("agencyId")
    .notEmpty().withMessage("Agency ID is required")
    .isMongoId().withMessage("Invalid agency ID format"),

  body("cashAmt")
    .optional()
    .isFloat({ min: 0 }).withMessage("Cash amount must be non-negative"),

  body("bankAmt")
    .optional()
    .isFloat({ min: 0 }).withMessage("Bank amount must be non-negative"),

  // Custom: at least one of cashAmt or bankAmt must be > 0
  body("cashAmt").custom((cashAmt, { req }) => {
    const cash = Number(cashAmt || 0);
    const bank = Number(req.body.bankAmt || 0);
    if (cash <= 0 && bank <= 0) {
      throw new Error("At least one of cash amount or bank amount must be greater than 0");
    }
    return true;
  }),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Notes cannot exceed 500 characters"),

  validate,
];

// ── ObjectId param check ──────────────────────────────────────────────────────
const idParamValidation = [
  param("id").isMongoId().withMessage("Invalid payment ID format"),
  validate,
];

module.exports = { createPaymentValidation, idParamValidation };
