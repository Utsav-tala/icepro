// backend/controllers/bill.controller.js
// HTTP layer for bills — thin, delegates all logic to bill.service.js.

const billService = require("../services/bill.service");
const pdfService  = require("../services/pdf.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError    = require("../utils/ApiError");

/**
 * @desc    Create a bill. Defaults to `pending` — an ORDER, not an invoice: it reserves
 *          stock but books no money and carries no invoice number until it is delivered.
 *          Rejects with 409 if the agency already has an open order.
 * @route   POST /api/bills
 * @access  Private — owner, manager
 */
const createBill = async (req, res, next) => {
  try {
    const bill = await billService.createBill(req.body, req.user);
    res.status(201).json(
      new ApiResponse(
        201,
        { bill },
        bill.status === "pending"
          ? "Order created — deliver it to generate the invoice"
          : `Bill ${bill.billNo} created successfully`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Edit a pending order. Requires the `revision` the client read (optimistic
 *          locking) — a mismatch means someone else changed it, and applying this edit
 *          would compute its stock delta from a stale baseline.
 * @route   PATCH /api/bills/:id
 * @access  Private — owner, manager
 * @body    { items[], revision, billType?, notes? }
 */
const updatePendingBill = async (req, res, next) => {
  try {
    const bill = await billService.updatePendingBill(req.params.id, req.body, req.user);
    res.status(200).json(new ApiResponse(200, { bill }, "Order updated successfully"));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deliver a pending order — it becomes a real invoice. Burns the invoice number,
 *          snapshots prevBalance, writes the Transaction row, ships the stock.
 * @route   POST /api/bills/:id/deliver
 * @access  Private — owner, manager
 */
const deliverBill = async (req, res, next) => {
  try {
    const bill = await billService.deliverBill(req.params.id, req.user);
    res.status(200).json(
      new ApiResponse(200, { bill }, `Delivered — invoice ${bill.billNo} issued`)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel a pending order. Releases its stock commitment and frees the agency's
 *          one open-order slot. Soft — the record is kept (the stock ledger refers to it).
 * @route   POST /api/bills/:id/cancel
 * @access  Private — owner, manager
 * @body    { reason? }
 */
const cancelBill = async (req, res, next) => {
  try {
    const bill = await billService.cancelBill(req.params.id, req.user, req.body?.reason);
    res.status(200).json(new ApiResponse(200, { bill }, "Order cancelled"));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    The agency's open (pending) order, or null. Lets the UI warn before the user
 *          types out a whole bill it would only have to reject.
 * @route   GET /api/bills/open/:agencyId
 * @access  Private
 */
const getOpenOrder = async (req, res, next) => {
  try {
    const bill = await billService.getOpenOrder(req.params.agencyId);
    res.status(200).json(
      new ApiResponse(200, { bill }, bill ? "Open order found" : "No open order")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all bills (paginated)
 * @route   GET /api/bills
 * @access  Private
 * @query   ?agencyId=  ?billType=gst|nongst  ?search=  ?page=1  ?limit=50
 */
const getBills = async (req, res, next) => {
  try {
    const result = await billService.getBills(req.query);
    res.status(200).json(
      new ApiResponse(200, result, "Bills fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single bill by ID
 * @route   GET /api/bills/:id
 * @access  Private
 */
const getBillById = async (req, res, next) => {
  try {
    const bill = await billService.getBillById(req.params.id);
    res.status(200).json(
      new ApiResponse(200, { bill }, "Bill fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Render a bill as a print-ready PDF (server-side Puppeteer render)
 * @route   GET /api/bills/:id/pdf
 * @access  Private — any authenticated user
 *
 * Served `inline` so the browser opens it in its built-in PDF viewer, where the
 * user can Print or Save — matching the single-button "print page" UX.
 */
const downloadBillPdf = async (req, res, next) => {
  try {
    // A pending order has no invoice number — there is no invoice to render yet. Fail with
    // a message that says what to do, rather than emitting a PDF with a blank bill number.
    const bill = await billService.getBillById(req.params.id);
    if (bill.status === "pending") {
      throw new ApiError(
        400,
        "This order has not been delivered yet, so it has no invoice number. " +
        "Deliver it first, then print the invoice."
      );
    }

    const { pdfBuffer, filename } = await pdfService.generateInvoicePdf(req.params.id);
    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length":      pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (error) {
    // Errors flow to the JSON error handler (so a 404 stays JSON, not a broken PDF)
    next(error);
  }
};

module.exports = {
  createBill,
  updatePendingBill,
  deliverBill,
  cancelBill,
  getOpenOrder,
  getBills,
  getBillById,
  downloadBillPdf,
};
