// backend/routes/agency.routes.js
// Agency routes — CRUD + status toggle + transaction history

const router = require("express").Router();
const {
  getAgencies, getAgencyById, createAgency,
  updateAgency, toggleAgencyStatus, getAgencyTransactions,
} = require("../controllers/agency.controller");
const { protect }      = require("../middleware/auth.middleware");
const { requireRole }  = require("../middleware/role.middleware");
const {
  agencyValidation, statusValidation, idParamValidation,
} = require("../validators/agency.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "agencies router ok", route: "/api/agencies" });
});

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get("/",    protect,                                               getAgencies);
router.post("/",   protect, requireRole("owner", "manager"), agencyValidation, createAgency);
router.get("/:id", protect, idParamValidation,                            getAgencyById);
router.put("/:id", protect, requireRole("owner", "manager"), idParamValidation, agencyValidation, updateAgency);

// ── Status toggle ─────────────────────────────────────────────────────────────
router.patch("/:id/status", protect, requireRole("owner"), idParamValidation, statusValidation, toggleAgencyStatus);

// ── Transaction history ───────────────────────────────────────────────────────
router.get("/:id/transactions", protect, idParamValidation, getAgencyTransactions);

module.exports = router;

