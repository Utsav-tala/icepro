// backend/services/inventory.service.js
// Inventory business logic. The StockMovement ledger is the source of truth; the
// onHand/committed counters on Product are a cache kept in step inside the same
// Mongoose session, exactly as bill.service.js does for Bill + Transaction.
//
// ── The one idea worth understanding ──────────────────────────────────────────
// applyBillStock(prevBill, nextBill) is the ONLY code that knows how a bill affects
// stock. It is a pure diff: it does not care WHICH operation you are performing, only
// what the bill looked like before and after. Every bill operation is the same call:
//
//   Create    → applyBillStock(null,        bill)
//   Edit      → applyBillStock(oldBill,     newBill)
//   Deliver   → applyBillStock(pendingBill, deliveredBill)
//   Cancel    → applyBillStock(bill,        cancelledBill)
//
// That is why the future pending/delivered/editable-bill feature is a UI job and not
// an inventory job: the engine below already handles all four transitions today.

const mongoose      = require("mongoose");
const Product       = require("../models/Product");
const Bill          = require("../models/Bill");
const StockMovement = require("../models/StockMovement");
const ApiError      = require("../utils/ApiError");
const {
  BILL_STATUS,
  BILL_STOCK_EFFECTS,
  STOCK_MOVEMENT_TYPES,
  MANUAL_MOVEMENT_SIGNS,
  STOCK_REF_TYPES,
} = require("../constants");

// A bill that does not exist holds nothing. This is what makes create (null → bill)
// and delete (bill → null) fall out of the same arithmetic as every other transition.
const NO_EFFECT = Object.freeze({ onHand: 0, committed: 0 });

const effectOf = (bill) =>
  bill ? (BILL_STOCK_EFFECTS[bill.status] || NO_EFFECT) : NO_EFFECT;

const userName = (user) =>
  user ? `${user.firstName} ${user.lastName || ""}`.trim() : "";

// ── Collapse a bill's line items into productId → total qty ───────────────────
// A bill can legitimately carry the SAME product on two lines (different rate or
// discount), so quantities must be summed rather than overwritten.
// Lines with no productId (legacy bills predating inventory) move no stock — see
// scripts/backfillProductIds.js.
const buildQtyMap = (bill) => {
  const map = new Map();
  if (!bill) return map;

  for (const item of bill.items || []) {
    if (!item.productId) continue;
    const key  = String(item.productId);
    const prev = map.get(key);
    map.set(key, {
      qty:  (prev?.qty || 0) + Number(item.qty || 0),
      name: item.name,
    });
  }
  return map;
};

// ── Human-readable note for a bill-driven movement ────────────────────────────
// The movement history drawer is useless if every row just says "sale".
const describeBillMovement = (prevBill, nextBill, prevQty, nextQty) => {
  const prevStatus = prevBill?.status || null;
  const nextStatus = nextBill?.status || null;
  const ref        = nextBill?.billNo || prevBill?.billNo || "";
  const suffix     = ref ? ` ${ref}` : "";

  if (!prevBill) {
    return nextStatus === BILL_STATUS.PENDING
      ? `Order taken${suffix} — ${nextQty} boxes reserved`
      : `Billed${suffix} — ${nextQty} boxes`;
  }
  if (!nextBill)                            return `Bill${suffix} deleted — ${prevQty} boxes released`;
  if (nextStatus === BILL_STATUS.CANCELLED) return `Bill${suffix} cancelled — ${prevQty} boxes released`;

  if (prevStatus === BILL_STATUS.PENDING && nextStatus === BILL_STATUS.DELIVERED) {
    return `Delivered${suffix} — ${nextQty} boxes shipped`;
  }
  if (prevStatus === nextStatus && prevQty !== nextQty) {
    return `Order revised${suffix} — ${prevQty} → ${nextQty} boxes`;
  }
  return `Bill${suffix} updated — ${nextQty} boxes`;
};

