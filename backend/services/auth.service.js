// backend/services/auth.service.js
// Business logic for all authentication operations.
// Handles: local login/register, Google OAuth (login-only), email verification, lockout.

const crypto                    = require("crypto");
const bcrypt                    = require("bcryptjs");
const { OAuth2Client }          = require("google-auth-library");
const User                      = require("../models/User");
const Settings                  = require("../models/Settings");
const ApiError                  = require("../utils/ApiError");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");
const {
  createVerificationToken,
  hashToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  createSignupTicket,
  verifySignupTicket,
} = require("../utils/tokens");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const MIN_PASSWORD_LENGTH = 8;

// ── Shared: build safe user response ─────────────────────────────────────────
const safeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.refreshTokens;
  delete obj.googleId;
  delete obj.failedLoginAttempts;
  delete obj.lockUntil;
  return obj;
};

// ── Shared: password policy ──────────────────────────────────────────────────
// One definition, used by every path that sets a password (initial setup and reset),
// so the rules cannot drift apart between them.
const assertStrongPassword = (password) => {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, [
      { field: "password", message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
    ]);
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new ApiError(400, "Password must contain at least one letter and one number.", [
      { field: "password", message: "Include at least one letter and one number." },
    ]);
  }
};

// ── Shared: issue a session (access token + rotating refresh token) ──────────
// The RAW refresh token is returned for the controller to set as an httpOnly cookie.
// Only its hash is persisted, so a database leak cannot be replayed as a live session.
const issueSession = async (user, deviceInfo = "") => {
  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user._id);

  await user.addRefreshToken(hashRefreshToken(refreshToken), deviceInfo);

  return { accessToken, refreshToken };
};

// A bcrypt hash of a throwaway value. Comparing against this on the "no such user" path
// costs the same ~100ms as a real check — see loginUser for why that matters.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Constant-time string compare. A plain `a !== b` bails at the first differing byte, so
// how long it takes leaks how much of the prefix was right — enough, with enough attempts,
// to recover a secret character by character. Hash both sides first so the lengths always
// match (timingSafeEqual throws on a length mismatch, which would itself leak the length).
const timingSafeEquals = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// ── The signup gate ───────────────────────────────────────────────────────────
// Exchange the secret code for a short-lived ticket. This is the ONLY way to get one.
//
// The code comes from the DATABASE (Settings.signup.secretCode), not from .env, so the
// owner can rotate it from the Settings page and have it take effect immediately.
// SIGNUP_SECRET now only bootstraps the DB value on first run — see Settings.getSettings().
// Previously this read process.env directly while the Settings UI wrote to Mongo, so
// changing the code did nothing at all: the old .env value kept working.
const issueSignupTicket = async (secretCode) => {
  const settings    = await Settings.getSettings();
  const validSecret = settings.signup?.secretCode;

  if (!validSecret || !secretCode || !timingSafeEquals(String(secretCode), validSecret)) {
    throw new ApiError(403, "Invalid secret code. Ask your administrator for the signup code.");
  }
  return { valid: true, signupTicket: createSignupTicket() };
};

// EVERY path that creates an account must call this first. Making the gate a credential
// rather than a step number is the whole point: there is no client-side state to skip.
// If a future signup route forgets this line, it creates accounts for anyone — so it is
// deliberately a single, obvious, unmissable call.
const assertSignupAllowed = (signupTicket) => {
  if (!verifySignupTicket(signupTicket)) {
    throw new ApiError(
      403,
      "Your signup session has expired or is invalid. Please enter the secret code again."
    );
  }
};

