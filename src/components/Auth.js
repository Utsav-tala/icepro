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
  teal: "#0d9488", tealDark: "#0f766e", pink: "#fce7f3",
  text: "#1a0505", textLight: "#a07070", textMid: "#6b3333", border: "#f0dada",
  cream: "#fff8f0", iceBg: "#fdf5f5",
};

const AUTH_CSS = `
.auth-ice-wrap{min-height:100vh;display:flex;background:linear-gradient(135deg,#fff8f0 0%,#fce7f3 50%,#e0f2fe 100%);}
.auth-ice-left{width:420px;background:linear-gradient(160deg,#9e1015 0%,#c8181e 45%,#d97706 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;flex-shrink:0;position:relative;overflow:hidden;}
.auth-ice-left::before{content:'';position:absolute;bottom:-60px;right:-60px;width:260px;height:260px;background:rgba(255,255,255,0.06);border-radius:50%;}
.auth-ice-left::after{content:'';position:absolute;top:-40px;left:-40px;width:200px;height:200px;background:rgba(245,197,24,0.1);border-radius:50%;}
.auth-ice-right{flex:1;display:flex;align-items:center;justify-content:center;padding:32px;}
.auth-ice-card{background:#fff;border-radius:24px;padding:40px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(200,24,30,0.1),0 4px 20px rgba(0,0,0,0.05);border:1px solid #fce7f3;}
.feat-list{list-style:none;padding:0;margin:0;}
.feat-list li{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,0.85);font-size:13px;padding:5px 0;font-weight:500;}
.feat-list li::before{content:'';width:6px;height:6px;border-radius:50%;background:#f5c518;flex-shrink:0;}
@media(max-width:768px){.auth-ice-left{display:none;}.auth-ice-card{padding:28px;}.auth-ice-wrap{background:#fff;}}
`;