/**
 * Apply the stock consequences of a bill moving from one state to another.
 *
 * MUST be called inside an open Mongoose session — the caller owns the transaction so
 * that the bill write, the Transaction row, the counter $inc and the ledger rows all
 * commit or roll back together.
 *
 * @param {Object|null} prevBill  Bill state BEFORE the operation (null when creating)
 * @param {Object|null} nextBill  Bill state AFTER  the operation (null when deleting)
 * @param {Object}      user      Acting user, for the audit trail
 * @param {ClientSession} session Open Mongoose session — required
 * @returns {Array} the StockMovement documents written
 */
const applyBillStock = async (prevBill, nextBill, user, session) => {
  if (!session) {
    throw new ApiError(500, "applyBillStock must be called inside a Mongoose session");
  }

  const prevMap    = buildQtyMap(prevBill);
  const nextMap    = buildQtyMap(nextBill);
  const prevEffect = effectOf(prevBill);
  const nextEffect = effectOf(nextBill);

  const productIds = new Set([...prevMap.keys(), ...nextMap.keys()]);
  const rows = [];

  for (const productId of productIds) {
    const prevQty = prevMap.get(productId)?.qty || 0;
    const nextQty = nextMap.get(productId)?.qty || 0;

    // The whole engine, in two lines. `effect` is what one box HOLDS in that status:
    // pending holds a commitment, delivered holds a physical outflow, cancelled/absent
    // hold nothing. The delta is simply what changed.
    const onHandDelta    = (nextEffect.onHand    * nextQty) - (prevEffect.onHand    * prevQty);
    const committedDelta = (nextEffect.committed * nextQty) - (prevEffect.committed * prevQty);

    if (onHandDelta === 0 && committedDelta === 0) continue;   // nothing actually moved

    // Update the cache and read back the post-move balance in one atomic hop.
    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { onHand: onHandDelta, committed: committedDelta } },
      { new: true, session }
    );

    // Products are soft-deleted, so a missing one is a genuine data anomaly (e.g. a
    // destructive reseed hard-deleted the catalog out from under an existing bill).
    // Fail loudly inside the transaction rather than silently losing a stock movement.
    if (!product) {
      throw new ApiError(
        409,
        `Cannot move stock: product ${productId} no longer exists. ` +
        `Run POST /api/inventory/reconcile to check for ledger drift.`
      );
    }

    rows.push({
      productId,
      productName:    product.name,
      type:           STOCK_MOVEMENT_TYPES.SALE,
      onHandDelta,
      committedDelta,
      onHandAfter:    product.onHand,
      committedAfter: product.committed,
      refType:        STOCK_REF_TYPES.BILL,
      refId:          nextBill?._id || prevBill?._id,
      billNo:         nextBill?.billNo || prevBill?.billNo || undefined,
      notes:          describeBillMovement(prevBill, nextBill, prevQty, nextQty),
      createdByName:  userName(user),
      createdById:    user?._id,
    });
  }

  if (rows.length === 0) return [];
  return StockMovement.create(rows, { session, ordered: true });
};

