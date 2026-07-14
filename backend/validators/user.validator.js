// backend/validators/user.validator.js
// Validation for self-service profile endpoints.

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

// ── PATCH /api/users/me ───────────────────────────────────────────────────────
// Every field is optional (it is a PATCH), but any field that IS sent must be valid.
// Note what is absent: username, email, role and status. They are not merely unvalidated
// here — the service ignores them entirely, so sending them changes nothing.
const updateProfileValidation = [
  body("firstName")
    .optional()
    .trim()
    .notEmpty().withMessage("First name cannot be empty")
    .isLength({ max: 60 }).withMessage("First name is too long"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ max: 60 }).withMessage("Last name is too long"),

  body("mobile")
    .optional()
    .trim()
    .matches(/^\d{10}$/).withMessage("Mobile number must be exactly 10 digits"),

  validate,
];

// ── POST /api/users/me/password ───────────────────────────────────────────────
// currentPassword is optional HERE because a Google account adding its first password has
// none to give. The service enforces the real rule: it is required for everyone who
// already has a password.
const changePasswordValidation = [
  body("currentPassword")
    .optional()
    .isString().withMessage("Current password must be a string"),

  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[a-zA-Z]/).withMessage("Password must contain at least one letter")
    .matches(/\d/).withMessage("Password must contain at least one number"),

  validate,
];

module.exports = { updateProfileValidation, changePasswordValidation };
