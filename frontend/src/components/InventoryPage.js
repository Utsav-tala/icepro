// src/components/InventoryPage.js
// Stock levels, the production-shortfall alert, and the stock movement ledger.
//
// Three numbers per product, and the distinction between them is the whole point:
//   On Hand    → boxes physically in the freezer
//   Committed  → boxes already promised to pending (undelivered) orders
//   Available  → onHand - committed. THIS is the number that can go negative, and a
//                negative one is not an error — it is the production signal. We have
//                promised more than we hold, so somebody needs to make the difference.

import { useState, useEffect, useCallback } from "react";
import api from "../api";
import { C } from "../constants";
import { Lbl, Modal, Spin, PageHeader, SC } from "./UI";

// Movement types a human may enter. `sale` is absent on purpose — it is derived from
// bill state by the backend and is rejected if posted here.
const MOVEMENT_TYPES = [
  { val: "production", icon: "🏭", label: "Production",  desc: "Boxes manufactured today",        dir: "in"   },
  { val: "return",     icon: "↩️", label: "Return",      desc: "Agency sent unsold stock back",   dir: "in"   },
  { val: "damage",     icon: "💧", label: "Damage / Melt", desc: "Melt, freezer failure, expiry", dir: "out"  },
  { val: "opening",    icon: "📥", label: "Opening Stock", desc: "Initial count — start of books", dir: "in"  },
  { val: "adjustment", icon: "⚖️", label: "Adjustment",  desc: "Correction after a physical count", dir: "any" },
];

const TYPE_META = {
  production: { icon: "🏭", label: "Production",  color: "#065f46", bg: "#ecfdf5" },
  sale:       { icon: "🧾", label: "Sale",        color: "#9e1015", bg: "#fff0f0" },
  return:     { icon: "↩️", label: "Return",      color: "#1e40af", bg: "#eff6ff" },
  damage:     { icon: "💧", label: "Damage",      color: "#b45309", bg: "#fffbeb" },
  opening:    { icon: "📥", label: "Opening",     color: "#6b3333", bg: "#faf5f5" },
  adjustment: { icon: "⚖️", label: "Adjustment",  color: "#5b21b6", bg: "#f5f3ff" },
};

const fmtDate = (d) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

// Signed number, always with its sign — a ledger is unreadable without it.
const signed = (n) => (n > 0 ? `+${n}` : String(n));

