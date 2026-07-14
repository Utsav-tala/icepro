// backend/controllers/auth.controller.js
// Controllers for all authentication endpoints.

const authService = require("../services/auth.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError    = require("../utils/ApiError");
const User        = require("../models/User");
const { REFRESH_COOKIE, refreshCookieOptions } = require("../utils/tokens");

// ── Session helpers ───────────────────────────────────────────────────────────
// The refresh token is delivered ONLY as an httpOnly cookie and is never put in the
// JSON body — page JavaScript must not be able to read it, or an XSS could lift a
// 7-day session. The short-lived access token goes in the body as before.
const sendSession = (res, statusCode, { user, token, refreshToken }, message) => {
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  }
  res.status(statusCode).json(new ApiResponse(statusCode, { user, token }, message));
};

// Identifies the device on the user's session list, so refresh tokens are traceable.
const deviceOf = (req) => String(req.headers["user-agent"] || "unknown").slice(0, 200);

// ── Check Secret Code → issue a signup ticket ─────────────────────────────────
/**
 * @route   POST /api/auth/check-secret
 * @access  Public
 *
 * Exchanges the secret code for a short-lived signed SIGNUP TICKET. This is the only
 * way to obtain one, and no account can be created without one — so the gate lives in a
 * credential, not in the frontend's `step` variable, which anything could walk past.
 */
const checkSecret = async (req, res, next) => {
  try {
    const result = await authService.issueSignupTicket(req.body?.secretCode);
    res.status(200).json(new ApiResponse(200, result, "Secret code accepted"));
  } catch (error) {
    next(error);
  }
};

// ── Register ──────────────────────────────────────────────────────────────────
/**
 * @route   POST /api/auth/register
 * @access  Public
 * Body: { secretCode, firstName, lastName, username, email, mobile, password }
 */
const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json(
      new ApiResponse(201, result, "Registration successful. Please check your email to verify your account.")
    );
  } catch (error) {
    next(error);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
/**
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password, deviceOf(req));
    sendSession(res, 200, result, "Login successful");
  } catch (error) {
    next(error);
  }
};

// ── Refresh the session ───────────────────────────────────────────────────────
/**
 * @route   POST /api/auth/refresh
 * @access  Public (authenticated by the httpOnly refresh cookie)
 *
 * The frontend calls this automatically when a 15-minute access token expires
 * (see api.js). Until this endpoint existed, that call 404'd and every user was
 * silently signed out mid-work every 15 minutes.
 *
 * Rotates the refresh token: the presented one is revoked and a new one issued.
 */
const refresh = async (req, res, next) => {
  try {
    const result = await authService.refreshSession(req.cookies?.[REFRESH_COOKIE], deviceOf(req));
    sendSession(res, 200, result, "Session refreshed");
  } catch (error) {
    // The cookie is dead — clear it, so the browser stops re-sending a token that will
    // only fail again. Options must match the ones it was set with or it won't clear.
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    next(error);
  }
};

// ── Forgot password ───────────────────────────────────────────────────────────
/**
 * @route   POST /api/auth/forgot-password
 * @access  Public
 *
 * Always answers the same way, whether or not the email exists. Saying "no such
 * account" would be a free account-enumeration oracle.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new ApiError(400, "Email is required");

    await authService.forgotPassword(email);

    res.status(200).json(new ApiResponse(200, null,
      "If an account exists for that email, a password reset link has been sent."));
  } catch (error) {
    next(error);
  }
};

// ── Reset password ────────────────────────────────────────────────────────────
/**
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 *
 * Signs the user out of every device — a reset is the standard response to a
 * suspected compromise, so the attacker's sessions must die too.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    await authService.resetPassword(req.params.token, password);

    // Every refresh token was just revoked, so this browser's cookie is dead too.
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });

    res.status(200).json(new ApiResponse(200, null,
      "Password reset. You have been signed out everywhere — please sign in with your new password."));
  } catch (error) {
    next(error);
  }
};

// ── Google Sign-In (LOGIN ONLY — no auto-create) ──────────────────────────────
/**
 * @route   POST /api/auth/google
 * @access  Public
 * Used on Sign In screen. Returns 404 if no account found.
 */
const googleSignIn = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const result = await authService.googleSignInOnly(idToken, deviceOf(req));
    sendSession(res, 200, result, "Google Sign-In successful");
  } catch (error) {
    next(error);
  }
};

