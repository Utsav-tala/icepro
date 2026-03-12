// src/components/Dashboard.js
import { useState, useEffect } from "react";
import { signOut }              from "firebase/auth";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { auth, db }              from "../firebase";
import { C }                     from "../constants";
import { genInvNo, printInvoice, shareWhatsApp, toWords } from "../helpers";
import { Tag, SC, Logo, PageHeader }  from "./UI";
import { AgencyModal }           from "./AgencyModal";
import { CreateBillModal }       from "./BillModal";
import { VehiclesPage }          from "./Vehicles";

// ── Agency History Modal ──────────────────────────────────────────────────────
function AgencyHistoryModal({ agency, bills, onClose }) {
  const ab   = bills.filter(b => b.agencyId === agency.id);
  const now  = new Date();
  const thisM = ab.filter(b => {
    const d = b.createdAt?.toDate?.();
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const mAmt = thisM.reduce((s, b) => s + (b.total || 0), 0);
  const pAmt = ab.filter(b => b.status !== "paid").reduce((s, b) => s + (b.total || 0), 0);
  const cAmt = ab.filter(b => b.status === "paid").reduce((s, b) => s + (b.total || 0), 0);

  return (
    <div className="mo" onClick={e => e.target.className === "mo" && onClose()}>
      <div className="mbox su" style={{ width: 820 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.redDark, fontWeight: 800 }}>
            📋 Invoice History — {agency.name}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textLight }}>✕</button>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "This Month", value: `Rs.${mAmt.toLocaleString()}`, icon: "📅", col: C.redDark,  bg: "#fff0f0" },
            { label: "Pending",    value: `Rs.${pAmt.toLocaleString()}`, icon: "⏳", col: "#d97706",  bg: "#fffbeb" },
            { label: "Collected",  value: `Rs.${cAmt.toLocaleString()}`, icon: "✅", col: "#065f46",  bg: "#ecfdf5" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: s.col }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Bills table */}
        {ab.length === 0
          ? <div style={{ textAlign: "center", padding: 32, color: C.textLight }}>No invoices yet for this agency.</div>
          : <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 80px 60px 60px", gap: 8, padding: "10px 14px", background: "#fff8f8", borderBottom: `1px solid ${C.border}` }}>
                {["Bill No", "Date", "Total", "Status", "By", "PDF", "WA"].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
              {ab.map(b => (
                <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 80px 60px 60px", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                  <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                  <div style={{ fontWeight: 800, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                  <Tag cls={`b${b.status === "paid" ? "a" : b.status === "overdue" ? "o" : "p"}`}>{b.status}</Tag>
                  <div style={{ fontSize: 10, color: C.textLight }}>{b.createdByName || "—"}</div>
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

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export function Dashboard({ user, onLogout }) {
  const [page,       setPage]       = useState("dashboard");
  const [selAgency,  setSelAgency]  = useState(null);
  const [agencies,   setAgencies]   = useState([]);
  const [bills,      setBills]      = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [loadingData,setLoadingData]= useState(true);

  // Modal states
  const [agMod,   setAgMod]   = useState({ open: false, editing: null });
  const [billMod, setBillMod] = useState({ open: false, preId: "" });
  const [histMod, setHistMod] = useState(null);

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
    return () => { uA(); uB(); uO(); };
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalOut      = agencies.reduce((s, a) => s + (a.outstanding || 0), 0);
  const pendingOrders = orders.filter(o => o.status === "pending");

  // ── Order actions ─────────────────────────────────────────────────────────
  async function approveOrder(o) {
    await updateDoc(doc(db, "orders", o.id), { status: "approved" });
    const ag = agencies.find(a => a.id === o.agencyId);
    await addDoc(collection(db, "bills"), {
      billNo: genInvNo(), agencyId: o.agencyId, agencyName: ag?.name || "",
      items: o.items || [], subtotal: o.total, discountAmt: 0, prevBalance: 0,
      total: o.total, status: "pending", notes: "Auto from order",
      createdByName: user?.name || "",
      createdAt: serverTimestamp(),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    });
    if (ag) await updateDoc(doc(db, "agencies", o.agencyId), { outstanding: (ag.outstanding || 0) + o.total });
  }
  async function rejectOrder(o) { await updateDoc(doc(db, "orders", o.id), { status: "rejected" }); }

  // ── Bill actions ──────────────────────────────────────────────────────────
  async function markPaid(b) {
    await updateDoc(doc(db, "bills", b.id), { status: "paid" });
    const ag = agencies.find(a => a.id === b.agencyId);
    if (ag) {
      const nOut = Math.max(0, (ag.outstanding || 0) - b.total);
      await updateDoc(doc(db, "agencies", b.agencyId), { outstanding: nOut, status: nOut === 0 ? "active" : ag.status });
    }
  }

  // ── Agency actions ────────────────────────────────────────────────────────
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
          onClose={() => setBillMod({ open: false, preId: "" })}
        />
      )}
      {histMod && (
        <AgencyHistoryModal
          agency={histMod}
          bills={bills}
          onClose={() => setHistMod(null)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div className="sidebar">
        <div className="brand-logo-wrap" style={{ padding: "4px 8px 18px", borderBottom: "1px solid #2a0e0e", marginBottom: 8 }}>
          <Logo size={34} />
        </div>
        {nav.map(n => (
          <div key={n.id} className={`ni ${page === n.id && !selAgency ? "na" : ""}`}
            onClick={() => goPage(n.id)}>
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
                {/* Stat cards */}
                <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
                  <SC label="Total Agencies"    value={agencies.length}                     icon="🏢" color={C.redDark} accent={C.red}    sub={`${agencies.filter(a => a.status === "overdue").length} overdue`} />
                  <SC label="Pending Orders"    value={pendingOrders.length}                icon="📦" color="#d97706"  accent={C.yellow} sub="awaiting approval" />
                  <SC label="Total Outstanding" value={`Rs.${totalOut.toLocaleString()}`}   icon="⚠️" color={C.red}   accent={C.red}    sub="from agencies" />
                  <SC label="Bills This Month"  value={`Rs.${bills.filter(b => { const d = b.createdAt?.toDate?.(); return d && d.getMonth() === new Date().getMonth(); }).reduce((s, b) => s + (b.total || 0), 0).toLocaleString()}`} icon="🧾" color="#065f46" accent="#10b981" sub="total billed" />
                </div>

                {/* Pending orders alert */}
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

                {/* Agency overview + Recent bills */}
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Agency Overview</div>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => goPage("agencies")}>View All →</button>
                    </div>
                    {agencies.length === 0
                      ? <div className="empty-state"><div className="icon">🏢</div><p>No agencies yet</p><button className="btn btn-red" style={{ fontSize: 12 }} onClick={() => setAgMod({ open: true, editing: null })}>+ Add First Agency</button></div>
                      : agencies.slice(0, 6).map(a => (
                        <div key={a.id} className="tr" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 8, cursor: "pointer" }}
                          onClick={() => { setPage("agencies"); setSelAgency(a); }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: C.textLight }}>{a.city} · {a.totalShops || 0} shops</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: (a.outstanding || 0) > 0 ? C.red : "#065f46" }}>Rs.{(a.outstanding || 0).toLocaleString()}</div>
                            <Tag cls={`b${a.status === "active" ? "a" : "o"}`}>{a.status}</Tag>
                          </div>
                        </div>
                      ))
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
                            <Tag cls={`b${b.status === "paid" ? "a" : b.status === "overdue" ? "o" : "p"}`}>{b.status}</Tag>
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
              ? <div className="empty-state card"><div className="icon">📦</div><p>No orders yet. Agencies will place orders through their app.</p></div>
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
              <SC label="Total Billed" value={`Rs.${bills.reduce((s, b) => s + (b.total || 0), 0).toLocaleString()}`}                                                icon="🧾" color={C.redDark} accent={C.red}    />
              <SC label="Pending"      value={`Rs.${bills.filter(b => b.status === "pending").reduce((s, b) => s + (b.total || 0), 0).toLocaleString()}`}             icon="⏳" color="#d97706"  accent={C.yellow} />
              <SC label="Collected"    value={`Rs.${bills.filter(b => b.status === "paid").reduce((s, b) => s + (b.total || 0), 0).toLocaleString()}`}                icon="✅" color="#065f46"  accent="#10b981"  />
            </div>

            {bills.length === 0
              ? <div className="empty-state card"><div className="icon">🧾</div><p>No bills yet.</p><button className="btn btn-red" onClick={() => setBillMod({ open: true, preId: "" })}>+ Create First Bill</button></div>
              : <div className="card" style={{ padding: 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1fr 80px 80px 60px 70px 70px", gap: 6, padding: "10px 14px", background: "#fff8f8", borderRadius: "14px 14px 0 0", borderBottom: `1px solid ${C.border}` }}>
                    {["Bill No", "Agency", "Total", "Status", "Date", "By", "PDF", "WA"].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                    ))}
                  </div>
                  {bills.map(b => (
                    <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1fr 80px 80px 60px 70px 70px", gap: 6, alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{b.agencyName || "—"}</div>
                      <div style={{ fontWeight: 800, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                      <Tag cls={`b${b.status === "paid" ? "a" : b.status === "overdue" ? "o" : "p"}`}>{b.status}</Tag>
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
                    {["Agency", "Owner", "Outstanding", "Shops", "Status", "✏️", "📋", "💬"].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                    ))}
                  </div>
                  {agencies.map(a => (
                    <div key={a.id} className="tr" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.6fr 80px 50px 50px 50px", gap: 6, alignItems: "center" }}>
                      <div style={{ cursor: "pointer" }} onClick={() => setSelAgency(a)}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: C.textLight }}>{a.city}</div>
                      </div>
                      <div style={{ cursor: "pointer" }} onClick={() => setSelAgency(a)}>
                        <div style={{ fontSize: 12, color: C.text }}>{a.owner}</div>
                        <div style={{ fontSize: 11, color: C.textLight }}>{a.phone}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: (a.outstanding || 0) > 0 ? C.red : "#065f46", cursor: "pointer" }} onClick={() => setSelAgency(a)}>
                        Rs.{(a.outstanding || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMid }}>{a.totalShops || 0}</div>
                      <Tag cls={`b${a.status === "active" ? "a" : "o"}`}>{a.status}</Tag>
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 6px" }} onClick={() => setAgMod({ open: true, editing: a })}>✏️</button>
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 6px", color: "#7c3aed", borderColor: "#ddd6fe" }} onClick={() => setHistMod(a)}>📋</button>
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 6px", color: "#128C7E", borderColor: "#a7f3d0" }}
                        onClick={() => { const b = bills.filter(x => x.agencyId === a.id && x.status !== "paid"); if (b.length > 0) shareWhatsApp(b[0], a); else if (a.phone) window.open(`https://wa.me/91${a.phone.replace(/\D/g,"")}`, "_blank"); }}>
                        💬
                      </button>
                    </div>
                  ))}
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
          const pTotal = ab.filter(b => b.status !== "paid").reduce((s, b) => s + (b.total || 0), 0);

          return (
            <div className="fi">
              {/* Back + actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={() => setSelAgency(null)}>← Back</button>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: C.redDark, fontFamily: "'Playfair Display',serif" }}>{selAgency.name}</h1>
                  <p style={{ color: C.textLight, fontSize: 13 }}>{selAgency.city}</p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" style={{ color: "#7c3aed", borderColor: "#ddd6fe" }} onClick={() => setHistMod(selAgency)}>📋 History</button>
                  <button className="btn btn-ghost" onClick={() => setAgMod({ open: true, editing: selAgency })}>✏️ Edit</button>
                  <button className="btn btn-red"   onClick={() => setBillMod({ open: true, preId: selAgency.id })}>+ New Bill</button>
                  {selAgency.phone && <a href={`https://wa.me/91${selAgency.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><button className="btn btn-green">💬 Chat</button></a>}
                  <button className="btn btn-danger" onClick={() => delAgency(selAgency.id)}>🗑️</button>
                </div>
              </div>

              {/* Month stats */}
              <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
                <SC label="This Month Billed" value={`Rs.${mTotal.toLocaleString()}`} icon="📅" color={C.redDark} accent={C.red}    sub={`${mBills.length} invoices`} />
                <SC label="Pending Amount"    value={`Rs.${pTotal.toLocaleString()}`} icon="⏳" color="#d97706"  accent={C.yellow} />
                <SC label="Total Invoices"    value={ab.length}                        icon="🧾" color="#065f46"  accent="#10b981"  />
              </div>

              {/* Profile + Financials */}
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
                    ["Outstanding",  `Rs.${(selAgency.outstanding || 0).toLocaleString()}`,  (selAgency.outstanding || 0) > 0 ? C.red : "#065f46"],
                    ["Total Shops",  selAgency.totalShops || 0,                               C.text],
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
                    <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr 80px 80px 60px 60px", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{b.billNo}</div>
                      <div style={{ fontSize: 11, color: C.textLight }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN")}</div>
                      <div style={{ fontWeight: 800, color: C.redDark }}>Rs.{(b.total || 0).toLocaleString()}</div>
                      <Tag cls={`b${b.status === "paid" ? "a" : b.status === "overdue" ? "o" : "p"}`}>{b.status}</Tag>
                      {b.status !== "paid"
                        ? <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => markPaid(b)}>Mark Paid</button>
                        : <div />
                      }
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
