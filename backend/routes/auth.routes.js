// backend/routes/auth.routes.js
// Auth routes — all authentication endpoints.
//
// Session model: a short-lived ACCESS token (15m, Authorization header) plus a
// long-lived ROTATING REFRESH token (7d, httpOnly cookie, hashed in the DB).
// See utils/tokens.js for why it is split that way.

const router      = require("express").Router();
const controller  = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const {
  strictLimiter,      // sign-in attempts — only FAILURES count
  sensitiveLimiter,   // registration / password-setting — successes count too
  lookupLimiter,
  refreshLimiter,
} = require("../middleware/rateLimiter.middleware");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "auth router ok" });
});

// ── Public: Email/Password ────────────────────────────────────────────────────
router.post("/check-secret", sensitiveLimiter, controller.checkSecret);
router.post("/register",     sensitiveLimiter, controller.register);
router.post("/login",        strictLimiter,    controller.login);

// ── Public: Session refresh ───────────────────────────────────────────────────
// Authenticated by the httpOnly refresh cookie, not by a header. The frontend calls
// this automatically when the access token expires — without it, every user was being
// signed out mid-work every 15 minutes.
router.post("/refresh", refreshLimiter, controller.refresh);

// ── Public: Password reset ────────────────────────────────────────────────────
// sensitiveLimiter counts SUCCESSES too — an unlimited /forgot-password is an email bomb,
// and it needs no failed request at all to spam somebody's real inbox.
router.post("/forgot-password",       sensitiveLimiter, controller.forgotPassword);
router.post("/reset-password/:token", sensitiveLimiter, controller.resetPassword);

// ── Public: Google ────────────────────────────────────────────────────────────
// /google          → sign in only (404 if no account exists)
// /google-register → sign UP with Google: secret code + verified token, no password
// /google-profile  → returns name/email for signup autofill (creates nothing)
router.post("/google",          strictLimiter,    controller.googleSignIn);
router.post("/google-register", sensitiveLimiter, controller.googleRegister);
router.post("/google-profile",  strictLimiter,    controller.googleProfile);

// ── Public: Availability checks ───────────────────────────────────────────────
// Rate-limited: these answer "does this account exist?" to anyone who asks, so an
// unlimited version is an account-enumeration oracle.
router.get("/check-email",    lookupLimiter, controller.checkEmail);
router.get("/check-username", lookupLimiter, controller.checkUsername);

// ── Public: Email Verification & Password Setup ───────────────────────────────
// sensitiveLimiter — this endpoint SETS a password. It previously had no limiter at all.
router.post("/verify-and-set-password/:token", sensitiveLimiter, controller.verifyAndSetPassword);

// ── Private: Resend verification + me + logout ────────────────────────────────
router.post("/resend-verification", protect, controller.resendVerification);
router.get ("/me",     protect, controller.getMe);
router.post("/logout", protect, controller.logout);

module.exports = router;
