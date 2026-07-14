// backend/services/product.service.js
// Business logic layer for products — no req/res awareness.
// Keeps controllers thin; all DB interaction lives here.

const Product  = require("../models/Product");
const Settings = require("../models/Settings");
const ApiError = require("../utils/ApiError");

// ── Get all active products (sorted alphabetically) ───────────────────────────
const getProducts = async (query = {}) => {
  const { search, includeInactive } = query;

  const filter = {};
  if (!includeInactive) filter.isActive = true; // default: only active products
  if (search) {
    filter.name = { $regex: search, $options: "i" }; // case-insensitive name search
  }

  const products = await Product.find(filter).sort({ name: 1 });
  return products;
};

// ── Get single product by ID ───────────────────────────────────────────────────
const getProductById = async (id) => {
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, "Product not found");
  return product;
};

// ── Create product ─────────────────────────────────────────────────────────────
const createProduct = async (data) => {
  // Check for duplicate name (case-insensitive)
  const existing = await Product.findOne({
    name: { $regex: `^${data.name.trim()}$`, $options: "i" },
  });
  if (existing) {
    throw new ApiError(409, "A product with this name already exists", [
      { field: "name", message: "Product name must be unique" },
    ]);
  }

  const product = await Product.create({
    name:        data.name.trim(),
    rate:        Number(data.rate),
    rateGst:     data.rateGst !== undefined ? Number(data.rateGst) : Number(data.rate),
    discount:    data.discount !== undefined ? Number(data.discount) : 14,
    unitsPerBox: data.unitsPerBox !== undefined ? Number(data.unitsPerBox) : 0,
  });

  return product;
};

// ── Update product ─────────────────────────────────────────────────────────────
const updateProduct = async (id, data) => {
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, "Product not found");

  // Check for duplicate name if name is being changed
  if (data.name && data.name.trim().toLowerCase() !== product.name.toLowerCase()) {
    const existing = await Product.findOne({
      _id:  { $ne: id },
      name: { $regex: `^${data.name.trim()}$`, $options: "i" },
    });
    if (existing) {
      throw new ApiError(409, "A product with this name already exists", [
        { field: "name", message: "Product name must be unique" },
      ]);
    }
  }

  if (data.name        !== undefined) product.name        = data.name.trim();
  if (data.rate        !== undefined) product.rate        = Number(data.rate);
  if (data.rateGst     !== undefined) product.rateGst     = Number(data.rateGst);
  if (data.discount    !== undefined) product.discount    = Number(data.discount);
  if (data.unitsPerBox !== undefined) product.unitsPerBox = Number(data.unitsPerBox);

  await product.save();
  return product;
};

// ── Soft-delete a product (set isActive = false) ──────────────────────────────
const deleteProduct = async (id) => {
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, "Product not found");

  product.isActive = false;
  await product.save();
  return product;
};

// ── Seed products from catalog (one-time) ─────────────────────────────────────
// Checks the appConfig.productsSeedDone flag — refuses if already seeded.
// There is deliberately no reseed counterpart — see routes/product.routes.js.
const seedProducts = async (catalog, seededBy = "System") => {
  const settings = await Settings.getSettings();

  if (settings.appConfig.productsSeedDone) {
    throw new ApiError(409, "Products have already been seeded. Edit products individually instead — bulk-replacing them would orphan the stock ledger.");
  }

  const ops = catalog.map((item) => ({
    insertOne: {
      document: {
        name:        item.name,
        rate:        item.rate,
        rateGst:     item.rateGst !== undefined ? item.rateGst : item.rate,
        discount:    item.discount !== undefined ? item.discount : 14,
        unitsPerBox: item.unitsPerBox !== undefined ? item.unitsPerBox : 0,
        isActive:    true,
      },
    },
  }));

  const result = await Product.bulkWrite(ops, { ordered: false });

  // Mark seed as done in settings
  settings.appConfig.productsSeedDone  = true;
  settings.appConfig.cleanedDuplicates = true;
  settings.appConfig.seededAt          = new Date();
  settings.updatedBy                   = seededBy;
  await settings.save();

  return { insertedCount: result.insertedCount };
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  seedProducts,
};
