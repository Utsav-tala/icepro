import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const LOGO_URL = "/logo.png";

const C = {
  red:        "#c8181e",
  redDark:    "#9e1015",
  redLight:   "#f03035",
  yellow:     "#f5c518",
  yellowDark: "#d4a012",
  white:      "#ffffff",
  sidebar:    "#110606",
  text:       "#1a0505",
  textMid:    "#6b3333",
  textLight:  "#a07070",
  border:     "#f0dada",
  cardBg:     "#ffffff",
  pageBg:     "#fdf5f5",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Nunito',sans-serif;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:#f0dada;}
::-webkit-scrollbar-thumb{background:#c8181e;border-radius:4px;}

.sidebar{width:230px;background:${C.sidebar};display:flex;flex-direction:column;gap:4px;padding:20px 10px;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;}
.brand-name{font-family:'Playfair Display',serif;font-size:15px;color:${C.yellow};line-height:1.2;}
.brand-sub{font-size:9px;color:#6b2a2a;letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
.ni{cursor:pointer;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;transition:all 0.2s;color:#9a5555;}
.ni:hover{background:#2a0e0e;color:#f5c518;}
.na{background:linear-gradient(135deg,#7a0c10,#c8181e)!important;color:#fff!important;box-shadow:0 4px 12px rgba(200,24,30,0.4);}
.nav-badge{background:${C.yellow};color:${C.redDark};border-radius:20px;font-size:10px;font-weight:800;padding:1px 7px;margin-left:auto;}

.card{background:${C.cardBg};border:1px solid ${C.border};border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(200,24,30,0.06);}
.sc{background:${C.cardBg};border:1px solid ${C.border};border-radius:14px;padding:20px;transition:transform 0.2s,box-shadow 0.2s;box-shadow:0 2px 8px rgba(200,24,30,0.06);}
.sc:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(200,24,30,0.12);}

.badge{padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.5px;display:inline-block;text-transform:uppercase;}
.ba{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;}
.bo{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
.bp{background:#fffbeb;color:#92400e;border:1px solid #fde68a;}
.bd{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;}

.btn{padding:9px 20px;border-radius:10px;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;transition:all 0.2s;}
.btn-red{background:linear-gradient(135deg,${C.red},${C.redDark});color:white;box-shadow:0 4px 12px rgba(200,24,30,0.3);}
.btn-red:hover{background:linear-gradient(135deg,${C.redLight},${C.red});transform:translateY(-1px);}
.btn-red:disabled{opacity:0.6;cursor:not-allowed;transform:none;}
.btn-yellow{background:linear-gradient(135deg,${C.yellow},${C.yellowDark});color:${C.redDark};box-shadow:0 4px 12px rgba(245,197,24,0.3);}
.btn-yellow:hover{transform:translateY(-1px);}
.btn-ghost{background:#fff5f5;color:${C.textMid};border:1px solid ${C.border};}
.btn-ghost:hover{background:#fef2f2;color:${C.red};}
.btn-danger{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
.btn-danger:hover{background:#fee2e2;}

.inp{background:#fff;border:1.5px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-family:'Nunito',sans-serif;font-size:13px;outline:none;transition:border-color 0.2s,box-shadow 0.2s;width:100%;}
.inp:focus{border-color:${C.red};box-shadow:0 0 0 3px rgba(200,24,30,0.08);}
.sel{background:#fff;border:1.5px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-family:'Nunito',sans-serif;font-size:13px;outline:none;width:100%;cursor:pointer;}
.sel:focus{border-color:${C.red};}
.lbl{font-size:11px;color:${C.textMid};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;display:block;}

.tr{padding:12px 16px;border-bottom:1px solid #fdf0f0;transition:background 0.15s;}
.tr:hover{background:#fff8f8;}
.tr:last-child{border-bottom:none;}

.mo{position:fixed;inset:0;background:rgba(26,5,5,0.75);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(6px);}
.mbox{background:#fff;border-radius:20px;padding:28px;width:560px;max-width:96vw;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(200,24,30,0.2);}

@keyframes fi{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
.fi{animation:fi 0.3s ease;}
@keyframes su{from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);}}
.su{animation:su 0.35s cubic-bezier(.22,1,.36,1);}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
.pulse{animation:pulse 2s infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.spin{animation:spin 0.7s linear infinite;display:inline-block;}

.auth-wrap{min-height:100vh;display:flex;background:${C.pageBg};}
.auth-left{width:420px;background:linear-gradient(160deg,${C.redDark} 0%,${C.red} 50%,#e03535 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;flex-shrink:0;}
.auth-right{flex:1;display:flex;align-items:center;justify-content:center;padding:32px;}
.auth-card{background:#fff;border-radius:20px;padding:36px;width:100%;max-width:460px;box-shadow:0 8px 32px rgba(200,24,30,0.1);}

.toggle{position:relative;width:42px;height:24px;flex-shrink:0;}
.toggle input{opacity:0;width:0;height:0;}
.toggle-slider{position:absolute;inset:0;background:#e5e7eb;border-radius:24px;cursor:pointer;transition:0.3s;}
.toggle-slider:before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2);}
.toggle input:checked+.toggle-slider{background:${C.red};}
.toggle input:checked+.toggle-slider:before{transform:translateX(18px);}

.otp-wrap{display:flex;gap:10px;justify-content:center;margin:16px 0;}
.otp-inp{width:48px;height:52px;text-align:center;font-size:20px;font-weight:800;border:2px solid ${C.border};border-radius:12px;outline:none;font-family:'Nunito',sans-serif;color:${C.redDark};transition:border-color 0.2s;}
.otp-inp:focus{border-color:${C.red};box-shadow:0 0 0 3px rgba(200,24,30,0.1);}

.err-box{font-size:12px;color:${C.red};margin-bottom:12px;background:#fef2f2;padding:10px 12px;border-radius:8px;border-left:3px solid ${C.red};}
.ok-box{font-size:12px;color:#065f46;margin-bottom:12px;background:#ecfdf5;padding:10px 12px;border-radius:8px;border-left:3px solid #10b981;}

.loading-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:${C.pageBg};}
.empty-state{text-align:center;padding:48px 20px;color:${C.textLight};}
.empty-state .icon{font-size:48px;margin-bottom:12px;}
.empty-state p{font-size:14px;margin-bottom:16px;}

@media(max-width:768px){
  .sidebar{width:100%;height:auto;flex-direction:row;padding:10px;overflow-x:auto;position:fixed;bottom:0;top:auto;z-index:100;border-top:2px solid #2a0e0e;}
  .ni{flex-direction:column;gap:3px;font-size:10px;padding:8px 12px;min-width:60px;text-align:center;}
  .brand-logo-wrap,.sidebar-footer{display:none;}
  .main-content{padding:16px 14px 80px!important;}
  .auth-left{display:none;}
  .auth-card{padding:24px;}
  .stat-grid{grid-template-columns:1fr 1fr!important;}
  .hide-mobile{display:none!important;}
  .page-title{font-size:18px!important;}
  .mbox{padding:20px;}
}
@media(max-width:480px){
  .stat-grid{grid-template-columns:1fr!important;}
}
`;

// ─── HELPERS ────────────────────────────────────────────────────────────────

function Lbl({ children }) {
  return <label className="lbl">{children}</label>;
}
function Tag({ children, cls }) {
  return <span className={`badge ${cls}`}>{children}</span>;
}
function SC({ label, value, sub, icon, color, accent }) {
  return (
    <div className="sc" style={{ borderTop: `3px solid ${accent || C.red}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: C.textLight, marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: color || C.text }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 28, opacity: 0.85 }}>{icon}</div>
      </div>
    </div>
  );
}
function Logo({ size = 48, showText = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src={LOGO_URL} alt="logo"
        style={{ height: size, width: "auto", objectFit: "contain", filter: "drop-shadow(0 2px 6px rgba(200,24,30,0.3))" }}
        onError={e => { e.target.style.display = "none"; }} />
      {showText && (
        <div>
          <div className="brand-name">Shree Vrundavan</div>
          <div className="brand-sub">Ice Cream</div>
        </div>
      )}
    </div>
  );
}
function Spinner() {
  return <span className="spin" style={{ fontSize: 16 }}>⏳</span>;
}
function Modal({ title, onClose, children }) {
  return (
    <div className="mo" onClick={e => e.target.className === "mo" && onClose()}>
      <div className="mbox su">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.redDark, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textLight }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function OtpInput({ value, onChange }) {
  const digits = (value + "      ").slice(0, 6).split("");
  function handleKey(i, e) {
    const d = e.target.value.replace(/\D/g, "").slice(-1);
    const arr = (value + "      ").slice(0, 6).split("");
    arr[i] = d || " ";
    onChange(arr.join("").trimEnd());
    if (d && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
    if (!d && e.nativeEvent.inputType === "deleteContentBackward" && i > 0) document.getElementById(`otp-${i - 1}`)?.focus();
  }
  return (
    <div className="otp-wrap">
      {digits.map((d, i) => (
        <input key={i} id={`otp-${i}`} className="otp-inp" maxLength={1}
          value={d.trim()} onChange={e => handleKey(i, e)} inputMode="numeric" />
      ))}
    </div>
  );
}

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use":   "This email is already registered. Please sign in.",
    "auth/invalid-email":          "Invalid email address.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/invalid-credential":     "Incorrect email or password.",
    "auth/too-many-requests":      "Too many attempts. Please wait a few minutes.",
    "auth/network-request-failed": "Network error. Check your internet.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ─── SIGN UP ─────────────────────────────────────────────────────────────────

function SignupScreen({ onDone }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", mobile: "", email: "", secretCode: "", password: "", confirm: "" });
  const [otp, setOtp] = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function upd(f, v) { setForm(p => ({ ...p, [f]: v })); setErr(""); }

  function handleSendOtp() {
    if (!form.firstName.trim()) return setErr("Enter your first name.");
    if (!form.username.trim())  return setErr("Enter a username.");
    if (!form.email.trim() || !/^\S+@\S+\.\S+/.test(form.email)) return setErr("Enter a valid email.");
    if (!form.mobile || form.mobile.length < 10) return setErr("Enter a valid 10-digit mobile number.");
    if (form.secretCode !== "VRUNDAVAN2024") return setErr("Invalid secret code. Contact the owner.");
    setErr(""); setStep(2);
  }

  function handleVerifyOtp() {
    if (otp.trim().length < 6) return setErr("Enter all 6 digits.");
    if (otp.trim() !== "123456") return setErr("Wrong OTP. Demo OTP is 123456.");
    setStep(3); setErr("");
  }

  async function handleCreateAccount() {
    if (!form.password || form.password.length < 6) return setErr("Password must be at least 6 characters.");
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
    <div><Lbl>{label}</Lbl>
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
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>Business Management Portal<br/>Saurashtra · Gujarat</div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card su">
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

          {step === 1 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, color: C.redDark, marginBottom: 18 }}>Create Account</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {F("First Name", "firstName", "text", "Utsav")}{F("Last Name", "lastName", "text", "Tala")}
              </div>
              <div style={{ marginBottom: 12 }}>{F("Username", "username", "text", "utsav_vrundavan")}</div>
              <div style={{ marginBottom: 12 }}>{F("Email", "email", "email", "utsav@gmail.com")}</div>
              <div style={{ marginBottom: 12 }}>
                <Lbl>Mobile Number</Lbl>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ background: "#f9fafb", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.textMid, fontWeight: 700, flexShrink: 0 }}>+91</div>
                  <input className="inp" type="tel" maxLength={10} placeholder="9825011234" value={form.mobile} onChange={e => upd("mobile", e.target.value.replace(/\D/g, ""))} />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <Lbl>Secret Code</Lbl>
                <input className="inp" type="password" placeholder="Owner-provided code" value={form.secretCode} onChange={e => upd("secretCode", e.target.value)} />
              </div>
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 12 }} onClick={handleSendOtp}>Send OTP →</button>
              <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: C.textLight }}>
                Have account? <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={() => onDone(null)}>Sign In</span>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, color: C.redDark, marginBottom: 6 }}>Verify Mobile</div>
              <div style={{ fontSize: 12, color: "#92400e", marginBottom: 16, background: "#fffbeb", padding: "8px 12px", borderRadius: 8, border: "1px solid #fde68a" }}>💡 Demo OTP: <b>123456</b></div>
              <OtpInput value={otp} onChange={setOtp} />
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 12 }} onClick={handleVerifyOtp}>Verify OTP →</button>
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8, fontSize: 12 }} onClick={() => setStep(1)}>← Back</button>
            </div>
          )}
          {step === 3 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, color: C.redDark, marginBottom: 18 }}>Set Password</div>
              <div style={{ marginBottom: 12 }}>{F("Password", "password", "password", "Min 6 characters")}</div>
              <div style={{ marginBottom: 18 }}>{F("Confirm Password", "confirm", "password", "Re-enter password")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "12px 14px", background: "#fff8f8", borderRadius: 10, border: `1px solid ${C.border}` }}>
                <label className="toggle"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span className="toggle-slider" /></label>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Remember me for 1 month</div>
              </div>
              {err && <div className="err-box">⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 12 }} onClick={handleCreateAccount} disabled={loading}>
                {loading ? <><Spinner /> Creating...</> : "🎉 Create Account"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SIGN IN ──────────────────────────────────────────────────────────────────

function SigninScreen({ onLogin, onSignup }) {
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function doLogin() {
    if (!email.trim()) return setErr("Enter your email.");
    if (!pass)         return setErr("Enter your password.");
    setLoading(true); setErr("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const p = snap.exists() ? snap.data() : {};
      onLogin({ uid: cred.user.uid, name: p.firstName ? `${p.firstName} ${p.lastName}`.trim() : cred.user.email, email: cred.user.email, role: p.role || "staff" });
    } catch (e) { setErr(friendlyError(e.code)); setLoading(false); }
  }

  return (
    <div className="auth-wrap"><style>{CSS}</style>
      <div className="auth-left">
        <div style={{ textAlign: "center" }}>
          <img src={LOGO_URL} alt="logo" style={{ width: 200, filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.35))", marginBottom: 20 }} />
          <div style={{ width: 50, height: 3, background: C.yellow, borderRadius: 2, margin: "0 auto 18px" }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.9 }}>🏭 Manufacturing · Distribution<br/>📦 Inventory · Billing<br/>🚚 Delivery Management</div>
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
              onChange={e => { setEmail(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && doLogin()} />
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
              <label className="toggle"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span className="toggle-slider" /></label>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Remember me</span>
            </div>
            <span style={{ fontSize: 12, color: C.red, cursor: "pointer", fontWeight: 700 }}>Forgot?</span>
          </div>
          {err && <div className="err-box">⚠️ {err}</div>}
          <button className="btn btn-red" style={{ width: "100%", padding: 13, fontSize: 15 }} onClick={doLogin} disabled={loading}>
            {loading ? <span className="pulse">Signing in...</span> : "Sign In →"}
          </button>
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: C.textLight }}>
            New staff? <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={onSignup}>Create Account</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADD AGENCY MODAL ─────────────────────────────────────────────────────────

function AddAgencyModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", owner: "", phone: "", city: "", email: "", creditLimit: "", address: "", gst: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function upd(f, v) { setForm(p => ({ ...p, [f]: v })); setErr(""); }

  async function handleSave() {
    if (!form.name.trim())  return setErr("Agency name is required.");
    if (!form.owner.trim()) return setErr("Owner name is required.");
    if (!form.phone.trim()) return setErr("Phone number is required.");
    if (!form.city.trim())  return setErr("City is required.");
    setLoading(true);
    try {
      const ref = await addDoc(collection(db, "agencies"), {
        name:         form.name.trim(),
        owner:        form.owner.trim(),
        phone:        form.phone.trim(),
        city:         form.city.trim(),
        email:        form.email.trim(),
        creditLimit:  Number(form.creditLimit) || 100000,
        address:      form.address.trim(),
        gst:          form.gst.trim(),
        outstanding:  0,
        totalShops:   0,
        status:       "active",
        createdAt:    serverTimestamp(),
      });
      onSaved({ id: ref.id, ...form, outstanding: 0, totalShops: 0, status: "active" });
      onClose();
    } catch (e) { setErr("Failed to save. Try again."); setLoading(false); }
  }

  const F = (label, field, type = "text", ph = "", half = false) => (
    <div style={half ? {} : { gridColumn: "1 / -1" }}>
      <Lbl>{label}</Lbl>
      <input className="inp" type={type} placeholder={ph} value={form[field]} onChange={e => upd(field, e.target.value)} />
    </div>
  );

  return (
    <Modal title="➕ Add New Agency" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>{F("Agency Name *", "name", "text", "Rajkot Central Agency")}</div>
        {F("Owner Name *", "owner", "text", "Mahesh Patel", true)}
        {F("Phone *", "phone", "tel", "98250-11234", true)}
        {F("City *", "city", "text", "Rajkot", true)}
        {F("Email", "email", "email", "agency@email.com", true)}
        {F("Credit Limit (₹)", "creditLimit", "number", "100000", true)}
        {F("GST Number", "gst", "text", "24XXXXX0000X1Z5", true)}
        <div style={{ gridColumn: "1 / -1" }}>
          <Lbl>Full Address</Lbl>
          <textarea className="inp" rows={2} placeholder="Shop address..." value={form.address} onChange={e => upd("address", e.target.value)} style={{ resize: "vertical" }} />
        </div>
      </div>
      {err && <div className="err-box" style={{ marginTop: 14 }}>⚠️ {err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn btn-red" style={{ flex: 1 }} onClick={handleSave} disabled={loading}>
          {loading ? <><Spinner /> Saving...</> : "💾 Save Agency"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── CREATE BILL MODAL ────────────────────────────────────────────────────────

function CreateBillModal({ agencies, onClose, onSaved }) {
  const [form, setForm] = useState({ agencyId: "", notes: "" });
  const [items, setItems] = useState([{ name: "", qty: "", rate: "", amount: 0 }]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function upd(f, v) { setForm(p => ({ ...p, [f]: v })); setErr(""); }

  function updItem(i, f, v) {
    setItems(prev => {
      const arr = [...prev];
      arr[i] = { ...arr[i], [f]: v };
      if (f === "qty" || f === "rate") {
        const qty  = Number(f === "qty"  ? v : arr[i].qty)  || 0;
        const rate = Number(f === "rate" ? v : arr[i].rate) || 0;
        arr[i].amount = qty * rate;
      }
      return arr;
    });
  }

  function addItem() { setItems(p => [...p, { name: "", qty: "", rate: "", amount: 0 }]); }
  function removeItem(i) { setItems(p => p.filter((_, idx) => idx !== i)); }

  const total = items.reduce((s, it) => s + (it.amount || 0), 0);

  // Generate bill number: INV-YYYYMMDD-XXX
  function genBillNo() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `INV-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.floor(Math.random()*900)+100}`;
  }

  async function handleSave() {
    if (!form.agencyId) return setErr("Select an agency.");
    if (items.some(it => !it.name.trim())) return setErr("Fill in all item names.");
    if (total === 0) return setErr("Bill total cannot be ₹0.");
    setLoading(true);
    try {
      const billNo  = genBillNo();
      const agency  = agencies.find(a => a.id === form.agencyId);
      const billRef = await addDoc(collection(db, "bills"), {
        billNo,
        agencyId:   form.agencyId,
        agencyName: agency?.name || "",
        items:      items.filter(it => it.name.trim()),
        total,
        status:     "pending",
        notes:      form.notes,
        createdAt:  serverTimestamp(),
        dueDate:    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
      });
      // Update agency outstanding
      if (agency) {
        await updateDoc(doc(db, "agencies", form.agencyId), {
          outstanding: (agency.outstanding || 0) + total,
        });
      }
      onSaved({ id: billRef.id, billNo, agencyId: form.agencyId, agencyName: agency?.name, total, status: "pending" });
      onClose();
    } catch (e) { setErr("Failed to save bill. Try again."); setLoading(false); }
  }

  return (
    <Modal title="🧾 Create New Bill" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Lbl>Select Agency *</Lbl>
        <select className="sel" value={form.agencyId} onChange={e => upd("agencyId", e.target.value)}>
          <option value="">-- Choose Agency --</option>
          {agencies.map(a => <option key={a.id} value={a.id}>{a.name} — {a.city}</option>)}
        </select>
      </div>

      {/* Items table */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Lbl>Items</Lbl>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={addItem}>+ Add Row</button>
        </div>
        <div style={{ background: "#fff8f8", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 32px", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: "#fef0f0" }}>
            {["Item Name", "Qty", "Rate (₹)", "Amount", ""].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>{h}</div>)}
          </div>
          {items.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 32px", gap: 8, padding: "8px 12px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
              <input className="inp" style={{ padding: "6px 10px", fontSize: 12 }} placeholder="e.g. Kesar Pista" value={it.name} onChange={e => updItem(i, "name", e.target.value)} />
              <input className="inp" style={{ padding: "6px 10px", fontSize: 12 }} type="number" placeholder="10" value={it.qty} onChange={e => updItem(i, "qty", e.target.value)} />
              <input className="inp" style={{ padding: "6px 10px", fontSize: 12 }} type="number" placeholder="120" value={it.rate} onChange={e => updItem(i, "rate", e.target.value)} />
              <div style={{ fontWeight: 800, fontSize: 12, color: C.redDark }}>₹{it.amount.toLocaleString()}</div>
              <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 800, color: C.redDark }}>
            Total: ₹{total.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Lbl>Notes (optional)</Lbl>
        <input className="inp" placeholder="Any special notes..." value={form.notes} onChange={e => upd("notes", e.target.value)} />
      </div>

      {err && <div className="err-box">⚠️ {err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn btn-red" style={{ flex: 1 }} onClick={handleSave} disabled={loading}>
          {loading ? <><Spinner /> Saving...</> : "💾 Create Bill"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ user, onLogout }) {
  const [page,       setPage]       = useState("dashboard");
  const [selAgency,  setSelAgency]  = useState(null);

  // Firestore data
  const [agencies,   setAgencies]   = useState([]);
  const [bills,      setBills]      = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [loadingData,setLoadingData]= useState(true);

  // Modal states
  const [showAddAgency,   setShowAddAgency]   = useState(false);
  const [showCreateBill,  setShowCreateBill]  = useState(false);

  // ── Real-time Firestore listeners ──────────────────────────────────────────
  useEffect(() => {
    // Listen to agencies
    const unsubAgencies = onSnapshot(
      query(collection(db, "agencies"), orderBy("createdAt", "desc")),
      snap => setAgencies(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("agencies:", err)
    );
    // Listen to bills
    const unsubBills = onSnapshot(
      query(collection(db, "bills"), orderBy("createdAt", "desc")),
      snap => setBills(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("bills:", err)
    );
    // Listen to orders
    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("orders:", err)
    );
    setLoadingData(false);
    return () => { unsubAgencies(); unsubBills(); unsubOrders(); };
  }, []);

  // ── Computed stats ─────────────────────────────────────────────────────────
  const totalOut      = agencies.reduce((s, a) => s + (a.outstanding || 0), 0);
  const pendingOrders = orders.filter(o => o.status === "pending");
  const overdueAgencies = agencies.filter(a => a.status === "overdue");

  // ── Approve order ──────────────────────────────────────────────────────────
  async function approveOrder(order) {
    try {
      await updateDoc(doc(db, "orders", order.id), { status: "approved" });
      // Auto-create a bill from the order
      const agency = agencies.find(a => a.id === order.agencyId);
      const billNo = `INV-${Date.now().toString().slice(-6)}`;
      await addDoc(collection(db, "bills"), {
        billNo, agencyId: order.agencyId, agencyName: agency?.name || "",
        items: order.items || [], total: order.total,
        status: "pending", notes: `Auto from order ${order.id}`,
        createdAt: serverTimestamp(),
      });
      if (agency) {
        await updateDoc(doc(db, "agencies", order.agencyId), {
          outstanding: (agency.outstanding || 0) + order.total,
        });
      }
    } catch (e) { console.error(e); }
  }

  // ── Reject order ───────────────────────────────────────────────────────────
  async function rejectOrder(order) {
    await updateDoc(doc(db, "orders", order.id), { status: "rejected" });
  }

  // ── Mark bill paid ─────────────────────────────────────────────────────────
  async function markBillPaid(bill) {
    try {
      await updateDoc(doc(db, "bills", bill.id), { status: "paid" });
      const agency = agencies.find(a => a.id === bill.agencyId);
      if (agency) {
        const newOut = Math.max(0, (agency.outstanding || 0) - bill.total);
        await updateDoc(doc(db, "agencies", bill.agencyId), {
          outstanding: newOut,
          status: newOut === 0 ? "active" : agency.status,
        });
      }
    } catch (e) { console.error(e); }
  }

  // ── Delete agency ──────────────────────────────────────────────────────────
  async function deleteAgency(id) {
    if (!window.confirm("Delete this agency? This cannot be undone.")) return;
    await deleteDoc(doc(db, "agencies", id));
    setSelAgency(null);
  }

  const nav = [
    { id: "dashboard", icon: "🏠", label: "Home" },
    { id: "orders",    icon: "📦", label: "Orders",   badge: pendingOrders.length },
    { id: "billing",   icon: "🧾", label: "Billing" },
    { id: "agencies",  icon: "🏢", label: "Agencies" },
    { id: "vehicles",  icon: "🚚", label: "Vehicles" },
  ];

  async function handleLogout() { await signOut(auth); onLogout(); }

  // Shared page header
  function PageHeader({ title, sub, action }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 800, color: C.redDark, fontFamily: "'Playfair Display',serif" }}>{title}</h1>
          {sub && <p style={{ color: C.textLight, fontSize: 13, marginTop: 3 }}>{sub}</p>}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.pageBg }}>
      <style>{CSS}</style>

      {/* Modals */}
      {showAddAgency  && <AddAgencyModal  onClose={() => setShowAddAgency(false)}  onSaved={() => {}} />}
      {showCreateBill && <CreateBillModal agencies={agencies} onClose={() => setShowCreateBill(false)} onSaved={() => {}} />}

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="brand-logo-wrap" style={{ padding: "4px 8px 18px", borderBottom: "1px solid #2a0e0e", marginBottom: 8 }}>
          <Logo size={34} />
        </div>
        {nav.map(n => (
          <div key={n.id} className={`ni ${page === n.id && !selAgency ? "na" : ""}`}
            onClick={() => { setPage(n.id); setSelAgency(null); }}>
            <span>{n.icon}</span>
            <span style={{ flex: 1 }}>{n.label}</span>
            {n.badge > 0 && <span className="nav-badge">{n.badge}</span>}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="sidebar-footer" style={{ padding: "12px 14px", borderRadius: 10, background: "#2a0e0e" }}>
          <div style={{ fontSize: 10, color: "#6b2a2a", textTransform: "uppercase" }}>Signed in as</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f5c518", marginTop: 2 }}>{user?.name || "Owner"}</div>
          <div style={{ fontSize: 10, color: "#6b2a2a", marginTop: 1 }}>{user?.role}</div>
          <button className="btn btn-danger" style={{ marginTop: 10, width: "100%", fontSize: 11, padding: 6 }} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content" style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>

        {/* ── DASHBOARD HOME ── */}
        {page === "dashboard" && !selAgency && (
          <div className="fi">
            <PageHeader
              title={`Good morning, ${user?.name?.split(" ")[0] || "Owner"} 🌅`}
              sub={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Shree Vrundavan Ice Cream`}
              action={<button className="btn btn-red hide-mobile" onClick={() => setShowCreateBill(true)}>+ New Bill</button>}
            />

            {loadingData ? (
              <div style={{ textAlign: "center", padding: 40 }}><Spinner /> <span style={{ marginLeft: 8, color: C.textLight }}>Loading data...</span></div>
            ) : (
              <>
                <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
                  <SC label="Total Agencies"    value={agencies.length}                    icon="🏢" color={C.redDark}  accent={C.red}     sub={`${overdueAgencies.length} overdue`} />
                  <SC label="Pending Orders"    value={pendingOrders.length}               icon="📦" color="#d97706"    accent={C.yellow}  sub="awaiting approval" />
                  <SC label="Total Outstanding" value={`₹${totalOut.toLocaleString()}`}    icon="⚠️" color={C.red}     accent={C.red}     sub="from agencies" />
                  <SC label="Bills This Month"  value={`₹${bills.filter(b => {
                    const d = b.createdAt?.toDate?.();
                    return d && d.getMonth() === new Date().getMonth();
                  }).reduce((s,b) => s + (b.total||0), 0).toLocaleString()}`}              icon="🧾" color="#065f46"   accent="#10b981"   sub="total billed" />
                </div>

                {/* Pending orders alert */}
                {pendingOrders.length > 0 && (
                  <div style={{ background: "#fffbeb", border: `1px solid ${C.yellow}`, borderLeft: `4px solid ${C.yellow}`, borderRadius: 12, padding: "14px 18px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: C.redDark, fontSize: 14 }}>🔔 {pendingOrders.length} New Orders Waiting</div>
                      <div style={{ fontSize: 12, color: "#92400e", marginTop: 3 }}>
                        {pendingOrders.slice(0, 3).map(o => agencies.find(a => a.id === o.agencyId)?.name || o.agencyId).join(" · ")}
                      </div>
                    </div>
                    <button className="btn btn-yellow" style={{ fontSize: 12 }} onClick={() => setPage("orders")}>Review →</button>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
                  {/* Agency overview */}
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Agency Overview</div>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setPage("agencies")}>View All →</button>
                    </div>
                    {agencies.length === 0 ? (
                      <div className="empty-state"><div className="icon">🏢</div><p>No agencies yet</p>
                        <button className="btn btn-red" style={{ fontSize: 12 }} onClick={() => setShowAddAgency(true)}>+ Add First Agency</button>
                      </div>
                    ) : agencies.slice(0, 6).map(a => (
                      <div key={a.id} className="tr" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 8, cursor: "pointer" }}
                        onClick={() => { setPage("agencies"); setSelAgency(a); }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: C.textLight }}>{a.city} · {a.totalShops || 0} shops</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: (a.outstanding || 0) > 0 ? C.red : "#065f46" }}>₹{(a.outstanding || 0).toLocaleString()}</div>
                          <Tag cls={`b${a.status === "active" ? "a" : "o"}`}>{a.status}</Tag>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recent bills */}
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Recent Bills</div>
                      <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => setShowCreateBill(true)}>+ Bill</button>
                    </div>
                    {bills.length === 0 ? (
                      <div className="empty-state"><div className="icon">🧾</div><p>No bills yet</p></div>
                    ) : bills.slice(0, 5).map(b => (
                      <div key={b.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{b.agencyName || "—"}</div>
                          <Tag cls={`b${b.status === "paid" ? "a" : b.status === "overdue" ? "o" : "p"}`}>{b.status}</Tag>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                          <div style={{ fontSize: 11, color: C.textLight }}>{b.billNo}</div>
                          <div style={{ fontWeight: 800, fontSize: 12, color: C.redDark }}>₹{(b.total || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ORDERS ── */}
        {page === "orders" && (
          <div className="fi">
            <PageHeader title="Agency Orders" sub="Orders placed by agencies" />
            {orders.length === 0 ? (
              <div className="empty-state card"><div className="icon">📦</div><p>No orders yet. Agencies will place orders through their app.</p></div>
            ) : orders.map(o => {
              const ag = agencies.find(a => a.id === o.agencyId);
              return (
                <div key={o.id} className="card" style={{ marginBottom: 14, borderLeft: `4px solid ${o.status === "pending" ? C.yellow : o.status === "approved" ? "#10b981" : "#ef4444"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <Tag cls={`b${o.status === "pending" ? "p" : o.status === "approved" ? "a" : "o"}`}>{o.status}</Tag>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{ag?.name || o.agencyId}</div>
                      <div style={{ fontSize: 12, color: C.textLight }}>
                        {o.createdAt?.toDate?.()?.toLocaleString("en-IN") || "Just now"}
                      </div>
                      {o.notes && <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4 }}>📝 {o.notes}</div>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: C.redDark }}>₹{(o.total || 0).toLocaleString()}</div>
                  </div>
                  {o.status === "pending" && (
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="btn btn-red" style={{ flex: 1 }} onClick={() => approveOrder(o)}>✓ Approve & Create Bill</button>
                      <button className="btn btn-ghost" onClick={() => rejectOrder(o)}>✕ Reject</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── BILLING ── */}
        {page === "billing" && (
          <div className="fi">
            <PageHeader
              title="Billing"
              sub={`${bills.length} invoices total`}
              action={<button className="btn btn-red" onClick={() => setShowCreateBill(true)}>+ Create Bill</button>}
            />
            <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
              <SC label="Total Billed" value={`₹${bills.reduce((s,b) => s+(b.total||0),0).toLocaleString()}`}                            icon="🧾" color={C.redDark} accent={C.red}    />
              <SC label="Pending"      value={`₹${bills.filter(b=>b.status==="pending").reduce((s,b)=>s+(b.total||0),0).toLocaleString()}`} icon="⏳" color="#d97706" accent={C.yellow} />
              <SC label="Collected"    value={`₹${bills.filter(b=>b.status==="paid").reduce((s,b)=>s+(b.total||0),0).toLocaleString()}`}    icon="✅" color="#065f46" accent="#10b981" />
            </div>
            {bills.length === 0 ? (
              <div className="empty-state card"><div className="icon">🧾</div><p>No bills yet. Create your first bill!</p>
                <button className="btn btn-red" onClick={() => setShowCreateBill(true)}>+ Create Bill</button>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.8fr 1fr 1fr 80px 80px", gap: 10, padding: "10px 16px", background: "#fff8f8", borderRadius: "14px 14px 0 0", borderBottom: `1px solid ${C.border}` }}>
                  {["Bill No.", "Agency", "Total", "Status", "Date", ""].map(h => (
                    <div key={h} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                  ))}
                </div>
                {bills.map(b => (
                  <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1.3fr 1.8fr 1fr 1fr 80px 80px", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{b.agencyName || "—"}</div>
                    <div style={{ fontWeight: 800, color: C.redDark }}>₹{(b.total||0).toLocaleString()}</div>
                    <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
                    <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                    {b.status !== "paid" && (
                      <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => markBillPaid(b)}>Mark Paid</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AGENCIES LIST ── */}
        {page === "agencies" && !selAgency && (
          <div className="fi">
            <PageHeader
              title="Agencies"
              sub={`${agencies.length} agencies · Saurashtra region`}
              action={<button className="btn btn-red" onClick={() => setShowAddAgency(true)}>+ Add Agency</button>}
            />
            {agencies.length === 0 ? (
              <div className="empty-state card"><div className="icon">🏢</div><p>No agencies yet. Add your first one!</p>
                <button className="btn btn-red" onClick={() => setShowAddAgency(true)}>+ Add Agency</button>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1.1fr 0.7fr 90px", gap: 10, padding: "10px 16px", background: "#fff8f8", borderRadius: "14px 14px 0 0", borderBottom: `1px solid ${C.border}` }}>
                  {["Agency", "Owner", "Outstanding", "Shops", "Status"].map(h => (
                    <div key={h} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                  ))}
                </div>
                {agencies.map(a => (
                  <div key={a.id} className="tr" style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1.1fr 0.7fr 90px", gap: 10, alignItems: "center", cursor: "pointer" }}
                    onClick={() => setSelAgency(a)}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: C.textLight }}>{a.city}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: C.text }}>{a.owner}</div>
                      <div style={{ fontSize: 11, color: C.textLight }}>{a.phone}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: (a.outstanding||0) > 0 ? C.red : "#065f46" }}>₹{(a.outstanding||0).toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: C.textMid }}>{a.totalShops || 0}</div>
                    <Tag cls={`b${a.status === "active" ? "a" : "o"}`}>{a.status}</Tag>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AGENCY DETAIL ── */}
        {page === "agencies" && selAgency && (
          <div className="fi">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
              <button className="btn btn-ghost" onClick={() => setSelAgency(null)}>← Back</button>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: C.redDark, fontFamily: "'Playfair Display',serif" }}>{selAgency.name}</h1>
                <p style={{ color: C.textLight, fontSize: 13 }}>{selAgency.city}</p>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn btn-red" onClick={() => setShowCreateBill(true)}>+ New Bill</button>
                {selAgency.phone && (
                  <a href={`https://wa.me/91${selAgency.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                    <button className="btn btn-yellow">💬 WhatsApp</button>
                  </a>
                )}
                <button className="btn btn-danger" onClick={() => deleteAgency(selAgency.id)}>🗑️ Delete</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
              <div className="card">
                <div style={{ fontWeight: 800, marginBottom: 14, color: C.text }}>📋 Profile</div>
                {[["Owner", selAgency.owner], ["Phone", selAgency.phone], ["City", selAgency.city], ["Email", selAgency.email], ["GST", selAgency.gst]].filter(([,v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{k}</div>
                    <div style={{ fontSize: 13, color: C.text }}>{v}</div>
                  </div>
                ))}
                {selAgency.address && <div style={{ marginTop: 8, fontSize: 12, color: C.textLight }}>{selAgency.address}</div>}
              </div>
              <div className="card">
                <div style={{ fontWeight: 800, marginBottom: 14, color: C.text }}>💰 Financials</div>
                {[
                  ["Credit Limit", `₹${(selAgency.creditLimit||0).toLocaleString()}`, C.text],
                  ["Outstanding",  `₹${(selAgency.outstanding||0).toLocaleString()}`,  (selAgency.outstanding||0) > 0 ? C.red : "#065f46"],
                  ["Total Shops",  selAgency.totalShops || 0, C.text],
                ].map(([k, v, color]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, color: C.textLight }}>{k}</span>
                    <span style={{ fontWeight: 800, fontSize: 14, color }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontWeight: 800, color: C.text, background: "#fff8f8", borderRadius: "14px 14px 0 0" }}>🧾 Bills for this Agency</div>
              {bills.filter(b => b.agencyId === selAgency.id).length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}><p>No bills for this agency yet.</p></div>
              ) : bills.filter(b => b.agencyId === selAgency.id).map(b => (
                <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 80px 80px", gap: 12, alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                  <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN")}</div>
                  <div style={{ fontWeight: 800, color: C.redDark }}>₹{(b.total||0).toLocaleString()}</div>
                  <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
                  {b.status !== "paid" && (
                    <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => markBillPaid(b)}>Mark Paid</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── VEHICLES ── */}
        {page === "vehicles" && (
          <div className="fi">
            <PageHeader title="Vehicles 🚚" sub="Fleet management" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
              {[
                { id: "V01", name: "GJ-03-AB-1234", driver: "Ramesh Bhai",  status: "on-route", route: "Rajkot → Jamnagar"  },
                { id: "V02", name: "GJ-03-CD-5678", driver: "Suresh Patel", status: "idle",     route: null                  },
                { id: "V03", name: "GJ-03-EF-9012", driver: "Dinesh Mer",   status: "on-route", route: "Factory → Junagadh" },
                { id: "V04", name: "GJ-03-GH-3456", driver: "Vijay Bhai",   status: "idle",     route: null                  },
              ].map(v => (
                <div key={v.id} className="card" style={{ borderLeft: `4px solid ${v.status === "on-route" ? C.red : C.yellow}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{v.name}</div>
                    <Tag cls={v.status === "on-route" ? "ba" : "bp"}>{v.status}</Tag>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMid }}>Driver: <b>{v.driver}</b></div>
                  <div style={{ fontSize: 11, color: v.route ? C.red : C.textLight, marginTop: 4 }}>{v.route || "Idle at factory"}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "12px 16px", background: "#fffbeb", borderRadius: 10, border: `1px solid ${C.yellow}`, fontSize: 12, color: "#92400e" }}>
              🚧 Live vehicle tracking coming soon — will connect to driver app via Firestore.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [user,   setUser]   = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          const p = snap.exists() ? snap.data() : {};
          setUser({ uid: firebaseUser.uid, name: p.firstName ? `${p.firstName} ${p.lastName}`.trim() : firebaseUser.displayName || firebaseUser.email, email: firebaseUser.email, role: p.role || "staff" });
          setScreen("dashboard");
        } catch {
          setUser({ uid: firebaseUser.uid, name: firebaseUser.displayName || firebaseUser.email, email: firebaseUser.email, role: "staff" });
          setScreen("dashboard");
        }
      } else {
        setScreen("signin");
      }
    });
    return () => unsub();
  }, []);

  if (screen === "loading") return (
    <div className="loading-screen"><style>{CSS}</style>
      <div style={{ textAlign: "center" }}>
        <Logo size={60} showText={false} />
        <div style={{ marginTop: 18, fontSize: 14, color: C.textLight }}><Spinner /> &nbsp;Loading...</div>
      </div>
    </div>
  );

  if (screen === "signup") return <SignupScreen onDone={u => { if (u) { setUser(u); setScreen("dashboard"); } else setScreen("signin"); }} />;
  if (screen === "signin") return <SigninScreen onLogin={u => { setUser(u); setScreen("dashboard"); }} onSignup={() => setScreen("signup")} />;
  return <Dashboard user={user} onLogout={() => { setUser(null); setScreen("signin"); }} />;
}
