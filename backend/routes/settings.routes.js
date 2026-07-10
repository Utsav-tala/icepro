// backend/routes/settings.routes.js
// Settings routes — GET /api/settings, PUT /api/settings

const router = require("express").Router();
const { getSettings, updateSettings } = require("../controllers/settings.controller");
const { protect }     = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { updateSettingsValidation } = require("../validators/settings.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "settings router ok", route: "/api/settings" });
});

// ── Settings endpoints ────────────────────────────────────────────────────────
router.get("/",  protect, getSettings);
router.put("/",  protect, requireRole("owner"), updateSettingsValidation, updateSettings);

module.exports = router;
