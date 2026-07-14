// backend/.puppeteerrc.cjs
// Pins where Puppeteer downloads and looks for Chrome.
//
// Why this file exists:
//   By default Puppeteer caches Chrome in the user's HOME directory (~/.cache/puppeteer).
//   On Render, `npm install` runs in the build step and the app runs in a separate step —
//   and HOME is NOT carried across. So Chrome is downloaded at build time, then is simply
//   gone at runtime, and the first PDF request fails with "Could not find Chrome".
//
//   Moving the cache INSIDE the project directory means Chrome ships with the build output
//   and is still there when the server starts.
//
// The env var override exists so a host with a different layout can redirect it without a
// code change; leave it unset and the project-local default applies.

const { join } = require("path");

module.exports = {
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || join(__dirname, ".cache", "puppeteer"),
};
