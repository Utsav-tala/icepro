// backend/services/user.service.js
// Self-service profile: the things a signed-in user may change about their OWN account.
//
// What is deliberately NOT editable here:
//   username — an identity handle others may already know you by. Changing it silently
//              rewrites history from everyone else's point of view.
//   email    — it is the account's proof of ownership and the password-reset destination.
//              Changing it must re-verify the new address, which is a separate flow.
//   role     — self-promotion. Only an owner may change roles (no admin route yet).
//   status   — same.
// Each of those is a deliberate omission, not an oversight.

const User     = require("../models/User");
const ApiError = require("../utils/ApiError");

const MIN_PASSWORD_LENGTH = 8;

const safeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.refreshTokens;
  delete obj.googleId;
  return obj;
};

// Same rules as auth.service.assertStrongPassword. Kept local rather than cross-importing
// so this module has no dependency on the auth flow; if you change one, change both.
const assertStrongPassword = (password) => {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, [
      { field: "newPassword", message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
    ]);
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new ApiError(400, "Password must contain at least one letter and one number.", [
      { field: "newPassword", message: "Include at least one letter and one number." },
    ]);
  }
};

// ── Update my profile ─────────────────────────────────────────────────────────
const updateMyProfile = async (userId, data) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (data.firstName !== undefined) {
    const firstName = String(data.firstName).trim();
    if (!firstName) {
      throw new ApiError(400, "First name is required", [
        { field: "firstName", message: "First name cannot be empty." },
      ]);
    }
    user.firstName = firstName;
  }

  if (data.lastName !== undefined) {
    user.lastName = String(data.lastName).trim();
  }

  if (data.mobile !== undefined) {
    const mobile = String(data.mobile).trim();
    if (!/^\d{10}$/.test(mobile)) {
      throw new ApiError(400, "Mobile number must be exactly 10 digits", [
        { field: "mobile", message: "Mobile number must be exactly 10 digits." },
      ]);
    }
    user.mobile = mobile;
  }

  await user.save();
  return safeUser(user);
};

// ── Change my password ────────────────────────────────────────────────────────
const changeMyPassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select("+password +refreshTokens");
  if (!user) throw new ApiError(404, "User not found");

  assertStrongPassword(newPassword);

  // A Google-only account has never had a password. The user is already authenticated
  // (they got here with a valid access token), so there is nothing to prove — let them
  // ADD one. Demanding a "current password" they never had would just lock them out of
  // the feature. Everyone else must prove they know the existing one, so that a stolen
  // access token cannot be used to quietly change the password and take the account over.
  const isSettingFirstPassword = !user.password;

  if (!isSettingFirstPassword) {
    if (!currentPassword) {
      throw new ApiError(400, "Enter your current password.", [
        { field: "currentPassword", message: "Required." },
      ]);
    }
    const matches = await user.comparePassword(currentPassword);
    if (!matches) {
      throw new ApiError(401, "Your current password is incorrect.", [
        { field: "currentPassword", message: "Incorrect password." },
      ]);
    }
    if (currentPassword === newPassword) {
      throw new ApiError(400, "Your new password must be different from the current one.", [
        { field: "newPassword", message: "Choose a different password." },
      ]);
    }
  }

  user.password = newPassword;   // hashed by the pre-save hook

  // Sign out every OTHER device. Changing a password is what you do when you fear the
  // account is compromised, so any session the attacker holds must die with it. The
  // current device is re-issued a session by the controller, so the user stays logged in
  // here rather than being kicked out of the page they just used.
  user.refreshTokens = [];

  // Adding a password to a Google account means email/password login now works for it.
  if (isSettingFirstPassword && user.authProvider === "google") {
    user.authProvider = "local";
  }

  await user.save();
  return { user: safeUser(user), wasFirstPassword: isSettingFirstPassword };
};

module.exports = { updateMyProfile, changeMyPassword };