// ── SIGN UP ───────────────────────────────────────────────────────────────────
export function SignupScreen({ onDone }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", mobile: "", email: "", secretCode: "", password: "", confirm: "" });
  const [otp, setOtp] = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const upd = (f, v) => { setForm(p => ({ ...p, [f]: v })); setErr(""); };

  async function step1() {
    if (!form.firstName.trim()) return setErr("Enter your first name.");
    if (!form.username.trim()) return setErr("Enter a username.");
    if (!/^\S+@\S+\.\S+/.test(form.email)) return setErr("Enter a valid email.");
    if (form.mobile.length < 10) return setErr("Enter a valid 10-digit mobile number.");

    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "settings", "signup"));
      if (!snap.exists() || !snap.data().secretCode) {
        setLoading(false);
        return setErr("Signup is unconfigured. Owner must set a secret code in Settings first.");
      }
      if (form.secretCode !== snap.data().secretCode) {
        setLoading(false);
        return setErr("Invalid secret code. Please contact the owner for the correct code.");
      }
      setErr(""); setStep(2);
    } catch (e) {
      console.error(e);
      // Common cause: Firestore rules don't allow unauthenticated read on settings/signup.
      // In Firebase Console → Firestore → Rules, add:
      //   match /settings/signup { allow read: if true; }
      if (e.code === "permission-denied" || e.message?.includes("permission")) {
        setErr("Access denied. Please ask the owner to enable signup in Settings.");
      } else {
        setErr("Could not connect. Please check your internet connection and try again.");
      }
    }
    setLoading(false);
  }

  function step2() {
    if (otp.trim().length < 6) return setErr("Enter all 6 digits.");
    if (otp.trim() !== "123456") return setErr("Wrong OTP. Demo OTP is 123456.");
    setStep(3); setErr("");
  }

  async function step3() {
    if (form.password.length < 6) return setErr("Password must be at least 6 characters.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
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
    <div className="auth-ice-wrap"><style>{CSS + AUTH_CSS}</style>
      <div className="auth-ice-left">
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 72, marginBottom: 8, lineHeight: 1 }}>🍦</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: "#fff", fontWeight: 800, letterSpacing: "-0.5px" }}>Vrundavan</div>
          <div style={{ fontSize: 14, color: C.yellow, fontWeight: 700, marginTop: 2, letterSpacing: "2px", textTransform: "uppercase" }}>Ice Cream</div>
          <div style={{ width: 40, height: 2, background: "rgba(245,197,24,0.6)", borderRadius: 2, margin: "16px auto" }} />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 20 }}>Business Management Portal</div>
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

      <div className="auth-ice-right">
        <div className="auth-ice-card su">
          {/* Step indicators */}
          <div style={{ display: "flex", gap: 6, marginBottom: 28, alignItems: "center" }}>
            {["Details", "Verify", "Password"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: step > i + 1 ? C.red : step === i + 1 ? C.red : "#f0dada", color: step >= i + 1 ? "#fff" : C.textLight, boxShadow: step === i + 1 ? "0 4px 12px rgba(200,24,30,0.35)" : "none" }}>
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: step === i + 1 ? C.red : C.textLight }}>{s}</div>
                {i < 2 && <div style={{ width: 24, height: 2, background: step > i + 1 ? C.red : "#f0dada", borderRadius: 1 }} />}
              </div>
            ))}
          </div>

          {/* Step 1 — Details */}
          {step === 1 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, marginBottom: 20, fontWeight: 800 }}>Create Account</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {F("First Name", "firstName", "text", "Utsav")}
                {F("Last Name", "lastName", "text", "Tala")}
              </div>
              <div style={{ marginBottom: 12 }}>{F("Username", "username", "text", "utsav_vrundavan")}</div>
              <div style={{ marginBottom: 12 }}>{F("Email", "email", "email", "utsav@gmail.com")}</div>
              <div style={{ marginBottom: 12 }}>
                <Lbl>Mobile Number</Lbl>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ background: "#fff8f0", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.textMid, fontWeight: 700, flexShrink: 0 }}>+91</div>
                  <input className="inp" type="tel" maxLength={10} placeholder="9825011234"
                    value={form.mobile} onChange={e => upd("mobile", e.target.value.replace(/\D/g, ""))} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <Lbl>Secret Code</Lbl>
                <input className="inp" type="password" placeholder="Owner-provided code"
                  value={form.secretCode} onChange={e => upd("secretCode", e.target.value)} />
                <div style={{ fontSize: 11, color: C.textLight, marginTop: 5 }}>Contact the business owner to get this code.</div>
              </div>
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 13 }} onClick={step1} disabled={loading}>
                {loading ? <><Spin /> Verifying...</> : "Continue →"}
              </button>
              <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.textLight }}>
                Already have an account?{" "}
                <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={() => onDone(null)}>Sign In</span>
              </div>
            </div>
          )}

          {/* Step 2 — OTP */}
          {step === 2 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, marginBottom: 8, fontWeight: 800 }}>Verify Mobile</div>
              <div style={{ fontSize: 12, color: "#92400e", marginBottom: 20, background: "#fffbeb", padding: "10px 14px", borderRadius: 10, border: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 8 }}>
                <span>💡</span><span>Demo OTP: <b>123456</b></span>
              </div>
              <OtpInput value={otp} onChange={setOtp} />
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 13 }} onClick={step2}>Verify OTP →</button>
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10, fontSize: 12 }} onClick={() => setStep(1)}>← Back</button>
            </div>
          )}

          {/* Step 3 — Password */}
          {step === 3 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, marginBottom: 20, fontWeight: 800 }}>Set Password</div>
              <div style={{ marginBottom: 14 }}>
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
              <div style={{ marginBottom: 20 }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "12px 14px", background: "#fff8f0", borderRadius: 12, border: `1px solid ${C.border}` }}>
                <label className="toggle">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Remember me for 1 month</div>
              </div>
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 13 }} onClick={step3} disabled={loading}>
                {loading ? <><Spin /> Creating Account...</> : "Create Account"}
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
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function doLogin() {
    if (!email.trim()) return setErr("Enter your email.");
    if (!pass) return setErr("Enter your password.");
    setLoading(true); setErr("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const p = snap.exists() ? snap.data() : {};
      onLogin({
        uid: cred.user.uid,
        name: p.firstName ? `${p.firstName} ${p.lastName}`.trim() : cred.user.email,
        email: cred.user.email,
        role: p.role || "staff",
      });
    } catch (e) { setErr(friendlyError(e.code)); setLoading(false); }
  }

  return (
    <div className="auth-ice-wrap"><style>{CSS + AUTH_CSS}</style>
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

      <div className="auth-ice-right">
        <div className="auth-ice-card su">
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#fff8f0,#fce7f3)", border: "2px solid #f0dada", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 14px", boxShadow: "0 4px 16px rgba(200,24,30,0.12)" }}>🍦</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: C.redDark, fontWeight: 800 }}>Welcome Back</div>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 4 }}>Sign in to manage Vrundavan Ice Cream</div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Lbl>Email Address</Lbl>
            <input className="inp" type="email" placeholder="your@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && doLogin()} />
          </div>

          <div style={{ marginBottom: 20 }}>
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, padding: "12px 16px", background: "#fff8f0", borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="toggle">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Remember me</span>
            </div>
            <span style={{ fontSize: 12, color: C.red, cursor: "pointer", fontWeight: 700 }}>Forgot password?</span>
          </div>

          {err && <div className="err-box">⚠️ {err}</div>}

          <button className="btn btn-red" style={{ width: "100%", padding: 14, fontSize: 15, borderRadius: 14, letterSpacing: "0.3px" }} onClick={doLogin} disabled={loading}>
            {loading ? <span className="pulse">Signing in...</span> : "Sign In →"}
          </button>

          <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: C.textLight }}>
            New staff member?{" "}
            <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={onSignup}>Create Account</span>
          </div>

          <div style={{ marginTop: 28, paddingTop: 18, borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
              {["Manufacturing", "Distribution", "Inventory", "Billing"].map(f => (
                <div key={f} style={{ fontSize: 10, color: C.textLight, fontWeight: 600, letterSpacing: "0.5px" }}>{f}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
