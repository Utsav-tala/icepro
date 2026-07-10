// backend/routes/product.routes.js
// Product routes — CRUD + seed + reseed

const router = require("express").Router();
const {
  getProducts, getProductById, createProduct,
  updateProduct, deleteProduct, seedProducts, reseedProducts,
} = require("../controllers/product.controller");
const { protect }      = require("../middleware/auth.middleware");
const { requireRole }  = require("../middleware/role.middleware");
const { productValidation, idParamValidation } = require("../validators/product.validator");

// ── Health check ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "products router ok", route: "/api/products" });
});

// ── Seed & Reseed (before /:id to avoid route conflict) ───────────────────────
router.post("/seed",   protect, requireRole("owner"),              seedProducts);
router.post("/reseed", protect, requireRole("owner"),              reseedProducts);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get("/",    protect,                                        getProducts);
router.post("/",   protect, requireRole("owner", "manager"), productValidation, createProduct);
router.get("/:id", protect, idParamValidation,                     getProductById);
router.put("/:id", protect, requireRole("owner", "manager"), idParamValidation, productValidation, updateProduct);
router.delete("/:id", protect, requireRole("owner"),         idParamValidation, deleteProduct);

module.exports = router;

