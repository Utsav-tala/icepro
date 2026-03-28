// src/components/Dashboard.js
import { useState, useEffect } from "react";
import { signOut }              from "firebase/auth";
import {
  collection, doc, addDoc, updateDoc,
  query, orderBy, onSnapshot, serverTimestamp,
  getDocs, writeBatch,
} from "firebase/firestore";
import { auth, db }                           from "../firebase";
import { C, ITEM_CATALOG }                    from "../constants";
import { computeBalance, balanceDisplay, genInvNo, printInvoice, shareWhatsApp } from "../helpers";
import { Tag, SC, Logo, PageHeader }          from "./UI";
import { AgencyModal }                        from "./AgencyModal";
import { CreateBillModal }                    from "./BillModal";
import { PaymentModal }                       from "./PaymentModal";
import { ProductsPage }                       from "./ProductsPage";
import { VehiclesPage }                       from "./Vehicles";
import { SettingsPage }                       from "./Settings";

// ── Small bill-type badge helper ──────────────────────────────────────────────
function BillTypeBadge({ billType }) {
  if (billType === "gst") {
    return <span style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: 20, fontSize: 9, fontWeight: 800, padding: "2px 7px" }}>GST</span>;
  }
  return <span style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 20, fontSize: 9, fontWeight: 800, padding: "2px 7px" }}>NON-GST</span>;
}

