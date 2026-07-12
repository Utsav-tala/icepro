// backend/controllers/bill.controller.js
// HTTP layer for bills — thin, delegates all logic to bill.service.js.

const billService = require("../services/bill.service");
const pdfService  = require("../services/pdf.service");
const ApiResponse = require("../utils/ApiResponse");

/**
 * @desc    Create a new bill (invoice)
 * @route   POST /api/bills
 * @access  Private — owner, manager
 */
const createBill = async (req, res, next) => {
  try {
    const bill = await billService.createBill(req.body, req.user);
    res.status(201).json(
      new ApiResponse(201, { bill }, `Bill ${bill.billNo} created successfully`)
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

module.exports = { createBill, getBills, getBillById, downloadBillPdf };
