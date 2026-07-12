// backend/templates/assets.js
// Loads static template assets (the company logo) once at startup and caches
// them as base64 data URIs. Puppeteer renders HTML with no network access to our
// server, so every image MUST be embedded inline rather than referenced by URL.

const fs   = require("fs");
const path = require("path");

// Read logo.png (copied from frontend/public/logo.png) and cache the data URI.
// Cached at module load — the file is read from disk exactly once per process.
let logoDataUri = "";
try {
  const logoPath = path.resolve(__dirname, "../assets/logo.png");
  const buffer   = fs.readFileSync(logoPath);
  logoDataUri    = `data:image/png;base64,${buffer.toString("base64")}`;
} catch (err) {
  // Non-fatal: invoices/reports still render, just without a logo image.
  // eslint-disable-next-line no-console
  console.warn(`[assets] logo.png not found — PDFs will render without a logo: ${err.message}`);
}

// Self-contained @font-face CSS (Playfair Display + Nunito, latin subset, base64).
// Puppeteer has no network, so fonts MUST be inlined — this restores the same
// serif branding used in the app's on-screen views. Regenerate via
// assets/fonts/build_fonts.js if the font set ever changes.
let fontsCss = "";
try {
  fontsCss = fs.readFileSync(path.resolve(__dirname, "../assets/fonts.css"), "utf8");
} catch (err) {
  // Non-fatal: templates fall back to Arial/serif system fonts.
  // eslint-disable-next-line no-console
  console.warn(`[assets] fonts.css not found — PDFs will use system fonts: ${err.message}`);
}

module.exports = { logoDataUri, fontsCss };
