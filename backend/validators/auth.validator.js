// backend/validators/auth.validator.js
// Validation rules for auth endpoints.

const { body, validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

// Generic middleware to check validation results and throw ApiError if any
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = errors.array().map(err => ({
    field: err.path,
    message: err.msg,
  }));

  // Passing it to our global error handler
  return next(new ApiError(400, "Validation failed", extractedErrors));
};

const registerValidation = [
  body("firstName")
    .trim()
    .notEmpty().withMessage("First name is required")
    .isLength({ max: 50 }).withMessage("First name cannot exceed 50 characters"),
  
  body("lastName")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("Last name cannot exceed 50 characters"),
    
  body("username")
    .trim()
    .notEmpty().withMessage("Username is required")
    .isLength({ min: 3, max: 30 }).withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers and underscores"),
    
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email address")
    .normalizeEmail(),
    
  body("mobile")
    .trim()
    .notEmpty().withMessage("Mobile number is required")
    .matches(/^\d{10}$/).withMessage("Mobile number must be exactly 10 digits"),
    
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    
  body("role")
    .optional()
    .isIn(["owner", "manager"]).withMessage("Role must be owner or manager"),
    
  validate
];

const loginValidation = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email address")
    .normalizeEmail(),
    
  body("password")
    .notEmpty().withMessage("Password is required"),
    
  validate
];

module.exports = {
  registerValidation,
  loginValidation
};