// ── Google Sign-UP (creates the account, signs them straight in) ──────────────
/**
 * @route   POST /api/auth/google-register
 * @access  Public
 * Body: { secretCode, idToken, username, mobile }
 *
 * A real Google signup: no password to invent and no verification email round-trip.
 * Google has already proved the user owns the mailbox, which is the only thing the
 * verification email was establishing.
 */
const googleRegister = async (req, res, next) => {
  try {
    const result = await authService.registerWithGoogle(req.body, deviceOf(req));
    sendSession(res, 201, result, "Account created with Google. You're signed in.");
  } catch (error) {
    next(error);
  }
};

// ── Google Profile (AUTOFILL for signup — no account creation) ────────────────
/**
 * @route   POST /api/auth/google-profile
 * @access  Public
 * Used on Sign Up screen. Returns name/email from Google for autofill only.
 */
const googleProfile = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) throw new ApiError(400, "Google ID token is required");

    const profile = await authService.getGoogleProfile(idToken);
    res.status(200).json(
      new ApiResponse(200, profile, "Google profile fetched for autofill")
    );
  } catch (error) {
    next(error);
  }
};

// ── Check Email Availability ──────────────────────────────────────────────────
/**
 * @route   GET /api/auth/check-email?email=
 * @access  Public
 */
const checkEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) throw new ApiError(400, "Email is required");

    const available = await authService.checkEmailAvailable(email);
    res.status(200).json(
      new ApiResponse(200, { available }, available ? "Email is available" : "Email is already registered")
    );
  } catch (error) {
    next(error);
  }
};

// ── Check Username Availability ───────────────────────────────────────────────
/**
 * @route   GET /api/auth/check-username?username=
 * @access  Public
 */
const checkUsername = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username) throw new ApiError(400, "Username is required");

    const available = await authService.checkUsernameAvailable(username);
    res.status(200).json(
      new ApiResponse(200, { available }, available ? "Username is available" : "Username is already taken")
    );
  } catch (error) {
    next(error);
  }
};

// ── Verify Email and Set Password ─────────────────────────────────────────────
/**
 * @route   POST /api/auth/verify-and-set-password/:token
 * @access  Public
 */
const verifyAndSetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const result = await authService.verifyAndSetPassword(req.params.token, password, deviceOf(req));
    sendSession(res, 200, result,
      "Email verified and password set successfully. You are now logged in.");
  } catch (error) {
    next(error);
  }
};

// ── Resend Verification Email ─────────────────────────────────────────────────
/**
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
const resendVerification = async (req, res, next) => {
  try {
    await authService.resendVerification(req.user._id);
    res.status(200).json(
      new ApiResponse(200, null, "Verification email sent. Please check your inbox.")
    );
  } catch (error) {
    next(error);
  }
};

// ── Get Current User ──────────────────────────────────────────────────────────
/**
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) throw new ApiError(404, "User not found");
    res.status(200).json(
      new ApiResponse(200, { user }, "User profile fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────
/**
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res, next) => {
  try {
    // Actually REVOKE the session, don't just drop the cookie. Deleting the token's hash
    // from the user is what makes the refresh token dead — previously logout cleared a
    // cookie that had never been set and invalidated nothing, so a copied token stayed
    // usable. Only this device is signed out; other devices keep their sessions.
    await authService.logoutUser(req.cookies?.[REFRESH_COOKIE]);

    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    res.status(200).json(new ApiResponse(200, null, "Logout successful"));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkSecret,
  register,
  googleRegister,
  login,
  refresh,
  googleSignIn,
  googleProfile,
  checkEmail,
  checkUsername,
  verifyAndSetPassword,
  forgotPassword,
  resetPassword,
  resendVerification,
  getMe,
  logout,
};
