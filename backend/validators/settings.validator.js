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
  // The signup secret code is now LIVE — it is the real gate for creating accounts
  // (auth.service reads it from the DB, not from .env). So it gets a real minimum. An
  // empty one would be worse than weak: Settings.getSettings() would re-bootstrap the
  // old .env value on the next read, silently un-doing the owner's rotation.
  body("signup.secretCode")
    .optional()
    .trim()
    .isLength({ min: 8 }).withMessage("Secret code must be at least 8 characters")
    .isLength({ max: 64 }).withMessage("Secret code must be at most 64 characters"),

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
