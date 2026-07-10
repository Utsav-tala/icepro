// backend/validators/settings.validator.js
// Validation rules for updating application settings.

const { body, validationResult } = require("express-validator");
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

const updateSettingsValidation = [
  body("signup.secretCode")
    .optional()
    .trim(),

  body("business.companyName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("Company name must be between 2 and 100 characters"),

  body("business.address")
    .optional()
    .trim(),

  body("business.phone")
    .optional()
    .trim(),

  body("business.gstin")
    .optional()
    .trim(),

  body("bank.bankName")
    .optional()
    .trim(),

  body("bank.accountNo")
    .optional()
    .trim(),

  body("bank.ifsc")
    .optional()
    .trim(),

  validate,
];

module.exports = { updateSettingsValidation };
