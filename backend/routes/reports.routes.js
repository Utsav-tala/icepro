// backend/routes/reports.routes.js
// Reports routes — GET /api/reports (analytics, owner/manager only)

const router = require("express").Router();
const { getReport, downloadReportPdf } = require("../controllers/reports.controller");
const { protect }     = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { reportsValidation } = require("../validators/reports.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "reports router ok", route: "/api/reports" });
});

// ── Report endpoint ───────────────────────────────────────────────────────────
router.get("/", protect, requireRole("owner", "manager"), reportsValidation, getReport);

// ── Report PDF download ─────────────────────────────────────────────────────────
router.get("/pdf", protect, requireRole("owner", "manager"), reportsValidation, downloadReportPdf);

module.exports = router;
