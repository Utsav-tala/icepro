// backend/routes/payment.routes.js
// Payment routes — POST /api/payments, GET /api/payments, GET /api/payments/:id

const router = require("express").Router();
const { createPayment, getPayments, getPaymentById } = require("../controllers/payment.controller");
const { protect }     = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { createPaymentValidation, idParamValidation } = require("../validators/payment.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "payments router ok", route: "/api/payments" });
});

// ── Payment endpoints ──────────────────────────────────────────────────────────
router.get("/",    protect,                                                 getPayments);
router.post("/",   protect, requireRole("owner", "manager"), createPaymentValidation, createPayment);
router.get("/:id", protect, idParamValidation,                              getPaymentById);

module.exports = router;

