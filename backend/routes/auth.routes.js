// backend/routes/auth.routes.js
// Auth routes — all authentication endpoints.

const router      = require("express").Router();
const controller  = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { strictLimiter } = require("../middleware/rateLimiter.middleware");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "auth router ok" });
});

// ── Public: Email/Password ────────────────────────────────────────────────────
router.post("/check-secret", strictLimiter, controller.checkSecret);
router.post("/register", strictLimiter, controller.register);
router.post("/login",    strictLimiter, controller.login);

// ── Public: Google ────────────────────────────────────────────────────────────
// /google     → Login only (Sign In screen) — returns 404 if no account
// /google-profile → Returns Google name/email for signup autofill (no account creation)
router.post("/google",         strictLimiter, controller.googleSignIn);
router.post("/google-profile", strictLimiter, controller.googleProfile);

// ── Public: Availability checks ───────────────────────────────────────────────
router.get("/check-email",    controller.checkEmail);
router.get("/check-username", controller.checkUsername);

// ── Public: Email Verification & Password Setup ───────────────────────────────
router.post("/verify-and-set-password/:token", controller.verifyAndSetPassword);

// ── Private: Resend verification + me + logout ────────────────────────────────
router.post("/resend-verification", protect, controller.resendVerification);
router.get ("/me",     protect, controller.getMe);
router.post("/logout", protect, controller.logout);

module.exports = router;
