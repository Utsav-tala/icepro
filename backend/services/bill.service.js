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

const mongoose    = require("mongoose");
const Bill        = require("../models/Bill");
const Payment     = require("../models/Payment");
const Agency      = require("../models/Agency");
const Transaction = require("../models/Transaction");
const Counter     = require("../models/Counter");
const ApiError    = require("../utils/ApiError");

// ── Helper: compute current outstanding balance for an agency ─────────────────
// balance > 0 → agency owes money (outstanding)
// balance < 0 → agency has advance credit
const computeAgencyBalance = async (agencyId, session = null) => {
  const opts = session ? { session } : {};

  const [billAgg, payAgg] = await Promise.all([
    Bill.aggregate([
      { $match: { agencyId: new mongoose.Types.ObjectId(agencyId) } },
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
    return { name: item.name.trim(), qty, rate, disc, amount };
  });

  const subtotal    = parseFloat(items.reduce((s, i) => s + i.amount, 0).toFixed(2));
  const discountAmt = parseFloat(Number(data.discountAmt || 0).toFixed(2));
  const total       = parseFloat((subtotal - discountAmt).toFixed(2));

  if (total < 0) throw new ApiError(400, "Discount amount cannot exceed subtotal");

  // 3. Generate atomic invoice number BEFORE starting session
  //    (Counter uses its own atomic findOneAndUpdate — safe outside session)
  const billNo = await Counter.getNextInvoiceNumber(data.billType);

  // 4. Open a Mongoose session for atomic Bill + Transaction write
  const session = await mongoose.startSession();

  try {
    let bill;

    await session.withTransaction(async () => {
      // 4a. Compute prevBalance INSIDE the transaction for consistency
      const prevBalance = await computeAgencyBalance(data.agencyId, session);

      // 4b. advanceUsed: absorb negative balance (advance credit) into this bill
      // If prevBalance = -500 → agency has Rs.500 advance
      // advanceUsed = 500, grandTotal = total + 0 - 500 = total - 500
      const advanceUsed  = prevBalance < 0 ? Math.abs(prevBalance) : 0;
      const grandTotal   = parseFloat(Math.max(0, total + prevBalance - advanceUsed).toFixed(2));

      // 4c. Create the bill document
      [bill] = await Bill.create(
        [{
          billNo,
          billType:     data.billType,
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

      // 4d. Write the Transaction record (replaces Firestore sub-collection write)
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