// ── Record a manual movement (production, damage, return, adjustment, opening) ─
const recordMovement = async (data, user) => {
  const { productId, type, notes } = data;
  const qty = Number(data.qty);

  // `sale` is service-only — it is derived from bill state, never typed in by a human.
  // MANUAL_MOVEMENT_SIGNS deliberately has no `sale` key, so this rejects it.
  const sign = MANUAL_MOVEMENT_SIGNS[type];
  if (sign === undefined) {
    throw new ApiError(
      400,
      `"${type}" movements are generated automatically from bills and cannot be entered manually`
    );
  }

  if (!Number.isFinite(qty) || qty === 0) {
    throw new ApiError(400, "Quantity must be a non-zero number");
  }

  // The sign comes from the TYPE, not the client — so "damage: 50" can never add stock.
  // `adjustment` (sign 0) is the sole exception: a correction must be able to go either way.
  if (sign === 0) {
    if (type !== STOCK_MOVEMENT_TYPES.ADJUSTMENT) {
      throw new ApiError(400, `Unsupported movement type: ${type}`);
    }
  } else if (qty < 0) {
    throw new ApiError(
      400,
      `Quantity for a "${type}" movement must be positive — its direction is implied by the type`
    );
  }

  const onHandDelta = sign === 0 ? qty : sign * qty;

  // Manual movements only ever touch physical stock. `committed` is moved exclusively
  // by bills, and letting a human edit it directly would decouple it from reality.
  const session = await mongoose.startSession();
  try {
    let movement;

    await session.withTransaction(async () => {
      const product = await Product.findOneAndUpdate(
        { _id: productId },
        { $inc: { onHand: onHandDelta } },
        { new: true, session }
      );
      if (!product) throw new ApiError(404, "Product not found");

      [movement] = await StockMovement.create(
        [{
          productId:      product._id,
          productName:    product.name,
          type,
          onHandDelta,
          committedDelta: 0,
          onHandAfter:    product.onHand,
          committedAfter: product.committed,
          refType:        STOCK_REF_TYPES.MANUAL,
          notes:          notes?.trim() || "",
          createdByName:  userName(user),
          createdById:    user?._id,
        }],
        { session }
      );
    });

    return movement;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Stock movement failed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// ── Current stock for every product ───────────────────────────────────────────
const getStock = async (query = {}) => {
  const { search, includeInactive } = query;

  const filter = {};
  if (!includeInactive) filter.isActive = true;
  if (search) filter.name = { $regex: search, $options: "i" };

  const products = await Product.find(filter).sort({ name: 1 });

  return products.map((p) => {
    const available = p.available;   // virtual: onHand - committed
    return {
      _id:               p._id,
      name:              p.name,
      unitsPerBox:       p.unitsPerBox,
      rate:              p.rate,
      isActive:          p.isActive,
      onHand:            p.onHand,
      committed:         p.committed,
      available,
      lowStockThreshold: p.lowStockThreshold,
      // Negative available is NOT low stock — it is a shortfall, a strictly worse state
      // that gets its own panel. Keeping them separate stops the shortfall alert from
      // being diluted by routine "getting low" noise.
      isShortfall:       available < 0,
      isLowStock:        available >= 0 && available <= p.lowStockThreshold,
    };
  });
};

// ── Shortfalls — the production alert ─────────────────────────────────────────
// Products we have promised more of than we physically hold, with the pending bills
// waiting on them. This is what pins to the top of the Inventory page so the shortfall
// is noticed at production time.
const getShortfalls = async () => {
  const products = await Product.find({
    $expr: { $lt: [{ $subtract: ["$onHand", "$committed"] }, 0] },
  }).sort({ name: 1 });

  if (products.length === 0) return [];

  const ids = products.map((p) => p._id);

  // Which pending bills are waiting on these products?
  const pendingBills = await Bill.find({
    status:            BILL_STATUS.PENDING,
    "items.productId": { $in: ids },
  })
    .select("_id billNo agencyName createdAt items")
    .sort({ createdAt: 1 })   // oldest order first — that is the one to produce for
    .lean();

  return products.map((p) => {
    const key = String(p._id);

    const waiting = pendingBills
      .filter((b) => b.items.some((i) => String(i.productId) === key))
      .map((b) => ({
        billId:     b._id,
        billNo:     b.billNo || null,   // pending bills have no invoice number yet
        agencyName: b.agencyName,
        qty:        b.items
          .filter((i) => String(i.productId) === key)
          .reduce((sum, i) => sum + Number(i.qty || 0), 0),
        orderedAt:  b.createdAt,
      }));

    return {
      productId:     p._id,
      name:          p.name,
      onHand:        p.onHand,
      committed:     p.committed,
      available:     p.available,
      shortfall:     Math.abs(p.available),   // boxes that must be produced
      unitsPerBox:   p.unitsPerBox,
      pendingBills:  waiting,
      pendingCount:  waiting.length,
    };
  });
};

// ── Movement ledger ───────────────────────────────────────────────────────────
const getMovements = async (query = {}) => {
  const { productId, type, startDate, endDate, page = 1, limit = 50 } = query;

  const filter = {};
  if (productId) filter.productId = productId;
  if (type)      filter.type      = type;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate)   filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [movements, total] = await Promise.all([
    StockMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    StockMovement.countDocuments(filter),
  ]);

  return {
    movements,
    total,
    page:  Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  };
};

// ── Summary KPIs ──────────────────────────────────────────────────────────────
const getSummary = async () => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [products, monthly] = await Promise.all([
    Product.find({ isActive: true }),
    StockMovement.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: "$type", boxes: { $sum: { $abs: "$onHandDelta" } } } },
    ]),
  ]);

  const byType = Object.fromEntries(monthly.map((m) => [m._id, m.boxes]));

  const totals = products.reduce(
    (acc, p) => {
      acc.totalOnHand    += p.onHand;
      acc.totalCommitted += p.committed;
      if (p.available < 0) {
        acc.shortfallCount += 1;
        acc.shortfallBoxes += Math.abs(p.available);
      } else if (p.available <= p.lowStockThreshold) {
        acc.lowStockCount += 1;
      }
      return acc;
    },
    { totalOnHand: 0, totalCommitted: 0, shortfallCount: 0, shortfallBoxes: 0, lowStockCount: 0 }
  );

  return {
    ...totals,
    totalAvailable:   totals.totalOnHand - totals.totalCommitted,
    productCount:     products.length,
    producedThisMonth: byType[STOCK_MOVEMENT_TYPES.PRODUCTION] || 0,
    wastedThisMonth:   byType[STOCK_MOVEMENT_TYPES.DAMAGE]     || 0,
    soldThisMonth:     byType[STOCK_MOVEMENT_TYPES.SALE]       || 0,
    returnedThisMonth: byType[STOCK_MOVEMENT_TYPES.RETURN]     || 0,
  };
};

