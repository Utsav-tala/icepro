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

// ── Login limiter — sign-in attempts ─────────────────────────────────────────
// `skipSuccessfulRequests` is the important bit: a brute-force attack is made of
// FAILURES, so only failures should consume the budget. Counting successes too meant a
// whole office behind one NAT IP shared a budget of 10 sign-ins per 15 minutes — normal
// use would lock everyone out. Now a legitimate user can sign in all day, while 20 failed
// attempts from one IP still shuts the door.
//
// This is defence in depth: the per-ACCOUNT lockout (5 failures → 15 min, see User.js)
// is the primary protection. This one bounds attacks spread across many accounts.
const strictLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  skipSuccessfulRequests: true,
});

// ── Sensitive-action limiter ─────────────────────────────────────────────────
// Registration, password reset requests, and password-setting. Here SUCCESSES must count
// too: a working /forgot-password is an email bomb if it can be called without limit, and
// spamming a real inbox does not require a single failed request.
const sensitiveLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  skipSuccessfulRequests: false,
});

// ── Lookup limiter — availability checks ─────────────────────────────────────
// /check-email and /check-username answer "does this account exist?" to anyone who
// asks, unauthenticated. They previously had NO limiter beyond the loose global cap,
// which made enumerating every registered user trivial. They still need to be usable
// for live typing on the signup form, so the cap is generous but finite.
const lookupLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             40,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

// ── Refresh limiter ──────────────────────────────────────────────────────────
// Refreshing is legitimate, frequent and automatic (every ~15 minutes per open tab),
// so strictLimiter's cap of 10 would sign people out for using the app normally with a
// few tabs open. It still needs a ceiling — a stolen cookie should not be farmable.
const refreshLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
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

module.exports = {
  strictLimiter,
  sensitiveLimiter,
  lookupLimiter,
  refreshLimiter,
  globalLimiter,
};
