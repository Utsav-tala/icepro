// src/components/Auth.js
// Sign Up   (2-step: secret code → details; password is set from the emailed link.
//            With Google, the account is created outright — no password, no email step.)
// Sign In   (email/password + Google)
// Verify Email     (deep-link: /verify-email/:token — sets the initial password)
// Forgot Password  (request a reset link)
// Reset Password   (deep-link: /reset-password/:token)

import { useState, useEffect, useRef, useCallback } from "react";
import api from "../api";
import { CSS } from "../constants";
import { Lbl } from "./UI";

// ── Password policy ───────────────────────────────────────────────────────────
// Must stay in step with assertStrongPassword() in backend/services/auth.service.js.
// The server is the authority — this only exists so the user finds out before a round
// trip. If the two ever disagree, the server wins and the user sees its message.
const PASSWORD_HINT = "At least 8 characters, with a letter and a number";

function passwordProblem(password) {
  if (!password || password.length < 8)                   return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Password must contain at least one letter and one number.";
  return "";
}

const C = {
  red: "#c8181e", redDark: "#9e1015", yellow: "#f5c518",
  text: "#1a0505", textLight: "#a07070", textMid: "#6b3333", border: "#f0dada",
  cream: "#fff8f0", green: "#065f46", greenBg: "#d1fae5",
};

const AUTH_CSS = `
.auth-ice-wrap{min-height:100vh;display:flex;background:linear-gradient(135deg,#fff8f0 0%,#fce7f3 50%,#e0f2fe 100%);}
.auth-ice-left{width:420px;background:linear-gradient(160deg,#9e1015 0%,#c8181e 45%,#d97706 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;flex-shrink:0;position:relative;overflow:hidden;}
.auth-ice-left::before{content:'';position:absolute;bottom:-60px;right:-60px;width:260px;height:260px;background:rgba(255,255,255,0.06);border-radius:50%;}
.auth-ice-left::after{content:'';position:absolute;top:-40px;left:-40px;width:200px;height:200px;background:rgba(245,197,24,0.1);border-radius:50%;}
.auth-ice-right{flex:1;display:flex;align-items:center;justify-content:center;padding:32px;overflow-y:auto;}
.auth-ice-card{background:#fff;border-radius:24px;padding:40px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(200,24,30,0.1),0 4px 20px rgba(0,0,0,0.05);border:1px solid #fce7f3;}
.feat-list{list-style:none;padding:0;margin:0;}
.feat-list li{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,0.85);font-size:13px;padding:5px 0;font-weight:500;}
.feat-list li::before{content:'';width:6px;height:6px;border-radius:50%;background:#f5c518;flex-shrink:0;}
.field-err{color:#c8181e;font-size:11px;margin-top:4px;font-weight:600;}
.field-ok{color:#065f46;font-size:11px;margin-top:4px;font-weight:600;}
@media(max-width:768px){.auth-ice-left{display:none;}.auth-ice-card{padding:28px;}.auth-ice-wrap{background:#fff;}}
`;