// ── Register (email/password) ─────────────────────────────────────────────────
const registerUser = async (userData) => {
  const { signupTicket, firstName, lastName, username, email, mobile } = userData;

  // 1. The gate — no ticket, no account. See assertSignupAllowed().
  assertSignupAllowed(signupTicket);

  // 2. Uniqueness checks — clear field-level errors
  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, "Email is already registered", [
      { field: "email", message: "This email is already registered. Please sign in instead." },
    ]);
  }

  const existingUsername = await User.findOne({ username: username.toLowerCase() });
  if (existingUsername) {
    throw new ApiError(409, "Username is already taken", [
      { field: "username", message: "This username is already taken. Please choose another." },
    ]);
  }

  // 3. Create verification token
  const { rawToken, hashedToken } = createVerificationToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  // 4. Create user (no password yet)
  const user = await User.create({
    firstName: firstName.trim(),
    lastName:  (lastName || "").trim(),
    username:  username.toLowerCase().trim(),
    email:     email.toLowerCase().trim(),
    mobile:    mobile.trim(),
    authProvider:             "local",
    isEmailVerified:          false,
    emailVerificationToken:   hashedToken,
    emailVerificationExpires: expires,
    role:                     "manager",
  });

  // 5. Send verification email.
  // The account is already created, so a failure here must NOT roll the signup back — but it
  // must not be swallowed either. Previously this returned plain success, so the UI told the
  // user to check an inbox that would never receive anything, and the only trace was a server
  // log nobody reads. Report the outcome instead and let the caller say something true.
  let emailSent  = false;
  let emailError = null;
  try {
    await sendVerificationEmail(user, rawToken);
    emailSent = true;
  } catch (err) {
    // Log the whole error, not just .message — SMTP failures carry the useful part in
    // err.code / err.response ("535 auth failed", "ETIMEDOUT", "ECONNREFUSED"...).
    emailError = err.response || err.code || err.message;
    console.error("Verification email FAILED for", user.email, "->", emailError, err);
  }

  // 6. Return success (no token, force login after verification)
  return { user: safeUser(user), emailSent, emailError };
};

// ── Login (email/password) ────────────────────────────────────────────────────
const loginUser = async (email, password, deviceInfo = "") => {
  // 1. Find user — include password and lockout fields
  const user = await User
    .findOne({ email: email.toLowerCase() })
    .select("+password +failedLoginAttempts +lockUntil +refreshTokens");

  // No such user. Burn the same ~100ms a real bcrypt check would cost before answering.
  // Returning immediately here would make "unknown email" measurably FASTER than "wrong
  // password", and that timing gap is enough to enumerate which emails have accounts.
  if (!user) {
    await bcrypt.compare(password || "", DUMMY_HASH);
    throw new ApiError(401, "Invalid email or password");
  }

  // 2. Account lockout check
  if (user.isLocked) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(
      429,
      `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`
    );
  }

  // 3. Google-only account — no password
  if (user.authProvider === "google" && !user.password) {
    throw new ApiError(401, "This account uses Google Sign-In. Please sign in with Google.");
  }

  // 4. Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await user.incFailedLogin();
    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw new ApiError(429, `Too many failed attempts. Account locked for ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`);
    }
    throw new ApiError(401, "Invalid email or password");
  }

  // 5. Check account status
  if (user.status === "inactive") {
    throw new ApiError(403, "Your account has been deactivated. Please contact an administrator.");
  }

  if (!user.isEmailVerified) {
    throw new ApiError(403, "Please verify your email address before logging in.");
  }

  // 6. Clear failed attempts on success
  await user.clearFailedLogin();

  const { accessToken, refreshToken } = await issueSession(user, deviceInfo);
  return { user: safeUser(user), token: accessToken, refreshToken };
};

