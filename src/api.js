// src/api.js
// Centralized Axios instance with JWT access token in header
// and silent refresh via the httpOnly refresh token cookie on 401.

import axios from "axios";

const api = axios.create({
  baseURL:          "/api",
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
        // The refresh token is sent automatically via the httpOnly cookie
        const refreshRes = await axios.post(
          "/api/auth/refresh",
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

export default api;
