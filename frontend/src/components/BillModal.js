// src/components/BillModal.js
import { useState, useRef, useEffect } from "react";
import api from "../api";
import { toWords, shareWhatsApp, computeBalance } from "../helpers";
import { Lbl, Modal, Spin, PrintBillButton } from "./UI";

const C = {
  red: "#c8181e", redDark: "#9e1015", yellow: "#f5c518",
  text: "#1a0505", textLight: "#a07070", textMid: "#6b3333", border: "#f0dada",
};

const DEFAULT_DISC = 14;

// ── Create or edit an ORDER ───────────────────────────────────────────────────
// Bills are now order-first. Saving here creates a `pending` order: it reserves stock but
// books NO money and carries NO invoice number until it is delivered. That is what makes it
// editable — with nothing financial booked against it, changing its items cannot corrupt
// any balance or any later invoice's carried-forward amount.
//
// An agency may hold only ONE open order at a time. Rather than letting someone type out a
// whole bill and only then rejecting it, we look up the agency's open order the instant they
// pick the agency, and show it with its actions.
//
// `editOrder` — pass a pending bill to open this modal in edit mode instead of create mode.
export function CreateBillModal({ agencies, onClose, onSaved, onEditOrder, preAgencyId, editOrder = null, bills = [], payments = [], products = [], appSettings }) {
  const [agencyId,   setAgencyId]   = useState(editOrder?.agencyId || preAgencyId || "");
  const [notes,      setNotes]      = useState(editOrder?.notes || "");
  const [lockedItems,setLockedItems]= useState(
    (editOrder?.items || []).map(it => ({
      productId: it.productId ? String(it.productId) : undefined,
      name: it.name, qty: String(it.qty), rate: it.rate, disc: it.disc ?? 0, amount: it.amount,
    }))
  );
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState("");
  const [saved,      setSaved]      = useState(null);

  // ── The agency's existing open order (blocks creating a second one) ──────────
  const [openOrder,    setOpenOrder]    = useState(null);
  const [checkingOpen, setCheckingOpen] = useState(false);
  const [actioning,    setActioning]    = useState("");   // "deliver" | "cancel" | ""

  // In edit mode we are editing THAT order, so it must not also be reported as a blocker.
  const isEdit   = !!editOrder;
  const editId   = editOrder?._id || editOrder?.id;
  const revision = editOrder?.revision;

  // ── Bill type: "gst" = VMP series (TAX INVOICE), "nongst" = GB series (INVOICE)
  const [billType, setBillType] = useState(editOrder?.billType || "nongst");

  // Active search row state
  const [searchQ,   setSearchQ]   = useState("");
  const [dropOpen,  setDropOpen]  = useState(false);
  const [dropIndex, setDropIndex] = useState(-1);
  const [pickedItem,setPickedItem]= useState(null);
  const [qty,       setQty]       = useState("");
  const [rate,      setRate]      = useState("");
  const [disc,      setDisc]      = useState("");

  const searchRef = useRef(null);
  const qtyRef    = useRef(null);
  const discRef   = useRef(null);
  const dropRef   = useRef(null);

  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 120); }, []);

  // ── Does this agency already have an open order? ────────────────────────────
  // Checked as soon as the agency is picked, so the user is stopped BEFORE typing out a
  // bill that would only be rejected. The server enforces this regardless (a partial unique
  // index — see models/Bill.js); this is purely so the block is friendly and actionable.
  useEffect(() => {
    if (!agencyId || isEdit) { setOpenOrder(null); return; }

    let alive = true;
    setCheckingOpen(true);
    api.get(`/bills/open/${agencyId}`)
      .then(res => { if (alive) setOpenOrder(res.success ? res.data.bill : null); })
      .catch(()  => { if (alive) setOpenOrder(null); })
      .finally(() => { if (alive) setCheckingOpen(false); });

    return () => { alive = false; };
  }, [agencyId, isEdit]);

  // Deliver the blocking order — it becomes a real invoice and frees the agency's slot.
  async function deliverOpenOrder() {
    const id = openOrder?._id || openOrder?.id;
    if (!id) return;
    setActioning("deliver"); setErr("");
    try {
      const res = await api.post(`/bills/${id}/deliver`);
      if (onSaved) onSaved();
      setOpenOrder(null);
      setSaved({ bill: res.data.bill, agency: agencies.find(a => a.id === agencyId), delivered: true });
    } catch (e) {
      setErr(e.message || "Could not deliver the order.");
    } finally { setActioning(""); }
  }

  // Cancel the blocking order — releases its stock commitment and frees the slot.
  async function cancelOpenOrder() {
    const id = openOrder?._id || openOrder?.id;
    if (!id) return;
    if (!window.confirm("Cancel this pending order? Its reserved stock will be released.")) return;
    setActioning("cancel"); setErr("");
    try {
      await api.post(`/bills/${id}/cancel`, { reason: "Replaced by a new order" });
      if (onSaved) onSaved();
      setOpenOrder(null);   // slot is free — the form below unlocks
    } catch (e) {
      setErr(e.message || "Could not cancel the order.");
    } finally { setActioning(""); }
  }

  const catalog  = products.length > 0 ? products : [];
  const filtered = searchQ.trim().length > 0
    ? catalog.filter(c => c.name.toLowerCase().includes(searchQ.toLowerCase()))
    : catalog;

  function pickItem(prod) {
    setSearchQ(prod.name);
    setPickedItem(prod);
    // Use GST rate for GST bills, non-GST rate for non-GST bills
    const effectiveRate = billType === "gst" ? (prod.rateGst ?? prod.rate) : prod.rate;
    setRate(String(effectiveRate));
    setDisc(String(prod.discount ?? DEFAULT_DISC));
    setDropOpen(false);
    setDropIndex(-1);
    setTimeout(() => qtyRef.current?.focus(), 50);
  }

  function lockItem() {
    if (!pickedItem || !qty || Number(qty) <= 0) return;
    const r     = Number(rate) || pickedItem.rate;
    const d     = Number(disc) >= 0 ? Number(disc) : DEFAULT_DISC;
    const gross = Number(qty) * r;
    const amt   = gross * (1 - d / 100);
    // productId is the hard catalog link the inventory engine needs — without it the
    // line moves no stock, since matching on a free-text name is far too fragile.
    setLockedItems(p => [...p, {
      productId: pickedItem._id || pickedItem.id,
      name: pickedItem.name, qty: String(qty), rate: r, disc: d, amount: amt,
    }]);
    setSearchQ(""); setPickedItem(null); setQty(""); setRate(""); setDisc(""); setDropOpen(false); setDropIndex(-1);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function handleQtyEnter(e) {
    if (e.key === "Enter") { e.preventDefault(); setTimeout(() => discRef.current?.focus(), 30); }
  }
  function handleDiscEnter(e) {
    if (e.key === "Enter") { e.preventDefault(); lockItem(); }
  }

  function scrollDropToIndex(idx) {
    if (!dropRef.current) return;
    const items = dropRef.current.querySelectorAll(".iopt");
    if (items[idx]) items[idx].scrollIntoView({ block: "nearest" });
  }

  function handleSearchKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault(); setDropOpen(true);
      setDropIndex(i => { const n = Math.min(i + 1, filtered.length - 1); setTimeout(() => scrollDropToIndex(n), 10); return n; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDropIndex(i => { const n = Math.max(i - 1, 0); setTimeout(() => scrollDropToIndex(n), 10); return n; });
    } else if (e.key === "Enter" && dropOpen && dropIndex >= 0) {
      e.preventDefault(); pickItem(filtered[dropIndex]);
    }
  }

  function removeItem(i) { setLockedItems(p => p.filter((_, idx) => idx !== i)); }
  function editLocked(i, field, val) {
    setLockedItems(p => {
      const a = [...p]; a[i] = { ...a[i], [field]: val };
      const q = Number(a[i].qty);
      const r = Number(a[i].rate);
      const d = Number(a[i].disc) || 0;
      a[i].amount = q * r * (1 - d / 100);
      return a;
    });
  }

  const agency       = agencies.find(a => a.id === agencyId);
  const grossTotal   = lockedItems.reduce((s, it) => s + (Number(it.qty) * Number(it.rate)), 0);
  const totalDiscAmt = lockedItems.reduce((s, it) => s + (Number(it.qty) * Number(it.rate) * (Number(it.disc) || 0) / 100), 0);
  const billAmt      = grossTotal - totalDiscAmt;

  const rawBal      = agencyId ? computeBalance(agencyId, bills, payments) : 0;
  const prevBal     = rawBal > 0 ? rawBal : 0;
  const advanceUsed = rawBal < 0 ? Math.abs(rawBal) : 0;
  const grandTotal  = Math.max(0, billAmt + rawBal);

  const previewGross = pickedItem && qty ? Number(qty) * Number(rate) : 0;
  const previewAmt   = previewGross * (1 - (Number(disc) || 0) / 100);

  // ── Live stock awareness ────────────────────────────────────────────────────
  // `products` already carries onHand/committed/available — Product exposes `available`
  // as a virtual, so GET /api/products returns it with no extra request.
  //
  // Nothing here BLOCKS a bill. Billing beyond stock is deliberate and expected: the
  // resulting negative `available` is exactly how a shortfall reaches the production
  // team via the Inventory page. We only surface the number so whoever is taking the
  // order knows what they are promising.
  const lockedQtyFor = (productId) =>
    lockedItems
      .filter(it => it.productId === productId)
      .reduce((s, it) => s + (Number(it.qty) || 0), 0);

  // Availability net of what is already sitting in this unsaved bill — otherwise adding
  // the same product twice would each show the full stock and understate the shortfall.
  const availableFor = (prod) => {
    const id = prod?._id || prod?.id;
    if (!id || prod.available == null) return null;
    return prod.available - lockedQtyFor(id);
  };

  const pickedAvail = availableFor(pickedItem);
  const afterThis   = pickedAvail != null && qty ? pickedAvail - Number(qty) : null;

  // Every locked line that this bill pushes into shortfall.
  const shortLines = lockedItems.reduce((acc, it) => {
    const prod = products.find(p => (p._id || p.id) === it.productId);
    if (!prod || prod.available == null) return acc;
    if (acc.some(a => a.productId === it.productId)) return acc;   // one entry per product
    const remaining = prod.available - lockedQtyFor(it.productId);
    if (remaining < 0) acc.push({ productId: it.productId, name: prod.name, short: Math.abs(remaining) });
    return acc;
  }, []);

  async function handleSave() {
    if (!agencyId)                return setErr("Please select an agency.");
    if (openOrder)                return setErr("Deliver, edit or cancel this agency's open order first.");
    if (lockedItems.length === 0) return setErr("Add at least one item.");
    if (billAmt === 0)            return setErr("Order total cannot be Rs. 0.");
    setLoading(true);
    setErr("");
    try {
      const payload = { agencyId, billType, items: lockedItems, notes };

      // Edit sends the revision it read. If someone else changed the order in the meantime
      // the server rejects with 409 — without that, this edit's stock delta would be computed
      // from a stale baseline and would permanently corrupt the ledger.
      const res = isEdit
        ? await api.patch(`/bills/${editId}`, { ...payload, revision })
        : await api.post("/bills", payload);

      if (res.success && res.data?.bill) {
        setSaved({ bill: res.data.bill, agency });
        if (onSaved) onSaved();
      } else {
        setErr(res.message || "Failed to save the order.");
      }
    } catch (e) {
      // 409 on create = the agency won its one open-order slot in a concurrent request.
      // Re-fetch it so the blocking panel appears with its actions rather than a dead error.
      if (e.statusCode === 409 && !isEdit) {
        try {
          const open = await api.get(`/bills/open/${agencyId}`);
          if (open.success && open.data.bill) setOpenOrder(open.data.bill);
        } catch { /* fall through to the message below */ }
      }
      setErr(e.message || "Failed to save the order. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  // A pending ORDER and a delivered INVOICE are genuinely different things and get
  // genuinely different screens. An order has no invoice number and nothing to print;
  // showing it in an invoice frame would be a lie.
  if (saved) {
    const b = saved.bill;
    const isPending = b.status === "pending";

    if (isPending) return (
      <Modal title={isEdit ? "✅ Order Updated" : "✅ Order Created"} onClose={onClose}>
        <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>📋</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: C.redDark, marginBottom: 4 }}>
            {b.agencyName}
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d", borderRadius: 20, fontSize: 11, fontWeight: 800, padding: "3px 12px" }}>
              ⏳ PENDING DELIVERY
            </span>
          </div>

          <div style={{ background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 18px", marginBottom: 14, textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
              <span style={{ color: C.textLight }}>{b.items?.length || 0} item(s)</span>
              <span style={{ fontWeight: 700 }}>{(b.items || []).reduce((s, i) => s + Number(i.qty || 0), 0)} boxes</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, padding: "8px 0 0", marginTop: 4, borderTop: `2px solid ${C.border}` }}>
              <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: C.text }}>Order Value</span>
              <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: C.red }}>Rs. {(b.total || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Say plainly what has and has NOT happened — this is the part people get wrong. */}
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "#1e40af", textAlign: "left" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Stock is reserved. No invoice yet.</div>
            This order has <strong>no invoice number</strong> and does <strong>not</strong> count toward
            the agency's balance. Both happen when you deliver it — which is also when it stops being
            editable. Until then, you can change it freely.
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={onClose}>Done</button>
          </div>
        </div>
      </Modal>
    );

    // Delivered → a real invoice.
    return (
      <Modal title="✅ Delivered — Invoice Issued" onClose={onClose}>
        <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🧾</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: C.redDark, marginBottom: 4 }}>{b.billNo}</div>
          <div style={{ fontSize: 14, color: C.textLight, marginBottom: 4 }}>{b.agencyName}</div>
          <div style={{ marginBottom: 12 }}>
            {b.billType === "gst"
              ? <span style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: 20, fontSize: 11, fontWeight: 800, padding: "3px 12px" }}>✓ GST Invoice (TAX INVOICE)</span>
              : <span style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 20, fontSize: 11, fontWeight: 800, padding: "3px 12px" }}>📄 Non-GST Invoice (INVOICE)</span>
            }
          </div>
          <div style={{ background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 18px", marginBottom: 16, textAlign: "left" }}>
            {b.discountAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", color: "#065f46" }}>
                <span>Discount Saved</span><span style={{ fontWeight: 700 }}>- Rs. {b.discountAmt.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
              <span style={{ color: C.textLight }}>Current Bill</span><span style={{ fontWeight: 700 }}>Rs. {(b.total || 0).toLocaleString()}</span>
            </div>
            {b.prevBalance > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: C.red }}>
                <span>Previous Pending Balance</span><span style={{ fontWeight: 700 }}>+ Rs. {b.prevBalance.toLocaleString()}</span>
              </div>
            )}
            {b.advanceUsed > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: "#065f46" }}>
                <span>Advance Credit Used</span><span style={{ fontWeight: 700 }}>- Rs. {b.advanceUsed.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, padding: "8px 0 0", marginTop: 4, borderTop: `2px solid ${C.border}` }}>
              <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: C.text }}>Total Due</span>
              <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: C.red }}>Rs. {(b.grandTotal || 0).toLocaleString()}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <PrintBillButton bill={b} label="Print / Save PDF" style={{ fontSize: 13, padding: "10px 20px" }} />
            <button className="btn btn-green" style={{ fontSize: 13, padding: "10px 20px" }} onClick={() => shareWhatsApp(b, saved.agency, appSettings)}>💬 WhatsApp</button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </Modal>
    );
  }

  // Column layout
  const COLS = "1fr 60px 80px 55px 95px 28px";

  return (
    <Modal title={isEdit ? "✏️ Edit Order" : "📋 New Order"} onClose={onClose} wide>

      {/* Set expectations up front. "Create Bill" used to mint an invoice on the spot;
          it now takes an order, and the invoice comes at delivery. */}
      {!openOrder && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "9px 14px", marginBottom: 16, fontSize: 12, color: "#1e40af" }}>
          📋 This creates an <strong>order</strong> — stock is reserved, but no invoice number is
          issued and nothing is added to the agency's balance until you <strong>deliver</strong> it.
          It stays editable until then.
        </div>
      )}

      {/* ── Bill Type Toggle — GST / Non-GST ── */}
      {!openOrder && (
      <div style={{ marginBottom: 18 }}>
        <Lbl>Bill Type</Lbl>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            {
              val: "nongst",
              icon: "📄",
              title: "Non-GST Bill",
              sub: "Series: GB/25-26/XXXX",
              desc: "Standard invoice without GST",
              activeBg: "#eff6ff",
              activeBorder: "#3b82f6",
              activeColor: "#1e40af",
            },
            {
              val: "gst",
              icon: "🧾",
              title: "GST Bill",
              sub: "Series: VMP/25-26/XXXX",
              desc: "Tax invoice with GSTIN",
              activeBg: "#ecfdf5",
              activeBorder: "#10b981",
              activeColor: "#065f46",
            },
          ].map(opt => (
            <div
              key={opt.val}
              onClick={() => { setBillType(opt.val); setErr(""); }}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: `2px solid ${billType === opt.val ? opt.activeBorder : C.border}`,
                background: billType === opt.val ? opt.activeBg : "#fff",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{opt.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: billType === opt.val ? opt.activeColor : C.text, marginBottom: 2 }}>{opt.title}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: billType === opt.val ? opt.activeBorder : C.textLight, marginBottom: 2 }}>{opt.sub}</div>
              <div style={{ fontSize: 11, color: C.textLight }}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Agency selector — locked in edit mode; an order cannot change hands. */}
      <div style={{ marginBottom: 14 }}>
        <Lbl>Select Agency *</Lbl>
        <select className="sel" value={agencyId} disabled={isEdit}
          onChange={e => { setAgencyId(e.target.value); setErr(""); }}>
          <option value="">-- Choose Agency --</option>
          {agencies.map(a => <option key={a.id} value={a.id}>{a.name} — {a.city}</option>)}
        </select>
        {checkingOpen && (
          <div style={{ fontSize: 11, color: C.textLight, marginTop: 5 }}>
            <Spin /> Checking for an open order…
          </div>
        )}
      </div>

      {/* ── ONE OPEN ORDER PER AGENCY ────────────────────────────────────────
          This agency already has a pending order, so a second one cannot be created.
          Rather than a dead-end error, show the order and its three ways out. Editing it
          is almost always what the user actually wants — it beats cancelling and retyping. */}
      {openOrder && (
        <div style={{ background: "#fff0f0", border: `1px solid ${C.red}`, borderLeft: `4px solid ${C.red}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 800, color: C.redDark, marginBottom: 4 }}>
            ⛔ This agency already has a pending order
          </div>
          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 12 }}>
            <strong>{openOrder.agencyName}</strong> can only hold one open order at a time.
            Deliver it, edit it, or cancel it before creating a new one.
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
            {(openOrder.items || []).map((it, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0", color: C.textMid }}>
                <span>{it.name}</span>
                <span style={{ fontWeight: 700 }}>{it.qty} × Rs.{it.rate}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, marginTop: 6, borderTop: `1px dashed ${C.border}` }}>
              <span style={{ color: C.textLight }}>
                Ordered {new Date(openOrder.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
              <span style={{ fontWeight: 800, color: C.redDark }}>Rs. {(openOrder.total || 0).toLocaleString()}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-red" style={{ fontSize: 12, padding: "8px 14px" }}
              disabled={!!actioning || !onEditOrder}
              onClick={() => onEditOrder?.(openOrder)}>
              ✏️ Edit this order
            </button>
            <button className="btn btn-green" style={{ fontSize: 12, padding: "8px 14px" }}
              disabled={!!actioning} onClick={deliverOpenOrder}>
              {actioning === "deliver" ? <><Spin /> Delivering…</> : "🚚 Deliver it now"}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}
              disabled={!!actioning} onClick={cancelOpenOrder}>
              {actioning === "cancel" ? <><Spin /> Cancelling…</> : "🗑️ Cancel it"}
            </button>
          </div>
        </div>
      )}

      {!openOrder && (<>

      {/* Balance alerts. Wording matters here: on an ORDER the balance is NOT applied yet —
          the server snapshots it at delivery. Saying "will be added to this bill" would be
          a lie about what is happening right now. */}
      {agencyId && prevBal > 0 && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderLeft: "4px solid #ffc107", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          ⚠️ This agency has <strong>Rs. {prevBal.toLocaleString()}</strong> outstanding — it will be carried onto the invoice <strong>when this order is delivered</strong>.
        </div>
      )}
      {agencyId && rawBal < 0 && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderLeft: "4px solid #10b981", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#065f46" }}>
          This agency has <strong>Rs. {advanceUsed.toLocaleString()}</strong> advance credit — it will be deducted <strong>when this order is delivered</strong>.
        </div>
      )}
      {products.length === 0 && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          ⚠️ Product catalog is loading or empty. Go to Products page to add items.
        </div>
      )}

      {/* Items section */}
      <div style={{ marginBottom: 14 }}>
        <Lbl>Items</Lbl>
        <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "visible" }}>
          {/* Header */}
          <div className="mobile-item-header" style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 12px", background: "#fef0f0", borderBottom: `1px solid ${C.border}`, borderRadius: "12px 12px 0 0" }}>
            {["Product Name", "Qty", "Rate", "Disc%", "Amount", ""].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>

          <div className="mobile-item-grid">
            {/* Locked items */}
            {lockedItems.map((it, i) => (
              <div key={i} className="mobile-item-row"
                style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, alignItems: "center", background: i % 2 === 0 ? "#fff" : "#fffcfc" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.name}>{it.name}</div>
                <div className="mobile-item-row-controls">
                  <input className="inp" style={{ padding: "5px 6px", fontSize: 12, textAlign: "center" }} type="number" min="1" value={it.qty}
                    onChange={e => editLocked(i, "qty", e.target.value)} />
                  <input className="inp" style={{ padding: "5px 6px", fontSize: 12, textAlign: "right" }} type="number" value={it.rate}
                    onChange={e => editLocked(i, "rate", e.target.value)} />
                  <input className="inp" style={{ padding: "5px 4px", fontSize: 11, textAlign: "center", color: "#065f46" }} type="number" min="0" max="100" value={it.disc ?? DEFAULT_DISC}
                    onChange={e => editLocked(i, "disc", e.target.value)} />
                  <div style={{ fontWeight: 800, fontSize: 13, color: C.redDark, textAlign: "right" }}>Rs.{(it.amount || 0).toLocaleString()}</div>
                </div>
                <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: C.textLight }}>✕</button>
              </div>
            ))}

            {/* Active search row */}
            <div className="mobile-item-row"
              style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 12px", alignItems: "center", overflow: "visible", background: "#fff8f8", borderTop: lockedItems.length > 0 ? `2px dashed ${C.border}` : "none" }}>
              <div className="iswrap">
                <input
                  ref={searchRef} className="inp"
                  style={{ padding: "7px 10px", fontSize: 12, background: pickedItem ? "#f0fff4" : "#fff", borderColor: pickedItem ? "#10b981" : C.border }}
                  placeholder={catalog.length > 0 ? "🔍 Search or click to browse..." : "Loading products..."}
                  value={searchQ}
                  onChange={e => { setSearchQ(e.target.value); setPickedItem(null); setRate(""); setDisc(""); setDropOpen(true); setDropIndex(-1); }}
                  onFocus={() => setDropOpen(true)}
                  onBlur={() => setTimeout(() => { setDropOpen(false); setDropIndex(-1); }, 180)}
                  onKeyDown={handleSearchKeyDown}
                  disabled={catalog.length === 0}
                />
                {dropOpen && filtered.length > 0 && (
                  <div className="idrop" ref={dropRef}>
                    {filtered.map((p, idx) => {
                      const avail = availableFor(p);
                      return (
                        <div key={p.id} className="iopt"
                          style={{ background: idx === dropIndex ? "#fff0f0" : undefined }}
                          onMouseDown={() => pickItem(p)}>
                          <div className="iopt-name">{p.name}</div>
                          <div className="iopt-rate">
                            Rs. {p.rate} / box &nbsp;·&nbsp; {p.discount ?? DEFAULT_DISC}% disc
                            {avail != null && (
                              <>
                                {" "}&nbsp;·&nbsp;
                                <span style={{ fontWeight: 800, color: avail > 0 ? "#065f46" : C.red }}>
                                  {avail > 0 ? `${avail} in stock` : `${Math.abs(avail)} short`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {dropOpen && searchQ.trim().length > 0 && filtered.length === 0 && (
                  <div className="idrop">
                    <div className="iopt"><span style={{ color: C.textLight, fontSize: 12 }}>No products found for "{searchQ}"</span></div>
                  </div>
                )}
              </div>
              <div className="mobile-item-row-controls">
                <input ref={qtyRef} className="inp" style={{ padding: "7px 8px", fontSize: 12, textAlign: "center", opacity: pickedItem ? 1 : 0.4 }}
                  type="number" min="1" placeholder="Qty" value={qty} disabled={!pickedItem}
                  onChange={e => setQty(e.target.value)} onKeyDown={handleQtyEnter} />
                <input className="inp" style={{ padding: "7px 8px", fontSize: 12, textAlign: "right", opacity: pickedItem ? 1 : 0.4 }}
                  type="number" placeholder="Rate" value={rate} disabled={!pickedItem}
                  onChange={e => setRate(e.target.value)} />
                <input ref={discRef} className="inp"
                  style={{ padding: "7px 6px", fontSize: 11, textAlign: "center", opacity: pickedItem ? 1 : 0.4, color: "#065f46", borderColor: pickedItem ? "#10b981" : C.border }}
                  type="number" min="0" max="100" placeholder="Disc%" value={disc} disabled={!pickedItem}
                  onChange={e => setDisc(e.target.value)} onKeyDown={handleDiscEnter} />
                <div style={{ fontWeight: 800, fontSize: 13, color: pickedItem && qty ? C.redDark : C.textLight, textAlign: "right" }}>
                  {pickedItem && qty ? `Rs.${(previewAmt).toLocaleString(undefined, {maximumFractionDigits:0})}` : "—"}
                </div>
              </div>
              <button onClick={lockItem} disabled={!pickedItem || !qty || Number(qty) <= 0}
                style={{ background: pickedItem && qty ? C.red : "#eee", border: "none", borderRadius: 6, cursor: pickedItem && qty ? "pointer" : "default", fontSize: 16, color: pickedItem && qty ? "#fff" : C.textLight, lineHeight: 1, padding: "4px 0", transition: "all 0.15s", fontWeight: 800 }}>+</button>
            </div>
          </div>

          {/* Live availability for the line currently being entered. */}
          {pickedItem && pickedAvail != null && (
            <div style={{ padding: "6px 14px", background: "#fff", borderTop: `1px dashed ${C.border}`, fontSize: 11, color: C.textLight }}>
              <strong style={{ color: pickedAvail > 0 ? "#065f46" : C.red }}>{pickedAvail}</strong> available
              {qty && Number(qty) > 0 && afterThis != null && (
                <> &nbsp;→&nbsp; after this line:{" "}
                  <strong style={{ color: afterThis < 0 ? C.red : "#065f46" }}>{afterThis}</strong>
                  {afterThis < 0 && ` — ${Math.abs(afterThis)} short, production will be alerted`}
                </>
              )}
            </div>
          )}

          {lockedItems.length > 0 && (
            <div style={{ padding: "8px 14px", background: "#fef0f0", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", borderRadius: "0 0 12px 12px" }}>
              <span style={{ fontSize: 11, color: C.textLight, fontWeight: 700 }}>{lockedItems.length} item{lockedItems.length > 1 ? "s" : ""} added</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>Saved: Rs. {totalDiscAmt.toFixed(0)} &nbsp;|&nbsp; <span style={{ color: C.redDark }}>Net: Rs. {billAmt.toLocaleString()}</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Stock shortfall notice — INFORMATIONAL ONLY, it never blocks the bill.
          Taking an order you cannot yet fill is normal here: the shortfall is what
          tells the production team what to make. This just makes sure the person
          taking the order knows they are creating one. */}
      {shortLines.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderLeft: "4px solid #f59e0b", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          <div style={{ fontWeight: 800, color: "#b45309", marginBottom: 4 }}>
            🏭 This bill goes beyond available stock
          </div>
          {shortLines.map(s => (
            <div key={s.productId} style={{ fontSize: 12, color: C.textMid, padding: "1px 0" }}>
              <strong>{s.name}</strong> — short by {s.short} box{s.short > 1 ? "es" : ""}
            </div>
          ))}
          <div style={{ fontSize: 11, color: C.textLight, marginTop: 5 }}>
            That's fine — the bill will go through, and the shortfall will show up on the
            Inventory page so production knows what to make.
          </div>
        </div>
      )}

      {/* Notes */}
      <div style={{ marginBottom: 14 }}>
        <Lbl>Notes (optional)</Lbl>
        <input className="inp" placeholder="Festival stock, special order..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {/* Totals breakdown. The headline figure is the ORDER TOTAL — the agency's outstanding
          balance is deliberately NOT rolled into it, because an order books no money. The
          server computes the true grand total at delivery, against the balance as it stands
          THEN (which may have changed by the time the boxes actually go out). */}
      <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}` }}>
          <span style={{ color: C.textLight }}>Gross Total (before discount)</span>
          <span style={{ fontWeight: 700 }}>Rs. {grossTotal.toLocaleString()}</span>
        </div>
        {totalDiscAmt > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}`, color: "#065f46" }}>
            <span>Total Discount (per product)</span>
            <span style={{ fontWeight: 700 }}>- Rs. {totalDiscAmt.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 4, borderTop: `2px solid ${C.border}` }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 800, color: C.text }}>Order Total</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800, color: C.red }}>Rs. {billAmt.toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 11, color: C.textLight, marginTop: 6, fontStyle: "italic" }}>{toWords(billAmt)}</div>

        {(prevBal > 0 || advanceUsed > 0) && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}`, fontSize: 11, color: C.textLight }}>
            {prevBal > 0 && <>Previous balance of <strong>Rs. {prevBal.toLocaleString()}</strong> will be added at delivery — invoice total ≈ Rs. {grandTotal.toLocaleString()}.</>}
            {advanceUsed > 0 && <>Advance credit of <strong>Rs. {advanceUsed.toLocaleString()}</strong> will be deducted at delivery — invoice total ≈ Rs. {grandTotal.toLocaleString()}.</>}
          </div>
        )}
      </div>

      {err && <div className="err-box">⚠️ {err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-red" style={{ flex: 1, padding: 12 }} onClick={handleSave} disabled={loading}>
          {loading
            ? <><Spin /> Saving…</>
            : isEdit
              ? `💾 Update Order${lockedItems.length > 0 ? ` (${lockedItems.length} items)` : ""}`
              : `📋 Create Order${lockedItems.length > 0 ? ` (${lockedItems.length} items)` : ""}`}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>

      </>)}
    </Modal>
  );
}