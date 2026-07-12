// backend/routes/bill.routes.js
// Bill routes — POST /api/bills, GET /api/bills, GET /api/bills/:id

const router = require("express").Router();
const { createBill, getBills, getBillById, downloadBillPdf } = require("../controllers/bill.controller");
const { protect }     = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { createBillValidation, idParamValidation } = require("../validators/bill.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "bills router ok", route: "/api/bills" });
});

// ── Bill endpoints ────────────────────────────────────────────────────────────
router.get("/",    protect,                                              getBills);
router.post("/",   protect, requireRole("owner", "manager"), createBillValidation, createBill);
router.get("/:id", protect, idParamValidation,                           getBillById);
router.get("/:id/pdf", protect, idParamValidation,                       downloadBillPdf);

module.exports = router;