// ── Shared: Left branding panel ───────────────────────────────────────────────
function LeftPanel() {
  return (
    <div className="auth-ice-left">
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <img
          src="/logo.png" alt="Vrundavan Ice Cream"
          style={{ width: 180, filter: "drop-shadow(0 6px 24px rgba(0,0,0,0.4))", marginBottom: 18 }}
          onError={e => { e.target.style.display = "none"; }}
        />
        <div style={{ width: 40, height: 2, background: "rgba(245,197,24,0.6)", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 16 }}>Business Management Portal</div>
        <ul className="feat-list">
          <li>Manufacturing &amp; Production</li>
          <li>Distribution &amp; Delivery</li>
          <li>Inventory Management</li>
          <li>Billing &amp; Invoicing</li>
          <li>Agency Tracking</li>
        </ul>
        <div style={{ marginTop: 32, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase" }}>KALAVAD · GUJARAT · INDIA</div>
      </div>
    </div>
  );
}

// ── Shared: Google GIS button loader ─────────────────────────────────────────
function useGoogleButton(btnRef, onCredential) {
  useEffect(() => {
    if (!process.env.REACT_APP_GOOGLE_CLIENT_ID) return;
    const init = () => {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        callback:  onCredential,
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline", size: "large", width: "100%",
        text: "signin_with", shape: "rectangular", logo_alignment: "left",
      });
    };
    if (window.google) { init(); }
    else {
      // Don't add duplicate scripts
      if (!document.getElementById("google-gsi-script")) {
        const s = document.createElement("script");
        s.id = "google-gsi-script";
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true; s.defer = true;
        s.onload = init;
        document.head.appendChild(s);
      } else {
        // Script tag already added, wait for it
        const interval = setInterval(() => {
          if (window.google) { clearInterval(interval); init(); }
        }, 200);
      }
    }
  }, [btnRef, onCredential]);
}

// ── Shared: divider ───────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
    <div style={{ flex: 1, height: 1, background: C.border }} />
    <span style={{ fontSize: 11, color: C.textLight, fontWeight: 600, whiteSpace: "nowrap" }}>or continue with</span>
    <div style={{ flex: 1, height: 1, background: C.border }} />
  </div>
);