// ── Stock movement modal ──────────────────────────────────────────────────────
function MovementModal({ products, preProduct, onClose, onSaved }) {
  const [productId, setProductId] = useState(preProduct?._id || preProduct?.id || "");
  const [type,      setType]      = useState("production");
  const [qty,       setQty]       = useState("");
  const [notes,     setNotes]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState("");

  const meta    = MOVEMENT_TYPES.find((t) => t.val === type);
  const product = products.find((p) => (p._id || p.id) === productId);

  // Adjustment is a correction, so it may go either way and must accept a signed value.
  // Every other type has its direction baked into its meaning — the backend derives the
  // sign from the type and rejects a negative quantity outright, so we mirror that here.
  const isAdjustment = type === "adjustment";

  async function handleSave() {
    if (!productId)             return setErr("Please select a product.");
    const q = Number(qty);
    if (!qty || isNaN(q) || q === 0) return setErr("Enter a non-zero quantity.");
    if (!isAdjustment && q < 0)
      return setErr(`Quantity must be positive — "${meta.label}" already implies its direction.`);

    setLoading(true); setErr("");
    try {
      await api.post("/inventory/movements", {
        productId,
        type,
        qty:   q,
        notes: notes.trim(),
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || "Failed to record movement. Try again.");
      setLoading(false);
    }
  }

  // What this movement will do to the product's numbers, shown before they commit.
  const delta     = isAdjustment ? Number(qty) || 0
                  : meta.dir === "out" ? -(Number(qty) || 0)
                  : (Number(qty) || 0);
  const nextOnHand    = product ? product.onHand + delta : 0;
  const nextAvailable = product ? nextOnHand - product.committed : 0;

  return (
    <Modal title="📦 Record Stock Movement" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Lbl>Product *</Lbl>
        <select className="sel" value={productId}
          onChange={(e) => { setProductId(e.target.value); setErr(""); }}>
          <option value="">-- Choose Product --</option>
          {products.map((p) => (
            <option key={p._id || p.id} value={p._id || p.id}>
              {p.name} (on hand: {p.onHand})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Lbl>Movement Type *</Lbl>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {MOVEMENT_TYPES.map((t) => (
            <div key={t.val}
              onClick={() => { setType(t.val); setErr(""); }}
              style={{
                padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: `2px solid ${type === t.val ? C.red : C.border}`,
                background: type === t.val ? "#fff0f0" : "#fff",
                transition: "all 0.15s",
              }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{t.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: type === t.val ? C.redDark : C.text }}>
                {t.label}
              </div>
              <div style={{ fontSize: 10, color: C.textLight, marginTop: 1 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Lbl>
          Quantity (boxes) *
          {isAdjustment && (
            <span style={{ color: C.textLight, fontWeight: 500 }}>
              {" "}— use a minus sign to reduce stock
            </span>
          )}
        </Lbl>
        <input className="inp" type="number" step="1"
          placeholder={isAdjustment ? "e.g. -3 (found 3 fewer than the system says)" : "e.g. 40"}
          value={qty} onChange={(e) => { setQty(e.target.value); setErr(""); }} />
      </div>

      {/* Show the consequence before they commit to it. */}
      {product && qty !== "" && !isNaN(Number(qty)) && Number(qty) !== 0 && (
        <div style={{
          background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 10,
          padding: "10px 14px", marginBottom: 14, fontSize: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span style={{ color: C.textLight }}>On hand</span>
            <span style={{ fontWeight: 700 }}>
              {product.onHand} → <span style={{ color: C.redDark }}>{nextOnHand}</span>
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span style={{ color: C.textLight }}>Available (on hand − committed)</span>
            <span style={{ fontWeight: 700 }}>
              {product.available} →{" "}
              <span style={{ color: nextAvailable < 0 ? C.red : "#065f46" }}>{nextAvailable}</span>
            </span>
          </div>
          {nextAvailable < 0 && (
            <div style={{ marginTop: 6, color: C.red, fontWeight: 700, fontSize: 11 }}>
              ⚠️ Still short by {Math.abs(nextAvailable)} boxes against pending orders.
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Lbl>Notes (optional)</Lbl>
        <input className="inp" placeholder="Freezer 2 breakdown, night shift batch..."
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {err && <div className="err-box">⚠️ {err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-red" style={{ flex: 1 }} onClick={handleSave} disabled={loading}>
          {loading ? <><Spin /> Recording...</> : "💾 Record Movement"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ── Movement history for one product ──────────────────────────────────────────
function HistoryModal({ product, onClose }) {
  const [movements, setMovements] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let alive = true;
    api.get("/inventory/movements", { params: { productId: product.productId || product._id, limit: 100 } })
      .then((res) => { if (alive && res.success) setMovements(res.data.movements || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [product]);

  return (
    <Modal title={`📜 Stock History — ${product.name}`} onClose={onClose} wide>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><Spin /> Loading history...</div>
      ) : movements.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📜</div>
          <p>No stock movements recorded for this product yet.</p>
        </div>
      ) : (
        <div style={{ maxHeight: 460, overflowY: "auto" }}>
          {movements.map((m) => {
            const meta = TYPE_META[m.type] || TYPE_META.adjustment;
            return (
              <div key={m._id} style={{
                display: "grid", gridTemplateColumns: "110px 1fr 90px 90px",
                gap: 10, alignItems: "center", padding: "10px 12px",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div>
                  <span style={{
                    background: meta.bg, color: meta.color, borderRadius: 20,
                    fontSize: 10, fontWeight: 800, padding: "3px 9px", whiteSpace: "nowrap",
                  }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
                    {m.notes || "—"}
                  </div>
                  <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>
                    {fmtDate(m.createdAt)}
                    {m.createdByName ? ` · ${m.createdByName}` : ""}
                  </div>
                </div>
                {/* The two columns that make the ledger legible: what moved, and where it landed. */}
                <div style={{ textAlign: "right" }}>
                  {m.onHandDelta !== 0 && (
                    <div style={{ fontSize: 13, fontWeight: 800, color: m.onHandDelta > 0 ? "#065f46" : C.red }}>
                      {signed(m.onHandDelta)}
                    </div>
                  )}
                  {m.committedDelta !== 0 && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309" }}>
                      {signed(m.committedDelta)} committed
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: C.textLight }}>
                  <div>on hand <strong style={{ color: C.text }}>{m.onHandAfter}</strong></div>
                  <div>avail <strong style={{ color: C.text }}>{m.onHandAfter - m.committedAfter}</strong></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── Production shortfall panel ────────────────────────────────────────────────
// Pinned to the top, because this is the thing that must be noticed at production time.
function ShortfallPanel({ shortfalls, onProduce }) {
  if (shortfalls.length === 0) {
    return (
      <div style={{
        background: "#ecfdf5", border: "1px solid #a7f3d0", borderLeft: "4px solid #10b981",
        borderRadius: 12, padding: "12px 16px", marginBottom: 18,
        fontSize: 13, color: "#065f46", fontWeight: 600,
      }}>
        ✓ No shortfalls — every pending order is covered by stock on hand.
      </div>
    );
  }

  const totalBoxes = shortfalls.reduce((s, p) => s + p.shortfall, 0);

  return (
    <div style={{
      background: "#fff0f0", border: `1px solid ${C.red}`, borderLeft: `4px solid ${C.red}`,
      borderRadius: 12, padding: "16px 18px", marginBottom: 18,
    }}>
      <div style={{
        fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 800,
        color: C.redDark, marginBottom: 4,
      }}>
        🏭 Production Required
      </div>
      <div style={{ fontSize: 12, color: C.textMid, marginBottom: 14 }}>
        {shortfalls.length} product{shortfalls.length > 1 ? "s have" : " has"} been promised to
        pending orders beyond what is in the freezer — <strong>{totalBoxes} boxes</strong> short in total.
      </div>

      {shortfalls.map((s) => (
        <div key={s.productId} style={{
          background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10,
          padding: "10px 14px", marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{s.name}</div>
              <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                {s.onHand} on hand · {s.committed} promised
                {s.pendingCount > 0 && ` · ${s.pendingCount} pending order${s.pendingCount > 1 ? "s" : ""}`}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.red, lineHeight: 1.1 }}>
                {s.shortfall}
              </div>
              <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>
                boxes short
              </div>
            </div>
            <button className="btn btn-red" style={{ fontSize: 12, padding: "7px 14px" }}
              onClick={() => onProduce(s)}>
              🏭 Produce
            </button>
          </div>

          {/* Who is waiting, oldest order first — that is the one to make stock for. */}
          {s.pendingBills.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.border}` }}>
              {s.pendingBills.map((b) => (
                <div key={b.billId} style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: C.textMid, padding: "2px 0",
                }}>
                  <span>{b.agencyName}{b.billNo ? ` · ${b.billNo}` : ""}</span>
                  <span style={{ fontWeight: 700 }}>{b.qty} boxes</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function InventoryPage({ currentUser }) {
  const [stock,      setStock]      = useState([]);
  const [shortfalls, setShortfalls] = useState([]);
  const [summary,    setSummary]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [movModal,   setMovModal]   = useState(null);   // { preProduct } | null
  const [histModal,  setHistModal]  = useState(null);
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRes, shortRes, sumRes] = await Promise.all([
        api.get("/inventory"),
        api.get("/inventory/shortfalls"),
        api.get("/inventory/summary"),
      ]);
      if (stockRes.success) setStock(stockRes.data.stock || []);
      if (shortRes.success) setShortfalls(shortRes.data.shortfalls || []);
      if (sumRes.success)   setSummary(sumRes.data);
    } catch (e) {
      console.error("Failed to load inventory", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Replay the ledger and rebuild the cached counters. Owner only — see routes.
  async function doReconcile() {
    setReconciling(true);
    try {
      const res = await api.post("/inventory/reconcile");
      alert(res.message || "Reconcile complete.");
      await load();
    } catch (e) {
      alert(e.message || "Reconcile failed.");
    } finally {
      setReconciling(false);
    }
  }

  const filtered = stock.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="fi" style={{ textAlign: "center", padding: 60 }}>
        <Spin /> Loading inventory...
      </div>
    );
  }

  const COLS = "1fr 90px 90px 90px 120px 90px";

  return (
    <div className="fi">
      {movModal && (
        <MovementModal
          products={stock}
          preProduct={movModal.preProduct}
          onClose={() => setMovModal(null)}
          onSaved={load}
        />
      )}
      {histModal && (
        <HistoryModal product={histModal} onClose={() => setHistModal(null)} />
      )}

      <div className="page-header-sticky">
        <PageHeader
          title="Inventory 🧊"
          sub={`${stock.length} products · on hand, committed to orders, and available to promise`}
          action={
            <div style={{ display: "flex", gap: 8 }}>
              {currentUser?.role === "owner" && (
                <button className="btn btn-ghost" onClick={doReconcile} disabled={reconciling}
                  title="Replay the stock ledger and rebuild the counters">
                  {reconciling ? <><Spin /> …</> : "🔄 Reconcile"}
                </button>
              )}
              <button className="btn btn-red" onClick={() => setMovModal({ preProduct: null })}>
                + Record Movement
              </button>
            </div>
          }
        />
      </div>

      {/* The alert comes FIRST — before the KPIs, before the table. */}
      <ShortfallPanel
        shortfalls={shortfalls}
        onProduce={(s) => setMovModal({ preProduct: { _id: s.productId, name: s.name } })}
      />

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 20 }}>
          <SC label="Boxes On Hand"  value={summary.totalOnHand.toLocaleString()}
              sub="physically in the freezer" icon="🧊" accent="#3b82f6" />
          <SC label="Committed"      value={summary.totalCommitted.toLocaleString()}
              sub="promised to pending orders" icon="🤝" accent="#f59e0b" />
          <SC label="Available"      value={summary.totalAvailable.toLocaleString()}
              sub="free to promise" icon="✅"
              accent={summary.totalAvailable < 0 ? C.red : "#10b981"}
              color={summary.totalAvailable < 0 ? C.red : undefined} />
          <SC label="Produced (month)" value={summary.producedThisMonth.toLocaleString()}
              sub={`${summary.wastedThisMonth} boxes wasted`} icon="🏭" accent="#8b5cf6" />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input className="inp" placeholder="🔍 Search products..." value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 380 }} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">🧊</div>
          <p>{search ? `No products matching "${search}"` : "No products yet — add some on the Products page."}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="mobile-product-hide" style={{
            display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "10px 16px",
            background: "#fff8f8", borderRadius: "14px 14px 0 0", borderBottom: `1px solid ${C.border}`,
          }}>
            {["Product", "On Hand", "Committed", "Available", "Status", ""].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>

          {filtered.map((p) => (
            <div key={p._id} className="tr mobile-product-row"
              style={{
                display: "grid", gridTemplateColumns: COLS, gap: 8, alignItems: "center",
                background: p.isShortfall ? "#fff8f8" : undefined,
              }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                {p.unitsPerBox > 0 && (
                  <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>
                    {p.unitsPerBox} units/box
                  </div>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{p.onHand}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: p.committed > 0 ? "#b45309" : C.textLight }}>
                {p.committed}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: p.available < 0 ? C.red : "#065f46" }}>
                {p.available}
              </div>
              <div>
                {p.isShortfall ? (
                  <span style={{ background: "#fff0f0", color: C.redDark, border: `1px solid ${C.red}`, borderRadius: 20, fontSize: 10, fontWeight: 800, padding: "3px 9px" }}>
                    ⚠️ SHORT {Math.abs(p.available)}
                  </span>
                ) : p.isLowStock ? (
                  <span style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d", borderRadius: 20, fontSize: 10, fontWeight: 800, padding: "3px 9px" }}>
                    LOW
                  </span>
                ) : (
                  <span style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: 20, fontSize: 10, fontWeight: 800, padding: "3px 9px" }}>
                    OK
                  </span>
                )}
              </div>
              <div className="mobile-product-actions" style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }}
                  title="Record a movement for this product"
                  onClick={() => setMovModal({ preProduct: p })}>➕</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }}
                  title="Stock movement history"
                  onClick={() => setHistModal({ productId: p._id, name: p.name })}>📜</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
