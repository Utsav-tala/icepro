// backend/routes/product.routes.js
// Product routes — CRUD + one-time seed

const router = require("express").Router();
const {
  getProducts, getProductById, createProduct,
  updateProduct, deleteProduct, seedProducts,
} = require("../controllers/product.controller");
const { protect }      = require("../middleware/auth.middleware");
const { requireRole }  = require("../middleware/role.middleware");
const { productValidation, idParamValidation } = require("../validators/product.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "products router ok", route: "/api/products" });
});

// ── Seed (before /:id to avoid route conflict) ────────────────────────────────
// NOTE: there is deliberately no /reseed route. It called Product.deleteMany({}) — a HARD
// delete — and since the inventory module shipped, products are referenced by ObjectId from
// StockMovement.productId and Bill.items[].productId. Reseeding would orphan the entire
// stock ledger and every historical bill line, and applyBillStock() would start throwing
// 409s for products that no longer exist. To change the catalogue, edit products
// individually or soft-delete them (DELETE /:id sets isActive: false).
router.post("/seed",   protect, requireRole("owner"),              seedProducts);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get("/",    protect,                                        getProducts);
router.post("/",   protect, requireRole("owner", "manager"), productValidation, createProduct);
router.get("/:id", protect, idParamValidation,                     getProductById);
router.put("/:id", protect, requireRole("owner", "manager"), idParamValidation, productValidation, updateProduct);
router.delete("/:id", protect, requireRole("owner"),         idParamValidation, deleteProduct);

module.exports = router;