// ── Refresh the session ───────────────────────────────────────────────────────
// Called by POST /api/auth/refresh with the httpOnly cookie. Rotates the refresh token:
// the presented one is revoked and a new one issued, so a stolen refresh token is good
// for at most a single use.
const refreshSession = async (rawRefreshToken, deviceInfo = "") => {
  if (!rawRefreshToken) {
    throw new ApiError(401, "No refresh token provided. Please log in again.");
  }

  // 1. The token must be a valid, unexpired JWT.
  let decoded;
  try {
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new ApiError(401, "Your session has expired. Please log in again.");
  }

  // 2. …AND its hash must still be on the user. This is what makes logout and
  //    revocation real: a cryptographically valid JWT whose hash we have deleted is
  //    dead. Without this check, "logout" could not actually invalidate anything.
  const user = await User.findById(decoded._id).select("+refreshTokens");
  if (!user) throw new ApiError(401, "Your session has expired. Please log in again.");

  const presentedHash = hashRefreshToken(rawRefreshToken);
  const known = user.refreshTokens.some((t) => t.tokenHash === presentedHash);
  if (!known) {
    throw new ApiError(401, "This session has been revoked. Please log in again.");
  }

  if (user.status === "inactive") {
    throw new ApiError(403, "Your account has been deactivated. Please contact an administrator.");
  }

  // 3. Rotate: revoke the presented token, issue a fresh pair.
  await user.removeRefreshToken(presentedHash);
  const { accessToken, refreshToken } = await issueSession(user, deviceInfo);

  return { user: safeUser(user), token: accessToken, refreshToken };
};

// ── Logout ────────────────────────────────────────────────────────────────────
// Revokes only the presented device's refresh token; other devices stay signed in.
const logoutUser = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;

  let decoded;
  try {
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch {
    return;   // Already expired or junk — nothing to revoke, and logout must never fail.
  }

  const user = await User.findById(decoded._id).select("+refreshTokens");
  if (!user) return;

  await user.removeRefreshToken(hashRefreshToken(rawRefreshToken));
};

// ── Shared: verify a Google ID token ─────────────────────────────────────────
// One definition for sign-in, sign-up and autofill, so a check added here cannot be
// missed by one of them.
//
// google-auth-library already validates the signature, `iss`, `aud` and `exp`. Two
// things it does NOT do, and we must:
//   · email_verified — a Google account can hold an unverified email address
//   · replay — a Google ID token is valid for about an hour, so one captured from a log
//     or a proxy could be presented again later. Rejecting tokens older than 10 minutes
//     cuts that window by ~6x while still leaving enough time to fill in the signup form
//     (which reuses the same token). A server-issued nonce would close the window
//     completely and is the stronger fix; noted as a follow-up rather than half-done here.
const GOOGLE_TOKEN_MAX_AGE_SECONDS = 10 * 60;

const verifyGoogleToken = async (idToken) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, "Google Sign-In is not configured on this server.");
  }
  if (!idToken) {
    throw new ApiError(400, "Google ID token is required");
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, "Invalid Google token. Please try signing in again.");
  }

  if (!payload?.email || !payload.email_verified) {
    throw new ApiError(401, "This Google account's email address is not verified.");
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - Number(payload.iat || 0);
  if (ageSeconds > GOOGLE_TOKEN_MAX_AGE_SECONDS) {
    throw new ApiError(401, "This Google sign-in has expired. Please try again.");
  }

  return {
    googleId:  payload.sub,
    email:     payload.email.toLowerCase(),
    firstName: payload.given_name  || "",
    lastName:  payload.family_name || "",
  };
};

// ── Google Sign-In ONLY (no auto-create) ─────────────────────────────────────
// Used on the Sign In screen — if the email is not in the DB, returns 404.
const googleSignInOnly = async (idToken, deviceInfo = "") => {
  const { googleId, email } = await verifyGoogleToken(idToken);

  // Look for an existing user by googleId OR email — do NOT create one here.
  let user = await User.findOne({ googleId }).select("+refreshTokens");
  if (!user) {
    user = await User.findOne({ email }).select("+refreshTokens");
  }

  if (!user) {
    throw new ApiError(404, "No account found with this Google account. Please sign up first.");
  }

  // Status is checked BEFORE linking. Previously the googleId was attached and
  // isEmailVerified flipped to true, and only then was the deactivation checked — so a
  // disabled account still got mutated by someone who could not sign into it.
  if (user.status === "inactive") {
    throw new ApiError(403, "Your account has been deactivated. Please contact an administrator.");
  }

  // First Google sign-in on a local account: link the identities. Google has verified
  // the address, so the email is proven. authProvider is updated too — it used to be
  // left as "local" forever, which made the field a lie for anyone who linked.
  if (!user.googleId) {
    user.googleId        = googleId;
    user.isEmailVerified = true;
    if (!user.password) user.authProvider = "google";   // no password → truly a Google account
    await user.save();
  }

  const { accessToken, refreshToken } = await issueSession(user, deviceInfo);
  return { user: safeUser(user), token: accessToken, refreshToken };
};

