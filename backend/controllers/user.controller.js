// backend/controllers/user.controller.js
// HTTP layer for self-service profile actions.

const User        = require("../models/User");
const userService = require("../services/user.service");
const authService = require("../services/auth.service");
const ApiResponse = require("../utils/ApiResponse");
const { REFRESH_COOKIE, refreshCookieOptions } = require("../utils/tokens");

const deviceOf = (req) => String(req.headers["user-agent"] || "unknown").slice(0, 200);

/**
 * @desc    My profile
 * @route   GET /api/users/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    res.status(200).json(new ApiResponse(200, { user: req.user }, "Profile fetched"));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update my profile — first name, last name, mobile.
 *          username / email / role / status are NOT editable here (see user.service.js).
 * @route   PATCH /api/users/me
 * @access  Private
 */
const updateMe = async (req, res, next) => {
  try {
    const user = await userService.updateMyProfile(req.user._id, req.body);
    res.status(200).json(new ApiResponse(200, { user }, "Profile updated"));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change my password. Requires the current one — unless this is a Google account
 *          adding its first password, in which case there is nothing to prove.
 *          Revokes every other session, then re-issues one for THIS device so the user
 *          is not kicked out of the page they are standing on.
 * @route   POST /api/users/me/password
 * @access  Private
 * @body    { currentPassword?, newPassword }
 */
const changePassword = async (req, res, next) => {
  try {
    const { user, wasFirstPassword } = await userService.changeMyPassword(req.user._id, req.body);

    // changeMyPassword cleared ALL refresh tokens (including this browser's). Issue a
    // fresh session so the current device stays signed in — every other device is now out.
    const fullUser = await User.findById(user._id).select("+refreshTokens");
    const { accessToken, refreshToken } = await authService.issueSession(fullUser, deviceOf(req));

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.status(200).json(
      new ApiResponse(
        200,
        { user, token: accessToken },
        wasFirstPassword
          ? "Password set. You can now sign in with your email and password too."
          : "Password changed. You've been signed out on all other devices."
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { getMe, updateMe, changePassword };
