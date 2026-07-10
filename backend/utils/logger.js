// backend/utils/logger.js
// Simple console logger with timestamps and log levels.
// Swap the internals for winston/pino later without changing any import sites.
// Usage:  const logger = require("../utils/logger")
//         logger.info("Server started on port 5000")
//         logger.error("DB connection failed", err)

const getTimestamp = () => new Date().toISOString();

const logger = {
  info: (message, ...args) => {
    console.log(`[${getTimestamp()}] [INFO]  ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[${getTimestamp()}] [WARN]  ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[${getTimestamp()}] [ERROR] ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[${getTimestamp()}] [DEBUG] ${message}`, ...args);
    }
  },
};

module.exports = logger;
