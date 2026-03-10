import { useState } from "react";

const LOGO_URL = "/logo.png"; // place vrundavan_logo.png in your public/ folder as logo.png

// Brand colours from logo
const C = {
  red:       "#c8181e",
  redDark:   "#9e1015",
  redLight:  "#f03035",
  yellow:    "#f5c518",
  yellowDark:"#d4a012",
  white:     "#ffffff",
  cream:     "#fff8f0",
  sidebar:   "#1a0a0a",
  sidebarB:  "#110606",
  text:      "#1a0505",
  textMid:   "#6b3333",
  textLight: "#a07070",
  border:    "#f0dada",
  cardBg:    "#ffffff",
  pageBg:    "#fdf5f5",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Nunito',sans-serif;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:#f0dada;}
::-webkit-scrollbar-thumb{background:#c8181e;border-radius:4px;}

/* ── SIDEBAR ── */
.sidebar{width:230px;background:${C.sidebarB};display:flex;flex-direction:column;gap:4px;padding:20px 10px;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;}
.brand-name{font-family:'Playfair Display',serif;font-size:15px;color:${C.yellow};line-height:1.2;letter-spacing:0.3px;}
.brand-sub{font-size:9px;color:#6b2a2a;letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
.ni{cursor:pointer;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;transition:all 0.2s;color:#9a5555;}
.ni:hover{background:#2a0e0e;color:#f5c518;}
.na{background:linear-gradient(135deg,#7a0c10,#c8181e)!important;color:#fff!important;box-shadow:0 4px 12px rgba(200,24,30,0.4);}
.nav-badge{background:${C.yellow};color:${C.redDark};border-radius:20px;font-size:10px;font-weight:800;padding:1px 7px;margin-left:auto;}

/* ── CARDS ── */
.card{background:${C.cardBg};border:1px solid ${C.border};border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(200,24,30,0.06);}
.sc{background:${C.cardBg};border:1px solid ${C.border};border-radius:14px;padding:20px;transition:transform 0.2s,box-shadow 0.2s;box-shadow:0 2px 8px rgba(200,24,30,0.06);}
.sc:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(200,24,30,0.12);}

/* ── BADGES ── */
.badge{padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.5px;display:inline-block;text-transform:uppercase;}
.ba{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;}
.bo{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
.bp{background:#fffbeb;color:#92400e;border:1px solid #fde68a;}
.bd{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;}

/* ── BUTTONS ── */
.btn{padding:9px 20px;border-radius:10px;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;transition:all 0.2s;}
.btn-red{background:linear-gradient(135deg,${C.red},${C.redDark});color:white;box-shadow:0 4px 12px rgba(200,24,30,0.3);}
.btn-red:hover{background:linear-gradient(135deg,${C.redLight},${C.red});transform:translateY(-1px);}
.btn-yellow{background:linear-gradient(135deg,${C.yellow},${C.yellowDark});color:${C.redDark};box-shadow:0 4px 12px rgba(245,197,24,0.3);}
.btn-yellow:hover{transform:translateY(-1px);}
.btn-ghost{background:#fff5f5;color:${C.textMid};border:1px solid ${C.border};}
.btn-ghost:hover{background:#fef2f2;color:${C.red};}
.btn-danger{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}

/* ── INPUTS ── */
.inp{background:#fff;border:1.5px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-family:'Nunito',sans-serif;font-size:13px;outline:none;transition:border-color 0.2s,box-shadow 0.2s;width:100%;}
.inp:focus{border-color:${C.red};box-shadow:0 0 0 3px rgba(200,24,30,0.08);}
.sel{background:#fff;border:1.5px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-family:'Nunito',sans-serif;font-size:13px;outline:none;width:100%;}
.sel:focus{border-color:${C.red};}
.lbl{font-size:11px;color:${C.textMid};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;display:block;}

/* ── TABLE ROWS ── */
.tr{padding:12px 16px;border-bottom:1px solid #fdf0f0;transition:background 0.15s;}
.tr:hover{background:#fff8f8;}

/* ── MODAL ── */
.mo{position:fixed;inset:0;background:rgba(26,5,5,0.7);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(6px);}
.mbox{background:#fff;border-radius:20px;padding:28px;width:640px;max-width:96vw;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(200,24,30,0.2);}

/* ── ANIMATIONS ── */
@keyframes fi{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
.fi{animation:fi 0.3s ease;}
@keyframes su{from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);}}
.su{animation:su 0.35s cubic-bezier(.22,1,.36,1);}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
.pulse{animation:pulse 2s infinite;}

/* ── AUTH SCREENS ── */
.auth-wrap{min-height:100vh;display:flex;background:${C.pageBg};}
.auth-left{width:420px;background:linear-gradient(160deg,${C.redDark} 0%,${C.red} 50%,#e03535 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;flex-shrink:0;}
.auth-right{flex:1;display:flex;align-items:center;justify-content:center;padding:32px;}
.auth-card{background:#fff;border-radius:20px;padding:36px;width:100%;max-width:460px;box-shadow:0 8px 32px rgba(200,24,30,0.1);}

/* ── TOGGLE / REMEMBER ME ── */
.toggle{position:relative;width:42px;height:24px;flex-shrink:0;}
.toggle input{opacity:0;width:0;height:0;}
.toggle-slider{position:absolute;inset:0;background:#e5e7eb;border-radius:24px;cursor:pointer;transition:0.3s;}
.toggle-slider:before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2);}
.toggle input:checked+.toggle-slider{background:${C.red};}
.toggle input:checked+.toggle-slider:before{transform:translateX(18px);}

/* ── OTP INPUT ── */
.otp-wrap{display:flex;gap:10px;justify-content:center;margin:16px 0;}
.otp-inp{width:48px;height:52px;text-align:center;font-size:20px;font-weight:800;border:2px solid ${C.border};border-radius:12px;outline:none;font-family:'Nunito',sans-serif;color:${C.redDark};transition:border-color 0.2s;}
.otp-inp:focus{border-color:${C.red};box-shadow:0 0 0 3px rgba(200,24,30,0.1);}

/* ── MOBILE RESPONSIVE ── */
@media(max-width:768px){
  .sidebar{width:100%;height:auto;flex-direction:row;padding:10px;overflow-x:auto;position:fixed;bottom:0;top:auto;z-index:100;border-top:2px solid #2a0e0e;}
  .ni{flex-direction:column;gap:3px;font-size:10px;padding:8px 12px;min-width:60px;text-align:center;}
  .ni span:first-child{font-size:18px;}
  .na{background:linear-gradient(135deg,#7a0c10,#c8181e)!important;}
  .brand-logo-wrap,.sidebar-footer{display:none;}
  .main-content{padding:16px 14px 80px!important;}
  .auth-left{display:none;}
  .auth-right{padding:20px;}
  .auth-card{padding:24px;}
  .stat-grid{grid-template-columns:1fr 1fr!important;}
  .agency-table-wrap{overflow-x:auto;}
  .hide-mobile{display:none!important;}
  .page-title{font-size:18px!important;}
}
@media(max-width:480px){
  .stat-grid{grid-template-columns:1fr!important;}
  .otp-inp{width:40px;height:46px;font-size:17px;}
}
`;

// ── HELPERS ─────────────────────────────────────────────────────────────────

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

// ── LOGO COMPONENT ────────────────────────────────────────────────────────────
function Logo({ size = 48, showText = true, center = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: center ? "center" : "flex-start" }}>
      <img
        src={LOGO_URL}
        alt="Shree Vrundavan Ice Cream"
        style={{ height: size, width: "auto", objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 2px 6px rgba(200,24,30,0.3))" }}
        onError={e => { e.target.style.display = "none"; }}
      />
      {showText && (
        <div>
          <div className="brand-name">Shree Vrundavan</div>
          <div className="brand-sub">Ice Cream</div>
        </div>
      )}
    </div>
  );
}

// ── OTP INPUT ─────────────────────────────────────────────────────────────────
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
        <input key={i} id={`otp-${i}`} className="otp-inp" maxLength={1} value={d.trim()} onChange={e => handleKey(i, e)} inputMode="numeric" />
      ))}
    </div>
  );
}

// ── SIGN UP SCREEN ────────────────────────────────────────────────────────────
function SignupScreen({ onDone }) {
  const [step, setStep] = useState(1); // 1=details, 2=otp, 3=password
  const [form, setForm] = useState({ firstName:"", lastName:"", username:"", mobile:"", email:"", secretCode:"", password:"", confirm:"" });
  const [otp, setOtp] = useState("");
  const [generatedOtp] = useState("123456"); // In real app this comes from SMS API
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  function upd(f, v) { setForm(p => ({ ...p, [f]: v })); setErr(""); }

  function sendOtp() {
    if (!form.mobile || form.mobile.length < 10) return setErr("Enter valid 10-digit mobile number.");
    if (form.secretCode !== "VRUNDAVAN2024") return setErr("Invalid secret code. Contact the owner.");
    setOtpSent(true);
    setStep(2);
    // In real app: call Firebase phone auth or SMS API here
  }

  function verifyOtp() {
    if (otp.trim().length < 6) return setErr("Enter all 6 digits.");
    if (otp.trim() !== generatedOtp) return setErr("Wrong OTP. Try again.");
    setStep(3);
    setErr("");
  }

  function createAccount() {
    if (!form.password || form.password.length < 6) return setErr("Password must be at least 6 characters.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
    // In real app: createUserWithEmailAndPassword(auth, form.email, form.password)
    onDone({ ...form, role: "staff", remember });
  }

  const inputRow = (label, field, type = "text", placeholder = "") => (
    <div>
      <Lbl>{label}</Lbl>
      <input className="inp" type={type} placeholder={placeholder} value={form[field]} onChange={e => upd(field, e.target.value)} />
    </div>
  );

  return (
    <div className="auth-wrap">
      <style>{CSS}</style>
      {/* Left panel */}
      <div className="auth-left">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🍦</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: "#fff", fontWeight: 800, lineHeight: 1.2 }}>Shree Vrundavan</div>
          <div style={{ fontSize: 18, color: C.yellow, fontWeight: 700, marginTop: 4 }}>Ice Cream</div>
          <div style={{ width: 60, height: 3, background: C.yellow, borderRadius: 2, margin: "16px auto" }} />
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>Business Management Portal</div>
          <div style={{ marginTop: 32, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Saurashtra · Gujarat</div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-card su">
          {/* Steps indicator */}
          <div style={{ display: "flex", gap: 6, marginBottom: 28, alignItems: "center" }}>
            {["Details", "Verify", "Password"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800,
                  background: step > i + 1 ? C.red : step === i + 1 ? C.red : "#f0dada",
                  color: step >= i + 1 ? "#fff" : C.textLight,
                }}>
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: step === i + 1 ? C.red : C.textLight }}>{s}</div>
                {i < 2 && <div style={{ width: 24, height: 2, background: step > i + 1 ? C.red : "#f0dada", borderRadius: 1 }} />}
              </div>
            ))}
          </div>

          {/* STEP 1 — Details */}
          {step === 1 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, marginBottom: 6 }}>Create Account</div>
              <div style={{ fontSize: 13, color: C.textLight, marginBottom: 22 }}>Fill in your details to get started</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {inputRow("First Name", "firstName", "text", "Utsav")}
                {inputRow("Last Name", "lastName", "text", "Tala")}
              </div>
              <div style={{ marginBottom: 12 }}>{inputRow("Username", "username", "text", "utsav_vrundavan")}</div>
              <div style={{ marginBottom: 12 }}>{inputRow("Email (Gmail)", "email", "email", "utsav@gmail.com")}</div>
              <div style={{ marginBottom: 12 }}>
                <Lbl>Mobile Number</Lbl>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ background: "#f9fafb", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.textMid, fontWeight: 700, flexShrink: 0 }}>+91</div>
                  <input className="inp" type="tel" maxLength={10} placeholder="9825011234" value={form.mobile} onChange={e => upd("mobile", e.target.value.replace(/\D/g, ""))} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <Lbl>Secret Code</Lbl>
                <input className="inp" type="password" placeholder="Enter secret code given by owner" value={form.secretCode} onChange={e => upd("secretCode", e.target.value)} />
                <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>🔒 Only authorized people know this code</div>
              </div>
              {err && <div style={{ fontSize: 12, color: C.red, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 12, fontSize: 14 }} onClick={sendOtp}>
                Send OTP to Mobile →
              </button>
              <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.textLight }}>
                Already have account? <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={() => onDone(null)}>Sign In</span>
              </div>
            </div>
          )}

          {/* STEP 2 — OTP */}
          {step === 2 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, marginBottom: 6 }}>Verify Mobile</div>
              <div style={{ fontSize: 13, color: C.textLight, marginBottom: 4 }}>OTP sent to +91 {form.mobile}</div>
              <div style={{ fontSize: 12, color: C.textLight, marginBottom: 20, background: "#fffbeb", padding: "8px 12px", borderRadius: 8, border: "1px solid #fde68a" }}>
                💡 Demo OTP: <b style={{ color: C.redDark }}>123456</b>
              </div>
              <OtpInput value={otp} onChange={setOtp} />
              {err && <div style={{ fontSize: 12, color: C.red, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 12, fontSize: 14 }} onClick={verifyOtp}>Verify OTP →</button>
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <span style={{ fontSize: 13, color: C.textLight }}>Didn't receive? </span>
                <span style={{ fontSize: 13, color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={() => setOtp("")}>Resend OTP</span>
              </div>
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10, fontSize: 12 }} onClick={() => setStep(1)}>← Back</button>
            </div>
          )}

          {/* STEP 3 — Password */}
          {step === 3 && (
            <div className="fi">
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, marginBottom: 6 }}>Set Password</div>
              <div style={{ fontSize: 13, color: C.textLight, marginBottom: 22 }}>Choose a strong password for your account</div>
              <div style={{ marginBottom: 12 }}>
                <Lbl>Password</Lbl>
                <input className="inp" type="password" placeholder="Minimum 6 characters" value={form.password} onChange={e => upd("password", e.target.value)} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <Lbl>Confirm Password</Lbl>
                <input className="inp" type="password" placeholder="Re-enter password" value={form.confirm} onChange={e => upd("confirm", e.target.value)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "12px 14px", background: "#fff8f8", borderRadius: 10, border: `1px solid ${C.border}` }}>
                <label className="toggle">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Remember me for 1 month</div>
                  <div style={{ fontSize: 11, color: C.textLight }}>Stay logged in on this device</div>
                </div>
              </div>
              {err && <div style={{ fontSize: 12, color: C.red, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>⚠️ {err}</div>}
              <button className="btn btn-red" style={{ width: "100%", padding: 12, fontSize: 14 }} onClick={createAccount}>
                🎉 Create Account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SIGN IN SCREEN ────────────────────────────────────────────────────────────
function SigninScreen({ onLogin, onSignup }) {
  const [identity, setIdentity] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function doLogin() {
    if (!identity || !pass) return setErr("Enter username/mobile/email and password.");
    setLoading(true);
    setTimeout(() => {
      if (pass === "owner123" || pass === "staff123") {
        onLogin({ name: identity, remember });
      } else {
        setErr("Incorrect password. Try owner123 or staff123 for demo.");
        setLoading(false);
      }
    }, 800);
  }

  return (
    <div className="auth-wrap">
      <style>{CSS}</style>
      <div className="auth-left">
        <div style={{ textAlign: "center" }}>
          <img src={LOGO_URL} alt="Shree Vrundavan Ice Cream" style={{ width: 220, height: "auto", filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.35))", marginBottom: 20 }} />
          <div style={{ width: 60, height: 3, background: C.yellow, borderRadius: 2, margin: "0 auto 20px" }} />
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
            🏭 Manufacturing · Distribution<br/>
            📦 Inventory · Billing<br/>
            🚚 Delivery Management
          </div>
          <div style={{ marginTop: 36, fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "1px" }}>SAURASHTRA · GUJARAT · INDIA</div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card su">
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <Logo size={52} showText={false} />
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: C.redDark, marginTop: 12 }}>Welcome Back</div>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 4 }}>Sign in to your account</div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Lbl>Username / Mobile / Email</Lbl>
            <input className="inp" placeholder="Enter any one of these" value={identity} onChange={e => { setIdentity(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && doLogin()} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <Lbl>Password</Lbl>
            <div style={{ position: "relative" }}>
              <input className="inp" type={showPass ? "text" : "password"} placeholder="Your password" value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && doLogin()} style={{ paddingRight: 44 }} />
              <button onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, padding: "12px 14px", background: "#fff8f8", borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="toggle">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Remember me for 1 month</span>
            </div>
            <span style={{ fontSize: 12, color: C.red, cursor: "pointer", fontWeight: 700 }}>Forgot?</span>
          </div>

          {err && <div style={{ fontSize: 12, color: C.red, marginBottom: 14, background: "#fef2f2", padding: "10px 12px", borderRadius: 8 }}>⚠️ {err}</div>}

          <button className="btn btn-red" style={{ width: "100%", padding: 13, fontSize: 15 }} onClick={doLogin} disabled={loading}>
            {loading ? <span className="pulse">Signing in...</span> : "Sign In →"}
          </button>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.textLight }}>
            New staff member? <span style={{ color: C.red, fontWeight: 700, cursor: "pointer" }} onClick={onSignup}>Create Account</span>
          </div>

          <div style={{ marginTop: 20, padding: "10px 14px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a", fontSize: 11, color: "#92400e" }}>
            <b>Demo:</b> Any username + password <b>owner123</b>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
const AGENCIES = [
  { id:1, name:"Rajkot Central Agency", owner:"Mahesh Patel", phone:"98250-11234", city:"Rajkot", outstanding:42000, creditLimit:150000, totalShops:12, status:"active" },
  { id:2, name:"Jamnagar Distributors", owner:"Bhavesh Shah",  phone:"98250-22345", city:"Jamnagar", outstanding:0, creditLimit:120000, totalShops:8, status:"active" },
  { id:3, name:"Junagadh Ice Agency",   owner:"Nilesh Desai",  phone:"98250-33456", city:"Junagadh", outstanding:78500, creditLimit:100000, totalShops:15, status:"overdue" },
  { id:4, name:"Surendranagar Traders", owner:"Ramesh Mer",    phone:"98250-44567", city:"Surendranagar", outstanding:21000, creditLimit:80000, totalShops:6, status:"active" },
  { id:5, name:"Amreli Agency",         owner:"Dinesh Bhai",   phone:"98250-55678", city:"Amreli", outstanding:90000, creditLimit:90000, totalShops:9, status:"overdue" },
  { id:6, name:"Bhavnagar Sweets",      owner:"Jayesh Trivedi",phone:"98250-66789", city:"Bhavnagar", outstanding:15000, creditLimit:130000, totalShops:11, status:"active" },
];

const BILLS = [
  { id:"INV-001", agencyId:1, total:6550, status:"paid",    date:"07 Mar 2026", items:"Kesar Pista ×10, Vanilla ×5" },
  { id:"INV-002", agencyId:3, total:9420, status:"overdue", date:"01 Mar 2026", items:"Choco Fudge ×15, Strawberry ×8" },
  { id:"INV-003", agencyId:2, total:8620, status:"paid",    date:"08 Mar 2026", items:"Mango ×12, Butterscotch ×10" },
  { id:"INV-004", agencyId:5, total:10400,status:"pending", date:"02 Mar 2026", items:"Mix Fruit Bar ×20" },
];

const ORDERS = [
  { id:"ORD-001", agencyId:1, total:12600, status:"pending", date:"09 Mar, 9:15 AM", notes:"Urgent - festival stock" },
  { id:"ORD-002", agencyId:3, total:17800, status:"pending", date:"09 Mar, 8:40 AM", notes:"" },
  { id:"ORD-003", agencyId:6, total:6680,  status:"approved",date:"08 Mar, 5:00 PM", notes:"" },
];

function Dashboard({ user, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [selAgency, setSelAgency] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const totalOut = AGENCIES.reduce((s, a) => s + a.outstanding, 0);
  const pendingOrders = ORDERS.filter(o => o.status === "pending");

  const nav = [
    { id:"dashboard", icon:"🏠", label:"Home"        },
    { id:"orders",    icon:"📦", label:"Orders",  badge: pendingOrders.length },
    { id:"billing",   icon:"🧾", label:"Billing"     },
    { id:"agencies",  icon:"🏢", label:"Agencies"    },
    { id:"vehicles",  icon:"🚚", label:"Vehicles"    },
  ];

  return (
    <div style={{ display:"flex", minHeight:"100vh", background: C.pageBg }}>
      <style>{CSS}</style>

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="brand-logo-wrap" style={{ padding:"4px 8px 20px", borderBottom:"1px solid #2a0e0e", marginBottom:8 }}>
          <Logo size={36} showText={true} />
        </div>
        {nav.map(n => (
          <div key={n.id} className={`ni ${page===n.id && !selAgency ? "na" : ""}`} onClick={() => { setPage(n.id); setSelAgency(null); }}>
            <span>{n.icon}</span>
            <span style={{ flex:1 }}>{n.label}</span>
            {n.badge > 0 && <span className="nav-badge">{n.badge}</span>}
          </div>
        ))}
        <div style={{ flex:1 }} />
        <div className="sidebar-footer" style={{ padding:"12px 14px", borderRadius:10, background:"#2a0e0e", marginTop:8 }}>
          <div style={{ fontSize:10, color:"#6b2a2a", textTransform:"uppercase", letterSpacing:"0.5px" }}>Signed in as</div>
          <div style={{ fontSize:13, fontWeight:700, color:"#f5c518", marginTop:3 }}>{user?.name || "Owner"}</div>
          <button className="btn btn-danger" style={{ marginTop:10, width:"100%", fontSize:11, padding:6 }} onClick={onLogout}>Logout</button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="main-content" style={{ flex:1, overflow:"auto", padding:"24px 28px" }}>

        {/* DASHBOARD */}
        {page==="dashboard" && !selAgency && (
          <div className="fi">
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <div>
                <h1 className="page-title" style={{ fontSize:22, fontWeight:800, color:C.redDark, fontFamily:"'Playfair Display',serif" }}>
                  Good Morning 🌅
                </h1>
                <p style={{ color:C.textLight, fontSize:13, marginTop:3 }}>Monday, 9 March 2026 · Shree Vrundavan Ice Cream</p>
              </div>
              <button className="btn btn-red hide-mobile" onClick={() => setPage("billing")}>+ New Bill</button>
            </div>

            {/* Stats */}
            <div className="stat-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 }}>
              <SC label="Total Agencies"    value={AGENCIES.length}                icon="🏢" color={C.redDark}   accent={C.red}    sub={`${AGENCIES.filter(a=>a.status==="overdue").length} overdue`} />
              <SC label="Pending Orders"    value={pendingOrders.length}           icon="📦" color="#d97706"     accent={C.yellow}  sub="awaiting approval" />
              <SC label="Total Outstanding" value={`₹${totalOut.toLocaleString()}`} icon="⚠️" color={C.red}    accent={C.red}    sub="from agencies" />
              <SC label="Bills This Month"  value={`₹${BILLS.reduce((s,b)=>s+b.total,0).toLocaleString()}`} icon="🧾" color="#065f46" accent="#10b981" sub="total billed" />
            </div>

            {/* Pending orders alert */}
            {pendingOrders.length > 0 && (
              <div style={{ background:"#fffbeb", border:`1px solid ${C.yellow}`, borderLeft:`4px solid ${C.yellow}`, borderRadius:12, padding:"14px 18px", marginBottom:18, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:800, color:C.redDark, fontSize:14 }}>🔔 {pendingOrders.length} New Orders from Agencies</div>
                  <div style={{ fontSize:12, color:"#92400e", marginTop:3 }}>
                    {pendingOrders.map(o => AGENCIES.find(a=>a.id===o.agencyId)?.name).join(" · ")}
                  </div>
                </div>
                <button className="btn btn-yellow" style={{ fontSize:12 }} onClick={() => setPage("orders")}>Review →</button>
              </div>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:18 }}>
              {/* Agency overview */}
              <div className="card">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:15, color:C.text }}>Agency Overview</div>
                  <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={() => setPage("agencies")}>View All →</button>
                </div>
                {AGENCIES.map(a => (
                  <div key={a.id} className="tr" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:8, cursor:"pointer" }}
                    onClick={() => { setPage("agencies"); setSelAgency(a); }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{a.name}</div>
                      <div style={{ fontSize:11, color:C.textLight }}>{a.city} · {a.totalShops} shops</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:800, fontSize:13, color:a.outstanding>0?C.red:"#065f46" }}>₹{a.outstanding.toLocaleString()}</div>
                      <Tag cls={`b${a.status==="active"?"a":"o"}`}>{a.status}</Tag>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent bills */}
              <div className="card">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:15, color:C.text }}>Recent Bills</div>
                  <button className="btn btn-red" style={{ fontSize:11 }} onClick={() => setPage("billing")}>+ Bill</button>
                </div>
                {BILLS.map(b => {
                  const ag = AGENCIES.find(a=>a.id===b.agencyId);
                  return (
                    <div key={b.id} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{ag?.name}</div>
                        <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                        <div style={{ fontSize:11, color:C.textLight }}>{b.date}</div>
                        <div style={{ fontWeight:800, fontSize:12, color:C.redDark }}>₹{b.total.toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {page==="orders" && (
          <div className="fi">
            <h1 className="page-title" style={{ fontSize:22, fontWeight:800, color:C.redDark, fontFamily:"'Playfair Display',serif", marginBottom:6 }}>Agency Orders</h1>
            <p style={{ color:C.textLight, fontSize:13, marginBottom:22 }}>Orders placed by agencies via the app</p>
            {ORDERS.map(o => {
              const ag = AGENCIES.find(a=>a.id===o.agencyId);
              return (
                <div key={o.id} className="card" style={{ marginBottom:14, borderLeft:`4px solid ${o.status==="pending"?C.yellow:C.red}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                        <Tag cls={`b${o.status==="pending"?"p":o.status==="approved"?"a":"o"}`}>{o.status}</Tag>
                        <span style={{ fontSize:10, background:"#f3e8ff", color:"#7c3aed", border:"1px solid #ddd6fe", borderRadius:20, padding:"2px 8px", fontWeight:700 }}>via App</span>
                      </div>
                      <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{ag?.name}</div>
                      <div style={{ fontSize:12, color:C.textLight }}>{o.date}</div>
                      {o.notes && <div style={{ fontSize:12, color:"#7c3aed", marginTop:4 }}>📝 {o.notes}</div>}
                    </div>
                    <div style={{ fontWeight:800, fontSize:20, color:C.redDark }}>₹{o.total.toLocaleString()}</div>
                  </div>
                  {o.status==="pending" && (
                    <div style={{ display:"flex", gap:10 }}>
                      <button className="btn btn-red" style={{ flex:1 }}>✓ Approve & Bill</button>
                      <button className="btn btn-ghost">✕ Reject</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* BILLING */}
        {page==="billing" && (
          <div className="fi">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <div>
                <h1 className="page-title" style={{ fontSize:22, fontWeight:800, color:C.redDark, fontFamily:"'Playfair Display',serif" }}>Billing</h1>
                <p style={{ color:C.textLight, fontSize:13 }}>All invoices</p>
              </div>
              <button className="btn btn-red">+ Create Bill</button>
            </div>
            <div className="stat-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
              <SC label="Total Billed" value={`₹${BILLS.reduce((s,b)=>s+b.total,0).toLocaleString()}`} icon="🧾" color={C.redDark} accent={C.red} />
              <SC label="Pending"      value={`₹${BILLS.filter(b=>b.status==="pending").reduce((s,b)=>s+b.total,0).toLocaleString()}`} icon="⏳" color="#d97706" accent={C.yellow} />
              <SC label="Collected"    value={`₹${BILLS.filter(b=>b.status==="paid").reduce((s,b)=>s+b.total,0).toLocaleString()}`} icon="✅" color="#065f46" accent="#10b981" />
            </div>
            <div className="card" style={{ padding:0 }}>
              <div className="agency-table-wrap">
                <div style={{ display:"grid", gridTemplateColumns:"1.2fr 2fr 2fr 1fr 1fr", gap:12, padding:"10px 18px", borderBottom:`1px solid ${C.border}`, background:"#fff8f8", borderRadius:"14px 14px 0 0" }}>
                  {["Bill No.","Agency","Items","Total","Status"].map(h=>(
                    <div key={h} style={{ fontSize:10, color:C.textLight, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.6px" }}>{h}</div>
                  ))}
                </div>
                {BILLS.map(b=>{
                  const ag=AGENCIES.find(a=>a.id===b.agencyId);
                  return(
                    <div key={b.id} className="tr" style={{ display:"grid", gridTemplateColumns:"1.2fr 2fr 2fr 1fr 1fr", gap:12, alignItems:"center" }}>
                      <div style={{ fontWeight:700, fontSize:12, color:C.red }}>{b.id}</div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{ag?.name}</div>
                      <div style={{ fontSize:11, color:C.textLight }}>{b.items}</div>
                      <div style={{ fontWeight:800, color:C.redDark }}>₹{b.total.toLocaleString()}</div>
                      <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* AGENCIES */}
        {page==="agencies" && !selAgency && (
          <div className="fi">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <div>
                <h1 className="page-title" style={{ fontSize:22, fontWeight:800, color:C.redDark, fontFamily:"'Playfair Display',serif" }}>Agencies</h1>
                <p style={{ color:C.textLight, fontSize:13 }}>{AGENCIES.length} agencies · Saurashtra region</p>
              </div>
              <button className="btn btn-red">+ Add Agency</button>
            </div>
            <div className="card" style={{ padding:0 }}>
              <div className="agency-table-wrap">
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr 80px", gap:10, padding:"10px 18px", borderBottom:`1px solid ${C.border}`, background:"#fff8f8", borderRadius:"14px 14px 0 0" }}>
                  {["Agency","Owner","Outstanding","Shops","Status"].map(h=>(
                    <div key={h} style={{ fontSize:10, color:C.textLight, fontWeight:700, textTransform:"uppercase" }}>{h}</div>
                  ))}
                </div>
                {AGENCIES.map(a=>(
                  <div key={a.id} className="tr" style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr 80px", gap:10, alignItems:"center", cursor:"pointer" }}
                    onClick={()=>setSelAgency(a)}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{a.name}</div>
                      <div style={{ fontSize:11, color:C.textLight }}>{a.city}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:C.text }}>{a.owner}</div>
                      <div style={{ fontSize:11, color:C.textLight }}>{a.phone}</div>
                    </div>
                    <div style={{ fontWeight:800, color:a.outstanding>0?C.red:"#065f46" }}>₹{a.outstanding.toLocaleString()}</div>
                    <div style={{ fontSize:12, color:C.textMid }}>{a.totalShops} shops</div>
                    <Tag cls={`b${a.status==="active"?"a":"o"}`}>{a.status}</Tag>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AGENCY DETAIL */}
        {page==="agencies" && selAgency && (
          <div className="fi">
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:22 }}>
              <button className="btn btn-ghost" onClick={()=>setSelAgency(null)}>← Back</button>
              <div>
                <h1 style={{ fontSize:20, fontWeight:800, color:C.redDark, fontFamily:"'Playfair Display',serif" }}>{selAgency.name}</h1>
                <p style={{ color:C.textLight, fontSize:13 }}>{selAgency.city}</p>
              </div>
              <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
                <button className="btn btn-red">+ New Bill</button>
                <a href={`https://wa.me/91${selAgency.phone?.replace(/\D/g,"")}`} target="_blank" rel="noreferrer">
                  <button className="btn btn-yellow">💬 WhatsApp</button>
                </a>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>
              <div className="card">
                <div style={{ fontWeight:800, marginBottom:14, color:C.text }}>📋 Profile</div>
                {[["Owner",selAgency.owner],["Phone",selAgency.phone],["City",selAgency.city]].map(([k,v])=>(
                  <div key={k} style={{ display:"grid", gridTemplateColumns:"90px 1fr", gap:8, marginBottom:10 }}>
                    <div style={{ fontSize:10, color:C.textLight, fontWeight:700, textTransform:"uppercase" }}>{k}</div>
                    <div style={{ fontSize:13, color:C.text }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{ fontWeight:800, marginBottom:14, color:C.text }}>💰 Financials</div>
                {[
                  ["Credit Limit",`₹${selAgency.creditLimit.toLocaleString()}`, C.red],
                  ["Outstanding", `₹${selAgency.outstanding.toLocaleString()}`, selAgency.outstanding>0?C.red:"#065f46"],
                  ["Total Shops", selAgency.totalShops, C.text],
                ].map(([k,v,color])=>(
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.textLight }}>{k}</span>
                    <span style={{ fontWeight:800, fontSize:14, color }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding:0 }}>
              <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.border}`, fontWeight:800, color:C.text, background:"#fff8f8", borderRadius:"14px 14px 0 0" }}>🧾 Bills</div>
              {BILLS.filter(b=>b.agencyId===selAgency.id).map(b=>(
                <div key={b.id} className="tr" style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr 80px", gap:12, alignItems:"center" }}>
                  <div style={{ fontWeight:700, fontSize:12, color:C.red }}>{b.id}</div>
                  <div style={{ fontSize:11, color:C.textLight }}>{b.items}</div>
                  <div style={{ fontWeight:800, color:C.redDark }}>₹{b.total.toLocaleString()}</div>
                  <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VEHICLES */}
        {page==="vehicles" && (
          <div className="fi">
            <h1 className="page-title" style={{ fontSize:22, fontWeight:800, color:C.redDark, fontFamily:"'Playfair Display',serif", marginBottom:22 }}>Vehicles</h1>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
              {[
                { id:"V01", name:"GJ-03-AB-1234", driver:"Ramesh Bhai", status:"on-route", route:"Rajkot → Jamnagar" },
                { id:"V02", name:"GJ-03-CD-5678", driver:"Suresh Patel", status:"idle", route:null },
                { id:"V03", name:"GJ-03-EF-9012", driver:"Dinesh Mer", status:"on-route", route:"Factory → Junagadh" },
                { id:"V04", name:"GJ-03-GH-3456", driver:"Vijay Bhai", status:"idle", route:null },
              ].map(v=>(
                <div key={v.id} className="card" style={{ borderLeft:`4px solid ${v.status==="on-route"?C.red:C.yellow}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                    <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{v.name}</div>
                    <Tag cls={v.status==="on-route"?"ba":"bp"}>{v.status}</Tag>
                  </div>
                  <div style={{ fontSize:12, color:C.textMid }}>Driver: <b>{v.driver}</b></div>
                  <div style={{ fontSize:11, color:v.route?C.red:C.textLight, marginTop:4 }}>{v.route||"Idle at factory"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("signin"); // signin | signup | dashboard
  const [user, setUser] = useState(null);

  if (screen === "signup") return <SignupScreen onDone={u => { if(u){setUser(u);setScreen("dashboard");}else setScreen("signin"); }} />;
  if (screen === "signin") return <SigninScreen onLogin={u => { setUser(u); setScreen("dashboard"); }} onSignup={() => setScreen("signup")} />;
  return <Dashboard user={user} onLogout={() => { setUser(null); setScreen("signin"); }} />;
}
