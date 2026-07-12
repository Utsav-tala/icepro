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

// ── Price the line items on the backend ───────────────────────────────────────
// Never trust client-sent amounts. Shared by createBill and updatePendingBill so an
// edited order is priced by exactly the same rules as a new one.
//
// Money model (kept consistent with invoice.template.js and legacy data):
//   item.amount = qty*rate*(1 - disc/100)   ← NET, per-item discount already applied
//   subtotal    = Σ (qty*rate)              ← GROSS (list value, pre-discount)
//   discountAmt = subtotal - Σ item.amount  ← total per-item discount (derived, not
//                                             taken from the client, which would
//                                             double-count since it's already in amount)
//   total       = subtotal - discountAmt = Σ item.amount   ← NET billed amount
const priceItems = (rawItems) => {
  const items = rawItems.map((item) => {
    const qty    = Number(item.qty);
    const rate   = Number(item.rate);
    const disc   = Number(item.disc || 0);
    const amount = parseFloat((qty * rate * (1 - disc / 100)).toFixed(2));
    // productId is the hard catalog link the inventory engine needs. It is optional —
    // a line without one simply moves no stock (see inventory.service.js:buildQtyMap).
    return { productId: item.productId || undefined, name: item.name.trim(), qty, rate, disc, amount };
  });

  const grossSubtotal = parseFloat(items.reduce((s, i) => s + i.qty * i.rate, 0).toFixed(2));
  const netTotal      = parseFloat(items.reduce((s, i) => s + i.amount, 0).toFixed(2));
  const discountAmt   = parseFloat((grossSubtotal - netTotal).toFixed(2));

  if (netTotal < 0) throw new ApiError(400, "Bill total cannot be negative");

  return { items, subtotal: grossSubtotal, discountAmt, total: netTotal };
};

// ── Guard: one pending order per agency ───────────────────────────────────────
// A partial unique index in Bill.js makes a second pending order physically impossible
// (see the comment there — a service check alone would be a race). This exists purely to
// turn that into a useful message, WITH the offending order attached so the UI can offer
// to edit, deliver or cancel it instead of leaving the user to go hunting for it.
const assertNoOpenOrder = async (agencyId, agencyName) => {
  const open = await Bill.findOne({ agencyId, status: BILL_STATUS.PENDING })
    .select("_id items total status createdAt createdByName")
    .lean();

  if (!open) return;

  const days = Math.floor((Date.now() - new Date(open.createdAt)) / 86400000);
  const age  = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;

  throw new ApiError(
    409,
    `${agencyName} already has a pending order — ${open.items.length} item(s), ` +
    `Rs. ${open.total.toLocaleString("en-IN")}, created ${age}. ` +
    `Deliver it or cancel it before creating a new one.`,
    [{ field: "agencyId", message: "This agency already has an open order" }]
  );
};

