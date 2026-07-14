// backend/utils/email.js
// Centralised email sender. Handles verification and password-reset emails.
//
// Delivery is over Brevo's HTTP API, NOT SMTP.
//
// Why not SMTP: Render (like most PaaS hosts) blocks outbound SMTP ports as an anti-spam
// measure. Gmail failed there with `ETIMEDOUT, command: 'CONN'` — the TCP connection to
// smtp.gmail.com:465 never opened, so no credential was ever sent and no Gmail setting
// could have fixed it. An HTTP API rides port 443, the same port the rest of the API
// already uses, so it cannot be port-blocked.
//
// Transports, in order:
//   1. Brevo HTTP API — set BREVO_API_KEY + EMAIL_FROM. Used whenever the key is present.
//   2. Ethereal       — LOCAL DEV ONLY. A fake inbox: it accepts mail and delivers nothing,
//                       printing a preview URL instead. Refused in production.

const nodemailer = require("nodemailer");   // only used for the Ethereal dev sandbox

const FE_URL  = process.env.FRONTEND_URL || "http://localhost:3000";
const IS_PROD = process.env.NODE_ENV === "production";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_URL     = "https://api.brevo.com/v3/smtp/email";

// Must be an address verified as a sender in Brevo, or Brevo rejects the send.
const FROM_EMAIL = process.env.EMAIL_FROM || process.env.EMAIL_USER || "";
const FROM_NAME  = process.env.EMAIL_FROM_NAME || "Vrundavan Ice Cream";

// ── Transport 1: Brevo HTTP API ───────────────────────────────────────────────
// Node 20 ships fetch globally, so this needs no new dependency.
async function sendViaBrevo({ to, toName, subject, html }) {
  if (!FROM_EMAIL) {
    throw new Error("EMAIL_FROM is not set — Brevo needs a verified sender address.");
  }

  // Don't hang forever if Brevo is slow or unreachable.
  const abort = AbortSignal.timeout(15000);

  const res = await fetch(BREVO_URL, {
    method:  "POST",
    signal:  abort,
    headers: {
      "api-key":      BREVO_API_KEY,
      "content-type": "application/json",
      accept:         "application/json",
    },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to:          [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    }),
  });

  // fetch does NOT throw on 4xx/5xx — it resolves. Check explicitly, and surface Brevo's
  // own message: it says exactly what is wrong ("sender not valid", "unauthorized"...).
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo rejected the send (HTTP ${res.status}): ${detail}`);
  }

  const data = await res.json().catch(() => ({}));
  console.log(`📨 Email sent to ${to} via Brevo (messageId: ${data.messageId || "?"})`);
  return data;
}

// ── Transport 2: Ethereal sandbox — LOCAL DEV ONLY ────────────────────────────
let _etherealTransport = null;

async function sendViaEthereal({ to, subject, html }) {
  if (!_etherealTransport) {
    const acct = await nodemailer.createTestAccount();
    _etherealTransport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: acct.user, pass: acct.pass },
      connectionTimeout: 10000,
      greetingTimeout:   10000,
      socketTimeout:     20000,
    });
    console.log("📧 Email: Ethereal sandbox (dev only — nothing is really delivered)");
  }

  const info = await _etherealTransport.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL || "noreply@example.com"}>`,
    to, subject, html,
  });

  console.log("-----------------------------------------------------");
  console.log("📨 Email preview (not delivered): " + nodemailer.getTestMessageUrl(info));
  console.log("-----------------------------------------------------");
  return info;
}

// ── The one door every email goes through ─────────────────────────────────────
async function deliver({ to, toName, subject, html }) {
  if (BREVO_API_KEY) return sendViaBrevo({ to, toName, subject, html });

  // No key. In dev that is fine — fall back to the sandbox. In production it is not:
  // Ethereal would accept every message and deliver none, so users would be told to check
  // an inbox that will never receive anything. Fail loudly instead of lying.
  if (IS_PROD) {
    throw new Error(
      "BREVO_API_KEY is not set. Refusing to fall back to the Ethereal sandbox in " +
      "production — it accepts mail and delivers nothing."
    );
  }
  return sendViaEthereal({ to, subject, html });
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

  await deliver({
    to:      user.email,
    toName:  user.firstName,
    subject: "Verify your ICEPRO email address",
    html:    htmlWrapper("Verify Your Email", body),
  });
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

  await deliver({
    to:      user.email,
    toName:  user.firstName,
    subject: "Reset your ICEPRO password",
    html:    htmlWrapper("Reset Your Password", body),
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
