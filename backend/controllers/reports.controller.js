// backend/controllers/reports.controller.js
// HTTP layer for reports — thin, delegates all logic to reports.service.js.

const reportsService = require("../services/reports.service");
const pdfService     = require("../services/pdf.service");
const ApiResponse = require("../utils/ApiResponse");

/**
 * @desc    Get analytics report (KPIs + filter-dependent breakdown tables)
 * @route   GET /api/reports
 * @access  Private — owner, manager
 * @query   ?startDate=YYYY-MM-DD  ?endDate=YYYY-MM-DD  ?agencyId=  ?productName=
 */
const getReport = async (req, res, next) => {
  try {
    const { startDate, endDate, agencyId, productName } = req.query;
    const result = await reportsService.getReportData({
      startDate,
      endDate,
      agencyId,
      productName,
    });
    res.status(200).json(
      new ApiResponse(200, result, "Report generated successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download the sales report as a print-ready PDF
 * @route   GET /api/reports/pdf
 * @access  Private — owner, manager
 * @query   same filters as GET /api/reports
 */
const downloadReportPdf = async (req, res, next) => {
  try {
    const { startDate, endDate, agencyId, productName } = req.query;
    const { pdfBuffer, filename } = await pdfService.generateReportPdf({
      startDate,
      endDate,
      agencyId,
      productName,
    });
    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length":      pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = { getReport, downloadReportPdf };
