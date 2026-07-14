// backend/services/pdf.service.js
// Central PDF engine — owns a single, reused Puppeteer (headless Chrome) browser
// and turns HTML strings into A4 PDF Buffers.
//
// Design decisions:
//   • Browser singleton: launching Chrome costs ~1–2s. We launch once (lazily on
//     the first request) and reuse it for every subsequent PDF. Each request gets
//     its own fresh page, which is always closed in a finally block.
//   • Idle shutdown: an idle Chrome still holds ~150–250MB. On a 512MB host that is
//     memory we cannot spare, and an OOM kill takes down the WHOLE service, not just
//     the PDF request. So we close the browser after a period of inactivity and pay
//     the ~1–2s relaunch on the next PDF. Bounded memory beats a fast outlier.
//   • Self-healing: if the browser has crashed/disconnected, the next call detects
//     it and relaunches — a single bad render can't wedge the whole feature.
//   • print media: pages are rendered with emulateMediaType('print') so @page and
//     @media print CSS in the templates apply exactly as in a browser print.

const puppeteer   = require("puppeteer");
const logger      = require("../utils/logger");
const ApiError    = require("../utils/ApiError");

const Bill        = require("../models/Bill");
const Settings    = require("../models/Settings");
const reportsService = require("./reports.service");

const { buildInvoiceHTML } = require("../templates/invoice.template");
const { buildReportHTML }  = require("../templates/report.template");

// ── Browser singleton ─────────────────────────────────────────────────────────
let browserPromise = null;   // Promise<Browser> — dedupes concurrent launches
let idleTimer      = null;   // Closes the browser after IDLE_MS with no PDF work
let inFlight       = 0;      // Renders currently running — never close under one

// 0 disables idle shutdown (keep Chrome resident — only sane with plenty of RAM).
const IDLE_MS = Math.max(0, Number(process.env.PDF_BROWSER_IDLE_MINUTES ?? 5)) * 60 * 1000;

// Flags below the first four are memory trims for small containers (512MB tiers). They
// disable machinery a PDF render never uses — extensions, background tabs, audio, GPU
// rasterization. Deliberately NOT using --single-process: it saves more, but is known to
// make page.pdf() flaky, and a wrong invoice is worse than a slow one.
const LAUNCH_OPTS = {
  headless: "new",
  args: [
    "--no-sandbox",                // Required on many Linux/container hosts
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",     // Avoid /dev/shm exhaustion on small containers
    "--disable-gpu",
    "--disable-extensions",
    "--disable-software-rasterizer",
    "--disable-background-networking",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--no-first-run",
    "--no-zygote",                 // One fewer resident helper process
    "--mute-audio",
  ],
};

// Restart the idle countdown. Called after each render finishes.
function scheduleIdleShutdown() {
  if (idleTimer) clearTimeout(idleTimer);
  if (!IDLE_MS || !browserPromise) return;

  idleTimer = setTimeout(() => {
    if (inFlight > 0) return scheduleIdleShutdown();   // Busy — try again later
    logger.info(`Puppeteer idle for ${IDLE_MS / 60000}min — closing browser to free memory`);
    closeBrowser().catch(() => {});
  }, IDLE_MS);

  idleTimer.unref?.();   // Never hold the event loop open on shutdown
}

// Return a live Browser, launching (or relaunching after a crash) as needed.
async function getBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (browser.connected) return browser;   // Still healthy → reuse
    } catch {
      // Fall through to relaunch — previous launch/connection failed
    }
    browserPromise = null;
  }

  browserPromise = puppeteer.launch(LAUNCH_OPTS).then((browser) => {
    logger.info("Puppeteer browser launched (PDF engine ready)");
    // If Chrome dies unexpectedly, drop the cached promise so the next call relaunches.
    browser.on("disconnected", () => {
      logger.warn("Puppeteer browser disconnected — will relaunch on next request");
      browserPromise = null;
    });
    return browser;
  }).catch((err) => {
    browserPromise = null;   // Don't cache a failed launch
    throw err;
  });

  return browserPromise;
}

// ── Core: HTML string → PDF Buffer ──────────────────────────────────────────────
async function htmlToPdf(html) {
  if (idleTimer) clearTimeout(idleTimer);   // Work arriving — cancel any pending shutdown
  inFlight++;

  try {
    // Both of these can throw (Chrome missing, launch OOM). They sit INSIDE the try so the
    // outer finally always runs — otherwise a failed launch would leak inFlight forever and
    // the idle shutdown, which refuses to close while inFlight > 0, would never fire again.
    const browser = await getBrowser();
    const page    = await browser.newPage();
    try {
      // Templates are fully self-contained (inline CSS + base64 logo, no external
      // fetches), so "load" fires quickly — "networkidle0" would just wait out its
      // timeout with nothing to idle on.
      await page.setContent(html, { waitUntil: "load" });
      await page.emulateMediaType("print");
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,   // Keep header bars / shaded rows / KPI accents
        preferCSSPageSize: true, // Honour the template's @page { size: A4; margin }
      });
      return Buffer.from(pdf);   // page.pdf() returns a Uint8Array in newer versions
    } finally {
      await page.close().catch(() => {});   // Always release the page/tab
    }
  } finally {
    inFlight--;
    scheduleIdleShutdown();
  }
}

// ── Public: generate an invoice PDF for a bill id ───────────────────────────────
async function generateInvoicePdf(billId) {
  const bill = await Bill.findById(billId).populate("agencyId", "name city phone gst");
  if (!bill) throw new ApiError(404, "Bill not found");

  const settings = await Settings.getSettings();
  // agencyId is populated → the agency document (or null for a deleted agency)
  const agency = bill.agencyId && bill.agencyId.name ? bill.agencyId : null;

  const html      = buildInvoiceHTML(bill.toObject(), agency ? agency.toObject() : {}, settings.toObject());
  const pdfBuffer = await htmlToPdf(html);
  // Filename: sanitize the bill number (VMP/25-26/0001 → VMP-25-26-0001.pdf)
  const filename  = `${String(bill.billNo).replace(/[^a-zA-Z0-9-]+/g, "-")}.pdf`;
  return { pdfBuffer, filename };
}

// ── Public: generate a sales report PDF ─────────────────────────────────────────
async function generateReportPdf(query = {}) {
  const report   = await reportsService.getReportData(query);
  const settings = await Settings.getSettings();

  const labels = {
    productLabel: query.productName ? String(query.productName).trim() : "All Products",
    agencyLabel:  query.agencyId ? "Filtered Agency" : "All Agencies",
  };

  const html      = buildReportHTML(report, settings.toObject(), labels);
  const pdfBuffer = await htmlToPdf(html);
  const filename  = `ICEPRO-Report-${report.meta.startDate}_to_${report.meta.endDate}.pdf`;
  return { pdfBuffer, filename };
}

// ── Shutdown — called on SIGTERM/SIGINT from app.js, and by the idle timer ──────
async function closeBrowser() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (!browserPromise) return;

  const closing  = browserPromise;
  browserPromise = null;   // Clear FIRST: a concurrent getBrowser() must launch a fresh
                           // browser rather than hand out the one we are tearing down.
  try {
    const browser = await closing;
    await browser.close();
    logger.info("Puppeteer browser closed");
  } catch (err) {
    logger.warn(`Error closing Puppeteer browser: ${err.message}`);
  }
}

module.exports = { generateInvoicePdf, generateReportPdf, closeBrowser };
