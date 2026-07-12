// backend/routes/inventory.routes.js
// Inventory routes — stock levels, shortfall alerts, the movement ledger, reconcile.

const router = require("express").Router();
const {
  getStock, getShortfalls, getMovements,
  createMovement, getSummary, reconcile,
} = require("../controllers/inventory.controller");
const { protect }     = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const {
  createMovementValidation,
  movementQueryValidation,
} = require("../validators/inventory.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "inventory router ok", route: "/api/inventory" });
});

// ── Reads ─────────────────────────────────────────────────────────────────────
router.get("/shortfalls", protect, getShortfalls);
router.get("/summary",    protect, getSummary);
router.get("/movements",  protect, movementQueryValidation, getMovements);
router.get("/",           protect, getStock);

// ── Writes ────────────────────────────────────────────────────────────────────
// Production / damage / return / adjustment / opening. `sale` is rejected by the
// validator and again by the service — it is derived from bill state, never entered.
router.post(
  "/movements",
  protect,
  requireRole("owner", "manager"),
  createMovementValidation,
  createMovement
);

// Repairing the stock counters is a privileged operation — owner only.
router.post("/reconcile", protect, requireRole("owner"), reconcile);

module.exports = router;
