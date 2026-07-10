// backend/middleware/rateLimiter.middleware.js
// Separate rate limiters for different attack surfaces.
// strictLimiter: for auth endpoints (login, register, google)
// globalLimiter: applied to all routes as a safety net

const rateLimit = require("express-rate-limit");

// ── Shared error response format ──────────────────────────────────────────────
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please slow down and try again later.",
    errors:  [],
  });
};

// ── Strict limiter — auth endpoints ──────────────────────────────────────────
// 10 attempts per 15 minutes per IP on login/register/google
const strictLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  skipSuccessfulRequests: false,
});

// ── Global limiter — all API routes ──────────────────────────────────────────
// Prevents brute-force on any endpoint; generous enough for normal use
const globalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

module.exports = { strictLimiter, globalLimiter };
