// backend/routes/bill.routes.js
// Bill routes — the full order → invoice lifecycle.
//
//   POST   /api/bills                  take an order (pending; no invoice number, no money)
//   PATCH  /api/bills/:id              edit that order  (pending only, revision-checked)
//   POST   /api/bills/:id/deliver      it becomes a real invoice
//   POST   /api/bills/:id/cancel       release it; frees the agency's one open-order slot
//
// An agency may hold only ONE pending order at a time — enforced by a partial unique index
// in models/Bill.js, not merely by a service check (which would be a race).

const router = require("express").Router();
const {
  createBill, updatePendingBill, deliverBill, cancelBill,
  getOpenOrder, getBills, getBillById, downloadBillPdf,
} = require("../controllers/bill.controller");
const { protect }     = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const {
  createBillValidation,
  updateBillValidation,
  cancelBillValidation,
  idParamValidation,
  agencyIdParamValidation,
} = require("../validators/bill.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "bills router ok", route: "/api/bills" });
});

// ── Reads ─────────────────────────────────────────────────────────────────────
// /open/:agencyId is declared BEFORE /:id, or Express would match "open" as an :id.
router.get("/open/:agencyId", protect, agencyIdParamValidation, getOpenOrder);
router.get("/",               protect,                          getBills);
router.get("/:id",            protect, idParamValidation,       getBillById);
router.get("/:id/pdf",        protect, idParamValidation,       downloadBillPdf);

// ── Lifecycle ─────────────────────────────────────────────────────────────────
router.post("/",  protect, requireRole("owner", "manager"), createBillValidation, createBill);

router.patch("/:id", protect, requireRole("owner", "manager"),
  idParamValidation, updateBillValidation, updatePendingBill);

router.post("/:id/deliver", protect, requireRole("owner", "manager"),
  idParamValidation, deliverBill);

router.post("/:id/cancel", protect, requireRole("owner", "manager"),
  idParamValidation, cancelBillValidation, cancelBill);

module.exports = router;
