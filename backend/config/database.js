// backend/config/database.js
// Mongoose connection with event listeners and graceful error handling.
// Called from src/app.js before app.listen().

const mongoose = require("mongoose");
const logger   = require("../utils/logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1); // Exit immediately — server cannot run without DB
  }
};

// ── Mongoose connection event listeners ───────────────────────────────────────
mongoose.connection.on("connected", () => {
  logger.info("Mongoose: connection established");
});

mongoose.connection.on("error", (err) => {
  logger.error(`Mongoose: connection error — ${err.message}`);
});

mongoose.connection.on("disconnected", () => {
  logger.warn("Mongoose: connection lost");
});

module.exports = connectDB;
