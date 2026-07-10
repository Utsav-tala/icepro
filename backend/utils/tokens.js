// backend/utils/tokens.js
// Generates and hashes tokens for email verification.
// Also provides JWT helpers for access and refresh tokens.
// NOTE: generateRefreshToken / verifyRefreshToken / hashRefreshToken are scaffolded
//       for the planned /api/auth/refresh endpoint (see ICEPRO_MEMORY.md Section 11).
//       They are exported but not yet wired to any route — this is intentional.

const crypto = require("crypto");
const jwt    = require("jsonwebtoken");

// ── Raw + hash pair ───────────────────────────────────────────────────────────
/**
 * Create a cryptographically random raw token (sent via email)
 * and its SHA-256 hash (stored in DB — never the raw value).
 * @returns {{ rawToken: string, hashedToken: string }}
 */
const createVerificationToken = () => {
  const rawToken    = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, hashedToken };
};

/**
 * Hash an incoming raw token the same way for DB lookup.
 * @param {string} rawToken
 * @returns {string} sha256 hex hash
 */
const hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

// ── JWT helpers ────────────────────────────────────────────────────────────────
/**
 * Generate a short-lived access token.
 * Payload includes _id, role, and isEmailVerified so middleware can
 * make authorization decisions without a DB round-trip.
 */
const generateAccessToken = (user) =>
  jwt.sign(
    { _id: user._id, role: user.role, isEmailVerified: user.isEmailVerified },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" }
  );

/**
 * Generate a long-lived refresh token.
 * Only payload needed is the user _id — everything else is re-loaded from DB.
 */
const generateRefreshToken = (userId) =>
  jwt.sign(
    { _id: userId },
    process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
  );

/**
 * Verify a refresh token and return the decoded payload.
 * Throws a JWT error if invalid/expired.
 */
const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);

/**
 * Hash a refresh token value for DB storage (same pattern as verification tokens).
 */
const hashRefreshToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

module.exports = {
  createVerificationToken,
  hashToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
};
