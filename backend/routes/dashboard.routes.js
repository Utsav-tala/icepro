// backend/routes/dashboard.routes.js
// Dashboard routes — GET /api/dashboard

const router = require("express").Router();
const { getDashboardMetrics } = require("../controllers/dashboard.controller");
const { protect } = require("../middleware/auth.middleware");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "dashboard router ok", route: "/api/dashboard" });
});

// ── Dashboard endpoints ────────────────────────────────────────────────────────
router.get("/", protect, getDashboardMetrics);

module.exports = router;
