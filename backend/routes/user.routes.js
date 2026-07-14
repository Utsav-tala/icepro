// backend/routes/user.routes.js
// Self-service profile. Everything here acts on the CALLER's own account — the id always
// comes from req.user, never from the URL, so there is no :id an attacker could swap for
// somebody else's.

const router = require("express").Router();
const { getMe, updateMe, changePassword } = require("../controllers/user.controller");
const { protect }        = require("../middleware/auth.middleware");
const { strictLimiter }  = require("../middleware/rateLimiter.middleware");
const {
  updateProfileValidation,
  changePasswordValidation,
} = require("../validators/user.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "users router ok", route: "/api/users" });
});

// ── My profile ────────────────────────────────────────────────────────────────
router.get("/me",    protect, getMe);
router.patch("/me",  protect, updateProfileValidation, updateMe);

// strictLimiter (failures only) — this endpoint takes the CURRENT password, so it is a
// place someone with a stolen access token could try to brute-force it.
router.post("/me/password", protect, strictLimiter, changePasswordValidation, changePassword);

module.exports = router;
