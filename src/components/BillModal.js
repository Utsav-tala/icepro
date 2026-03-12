// src/components/BillModal.js
import { useState, useRef, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { ITEM_CATALOG } from "../constants";
import { genInvNo, toWords, printInvoice, shareWhatsApp, computeBalance } from "../helpers";
import { Lbl, Modal, Spin } from "./UI";

const C = {
  red: "#c8181e", redDark: "#9e1015", yellow: "#f5c518",
  text: "#1a0505", textLight: "#a07070", textMid: "#6b3333", border: "#f0dada",
};

// ── CREATE BILL MODAL ─────────────────────────────────────────────────────────
export function CreateBillModal({ agencies, onClose, preAgencyId, currentUser, bills = [], payments = [] }) {
  const [agencyId,    setAgencyId]    = useState(preAgencyId || "");
  const [notes,       setNotes]       = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [lockedItems, setLockedItems] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState("");
  const [saved,       setSaved]       = useState(null);

  // Active search row state
  const [searchQ,    setSearchQ]    = useState("");
  const [dropOpen,   setDropOpen]   = useState(false);
  const [dropIndex,  setDropIndex]  = useState(-1);
  const [pickedItem, setPickedItem] = useState(null);
  const [qty,        setQty]        = useState("");
  const [rate,       setRate]       = useState("");

  const searchRef = useRef(null);
  const qtyRef    = useRef(null);
  const dropRef   = useRef(null);

  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 120); }, []);

  // Show ALL items on focus, filter when typing
  const filtered = searchQ.trim().length > 0
    ? ITEM_CATALOG.filter(c => c.name.toLowerCase().includes(searchQ.toLowerCase()))
    : ITEM_CATALOG;

  function pickItem(cat) {
    setSearchQ(cat.name);
    setPickedItem(cat);
    setRate(String(cat.rate));
    setDropOpen(false);
    setDropIndex(-1);
    setTimeout(() => qtyRef.current?.focus(), 50);
  }

  function lockItem() {
    if (!pickedItem || !qty || Number(qty) <= 0) return;
    const r   = Number(rate) || pickedItem.rate;
    const amt = Number(qty) * r;
    setLockedItems(p => [...p, { name: pickedItem.name, qty: String(qty), rate: r, amount: amt }]);
    setSearchQ(""); setPickedItem(null); setQty(""); setRate(""); setDropOpen(false); setDropIndex(-1);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function handleQtyEnter(e) {
    if (e.key === "Enter") { e.preventDefault(); lockItem(); }
  }

  function scrollDropToIndex(idx) {
    if (!dropRef.current) return;
    const items = dropRef.current.querySelectorAll(".iopt");
    if (items[idx]) items[idx].scrollIntoView({ block: "nearest" });
  }

  function handleSearchKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDropOpen(true);
      setDropIndex(i => { const next = Math.min(i + 1, filtered.length - 1); setTimeout(() => scrollDropToIndex(next), 10); return next; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDropIndex(i => { const next = Math.max(i - 1, 0); setTimeout(() => scrollDropToIndex(next), 10); return next; });
    } else if (e.key === "Enter" && dropOpen && dropIndex >= 0) {
      e.preventDefault();
      pickItem(filtered[dropIndex]);
    }
  }

  function removeItem(i) { setLockedItems(p => p.filter((_, idx) => idx !== i)); }

  function editLocked(i, field, val) {
    setLockedItems(p => {
      const a = [...p]; a[i] = { ...a[i], [field]: val };
      a[i].amount = (field === "qty" ? Number(val) : Number(a[i].qty)) * (field === "rate" ? Number(val) : Number(a[i].rate));
      return a;
    });
  }

  const agency   = agencies.find(a => a.id === agencyId);
  const subtotal = lockedItems.reduce((s, it) => s + (it.amount || 0), 0);
  const discPct  = Number(discountPct) || 0;
  const discAmt  = subtotal * discPct / 100;
  const billAmt  = subtotal - discAmt;   // actual current bill amount (stored as bill.total)

  // Live balance: rawBal>0 = outstanding (add), rawBal<0 = advance credit (subtract)
  const rawBal      = agencyId ? computeBalance(agencyId, bills, payments) : 0;
  const prevBal     = rawBal > 0 ? rawBal : 0;             // pending outstanding to add
  const advanceUsed = rawBal < 0 ? Math.abs(rawBal) : 0;  // advance credit to deduct
  const grandTotal  = Math.max(0, billAmt + rawBal);       // billAmt + prevBal - advanceUsed

  async function handleSave() {
    if (!agencyId)                return setErr("Please select an agency.");
    if (lockedItems.length === 0) return setErr("Add at least one item.");
    if (subtotal === 0)           return setErr("Bill total cannot be Rs. 0.");
    setLoading(true);
    try {
      const billNo = genInvNo();
      const ref = await addDoc(collection(db, "bills"), {
        billNo,
        agencyId,
        agencyName:    agency?.name || "",
        items:         lockedItems,
        subtotal,
        discountPct:   discPct,
        discountAmt:   discAmt,
        total:         billAmt,       // ← actual bill amount only (for balance math)
        prevBalance:   prevBal,       // ← previous pending stored for display
        advanceUsed:   advanceUsed,   // ← advance credit deducted (for display)
        grandTotal:    grandTotal,    // ← total due for display/print/WA
        notes,
        createdByName: currentUser?.name || "",
        createdByUid:  currentUser?.uid  || "",
        createdAt:     serverTimestamp(),
      });

      // Write transaction record under agency
      await addDoc(collection(db, "agencies", agencyId, "transactions"), {
        type:          "bill",
        billNo,
        billId:        ref.id,
        amount:        billAmt,
        prevBalance:   prevBal,
        advanceUsed:   advanceUsed,
        createdByName: currentUser?.name || "",
        createdAt:     serverTimestamp(),
      });

      const savedBill = {
        id: ref.id, billNo, agencyId,
        agencyName:  agency?.name || "",
        items:       lockedItems,
        subtotal,
        discountAmt: discAmt,
        total:       billAmt,
        prevBalance: prevBal,
        advanceUsed,
        grandTotal,
        notes,
        createdByName: currentUser?.name || "",
      };
      setSaved({ bill: savedBill, agency });
    } catch (e) { setErr("Failed to save bill. Please try again."); setLoading(false); }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (saved) return (
    <Modal title="✅ Bill Created!" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🧾</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: C.redDark, marginBottom: 4 }}>{saved.bill.billNo}</div>
        <div style={{ fontSize: 14, color: C.textLight, marginBottom: 6 }}>{saved.bill.agencyName}</div>

        {/* Bill summary */}
        <div style={{ background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 18px", marginBottom: 16, textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
            <span style={{ color: C.textLight }}>Current Bill</span>
            <span style={{ fontWeight: 700 }}>Rs. {billAmt.toLocaleString()}</span>
          </div>
          {saved.bill.prevBalance > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: C.red }}>
              <span>Previous Pending Balance</span>
              <span style={{ fontWeight: 700 }}>+ Rs. {saved.bill.prevBalance.toLocaleString()}</span>
            </div>
          )}
          {saved.bill.advanceUsed > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: "#065f46" }}>
              <span>Advance Credit Used</span>
              <span style={{ fontWeight: 700 }}>- Rs. {saved.bill.advanceUsed.toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, padding: "8px 0 0", marginTop: 4, borderTop: `2px solid ${C.border}` }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: C.text }}>Total Due</span>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: C.red }}>Rs. {grandTotal.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#065f46" }}>✓ Saved to Firestore</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-red"   style={{ fontSize: 13, padding: "10px 20px" }} onClick={() => printInvoice(saved.bill, saved.agency)}>🖨️ Print / PDF</button>
          <button className="btn btn-green" style={{ fontSize: 13, padding: "10px 20px" }} onClick={() => shareWhatsApp(saved.bill, saved.agency)}>💬 Send on WhatsApp</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );

  return (
    <Modal title="🧾 Create New Bill" onClose={onClose} wide>
      {/* Agency */}
      <div style={{ marginBottom: 14 }}>
        <Lbl>Select Agency *</Lbl>
        <select className="sel" value={agencyId} onChange={e => { setAgencyId(e.target.value); setErr(""); }}>
          <option value="">-- Choose Agency --</option>
          {agencies.map(a => <option key={a.id} value={a.id}>{a.name} — {a.city}</option>)}
        </select>
      </div>

      {/* Previous balance alert */}
      {agencyId && prevBal > 0 && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderLeft: "4px solid #ffc107", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          ⚠️ This agency has <strong>Rs. {prevBal.toLocaleString()}</strong> pending from previous bills. It will be added to this bill's total.
        </div>
      )}
      {agencyId && rawBal < 0 && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderLeft: "4px solid #10b981", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#065f46" }}>
          This agency has <strong>Rs. {Math.abs(rawBal).toLocaleString()}</strong> advance credit — it will be deducted from this bill's total.
        </div>
      )}

      {/* Items section */}
      <div style={{ marginBottom: 14 }}>
        <Lbl>Items</Lbl>
        <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "visible" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 100px 28px", gap: 8, padding: "8px 12px", background: "#fef0f0", borderBottom: `1px solid ${C.border}`, borderRadius: "12px 12px 0 0" }}>
            {["Product Name", "Qty", "Rate (Rs.)", "Amount", ""].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>

          {/* Locked items */}
          {lockedItems.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 100px 28px", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, alignItems: "center", background: i % 2 === 0 ? "#fff" : "#fffcfc" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, paddingLeft: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.name}>{it.name}</div>
              <input className="inp" style={{ padding: "5px 6px", fontSize: 12, textAlign: "center" }} type="number" min="1" value={it.qty} onChange={e => editLocked(i, "qty", e.target.value)} />
              <input className="inp" style={{ padding: "5px 6px", fontSize: 12, textAlign: "right" }} type="number" value={it.rate} onChange={e => editLocked(i, "rate", e.target.value)} />
              <div style={{ fontWeight: 800, fontSize: 13, color: C.redDark, textAlign: "right", paddingRight: 4 }}>Rs.{(it.amount || 0).toLocaleString()}</div>
              <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: C.textLight }}>✕</button>
            </div>
          ))}

          {/* Active search row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 100px 28px", gap: 8, padding: "8px 12px", alignItems: "center", overflow: "visible", background: "#fff8f8", borderTop: lockedItems.length > 0 ? `2px dashed ${C.border}` : "none" }}>
            <div className="iswrap">
              <input
                ref={searchRef}
                className="inp"
                style={{ padding: "7px 10px", fontSize: 12, background: pickedItem ? "#f0fff4" : "#fff", borderColor: pickedItem ? "#10b981" : C.border }}
                placeholder="🔍 Type to search item..."
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); setPickedItem(null); setRate(""); setDropOpen(true); setDropIndex(-1); }}
                onFocus={() => setDropOpen(true)}
                onBlur={() => setTimeout(() => { setDropOpen(false); setDropIndex(-1); }, 180)}
                onKeyDown={handleSearchKeyDown}
              />
              {dropOpen && filtered.length > 0 && (
                <div className="idrop" ref={dropRef}>
                  {filtered.map((c, idx) => (
                    <div key={c.id} className="iopt"
                      style={{ background: idx === dropIndex ? "#fff0f0" : undefined }}
                      onMouseDown={() => pickItem(c)}>
                      <div className="iopt-name">{c.name}</div>
                      <div className="iopt-rate">Rs. {c.rate} / box</div>
                    </div>
                  ))}
                </div>
              )}
              {dropOpen && searchQ.trim().length > 0 && filtered.length === 0 && (
                <div className="idrop">
                  <div className="iopt"><span style={{ color: C.textLight, fontSize: 12 }}>No items found for "{searchQ}"</span></div>
                </div>
              )}
            </div>
            <input ref={qtyRef} className="inp" style={{ padding: "7px 8px", fontSize: 12, textAlign: "center", opacity: pickedItem ? 1 : 0.4 }}
              type="number" min="1" placeholder="Qty" value={qty} disabled={!pickedItem}
              onChange={e => setQty(e.target.value)} onKeyDown={handleQtyEnter} />
            <input className="inp" style={{ padding: "7px 8px", fontSize: 12, textAlign: "right", opacity: pickedItem ? 1 : 0.4 }}
              type="number" placeholder="Rate" value={rate} disabled={!pickedItem}
              onChange={e => setRate(e.target.value)} />
            <div style={{ fontWeight: 800, fontSize: 13, color: pickedItem && qty ? C.redDark : C.textLight, textAlign: "right", paddingRight: 4 }}>
              {pickedItem && qty ? `Rs.${(Number(qty) * Number(rate)).toLocaleString()}` : "—"}
            </div>
            <button onClick={lockItem} disabled={!pickedItem || !qty || Number(qty) <= 0}
              title="Add item (or press Enter in Qty)"
              style={{ background: pickedItem && qty ? C.red : "#eee", border: "none", borderRadius: 6, cursor: pickedItem && qty ? "pointer" : "default", fontSize: 16, color: pickedItem && qty ? "#fff" : C.textLight, lineHeight: 1, padding: "4px 0", transition: "all 0.15s", fontWeight: 800 }}>+</button>
          </div>

          {lockedItems.length > 0 && (
            <div style={{ padding: "8px 14px", background: "#fef0f0", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", borderRadius: "0 0 12px 12px" }}>
              <span style={{ fontSize: 11, color: C.textLight, fontWeight: 700 }}>{lockedItems.length} item{lockedItems.length > 1 ? "s" : ""} added</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.redDark }}>Sub Total: Rs. {subtotal.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Discount + Notes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div><Lbl>Discount %</Lbl><input className="inp" type="number" min="0" max="100" step="0.01" placeholder="e.g. 14" value={discountPct} onChange={e => setDiscountPct(e.target.value)} /></div>
        <div><Lbl>Notes (optional)</Lbl><input className="inp" placeholder="Festival stock, special order..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
      </div>

      {/* Totals breakdown */}
      <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}` }}>
          <span style={{ color: C.textLight }}>Sub Total</span>
          <span style={{ fontWeight: 700 }}>Rs. {subtotal.toLocaleString()}</span>
        </div>
        {discPct > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}`, color: C.red }}>
            <span>Discount ({discPct}%)</span>
            <span style={{ fontWeight: 700 }}>- Rs. {discAmt.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: (prevBal > 0 || advanceUsed > 0) ? `1px dashed ${C.border}` : "none" }}>
          <span style={{ color: C.textLight }}>Current Bill Amount</span>
          <span style={{ fontWeight: 700 }}>Rs. {billAmt.toLocaleString()}</span>
        </div>
        {prevBal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}`, color: C.red }}>
            <span style={{ fontWeight: 700 }}>Previous Pending Balance</span>
            <span style={{ fontWeight: 700 }}>+ Rs. {prevBal.toLocaleString()}</span>
          </div>
        )}
        {advanceUsed > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}`, color: "#065f46" }}>
            <span style={{ fontWeight: 700 }}>Advance Credit Applied</span>
            <span style={{ fontWeight: 700 }}>- Rs. {advanceUsed.toLocaleString()}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 4, borderTop: `2px solid ${C.border}` }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 800, color: C.text }}>Grand Total</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800, color: C.red }}>Rs. {grandTotal.toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 11, color: C.textLight, marginTop: 6, fontStyle: "italic" }}>{toWords(grandTotal)}</div>
      </div>

      {err && <div className="err-box">⚠️ {err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-red" style={{ flex: 1, padding: 12 }} onClick={handleSave} disabled={loading}>
          {loading ? <><Spin /> Saving...</> : `💾 Create Bill${lockedItems.length > 0 ? ` (${lockedItems.length} items)` : ""}`}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
