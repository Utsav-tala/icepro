// backend/middleware/error.middleware.js
// Global Express error handler — must be registered LAST in app.js.
// Catches all errors thrown via next(err) or throw new ApiError(...).
// Normalizes all error types into the standard API response format.

const ApiError = require("../utils/ApiError");
const logger   = require("../utils/logger");

const errorMiddleware = (err, req, res, next) => {
  // Log every error internally (never suppress errors silently)
  logger.error(`${req.method} ${req.originalUrl} — ${err.message}`);

  // ── 1. Custom ApiError (thrown deliberately by controllers/services) ─────────
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors:  err.errors,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // ── 2. Mongoose Validation Error (schema validation failed) ──────────────────
  // e.g. required field missing, enum mismatch, min/max violated
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field:   e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // ── 3. Mongoose CastError (invalid ObjectId format) ──────────────────────────
  // e.g. GET /api/agencies/not-a-valid-id
  if (err.name === "CastError" && err.kind === "ObjectId") {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format: '${err.value}' is not a valid MongoDB ObjectId`,
      errors:  [],
    });
  }

  // ── 4. MongoDB Duplicate Key Error ────────────────────────────────────────────
  // e.g. duplicate email, duplicate billNo
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const value = err.keyValue ? err.keyValue[field] : "value";
    return res.status(409).json({
      success: false,
      message: `Duplicate value: '${value}' already exists for ${field}`,
      errors:  [{ field, message: `${field} must be unique` }],
    });
  }

  // ── 5. JWT Errors (Phase 2 — handled here proactively) ───────────────────────
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token. Please log in again.",
      errors:  [],
    });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired. Please log in again.",
      errors:  [],
    });
  }

  // ── 6. Fallback: Unknown / Unhandled Error ────────────────────────────────────
  const statusCode = err.statusCode || 500;
  const message    = process.env.NODE_ENV === "production"
    ? "An internal server error occurred"  // Never expose internals in production
    : err.message || "An internal server error occurred";

  return res.status(statusCode).json({
    success: false,
    message,
    errors:  [],
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;
