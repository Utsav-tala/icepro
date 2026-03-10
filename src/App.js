// src/App.js
import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection, addDoc, getDocs, updateDoc, doc, onSnapshot, serverTimestamp, query, orderBy
} from "firebase/firestore";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "firebase/auth";

// ── PRODUCTS (fixed list, no DB needed) ─────────────────────────────────────
const PRODUCTS = [
  { id: 1, name: "Kesar Pista",      unit: "Box (24 pcs)", price: 480 },
  { id: 2, name: "Chocolate Fudge",  unit: "Box (24 pcs)", price: 420 },
  { id: 3, name: "Strawberry",       unit: "Box (24 pcs)", price: 390 },
  { id: 4, name: "Mango Delight",    unit: "Box (24 pcs)", price: 410 },
  { id: 5, name: "Vanilla Classic",  unit: "Box (24 pcs)", price: 350 },
  { id: 6, name: "Butterscotch",     unit: "Box (24 pcs)", price: 370 },
  { id: 7, name: "Mix Fruit Bar",    unit: "Box (48 pcs)", price: 520 },
  { id: 8, name: "Choco Bar",        unit: "Box (48 pcs)", price: 560 },
];

const VEHICLES = [
  { id: "V01", name: "GJ-03-AB-1234", driver: "Ramesh Bhai"  },
  { id: "V02", name: "GJ-03-CD-5678", driver: "Suresh Patel" },
  { id: "V03", name: "GJ-03-EF-9012", driver: "Dinesh Mer"   },
  { id: "V04", name: "GJ-03-GH-3456", driver: "Vijay Bhai"   },
];

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Syne',sans-serif;background:#0d0f14;color:#c8c8e0;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:#111318;}
::-webkit-scrollbar-thumb{background:#2a2d3a;border-radius:4px;}
.ni{cursor:pointer;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;transition:all 0.2s;color:#666880;}
.ni:hover{background:#1a1d2a;color:#c8c8e0;}
.na{background:#1a2035!important;color:#7eb8ff!important;border-left:3px solid #4d8fff;}
.card{background:#13161f;border:1px solid #1e2130;border-radius:14px;padding:18px;}
.sc{background:#13161f;border:1px solid #1e2130;border-radius:14px;padding:20px;transition:transform 0.2s;}
.sc:hover{transform:translateY(-2px);}
.badge{padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.5px;display:inline-block;text-transform:uppercase;}
.ba{background:#0a2418;color:#2ecc8a;border:1px solid #0d3a22;}
.bo{background:#280a0a;color:#f07070;border:1px solid #3e0d0d;}
.bp{background:#28240a;color:#f0c040;border:1px solid #3e340d;}
.btn{padding:8px 18px;border-radius:9px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;transition:all 0.2s;}
.bb{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;}
.bb:hover{opacity:0.9;transform:translateY(-1px);}
.bg{background:linear-gradient(135deg,#059669,#047857);color:white;}
.bg:hover{opacity:0.9;}
.bred{background:#7f1d1d;color:#fca5a5;}
.bgh{background:#1a1d2a;color:#666880;border:1px solid #1e2130;}
.bgh:hover{background:#1e2130;color:#c8c8e0;}
.inp{background:#1a1d2a;border:1px solid #1e2130;border-radius:9px;padding:9px 13px;color:#c8c8e0;font-family:'Syne',sans-serif;font-size:13px;outline:none;transition:border-color 0.2s;width:100%;}
.inp:focus{border-color:#4d8fff;}
.sel{background:#1a1d2a;border:1px solid #1e2130;border-radius:9px;padding:9px 13px;color:#c8c8e0;font-family:'Syne',sans-serif;font-size:13px;outline:none;width:100%;}
.tr{padding:12px 16px;border-bottom:1px solid #181a24;transition:background 0.15s;}
.tr:hover{background:#1a1d2a;}
.mo{position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(6px);}
.mbox{background:#13161f;border:1px solid #1e2130;border-radius:18px;padding:28px;width:640px;max-width:96vw;max-height:90vh;overflow-y:auto;}
@keyframes fi{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.fi{animation:fi 0.28s ease;}
@keyframes su{from{opacity:0;transform:scale(0.96);}to{opacity:1;transform:scale(1);}}
.su{animation:su 0.32s ease;}
.spin{animation:spin 1s linear infinite;}
@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
`;

function Lbl({ children }) {
  return <div style={{ fontSize: 10, color: "#3a3d55", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

function Tag({ children, cls }) {
  return <span className={`badge ${cls}`}>{children}</span>;
}

function SC({ label, value, sub, icon, color }) {
  return (
    <div className="sc">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: "#555880", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'DM Mono',monospace" }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: "#3a3d55", marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 24 }}>{icon}</div>
      </div>
    </div>
  );
}

// ── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin() {
    if (!email || !pass) return setErr("Enter email and password.");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      setErr("Wrong email or password.");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{CSS}</style>
      <div className="su" style={{ background: "#13161f", border: "1px solid #1e2130", borderRadius: 24, padding: "40px 36px", width: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40 }}>🍦</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#c8c8e0", marginTop: 8 }}>IcePro</div>
          <div style={{ fontSize: 12, color: "#3a3d55", marginTop: 4, letterSpacing: "1px" }}>OWNER PORTAL</div>
        </div>
        <Lbl>Email</Lbl>
        <input className="inp" type="email" placeholder="owner@icepro.com" value={email} onChange={e => setEmail(e.target.value)} style={{ marginBottom: 14 }} />
        <Lbl>Password</Lbl>
        <input className="inp" type="password" placeholder="Your password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} style={{ marginBottom: 16 }} />
        {err && <div style={{ fontSize: 12, color: "#f07070", marginBottom: 12 }}>⚠️ {err}</div>}
        <button className="btn bb" style={{ width: "100%", padding: 12 }} onClick={doLogin} disabled={loading}>
          {loading ? "Logging in..." : "Login →"}
        </button>
      </div>
    </div>
  );
}

// ── BILL MODAL ───────────────────────────────────────────────────────────────
function BillModal({ agencies, onClose, onSave, prefillAgencyId }) {
  const [agencyId, setAgencyId] = useState(prefillAgencyId || "");
  const [items, setItems] = useState([{ productId: "", qty: 1 }]);
  const [vehicleId, setVehicleId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const total = items.reduce((s, i) => {
    const p = PRODUCTS.find(pr => pr.id === parseInt(i.productId));
    return s + (p ? p.price * i.qty : 0);
  }, 0);

  function addItem() { setItems([...items, { productId: "", qty: 1 }]); }
  function removeItem(i) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i, field, val) {
    const copy = [...items];
    copy[i][field] = field === "qty" ? Math.max(1, parseInt(val) || 1) : val;
    setItems(copy);
  }

  async function save() {
    if (!agencyId || items.some(i => !i.productId)) return alert("Please fill all fields.");
    setSaving(true);
    const bill = {
      agencyId,
      items: items.map(i => ({
        productId: parseInt(i.productId),
        qty: i.qty,
        price: PRODUCTS.find(p => p.id === parseInt(i.productId))?.price || 0
      })),
      total,
      status: "pending",
      notes,
      vehicle: vehicleId,
      createdAt: serverTimestamp(),
    };
    await onSave(bill);
    setSaving(false);
    onClose();
  }

  return (
    <div className="mo" onClick={onClose}>
      <div className="mbox su" style={{ width: 700 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🧾 Create Bill</div>
          <button className="btn bgh" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          <div>
            <Lbl>Agency</Lbl>
            <select className="sel" value={agencyId} onChange={e => setAgencyId(e.target.value)}>
              <option value="">Select agency...</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <Lbl>Assign Vehicle</Lbl>
            <select className="sel" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">Select vehicle...</option>
              {VEHICLES.map(v => <option key={v.id} value={v.id}>{v.name} — {v.driver}</option>)}
            </select>
          </div>
        </div>
        <Lbl>Order Items</Lbl>
        {items.map((item, i) => {
          const prod = PRODUCTS.find(p => p.id === parseInt(item.productId));
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 32px", gap: 10, marginBottom: 10, alignItems: "center" }}>
              <select className="sel" value={item.productId} onChange={e => updateItem(i, "productId", e.target.value)}>
                <option value="">Select product...</option>
                {PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>)}
              </select>
              <input className="inp" type="number" min={1} value={item.qty} onChange={e => updateItem(i, "qty", e.target.value)} />
              <div style={{ fontFamily: "'DM Mono',monospace", color: "#7eb8ff", textAlign: "right", fontSize: 13 }}>
                ₹{prod ? (prod.price * item.qty).toLocaleString() : "—"}
              </div>
              <button className="btn bred" style={{ padding: "6px 8px" }} onClick={() => removeItem(i)}>✕</button>
            </div>
          );
        })}
        <button className="btn bgh" style={{ width: "100%", marginBottom: 16, fontSize: 12 }} onClick={addItem}>+ Add Product</button>
        <Lbl>Notes</Lbl>
        <input className="inp" placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} style={{ marginBottom: 16 }} />
        <div style={{ background: "#0d0f14", borderRadius: 10, padding: "14px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#666880" }}>Total Amount</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 800, color: "#7eb8ff" }}>₹{total.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn bb" style={{ flex: 1, padding: 11 }} onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Generate Bill"}
          </button>
          <button className="btn bgh" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── AGENCY FORM MODAL ────────────────────────────────────────────────────────
function AgencyModal({ agency, onClose, onSave }) {
  const blank = { name:"", owner:"", phone:"", whatsapp:"", city:"", area:"", address:"", idType:"Aadhar Card", idProof:"", gstNo:"", creditLimit:100000, mapLink:"" };
  const [form, setForm] = useState(agency?.id ? { ...agency } : blank);
  const [saving, setSaving] = useState(false);
  function upd(f, v) { setForm(prev => ({ ...prev, [f]: v })); }

  async function save() {
    if (!form.name || !form.owner || !form.phone) return alert("Name, owner and phone are required.");
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  return (
    <div className="mo" onClick={onClose}>
      <div className="mbox su" style={{ width: 720 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{agency?.id ? "✏️ Edit Agency" : "➕ Add Agency"}</div>
          <button className="btn bgh" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[["Agency Name","name"],["Owner Name","owner"],["Phone","phone"],["WhatsApp","whatsapp"],["City","city"],["Area / Route","area"]].map(([l,f]) => (
            <div key={f}><Lbl>{l}</Lbl><input className="inp" value={form[f]||""} onChange={e=>upd(f,e.target.value)} /></div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}><Lbl>Full Address</Lbl><input className="inp" value={form.address||""} onChange={e=>upd("address",e.target.value)} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          <div>
            <Lbl>ID Proof Type</Lbl>
            <select className="sel" value={form.idType||""} onChange={e=>upd("idType",e.target.value)}>
              {["Aadhar Card","PAN Card","Driving License","Passport","Voter ID"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div><Lbl>ID Proof Number</Lbl><input className="inp" value={form.idProof||""} onChange={e=>upd("idProof",e.target.value)} /></div>
          <div><Lbl>GST Number</Lbl><input className="inp" value={form.gstNo||""} onChange={e=>upd("gstNo",e.target.value)} /></div>
          <div><Lbl>Credit Limit (₹)</Lbl><input className="inp" type="number" value={form.creditLimit||""} onChange={e=>upd("creditLimit",parseInt(e.target.value)||0)} /></div>
        </div>
        <div style={{ marginTop: 14 }}><Lbl>Google Maps Link</Lbl><input className="inp" placeholder="https://maps.google.com/?q=..." value={form.mapLink||""} onChange={e=>upd("mapLink",e.target.value)} /></div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button className="btn bb" style={{ flex: 1, padding: 11 }} onClick={save} disabled={saving}>{saving?"Saving...":"Save Agency"}</button>
          <button className="btn bgh" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]       = useState(undefined); // undefined = loading
  const [page, setPage]       = useState("dashboard");
  const [agencies, setAgencies] = useState([]);
  const [bills, setBills]     = useState([]);
  const [orders, setOrders]   = useState([]);
  const [selAgency, setSelAgency] = useState(null);
  const [showBill, setShowBill]   = useState(false);
  const [billAgencyId, setBillAgencyId] = useState(null);
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [editAgency, setEditAgency] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  // Real-time Firestore listeners
  useEffect(() => {
    if (!user) return;

    const unsubA = onSnapshot(collection(db, "agencies"), snap => {
      setAgencies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubB = onSnapshot(query(collection(db, "bills"), orderBy("createdAt", "desc")), snap => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubO = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubA(); unsubB(); unsubO(); };
  }, [user]);

  // ── DB operations ──
  async function saveBill(bill) {
    await addDoc(collection(db, "bills"), bill);
  }

  async function saveAgency(form) {
    if (form.id) {
      const { id, ...data } = form;
      await updateDoc(doc(db, "agencies", id), data);
    } else {
      await addDoc(collection(db, "agencies"), { ...form, outstanding: 0, totalShops: 0, status: "active", createdAt: serverTimestamp() });
    }
  }

  async function approveOrder(orderId, vehicleId) {
    await updateDoc(doc(db, "orders", orderId), { status: "approved", vehicle: vehicleId });
    const order = orders.find(o => o.id === orderId);
    if (order) { setBillAgencyId(order.agencyId); setShowBill(true); }
  }

  async function rejectOrder(orderId) {
    await updateDoc(doc(db, "orders", orderId), { status: "rejected" });
  }

  async function updateBillStatus(billId, status) {
    await updateDoc(doc(db, "bills", billId), { status });
  }

  // ── Loading / auth states ──
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0f14" }}>
      <style>{CSS}</style>
      <div style={{ fontSize: 32, className: "spin" }}>🍦</div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={() => {}} />;

  // ── Derived stats ──
  const totalOut   = agencies.reduce((s, a) => s + (a.outstanding || 0), 0);
  const pendingOrders = orders.filter(o => o.status === "pending");
  const pendingBills  = bills.filter(b => b.status === "pending").reduce((s, b) => s + b.total, 0);

  const nav = [
    { id: "dashboard", icon: "⬛", label: "Dashboard" },
    { id: "orders",    icon: "📦", label: "Orders",    badge: pendingOrders.length },
    { id: "billing",   icon: "🧾", label: "Billing"   },
    { id: "agencies",  icon: "🏢", label: "Agencies"  },
    { id: "vehicles",  icon: "🚚", label: "Vehicles"  },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{CSS}</style>

      {/* SIDEBAR */}
      <div style={{ width: 210, background: "#0a0c12", borderRight: "1px solid #181a24", padding: "22px 10px", display: "flex", flexDirection: "column", gap: 3, flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "0 8px 22px" }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#7eb8ff" }}>🍦 IcePro</div>
          <div style={{ fontSize: 10, color: "#3a3d55", marginTop: 2, letterSpacing: "1px" }}>OWNER PORTAL</div>
        </div>
        {nav.map(n => (
          <div key={n.id} className={`ni ${page === n.id && !selAgency ? "na" : ""}`} onClick={() => { setPage(n.id); setSelAgency(null); }}>
            <span>{n.icon}</span><span style={{ flex: 1 }}>{n.label}</span>
            {n.badge > 0 && <span style={{ background: "#f07070", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>{n.badge}</span>}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#13161f", border: "1px solid #1e2130" }}>
          <div style={{ fontSize: 10, color: "#3a3d55" }}>LOGGED IN AS</div>
          <div style={{ fontSize: 12, marginTop: 3, color: "#c8c8e0" }}>{user.email}</div>
          <button className="btn bgh" style={{ marginTop: 10, width: "100%", fontSize: 11, padding: 6 }} onClick={() => signOut(auth)}>Logout</button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflow: "auto", padding: "26px 30px" }}>

        {/* DASHBOARD */}
        {page === "dashboard" && !selAgency && (
          <div className="fi">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800 }}>Dashboard</h1>
              <p style={{ color: "#555880", fontSize: 13, marginTop: 3 }}>Welcome back, Owner</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
              <SC label="Total Agencies"    value={agencies.length}                  sub={`${agencies.filter(a=>a.status==="overdue").length} overdue`} icon="🏢" color="#7eb8ff" />
              <SC label="Pending Orders"    value={pendingOrders.length}             sub="awaiting approval" icon="📦" color="#c084fc" />
              <SC label="Pending Bills"     value={`₹${pendingBills.toLocaleString()}`} sub="to collect" icon="🧾" color="#f0c040" />
              <SC label="Total Outstanding" value={`₹${totalOut.toLocaleString()}`}  sub="from agencies" icon="⚠️" color="#f07070" />
            </div>

            {pendingOrders.length > 0 && (
              <div style={{ background: "#1a0a28", border: "1px solid #3e1a5a", borderRadius: 12, padding: "14px 18px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#c084fc", fontSize: 13 }}>🔔 {pendingOrders.length} New Agency Order{pendingOrders.length > 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 12, color: "#8a6aaa", marginTop: 4 }}>
                    {pendingOrders.map(o => agencies.find(a => a.id === o.agencyId)?.name || o.agencyId).join(", ")}
                  </div>
                </div>
                <button className="btn" style={{ background: "#2a1040", color: "#c084fc", fontSize: 11 }} onClick={() => setPage("orders")}>Review →</button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Agency Overview</div>
                  <button className="btn bgh" style={{ fontSize: 11 }} onClick={() => setPage("agencies")}>All Agencies →</button>
                </div>
                {agencies.length === 0 && <div style={{ color: "#3a3d55", fontSize: 13 }}>No agencies yet. Add your first agency!</div>}
                {agencies.map(a => (
                  <div key={a.id} className="tr" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 8, cursor: "pointer" }}
                    onClick={() => { setPage("agencies"); setSelAgency(a); }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "#555880" }}>{a.city} · {a.totalShops || 0} shops</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600, color: (a.outstanding||0) > 0 ? "#f07070" : "#2ecc8a" }}>₹{(a.outstanding||0).toLocaleString()}</div>
                      <Tag cls={`b${a.status === "active" ? "a" : "o"}`}>{a.status}</Tag>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Recent Bills</div>
                  <button className="btn bb" style={{ fontSize: 11 }} onClick={() => setShowBill(true)}>+ Bill</button>
                </div>
                {bills.slice(0, 6).map(b => {
                  const ag = agencies.find(a => a.id === b.agencyId);
                  return (
                    <div key={b.id} style={{ padding: "9px 0", borderBottom: "1px solid #181a24" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{ag?.name || b.agencyId}</div>
                        <Tag cls={`b${b.status === "paid" ? "a" : b.status === "overdue" ? "o" : "p"}`}>{b.status}</Tag>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <div style={{ fontSize: 11, color: "#555880" }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 }}>₹{b.total?.toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {page === "orders" && (
          <div className="fi">
            <div style={{ marginBottom: 22 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Agency Orders</h1>
              <p style={{ color: "#555880", fontSize: 13 }}>Orders placed by agencies via the app</p>
            </div>
            {orders.length === 0 && <div style={{ color: "#3a3d55", padding: 30, textAlign: "center" }}>No orders yet.</div>}
            {orders.map(o => {
              const ag = agencies.find(a => a.id === o.agencyId);
              const total = o.items?.reduce((s, i) => { const p = PRODUCTS.find(pr => pr.id === i.productId); return s + (p ? p.price * i.qty : 0); }, 0) || 0;
              const [veh, setVeh] = useState("");
              return (
                <div key={o.id} className="card" style={{ marginBottom: 14, borderColor: o.status === "pending" ? "#3e1a5a" : "#1e2130" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <Tag cls={`b${o.status === "pending" ? "p" : o.status === "approved" ? "a" : "o"}`}>{o.status}</Tag>
                        <span style={{ fontSize: 10, background: "#1a0a28", color: "#c084fc", border: "1px solid #3e1a5a", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>via App</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{ag?.name || o.agencyId}</div>
                      <div style={{ fontSize: 12, color: "#555880" }}>{o.createdAt?.toDate?.()?.toLocaleString("en-IN") || "—"}</div>
                      {o.notes && <div style={{ fontSize: 12, color: "#c084fc", marginTop: 4 }}>📝 {o.notes}</div>}
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 800, color: "#7eb8ff" }}>₹{total.toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: o.status === "pending" ? 14 : 0 }}>
                    {o.items?.map((item, i) => {
                      const p = PRODUCTS.find(pr => pr.id === item.productId);
                      return (
                        <div key={i} style={{ background: "#0d0f14", border: "1px solid #1e2130", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                          <b>{p?.name}</b> × {item.qty} <span style={{ color: "#7eb8ff" }}>₹{p ? (p.price * item.qty).toLocaleString() : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                  {o.status === "pending" && (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <select className="sel" style={{ flex: 1 }} value={veh} onChange={e => setVeh(e.target.value)}>
                        <option value="">Assign vehicle...</option>
                        {VEHICLES.map(v => <option key={v.id} value={v.id}>{v.name} — {v.driver}</option>)}
                      </select>
                      <button className="btn bg" onClick={() => approveOrder(o.id, veh)}>✓ Approve & Bill</button>
                      <button className="btn bred" onClick={() => rejectOrder(o.id)}>✕ Reject</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* BILLING */}
        {page === "billing" && (
          <div className="fi">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800 }}>Billing</h1>
                <p style={{ color: "#555880", fontSize: 13 }}>All invoices</p>
              </div>
              <button className="btn bb" onClick={() => setShowBill(true)}>+ Create Bill</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
              <SC label="Total Billed"   value={`₹${bills.reduce((s,b)=>s+b.total,0).toLocaleString()}`}  icon="🧾" color="#7eb8ff" />
              <SC label="Pending"        value={`₹${pendingBills.toLocaleString()}`}                       icon="⏳" color="#f0c040" />
              <SC label="Collected"      value={`₹${bills.filter(b=>b.status==="paid").reduce((s,b)=>s+b.total,0).toLocaleString()}`} icon="✅" color="#2ecc8a" />
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2.5fr 1fr 1fr 1fr", gap: 12, padding: "10px 18px", borderBottom: "1px solid #181a24" }}>
                {["Agency","Items","Total","Date","Status"].map(h=><div key={h} style={{fontSize:10,color:"#3a3d55",fontWeight:700,textTransform:"uppercase"}}>{h}</div>)}
              </div>
              {bills.length === 0 && <div style={{ padding: "20px 18px", color: "#3a3d55", fontSize: 13 }}>No bills yet.</div>}
              {bills.map(b => {
                const ag = agencies.find(a => a.id === b.agencyId);
                return (
                  <div key={b.id} className="tr" style={{ display: "grid", gridTemplateColumns: "2fr 2.5fr 1fr 1fr 1fr", gap: 12, alignItems: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ag?.name || b.agencyId}</div>
                    <div style={{ fontSize: 11, color: "#555880" }}>{b.items?.map(i=>PRODUCTS.find(p=>p.id===i.productId)?.name).filter(Boolean).join(", ")}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>₹{b.total?.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#555880" }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN") || "—"}</div>
                    <select className="sel" style={{ padding: "4px 8px", fontSize: 11 }} value={b.status} onChange={e => updateBillStatus(b.id, e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AGENCIES LIST */}
        {page === "agencies" && !selAgency && (
          <div className="fi">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800 }}>Agencies</h1>
                <p style={{ color: "#555880", fontSize: 13 }}>{agencies.length} agencies</p>
              </div>
              <button className="btn bb" onClick={() => { setEditAgency({}); setShowAgencyModal(true); }}>+ Add Agency</button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 80px 80px", gap: 10, padding: "10px 18px", borderBottom: "1px solid #181a24" }}>
                {["Agency","Owner / Phone","Outstanding","Credit","Shops","Status",""].map(h=><div key={h} style={{fontSize:10,color:"#3a3d55",fontWeight:700,textTransform:"uppercase"}}>{h}</div>)}
              </div>
              {agencies.length === 0 && <div style={{ padding: "20px 18px", color: "#3a3d55", fontSize: 13 }}>No agencies yet. Click "+ Add Agency" to start.</div>}
              {agencies.map(a => (
                <div key={a.id} className="tr" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 80px 80px", gap: 10, alignItems: "center", cursor: "pointer" }}
                  onClick={() => setSelAgency(a)}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "#555880" }}>{a.area}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>{a.owner}</div>
                    <div style={{ fontSize: 11, color: "#555880" }}>{a.phone}</div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 13, color: (a.outstanding||0)>0?"#f07070":"#2ecc8a" }}>₹{(a.outstanding||0).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: "#888aaa" }}>₹{(a.creditLimit||0).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: "#888aaa" }}>{a.totalShops||0}</div>
                  <Tag cls={`b${a.status==="active"?"a":"o"}`}>{a.status}</Tag>
                  <button className="btn bgh" style={{ fontSize: 10, padding: "5px 10px" }} onClick={e=>{e.stopPropagation();setEditAgency(a);setShowAgencyModal(true);}}>Edit</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AGENCY DETAIL */}
        {page === "agencies" && selAgency && (
          <div className="fi">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
              <button className="btn bgh" onClick={() => setSelAgency(null)}>← Back</button>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800 }}>{selAgency.name}</h1>
                <p style={{ color: "#555880", fontSize: 13 }}>{selAgency.area}</p>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn bb" onClick={() => { setBillAgencyId(selAgency.id); setShowBill(true); }}>+ New Bill</button>
                {selAgency.whatsapp && <a href={`https://wa.me/91${selAgency.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"><button className="btn bg">💬 WhatsApp</button></a>}
                {selAgency.mapLink && <a href={selAgency.mapLink} target="_blank" rel="noreferrer"><button className="btn bgh">📍 Maps</button></a>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 14 }}>📋 Profile</div>
                {[["Owner",selAgency.owner],["Phone",selAgency.phone],["WhatsApp",selAgency.whatsapp],["Address",selAgency.address],[`${selAgency.idType||"ID"}`,selAgency.idProof],["GST",selAgency.gstNo]].map(([k,v])=>v&&(
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "#3a3d55", fontWeight: 700, textTransform: "uppercase" }}>{k}</div>
                    <div style={{ fontSize: 13 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 14 }}>💰 Financials</div>
                {[
                  ["Credit Limit", `₹${(selAgency.creditLimit||0).toLocaleString()}`, "#7eb8ff"],
                  ["Outstanding",  `₹${(selAgency.outstanding||0).toLocaleString()}`, (selAgency.outstanding||0)>0?"#f07070":"#2ecc8a"],
                  ["Total Shops",  selAgency.totalShops||0, "#c8c8e0"],
                  ["Total Billed", `₹${bills.filter(b=>b.agencyId===selAgency.id).reduce((s,b)=>s+b.total,0).toLocaleString()}`, "#c084fc"],
                ].map(([k,v,color])=>(
                  <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #1e2130" }}>
                    <span style={{ fontSize:12,color:"#555880" }}>{k}</span>
                    <span style={{ fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14,color }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e2130", fontWeight: 700 }}>🧾 Bills</div>
              {bills.filter(b=>b.agencyId===selAgency.id).length===0 && <div style={{ padding:"18px",color:"#3a3d55",fontSize:13 }}>No bills yet.</div>}
              {bills.filter(b=>b.agencyId===selAgency.id).map(b=>(
                <div key={b.id} className="tr" style={{ display:"grid",gridTemplateColumns:"2.5fr 1fr 1fr 1fr",gap:12,alignItems:"center" }}>
                  <div style={{ fontSize:12,color:"#888aaa" }}>{b.items?.map(i=>PRODUCTS.find(p=>p.id===i.productId)?.name).join(", ")}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace",fontWeight:700 }}>₹{b.total?.toLocaleString()}</div>
                  <div style={{ fontSize:11,color:"#555880" }}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN")||"—"}</div>
                  <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VEHICLES */}
        {page === "vehicles" && (
          <div className="fi">
            <div style={{ marginBottom: 22 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Vehicles</h1>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
              {VEHICLES.map(v => (
                <div key={v.id} className="card">
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: "#555880", marginTop: 4 }}>Driver: {v.driver}</div>
                  <div style={{ fontSize: 11, color: "#3a3d55", marginTop: 3 }}>ID: {v.id}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showBill && (
        <BillModal
          agencies={agencies}
          prefillAgencyId={billAgencyId}
          onClose={() => { setShowBill(false); setBillAgencyId(null); }}
          onSave={saveBill}
        />
      )}
      {showAgencyModal && (
        <AgencyModal
          agency={editAgency}
          onClose={() => setShowAgencyModal(false)}
          onSave={saveAgency}
        />
      )}
    </div>
  );
}
