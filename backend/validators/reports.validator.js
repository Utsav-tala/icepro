// backend/validators/reports.validator.js
// Validation rules for the reports endpoint (GET /api/reports).
// All params are query-string filters and all are optional.

const { query, validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

// Generic middleware to collect validation errors and pass to the error handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const extractedErrors = errors.array().map((err) => ({
    field:   err.path,
    message: err.msg,
  }));
  return next(new ApiError(400, "Validation failed", extractedErrors));
};

// ── Report filters validation ──────────────────────────────────────────────────
// checkFalsy: "" (an unselected "All" filter) is treated as absent, not invalid.
const reportsValidation = [
  query("startDate")
    .optional({ checkFalsy: true })
    .isISO8601().withMessage("startDate must be a valid date (YYYY-MM-DD)"),

  query("endDate")
    .optional({ checkFalsy: true })
    .isISO8601().withMessage("endDate must be a valid date (YYYY-MM-DD)")
    .custom((value, { req }) => {
      // Both are ISO YYYY-MM-DD strings → lexicographic compare is chronological
      if (req.query.startDate && value < req.query.startDate) {
        throw new Error("endDate must be on or after startDate");
      }
      return true;
    }),

  query("agencyId")
    .optional({ checkFalsy: true })
    .isMongoId().withMessage("Invalid agency ID format"),

  query("productName")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 200 }).withMessage("productName must not exceed 200 characters"),

  validate,
];

module.exports = { reportsValidation };
