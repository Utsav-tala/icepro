// backend/utils/email.js
// Centralised email sender using Nodemailer.
// Handles verification and password reset emails.
//
// Priority:
//   1. Gmail OAuth2  — set EMAIL_USER, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN in .env
//   2. Gmail Simple  — set EMAIL_USER + EMAIL_PASS in .env (App Password recommended)
//   3. Ethereal      — auto-created free sandbox, preview URL printed in terminal

const nodemailer = require("nodemailer");

const FE_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const FROM   = process.env.EMAIL_USER
  ? `"Vrundavan Ice Cream" <${process.env.EMAIL_USER}>`
  : "ICEPRO ERP <noreply@example.com>";

// ── Transporter factory (lazy, singleton) ─────────────────────────────────────
let _transporter = null;

async function getTransporter() {
  if (_transporter) return _transporter;

  // Option 1: Gmail + OAuth2
  if (
    process.env.EMAIL_USER &&
    process.env.CLIENT_ID &&
    process.env.CLIENT_SECRET &&
    process.env.REFRESH_TOKEN
  ) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type:         "OAuth2",
        user:         process.env.EMAIL_USER,
        clientId:     process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
      },
    });
    console.log("📧 Email: using Gmail OAuth2");
    return _transporter;
  }

  // Option 2: Gmail + App Password
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log("📧 Email: using Gmail + App Password");
    return _transporter;
  }

  // Option 3: Ethereal sandbox (free, no setup)
  const testAccount = await nodemailer.createTestAccount();
  _transporter = nodemailer.createTransport({
    host:   "smtp.ethereal.email",
    port:   587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  console.log("📧 Email: using Ethereal sandbox (no real email will be delivered)");
  return _transporter;
}

// ── Shared HTML wrapper ───────────────────────────────────────────────────────
const htmlWrapper = (title, body) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#fdf5f5;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(200,24,30,0.1);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#9e1015,#c8181e);padding:32px 40px;text-align:center;">
          <div style="font-size:36px;">🍦</div>
          <div style="color:#fff;font-size:22px;font-weight:800;margin-top:8px;">Vrundavan Ice Cream</div>
          <div style="color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:2px;margin-top:4px;">ICEPRO ERP</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <h2 style="color:#9e1015;margin:0 0 16px;font-size:20px;">${title}</h2>
          ${body}
          <hr style="border:none;border-top:1px solid #f0dada;margin:32px 0 16px;" />
          <p style="color:#a07070;font-size:11px;margin:0;">
            This email was sent by ICEPRO ERP. If you didn't request this, please ignore it.
            <br/>© ${new Date().getFullYear()} Vrundavan Ice Cream, Kalavad, Gujarat, India.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Send email verification ───────────────────────────────────────────────────
/**
 * @param {Object} user     - Mongoose User document (must have firstName, email)
 * @param {string} rawToken - The raw (unhashed) verification token
 */
const sendVerificationEmail = async (user, rawToken) => {
  const link = `${FE_URL}/verify-email/${rawToken}`;
  const body = `
    <p style="color:#4a2020;font-size:15px;line-height:1.7;">
      Hi <strong>${user.firstName}</strong>,<br/>
      Welcome to ICEPRO! Please verify your email address to unlock full access
      to billing and payment features.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${link}"
         style="background:linear-gradient(135deg,#9e1015,#c8181e);color:#fff;
                text-decoration:none;padding:14px 32px;border-radius:10px;
                font-weight:700;font-size:15px;display:inline-block;
                box-shadow:0 4px 14px rgba(200,24,30,0.35);">
        ✅ Verify My Email
      </a>
    </div>
    <p style="color:#a07070;font-size:13px;">
      This link expires in <strong>24 hours</strong>.
      If the button doesn't work, copy and paste this URL:<br/>
      <a href="${link}" style="color:#c8181e;word-break:break-all;">${link}</a>
    </p>`;

  const tp   = await getTransporter();
  const info = await tp.sendMail({
    from:    FROM,
    to:      user.email,
    subject: "Verify your ICEPRO email address",
    html:    htmlWrapper("Verify Your Email", body),
  });

  // Always log the preview URL — useful in all environments
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log("-----------------------------------------------------");
    console.log("📨 Verification email preview:");
    console.log("👉 " + previewUrl);
    console.log("-----------------------------------------------------");
  } else {
    console.log(`📨 Verification email sent to ${user.email} (messageId: ${info.messageId})`);
  }
};

// ── Send password reset ───────────────────────────────────────────────────────
/**
 * @param {Object} user     - Mongoose User document (must have firstName, email)
 * @param {string} rawToken - The raw (unhashed) reset token — only the hash is in the DB
 */
const sendPasswordResetEmail = async (user, rawToken) => {
  const link = `${FE_URL}/reset-password/${rawToken}`;
  const body = `
    <p style="color:#4a2020;font-size:15px;line-height:1.7;">
      Hi <strong>${user.firstName}</strong>,<br/>
      We received a request to reset the password on your ICEPRO account.
      Click below to choose a new one.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${link}"
         style="background:linear-gradient(135deg,#9e1015,#c8181e);color:#fff;
                text-decoration:none;padding:14px 32px;border-radius:10px;
                font-weight:700;font-size:15px;display:inline-block;
                box-shadow:0 4px 14px rgba(200,24,30,0.35);">
        🔑 Reset My Password
      </a>
    </div>
    <p style="color:#a07070;font-size:13px;">
      This link expires in <strong>1 hour</strong> and can only be used once.
      If the button doesn't work, copy and paste this URL:<br/>
      <a href="${link}" style="color:#c8181e;word-break:break-all;">${link}</a>
    </p>
    <p style="color:#a07070;font-size:13px;margin-top:18px;">
      <strong>Didn't request this?</strong> You can safely ignore this email — your password
      will not change until someone opens the link above. Resetting also signs you out
      everywhere, so if you are worried, reset it yourself.
    </p>`;

  const tp   = await getTransporter();
  const info = await tp.sendMail({
    from:    FROM,
    to:      user.email,
    subject: "Reset your ICEPRO password",
    html:    htmlWrapper("Reset Your Password", body),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log("-----------------------------------------------------");
    console.log("🔑 Password reset email preview:");
    console.log("👉 " + previewUrl);
    console.log("-----------------------------------------------------");
  } else {
    console.log(`🔑 Password reset email sent to ${user.email} (messageId: ${info.messageId})`);
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
