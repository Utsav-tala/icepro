// backend/validators/agency.validator.js
// Validation rules for agency endpoints using express-validator.

const { body, param, validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");
const { AGENCY_STATUS } = require("../constants");

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

// ── Create / Update agency ────────────────────────────────────────────────────
const agencyValidation = [
  body("name")
    .trim()
    .notEmpty().withMessage("Agency name is required")
    .isLength({ min: 2, max: 150 }).withMessage("Name must be between 2 and 150 characters"),

  body("owner")
    .trim()
    .notEmpty().withMessage("Owner name is required"),

  body("phone")
    .trim()
    .notEmpty().withMessage("Phone number is required")
    .matches(/^\d{10,15}$/).withMessage("Phone must be 10–15 digits"),

  body("city")
    .trim()
    .notEmpty().withMessage("City is required"),

  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("creditLimit")
    .optional()
    .isFloat({ min: 0 }).withMessage("Credit limit must be a non-negative number"),

  body("gst")
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage("GST number must not exceed 20 characters"),

  body("totalShops")
    .optional()
    .isInt({ min: 0 }).withMessage("Total shops must be a non-negative integer"),

  validate,
];

// ── Status toggle validation ───────────────────────────────────────────────────
const statusValidation = [
  body("status")
    .notEmpty().withMessage("Status is required")
    .isIn(Object.values(AGENCY_STATUS)).withMessage(`Status must be one of: ${Object.values(AGENCY_STATUS).join(", ")}`),
  validate,
];

// ── MongoDB ObjectId param check ──────────────────────────────────────────────
const idParamValidation = [
  param("id")
    .isMongoId().withMessage("Invalid agency ID format"),
  validate,
];

module.exports = { agencyValidation, statusValidation, idParamValidation };