// ── Reconcile — replay the ledger, rebuild the counters ───────────────────────
// The honest answer to "what if the cache and the ledger disagree?". The ledger is
// append-only and therefore always correct; onHand/committed are a derived convenience.
// This recomputes them from scratch and reports any drift it had to repair.
const reconcile = async ({ dryRun = false } = {}) => {
  const totals = await StockMovement.aggregate([
    {
      $group: {
        _id:       "$productId",
        onHand:    { $sum: "$onHandDelta" },
        committed: { $sum: "$committedDelta" },
      },
    },
  ]);

  const ledger   = new Map(totals.map((t) => [String(t._id), t]));
  const products = await Product.find({});
  const drift    = [];
  const ops      = [];

  for (const p of products) {
    const truth = ledger.get(String(p._id)) || { onHand: 0, committed: 0 };

    if (p.onHand === truth.onHand && p.committed === truth.committed) continue;

    drift.push({
      productId: p._id,
      name:      p.name,
      cached:    { onHand: p.onHand,      committed: p.committed },
      ledger:    { onHand: truth.onHand,  committed: truth.committed },
    });

    ops.push({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { onHand: truth.onHand, committed: truth.committed } },
      },
    });
  }

  if (!dryRun && ops.length > 0) {
    await Product.bulkWrite(ops, { ordered: false });
  }

  return {
    dryRun,
    productsChecked: products.length,
    driftFound:      drift.length,
    repaired:        dryRun ? 0 : ops.length,
    drift,
  };
};

module.exports = {
  applyBillStock,
  recordMovement,
  getStock,
  getShortfalls,
  getMovements,
  getSummary,
  reconcile,
};