// ── SIGN UP — 2 steps: secret code → details ─────────────────────────────────
// The password is NOT set here. A local signup emails a link and the password is chosen
// there (/verify-email/:token), which is what proves the mailbox belongs to them.
//
// With Google there is nothing to prove — Google has already verified the address — so
// the account is created outright with no password and no email round-trip, and the user
// lands straight in the dashboard.
export function SignupScreen({ onDone }) {
  const [step, setStep] = useState(1); // 1 = secret code, 2 = details

  // Step 1
  const [secretCode, setSecretCode] = useState("");

  // Step 2 — form values
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", email: "", mobile: "" });
  // Step 2 — field-level validation errors
  const [fieldErrs, setFieldErrs] = useState({});

  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Held from the Google button so the account can be created WITH Google on submit,
  // rather than merely autofilling the form and then making them invent a password.
  // The server rejects a token older than 10 minutes, so this is not a long-lived secret.
  const [googleToken, setGoogleToken] = useState("");

  const googleBtnRef = useRef(null);

  // ── Google on signup: autofill now, create the account on submit ─────────
  const handleGoogleForSignup = useCallback(async (response) => {
    setGoogleLoading(true); setErr("");
    try {
      const res = await api.post("/auth/google-profile", { idToken: response.credential });
      if (res.success) {
        const p = res.data;
        setForm(f => ({
          ...f,
          firstName: p.firstName || f.firstName,
          lastName:  p.lastName  || f.lastName,
          email:     p.email     || f.email,
        }));
        setGoogleToken(response.credential);
        if (step === 1) setStep(2);
        setErr("");
      }
    } catch (e) {
      setErr(e.message || "Could not load Google profile.");
    }
    setGoogleLoading(false);
  }, [step]);

  useGoogleButton(googleBtnRef, handleGoogleForSignup);

  // Signs the user straight in — Google accounts have no password and skip verification.
  const finishGoogleSignup = (u, token) => {
    localStorage.setItem("token", token);
    onDone({
      uid:             u._id,
      name:            u.firstName ? `${u.firstName} ${u.lastName}`.trim() : u.email,
      email:           u.email,
      role:            u.role || "manager",
      isEmailVerified: u.isEmailVerified,
      authProvider:    u.authProvider,
    });
  };

  // ── Step 1: Validate secret code ─────────────────────────────────────────
  async function doStep1() {
    if (!secretCode.trim()) return setErr("Enter the signup secret code.");
    setLoading(true); setErr("");
    try {
      // Validate secret code server-side by pre-calling register with partial data
      // Actually we validate secret on the final register call, but we can do a lightweight
      // check via a dedicated endpoint or just proceed (validated server-side on submit).
      // For UX we call the backend to verify the code early.
      const res = await api.post("/auth/check-secret", { secretCode: secretCode.trim() });
      if (res.success && res.data.valid) {
        setStep(2);
      } else {
        setErr("Invalid secret code. Please contact your administrator.");
      }
    } catch (e) {
      setErr(e.message || "Invalid secret code. Please contact your administrator.");
    }
    setLoading(false);
  }

  // ── Live check: email on blur ─────────────────────────────────────────────
  async function checkEmailBlur() {
    const email = form.email.trim();
    if (!email || !/^\S+@\S+\.\S+/.test(email)) return;
    try {
      const res = await api.get(`/auth/check-email?email=${encodeURIComponent(email)}`);
      if (res.success && !res.data.available) {
        setFieldErrs(f => ({ ...f, email: "This email is already registered. Sign in instead." }));
      } else {
        setFieldErrs(f => ({ ...f, email: "" }));
      }
    } catch { /* ignore */ }
  }

  // ── Live check: username on blur ──────────────────────────────────────────
  async function checkUsernameBlur() {
    const username = form.username.trim();
    if (!username || username.length < 3) return;
    try {
      const res = await api.get(`/auth/check-username?username=${encodeURIComponent(username)}`);
      if (res.success && !res.data.available) {
        setFieldErrs(f => ({ ...f, username: "Username is already taken. Choose another." }));
      } else {
        setFieldErrs(f => ({ ...f, username: "" }));
      }
    } catch { /* ignore */ }
  }

  // ── Step 2: Validate details ──────────────────────────────────────────────
  // ── Step 2: Validate details & Submit ─────────────────────────────────────
  async function doStep2() {
    setErr("");
    if (!form.firstName.trim())                      return setErr("Enter your first name.");
    if (!form.username.trim() || form.username.length < 3) return setErr("Username must be at least 3 characters.");
    if (!/^\S+@\S+\.\S+/.test(form.email))           return setErr("Enter a valid email address.");
    if (!/^\d{10}$/.test(form.mobile.trim()))         return setErr("Mobile number must be exactly 10 digits.");
    if (fieldErrs.email)                              return setErr(fieldErrs.email);
    if (fieldErrs.username)                           return setErr(fieldErrs.username);
    
    setLoading(true); setErr("");
    try {
      // ── Google signup: create the account and sign in, right now ──────────
      // No password to invent and no verification email — Google has already proved the
      // user owns this mailbox, which is the only thing that email was establishing.
      if (googleToken) {
        const res = await api.post("/auth/google-register", {
          secretCode: secretCode.trim(),
          idToken:    googleToken,
          username:   form.username.trim(),
          mobile:     form.mobile.trim(),
        });
        if (res.success) {
          finishGoogleSignup(res.data.user, res.data.token);
          return;
        }
      }

      // ── Local signup: account is created without a password; the emailed link sets it.
      const res = await api.post("/auth/register", {
        secretCode: secretCode.trim(),
        firstName:  form.firstName.trim(),
        lastName:   form.lastName.trim(),
        username:   form.username.trim(),
        email:      form.email.trim(),
        mobile:     form.mobile.trim(),
      });
      if (res.success) {
        alert(res.message || "Registration successful! Please check your email to verify your account.");
        onDone(null); // Return to sign-in screen
      }
    } catch (e) {
      // A stale Google token (>10 min old) can't be reused — send them back to the button
      // instead of showing a cryptic error.
      if (googleToken && /expired|invalid google/i.test(e.message || "")) {
        setGoogleToken("");
        setErr("Your Google sign-in expired. Please click the Google button again.");
      } else if (e.errors && Array.isArray(e.errors) && e.errors.length > 0) {
        setErr(e.errors[0].message);
      } else {
        setErr(e.message || "Registration failed. Please try again.");
      }
    }
    setLoading(false);
  }

  // ── Step indicator ────────────────────────────────────────────────────────
  const StepDot = ({ n, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 11, fontWeight: 800,
        background: step > n ? C.red : step === n ? C.red : "#f0dada",
        color: step >= n ? "#fff" : C.textLight,
        boxShadow: step === n ? "0 4px 12px rgba(200,24,30,0.35)" : "none",
      }}>{step > n ? "✓" : n}</div>
      <span style={{ fontSize: 11, fontWeight: step === n ? 700 : 500, color: step === n ? C.redDark : C.textLight }}>{label}</span>
    </div>
  );

  const upd = (f, v) => { setForm(p => ({ ...p, [f]: v })); setErr(""); };

  return (
    <div className="auth-ice-wrap"><style>{CSS + AUTH_CSS}</style>
      <LeftPanel />
      <div className="auth-ice-right">
        <div className="auth-ice-card">
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>🍦</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, fontWeight: 800 }}>Create Account</div>
            <div style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>Join Vrundavan Ice Cream ERP</div>
          </div>

          {/* Step indicators */}
          <div style={{ display: "flex", gap: 16, marginBottom: 28, justifyContent: "center", alignItems: "center" }}>
            <StepDot n={1} label="Secret" />
            <div style={{ width: 24, height: 1, background: C.border }} />
            <StepDot n={2} label="Details" />
          </div>

          {/* ── STEP 1: Secret Code ─────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ background: "#fff8f0", border: "1px solid #f0dada", borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 13, color: C.textMid }}>
                🔐 This portal is invite-only. Ask your administrator for the signup secret code.
              </div>
              <div style={{ marginBottom: 16 }}>
                <Lbl>Secret Code</Lbl>
                <input className="inp" type="password" placeholder="Enter the secret code"
                  value={secretCode} onChange={e => { setSecretCode(e.target.value); setErr(""); }}
                  onKeyDown={e => e.key === "Enter" && doStep1()} autoFocus />
              </div>
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 13, fontSize: 14, borderRadius: 12 }}
                onClick={doStep1} disabled={loading}>
                {loading ? "Verifying..." : "Continue →"}
              </button>

              {/* Google autofill option */}
              {process.env.REACT_APP_GOOGLE_CLIENT_ID && (
                <>
                  <Divider />
                  <div style={{ fontSize: 12, color: C.textLight, textAlign: "center", marginBottom: 10 }}>
                    Use Google to autofill your name and email (you'll still need the secret code)
                  </div>
                  {googleLoading
                    ? <div style={{ textAlign: "center", padding: "8px 0", color: C.textLight, fontSize: 13 }}>⏳ Loading Google profile...</div>
                    : <div ref={googleBtnRef} style={{ width: "100%" }} />
                  }
                </>
              )}
            </div>
          )}

          {/* ── STEP 2: Details Form ────────────────────────── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Google mode — say plainly what will happen, because it differs a lot
                  from the email route (no password, no inbox trip, signed in at once). */}
              {googleToken && (
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: C.green }}>
                  <strong>✓ Connected to Google</strong> — no password needed. Just pick a
                  username and add your mobile number, and you're in.
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Lbl>First Name *</Lbl>
                  <input className="inp" placeholder="First name" value={form.firstName}
                    onChange={e => upd("firstName", e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <Lbl>Last Name</Lbl>
                  <input className="inp" placeholder="Last name" value={form.lastName}
                    onChange={e => upd("lastName", e.target.value)} />
                </div>
              </div>

              <div>
                <Lbl>Username *</Lbl>
                <input className="inp" placeholder="your_username" value={form.username}
                  onChange={e => { upd("username", e.target.value); setFieldErrs(f => ({ ...f, username: "" })); }}
                  onBlur={checkUsernameBlur} />
                {fieldErrs.username && <div className="field-err">⚠️ {fieldErrs.username}</div>}
                {!fieldErrs.username && form.username.length >= 3 && <div className="field-ok">✓ Username looks good</div>}
              </div>

              <div>
                <Lbl>Email Address *</Lbl>
                {/* Locked in Google mode: the address is whatever Google verified. Letting it
                    be edited would mean registering an address nobody has proved they own. */}
                <input className="inp" type="email" placeholder="your@email.com" value={form.email}
                  readOnly={!!googleToken}
                  style={googleToken ? { background: "#f7f7f7", cursor: "not-allowed" } : undefined}
                  onChange={e => { upd("email", e.target.value); setFieldErrs(f => ({ ...f, email: "" })); }}
                  onBlur={checkEmailBlur} />
                {googleToken
                  ? <div className="field-ok">✓ Verified by Google</div>
                  : <>
                      {fieldErrs.email && <div className="field-err">⚠️ {fieldErrs.email}</div>}
                      {!fieldErrs.email && /^\S+@\S+\.\S+/.test(form.email) && <div className="field-ok">✓ Email looks good</div>}
                    </>
                }
              </div>

              <div>
                <Lbl>Mobile Number *</Lbl>
                <input className="inp" type="tel" placeholder="10-digit mobile number" value={form.mobile}
                  onChange={e => upd("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                {form.mobile && form.mobile.length !== 10 && <div className="field-err">Must be exactly 10 digits</div>}
              </div>

              {err && <div className="err-box">⚠️ {err}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="btn" style={{ flex: 1, padding: 12, fontSize: 13, borderRadius: 12, background: "#f0dada", color: C.textMid, border: "none", cursor: "pointer", fontWeight: 700 }}
                  onClick={() => { setStep(1); setErr(""); }}>
                  ← Back
                </button>
                <button className="btn btn-red" style={{ flex: 2, padding: 12, fontSize: 14, borderRadius: 12 }}
                  onClick={doStep2} disabled={loading}>
                  {loading
                    ? "Creating Account..."
                    : googleToken ? "Create Account with Google 🎉" : "Create Account 🎉"}
                </button>
              </div>
            </div>
          )}

          {/* Back to sign in */}
          <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: C.textLight }}>
            Already have an account?{" "}
            <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={onDone}>Sign In</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SIGN IN ───────────────────────────────────────────────────────────────────
export function SigninScreen({ onLogin, onSignup, onForgot }) {
  const [email, setEmail]       = useState("");
  const [pass, setPass]         = useState("");
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [noAccountMsg, setNoAccountMsg]   = useState(""); // shown after Google 404

  const googleBtnRef = useRef(null);

  // ── Google Sign-In: login only ────────────────────────────────────────────
  const handleGoogleSignIn = useCallback(async (response) => {
    setGoogleLoading(true); setErr(""); setNoAccountMsg("");
    try {
      const res = await api.post("/auth/google", { idToken: response.credential });
      if (res.success) {
        localStorage.setItem("token", res.data.token);
        const u = res.data.user;
        onLogin({
          uid:             u._id,
          name:            u.firstName ? `${u.firstName} ${u.lastName}`.trim() : u.email,
          email:           u.email,
          role:            u.role || "manager",
          isEmailVerified: u.isEmailVerified,
          authProvider:    u.authProvider,
        });
      }
    } catch (e) {
      if (e.status === 404 || (e.message && e.message.toLowerCase().includes("no account"))) {
        setNoAccountMsg("No account found for this Google account.");
      } else {
        setErr(e.message || "Google Sign-In failed. Please try again.");
      }
    }
    setGoogleLoading(false);
  }, [onLogin]);

  useGoogleButton(googleBtnRef, handleGoogleSignIn);

  async function doLogin() {
    if (!email.trim()) return setErr("Enter your email.");
    if (!pass)         return setErr("Enter your password.");
    setLoading(true); setErr(""); setNoAccountMsg("");
    try {
      const res = await api.post("/auth/login", { email: email.trim(), password: pass });
      if (res.success) {
        localStorage.setItem("token", res.data.token);
        const u = res.data.user;
        onLogin({
          uid:             u._id,
          name:            u.firstName ? `${u.firstName} ${u.lastName}`.trim() : u.email,
          email:           u.email,
          role:            u.role || "manager",
          isEmailVerified: u.isEmailVerified,
          authProvider:    u.authProvider,
        });
      }
    } catch (e) {
      if (e.errors && Array.isArray(e.errors) && e.errors.length > 0) {
        setErr(e.errors[0].message);
      } else {
        setErr(e.message || "Login failed. Please try again.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="auth-ice-wrap"><style>{CSS + AUTH_CSS}</style>
      <LeftPanel />
      <div className="auth-ice-right">
        <div className="auth-ice-card">
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#fff8f0,#fce7f3)", border: "2px solid #f0dada", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 14px", boxShadow: "0 4px 16px rgba(200,24,30,0.12)" }}>🍦</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: C.redDark, fontWeight: 800 }}>Welcome Back</div>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 4 }}>Sign in to manage Vrundavan Ice Cream</div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Lbl>Email Address</Lbl>
            <input className="inp" id="signin-email" type="email" placeholder="your@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setErr(""); setNoAccountMsg(""); }}
              onKeyDown={e => e.key === "Enter" && doLogin()} />
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <Lbl>Password</Lbl>
              <span style={{ fontSize: 12, color: C.red, fontWeight: 700, cursor: "pointer" }}
                onClick={onForgot}>
                Forgot password?
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <input className="inp" id="signin-password" type={showPass ? "text" : "password"} placeholder="Your password"
                value={pass} onChange={e => { setPass(e.target.value); setErr(""); }}
                onKeyDown={e => e.key === "Enter" && doLogin()} style={{ paddingRight: 44 }} />
              <button onClick={() => setShowPass(s => !s)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {err && <div className="err-box">⚠️ {err}</div>}

          {/* No-account message from Google sign-in failure */}
          {noAccountMsg && (
            <div style={{ background: "#fff8f0", border: "1px solid #f0dada", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: C.textMid }}>
              ⚠️ {noAccountMsg}{" "}
              <span style={{ color: C.red, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={onSignup}>
                Create an account
              </span>
            </div>
          )}

          <button className="btn btn-red" id="signin-btn"
            style={{ width: "100%", padding: 14, fontSize: 15, borderRadius: 14, letterSpacing: "0.3px" }}
            onClick={doLogin} disabled={loading || googleLoading}>
            {loading ? <span className="pulse">Signing in...</span> : "Sign In →"}
          </button>

          {/* Google Sign-In */}
          {process.env.REACT_APP_GOOGLE_CLIENT_ID && (
            <div style={{ marginTop: 16 }}>
              <Divider />
              {googleLoading
                ? <div style={{ textAlign: "center", padding: "10px 0", color: C.textLight, fontSize: 13 }}>⏳ Signing in with Google...</div>
                : <div ref={googleBtnRef} id="google-signin-btn" style={{ width: "100%" }} />
              }
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: C.textLight }}>
            New team member?{" "}
            <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={onSignup}>Create Account</span>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── VERIFY EMAIL & SET PASSWORD SCREEN ─────────────────────────────────────────
export function VerifyEmailScreen({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  
  const [status, setStatus]     = useState("idle"); // idle, loading, success, error
  const [message, setMessage]   = useState("");

  async function submitPassword() {
    const problem = passwordProblem(password);
    if (problem)              return setMessage(problem);
    if (password !== confirm) return setMessage("Passwords do not match.");

    setStatus("loading");
    setMessage("");
    
    try {
      const res = await api.post(`/auth/verify-and-set-password/${token}`, { password });
      if (res.success) {
        setStatus("success");
        setMessage(res.message || "Email verified and password set successfully!");
        
        // Log the user in
        localStorage.setItem("token", res.data.token);
        const u = res.data.user;
        
        // Give them a moment to see the success message
        setTimeout(() => {
          onDone({
            uid:             u._id,
            name:            `${u.firstName} ${u.lastName}`.trim(),
            email:           u.email,
            role:            u.role,
            isEmailVerified: u.isEmailVerified,
          });
        }, 1500);
      } else {
        setStatus("error");
        setMessage(res.message || "Verification failed.");
      }
    } catch (e) {
      setStatus("error");
      setMessage(e.message || "This verification link is invalid or has expired.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#fff8f0,#fce7f3)", padding: 24 }}>
      <style>{CSS}</style>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px", maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(200,24,30,0.1)" }}>
        
        {/* State: Idle / Inputting Password */}
        {(status === "idle" || status === "error") && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, fontWeight: 800 }}>Almost Done!</div>
              <div style={{ color: C.textLight, fontSize: 14, marginTop: 6 }}>Set a secure password to activate your account.</div>
            </div>

            {status === "error" && (
              <div style={{ background: "#fef2f2", color: C.redDark, padding: "12px", borderRadius: 8, fontSize: 13, marginBottom: 20, textAlign: "center", border: "1px solid #fecaca" }}>
                ⚠️ {message}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <Lbl>New Password</Lbl>
              <div style={{ position: "relative" }}>
                <input className="inp" type={showPass ? "text" : "password"} placeholder={PASSWORD_HINT}
                  value={password} onChange={e => { setPassword(e.target.value); setMessage(""); }}
                  style={{ paddingRight: 44 }} />
                <button onClick={() => setShowPass(s => !s)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Lbl>Confirm Password</Lbl>
              <div style={{ position: "relative" }}>
                <input className="inp" type={showConf ? "text" : "password"} placeholder="Repeat your password"
                  value={confirm} onChange={e => { setConfirm(e.target.value); setMessage(""); }}
                  onKeyDown={e => e.key === "Enter" && submitPassword()}
                  style={{ paddingRight: 44 }} />
                <button onClick={() => setShowConf(s => !s)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>
                  {showConf ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" style={{ flex: 1, padding: 13, fontSize: 14, borderRadius: 12, background: "#f0dada", color: C.textMid, border: "none", cursor: "pointer", fontWeight: 700 }}
                onClick={() => window.location.href = "/"}>
                Cancel
              </button>
              <button className="btn btn-red" style={{ flex: 2, padding: 13, fontSize: 14, borderRadius: 12 }}
                onClick={submitPassword}>
                Activate Account 🎉
              </button>
            </div>
          </div>
        )}

        {/* State: Loading */}
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, fontWeight: 800, marginBottom: 10 }}>Verifying...</div>
            <div style={{ color: C.textLight, fontSize: 14 }}>Please wait a moment.</div>
          </div>
        )}

        {/* State: Success */}
        {status === "success" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.green, fontWeight: 800, marginBottom: 10 }}>Account Activated!</div>
            <div style={{ color: C.textLight, fontSize: 14 }}>{message} Logging you in...</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared shell for the small standalone auth screens ───────────────────────
function AuthCard({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#fff8f0,#fce7f3)", padding: 24 }}>
      <style>{CSS}</style>
      <div style={{ background: "#fff", borderRadius: 20, padding: 40, maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(200,24,30,0.1)" }}>
        {children}
      </div>
    </div>
  );
}

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
export function ForgotPasswordScreen({ onBack }) {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  async function submit() {
    if (!/^\S+@\S+\.\S+/.test(email.trim())) return setErr("Enter a valid email address.");
    setLoading(true); setErr("");
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      // The server answers identically whether or not the account exists — telling the
      // user "no such account" would let anyone probe which emails are registered. So the
      // confirmation below is deliberately neutral.
      setSent(true);
    } catch (e) {
      setErr(e.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  if (sent) return (
    <AuthCard>
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📬</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, fontWeight: 800, marginBottom: 10 }}>
          Check your inbox
        </div>
        <div style={{ color: C.textMid, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          If an account exists for <strong>{email.trim()}</strong>, we've sent a password
          reset link to it. The link expires in <strong>1 hour</strong>.
        </div>
        <button className="btn btn-red" style={{ width: "100%", padding: 13, borderRadius: 12 }} onClick={onBack}>
          Back to Sign In
        </button>
      </div>
    </AuthCard>
  );

  return (
    <AuthCard>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, fontWeight: 800 }}>Forgot your password?</div>
        <div style={{ color: C.textLight, fontSize: 14, marginTop: 6 }}>
          Enter your email and we'll send you a link to set a new one.
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Lbl>Email Address</Lbl>
        <input className="inp" type="email" placeholder="your@email.com" value={email}
          onChange={e => { setEmail(e.target.value); setErr(""); }}
          onKeyDown={e => e.key === "Enter" && submit()} />
      </div>

      {err && <div className="err-box">⚠️ {err}</div>}

      <button className="btn btn-red" style={{ width: "100%", padding: 13, borderRadius: 12, fontSize: 15 }}
        onClick={submit} disabled={loading}>
        {loading ? <span className="pulse">Sending...</span> : "Send Reset Link"}
      </button>

      <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: C.textLight }}>
        Remembered it?{" "}
        <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={onBack}>Back to Sign In</span>
      </div>
    </AuthCard>
  );
}

// ── RESET PASSWORD (deep-link: /reset-password/:token) ───────────────────────
export function ResetPasswordScreen({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [status,   setStatus]   = useState("idle");   // idle | loading | success | error
  const [message,  setMessage]  = useState("");

  async function submit() {
    const problem = passwordProblem(password);
    if (problem)              return setMessage(problem);
    if (password !== confirm) return setMessage("Passwords do not match.");

    setStatus("loading"); setMessage("");
    try {
      const res = await api.post(`/auth/reset-password/${token}`, { password });
      setStatus("success");
      setMessage(res.message || "Password reset successfully.");
      setTimeout(onDone, 2200);
    } catch (e) {
      setStatus("error");
      setMessage(e.message || "This reset link is invalid or has expired.");
    }
  }

  if (status === "success") return (
    <AuthCard>
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.green, fontWeight: 800, marginBottom: 10 }}>
          Password Reset
        </div>
        <div style={{ color: C.textMid, fontSize: 14, lineHeight: 1.6 }}>
          You've been signed out on every device. Taking you to sign in…
        </div>
      </div>
    </AuthCard>
  );

  return (
    <AuthCard>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, fontWeight: 800 }}>Set a new password</div>
        <div style={{ color: C.textLight, fontSize: 14, marginTop: 6 }}>{PASSWORD_HINT}.</div>
      </div>

      {status === "error" && (
        <div style={{ background: "#fef2f2", color: C.redDark, padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 18, textAlign: "center", border: "1px solid #fecaca" }}>
          ⚠️ {message}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Lbl>New Password</Lbl>
        <div style={{ position: "relative" }}>
          <input className="inp" type={showPass ? "text" : "password"} placeholder={PASSWORD_HINT}
            value={password} onChange={e => { setPassword(e.target.value); setMessage(""); }}
            style={{ paddingRight: 44 }} />
          <button onClick={() => setShowPass(s => !s)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>
            {showPass ? "🙈" : "👁️"}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <Lbl>Confirm Password</Lbl>
        <input className="inp" type={showPass ? "text" : "password"} placeholder="Repeat your password"
          value={confirm} onChange={e => { setConfirm(e.target.value); setMessage(""); }}
          onKeyDown={e => e.key === "Enter" && submit()} />
      </div>

      <button className="btn btn-red" style={{ width: "100%", padding: 13, borderRadius: 12, fontSize: 15 }}
        onClick={submit} disabled={status === "loading"}>
        {status === "loading" ? <span className="pulse">Resetting...</span> : "Reset Password"}
      </button>

      <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: C.textLight }}>
        Resetting your password signs you out everywhere.
      </div>
    </AuthCard>
  );
}
