// backend/validators/product.validator.js
// Validation rules for product endpoints using express-validator.

const { body, param, validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

// Generic middleware to collect validation errors and pass to error handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const extractedErrors = errors.array().map((err) => ({
    field:   err.path,
    message: err.msg,
  }));
  return next(new ApiError(400, "Validation failed", extractedErrors));
};

// ── Create / Update product ────────────────────────────────────────────────────
const productValidation = [
  body("name")
    .trim()
    .notEmpty().withMessage("Product name is required")
    .isLength({ min: 2, max: 200 }).withMessage("Name must be between 2 and 200 characters"),

  body("rate")
    .notEmpty().withMessage("Rate is required")
    .isFloat({ min: 0 }).withMessage("Rate must be a non-negative number"),

  body("discount")
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage("Discount must be between 0 and 100"),

  validate,
];

// ── MongoDB ObjectId param check ──────────────────────────────────────────────
const idParamValidation = [
  param("id")
    .isMongoId().withMessage("Invalid product ID format"),
  validate,
];

module.exports = { productValidation, idParamValidation };
