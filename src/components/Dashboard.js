// src/components/Dashboard.js
import { useState, useEffect } from "react";
import { signOut }              from "firebase/auth";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, getDocs,
} from "firebase/firestore";
import { auth, db }              from "../firebase";
import { C }                     from "../constants";
import { computeBalance, balanceDisplay, genInvNo, printInvoice, shareWhatsApp } from "../helpers";
import { Tag, SC, Logo, PageHeader }  from "./UI";
import { AgencyModal }           from "./AgencyModal";
import { CreateBillModal }       from "./BillModal";
import { PaymentModal }          from "./PaymentModal";
import { VehiclesPage }          from "./Vehicles";

// ── Agency Invoice History Modal ──────────────────────────────────────────────
function AgencyHistoryModal({ agency, bills, onClose }) {
  const ab    = bills.filter(b => b.agencyId === agency.id);
  const now   = new Date();
  const thisM = ab.filter(b => {
    const d = b.createdAt?.toDate?.();
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const mAmt = thisM.reduce((s, b) => s + (b.total || 0), 0);
  const tAmt = ab.reduce((s, b) => s + (b.total || 0), 0);

  return (
    <div className="mo" onClick={e => e.target.className === "mo" && onClose()}>
      <div className="mbox su" style={{ width: 820 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.redDark, fontWeight: 800 }}>
            📋 Invoice History — {agency.name}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textLight }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "This Month",   value: `Rs.${mAmt.toLocaleString()}`, icon: "📅", col: C.redDark,  bg: "#fff0f0" },
            { label: "Total Billed", value: `Rs.${tAmt.toLocaleString()}`, icon: "🧾", col: "#1e40af",  bg: "#eff6ff" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: s.col }}>{s.value}</div>
            </div>
          ))}
        </div>
        {ab.length === 0
          ? <div style={{ textAlign: "center", padding: 32, color: C.textLight }}>No invoices yet.</div>
          : <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 60px 60px", gap: 8, padding: "10px 14px", background: "#fff8f8", borderBottom: `1px solid ${C.border}` }}>
                {["Bill No", "Date", "Total", "PDF", "WA"].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
              {ab.map(b => (
                <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 60px 60px", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                  <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                  <div style={{ fontWeight: 800, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                  <button className="btn btn-yellow" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => printInvoice(b, agency)}>🖨️</button>
                  <button className="btn btn-green"  style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => shareWhatsApp(b, agency)}>💬</button>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// ── Transaction History Modal ─────────────────────────────────────────────────
function TransactionHistoryModal({ agency, txns, loading, onClose, bills, agencies, payments }) {
  const [detail, setDetail] = useState(null);

  // Live balance from top-level bills + payments
  const totalBilled = bills.filter(b => b.agencyId === agency.id).reduce((s, b) => s + (b.total || 0), 0);
  const totalPaid   = payments.filter(p => p.agencyId === agency.id).reduce((s, p) => s + (p.total || 0), 0);
  const liveBal     = totalBilled - totalPaid;
  const bd          = balanceDisplay(liveBal);

  // ── Bill detail view ──────────────────────────────────────────────────────
  if (detail?.type === "bill") {
    const b  = bills.find(x => x.id === detail.data.billId) || detail.data;
    const ag = agencies.find(a => a.id === b.agencyId) || agency;
    const prevBal    = Number(b.prevBalance) || 0;
    const advUsed    = Number(b.advanceUsed) || 0;
    const billAmt    = Number(b.total) || 0;
    const grandTotal = billAmt + prevBal - advUsed;
    return (
      <div className="mo" onClick={e => e.target.className === "mo" && onClose()}>
        <div className="mbox su" style={{ width: 640, maxHeight: "88vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setDetail(null)}>← Back to History</button>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: C.redDark, fontWeight: 800 }}>🧾 Bill Detail</div>
            <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textLight }}>✕</button>
          </div>
          <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[["Bill No", b.billNo], ["Agency", b.agencyName || agency.name], ["Date", b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"], ["Created By", b.createdByName || "—"]].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Items table */}
          <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 90px", gap: 8, padding: "8px 14px", background: "#fef0f0", borderBottom: `1px solid ${C.border}` }}>
              {["Product", "Qty", "Rate", "Amount"].map(h => (
                <div key={h} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {(b.items || []).map((it, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 90px", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#fffcfc", fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{it.name}</div>
                <div style={{ textAlign: "center" }}>{it.qty}</div>
                <div style={{ textAlign: "right" }}>Rs.{it.rate}</div>
                <div style={{ textAlign: "right", fontWeight: 800, color: C.redDark }}>Rs.{(it.amount || 0).toLocaleString()}</div>
              </div>
            ))}
            {/* Totals */}
            <div style={{ padding: "8px 14px", background: "#fef8f8", borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: C.textLight }}>Current Bill Amount</span>
                <span style={{ fontWeight: 700 }}>Rs. {billAmt.toLocaleString()}</span>
              </div>
              {prevBal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", color: C.red }}>
                  <span style={{ fontWeight: 700 }}>Previous Pending Balance</span>
                  <span style={{ fontWeight: 700 }}>+ Rs. {prevBal.toLocaleString()}</span>
                </div>
              )}
              {advUsed > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", color: "#065f46" }}>
                  <span style={{ fontWeight: 700 }}>Advance Credit Applied</span>
                  <span style={{ fontWeight: 700 }}>- Rs. {advUsed.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", borderTop: `2px solid ${C.border}`, marginTop: 4 }}>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 800, color: C.text }}>Grand Total</span>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 800, color: C.red }}>Rs. {grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-yellow" style={{ flex: 1 }} onClick={() => printInvoice(b, ag)}>🖨️ Print Bill</button>
            <button className="btn btn-green"  style={{ flex: 1 }} onClick={() => shareWhatsApp(b, ag)}>💬 WhatsApp</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment detail view ───────────────────────────────────────────────────
  if (detail?.type === "payment") {
    const p = detail.data;
    return (
      <div className="mo" onClick={e => e.target.className === "mo" && onClose()}>
        <div className="mbox su" style={{ width: 480 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setDetail(null)}>← Back to History</button>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: C.redDark, fontWeight: 800 }}>💰 Payment Detail</div>
            <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textLight }}>✕</button>
          </div>
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: "20px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💰</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#065f46" }}>Rs. {(p.amount || 0).toLocaleString()}</div>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 4 }}>received from {agency.name}</div>
          </div>
          <div style={{ background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px" }}>
            {p.cashAmt > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}` }}><span style={{ color: C.textLight }}>💵 Cash</span><span style={{ fontWeight: 700 }}>Rs. {p.cashAmt.toLocaleString()}</span></div>}
            {p.bankAmt > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}` }}><span style={{ color: C.textLight }}>🏦 Bank Transfer</span><span style={{ fontWeight: 700 }}>Rs. {p.bankAmt.toLocaleString()}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}` }}>
              <span style={{ color: C.textLight }}>Date</span>
              <span style={{ fontWeight: 600 }}>{p.createdAt?.toDate?.()?.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: p.notes ? `1px dashed ${C.border}` : "none" }}>
              <span style={{ color: C.textLight }}>Recorded By</span>
              <span style={{ fontWeight: 600 }}>{p.recordedBy || "—"}</span>
            </div>
            {p.notes && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: C.textLight }}>Notes</span><span style={{ fontWeight: 600, color: "#7c3aed" }}>{p.notes}</span></div>}
          </div>
        </div>
      </div>
    );
  }

  // ── Main timeline ─────────────────────────────────────────────────────────
  return (
    <div className="mo" onClick={e => e.target.className === "mo" && onClose()}>
      <div className="mbox su" style={{ width: 680, maxHeight: "88vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.redDark, fontWeight: 800 }}>
            📋 Transaction History — {agency.name}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textLight }}>✕</button>
        </div>

        {/* Live balance summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[
            { label: "Total Billed", value: `Rs.${totalBilled.toLocaleString()}`, icon: "🧾", col: C.redDark,  bg: "#fff0f0" },
            { label: "Total Paid",   value: `Rs.${totalPaid.toLocaleString()}`,   icon: "💰", col: "#065f46",  bg: "#ecfdf5" },
            { label: bd.label,       value: bd.display,                           icon: liveBal > 0 ? "⚠️" : liveBal < 0 ? "🎁" : "✅", col: bd.color, bg: "#fffbeb" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 3 }}>{s.icon}</div>
              <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.col }}>{s.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textLight }}>
            <span className="spin" style={{ fontSize: 16 }}>⏳</span> &nbsp;Loading...
          </div>
        ) : txns.length === 0 ? (
          <div style={{ textAlign: "center", padding: 36, color: C.textLight }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
            <p style={{ fontSize: 14 }}>No transactions yet for this agency.</p>
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto", borderRadius: 12, border: `1px solid ${C.border}` }}>
            {txns.map((t, i) => {
              const isPay = t.type === "payment";
              const date  = t.createdAt?.toDate?.()?.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) || "—";
              const time  = t.createdAt?.toDate?.()?.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }) || "";
              return (
                <div key={t.id}
                  onClick={() => setDetail({ type: t.type, data: t })}
                  style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 12, padding: "12px 16px", borderBottom: i < txns.length - 1 ? `1px solid ${C.border}` : "none", background: i % 2 === 0 ? "#fff" : "#fffcfc", alignItems: "flex-start", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fff0f0"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fffcfc"}
                >
                  <div style={{ fontSize: 20, marginTop: 2 }}>{isPay ? "💰" : "🧾"}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 3 }}>
                      {isPay ? "Payment Received" : `Bill — ${t.billNo || ""}`}
                      <span style={{ fontSize: 10, color: C.textLight, marginLeft: 8, fontWeight: 400 }}>tap to view →</span>
                    </div>
                    {isPay && t.cashAmt > 0 && <div style={{ fontSize: 11, color: C.textLight }}>💵 Cash: Rs. {t.cashAmt.toLocaleString()}</div>}
                    {isPay && t.bankAmt > 0 && <div style={{ fontSize: 11, color: C.textLight }}>🏦 Bank: Rs. {t.bankAmt.toLocaleString()}</div>}
                    {!isPay && t.prevBalance > 0 && <div style={{ fontSize: 11, color: C.red }}>+ Rs. {t.prevBalance.toLocaleString()} prev. balance</div>}
                    {t.notes && <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 2 }}>📝 {t.notes}</div>}
                    <div style={{ fontSize: 10, color: C.textLight, marginTop: 3 }}>{date} {time} · {t.recordedBy || t.createdByName || "—"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: isPay ? "#065f46" : C.redDark }}>
                      {isPay ? "−" : "+"} Rs. {(t.amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export function Dashboard({ user, onLogout }) {
  const [page,       setPage]       = useState("dashboard");
  const [selAgency,  setSelAgency]  = useState(null);
  const [agencies,   setAgencies]   = useState([]);
  const [bills,      setBills]      = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [loadingData,setLoadingData]= useState(true);

  const [agMod,   setAgMod]   = useState({ open: false, editing: null });
  const [billMod, setBillMod] = useState({ open: false, preId: "" });
  const [histMod, setHistMod] = useState(null);
  const [payMod,  setPayMod]  = useState(null);
  const [txnMod,  setTxnMod]  = useState(null);
  const [txns,    setTxns]    = useState([]);
  const [txnLoad, setTxnLoad] = useState(false);

  // ── Firestore real-time listeners ─────────────────────────────────────────
  useEffect(() => {
    const uA = onSnapshot(
      query(collection(db, "agencies"), orderBy("createdAt", "desc")),
      s => { setAgencies(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingData(false); },
      e => { console.error("agencies:", e); setLoadingData(false); }
    );
    const uB = onSnapshot(
      query(collection(db, "bills"), orderBy("createdAt", "desc")),
      s => setBills(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("bills:", e)
    );
    const uO = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("orders:", e)
    );
    const uP = onSnapshot(
      query(collection(db, "payments"), orderBy("createdAt", "desc")),
      s => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("payments:", e)
    );
    return () => { uA(); uB(); uO(); uP(); };
  }, []);

  // ── Global stats (live) ───────────────────────────────────────────────────
  const totalOut = agencies.reduce((s, a) => {
    const bal = computeBalance(a.id, bills, payments);
    return s + Math.max(0, bal);
  }, 0);
  const pendingOrders = orders.filter(o => o.status === "pending");

  // ── Order actions ─────────────────────────────────────────────────────────
  async function approveOrder(o) {
    await updateDoc(doc(db, "orders", o.id), { status: "approved" });
    const ag = agencies.find(a => a.id === o.agencyId);
    await addDoc(collection(db, "bills"), {
      billNo: genInvNo(), agencyId: o.agencyId, agencyName: ag?.name || "",
      items: o.items || [], subtotal: o.total, discountAmt: 0,
      total: o.total, prevBalance: 0, grandTotal: o.total,
      notes: "Auto from order",
      createdByName: user?.name || "",
      createdAt: serverTimestamp(),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    });
  }
  async function rejectOrder(o) { await updateDoc(doc(db, "orders", o.id), { status: "rejected" }); }

  // ── Open transaction history — auto-cleans orphaned entries ──────────────
  async function openTxnHistory(agency) {
    setTxnMod(agency);
    setTxnLoad(true);
    setTxns([]);
    try {
      const snap = await getDocs(
        query(collection(db, "agencies", agency.id, "transactions"), orderBy("createdAt", "desc"))
      );
      const allTxns   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const billIds   = new Set(bills.map(b => b.id));
      const payIds    = new Set(payments.map(p => p.id));

      const valid = [];
      const toDelete = [];

      for (const t of allTxns) {
        const isOrphan =
          (t.type === "bill"    && t.billId    && !billIds.has(t.billId)) ||
          (t.type === "payment" && t.paymentId && !payIds.has(t.paymentId));

        if (isOrphan) {
          toDelete.push(deleteDoc(doc(db, "agencies", agency.id, "transactions", t.id)));
        } else {
          valid.push(t);
        }
      }

      if (toDelete.length > 0) await Promise.all(toDelete);
      setTxns(valid);
    } catch (e) { console.error("txns:", e); }
    setTxnLoad(false);
  }

  async function delAgency(id) {
    if (!window.confirm("Delete this agency? This cannot be undone.")) return;
    await deleteDoc(doc(db, "agencies", id));
    setSelAgency(null);
  }

  async function doLogout() { await signOut(auth); onLogout(); }

  const nav = [
    { id: "dashboard", icon: "🏠", label: "Home" },
    { id: "orders",    icon: "📦", label: "Orders",   badge: pendingOrders.length },
    { id: "billing",   icon: "🧾", label: "Billing" },
    { id: "agencies",  icon: "🏢", label: "Agencies" },
    { id: "vehicles",  icon: "🚚", label: "Vehicles" },
  ];

  function goPage(p) { setPage(p); setSelAgency(null); }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.pageBg }}>

      {/* ── Modals ── */}
      {agMod.open && (
        <AgencyModal
          existing={agMod.editing}
          onClose={() => setAgMod({ open: false, editing: null })}
          onSaved={s => { if (agMod.editing && selAgency?.id === agMod.editing.id) setSelAgency(s); }}
        />
      )}
      {billMod.open && (
        <CreateBillModal
          agencies={agencies}
          preAgencyId={billMod.preId}
          currentUser={user}
          bills={bills}
          payments={payments}
          onClose={() => setBillMod({ open: false, preId: "" })}
        />
      )}
      {histMod && <AgencyHistoryModal agency={histMod} bills={bills} onClose={() => setHistMod(null)} />}
      {payMod  && <PaymentModal agency={payMod} currentUser={user} bills={bills} payments={payments} onClose={() => setPayMod(null)} />}
      {txnMod  && (
        <TransactionHistoryModal
          agency={txnMod}
          txns={txns}
          loading={txnLoad}
          bills={bills}
          agencies={agencies}
          payments={payments}
          onClose={() => { setTxnMod(null); setTxns([]); }}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div className="sidebar">
        <div className="brand-logo-wrap" style={{ padding: "4px 8px 18px", borderBottom: "1px solid #2a0e0e", marginBottom: 8 }}>
          <Logo size={34} />
        </div>
        {nav.map(n => (
          <div key={n.id} className={`ni ${page === n.id && !selAgency ? "na" : ""}`} onClick={() => goPage(n.id)}>
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
          <button className="btn btn-danger" style={{ marginTop: 10, width: "100%", fontSize: 11, padding: 6 }} onClick={doLogout}>Logout</button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="main-content" style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>

        {/* ════ DASHBOARD HOME ════ */}
        {page === "dashboard" && !selAgency && (
          <div className="fi">
            <PageHeader
              title={`Good morning, ${user?.name?.split(" ")[0] || "Owner"} 🌅`}
              sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " · Shree Vrundavan Ice Cream"}
              action={<button className="btn btn-red hide-mobile" onClick={() => setBillMod({ open: true, preId: "" })}>+ New Bill</button>}
            />
            {loadingData ? (
              <div style={{ textAlign: "center", padding: 60, color: C.textLight }}>
                <span className="spin" style={{ fontSize: 16 }}>⏳</span> &nbsp;Loading...
              </div>
            ) : (
              <>
                <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
                  <SC label="Total Agencies"    value={agencies.length}                    icon="🏢" color={C.redDark} accent={C.red}    sub={`${agencies.length} registered`} />
                  <SC label="Pending Orders"    value={pendingOrders.length}               icon="📦" color="#d97706"  accent={C.yellow} sub="awaiting approval" />
                  <SC label="Total Outstanding" value={`Rs.${totalOut.toLocaleString()}`}  icon="⚠️" color={C.red}   accent={C.red}    sub="live calculated" />
                  <SC label="Bills This Month"  value={`Rs.${bills.filter(b => { const d = b.createdAt?.toDate?.(); return d && d.getMonth() === new Date().getMonth(); }).reduce((s, b) => s + (b.total || 0), 0).toLocaleString()}`} icon="🧾" color="#065f46" accent="#10b981" sub="total billed" />
                </div>

                {pendingOrders.length > 0 && (
                  <div style={{ background: "#fffbeb", border: `1px solid ${C.yellow}`, borderLeft: `4px solid ${C.yellow}`, borderRadius: 12, padding: "14px 18px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: C.redDark, fontSize: 14 }}>🔔 {pendingOrders.length} New Orders Waiting</div>
                      <div style={{ fontSize: 12, color: "#92400e", marginTop: 3 }}>
                        {pendingOrders.slice(0, 3).map(o => agencies.find(a => a.id === o.agencyId)?.name || "Agency").join(" · ")}
                      </div>
                    </div>
                    <button className="btn btn-yellow" style={{ fontSize: 12 }} onClick={() => goPage("orders")}>Review →</button>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Agency Overview</div>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => goPage("agencies")}>View All →</button>
                    </div>
                    {agencies.length === 0
                      ? <div className="empty-state"><div className="icon">🏢</div><p>No agencies yet</p><button className="btn btn-red" style={{ fontSize: 12 }} onClick={() => setAgMod({ open: true, editing: null })}>+ Add First Agency</button></div>
                      : agencies.slice(0, 6).map(a => {
                          const bal = computeBalance(a.id, bills, payments);
                          const bd  = balanceDisplay(bal);
                          return (
                            <div key={a.id} className="tr" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 8, cursor: "pointer" }}
                              onClick={() => { setPage("agencies"); setSelAgency(a); }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.name}</div>
                                <div style={{ fontSize: 11, color: C.textLight }}>{a.city} · {a.totalShops || 0} shops</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: 800, fontSize: 13, color: bd.color }}>{bd.display}</div>
                                <div style={{ fontSize: 10, color: C.textLight }}>{bd.label}</div>
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Recent Bills</div>
                      <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => setBillMod({ open: true, preId: "" })}>+ Bill</button>
                    </div>
                    {bills.length === 0
                      ? <div className="empty-state"><div className="icon">🧾</div><p>No bills yet</p></div>
                      : bills.slice(0, 5).map(b => (
                        <div key={b.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{b.agencyName || "—"}</div>
                            <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                            <div style={{ fontSize: 11, color: C.textLight }}>{b.billNo}</div>
                            <div style={{ fontWeight: 800, fontSize: 12, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════ ORDERS ════ */}
        {page === "orders" && (
          <div className="fi">
            <PageHeader title="Agency Orders 📦" sub={`${pendingOrders.length} pending`} />
            {orders.length === 0
              ? <div className="empty-state card"><div className="icon">📦</div><p>No orders yet.</p></div>
              : orders.map(o => {
                const ag = agencies.find(a => a.id === o.agencyId);
                return (
                  <div key={o.id} className="card" style={{ marginBottom: 14, borderLeft: `4px solid ${o.status === "pending" ? C.yellow : o.status === "approved" ? "#10b981" : "#ef4444"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <Tag cls={`b${o.status === "pending" ? "p" : o.status === "approved" ? "a" : "o"}`}>{o.status}</Tag>
                        <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginTop: 6 }}>{ag?.name || o.agencyId}</div>
                        <div style={{ fontSize: 12, color: C.textLight }}>{o.createdAt?.toDate?.()?.toLocaleString("en-IN") || "Just now"}</div>
                        {o.notes && <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4 }}>📝 {o.notes}</div>}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 20, color: C.redDark }}>Rs.{(o.total || 0).toLocaleString()}</div>
                    </div>
                    {o.status === "pending" && (
                      <div style={{ display: "flex", gap: 10 }}>
                        <button className="btn btn-red" style={{ flex: 1 }} onClick={() => approveOrder(o)}>✓ Approve &amp; Create Bill</button>
                        <button className="btn btn-ghost" onClick={() => rejectOrder(o)}>✕ Reject</button>
                      </div>
                    )}
                  </div>
                );
              })
            }
          </div>
        )}

        {/* ════ BILLING ════ */}
        {page === "billing" && (
          <div className="fi">
            <PageHeader
              title="Billing 🧾"
              sub={`${bills.length} invoices`}
              action={<button className="btn btn-red" onClick={() => setBillMod({ open: true, preId: "" })}>+ Create Bill</button>}
            />
            <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
              <SC label="Total Billed"    value={`Rs.${bills.reduce((s, b) => s + (b.total || 0), 0).toLocaleString()}`}    icon="🧾" color={C.redDark} accent={C.red}    />
              <SC label="Total Received"  value={`Rs.${payments.reduce((s, p) => s + (p.total || 0), 0).toLocaleString()}`}  icon="💰" color="#065f46"  accent="#10b981" />
              <SC label="Net Outstanding" value={`Rs.${totalOut.toLocaleString()}`}                                           icon="⚠️" color={C.red}   accent={C.yellow} />
            </div>
            {bills.length === 0
              ? <div className="empty-state card"><div className="icon">🧾</div><p>No bills yet.</p><button className="btn btn-red" onClick={() => setBillMod({ open: true, preId: "" })}>+ Create First Bill</button></div>
              : <div className="card" style={{ padding: 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1fr 80px 60px 70px 70px", gap: 6, padding: "10px 14px", background: "#fff8f8", borderRadius: "14px 14px 0 0", borderBottom: `1px solid ${C.border}` }}>
                    {["Bill No", "Agency", "Total", "Date", "By", "PDF", "WA"].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                    ))}
                  </div>
                  {bills.map(b => (
                    <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1fr 80px 60px 70px 70px", gap: 6, alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{b.agencyName || "—"}</div>
                      <div style={{ fontWeight: 800, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                      <div style={{ fontSize: 10, color: C.textLight, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.createdByName || "—"}</div>
                      <button className="btn btn-yellow" style={{ fontSize: 10, padding: "4px 6px" }} onClick={() => printInvoice(b, agencies.find(a => a.id === b.agencyId))}>🖨️</button>
                      <button className="btn btn-green"  style={{ fontSize: 10, padding: "4px 6px" }} onClick={() => shareWhatsApp(b, agencies.find(a => a.id === b.agencyId))}>💬</button>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ════ AGENCIES LIST ════ */}
        {page === "agencies" && !selAgency && (
          <div className="fi">
            <PageHeader
              title="Agencies 🏢"
              sub={`${agencies.length} agencies · Saurashtra`}
              action={<button className="btn btn-red" onClick={() => setAgMod({ open: true, editing: null })}>+ Add Agency</button>}
            />
            {agencies.length === 0
              ? <div className="empty-state card"><div className="icon">🏢</div><p>No agencies yet.</p><button className="btn btn-red" onClick={() => setAgMod({ open: true, editing: null })}>+ Add Agency</button></div>
              : <div className="card" style={{ padding: 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.6fr 80px 50px 50px 50px", gap: 6, padding: "10px 14px", background: "#fff8f8", borderRadius: "14px 14px 0 0", borderBottom: `1px solid ${C.border}` }}>
                    {["Agency", "Owner", "Balance", "Shops", "Status", "✏️", "📋", "💬"].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                    ))}
                  </div>
                  {agencies.map(a => {
                    const bal = computeBalance(a.id, bills, payments);
                    const bd  = balanceDisplay(bal);
                    return (
                      <div key={a.id} className="tr" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.6fr 80px 50px 50px 50px", gap: 6, alignItems: "center" }}>
                        <div style={{ cursor: "pointer" }} onClick={() => setSelAgency(a)}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: C.textLight }}>{a.city}</div>
                        </div>
                        <div style={{ cursor: "pointer" }} onClick={() => setSelAgency(a)}>
                          <div style={{ fontSize: 12, color: C.text }}>{a.owner}</div>
                          <div style={{ fontSize: 11, color: C.textLight }}>{a.phone}</div>
                        </div>
                        <div style={{ cursor: "pointer" }} onClick={() => setSelAgency(a)}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: bd.color }}>{bd.display}</div>
                          <div style={{ fontSize: 10, color: C.textLight }}>{bd.label}</div>
                        </div>
                        <div style={{ fontSize: 12, color: C.textMid }}>{a.totalShops || 0}</div>
                        <Tag cls={`b${a.status === "active" ? "a" : "o"}`}>{a.status}</Tag>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 6px" }} onClick={() => setAgMod({ open: true, editing: a })}>✏️</button>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 6px", color: "#7c3aed", borderColor: "#ddd6fe" }} onClick={() => openTxnHistory(a)}>📋</button>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 6px", color: "#128C7E", borderColor: "#a7f3d0" }}
                          onClick={() => { const b = bills.filter(x => x.agencyId === a.id); if (b.length > 0) shareWhatsApp(b[0], a); else if (a.phone) window.open(`https://wa.me/91${a.phone.replace(/\D/g, "")}`, "_blank"); }}>
                          💬
                        </button>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )}

        {/* ════ AGENCY DETAIL ════ */}
        {page === "agencies" && selAgency && (() => {
          const ab     = bills.filter(b => b.agencyId === selAgency.id);
          const now    = new Date();
          const mBills = ab.filter(b => { const d = b.createdAt?.toDate?.(); return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
          const mTotal = mBills.reduce((s, b) => s + (b.total || 0), 0);

          const liveBal = computeBalance(selAgency.id, bills, payments);
          const bd = balanceDisplay(liveBal);

          return (
            <div className="fi">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={() => setSelAgency(null)}>← Back</button>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: C.redDark, fontFamily: "'Playfair Display',serif" }}>{selAgency.name}</h1>
                  <p style={{ color: C.textLight, fontSize: 13 }}>{selAgency.city}</p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" style={{ color: "#7c3aed", borderColor: "#ddd6fe" }} onClick={() => openTxnHistory(selAgency)}>📋 History</button>
                  <button className="btn btn-yellow" onClick={() => setPayMod(selAgency)}>💰 Record Payment</button>
                  <button className="btn btn-ghost" onClick={() => setAgMod({ open: true, editing: selAgency })}>✏️ Edit</button>
                  <button className="btn btn-red"   onClick={() => setBillMod({ open: true, preId: selAgency.id })}>+ New Bill</button>
                  {selAgency.phone && <a href={`https://wa.me/91${selAgency.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><button className="btn btn-green">💬 Chat</button></a>}
                  <button className="btn btn-danger" onClick={() => delAgency(selAgency.id)}>🗑️</button>
                </div>
              </div>

              <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
                <SC label="This Month Billed" value={`Rs.${mTotal.toLocaleString()}`}  icon="📅" color={C.redDark}  accent={C.red}    sub={`${mBills.length} invoices`} />
                <SC label={bd.label}          value={bd.display}                        icon={liveBal > 0 ? "⚠️" : liveBal < 0 ? "🎁" : "✅"} color={bd.color} accent={liveBal > 0 ? C.yellow : "#10b981"} sub="live calculated" />
                <SC label="Total Invoices"    value={ab.length}                         icon="🧾" color="#065f46"   accent="#10b981" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                <div className="card">
                  <div style={{ fontWeight: 800, marginBottom: 14, color: C.text }}>📋 Profile</div>
                  {[["Owner", selAgency.owner], ["Phone", selAgency.phone], ["City", selAgency.city], ["Email", selAgency.email], ["GST", selAgency.gst]]
                    .filter(([, v]) => v).map(([k, v]) => (
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
                    ["Credit Limit", `Rs.${(selAgency.creditLimit || 0).toLocaleString()}`, C.text],
                    ["Live Balance", bd.display, bd.color],
                    ["Total Shops",  selAgency.totalShops || 0, C.text],
                  ].map(([k, v, color]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 12, color: C.textLight }}>{k}</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* All invoices */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontWeight: 800, color: C.text, background: "#fff8f8", borderRadius: "14px 14px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🧾 All Invoices</span>
                  <button className="btn btn-red" style={{ fontSize: 11, padding: "5px 14px" }} onClick={() => setBillMod({ open: true, preId: selAgency.id })}>+ New Bill</button>
                </div>
                {ab.length === 0
                  ? <div className="empty-state" style={{ padding: 24 }}><p>No invoices yet for this agency.</p></div>
                  : ab.map(b => (
                    <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 60px 60px", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                      <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN")}</div>
                      <div style={{ fontWeight: 800, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                      <button className="btn btn-yellow" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => printInvoice(b, selAgency)}>🖨️</button>
                      <button className="btn btn-green"  style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => shareWhatsApp(b, selAgency)}>💬</button>
                    </div>
                  ))
                }
              </div>
            </div>
          );
        })()}

        {/* ════ VEHICLES ════ */}
        {page === "vehicles" && <VehiclesPage />}

      </div>
    </div>
  );
}
