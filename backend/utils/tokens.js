// backend/utils/tokens.js
// Token helpers for email verification, password reset, and the access/refresh pair.
//
// ── The session model ────────────────────────────────────────────────────────
// ACCESS token  — short-lived (15m), sent in the Authorization header, never stored
//                 server-side. Its brevity is the whole point: a stolen one dies fast.
// REFRESH token — long-lived (7d), delivered ONLY as an httpOnly cookie so page
//                 JavaScript (and therefore XSS) cannot read it. A SHA-256 hash of it
//                 is stored on the user, so a database leak cannot be replayed as a
//                 session — the same raw/hash split used for verification tokens.
//
// Refresh tokens are ROTATED: every use issues a new one and revokes the old. That
// bounds the damage of a stolen refresh token to a single use.

const crypto = require("crypto");
const jwt    = require("jsonwebtoken");

// The cookie contract, defined once. Login, refresh and logout must all agree on the
// name and path or the browser will silently keep sending a cookie logout thought it
// had cleared — so this is deliberately not duplicated at the call sites.
const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/auth";

const refreshCookieOptions = () => ({
  httpOnly: true,                                   // unreadable from JS → XSS can't steal it
  secure:   process.env.NODE_ENV === "production",  // HTTPS-only in prod; plain http in local dev
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // "none" for a cross-origin SPA
  path:     REFRESH_COOKIE_PATH,                    // only ever sent to the auth routes
  maxAge:   7 * 24 * 60 * 60 * 1000,                // 7 days
});

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
 *
 * `jti` is a random per-issuance id, and it is NOT decoration. Without it the payload is
 * just { _id } and JWT's `iat` has one-second resolution — so two refresh tokens minted
 * for the same user within the same second are byte-for-byte IDENTICAL. That silently
 * breaks all three guarantees this token is supposed to carry:
 *   · rotation      — the "new" token equals the old one, so nothing is actually rotated
 *   · revocation    — logout deletes a hash that the new token still matches
 *   · replay checks — a replayed old token is indistinguishable from the current one
 * A random jti makes every issuance unique regardless of timing.
 */
const generateRefreshToken = (userId) =>
  jwt.sign(
    { _id: userId, jti: crypto.randomUUID() },
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

// ── Signup ticket ─────────────────────────────────────────────────────────────
// Proof that the holder already passed the secret-code gate.
//
// Why this exists: the gate USED to be a number in React state (`step`), so anything
// that called setStep(2) walked straight past it — which is exactly what the Google
// button did. The server's only defence was re-checking the raw secret at the very last
// request, so a user could fill in the entire form and only then be told "invalid secret
// code". The gate has to be a CREDENTIAL, not a UI variable.
//
// Now: the secret code buys a short-lived signed ticket, and NO account can be created
// without one. Any signup route added in future inherits the gate automatically, because
// it has to demand a ticket. The raw secret also stops living in React state and being
// re-transmitted at the end.
const SIGNUP_TICKET_PURPOSE = "signup";

const createSignupTicket = () =>
  jwt.sign(
    { purpose: SIGNUP_TICKET_PURPOSE },
    process.env.JWT_SECRET,
    { expiresIn: process.env.SIGNUP_TICKET_EXPIRY || "15m" }
  );

/**
 * @returns {boolean} true if the ticket is a valid, unexpired signup ticket.
 * Never throws — the caller decides what a failure means.
 */
const verifySignupTicket = (ticket) => {
  if (!ticket) return false;
  try {
    const decoded = jwt.verify(ticket, process.env.JWT_SECRET);
    // The purpose check matters: JWT_SECRET also signs ACCESS tokens, so without it any
    // logged-in user's access token would be accepted here as a signup ticket.
    return decoded?.purpose === SIGNUP_TICKET_PURPOSE;
  } catch {
    return false;
  }
};

module.exports = {
  createVerificationToken,
  hashToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  createSignupTicket,
  verifySignupTicket,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  refreshCookieOptions,
};
