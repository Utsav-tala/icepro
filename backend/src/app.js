// backend/src/app.js
// Express server bootstrap — entry point for the ICEPRO backend.
// Middleware order is CRITICAL — do not rearrange without understanding the impact.

// ── Step 1: Load env vars FIRST before any module reads process.env ───────────
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const cookieParser  = require("cookie-parser");
const connectDB  = require("../config/database");
const logger     = require("../utils/logger");
const errorMiddleware = require("../middleware/error.middleware");
const { globalLimiter } = require("../middleware/rateLimiter.middleware");

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes      = require("../routes/auth.routes");
const productRoutes   = require("../routes/product.routes");
const agencyRoutes    = require("../routes/agency.routes");
const billRoutes      = require("../routes/bill.routes");
const paymentRoutes   = require("../routes/payment.routes");
const orderRoutes     = require("../routes/order.routes");
const dashboardRoutes = require("../routes/dashboard.routes");
const settingsRoutes  = require("../routes/settings.routes");
const reportsRoutes   = require("../routes/reports.routes");

// ── Create Express app ────────────────────────────────────────────────────────
const app = express();

// Trust proxy if we are behind a reverse proxy (like React dev server proxy, Nginx, or Heroku)
// This is required for express-rate-limit to correctly identify IPs.
app.set('trust proxy', 1);

// ── Security & CORS Configuration ────────────────────────────────────────
const corsOptions = {
  origin: process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_ORIGIN || "https://your-frontend-domain.com"
    : "http://localhost:3000",   // React CRA default port
  methods:      ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials:  true,
};

// ── Middleware stack (order matters) ──────────────────────────────────────────
app.use(helmet());                             // 1. Security HTTP headers
app.use(cors(corsOptions));                    // 2. CORS headers
app.use(cookieParser());                       // 3. Parse cookies (for refresh token)
app.use(express.json({ limit: "10mb" }));      // 4. JSON body parser
app.use(express.urlencoded({ extended: true })); // 5. URL-encoded bodies
app.use(mongoSanitize());                      // 6. Strip $ and . to prevent NoSQL injection
app.use(globalLimiter);                        // 7. Global rate limiter (200 req/15min)

// ── Route mounting ────────────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/products",  productRoutes);
app.use("/api/agencies",  agencyRoutes);
app.use("/api/bills",     billRoutes);
app.use("/api/payments",  paymentRoutes);
app.use("/api/orders",    orderRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings",  settingsRoutes);
app.use("/api/reports",   reportsRoutes);

// ── Root health check ─────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ICEPRO ERP API is running",
    version: "2.0.0",
    phase:   "Phase 1 — Backend Foundation",
    docs:    "See TDD.md and ICEPRO_MEMORY.md for full API spec",
  });
});

// ── API-level health check with DB status ─────────────────────────────────────
app.get("/api/health", (req, res) => {
  const mongoose = require("mongoose");
  const dbState  = ["disconnected", "connected", "connecting", "disconnecting"];
  res.status(200).json({
    success:   true,
    message:   "ICEPRO API health check",
    server:    "running",
    database:  dbState[mongoose.connection.readyState] || "unknown",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 handler — catch all undefined routes ──────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors:  [],
  });
});

// ── Global error handler — MUST be last ──────────────────────────────────────
app.use(errorMiddleware);

// ── Server startup ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

let server; // Exported for graceful shutdown

const startServer = async () => {
  // Step 1: Start listening immediately — server is reachable for health checks
  server = app.listen(PORT, () => {
    logger.info(`ICEPRO Backend running on http://localhost:${PORT}`);
    logger.info(`Environment : ${process.env.NODE_ENV}`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
  });

  // Step 2: Connect to MongoDB (non-blocking relative to HTTP listening)
  try {
    await connectDB();
  } catch (err) {
    logger.error(`DB connection failed — server running without DB: ${err.message}`);
    // In production, you may want process.exit(1) here.
    // In development, we continue so routes can still be tested.
  }
};

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  logger.warn(`${signal} received — shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      const mongoose = require("mongoose");
      await mongoose.connection.close();
      logger.info("MongoDB connection closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

// ── Handle uncaught exceptions and unhandled rejections ──────────────────────
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// ── Start ─────────────────────────────────────────────────────────────────────
startServer().catch((err) => {
  logger.error(`Server startup failed: ${err.message}`);
  process.exit(1);
});

module.exports = app; // Exported for future testing
