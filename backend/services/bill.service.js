// backend/services/bill.service.js
// Business logic for bill creation — the most critical service in the system.
//
// Key design decisions:
// 1. Invoice number generation is ATOMIC via Counter.getNextInvoiceNumber()
//    which uses MongoDB findOneAndUpdate + $inc (replicates Firestore runTransaction).
// 2. Bill creation + Transaction write are wrapped in a Mongoose SESSION (ACID transaction)
//    so if the Transaction write fails, the Bill is also rolled back.
// 3. prevBalance is computed INSIDE the session to ensure consistency at write time.
// 4. advanceUsed: if the agency has a negative balance (advance credit), it is
//    absorbed into this bill (advanceUsed = |prevBalance|), resetting balance to 0.

const mongoose         = require("mongoose");
const Bill             = require("../models/Bill");
const Payment          = require("../models/Payment");
const Agency           = require("../models/Agency");
const Transaction      = require("../models/Transaction");
const Counter          = require("../models/Counter");
const ApiError         = require("../utils/ApiError");
const inventoryService = require("./inventory.service");
const { BILL_STATUS, balanceBearingBills } = require("../constants");

// ── Helper: compute current outstanding balance for an agency ─────────────────
// balance > 0 → agency owes money (outstanding)
// balance < 0 → agency has advance credit
//
// Pending bills are EXCLUDED — an order books no money until it is delivered. That is
// the rule that makes editing a pending bill safe: with nothing financial booked against
// it, changing its items cannot corrupt any balance or any later bill's prevBalance
// snapshot. See balanceBearingBills() in constants/index.js.
const computeAgencyBalance = async (agencyId, session = null) => {
  const [billAgg, payAgg] = await Promise.all([
    Bill.aggregate([
      { $match: { agencyId: new mongoose.Types.ObjectId(agencyId), status: balanceBearingBills() } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]).session(session),
    Payment.aggregate([
      { $match: { agencyId: new mongoose.Types.ObjectId(agencyId) } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]).session(session),
  ]);

  const totalBilled = billAgg[0]?.total || 0;
  const totalPaid   = payAgg[0]?.total  || 0;
  return totalBilled - totalPaid;
};

// ── Create bill ───────────────────────────────────────────────────────────────
const createBill = async (data, createdByUser) => {
  // 1. Validate agency exists
  const agency = await Agency.findById(data.agencyId);
  if (!agency) throw new ApiError(404, "Agency not found");
  if (agency.status === "inactive") {
    throw new ApiError(400, "Cannot create a bill for an inactive agency");
  }

  // 2. Compute item totals on the backend — never trust client-sent amounts blindly
  const items = data.items.map((item) => {
    const qty    = Number(item.qty);
    const rate   = Number(item.rate);
    const disc   = Number(item.disc || 0);
    const amount = parseFloat((qty * rate * (1 - disc / 100)).toFixed(2));
    // productId is the hard catalog link the inventory engine needs. It is optional —
    // a line without one simply moves no stock (see inventory.service.js:buildQtyMap).
    return { productId: item.productId || undefined, name: item.name.trim(), qty, rate, disc, amount };
  });

  // Money model (kept consistent with invoice.template.js and legacy data):
  //   item.amount = qty*rate*(1 - disc/100)   ← NET, per-item discount already applied
  //   subtotal    = Σ (qty*rate)              ← GROSS (list value, pre-discount)
  //   discountAmt = subtotal - Σ item.amount  ← total per-item discount (derived, not
  //                                             taken from the client, which would
  //                                             double-count since it's already in amount)
  //   total       = subtotal - discountAmt = Σ item.amount   ← NET billed amount
  const grossSubtotal = parseFloat(items.reduce((s, i) => s + i.qty * i.rate, 0).toFixed(2));
  const netTotal      = parseFloat(items.reduce((s, i) => s + i.amount, 0).toFixed(2));
  const subtotal      = grossSubtotal;
  const discountAmt   = parseFloat((grossSubtotal - netTotal).toFixed(2));
  const total         = netTotal;

  if (total < 0) throw new ApiError(400, "Bill total cannot be negative");

  // 3. Determine the lifecycle status.
  //    Defaults to `delivered`, which is today's behaviour exactly: the bill IS an
  //    invoice the moment it is written. The `pending` path below is fully wired and
  //    tested by the stock engine, but nothing sends `status: "pending"` until the
  //    pending/delivered UI is built.
  const status      = data.status || BILL_STATUS.DELIVERED;
  const isDelivered = status === BILL_STATUS.DELIVERED;

  // 4. Burn an invoice number ONLY for a delivered bill.
  //    A pending bill is an order and carries no number — so cancelling one no longer
  //    leaves a permanent gap in the GST series, which auditors object to.
  //    (Counter uses its own atomic findOneAndUpdate — safe outside the session.)
  const billNo = isDelivered
    ? await Counter.getNextInvoiceNumber(data.billType)
    : undefined;

  // 5. One session covering the Bill, its Transaction, the stock counters and the
  //    stock ledger — they all commit together or none of them do.
  const session = await mongoose.startSession();

  try {
    let bill;

    await session.withTransaction(async () => {
      // 5a. Financials. A pending bill books NO money: no balance is carried forward
      // and no Transaction row is written. That is precisely what makes it safe to edit
      // later — there is nothing financial to corrupt.
      //
      // advanceUsed: how much advance credit this bill absorbs (display only).
      // grandTotal uses the SIGNED prevBalance directly — for advance credit
      // prevBalance is already negative, so `total + prevBalance` reduces the bill.
      // (Subtracting advanceUsed on top of a negative prevBalance would double-count.)
      // If prevBalance = -500 → advance ₹500 → grandTotal = total - 500.
      // If prevBalance = +500 → owes ₹500   → grandTotal = total + 500.
      const prevBalance = isDelivered
        ? await computeAgencyBalance(data.agencyId, session)
        : 0;
      const advanceUsed = prevBalance < 0 ? Math.abs(prevBalance) : 0;
      const grandTotal  = parseFloat(Math.max(0, total + prevBalance).toFixed(2));

      // 5b. Create the bill document
      [bill] = await Bill.create(
        [{
          billNo,
          billType:     data.billType,
          status,
          deliveredAt:  isDelivered ? new Date() : undefined,
          agencyId:     agency._id,
          agencyName:   agency.name,
          items,
          subtotal,
          discountAmt,
          total,
          prevBalance,
          advanceUsed,
          grandTotal,
          notes:        data.notes?.trim() || "",
          createdByName: createdByUser
            ? `${createdByUser.firstName} ${createdByUser.lastName || ""}`.trim()
            : "",
          createdById:  createdByUser?._id,
        }],
        { session }
      );

      // 5c. Write the Transaction record — delivered bills only (see 5a).
      if (isDelivered) {
        await Transaction.create(
          [{
            agencyId:     agency._id,
            type:         "bill",
            billId:       bill._id,
            billNo:       bill.billNo,
            billType:     bill.billType,
            amount:       bill.total,
            prevBalance,
            advanceUsed,
            notes:        bill.notes,
            createdByName: bill.createdByName,
          }],
          { session }
        );
      }

      // 5d. Apply the stock consequences. null → bill, because the bill did not exist
      // before. The engine reads `status` off the bill and moves the right counters:
      // a delivered bill takes boxes OUT of the freezer, a pending one merely reserves
      // them. Stock is deliberately allowed to go negative — a negative `available` is
      // the production signal, surfaced by GET /api/inventory/shortfalls, not an error.
      await inventoryService.applyBillStock(null, bill, createdByUser, session);
    });

    return bill;
  } catch (error) {
    // If the error is a known ApiError, rethrow it; otherwise wrap it
    if (error instanceof ApiError) throw error;
    // If it's a MongoDB duplicate key (billNo conflict — extremely rare race condition)
    if (error.code === 11000) {
      throw new ApiError(409, "Invoice number conflict — please try again");
    }
    throw new ApiError(500, `Bill creation failed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// ── Get all bills ─────────────────────────────────────────────────────────────
const getBills = async (query = {}) => {
  const { agencyId, billType, search, page = 1, limit = 50 } = query;

  const filter = {};
  if (agencyId) filter.agencyId = agencyId;
  if (billType) filter.billType = billType;
  if (search)   filter.billNo   = { $regex: search, $options: "i" };

  const skip = (Number(page) - 1) * Number(limit);

  const [bills, total] = await Promise.all([
    Bill.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("agencyId", "name city phone"),
    Bill.countDocuments(filter),
  ]);

  return {
    bills,
    total,
    page:  Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  };
};

// ── Get single bill by ID ──────────────────────────────────────────────────────
const getBillById = async (id) => {
  const bill = await Bill.findById(id).populate("agencyId", "name city phone gst");
  if (!bill) throw new ApiError(404, "Bill not found");
  return bill;
};

module.exports = { createBill, getBills, getBillById, computeAgencyBalance };
