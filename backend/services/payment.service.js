// backend/services/payment.service.js
// Business logic for payment recording.
//
// Key design decisions:
// 1. prevBalance is computed from Bills and Payments at the exact moment of recording.
// 2. newBalance = prevBalance - total (can go negative = advance credit for the agency).
// 3. Payment creation + Transaction write are wrapped in a Mongoose SESSION (ACID).
// 4. The agency's outstanding balance is never stored — always computed on-demand.

const mongoose    = require("mongoose");
const Payment     = require("../models/Payment");
const Agency      = require("../models/Agency");
const Transaction = require("../models/Transaction");
const ApiError    = require("../utils/ApiError");
const { computeAgencyBalance } = require("./bill.service");

// ── Record a payment ──────────────────────────────────────────────────────────
const createPayment = async (data, recordedByUser) => {
  // 1. Validate agency
  const agency = await Agency.findById(data.agencyId);
  if (!agency) throw new ApiError(404, "Agency not found");

  const cashAmt = parseFloat(Number(data.cashAmt || 0).toFixed(2));
  const bankAmt = parseFloat(Number(data.bankAmt || 0).toFixed(2));
  const total   = parseFloat((cashAmt + bankAmt).toFixed(2));

  if (total <= 0) throw new ApiError(400, "Total payment amount must be greater than 0");

  // 2. Open a Mongoose session for atomic Payment + Transaction write
  const session = await mongoose.startSession();

  try {
    let payment;

    await session.withTransaction(async () => {
      // 2a. Compute prevBalance INSIDE the transaction for consistency
      const prevBalance = await computeAgencyBalance(data.agencyId, session);

      // 2b. Compute new balance after this payment
      // If prevBalance = 5000 and total = 3000 → newBalance = 2000 (still owes)
      // If prevBalance = 2000 and total = 3000 → newBalance = -1000 (advance credit)
      const newBalance = parseFloat((prevBalance - total).toFixed(2));

      const recordedByName = recordedByUser
        ? `${recordedByUser.firstName} ${recordedByUser.lastName || ""}`.trim()
        : "";

      // 2c. Create payment document
      [payment] = await Payment.create(
        [{
          agencyId:    agency._id,
          agencyName:  agency.name,
          cashAmt,
          bankAmt,
          total,
          prevBalance,
          newBalance,
          notes:       data.notes?.trim() || "",
          recordedBy:  recordedByName,
          recordedById: recordedByUser?._id,
        }],
        { session }
      );

      // 2d. Write the Transaction record
      await Transaction.create(
        [{
          agencyId:     agency._id,
          type:         "payment",
          paymentId:    payment._id,
          amount:       total,
          prevBalance,
          balance:      newBalance,
          notes:        payment.notes,
          createdByName: recordedByName,
        }],
        { session }
      );
    });

    return payment;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Payment recording failed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// ── Get all payments ──────────────────────────────────────────────────────────
const getPayments = async (query = {}) => {
  const { agencyId, page = 1, limit = 50 } = query;

  const filter = {};
  if (agencyId) filter.agencyId = agencyId;

  const skip = (Number(page) - 1) * Number(limit);

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("agencyId", "name city phone"),
    Payment.countDocuments(filter),
  ]);

  return {
    payments,
    total,
    page:  Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  };
};

// ── Get single payment by ID ───────────────────────────────────────────────────
const getPaymentById = async (id) => {
  const payment = await Payment.findById(id).populate("agencyId", "name city phone");
  if (!payment) throw new ApiError(404, "Payment not found");
  return payment;
};

module.exports = { createPayment, getPayments, getPaymentById };