// ── Agency Invoice History Modal ──────────────────────────────────────────────
// FIX: appSettings now passed in and forwarded to printInvoice / shareWhatsApp
function AgencyHistoryModal({ agency, bills, onClose, appSettings }) {
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
            { label: "This Month",   value: `Rs.${mAmt.toLocaleString()}`, icon: "📅", col: C.redDark, bg: "#fff0f0" },
            { label: "Total Billed", value: `Rs.${tAmt.toLocaleString()}`, icon: "🧾", col: "#1e40af", bg: "#eff6ff" },
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr 60px 60px 60px", gap: 8, padding: "10px 14px", background: "#fff8f8", borderBottom: `1px solid ${C.border}` }}>
                {["Bill No", "Type", "Date", "Total", "PDF", "WA"].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
              {ab.map(b => (
                <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr 60px 60px 60px", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                  <div><BillTypeBadge billType={b.billType} /></div>
                  <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                  <div style={{ fontWeight: 800, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                  {/* FIX: appSettings now passed correctly */}
                  <button className="btn btn-yellow" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => printInvoice(b, agency, appSettings)}>🖨️</button>
                  <button className="btn btn-green"  style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => shareWhatsApp(b, agency, appSettings)}>💬</button>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// ── Transaction History Modal ─────────────────────────────────────────────────
function TransactionHistoryModal({ agency, txns, loading, onClose, bills, agencies, payments, appSettings }) {
  const [detail, setDetail] = useState(null);

  const totalBilled = bills.filter(b => b.agencyId === agency.id).reduce((s, b) => s + (b.total || 0), 0);
  const totalPaid   = payments.filter(p => p.agencyId === agency.id).reduce((s, p) => s + (p.total || 0), 0);
  const liveBal     = totalBilled - totalPaid;
  const bd          = balanceDisplay(liveBal);

  // ── Bill detail ───────────────────────────────────────────────────────────
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
              <div>
                <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Bill Type</div>
                <BillTypeBadge billType={b.billType} />
              </div>
            </div>
          </div>
          <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 55px 75px 60px 90px", gap: 8, padding: "8px 14px", background: "#fef0f0", borderBottom: `1px solid ${C.border}` }}>
              {["Product", "Qty", "Rate", "Disc %", "Amount"].map((h, hi) => (
                <div key={h} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", textAlign: hi >= 1 ? "right" : "left" }}>{h}</div>
              ))}
            </div>
            {(b.items || []).map((it, i) => {
              const gross   = Number(it.qty) * Number(it.rate);
              const discAmt = it.disc != null && Number(it.disc) > 0 ? gross - Number(it.amount) : 0;
              return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 55px 75px 60px 90px", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#fffcfc", fontSize: 12, alignItems: "center" }}>
                <div style={{ fontWeight: 600, color: C.text }}>{it.name}</div>
                <div style={{ textAlign: "right" }}>{it.qty}</div>
                <div style={{ textAlign: "right" }}>Rs. {Number(it.rate).toLocaleString()}</div>
                <div style={{ textAlign: "right", color: "#065f46", fontWeight: 700 }}>{it.disc != null ? `${Number(it.disc).toFixed(1)}%` : "—"}</div>
                <div style={{ textAlign: "right", fontWeight: 800, color: C.redDark }}>Rs. {Number(it.amount || 0).toLocaleString()}</div>
              </div>
            );
            })}
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
            <button className="btn btn-yellow" style={{ flex: 1 }} onClick={() => printInvoice(b, ag, appSettings)}>🖨️ Print Bill</button>
            <button className="btn btn-green"  style={{ flex: 1 }} onClick={() => shareWhatsApp(b, ag, appSettings)}>💬 WhatsApp</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment detail ────────────────────────────────────────────────────────
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
            {p.cashAmt > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}` }}><span style={{ color: C.textLight }}>Cash</span><span style={{ fontWeight: 700 }}>Rs. {p.cashAmt.toLocaleString()}</span></div>}
            {p.bankAmt > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}` }}><span style={{ color: C.textLight }}>Bank Transfer</span><span style={{ fontWeight: 700 }}>Rs. {p.bankAmt.toLocaleString()}</span></div>}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[
            { label: "Total Billed", value: `Rs.${totalBilled.toLocaleString()}`, icon: "🧾", col: C.redDark, bg: "#fff0f0" },
            { label: "Total Paid",   value: `Rs.${totalPaid.toLocaleString()}`,   icon: "💰", col: "#065f46", bg: "#ecfdf5" },
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
            <p>No transactions yet for this agency.</p>
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
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                      {isPay ? "Payment Received" : `Bill — ${t.billNo || ""}`}
                      {!isPay && t.billType && <BillTypeBadge billType={t.billType} />}
                      <span style={{ fontSize: 10, color: C.textLight, fontWeight: 400 }}>tap to view →</span>
                    </div>
                    {isPay && t.cashAmt > 0 && <div style={{ fontSize: 11, color: C.textLight }}>Cash: Rs. {t.cashAmt.toLocaleString()}</div>}
                    {isPay && t.bankAmt > 0 && <div style={{ fontSize: 11, color: C.textLight }}>Bank: Rs. {t.bankAmt.toLocaleString()}</div>}
                    {!isPay && t.prevBalance > 0 && <div style={{ fontSize: 11, color: C.red }}>+ Rs. {t.prevBalance.toLocaleString()} prev. balance</div>}
                    {!isPay && t.advanceUsed > 0 && <div style={{ fontSize: 11, color: "#065f46" }}>- Rs. {t.advanceUsed.toLocaleString()} advance</div>}
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
  const [products,   setProducts]   = useState([]);
  const [loadingData,setLoadingData]= useState(true);

  const [agMod,   setAgMod]   = useState({ open: false, editing: null });
  const [billMod, setBillMod] = useState({ open: false, preId: "" });
  const [histMod, setHistMod] = useState(null);
  const [payMod,  setPayMod]  = useState(null);
  const [txnMod,  setTxnMod]  = useState(null);
  const [txns,    setTxns]    = useState([]);
  const [txnLoad, setTxnLoad] = useState(false);

  const [appSettings,   setAppSettings]   = useState(null);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [billDetail,    setBillDetail]    = useState(null);
  const [showProfile,   setShowProfile]   = useState(false);
  const [showInactive,  setShowInactive]  = useState(false); // toggle inactive agencies

  // ── Firestore listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const uA = onSnapshot(
      query(collection(db, "agencies"), orderBy("createdAt", "desc")),
      s => { setAgencies(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingData(false); },
      e => { console.error("agencies:", e); setLoadingData(false); }
    );
    const uB = onSnapshot(
      query(collection(db, "bills"),    orderBy("createdAt", "desc")),
      s => setBills(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("bills:", e)
    );
    const uO = onSnapshot(
      query(collection(db, "orders"),   orderBy("createdAt", "desc")),
      s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("orders:", e)
    );
    const uP = onSnapshot(
      query(collection(db, "payments"), orderBy("createdAt", "desc")),
      s => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error("payments:", e)
    );
    const uProd = onSnapshot(
      query(collection(db, "products"), orderBy("name", "asc")),
      async snap => {
        // ── Always update UI state immediately ──────────────────────────────
        const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProducts(allProducts);

        // ── Read appConfig flag — controls seeding & cleanup ────────────────
        const configSnap = await getDocs(collection(db, "settings"));
        const configDoc  = configSnap.docs.find(d => d.id === "appConfig");
        const config     = configDoc?.data() || {};

        // ── STEP 1: One-time duplicate cleanup ──────────────────────────────
        // Runs only if cleanedDuplicates flag is not set yet.
        // Groups all products by name, keeps the one matching ITEM_CATALOG rate,
        // deletes all other duplicates. Custom products (not in catalog) are kept.
        if (!config.cleanedDuplicates && allProducts.length > 0) {
          console.log("Running one-time duplicate cleanup...");
          try {
            // Build a name→rate map from ITEM_CATALOG for quick lookup
            const catalogMap = {};
            ITEM_CATALOG.forEach(item => { catalogMap[item.name] = item.rate; });

            // Group products by name
            const byName = {};
            allProducts.forEach(p => {
              if (!byName[p.name]) byName[p.name] = [];
              byName[p.name].push(p);
            });

            const toDelete = [];
            Object.entries(byName).forEach(([name, group]) => {
              if (group.length <= 1) return; // no duplicates, skip
              // For catalog items: keep the one with matching catalog rate,
              // or just keep the first one if none match exactly.
              const catalogRate = catalogMap[name];
              let keepIndex = 0;
              if (catalogRate != null) {
                const matchIdx = group.findIndex(p => p.rate === catalogRate);
                if (matchIdx !== -1) keepIndex = matchIdx;
              }
              // Delete all others
              group.forEach((p, i) => {
                if (i !== keepIndex) toDelete.push(p.id);
              });
            });

            if (toDelete.length > 0) {
              // Firestore batch delete — max 500 per batch
              const BATCH_SIZE = 400;
              for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                toDelete.slice(i, i + BATCH_SIZE).forEach(id => {
                  batch.delete(doc(db, "products", id));
                });
                await batch.commit();
              }
              console.log(`Cleaned ${toDelete.length} duplicate products.`);
            } else {
              console.log("No duplicates found.");
            }

            // Set cleanup flag — never runs again
            await updateDoc(doc(db, "settings", "appConfig"), {
              cleanedDuplicates: true,
              cleanedAt: serverTimestamp(),
            }).catch(async () => {
              // Doc may not exist yet — use setDoc via addDoc workaround
              const { setDoc } = await import("firebase/firestore");
              await setDoc(doc(db, "settings", "appConfig"), {
                cleanedDuplicates: true,
                cleanedAt: serverTimestamp(),
                productsSeedDone: snap.docs.length > 0,
              });
            });
          } catch (e) { console.error("Cleanup failed:", e); }
          return; // listener will re-fire after deletes, updating UI
        }

        // ── STEP 2: Seed products if collection is empty & not seeded yet ───
        // Uses settings/appConfig → productsSeedDone flag.
        // This prevents re-seeding even if the collection is accidentally emptied.
        if (snap.empty && !config.productsSeedDone) {
          console.log("Seeding products from ITEM_CATALOG...");
          try {
            const { setDoc } = await import("firebase/firestore");
            const BATCH_SIZE = 400;
            for (let i = 0; i < ITEM_CATALOG.length; i += BATCH_SIZE) {
              const batch = writeBatch(db);
              ITEM_CATALOG.slice(i, i + BATCH_SIZE).forEach(item => {
                const ref = doc(collection(db, "products"));
                batch.set(ref, {
                  name: item.name,
                  rate: item.rate,
                  discount: 14,
                  createdAt: serverTimestamp(),
                });
              });
              await batch.commit();
            }
            // Set seed done flag — auto-seed never runs again
            await setDoc(doc(db, "settings", "appConfig"), {
              productsSeedDone: true,
              seededAt: serverTimestamp(),
              cleanedDuplicates: true,
            });
            console.log("Products seeded successfully.");
          } catch (e) { console.error("Seed failed:", e); }
        }
      },
      e => console.error("products:", e)
    );
    const uSet = onSnapshot(
      doc(db, "settings", "business"),
      s => setAppSettings(prev => ({ ...prev, business: s.exists() ? s.data() : null }))
    );
    const uBank = onSnapshot(
      doc(db, "settings", "bank"),
      s => setAppSettings(prev => ({ ...prev, bank: s.exists() ? s.data() : null }))
    );
    return () => { uA(); uB(); uO(); uP(); uProd(); uSet(); uBank(); };
  }, []);

  // ── Computed stats ────────────────────────────────────────────────────────
  const activeAgencies = agencies.filter(a => a.status !== "inactive");
  const totalOut = agencies.reduce((s, a) => {
    const bal = computeBalance(a.id, bills, payments);
    return s + Math.max(0, bal);
  }, 0);
  const pendingOrders = orders.filter(o => o.status === "pending");

  // ── Order actions ─────────────────────────────────────────────────────────
  async function approveOrder(o) {
    await updateDoc(doc(db, "orders", o.id), { status: "approved" });
    const ag = agencies.find(a => a.id === o.agencyId);
    // Orders approved from here use nongst by default (can be changed later)
    const billNo = await genInvNo("nongst");
    await addDoc(collection(db, "bills"), {
      billNo, billType: "nongst",
      agencyId: o.agencyId, agencyName: ag?.name || "",
      items: o.items || [], subtotal: o.total, discountAmt: 0,
      total: o.total, prevBalance: 0, advanceUsed: 0, grandTotal: o.total,
      notes: "Auto from order", createdByName: user?.name || "",
      createdAt: serverTimestamp(),
    });
  }
  async function rejectOrder(o) { await updateDoc(doc(db, "orders", o.id), { status: "rejected" }); }

  // ── Transaction history ───────────────────────────────────────────────────
  // NOTE: Removed auto-delete of orphaned transactions — too risky for production.
  // Orphaned entries are simply filtered out from display without deleting from DB.
  async function openTxnHistory(agency) {
    setTxnMod(agency); setTxnLoad(true); setTxns([]);
    try {
      const snap = await getDocs(
        query(collection(db, "agencies", agency.id, "transactions"), orderBy("createdAt", "desc"))
      );
      const allTxns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const billIds = new Set(bills.map(b => b.id));
      const payIds  = new Set(payments.map(p => p.id));
      // Only filter display — do NOT delete from Firestore
      const valid = allTxns.filter(t => {
        if (t.type === "bill"    && t.billId    && !billIds.has(t.billId))    return false;
        if (t.type === "payment" && t.paymentId && !payIds.has(t.paymentId)) return false;
        return true;
      });
      setTxns(valid);
    } catch (e) { console.error("txns:", e); }
    setTxnLoad(false);
  }

  // ── Deactivate / Reactivate agency — owner only ──────────────────────────
  // Hard delete is blocked by Firestore rules. We set status field instead.
  async function toggleAgencyStatus(agency) {
    const isActive = agency.status === "active";
    const confirmMsg = isActive
      ? `Deactivate "${agency.name}"? They will be hidden from all lists and cannot receive new bills.`
      : `Reactivate "${agency.name}"? They will appear in lists again.`;
    if (!window.confirm(confirmMsg)) return;
    await updateDoc(doc(db, "agencies", agency.id), {
      status: isActive ? "inactive" : "active",
      updatedAt: serverTimestamp(),
    });
    // Update local selAgency state so button label changes immediately
    setSelAgency(prev => prev ? { ...prev, status: isActive ? "inactive" : "active" } : prev);
  }
  async function doLogout() { await signOut(auth); onLogout(); }
  function goPage(p) { setPage(p); setSelAgency(null); setDrawerOpen(false); }

  const nav = [
    { id: "dashboard", icon: "🏠", label: "Home" },
    { id: "orders",    icon: "📦", label: "Orders",   badge: pendingOrders.length },
    { id: "billing",   icon: "🧾", label: "Billing" },
    { id: "agencies",  icon: "🏢", label: "Agencies" },
    { id: "products",  icon: "📦", label: "Products" },
    { id: "vehicles",  icon: "🚚", label: "Vehicles" },
  ];
  if (user?.role === "owner") {
    nav.push({ id: "settings", icon: "⚙️", label: "Settings" });
  }

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
          agencies={activeAgencies}
          preAgencyId={billMod.preId}
          currentUser={user}
          bills={bills}
          payments={payments}
          products={products}
          appSettings={appSettings}
          onClose={() => setBillMod({ open: false, preId: "" })}
        />
      )}
      {/* FIX: appSettings now passed to AgencyHistoryModal */}
      {histMod && <AgencyHistoryModal agency={histMod} bills={bills} appSettings={appSettings} onClose={() => setHistMod(null)} />}
      {payMod  && <PaymentModal agency={payMod} currentUser={user} bills={bills} payments={payments} onClose={() => setPayMod(null)} />}
      {txnMod  && (
        <TransactionHistoryModal
          agency={txnMod} txns={txns} loading={txnLoad}
          bills={bills} agencies={agencies} payments={payments}
          appSettings={appSettings}
          onClose={() => { setTxnMod(null); setTxns([]); }}
        />
      )}

      {/* ── Bill Detail Modal ── */}
      {billDetail && (() => {
        const b = billDetail;
        const ag = agencies.find(a => a.id === b.agencyId);
        const prevBal    = Number(b.prevBalance) || 0;
        const advUsed    = Number(b.advanceUsed) || 0;
        const billAmt    = Number(b.total) || 0;
        const grandTotal = billAmt + prevBal - advUsed;
        return (
          <div className="mo" onClick={e => e.target.className === "mo" && setBillDetail(null)}>
            <div className="mbox su" style={{ width: 640, maxHeight: "88vh" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: C.redDark, fontWeight: 800 }}>🧾 Bill Detail</div>
                <button onClick={() => setBillDetail(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textLight }}>✕</button>
              </div>
              <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[["Bill No", b.billNo], ["Agency", b.agencyName || "—"], ["Date", b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"], ["Created By", b.createdByName || "—"]].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Bill Type</div>
                    <BillTypeBadge billType={b.billType} />
                  </div>
                </div>
              </div>
              <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 55px 75px 60px 90px", gap: 8, padding: "8px 14px", background: "#fef0f0", borderBottom: `1px solid ${C.border}` }}>
                  {["Product", "Qty", "Rate", "Disc %", "Amount"].map((h, hi) => (
                    <div key={h} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", textAlign: hi >= 1 ? "right" : "left" }}>{h}</div>
                  ))}
                </div>
                {(b.items || []).map((it, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 55px 75px 60px 90px", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#fffcfc", fontSize: 12, alignItems: "center" }}>
                    <div style={{ fontWeight: 600, color: C.text }}>{it.name}</div>
                    <div style={{ textAlign: "right" }}>{it.qty}</div>
                    <div style={{ textAlign: "right" }}>Rs. {Number(it.rate).toLocaleString()}</div>
                    <div style={{ textAlign: "right", color: "#065f46", fontWeight: 700 }}>{it.disc != null ? `${Number(it.disc).toFixed(1)}%` : "—"}</div>
                    <div style={{ textAlign: "right", fontWeight: 800, color: C.redDark }}>Rs. {Number(it.amount || 0).toLocaleString()}</div>
                  </div>
                ))}
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
                <button className="btn btn-yellow" style={{ flex: 1 }} onClick={() => printInvoice(b, ag, appSettings)}>🖨️ Print Bill</button>
                <button className="btn btn-green"  style={{ flex: 1 }} onClick={() => shareWhatsApp(b, ag, appSettings)}>💬 WhatsApp</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MOBILE OVERLAY ── */}
      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}

      {/* ── SIDEBAR ── */}
      <div className={`sidebar ${drawerOpen ? "drawer-open" : ""}`}>
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

        <div className="mobile-header">
          <button className="hamburger" onClick={() => setDrawerOpen(true)}>☰</button>
          <Logo size={28} />
        </div>

        {/* ════ DASHBOARD HOME ════ */}
        {page === "dashboard" && !selAgency && (
          <div className="fi">
            <PageHeader
              title={`${(() => { const h = new Date().getHours(); return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : h >= 17 && h < 21 ? "Good evening" : "Good night"; })()}, ${user?.name?.split(" ")[0] || "Owner"} 🌅`}
              sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " · Vrundavan Ice Cream"}
              action={<button className="btn btn-red hide-mobile" onClick={() => setBillMod({ open: true, preId: "" })}>+ New Bill</button>}
            />
            {loadingData ? (
              <div style={{ textAlign: "center", padding: 60, color: C.textLight }}>
                <span className="spin" style={{ fontSize: 16 }}>⏳</span> &nbsp;Loading...
              </div>
            ) : (
              <>
                <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
                  <SC label="Total Agencies"    value={activeAgencies.length}             icon="🏢" color={C.redDark} accent={C.red}    sub={`${activeAgencies.length} active`} />
                  <SC label="Pending Orders"    value={pendingOrders.length}              icon="📦" color="#d97706"  accent={C.yellow} sub="awaiting approval" />
                  <SC label="Total Outstanding" value={`Rs.${totalOut.toLocaleString()}`} icon="⚠️" color={C.red}   accent={C.red}    sub="live calculated" />
                  <SC label="Bills This Month"  value={`Rs.${bills.filter(b => { const d = b.createdAt?.toDate?.(); return d && d.getMonth() === new Date().getMonth(); }).reduce((s, b) => s + (b.total || 0), 0).toLocaleString()}`} icon="🧾" color="#065f46" accent="#10b981" sub="total billed" />
                </div>
                {pendingOrders.length > 0 && (
                  <div style={{ background: "#fffbeb", border: `1px solid ${C.yellow}`, borderLeft: `4px solid ${C.yellow}`, borderRadius: 12, padding: "14px 18px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: C.redDark, fontSize: 14 }}>🔔 {pendingOrders.length} New Orders Waiting</div>
                      <div style={{ fontSize: 12, color: "#92400e", marginTop: 3 }}>{pendingOrders.slice(0, 3).map(o => agencies.find(a => a.id === o.agencyId)?.name || "Agency").join(" · ")}</div>
                    </div>
                    <button className="btn btn-yellow" style={{ fontSize: 12 }} onClick={() => goPage("orders")}>Review →</button>
                  </div>
                )}
                <div className="mobile-home-cards" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Agency Overview</div>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => goPage("agencies")}>View All →</button>
                    </div>
                    {agencies.length === 0
                      ? <div className="empty-state"><div className="icon">🏢</div><p>No agencies yet</p><button className="btn btn-red" style={{ fontSize: 12 }} onClick={() => setAgMod({ open: true, editing: null })}>+ Add First Agency</button></div>
                      : activeAgencies.slice(0, 6).map(a => {
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
                        <div key={b.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                          onClick={() => setBillDetail(b)}
                          onMouseEnter={e => e.currentTarget.style.background = "#fff0f0"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{b.agencyName || "—"}</div>
                            <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, alignItems: "center" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <div style={{ fontSize: 11, color: C.textLight }}>{b.billNo}</div>
                              <BillTypeBadge billType={b.billType} />
                            </div>
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
              <SC label="Total Billed"   value={`Rs.${bills.reduce((s, b) => s + (b.total || 0), 0).toLocaleString()}`}    icon="🧾" color={C.redDark} accent={C.red}    />
              <SC label="Total Received" value={`Rs.${payments.reduce((s, p) => s + (p.total || 0), 0).toLocaleString()}`}  icon="💰" color="#065f46"  accent="#10b981" />
              <SC label="Net Outstanding" value={`Rs.${totalOut.toLocaleString()}`}                                          icon="⚠️" color={C.red}   accent={C.yellow} />
            </div>
            {bills.length === 0
              ? <div className="empty-state card"><div className="icon">🧾</div><p>No bills yet.</p><button className="btn btn-red" onClick={() => setBillMod({ open: true, preId: "" })}>+ Create First Bill</button></div>
              : <div className="card" style={{ padding: 0 }}>
                  <div className="mobile-grid-hide" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 80px 1fr 80px 60px 70px 70px", gap: 6, padding: "10px 14px", background: "#fff8f8", borderRadius: "14px 14px 0 0", borderBottom: `1px solid ${C.border}` }}>
                    {["Bill No", "Agency", "Type", "Total", "Date", "By", "PDF", "WA"].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                    ))}
                  </div>
                  {bills.map(b => (
                    <div key={b.id} className="tr mobile-bill-row" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 80px 1fr 80px 60px 70px 70px", gap: 6, alignItems: "center", cursor: "pointer" }}
                      onClick={() => setBillDetail(b)}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{b.agencyName || "—"}</div>
                      <div><BillTypeBadge billType={b.billType} /></div>
                      <div style={{ fontWeight: 800, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                      <div style={{ fontSize: 10, color: C.textLight, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.createdByName || "—"}</div>
                      <div className="mobile-bill-actions" style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-yellow" style={{ fontSize: 13, padding: "6px 14px" }} onClick={e => { e.stopPropagation(); printInvoice(b, agencies.find(a => a.id === b.agencyId), appSettings); }}>🖨️ Print</button>
                        <button className="btn btn-green"  style={{ fontSize: 13, padding: "6px 14px" }} onClick={e => { e.stopPropagation(); shareWhatsApp(b, agencies.find(a => a.id === b.agencyId), appSettings); }}>💬 WhatsApp</button>
                      </div>
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
              sub={`${activeAgencies.length} active · ${agencies.filter(a => a.status === "inactive").length} inactive`}
              action={<button className="btn btn-red" onClick={() => setAgMod({ open: true, editing: null })}>+ Add Agency</button>}
            />

            {/* Show Inactive toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <label className="toggle">
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>
                Show inactive agencies {agencies.filter(a => a.status === "inactive").length > 0 && `(${agencies.filter(a => a.status === "inactive").length})`}
              </span>
            </div>

            {agencies.length === 0
              ? <div className="empty-state card"><div className="icon">🏢</div><p>No agencies yet.</p><button className="btn btn-red" onClick={() => setAgMod({ open: true, editing: null })}>+ Add Agency</button></div>
              : <div className="card" style={{ padding: 0 }}>
                  <div className="mobile-grid-hide" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.6fr 80px", gap: 6, padding: "10px 14px", background: "#fff8f8", borderRadius: "14px 14px 0 0", borderBottom: `1px solid ${C.border}` }}>
                    {["Agency", "Owner", "Balance", "Shops", "Status"].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                    ))}
                  </div>
                  {agencies
                    .filter(a => showInactive ? true : a.status !== "inactive")
                    .map(a => {
                      const isInactive = a.status === "inactive";
                      const bal = computeBalance(a.id, bills, payments);
                      const bd  = balanceDisplay(bal);
                      return (
                        <div key={a.id} className="tr mobile-agency-row"
                          style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.6fr 80px", gap: 6, alignItems: "center", cursor: "pointer", opacity: isInactive ? 0.5 : 1, background: isInactive ? "#fafafa" : undefined }}
                          onClick={() => setSelAgency(a)}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: C.textLight }}>{a.city}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: C.text }}>{a.owner}</div>
                            <div style={{ fontSize: 11, color: C.textLight }}>{a.phone}</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: isInactive ? C.textLight : bd.color }}>{bd.display}</div>
                            <div style={{ fontSize: 10, color: C.textLight }}>{bd.label}</div>
                          </div>
                          <div style={{ fontSize: 12, color: C.textMid }}>{a.totalShops || 0}</div>
                          <Tag cls={`b${a.status === "active" ? "a" : "o"}`}>{a.status}</Tag>
                        </div>
                      );
                    })
                  }
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
                <button className="btn btn-ghost" onClick={() => { setSelAgency(null); setShowProfile(false); }}>← Back</button>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: C.redDark, fontFamily: "'Playfair Display',serif" }}>{selAgency.name}</h1>
                  <p style={{ color: C.textLight, fontSize: 13 }}>{selAgency.city}</p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" style={{ color: "#7c3aed", borderColor: "#ddd6fe" }} onClick={() => openTxnHistory(selAgency)}>📋 History</button>
                  {/* Only show payment/new bill buttons for active agencies */}
                  {selAgency.status !== "inactive" && <>
                    <button className="btn btn-yellow" onClick={() => setPayMod(selAgency)}>💰 Record Payment</button>
                    <button className="btn btn-red"    onClick={() => setBillMod({ open: true, preId: selAgency.id })}>+ New Bill</button>
                  </>}
                  <button className="btn btn-ghost" onClick={() => setShowProfile(true)}>👤 Profile</button>
                  {selAgency.phone && <a href={`https://wa.me/91${selAgency.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><button className="btn btn-green">💬 Chat</button></a>}
                  {/* Deactivate / Reactivate — owner only */}
                  {user?.role === "owner" && (
                    <button
                      className="btn"
                      style={{
                        background: selAgency.status === "inactive" ? "#ecfdf5" : "#fef2f2",
                        color:      selAgency.status === "inactive" ? "#065f46" : "#991b1b",
                        border:     `1px solid ${selAgency.status === "inactive" ? "#a7f3d0" : "#fecaca"}`,
                        fontSize: 12,
                      }}
                      onClick={() => toggleAgencyStatus(selAgency)}
                    >
                      {selAgency.status === "inactive" ? "✅ Reactivate" : "🚫 Deactivate"}
                    </button>
                  )}
                </div>
              </div>

              {/* Inactive warning banner */}
              {selAgency.status === "inactive" && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #ef4444", borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: "#991b1b", fontWeight: 600 }}>
                  🚫 This agency is <strong>inactive</strong>. New bills and payments are disabled. Only the owner can reactivate it.
                </div>
              )}

              {showProfile && (
                <div className="mo" onClick={e => e.target.className === "mo" && setShowProfile(false)}>
                  <div className="mbox su" style={{ width: 520 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.redDark, fontWeight: 800 }}>👤 Agency Profile</div>
                      <button onClick={() => setShowProfile(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textLight }}>✕</button>
                    </div>
                    <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, padding: "18px 22px", marginBottom: 16 }}>
                      {[["Agency Name", selAgency.name], ["Owner", selAgency.owner], ["Phone", selAgency.phone], ["City", selAgency.city], ["Email", selAgency.email], ["GST", selAgency.gst], ["Address", selAgency.address]]
                        .filter(([, v]) => v).map(([k, v]) => (
                          <div key={k} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, marginBottom: 12 }}>
                            <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{k}</div>
                            <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{v}</div>
                          </div>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowProfile(false); setAgMod({ open: true, editing: selAgency }); }}>✏️ Edit Agency</button>
                      <button className="btn btn-ghost" onClick={() => setShowProfile(false)}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
                <SC label="This Month Billed" value={`Rs.${mTotal.toLocaleString()}`} icon="📅" color={C.redDark}  accent={C.red}    sub={`${mBills.length} invoices`} />
                <SC label={bd.label}          value={bd.display}                       icon={liveBal > 0 ? "⚠️" : liveBal < 0 ? "🎁" : "✅"} color={bd.color} accent={liveBal > 0 ? C.yellow : "#10b981"} sub="live calculated" />
                <SC label="Total Invoices"    value={ab.length}                        icon="🧾" color="#065f46"   accent="#10b981" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 18 }}>
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
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontWeight: 800, color: C.text, background: "#fff8f8", borderRadius: "14px 14px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🧾 All Invoices</span>
                  <button className="btn btn-red" style={{ fontSize: 11, padding: "5px 14px" }} onClick={() => setBillMod({ open: true, preId: selAgency.id })}>+ New Bill</button>
                </div>
                {ab.length === 0
                  ? <div className="empty-state" style={{ padding: 24 }}><p>No invoices yet.</p></div>
                  : ab.map(b => (
                    <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1.2fr 70px 1fr 1fr 60px 60px", gap: 8, alignItems: "center", cursor: "pointer" }}
                      onClick={() => setBillDetail(b)}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                      <div><BillTypeBadge billType={b.billType} /></div>
                      <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN")}</div>
                      <div style={{ fontWeight: 800, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                      <button className="btn btn-yellow" style={{ fontSize: 10, padding: "4px 8px" }} onClick={e => { e.stopPropagation(); printInvoice(b, selAgency, appSettings); }}>🖨️</button>
                      <button className="btn btn-green"  style={{ fontSize: 10, padding: "4px 8px" }} onClick={e => { e.stopPropagation(); shareWhatsApp(b, selAgency, appSettings); }}>💬</button>
                    </div>
                  ))
                }
              </div>
            </div>
          );
        })()}

        {/* ════ PRODUCTS ════ */}
        {page === "products" && (
          <ProductsPage products={products} currentUser={user} />
        )}

        {/* ════ VEHICLES ════ */}
        {page === "vehicles" && <VehiclesPage />}

        {/* ════ SETTINGS ════ */}
        {page === "settings" && user?.role === "owner" && (
          <SettingsPage currentUser={user} />
        )}

      </div>
    </div>
  );
}