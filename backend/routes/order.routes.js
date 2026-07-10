// backend/routes/order.routes.js
// Orders module — stub route. Mounted at /api/orders in app.js.
// ⚠️  Currently only exposes a health-check endpoint. No order.controller.js or order.service.js exist yet.
// Phase 4 TODO: Implement getOrders / approveOrder / rejectOrder controllers.

const router = require("express").Router();

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "orders router ok", route: "/api/orders" });
});

// TODO Phase 4: Mount order controllers here
// const { getOrders, approveOrder, rejectOrder } = require("../controllers/order.controller");
// const { protect } = require("../middleware/auth.middleware");
// router.get("/",               protect, getOrders);
// router.patch("/:id/approve",  protect, approveOrder);
// router.patch("/:id/reject",   protect, rejectOrder);

module.exports = router;
