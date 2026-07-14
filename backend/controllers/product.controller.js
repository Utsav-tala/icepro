// backend/controllers/product.controller.js
// HTTP layer for products — parses req, calls service, sends ApiResponse.
// No business logic here; all logic lives in product.service.js.

const productService = require("../services/product.service");
const ApiResponse    = require("../utils/ApiResponse");

/**
 * @desc    Get all products
 * @route   GET /api/products
 * @access  Private
 * @query   ?search=   ?includeInactive=true
 */
const getProducts = async (req, res, next) => {
  try {
    const products = await productService.getProducts(req.query);
    res.status(200).json(
      new ApiResponse(200, { products, total: products.length }, "Products fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by ID
 * @route   GET /api/products/:id
 * @access  Private
 */
const getProductById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.status(200).json(
      new ApiResponse(200, { product }, "Product fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new product
 * @route   POST /api/products
 * @access  Private — owner, manager
 */
const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json(
      new ApiResponse(201, { product }, "Product created successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Private — owner, manager
 */
const updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    res.status(200).json(
      new ApiResponse(200, { product }, "Product updated successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Soft-delete product (set isActive = false)
 * @route   DELETE /api/products/:id
 * @access  Private — owner only
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await productService.deleteProduct(req.params.id);
    res.status(200).json(
      new ApiResponse(200, { product }, "Product deactivated successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Seed products from a default catalog (one-time, guarded by flag)
 * @route   POST /api/products/seed
 * @access  Private — owner only
 * @body    { catalog: [{ name, rate, discount }] }
 */
const seedProducts = async (req, res, next) => {
  try {
    const { catalog } = req.body;
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return res.status(400).json({ success: false, message: "catalog array is required" });
    }
    const result = await productService.seedProducts(catalog, req.user?.fullName || "Owner");
    res.status(201).json(
      new ApiResponse(201, result, `${result.insertedCount} products seeded successfully`)
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  seedProducts,
};
