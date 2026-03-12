// src/components/UI.js
// Shared tiny UI components used across the whole app

const LOGO_URL = "/logo.png";

export function Lbl({ children }) {
  return <label className="lbl">{children}</label>;
}

export function Tag({ children, cls }) {
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function Spin() {
  return <span className="spin" style={{ fontSize: 16 }}>⏳</span>;
}

export function Logo({ size = 48, showText = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img
        src={LOGO_URL}
        alt="logo"
        style={{ height: size, width: "auto", objectFit: "contain", filter: "drop-shadow(0 2px 6px rgba(200,24,30,0.3))" }}
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

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="mo" onClick={e => e.target.className === "mo" && onClose()}>
      <div className="mbox su" style={wide ? { width: 820 } : {}}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: "#9e1015", fontWeight: 800 }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#a07070", lineHeight: 1 }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SC({ label, value, sub, icon, color, accent }) {
  return (
    <div className="sc" style={{ borderTop: `3px solid ${accent || "#c8181e"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: "#a07070", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: color || "#1a0505" }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: "#a07070", marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 28, opacity: 0.85 }}>{icon}</div>
      </div>
    </div>
  );
}

export function OtpInput({ value, onChange }) {
  const digits = (value + "      ").slice(0, 6).split("");
  function hk(i, e) {
    const d   = e.target.value.replace(/\D/g, "").slice(-1);
    const arr = (value + "      ").slice(0, 6).split("");
    arr[i]    = d || " ";
    onChange(arr.join("").trimEnd());
    if (d && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
    if (!d && e.nativeEvent.inputType === "deleteContentBackward" && i > 0)
      document.getElementById(`otp-${i - 1}`)?.focus();
  }
  return (
    <div className="otp-wrap">
      {digits.map((d, i) => (
        <input
          key={i} id={`otp-${i}`} className="otp-inp"
          maxLength={1} value={d.trim()}
          onChange={e => hk(i, e)} inputMode="numeric"
        />
      ))}
    </div>
  );
}

// Page header used in all dashboard sections
export function PageHeader({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
      <div>
        <h1 className="page-title" style={{ fontSize: 22, fontWeight: 800, color: "#9e1015", fontFamily: "'Playfair Display',serif" }}>
          {title}
        </h1>
        {sub && <p style={{ color: "#a07070", fontSize: 13, marginTop: 3 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