// ── Sign UP with Google ───────────────────────────────────────────────────────
// A real Google signup: the secret code plus a verified Google token is enough to
// create the account. No password to invent, no verification email round-trip — Google
// has already proved the user owns the mailbox, which is the only thing that email was
// establishing. The user lands in the dashboard signed in.
const registerWithGoogle = async ({ signupTicket, idToken, username, mobile }, deviceInfo = "") => {
  // The gate. This is the path that used to be skippable from the UI — the Google button
  // called setStep(2) directly, so a user could reach the details form without ever
  // entering the secret code. The server refused at the end, but only after they had
  // filled everything in. Now there is no ticket to present, so it fails immediately.
  assertSignupAllowed(signupTicket);

  const { googleId, email, firstName, lastName } = await verifyGoogleToken(idToken);

  // Already registered? Send them to sign-in rather than silently creating a duplicate.
  const existing = await User.findOne({ $or: [{ email }, { googleId }] });
  if (existing) {
    throw new ApiError(409, "An account already exists for this Google address. Please sign in instead.", [
      { field: "email", message: "Already registered — sign in with Google instead." },
    ]);
  }

  const cleanUsername = String(username || "").toLowerCase().trim();
  if (cleanUsername.length < 3) {
    throw new ApiError(400, "Username must be at least 3 characters.", [
      { field: "username", message: "Username must be at least 3 characters." },
    ]);
  }
  if (await User.findOne({ username: cleanUsername })) {
    throw new ApiError(409, "Username is already taken", [
      { field: "username", message: "This username is already taken. Please choose another." },
    ]);
  }

  const cleanMobile = String(mobile || "").trim();
  if (!/^\d{10}$/.test(cleanMobile)) {
    throw new ApiError(400, "Mobile number must be exactly 10 digits.", [
      { field: "mobile", message: "Mobile number must be exactly 10 digits." },
    ]);
  }

  const user = await User.create({
    firstName:       firstName || cleanUsername,
    lastName,
    username:        cleanUsername,
    email,
    mobile:          cleanMobile,
    googleId,
    authProvider:    "google",
    isEmailVerified: true,     // Google vouched for it — that is what verification was for
    role:            "manager",
    // No password. loginUser() detects this and tells them to use Google.
  });

  const { accessToken, refreshToken } = await issueSession(user, deviceInfo);
  return { user: safeUser(user), token: accessToken, refreshToken };
};

// ── Verify Google token — returns profile info for signup autofill ────────────
// Used on the Sign Up screen to autofill fields. Does NOT create a user.
const getGoogleProfile = async (idToken) => {
  const { email, firstName, lastName } = await verifyGoogleToken(idToken);
  return { email, firstName, lastName };
};

// ── Check email availability ──────────────────────────────────────────────────
const checkEmailAvailable = async (email) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  return !existing; // true = available
};

// ── Check username availability ───────────────────────────────────────────────
const checkUsernameAvailable = async (username) => {
  const existing = await User.findOne({ username: username.toLowerCase() });
  return !existing; // true = available
};

