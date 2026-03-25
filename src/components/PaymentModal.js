// src/components/PaymentModal.js
import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { computeBalance } from "../helpers";
import { Lbl, Modal, Spin } from "./UI";

const C = {
  red: "#c8181e", redDark: "#9e1015", yellow: "#f5c518",
  text: "#1a0505", textLight: "#a07070", textMid: "#6b3333", border: "#f0dada",
};

// ── WhatsApp payment message ──────────────────────────────────────────────────
function paymentWhatsApp(agency, prevBal, cashAmt, bankAmt, newBal, recordedBy) {
  const total       = cashAmt + bankAmt;
  const currOutstanding = Math.max(0, newBal);  // after payment; 0 if advance
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  let msg = `*VRUNDAVAN MILK PRODUCTS*\n`;
  msg += `DHORAJI ROAD, KALAVAD (SHITALA)\n`;
  msg += `Mo: 95125 50255\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `*PAYMENT RECEIVED*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Agency  : *${agency.name}*\n`;
  msg += `City    : ${agency.city || ""}\n`;
  msg += `Date    : ${date}\n\n`;
  msg += `*Payment Details:*\n`;
  if (cashAmt > 0) msg += `  Cash         : Rs. ${cashAmt.toLocaleString()}\n`;
  if (bankAmt > 0) msg += `  Bank Transfer : Rs. ${bankAmt.toLocaleString()}\n`;
  msg += `  *Total Paid   : Rs. ${total.toLocaleString()}*\n\n`;
  msg += `*Account Summary:*\n`;
  msg += `  Previous Outstanding : Rs. ${prevBal.toLocaleString()}\n`;
  msg += `  Amount Paid          : Rs. ${total.toLocaleString()}\n`;
  msg += `  *Current Outstanding : Rs. ${currOutstanding.toLocaleString()}*\n`;
  if (newBal < 0) msg += `  (Advance Credit : Rs. ${Math.abs(newBal).toLocaleString()})\n`;
  msg += `\nRecorded by: ${recordedBy}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Thank you!`;

  const phone = agency.phone?.replace(/\D/g, "");
  const url   = `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

// ── PAYMENT MODAL ─────────────────────────────────────────────────────────────
export function PaymentModal({ agency, onClose, currentUser, bills = [], payments = [] }) {
  // Live balance — same as agency page (positive = they owe us)
  const prevBal = Math.max(0, computeBalance(agency.id, bills, payments));

  const [mode,     setMode]     = useState("cash");   // "cash" | "bank" | "both"
  const [cashAmt,  setCashAmt]  = useState("");
  const [bankAmt,  setBankAmt]  = useState("");
  const [notes,    setNotes]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");
  const [saved,    setSaved]    = useState(null);

  const cash    = Number(cashAmt) || 0;
  const bank    = Number(bankAmt) || 0;
  const total   = mode === "cash" ? cash : mode === "bank" ? bank : cash + bank;
  const newBal  = prevBal - total;
  const isOver  = newBal < 0;

  function validate() {
    if (mode === "cash" && cash <= 0)               return setErr("Enter cash amount.");
    if (mode === "bank" && bank <= 0)               return setErr("Enter bank transfer amount.");
    if (mode === "both" && (cash <= 0 || bank <= 0)) return setErr("Enter both cash and bank amounts.");
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setLoading(true); setErr("");
    try {
      const finalCash = mode === "bank" ? 0 : cash;
      const finalBank = mode === "cash" ? 0 : bank;
      const finalTotal = finalCash + finalBank;
      const finalNewBal = prevBal - finalTotal;

      // 1. Save payment doc
      const payRef = await addDoc(collection(db, "payments"), {
        agencyId:     agency.id,
        agencyName:   agency.name,
        cashAmt:      finalCash,
        bankAmt:      finalBank,
        total:        finalTotal,
        prevBalance:  prevBal,
        newBalance:   finalNewBal,
        notes,
        recordedBy:   currentUser?.name || "",
        recordedByUid:currentUser?.uid  || "",
        createdAt:    serverTimestamp(),
      });

      // 2. Write to agency's transactions subcollection
      await addDoc(collection(db, "agencies", agency.id, "transactions"), {
        type:        "payment",
        paymentId:   payRef.id,
        cashAmt:     finalCash,
        bankAmt:     finalBank,
        amount:      finalTotal,
        prevBalance: prevBal,
        balance:     finalNewBal,
        notes,
        recordedBy:  currentUser?.name || "",
        createdAt:   serverTimestamp(),
      });

      setSaved({ finalCash, finalBank, finalTotal, finalNewBal, snapPrevBal: prevBal });
    } catch (e) {
      console.error(e);
      setErr("Failed to save payment. Please try again.");
      setLoading(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (saved) return (
    <Modal title="✅ Payment Recorded!" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "10px 0 24px" }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>💰</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#065f46", marginBottom: 4 }}>
          Rs. {saved.finalTotal.toLocaleString()}
        </div>
        <div style={{ fontSize: 14, color: C.textLight, marginBottom: 20 }}>received from {agency.name}</div>

        {/* Summary */}
        <div style={{ background: "#f8fffe", border: "1px solid #a7f3d0", borderRadius: 12, padding: "14px 20px", marginBottom: 20, textAlign: "left" }}>
          {saved.finalCash > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
              <span style={{ color: C.textLight }}>💵 Cash</span>
              <span style={{ fontWeight: 700 }}>Rs. {saved.finalCash.toLocaleString()}</span>
            </div>
          )}
          {saved.finalBank > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
              <span style={{ color: C.textLight }}>🏦 Bank Transfer</span>
              <span style={{ fontWeight: 700 }}>Rs. {saved.finalBank.toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 6, borderTop: `1px dashed ${C.border}`, fontSize: 13 }}>
            <span style={{ color: C.textLight }}>Previous Outstanding</span>
            <span style={{ fontWeight: 700 }}>Rs. {saved.snapPrevBal.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 15, fontWeight: 800 }}>
            <span style={{ color: saved.finalNewBal <= 0 ? "#065f46" : C.red }}>Current Outstanding</span>
            <span style={{ color: saved.finalNewBal <= 0 ? "#065f46" : C.red }}>
              Rs. {Math.max(0, saved.finalNewBal).toLocaleString()}
              {saved.finalNewBal < 0 ? " (Advance)" : ""}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-green" style={{ fontSize: 13, padding: "10px 20px" }}
            onClick={() => paymentWhatsApp(agency, saved.snapPrevBal, saved.finalCash, saved.finalBank, saved.finalNewBal, currentUser?.name || "Staff")}>
            💬 Send WhatsApp
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );

  // ── Payment form ──────────────────────────────────────────────────────────
  return (
    <Modal title={`💰 Record Payment — ${agency.name}`} onClose={onClose}>

      {/* Current outstanding */}
      <div style={{ background: prevBal > 0 ? "#fff3cd" : "#ecfdf5", border: `1px solid ${prevBal > 0 ? "#ffc107" : "#a7f3d0"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: C.textMid, fontWeight: 700 }}>Current Outstanding</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: prevBal > 0 ? "#d97706" : "#065f46" }}>
          Rs. {prevBal.toLocaleString()}
        </span>
      </div>

      {/* Payment mode */}
      <div style={{ marginBottom: 18 }}>
        <Lbl>Payment Mode</Lbl>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { val: "cash", icon: "💵", label: "Cash" },
            { val: "bank", icon: "🏦", label: "Bank Transfer" },
            { val: "both", icon: "💵🏦", label: "Both" },
          ].map(m => (
            <div key={m.val}
              onClick={() => { setMode(m.val); setErr(""); }}
              style={{ padding: "12px 10px", borderRadius: 10, border: `2px solid ${mode === m.val ? C.red : C.border}`, background: mode === m.val ? "#fff0f0" : "#fff", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: mode === m.val ? C.red : C.textMid }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Amount inputs */}
      {(mode === "cash" || mode === "both") && (
        <div style={{ marginBottom: 14 }}>
          <Lbl>Cash Amount (Rs.)</Lbl>
          <input className="inp" type="number" min="1" placeholder="e.g. 5000"
            value={cashAmt} onChange={e => { setCashAmt(e.target.value); setErr(""); }}
            style={{ fontSize: 16, fontWeight: 700 }} />
        </div>
      )}
      {(mode === "bank" || mode === "both") && (
        <div style={{ marginBottom: 14 }}>
          <Lbl>Bank Transfer Amount (Rs.)</Lbl>
          <input className="inp" type="number" min="1" placeholder="e.g. 10000"
            value={bankAmt} onChange={e => { setBankAmt(e.target.value); setErr(""); }}
            style={{ fontSize: 16, fontWeight: 700 }} />
        </div>
      )}

      {/* Live preview */}
      {total > 0 && (
        <div style={{ background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: C.textLight }}>Total Payment</span>
            <span style={{ fontWeight: 800, color: C.redDark }}>Rs. {total.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, paddingTop: 6, borderTop: `1px dashed ${C.border}` }}>
            <span style={{ color: isOver ? "#065f46" : C.red }}>
              {isOver ? "Advance Balance" : "New Outstanding"}
            </span>
            <span style={{ color: isOver ? "#065f46" : C.red }}>
              Rs. {Math.abs(newBal).toLocaleString()}
            </span>
          </div>
          {isOver && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#065f46", background: "#ecfdf5", padding: "6px 10px", borderRadius: 6 }}>
              🎉 Overpayment of Rs. {Math.abs(newBal).toLocaleString()} will be saved as advance balance.
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Lbl>Notes (optional)</Lbl>
        <input className="inp" placeholder="e.g. Festival payment, partial payment..."
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <div className="err-box">⚠️ {err}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-red" style={{ flex: 1, padding: 12 }} onClick={handleSave} disabled={loading}>
          {loading ? <><Spin /> Saving...</> : "💾 Record Payment"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}