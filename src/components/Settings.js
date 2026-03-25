// src/components/Settings.js
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { C } from "../constants";
import { PageHeader, Spin, Lbl } from "./UI";

export function SettingsPage({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg]         = useState({ text: "", type: "" });
  const [showCode, setShowCode] = useState(false);

  // States for each section
  const [signup, setSignup] = useState({ secretCode: "" });
  const [biz, setBiz]       = useState({ companyName: "", address: "", phone: "", gstin: "" });
  const [bank, setBank]     = useState({ bankName: "", accountNo: "", ifsc: "" });

  // Backup for cancel
  const [origSignup, setOrigSignup] = useState({});
  const [origBiz, setOrigBiz]       = useState({});
  const [origBank, setOrigBank]     = useState({});

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [sG, bG, baG] = await Promise.all([
          getDoc(doc(db, "settings", "signup")),
          getDoc(doc(db, "settings", "business")),
          getDoc(doc(db, "settings", "bank"))
        ]);
        if (sG.exists()) { setSignup(sG.data()); setOrigSignup(sG.data()); }
        if (bG.exists()) { setBiz(bG.data()); setOrigBiz(bG.data()); }
        if (baG.exists()) { setBank(baG.data()); setOrigBank(baG.data()); }
      } catch (e) {
        console.error("Error loading settings:", e);
        setMsg({ text: "Failed to load settings.", type: "err" });
      }
      setLoading(false);
    }
    fetchSettings();
  }, []);

  function startEditing() {
    setOrigSignup({ ...signup });
    setOrigBiz({ ...biz });
    setOrigBank({ ...bank });
    setEditing(true);
  }

  function cancelEditing() {
    setSignup(origSignup);
    setBiz(origBiz);
    setBank(origBank);
    setEditing(false);
    setMsg({ text: "", type: "" });
  }

  async function handleSaveAll() {
    setSaving(true);
    setMsg({ text: "", type: "" });
    try {
      const meta = { updatedAt: serverTimestamp(), updatedBy: currentUser?.name || "Owner" };
      await Promise.all([
        setDoc(doc(db, "settings", "signup"),   { ...signup, ...meta }),
        setDoc(doc(db, "settings", "business"), { ...biz, ...meta }),
        setDoc(doc(db, "settings", "bank"),     { ...bank, ...meta }),
      ]);
      setOrigSignup({ ...signup });
      setOrigBiz({ ...biz });
      setOrigBank({ ...bank });
      setMsg({ text: "All settings saved successfully!", type: "ok" });
      setEditing(false);
      setTimeout(() => setMsg({ text: "", type: "" }), 3000);
    } catch (e) {
      console.error(e);
      setMsg({ text: "Failed to save settings.", type: "err" });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="fi" style={{ padding: 40, textAlign: "center", color: C.textLight }}>
        <Spin /> Loading settings...
      </div>
    );
  }

  // Read-only field display
  const InfoRow = ({ label, value, hidden }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{hidden ? "••••••••" : (value || "—")}</span>
    </div>
  );

  return (
    <div className="fi">
      <PageHeader
        title="Settings ⚙️"
        sub="Manage application configuration"
        action={
          !editing ? (
            <button className="btn btn-red" onClick={startEditing}>✏️ Edit Settings</button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-red" onClick={handleSaveAll} disabled={saving}>
                {saving ? <Spin /> : "💾 Save All"}
              </button>
              <button className="btn btn-ghost" onClick={cancelEditing} disabled={saving}>Cancel</button>
            </div>
          )
        }
      />

      {msg.text && (
        <div className={msg.type === "err" ? "err-box" : "ok-box"} style={{ marginBottom: 16 }}>
          {msg.type === "err" ? "⚠️" : "✅"} {msg.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, maxWidth: 640 }}>
        
        {/* Signup Code */}
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>🔐 Signup Secret Code</div>
          <div style={{ fontSize: 13, color: C.textLight, marginBottom: 14 }}>Code required for new staff to create an account.</div>
          
          {editing ? (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Lbl>Secret Code</Lbl>
                <input 
                  className="inp" 
                  type={showCode ? "text" : "password"} 
                  value={signup.secretCode} 
                  onChange={e => setSignup({ ...signup, secretCode: e.target.value })} 
                  placeholder="e.g. VRUNDAVAN2026" 
                  style={{ paddingRight: 40 }}
                />
                <button onClick={() => setShowCode(!showCode)} style={{ position: "absolute", right: 12, top: "60%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                  {showCode ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          ) : (
            <InfoRow label="Secret Code" value={signup.secretCode} hidden={!showCode} />
          )}
        </div>

        {/* Business Info */}
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>🏢 Business Information</div>
          <div style={{ fontSize: 13, color: C.textLight, marginBottom: 14 }}>Printed on the header of all invoices.</div>
          
          {editing ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <Lbl>Company Name</Lbl>
                  <input className="inp" value={biz.companyName || ""} onChange={e => setBiz({ ...biz, companyName: e.target.value })} placeholder="VRUNDAVAN MILK PRODUCTS" />
                </div>
                <div>
                  <Lbl>Phone (Mo:)</Lbl>
                  <input className="inp" value={biz.phone || ""} onChange={e => setBiz({ ...biz, phone: e.target.value })} placeholder="95125 50255" />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Lbl>Address / Location</Lbl>
                <input className="inp" value={biz.address || ""} onChange={e => setBiz({ ...biz, address: e.target.value })} placeholder="DHORAJI ROAD, KALAVAD (SHITALA)" />
              </div>
              <div>
                <Lbl>GSTIN Number</Lbl>
                <input className="inp" value={biz.gstin || ""} onChange={e => setBiz({ ...biz, gstin: e.target.value })} placeholder="24AA..." />
              </div>
            </>
          ) : (
            <>
              <InfoRow label="Company Name" value={biz.companyName} />
              <InfoRow label="Phone" value={biz.phone} />
              <InfoRow label="Address" value={biz.address} />
              <InfoRow label="GSTIN" value={biz.gstin} />
            </>
          )}
        </div>

        {/* Bank Details */}
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>🏦 Bank Details</div>
          <div style={{ fontSize: 13, color: C.textLight, marginBottom: 14 }}>Printed on the footer of invoices and WhatsApp messages.</div>
          
          {editing ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <Lbl>Bank Name</Lbl>
                <input className="inp" value={bank.bankName || ""} onChange={e => setBank({ ...bank, bankName: e.target.value })} placeholder="AXIS BANK LTD" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Lbl>Account Number</Lbl>
                  <input className="inp" value={bank.accountNo || ""} onChange={e => setBank({ ...bank, accountNo: e.target.value })} placeholder="00000000000000" />
                </div>
                <div>
                  <Lbl>IFSC Code</Lbl>
                  <input className="inp" value={bank.ifsc || ""} onChange={e => setBank({ ...bank, ifsc: e.target.value })} placeholder="UTIB0001316" />
                </div>
              </div>
            </>
          ) : (
            <>
              <InfoRow label="Bank Name" value={bank.bankName} />
              <InfoRow label="Account No" value={bank.accountNo} />
              <InfoRow label="IFSC Code" value={bank.ifsc} />
            </>
          )}
        </div>

      </div>
    </div>
  );
}
