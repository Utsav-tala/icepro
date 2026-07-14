// src/api.js
// Centralized Axios instance with JWT access token in header
// and silent refresh via the httpOnly refresh token cookie on 401.

import axios from "axios";

// Backend origin, e.g. "https://icepro-api.onrender.com". Empty in local dev, where the
// "proxy" field in package.json forwards /api to localhost — but that proxy is a dev-server
// feature and does NOT exist in a production build, so a deployed frontend must be told
// where the API actually lives. Trailing slashes are stripped so the value is forgiving.
const API_ORIGIN = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
const API_BASE   = `${API_ORIGIN}/api`;

const api = axios.create({
  baseURL:          API_BASE,
  withCredentials:  true,   // Required: allows the browser to send httpOnly cookies
});

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Track if a refresh is already in progress (prevents duplicate refresh calls)
let isRefreshing = false;
let pendingQueue = []; // { resolve, reject }[]

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

// ── Response interceptor: silent refresh on 401 ───────────────────────────────
api.interceptors.response.use(
  (response) => response.data,   // Unpack data directly

  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and only once per request (_retry flag)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      // Don't retry for the refresh/login endpoints themselves — would loop infinitely
      !originalRequest.url.includes("/auth/refresh") &&
      !originalRequest.url.includes("/auth/login") &&
      !originalRequest.url.includes("/auth/google")
    ) {
      if (isRefreshing) {
        // Queue this request until the ongoing refresh completes
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing           = true;

      try {
        // The refresh token is sent automatically via the httpOnly cookie.
        // Uses raw axios (not `api`) to bypass the interceptor and avoid a retry loop —
        // so it needs the base URL applied explicitly.
        const refreshRes = await axios.post(
          `${API_BASE}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = refreshRes.data?.data?.token;
        if (newToken) {
          localStorage.setItem("token", newToken);
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization      = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(originalRequest);
        }
        throw new Error("No token in refresh response");
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("token");
        // Redirect to sign-in by resetting the app state
        window.dispatchEvent(new CustomEvent("auth:logout"));
        return Promise.reject(refreshError?.response?.data || { success: false, message: "Session expired. Please log in again." });
      } finally {
        isRefreshing = false;
      }
    }

    // For all other errors, normalize to our standard error shape
    return Promise.reject(
      error.response?.data || { success: false, message: "Network error. Please check your connection." }
    );
  }
);

// ── PDF print / view ──────────────────────────────────────────────────────────
// The server renders print-ready PDFs (Puppeteer). We open them in a new browser
// tab so the native PDF viewer's Print AND Save buttons are both available — one
// "Print" button in the UI, user decides to print or download from there.
//
// Auth note: the access token lives in the Authorization header (not a cookie), so
// a plain window.open(url) would hit the API unauthenticated (401). Instead we
// fetch the PDF WITH the interceptor's auth header, then point the tab at a blob
// URL. The tab is opened synchronously (before any await) so pop-up blockers,
// which only allow window.open inside a user gesture, let it through.

const openPdfInTab = async (blobPromise) => {
  // Open the tab immediately (still inside the click's synchronous context).
  const tab = window.open("", "_blank");
  if (tab) {
    tab.document.write(
      "<title>Generating PDF…</title><body style='font-family:sans-serif;padding:40px;color:#555'>⏳ Generating PDF…</body>"
    );
  }
  try {
    const blob = await blobPromise;
    const url  = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;   // Pop-up blocked → fall back to same tab
    // Revoke well after the viewer has loaded the document.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    if (tab) tab.close();
    throw err;
  }
};

// Open a single bill's invoice PDF in a new tab (print or save from the viewer).
export const printBillPdf = (billId) =>
  openPdfInTab(api.get(`/bills/${billId}/pdf`, { responseType: "blob" }));

// Open the sales report PDF for the given filters (same shape as GET /reports).
export const printReportPdf = (params = {}) =>
  openPdfInTab(api.get("/reports/pdf", { params, responseType: "blob" }));

export default api;
