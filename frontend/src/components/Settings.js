// src/components/Settings.js
import { useState, useEffect } from "react";
import api from "../api";

import { C } from "../constants";
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

  const [prodCount, setProdCount] = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await api.get("/settings");

        // The API wraps it: data.settings.business — NOT data.business.
        // Reading the wrong level meant NOTHING loaded: every field stayed at its empty
        // default, the page rendered blank, and hitting "Save All" PUT those blanks back,
        // WIPING the company and bank details. Which is also why invoices shared over
        // WhatsApp were going out with no company name. (Server-rendered PDFs were fine —
        // pdf.service loads Settings itself.)
        const s = res.success ? res.data?.settings : null;
        if (s) {
          // `signup` is only present for the owner — the server strips it for everyone
          // else, so the secret code never reaches a manager's browser.
          if (s.signup)   { setSignup(s.signup);   setOrigSignup(s.signup); }
          if (s.business) { setBiz(s.business);    setOrigBiz(s.business); }
          if (s.bank)     { setBank(s.bank);       setOrigBank(s.bank); }
        }

        const prodRes = await api.get("/products");
        if (prodRes.success) setProdCount(prodRes.data.total ?? prodRes.data.products?.length ?? 0);
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
    if (signup.secretCode !== undefined && signup.secretCode.trim().length < 8) {
      return setMsg({ text: "The signup secret code must be at least 8 characters.", type: "err" });
    }

    setSaving(true);
    setMsg({ text: "", type: "" });
    try {
      const res = await api.put("/settings", {
        // Only the owner ever holds `signup` (the server strips it for everyone else), so
        // only send it when we actually have it — otherwise a manager's save would blank it.
        ...(signup?.secretCode ? { signup } : {}),
        business: biz,
        bank,
      });
      if (res.success) {
        setOrigSignup({ ...signup });
        setOrigBiz({ ...biz });
        setOrigBank({ ...bank });
        setMsg({ text: "Settings saved.", type: "ok" });
        setEditing(false);
        setTimeout(() => setMsg({ text: "", type: "" }), 3000);
      }
    } catch (e) {
      setMsg({ text: e.errors?.[0]?.message || e.message || "Failed to save settings.", type: "err" });
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

        {/* ── Signup Code — owner only ──────────────────────────────────────
            The server strips `signup` from GET /api/settings for anyone who isn't the
            owner, so a manager never receives the code at all and this card never renders
            for them. It used to be returned to EVERY logged-in user, and Dashboard fetches
            settings on load — so the plaintext code was sitting in every manager's browser. */}
        {currentUser?.role === "owner" && (
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>🔐 Signup Secret Code</div>
          <div style={{ fontSize: 13, color: C.textLight, marginBottom: 10 }}>
            Anyone with this code can create a <strong>manager</strong> account. Change it if it leaks.
          </div>
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "9px 13px", marginBottom: 14, fontSize: 12, color: "#065f46" }}>
            ✓ Changing this takes effect <strong>immediately</strong>. The old code stops working at once.
          </div>

          {editing ? (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Lbl>Secret Code</Lbl>
                <input
                  className="inp"
                  type={showCode ? "text" : "password"}
                  value={signup.secretCode || ""}
                  onChange={e => { setSignup({ ...signup, secretCode: e.target.value }); setMsg({ text: "", type: "" }); }}
                  placeholder="At least 8 characters"
                  style={{ paddingRight: 40 }}
                />
                <button onClick={() => setShowCode(!showCode)} style={{ position: "absolute", right: 12, top: "60%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                  {showCode ? "🙈" : "👁️"}
                </button>
                {signup.secretCode && signup.secretCode.trim().length < 8 && (
                  <div style={{ color: C.red, fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                    Must be at least 8 characters
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <InfoRow label="Secret Code" value={signup.secretCode} hidden={!showCode} />
              </div>
              <button onClick={() => setShowCode(!showCode)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                {showCode ? "🙈" : "👁️"}
              </button>
            </div>
          )}
        </div>
        )}

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

        {/* ── Product Catalogue ────────────────────────────────────────────
            The "Re-seed from Default Catalog" button that used to live here is GONE, and
            so is the endpoint behind it. It called Product.deleteMany({}) — a hard delete —
            and since the inventory module shipped, products are referenced by ObjectId from
            StockMovement.productId and Bill.items[].productId. Re-seeding would have
            orphaned the entire stock ledger and every historical bill line. (The button was
            already inert: it only popped an alert saying re-seeding was disabled. But the
            live route behind it was one re-enable away from destroying the data.) */}
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>📦 Product Catalogue</div>
          <div style={{ fontSize: 13, color: C.textLight, marginBottom: 14 }}>
            Products are managed individually from the Products page.
          </div>

          <div style={{ background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Active Products</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.redDark }}>
              {prodCount === null ? <Spin /> : prodCount}
            </div>
          </div>

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e" }}>
            <strong>Bulk re-seeding has been removed.</strong> It deleted every product outright,
            which would now orphan the stock ledger and every past bill line that points at them.
            To retire a product, deactivate it on the Products page — that keeps its history intact.
          </div>
        </div>

      </div>
    </div>
  );
}