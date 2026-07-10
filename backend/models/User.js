// backend/models/User.js
// Stores all user accounts — replaces Firestore `users` collection + Firebase Auth.
// Updated with auth hardening: Google OAuth, email verification, refresh tokens, lockout.

const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const { ROLES } = require("../constants");

// ── Refresh token sub-schema ──────────────────────────────────────────────────
// Stored hashed — raw value is set as an httpOnly cookie only, never logged.
const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash:  { type: String, required: true },   // SHA-256 hash of the raw token
    deviceInfo: { type: String, default: "" },      // User-Agent or "unknown"
    createdAt:  { type: Date,   default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ── Core identity ─────────────────────────────────────────────────────────
    firstName: {
      type:     String,
      required: [true, "First name is required"],
      trim:     true,
    },
    lastName: {
      type:    String,
      trim:    true,
      default: "",
    },
    username: {
      type:      String,
      required:  [true, "Username is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, "Enter a valid email address"],
    },
    password: {
      type:     String,
      // Not required for Google users — validated conditionally below
      minlength: [6, "Password must be at least 6 characters"],
      select:   false, // Never returned in query results by default
    },
    mobile: {
      type:     String,
      required: [true, "Mobile number is required"],
      trim:     true,
      match:    [/^\d{10}$/, "Mobile number must be exactly 10 digits"],
    },

    // ── Auth provider ─────────────────────────────────────────────────────────
    authProvider: {
      type:    String,
      enum:    ["local", "google"],
      default: "local",
    },
    googleId: {
      type:   String,
      sparse: true,  // Only indexed when present (Google users only)
      select: false,
    },

    // ── Email verification ────────────────────────────────────────────────────
    isEmailVerified: {
      type:    Boolean,
      default: false,
    },
    emailVerificationToken: {
      type:   String,
      select: false,  // SHA-256 hash stored; never sent to client
    },
    emailVerificationExpires: {
      type:   Date,
      select: false,
    },

    // ── Refresh tokens (per-device, hashed) ───────────────────────────────────
    // Max 5 stored — oldest pruned on overflow
    refreshTokens: {
      type:    [refreshTokenSchema],
      default: [],
      select:  false,
    },

    // ── Account lockout ───────────────────────────────────────────────────────
    failedLoginAttempts: {
      type:    Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },

    // ── Role & status ─────────────────────────────────────────────────────────
    role: {
      type:    String,
      enum:    Object.values(ROLES),  // ["owner", "manager"]
      default: ROLES.MANAGER,
    },
    status: {
      type:    String,
      enum:    ["active", "inactive"],
      default: "active",
    },
    remember: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ role: 1 });
// Note: googleId sparse unique index is defined inline on the field above — no duplicate needed here
userSchema.index({ emailVerificationToken: 1 }, { sparse: true });

// ── Virtual: fullName ─────────────────────────────────────────────────────────
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// ── Virtual: isLocked ─────────────────────────────────────────────────────────
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ── Pre-save hook: Hash password ──────────────────────────────────────────────
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified and is not empty
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ── Instance method: Compare password ─────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: Increment failed login attempts ─────────────────────────
// Locks account for LOCK_TIME_MINUTES after MAX_LOGIN_ATTEMPTS failures.
userSchema.methods.incFailedLogin = async function () {
  const MAX_ATTEMPTS  = parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5", 10);
  const LOCK_MINUTES  = parseInt(process.env.LOCK_TIME_MINUTES  || "15", 10);

  this.failedLoginAttempts += 1;

  if (this.failedLoginAttempts >= MAX_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
  }
  await this.save();
};

// ── Instance method: Clear failed login state on success ─────────────────────
userSchema.methods.clearFailedLogin = async function () {
  if (this.failedLoginAttempts !== 0 || this.lockUntil) {
    this.failedLoginAttempts = 0;
    this.lockUntil           = undefined;
    await this.save();
  }
};

// ── Instance method: Add refresh token (prune oldest if > 5) ─────────────────
userSchema.methods.addRefreshToken = async function (tokenHash, deviceInfo = "") {
  const MAX_TOKENS = 5;
  this.refreshTokens.push({ tokenHash, deviceInfo });

  // Prune oldest if over limit
  if (this.refreshTokens.length > MAX_TOKENS) {
    this.refreshTokens = this.refreshTokens.slice(-MAX_TOKENS);
  }
  await this.save();
};

// ── Instance method: Remove a specific refresh token (logout) ─────────────────
userSchema.methods.removeRefreshToken = async function (tokenHash) {
  this.refreshTokens = this.refreshTokens.filter(t => t.tokenHash !== tokenHash);
  await this.save();
};

// ── Instance method: Remove ALL refresh tokens (logout-all / password reset) ──
userSchema.methods.clearRefreshTokens = async function () {
  this.refreshTokens = [];
  await this.save();
};

const User = mongoose.model("User", userSchema);
module.exports = User;
