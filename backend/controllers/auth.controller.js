// backend/controllers/auth.controller.js
// Controllers for all authentication endpoints.

const authService = require("../services/auth.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError    = require("../utils/ApiError");
const User        = require("../models/User");

// ── Check Secret Code ─────────────────────────────────────────────────────────
/**
 * @route   POST /api/auth/check-secret
 * @access  Public
 * Validates the signup secret code before showing Step 2 of signup.
 */
const checkSecret = async (req, res, next) => {
  try {
    const { secretCode } = req.body;
    const validSecret    = process.env.SIGNUP_SECRET;
    if (!secretCode || !validSecret || secretCode !== validSecret) {
      throw new ApiError(403, "Invalid secret code. Ask your administrator for the signup code.");
    }
    res.status(200).json(new ApiResponse(200, { valid: true }, "Secret code accepted"));
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
    const result = await authService.loginUser(email, password);
    res.status(200).json(
      new ApiResponse(200, result, "Login successful")
    );
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
    if (!idToken) throw new ApiError(400, "Google ID token is required");

    const result = await authService.googleSignInOnly(idToken);
    res.status(200).json(
      new ApiResponse(200, result, "Google Sign-In successful")
    );
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
    const result = await authService.verifyAndSetPassword(req.params.token, password);
    res.status(200).json(
      new ApiResponse(200, result, "Email verified and password set successfully. You are now logged in.")
    );
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
    const { protect } = require("../middleware/auth.middleware");
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
    // Clear the refresh token cookie
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.status(200).json(new ApiResponse(200, null, "Logout successful"));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkSecret,
  register,
  login,
  googleSignIn,
  googleProfile,
  checkEmail,
  checkUsername,
  verifyAndSetPassword,
  resendVerification,
  getMe,
  logout,
};
