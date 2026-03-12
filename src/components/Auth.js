// src/components/Auth.js
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { CSS } from "../constants";
import { friendlyError } from "../helpers";
import { Lbl, Logo, OtpInput, Spin } from "./UI";

const C = {
  red: "#c8181e", redDark: "#9e1015", yellow: "#f5c518",
  text: "#1a0505", textLight: "#a07070", textMid: "#6b3333", border: "#f0dada",
};

// ── SIGN UP ───────────────────────────────────────────────────────────────────
export function SignupScreen({ onDone }) {
  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState({ firstName:"", lastName:"", username:"", mobile:"", email:"", secretCode:"", password:"", confirm:"" });
  const [otp, setOtp]         = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);

  const upd = (f, v) => { setForm(p => ({ ...p, [f]: v })); setErr(""); };

  function step1() {
    if (!form.firstName.trim())                      return setErr("Enter your first name.");
    if (!form.username.trim())                       return setErr("Enter a username.");
    if (!/^\S+@\S+\.\S+/.test(form.email))          return setErr("Enter a valid email.");
    if (form.mobile.length < 10)                     return setErr("Enter a valid 10-digit mobile number.");
    if (form.secretCode !== "VRUNDAVAN2024")         return setErr("Invalid secret code. Contact the owner.");
    setErr(""); setStep(2);
  }

  function step2() {
    if (otp.trim().length < 6) return setErr("Enter all 6 digits.");
    if (otp.trim() !== "123456") return setErr("Wrong OTP. Demo OTP is 123456.");
    setStep(3); setErr("");
  }

  async function step3() {
    if (form.password.length < 6)          return setErr("Password must be at least 6 characters.");
    if (form.password !== form.confirm)    return setErr("Passwords do not match.");
    setLoading(true); setErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(cred.user, { displayName: `${form.firstName} ${form.lastName}`.trim() });
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid, firstName: form.firstName, lastName: form.lastName,
        username: form.username.toLowerCase(), mobile: form.mobile,
        email: form.email.toLowerCase(), role: "staff", status: "active",
        createdAt: serverTimestamp(), remember,
      });
      onDone({ uid: cred.user.uid, name: `${form.firstName} ${form.lastName}`.trim(), email: form.email, role: "staff" });
    } catch (e) { setErr(friendlyError(e.code)); setLoading(false); }
  }

  const F = (label, field, type = "text", ph = "") => (
    <div>
      <Lbl>{label}</Lbl>
      <input className="inp" type={type} placeholder={ph} value={form[field]} onChange={e => upd(field, e.target.value)} />
    </div>
  );

  return (
    <div className="auth-wrap"><style>{CSS}</style>
      <div className="auth-left">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🍦</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: "#fff", fontWeight: 800 }}>Shree Vrundavan</div>
          <div style={{ fontSize: 16, color: C.yellow, fontWeight: 700, marginTop: 4 }}>Ice Cream</div>
          <div style={{ width: 50, height: 3, background: C.yellow, borderRadius: 2, margin: "14px auto" }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>Business Management Portal<br />Saurashtra · Gujarat</div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card su">
          {/* Step indicators */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24, alignItems: "center" }}>
            {["Details", "Verify", "Password"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: step > i + 1 ? C.red : step === i + 1 ? C.red : "#f0dada", color: step >= i + 1 ? "#fff" : C.textLight }}>
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: step === i + 1 ? C.red : C.textLight }}>{s}</div>
                {i < 2 && <div style={{ width: 20, height: 2, background: step > i + 1 ? C.red : "#f0dada", borderRadius: 1 }} />}
              </div>
            ))}
          </div>

          {/* Step 1 — Details */}
          {step === 1 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, color: C.redDark, marginBottom: 18 }}>Create Account</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {F("First Name", "firstName", "text", "Utsav")}
                {F("Last Name",  "lastName",  "text", "Tala")}
              </div>
              <div style={{ marginBottom: 12 }}>{F("Username", "username", "text", "utsav_vrundavan")}</div>
              <div style={{ marginBottom: 12 }}>{F("Email", "email", "email", "utsav@gmail.com")}</div>
              <div style={{ marginBottom: 12 }}>
                <Lbl>Mobile Number</Lbl>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ background: "#f9fafb", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.textMid, fontWeight: 700, flexShrink: 0 }}>+91</div>
                  <input className="inp" type="tel" maxLength={10} placeholder="9825011234"
                    value={form.mobile} onChange={e => upd("mobile", e.target.value.replace(/\D/g, ""))} />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <Lbl>Secret Code</Lbl>
                <input className="inp" type="password" placeholder="Owner-provided code"
                  value={form.secretCode} onChange={e => upd("secretCode", e.target.value)} />
              </div>
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 12 }} onClick={step1}>Send OTP →</button>
              <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: C.textLight }}>
                Have account?{" "}
                <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={() => onDone(null)}>Sign In</span>
              </div>
            </div>
          )}

          {/* Step 2 — OTP */}
          {step === 2 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, color: C.redDark, marginBottom: 6 }}>Verify Mobile</div>
              <div style={{ fontSize: 12, color: "#92400e", marginBottom: 16, background: "#fffbeb", padding: "8px 12px", borderRadius: 8, border: "1px solid #fde68a" }}>
                💡 Demo OTP: <b>123456</b>
              </div>
              <OtpInput value={otp} onChange={setOtp} />
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 12 }} onClick={step2}>Verify OTP →</button>
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8, fontSize: 12 }} onClick={() => setStep(1)}>← Back</button>
            </div>
          )}

          {/* Step 3 — Password (with eye toggle) */}
          {step === 3 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, color: C.redDark, marginBottom: 18 }}>Set Password</div>
              <div style={{ marginBottom: 12 }}>
                <Lbl>Password</Lbl>
                <div style={{ position: "relative" }}>
                  <input className="inp" type={showPass ? "text" : "password"} placeholder="Min 6 characters"
                    value={form.password} onChange={e => upd("password", e.target.value)} style={{ paddingRight: 44 }} />
                  <button onClick={() => setShowPass(s => !s)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <Lbl>Confirm Password</Lbl>
                <div style={{ position: "relative" }}>
                  <input className="inp" type={showConf ? "text" : "password"} placeholder="Re-enter password"
                    value={form.confirm} onChange={e => upd("confirm", e.target.value)} style={{ paddingRight: 44 }} />
                  <button onClick={() => setShowConf(s => !s)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>
                    {showConf ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "12px 14px", background: "#fff8f8", borderRadius: 10, border: `1px solid ${C.border}` }}>
                <label className="toggle">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Remember me for 1 month</div>
              </div>
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 12 }} onClick={step3} disabled={loading}>
                {loading ? <><Spin /> Creating...</> : "🎉 Create Account"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SIGN IN ───────────────────────────────────────────────────────────────────
export function SigninScreen({ onLogin, onSignup }) {
  const [email, setEmail]       = useState("");
  const [pass,  setPass]        = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function doLogin() {
    if (!email.trim()) return setErr("Enter your email.");
    if (!pass)         return setErr("Enter your password.");
    setLoading(true); setErr("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const p    = snap.exists() ? snap.data() : {};
      onLogin({
        uid:   cred.user.uid,
        name:  p.firstName ? `${p.firstName} ${p.lastName}`.trim() : cred.user.email,
        email: cred.user.email,
        role:  p.role || "staff",
      });
    } catch (e) { setErr(friendlyError(e.code)); setLoading(false); }
  }

  return (
    <div className="auth-wrap"><style>{CSS}</style>
      <div className="auth-left">
        <div style={{ textAlign: "center" }}>
          <img src="/logo.png" alt="logo" style={{ width: 200, filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.35))", marginBottom: 20 }} />
          <div style={{ width: 50, height: 3, background: C.yellow, borderRadius: 2, margin: "0 auto 18px" }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.9 }}>
            🏭 Manufacturing · Distribution<br />📦 Inventory · Billing<br />🚚 Delivery Management
          </div>
          <div style={{ marginTop: 28, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "1px" }}>SAURASHTRA · GUJARAT · INDIA</div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card su">
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <Logo size={50} showText={false} />
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 23, color: C.redDark, marginTop: 10 }}>Welcome Back</div>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 3 }}>Sign in to your account</div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Lbl>Email Address</Lbl>
            <input className="inp" type="email" placeholder="your@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && doLogin()} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <Lbl>Password</Lbl>
            <div style={{ position: "relative" }}>
              <input className="inp" type={showPass ? "text" : "password"} placeholder="Your password"
                value={pass} onChange={e => { setPass(e.target.value); setErr(""); }}
                onKeyDown={e => e.key === "Enter" && doLogin()} style={{ paddingRight: 44 }} />
              <button onClick={() => setShowPass(s => !s)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, padding: "12px 14px", background: "#fff8f8", borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="toggle">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Remember me</span>
            </div>
            <span style={{ fontSize: 12, color: C.red, cursor: "pointer", fontWeight: 700 }}>Forgot?</span>
          </div>

          {err && <div className="err-box">⚠️ {err}</div>}

          <button className="btn btn-red" style={{ width: "100%", padding: 13, fontSize: 15 }} onClick={doLogin} disabled={loading}>
            {loading ? <span className="pulse">Signing in...</span> : "Sign In →"}
          </button>

          <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: C.textLight }}>
            New staff?{" "}
            <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={onSignup}>Create Account</span>
          </div>
        </div>
      </div>
    </div>
  );
}
