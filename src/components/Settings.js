// src/components/Settings.js
import { useState, useEffect } from "react";
import api from "../api";

import { C, ITEM_CATALOG } from "../constants";
import { PageHeader, Spin, Lbl } from "./UI";

export function SettingsPage({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [showCode, setShowCode] = useState(false);

  // Settings state
  const [signup, setSignup] = useState({ secretCode: "" });
  const [biz, setBiz] = useState({ companyName: "", address: "", phone: "", gstin: "" });
  const [bank, setBank] = useState({ bankName: "", accountNo: "", ifsc: "" });

  // Backup for cancel
  const [origSignup, setOrigSignup] = useState({});
  const [origBiz, setOrigBiz] = useState({});
  const [origBank, setOrigBank] = useState({});

  // ── Product catalog management state ──────────────────────────────────────
  const [prodCount, setProdCount] = useState(null);
  const [seedFlag, setSeedFlag] = useState(null);  // productsSeedDone value
  const [reseedLoading, setReseedLoading] = useState(false);
  const [reseedMsg, setReseedMsg] = useState({ text: "", type: "" });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await api.get("/settings");
        if (res.success && res.data) {
          const { signup: sG, business: bG, bank: baG, appConfig: appG } = res.data;
          if (sG) { setSignup(sG); setOrigSignup(sG); }
          if (bG) { setBiz(bG); setOrigBiz(bG); }
          if (baG) { setBank(baG); setOrigBank(baG); }
          if (appG) { setSeedFlag(appG.productsSeedDone); }
        }

        // Count products
        try {
          const prodRes = await api.get("/products");
          if (prodRes.success) setProdCount(prodRes.data.length);
        } catch (e) {}
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
      const res = await api.put("/settings", {
        signup,
        business: biz,
        bank
      });
      if (res.success) {
        setOrigSignup({ ...signup });
        setOrigBiz({ ...biz });
        setOrigBank({ ...bank });
        setMsg({ text: "All settings saved successfully!", type: "ok" });
        setEditing(false);
        setTimeout(() => setMsg({ text: "", type: "" }), 3000);
      }
    } catch (e) {
      console.error(e);
      setMsg({ text: "Failed to save settings.", type: "err" });
    }
    setSaving(false);
  }

  // ── Re-seed products — owner only ─────────────────────────────────────────
  // Step 1: Clears productsSeedDone and cleanedDuplicates flags in appConfig.
  // Step 2: Deletes ALL existing products from Firestore.
  // Step 3: Re-seeds all 216 items from ITEM_CATALOG fresh.
  // After this, the Dashboard listener will NOT auto-seed again (flags are reset
  // and re-set after seeding completes here directly).
  async function handleReseed() {
    alert("Re-seeding is disabled in the Node.js backend migration version to prevent accidental data loss.");
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

        {/* ── Signup Code ── */}
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

        {/* ── Business Info ── */}
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

        {/* ── Bank Details ── */}
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

        {/* ── Product Catalog Management — Owner only ── */}
        <div className="card" style={{ borderLeft: `4px solid ${C.yellow}` }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>📦 Product Catalog Management</div>
          <div style={{ fontSize: 13, color: C.textLight, marginBottom: 16 }}>
            Manage the default product catalog. Use re-seed only if products are corrupted or missing.
          </div>

          {/* Status row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Products in Database</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.redDark }}>
                {prodCount === null ? <Spin /> : prodCount}
              </div>
            </div>
            <div style={{ background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Catalog Status</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>
                {seedFlag === true
                  ? <span style={{ color: "#065f46" }}>✅ Seeded & Protected</span>
                  : <span style={{ color: "#d97706" }}>⚠️ Not yet protected</span>
                }
              </div>
            </div>
          </div>

          {/* Info box */}
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400e" }}>
            <strong>⚠️ Warning:</strong> Re-seeding will permanently delete all {prodCount} existing products and replace them with {ITEM_CATALOG.length} default catalog items. Any custom products or rate changes you made will be lost.
          </div>

          {reseedMsg.text && (
            <div className={reseedMsg.type === "err" ? "err-box" : "ok-box"} style={{ marginBottom: 12 }}>
              {reseedMsg.text}
            </div>
          )}

          <button
            className="btn btn-danger"
            style={{ fontSize: 13, padding: "10px 20px" }}
            onClick={handleReseed}
            disabled={reseedLoading}
          >
            {reseedLoading
              ? <><Spin /> Re-seeding ({ITEM_CATALOG.length} items)...</>
              : `🔄 Re-seed from Default Catalog (${ITEM_CATALOG.length} items)`
            }
          </button>
        </div>

      </div>
    </div>
  );
}