// ── Email verification and Password Setup ─────────────────────────────────────
const verifyAndSetPassword = async (rawToken, password, deviceInfo = "") => {
  assertStrongPassword(password);

  const user = await User
    .findOne({
      emailVerificationToken:   hashToken(rawToken),
      emailVerificationExpires: { $gt: Date.now() },
    })
    .select("+emailVerificationToken +emailVerificationExpires +refreshTokens");

  if (!user) {
    throw new ApiError(400, "This verification link is invalid or has expired. Please request a new one.");
  }

  // Status is checked BEFORE the account is mutated — a deactivated user should not be
  // able to set a password at all, let alone have it saved and then be refused.
  if (user.status === "inactive") {
    throw new ApiError(403, "Your account has been deactivated. Please contact an administrator.");
  }

  user.isEmailVerified          = true;
  user.emailVerificationToken   = undefined;
  user.emailVerificationExpires = undefined;
  user.password                 = password; // hashed by the pre-save hook
  await user.save();

  const { accessToken, refreshToken } = await issueSession(user, deviceInfo);
  return { user: safeUser(user), token: accessToken, refreshToken };
};

// ── Forgot password — send a reset link ───────────────────────────────────────
// ALWAYS resolves successfully, even for an email that has no account. Reporting
// "no such user" here would hand an attacker a free account-enumeration oracle — the
// exact hole we just closed on the login path. The caller returns the same neutral
// "if that email exists, we've sent a link" message either way.
const forgotPassword = async (email) => {
  const user = await User
    .findOne({ email: String(email || "").toLowerCase() })
    .select("+passwordResetToken +passwordResetExpires");

  if (!user) return;                       // silent no-op, deliberately
  if (user.status === "inactive") return;  // deactivated accounts cannot be revived this way

  // A Google-only account has no password to reset. Silent, for the same reason.
  if (user.authProvider === "google" && !user.password) return;

  const { rawToken, hashedToken } = createVerificationToken();
  user.passwordResetToken   = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);   // 1 hour
  await user.save();

  try {
    await sendPasswordResetEmail(user, rawToken);
  } catch (err) {
    // Do not leak the failure to the caller (it would confirm the account exists),
    // but do make it loud in the logs so a broken mailer is not invisible.
    console.error("Password reset email failed:", err.message);
  }
};

// ── Reset password using the emailed token ────────────────────────────────────
const resetPassword = async (rawToken, password) => {
  assertStrongPassword(password);

  const user = await User
    .findOne({
      passwordResetToken:   hashToken(rawToken),
      passwordResetExpires: { $gt: Date.now() },
    })
    .select("+passwordResetToken +passwordResetExpires +refreshTokens");

  if (!user) {
    throw new ApiError(400, "This reset link is invalid or has expired. Please request a new one.");
  }

  user.password             = password;      // hashed by the pre-save hook
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;

  // A password reset is the standard response to "my account may be compromised", so it
  // must kill every existing session — including the attacker's. Also clears any lockout,
  // since the legitimate owner has just proved control of the mailbox.
  user.refreshTokens       = [];
  user.failedLoginAttempts = 0;
  user.lockUntil           = undefined;

  // Setting a password makes email/password login possible, so the email is now proven
  // and the account is a local one from here on.
  user.isEmailVerified = true;

  await user.save();

  return { user: safeUser(user) };
};

// ── Resend verification email ─────────────────────────────────────────────────
const resendVerification = async (userId) => {
  const user = await User
    .findById(userId)
    .select("+emailVerificationToken +emailVerificationExpires");

  if (!user) throw new ApiError(404, "User not found");
  if (user.isEmailVerified) throw new ApiError(400, "Email is already verified");
  if (user.authProvider === "google") throw new ApiError(400, "Google accounts do not require email verification");

  const { rawToken, hashedToken } = createVerificationToken();
  user.emailVerificationToken   = hashedToken;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  await sendVerificationEmail(user, rawToken);
};

module.exports = {
  issueSession,          // also used by user.service's password change, to re-issue this device
  issueSignupTicket,
  registerUser,
  registerWithGoogle,
  loginUser,
  refreshSession,
  logoutUser,
  googleSignInOnly,
  getGoogleProfile,
  checkEmailAvailable,
  checkUsernameAvailable,
  verifyAndSetPassword,
  forgotPassword,
  resetPassword,
  resendVerification,
};
