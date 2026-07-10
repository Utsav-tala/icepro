// backend/services/auth.service.js
// Business logic for all authentication operations.
// Handles: local login/register, Google OAuth (login-only), email verification, lockout.

const { OAuth2Client }          = require("google-auth-library");
const User                      = require("../models/User");
const ApiError                  = require("../utils/ApiError");
const { sendVerificationEmail } = require("../utils/email");
const {
  createVerificationToken,
  hashToken,
  generateAccessToken,
} = require("../utils/tokens");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Shared: build safe user response ─────────────────────────────────────────
const safeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.refreshTokens;
  delete obj.googleId;
  delete obj.failedLoginAttempts;
  delete obj.lockUntil;
  return obj;
};

// ── Register (email/password) ─────────────────────────────────────────────────
const registerUser = async (userData) => {
  const { secretCode, firstName, lastName, username, email, mobile } = userData;

  // 1. Validate secret code
  const validSecret = process.env.SIGNUP_SECRET;
  if (!validSecret || secretCode !== validSecret) {
    throw new ApiError(403, "Invalid secret code. Ask your administrator for the signup code.");
  }

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

  // 5. Send verification email
  try {
    await sendVerificationEmail(user, rawToken);
  } catch (emailErr) {
    console.error("Verification email failed:", emailErr.message);
  }

  // 6. Return success (no token, force login after verification)
  return { user: safeUser(user) };
};

// ── Login (email/password) ────────────────────────────────────────────────────
const loginUser = async (email, password) => {
  // 1. Find user — include password and lockout fields
  const user = await User
    .findOne({ email: email.toLowerCase() })
    .select("+password +failedLoginAttempts +lockUntil");

  if (!user) {
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

  const accessToken = generateAccessToken(user);
  return { user: safeUser(user), token: accessToken };
};

// ── Google Sign-In ONLY (no auto-create) ─────────────────────────────────────
// Used on the Sign In screen — if email is not in DB, returns 404 error.
const googleSignInOnly = async (idToken) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, "Google Sign-In is not configured on this server.");
  }

  // 1. Verify the ID token server-side
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

  const { sub: googleId, email, email_verified } = payload;

  if (!email_verified) {
    throw new ApiError(401, "Google account email is not verified.");
  }

  // 2. Look for existing user by googleId OR email — do NOT create
  let user = await User.findOne({ googleId });
  if (!user) {
    user = await User.findOne({ email: email.toLowerCase() });
  }

  if (!user) {
    throw new ApiError(404, "No account found with this Google account. Please sign up first.");
  }

  // 3. Link googleId if not already linked (first time signing in with Google)
  if (!user.googleId) {
    user.googleId       = googleId;
    user.isEmailVerified = true;
    await user.save();
  }

  // 4. Check account status
  if (user.status === "inactive") {
    throw new ApiError(403, "Your account has been deactivated. Please contact an administrator.");
  }

  const accessToken = generateAccessToken(user);
  return { user: safeUser(user), token: accessToken };
};

// ── Verify Google token — returns profile info for signup autofill ────────────
// Used on the Sign Up screen to autofill fields. Does NOT create a user.
const getGoogleProfile = async (idToken) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, "Google Sign-In is not configured on this server.");
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, "Invalid Google token. Please try again.");
  }

  const { email, given_name, family_name, email_verified } = payload;

  if (!email_verified) {
    throw new ApiError(401, "Google account email is not verified.");
  }

  // Return profile info for frontend autofill only
  return {
    email:     email.toLowerCase(),
    firstName: given_name  || "",
    lastName:  family_name || "",
  };
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
const verifyAndSetPassword = async (rawToken, password) => {
  const hashedToken = hashToken(rawToken);

  const user = await User
    .findOne({
      emailVerificationToken:   hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    })
    .select("+emailVerificationToken +emailVerificationExpires");

  if (!user) {
    throw new ApiError(400, "This verification link is invalid or has expired. Please request a new one.");
  }

  if (!password || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters.");
  }

  user.isEmailVerified          = true;
  user.emailVerificationToken   = undefined;
  user.emailVerificationExpires = undefined;
  user.password                 = password; // Will be hashed by pre-save hook
  await user.save();

  // Check account status
  if (user.status === "inactive") {
    throw new ApiError(403, "Your account has been deactivated. Please contact an administrator.");
  }

  const accessToken = generateAccessToken(user);
  return { user: safeUser(user), token: accessToken };
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
  registerUser,
  loginUser,
  googleSignInOnly,
  getGoogleProfile,
  checkEmailAvailable,
  checkUsernameAvailable,
  verifyAndSetPassword,
  resendVerification,
};
