// backend/controllers/inventory.controller.js
// HTTP layer for inventory — parses req, calls service, sends ApiResponse.
// No business logic here; it all lives in inventory.service.js.

const inventoryService = require("../services/inventory.service");
const ApiResponse      = require("../utils/ApiResponse");

/**
 * @desc    Current stock for every product (onHand / committed / available)
 * @route   GET /api/inventory
 * @access  Private
 * @query   ?search=   ?includeInactive=true
 */
const getStock = async (req, res, next) => {
  try {
    const stock = await inventoryService.getStock(req.query);
    res.status(200).json(
      new ApiResponse(200, { stock, total: stock.length }, "Stock fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Products we have promised more of than we hold — the production alert.
 *          Includes the pending bills waiting on each one, oldest order first.
 * @route   GET /api/inventory/shortfalls
 * @access  Private
 */
const getShortfalls = async (req, res, next) => {
  try {
    const shortfalls = await inventoryService.getShortfalls();
    res.status(200).json(
      new ApiResponse(
        200,
        { shortfalls, total: shortfalls.length },
        shortfalls.length
          ? `${shortfalls.length} product(s) need production`
          : "No shortfalls — all orders are covered"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Stock movement ledger (paginated)
 * @route   GET /api/inventory/movements
 * @access  Private
 * @query   ?productId=  ?type=  ?startDate=  ?endDate=  ?page=  ?limit=
 */
const getMovements = async (req, res, next) => {
  try {
    const result = await inventoryService.getMovements(req.query);
    res.status(200).json(
      new ApiResponse(200, result, "Stock movements fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record a manual stock movement (production, damage, return, adjustment, opening).
 *          `sale` movements are rejected here — they are derived from bill state.
 * @route   POST /api/inventory/movements
 * @access  Private — owner, manager
 * @body    { productId, type, qty, notes? }
 */
const createMovement = async (req, res, next) => {
  try {
    const movement = await inventoryService.recordMovement(req.body, req.user);
    res.status(201).json(
      new ApiResponse(201, { movement }, "Stock movement recorded successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Inventory KPIs — totals, shortfall count, produced/wasted/sold this month
 * @route   GET /api/inventory/summary
 * @access  Private
 */
const getSummary = async (req, res, next) => {
  try {
    const summary = await inventoryService.getSummary();
    res.status(200).json(
      new ApiResponse(200, summary, "Inventory summary fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Replay the ledger and rebuild the onHand/committed caches, reporting any drift.
 *          Pass ?dryRun=true to report drift without repairing it.
 * @route   POST /api/inventory/reconcile
 * @access  Private — owner only
 */
const reconcile = async (req, res, next) => {
  try {
    const dryRun = req.query.dryRun === "true";
    const result = await inventoryService.reconcile({ dryRun });
    res.status(200).json(
      new ApiResponse(
        200,
        result,
        result.driftFound === 0
          ? "No drift — stock counters match the ledger"
          : dryRun
            ? `${result.driftFound} product(s) have drifted from the ledger (dry run — nothing repaired)`
            : `Repaired ${result.repaired} product(s) that had drifted from the ledger`
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStock,
  getShortfalls,
  getMovements,
  createMovement,
  getSummary,
  reconcile,
};