// ── Create bill ───────────────────────────────────────────────────────────────
const createBill = async (data, createdByUser) => {
  // 1. Validate agency exists
  const agency = await Agency.findById(data.agencyId);
  if (!agency) throw new ApiError(404, "Agency not found");
  if (agency.status === "inactive") {
    throw new ApiError(400, "Cannot create a bill for an inactive agency");
  }

  // 2. Price the items
  const { items, subtotal, discountAmt, total } = priceItems(data.items);

  // 3. Determine the lifecycle status.
  //    Bills are now ORDER-FIRST: a new bill defaults to `pending`. It reserves stock but
  //    books no money — no invoice number, no Transaction row, not in the agency balance —
  //    and stays editable until it is delivered. `status: "delivered"` is still accepted so
  //    a bill can be raised and shipped in one step, but the frontend no longer does that.
  const status      = data.status || BILL_STATUS.PENDING;
  const isDelivered = status === BILL_STATUS.DELIVERED;

  // 3a. An agency may hold only ONE open order at a time.
  if (status === BILL_STATUS.PENDING) {
    await assertNoOpenOrder(agency._id, agency.name);
  }

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

    // Two different unique indexes can raise E11000 here, and they mean very different
    // things — so read which one actually fired rather than guessing.
    if (error.code === 11000) {
      const idx = error.message || "";
      // The agency won the race for its one pending slot (assertNoOpenOrder passed, then
      // a concurrent request inserted first). This is exactly what the index is for.
      if (idx.includes("one_pending_bill_per_agency")) {
        throw new ApiError(
          409,
          "This agency already has a pending order — it was created a moment ago in another " +
          "session. Refresh, then deliver or cancel it before creating a new one."
        );
      }
      // Otherwise it's a billNo collision — extremely rare, the Counter is atomic.
      throw new ApiError(409, "Invoice number conflict — please try again");
    }
    throw new ApiError(500, `Bill creation failed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// ── Load a pending bill for mutation ──────────────────────────────────────────
// Every lifecycle operation starts the same way: fetch it, prove it is still pending,
// and (for edits) prove the caller was looking at the current version.
const loadPendingBill = async (id, expectedRevision, session = null) => {
  const bill = await Bill.findById(id).session(session).lean();
  if (!bill) throw new ApiError(404, "Bill not found");

  if (bill.status !== BILL_STATUS.PENDING) {
    throw new ApiError(
      409,
      bill.status === BILL_STATUS.DELIVERED
        ? `Bill ${bill.billNo} has already been delivered and can no longer be changed. ` +
          `A delivered bill is a legal invoice — issue a new bill instead.`
        : "This order has been cancelled and can no longer be changed."
    );
  }

  // Optimistic locking. Without this, two people editing the same order would clobber each
  // other AND — far worse — the second edit would compute its stock delta against a STALE
  // baseline, permanently corrupting the ledger. The caller must send the revision it read.
  if (expectedRevision !== undefined && expectedRevision !== null) {
    if (Number(expectedRevision) !== bill.revision) {
      throw new ApiError(
        409,
        "This order was changed by someone else while you were editing it. " +
        "Reload it and re-apply your changes."
      );
    }
  }

  return bill;
};

// ── Edit a pending order ──────────────────────────────────────────────────────
// Safe precisely BECAUSE a pending bill books no money: there is no Transaction row and
// no prevBalance snapshot to invalidate, so changing items has no financial consequence.
// The only thing that must move is stock, and applyBillStock does that from the diff.
const updatePendingBill = async (id, data, user) => {
  const session = await mongoose.startSession();
  try {
    let updated;

    await session.withTransaction(async () => {
      const prevBill = await loadPendingBill(id, data.revision, session);

      const { items, subtotal, discountAmt, total } = priceItems(data.items);

      const nextBill = {
        ...prevBill,
        items,
        subtotal,
        discountAmt,
        total,
        grandTotal: total,                       // no balance is carried on a pending order
        billType:   data.billType || prevBill.billType,
        notes:      data.notes !== undefined ? String(data.notes).trim() : prevBill.notes,
        revision:   prevBill.revision + 1,
      };

      // The diff engine. prevBill and nextBill are both `pending`, so only `committed`
      // moves — by exactly the change in quantity, per product. Nothing physical moves,
      // because nothing has left the freezer.
      await inventoryService.applyBillStock(prevBill, nextBill, user, session);

      await Bill.updateOne(
        { _id: id, revision: prevBill.revision },   // belt AND braces: re-assert the revision
        {
          $set: {
            items:       nextBill.items,
            subtotal:    nextBill.subtotal,
            discountAmt: nextBill.discountAmt,
            total:       nextBill.total,
            grandTotal:  nextBill.grandTotal,
            billType:    nextBill.billType,
            notes:       nextBill.notes,
          },
          $inc: { revision: 1 },
        },
        { session }
      );

      updated = await Bill.findById(id).session(session);
    });

    return updated;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Order update failed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// ── Deliver a pending order — it becomes a real invoice ───────────────────────
// This is the moment everything financial happens, all at once:
//   · the invoice number is burned (NOT at creation — that is why cancelling an order
//     leaves no gap in the GST series)
//   · prevBalance is snapshotted and the Transaction row is written
//   · the boxes physically leave the freezer, and the commitment is discharged
const deliverBill = async (id, user) => {
  // Read it once outside the session to fail fast, and to get billType for the Counter.
  const preview = await loadPendingBill(id);

  // The Counter runs its own atomic findOneAndUpdate and is NOT transactional, so a
  // rollback below would waste this number. Accept that: a wasted number is far better
  // than a duplicated one, and this only happens if the transaction actually fails.
  const billNo = await Counter.getNextInvoiceNumber(preview.billType);

  const session = await mongoose.startSession();
  try {
    let delivered;

    await session.withTransaction(async () => {
      // Re-read INSIDE the transaction — it may have been delivered or cancelled between
      // the preview above and here.
      const prevBill = await loadPendingBill(id, undefined, session);

      // Now, and only now, does this order become money.
      const prevBalance = await computeAgencyBalance(prevBill.agencyId, session);
      const advanceUsed = prevBalance < 0 ? Math.abs(prevBalance) : 0;
      const grandTotal  = parseFloat(Math.max(0, prevBill.total + prevBalance).toFixed(2));

      const nextBill = {
        ...prevBill,
        status: BILL_STATUS.DELIVERED,
        billNo,
        prevBalance,
        advanceUsed,
        grandTotal,
      };

      await Bill.updateOne(
        { _id: id },
        {
          $set: {
            status:      BILL_STATUS.DELIVERED,
            billNo,
            deliveredAt: new Date(),
            prevBalance,
            advanceUsed,
            grandTotal,
          },
          $inc: { revision: 1 },
        },
        { session }
      );

      await Transaction.create(
        [{
          agencyId:      prevBill.agencyId,
          type:          "bill",
          billId:        prevBill._id,
          billNo,
          billType:      prevBill.billType,
          amount:        prevBill.total,
          prevBalance,
          advanceUsed,
          notes:         prevBill.notes,
          createdByName: prevBill.createdByName,
        }],
        { session }
      );

      // pending → delivered: committed goes DOWN and onHand goes DOWN by the same amount,
      // so `available` is unchanged. Correct — shipping boxes you had already promised does
      // not change what you can promise the next customer.
      await inventoryService.applyBillStock(prevBill, nextBill, user, session);

      delivered = await Bill.findById(id).session(session);
    });

    return delivered;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Delivery failed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// ── Cancel a pending order ────────────────────────────────────────────────────
// Soft, not a hard delete: the StockMovement ledger references this bill by refId, and
// deleting the document would orphan those rows. Cancelling releases the stock commitment,
// keeps the history ("this agency cancelled 3 orders last month"), and is reversible.
const cancelBill = async (id, user, reason = "") => {
  const session = await mongoose.startSession();
  try {
    let cancelled;

    await session.withTransaction(async () => {
      const prevBill = await loadPendingBill(id, undefined, session);
      const nextBill = { ...prevBill, status: BILL_STATUS.CANCELLED };

      await Bill.updateOne(
        { _id: id },
        {
          $set: {
            status: BILL_STATUS.CANCELLED,
            notes:  reason?.trim()
              ? `${prevBill.notes ? `${prevBill.notes} — ` : ""}Cancelled: ${reason.trim()}`
              : prevBill.notes,
          },
          $inc: { revision: 1 },
        },
        { session }
      );

      // pending → cancelled: the commitment is released, nothing physical moves. The
      // agency's one pending slot is now free.
      await inventoryService.applyBillStock(prevBill, nextBill, user, session);

      cancelled = await Bill.findById(id).session(session);
    });

    return cancelled;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Cancellation failed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// ── The agency's open order, if any ───────────────────────────────────────────
const getOpenOrder = async (agencyId) =>
  Bill.findOne({ agencyId, status: BILL_STATUS.PENDING }).lean();

// ── Get all bills ─────────────────────────────────────────────────────────────
const getBills = async (query = {}) => {
  const { agencyId, billType, status, search, page = 1, limit = 50 } = query;

  const filter = {};
  if (agencyId) filter.agencyId = agencyId;
  if (billType) filter.billType = billType;
  if (status)   filter.status   = status;
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

module.exports = {
  createBill,
  updatePendingBill,
  deliverBill,
  cancelBill,
  getOpenOrder,
  getBills,
  getBillById,
  computeAgencyBalance,
};
