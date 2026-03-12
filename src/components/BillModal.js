// // src/components/BillModal.js
// import { useState, useRef } from "react";
// import { collection, doc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
// import { db } from "../firebase";
// import { ITEM_CATALOG } from "../constants";
// import { genInvNo, toWords, printInvoice, shareWhatsApp } from "../helpers";
// import { Lbl, Modal, Spin } from "./UI";

// const C = {
//   red: "#c8181e", redDark: "#9e1015", yellow: "#f5c518",
//   text: "#1a0505", textLight: "#a07070", textMid: "#6b3333", border: "#f0dada",
// };

// // ── Single item row with autocomplete search ──────────────────────────────────
// function ItemRow({ item, index, onUpdate, onRemove, onEnterQty, isLast }) {
//   const [q,    setQ]    = useState(item.name || "");
//   const [open, setOpen] = useState(false);
//   const qtyRef          = useRef(null);

//   const filtered = q.trim().length > 0
//     ? ITEM_CATALOG.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12)
//     : [];

//   function pick(cat) {
//     setQ(cat.name);
//     setOpen(false);
//     onUpdate(index, { ...item, name: cat.name, rate: cat.rate, amount: Number(item.qty || 0) * cat.rate });
//     // focus qty field after picking
//     setTimeout(() => qtyRef.current?.focus(), 50);
//   }

//   function changeQty(v) {
//     const qty = Number(v) || 0;
//     onUpdate(index, { ...item, qty: v, amount: qty * (Number(item.rate) || 0) });
//   }

//   function changeRate(v) {
//     const r = Number(v) || 0;
//     onUpdate(index, { ...item, rate: v, amount: (Number(item.qty) || 0) * r });
//   }

//   function handleQtyKeyDown(e) {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       onEnterQty(index); // parent adds new row + focuses it
//     }
//   }

//   return (
//     <div style={{
//       display: "grid",
//       gridTemplateColumns: "1fr 70px 90px 100px 28px",
//       gap: 8, padding: "8px 12px",
//       borderBottom: `1px solid ${C.border}`,
//       alignItems: "center",
//       overflow: "visible",
//     }}>
//       {/* ── Item search ── */}
//       <div className="iswrap">
//         <input
//           className="inp"
//           style={{ padding: "7px 10px", fontSize: 12 }}
//           placeholder="Type 2-3 letters to search..."
//           value={q}
//           onChange={e => { setQ(e.target.value); setOpen(true); onUpdate(index, { ...item, name: e.target.value }); }}
//           onFocus={() => { if (q.trim().length > 0) setOpen(true); }}
//           onBlur={() => setTimeout(() => setOpen(false), 180)}
//         />
//         {open && filtered.length > 0 && (
//           <div className="idrop">
//             {filtered.map(c => (
//               <div key={c.id} className="iopt" onMouseDown={() => pick(c)}>
//                 <div className="iopt-name">{c.name}</div>
//                 <div className="iopt-rate">Rs. {c.rate} / box</div>
//               </div>
//             ))}
//           </div>
//         )}
//         {open && q.trim().length > 0 && filtered.length === 0 && (
//           <div className="idrop">
//             <div className="iopt"><span style={{ color: C.textLight, fontSize: 12 }}>No items found for "{q}"</span></div>
//           </div>
//         )}
//       </div>

//       {/* ── Qty ── */}
//       <input
//         ref={qtyRef}
//         className="inp"
//         style={{ padding: "7px 8px", fontSize: 12, textAlign: "center" }}
//         type="number" min="1" placeholder="Qty"
//         value={item.qty}
//         onChange={e => changeQty(e.target.value)}
//         onKeyDown={handleQtyKeyDown}
//       />

//       {/* ── Rate (auto-filled, editable) ── */}
//       <input
//         className="inp"
//         style={{ padding: "7px 8px", fontSize: 12, textAlign: "right" }}
//         type="number" placeholder="Rate"
//         value={item.rate}
//         onChange={e => changeRate(e.target.value)}
//       />

//       {/* ── Amount ── */}
//       <div style={{ fontWeight: 800, fontSize: 13, color: C.redDark, textAlign: "right", paddingRight: 4 }}>
//         Rs.{(item.amount || 0).toLocaleString()}
//       </div>

//       {/* ── Remove ── */}
//       <button
//         onClick={() => onRemove(index)}
//         style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight, lineHeight: 1 }}
//       >✕</button>
//     </div>
//   );
// }

// // ── CREATE BILL MODAL ─────────────────────────────────────────────────────────
// export function CreateBillModal({ agencies, onClose, preAgencyId, currentUser }) {
//   const [agencyId,    setAgencyId]    = useState(preAgencyId || "");
//   const [notes,       setNotes]       = useState("");
//   const [discountPct, setDiscountPct] = useState("");
//   const [items,       setItems]       = useState([{ name: "", qty: "", rate: "", amount: 0 }]);
//   const [loading,     setLoading]     = useState(false);
//   const [err,         setErr]         = useState("");
//   const [saved,       setSaved]       = useState(null);

//   // refs for auto-focusing new rows
//   const rowSearchRefs = useRef([]);

//   const upItem  = (i, v) => setItems(p => { const a = [...p]; a[i] = v; return a; });
//   const delRow  = i => { if (items.length > 1) setItems(p => p.filter((_, idx) => idx !== i)); };

//   function addRow(focusIndex) {
//     setItems(p => [...p, { name: "", qty: "", rate: "", amount: 0 }]);
//     // focus the new row's search input after render
//     setTimeout(() => {
//       const inputs = document.querySelectorAll(".item-search-inp");
//       if (inputs[focusIndex !== undefined ? focusIndex + 1 : inputs.length - 1]) {
//         inputs[focusIndex !== undefined ? focusIndex + 1 : inputs.length - 1].focus();
//       }
//     }, 60);
//   }

//   function handleEnterQty(rowIndex) {
//     // Enter on last row qty → add new row
//     if (rowIndex === items.length - 1) {
//       addRow(rowIndex);
//     } else {
//       // focus next row's search input
//       const inputs = document.querySelectorAll(".item-search-inp");
//       if (inputs[rowIndex + 1]) inputs[rowIndex + 1].focus();
//     }
//   }

//   const agency   = agencies.find(a => a.id === agencyId);
//   const prevBal  = Number(agency?.outstanding) || 0;
//   const subtotal = items.reduce((s, it) => s + (it.amount || 0), 0);
//   const discPct  = Number(discountPct) || 0;
//   const discAmt  = subtotal * discPct / 100;
//   const grand    = subtotal - discAmt + prevBal;

//   async function handleSave() {
//     if (!agencyId) return setErr("Please select an agency.");
//     const filled = items.filter(it => it.name.trim() && Number(it.qty) > 0);
//     if (filled.length === 0) return setErr("Add at least one item with quantity.");
//     if (subtotal === 0)      return setErr("Bill total cannot be Rs. 0.");
//     setLoading(true);

//     try {
//       const billNo = genInvNo();
//       const ref    = await addDoc(collection(db, "bills"), {
//         billNo,
//         agencyId,
//         agencyName:     agency?.name || "",
//         items:          filled,
//         subtotal,
//         discountPct:    discPct,
//         discountAmt:    discAmt,
//         prevBalance:    prevBal,
//         total:          grand,
//         status:         "pending",
//         notes,
//         createdByName:  currentUser?.name || "",
//         createdByUid:   currentUser?.uid  || "",
//         createdAt:      serverTimestamp(),
//         dueDate:        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
//       });

//       // Update agency outstanding to new grand total
//       await updateDoc(doc(db, "agencies", agencyId), { outstanding: grand });

//       setSaved({
//         bill: {
//           id: ref.id, billNo, agencyId, agencyName: agency?.name,
//           items: filled, subtotal, discountAmt: discAmt,
//           prevBalance: prevBal, total: grand, status: "pending", notes,
//           createdByName: currentUser?.name || "",
//         },
//         agency,
//       });
//     } catch (e) {
//       setErr("Failed to save bill. Please try again.");
//       setLoading(false);
//     }
//   }

//   // ── Success screen ────────────────────────────────────────────────────────
//   if (saved) return (
//     <Modal title="✅ Bill Created!" onClose={onClose}>
//       <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
//         <div style={{ fontSize: 56, marginBottom: 8 }}>🧾</div>
//         <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: C.redDark, marginBottom: 4 }}>{saved.bill.billNo}</div>
//         <div style={{ fontSize: 14, color: C.textLight, marginBottom: 6 }}>{saved.bill.agencyName}</div>
//         <div style={{ fontSize: 26, fontWeight: 800, color: C.red, marginBottom: 18 }}>Rs. {grand.toLocaleString()}</div>
//         <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#065f46" }}>
//           ✓ Saved to Firestore &nbsp;·&nbsp; Outstanding updated
//         </div>
//         <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
//           <button className="btn btn-red"   style={{ fontSize: 13, padding: "10px 20px" }} onClick={() => printInvoice(saved.bill, saved.agency)}>🖨️ Print / PDF</button>
//           <button className="btn btn-green" style={{ fontSize: 13, padding: "10px 20px" }} onClick={() => shareWhatsApp(saved.bill, saved.agency)}>💬 Send on WhatsApp</button>
//           <button className="btn btn-ghost" onClick={onClose}>Close</button>
//         </div>
//       </div>
//     </Modal>
//   );

//   // ── Bill form ─────────────────────────────────────────────────────────────
//   return (
//     <Modal title="🧾 Create New Bill" onClose={onClose} wide>
//       {/* Agency selector */}
//       <div style={{ marginBottom: 14 }}>
//         <Lbl>Select Agency *</Lbl>
//         <select className="sel" value={agencyId} onChange={e => { setAgencyId(e.target.value); setErr(""); }}>
//           <option value="">-- Choose Agency --</option>
//           {agencies.map(a => <option key={a.id} value={a.id}>{a.name} — {a.city}</option>)}
//         </select>
//       </div>

//       {/* Previous balance warning */}
//       {agencyId && prevBal > 0 && (
//         <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 10, padding: "10px 16px", marginBottom: 14, fontSize: 13, color: "#856404" }}>
//           ⚠️ <b>{agency?.name}</b> has a pending balance of <b>Rs. {prevBal.toLocaleString()}</b> — it will be added to this bill's grand total.
//         </div>
//       )}

//       {/* Items list */}
//       <div style={{ marginBottom: 14 }}>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
//           <Lbl>Items — Search &amp; select (press Enter after Qty to add next item)</Lbl>
//           <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 12px" }} onClick={() => addRow(items.length - 1)}>+ Add Row</button>
//         </div>
//         <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "visible" }}>
//           {/* Header */}
//           <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 100px 28px", gap: 8, padding: "8px 12px", background: "#fef0f0", borderBottom: `1px solid ${C.border}`, borderRadius: "12px 12px 0 0" }}>
//             {["Product Name (type to search)", "Qty", "Rate (Rs.)", "Amount", ""].map((h, i) => (
//               <div key={i} style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>{h}</div>
//             ))}
//           </div>
//           {/* Rows */}
//           {items.map((it, i) => (
//             <ItemRow
//               key={i}
//               item={it}
//               index={i}
//               onUpdate={upItem}
//               onRemove={delRow}
//               onEnterQty={handleEnterQty}
//               isLast={i === items.length - 1}
//             />
//           ))}
//         </div>
//       </div>

//       {/* Discount + Notes */}
//       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
//         <div>
//           <Lbl>Discount %</Lbl>
//           <input className="inp" type="number" min="0" max="100" step="0.01"
//             placeholder="e.g. 14" value={discountPct} onChange={e => setDiscountPct(e.target.value)} />
//         </div>
//         <div>
//           <Lbl>Notes (optional)</Lbl>
//           <input className="inp" placeholder="Festival stock, special order..."
//             value={notes} onChange={e => setNotes(e.target.value)} />
//         </div>
//       </div>

//       {/* Summary box */}
//       <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14 }}>
//         <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}` }}>
//           <span style={{ color: C.textLight }}>Sub Total</span>
//           <span style={{ fontWeight: 700 }}>Rs. {subtotal.toLocaleString()}</span>
//         </div>
//         <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}`, color: C.red }}>
//           <span>Discount ({discPct}%)</span>
//           <span style={{ fontWeight: 700 }}>- Rs. {discAmt.toFixed(2)}</span>
//         </div>
//         {prevBal > 0 && (
//           <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}`, color: "#d97706" }}>
//             <span>Previous Pending Balance</span>
//             <span style={{ fontWeight: 700 }}>+ Rs. {prevBal.toLocaleString()}</span>
//           </div>
//         )}
//         <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 4, borderTop: `2px solid ${C.border}` }}>
//           <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 800, color: C.text }}>Grand Total</span>
//           <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800, color: C.red }}>Rs. {grand.toLocaleString()}</span>
//         </div>
//         <div style={{ fontSize: 11, color: C.textLight, marginTop: 6, fontStyle: "italic" }}>{toWords(grand)}</div>
//       </div>

//       {err && <div className="err-box">⚠️ {err}</div>}

//       <div style={{ display: "flex", gap: 10 }}>
//         <button className="btn btn-red" style={{ flex: 1, padding: 12 }} onClick={handleSave} disabled={loading}>
//           {loading ? <><Spin /> Saving...</> : "💾 Create Bill"}
//         </button>
//         <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
//       </div>
//     </Modal>
//   );
// }


// src/components/BillModal.js
import { useState, useRef, useEffect } from "react";
import { collection, doc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { ITEM_CATALOG } from "../constants";
import { genInvNo, toWords, printInvoice, shareWhatsApp } from "../helpers";
import { Lbl, Modal, Spin } from "./UI";

const C = {
  red: "#c8181e", redDark: "#9e1015", yellow: "#f5c518",
  text: "#1a0505", textLight: "#a07070", textMid: "#6b3333", border: "#f0dada",
};



// ── CREATE BILL MODAL ─────────────────────────────────────────────────────────
// Flow: search always on top → pick → qty → Enter → item locks below → search resets
export function CreateBillModal({ agencies, onClose, preAgencyId, currentUser }) {
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

  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 120); }, []);

  const dropRef = useRef(null);

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
      setDropIndex(i => {
        const next = Math.min(i + 1, filtered.length - 1);
        setTimeout(() => scrollDropToIndex(next), 10);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDropIndex(i => {
        const next = Math.max(i - 1, 0);
        setTimeout(() => scrollDropToIndex(next), 10);
        return next;
      });
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
  const prevBal  = Number(agency?.outstanding) || 0;
  const subtotal = lockedItems.reduce((s, it) => s + (it.amount || 0), 0);
  const discPct  = Number(discountPct) || 0;
  const discAmt  = subtotal * discPct / 100;
  const grand    = subtotal - discAmt + prevBal;

  async function handleSave() {
    if (!agencyId)                return setErr("Please select an agency.");
    if (lockedItems.length === 0) return setErr("Add at least one item.");
    if (subtotal === 0)           return setErr("Bill total cannot be Rs. 0.");
    setLoading(true);
    try {
      const billNo = genInvNo();
      const ref = await addDoc(collection(db, "bills"), {
        billNo, agencyId, agencyName: agency?.name || "",
        items: lockedItems, subtotal,
        discountPct: discPct, discountAmt: discAmt,
        prevBalance: prevBal, total: grand,
        status: "pending", notes,
        createdByName: currentUser?.name || "",
        createdByUid:  currentUser?.uid  || "",
        createdAt: serverTimestamp(),
        dueDate:   new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      });
      await updateDoc(doc(db, "agencies", agencyId), { outstanding: grand });
      setSaved({
        bill: { id: ref.id, billNo, agencyId, agencyName: agency?.name, items: lockedItems, subtotal, discountAmt: discAmt, prevBalance: prevBal, total: grand, status: "pending", notes, createdByName: currentUser?.name || "" },
        agency,
      });
    } catch (e) { setErr("Failed to save bill. Please try again."); setLoading(false); }
  }

  if (saved) return (
    <Modal title="✅ Bill Created!" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🧾</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: C.redDark, marginBottom: 4 }}>{saved.bill.billNo}</div>
        <div style={{ fontSize: 14, color: C.textLight, marginBottom: 6 }}>{saved.bill.agencyName}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.red, marginBottom: 18 }}>Rs. {grand.toLocaleString()}</div>
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#065f46" }}>✓ Saved · Outstanding updated</div>
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

      {agencyId && prevBal > 0 && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 10, padding: "10px 16px", marginBottom: 14, fontSize: 13, color: "#856404" }}>
          ⚠️ <b>{agency?.name}</b> has a pending balance of <b>Rs. {prevBal.toLocaleString()}</b> — will be added to grand total.
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

          {/* Active search row — always visible at bottom */}
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

      {/* Summary */}
      <div style={{ background: "#fff8f8", borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}` }}><span style={{ color: C.textLight }}>Sub Total</span><span style={{ fontWeight: 700 }}>Rs. {subtotal.toLocaleString()}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}`, color: C.red }}><span>Discount ({discPct}%)</span><span style={{ fontWeight: 700 }}>- Rs. {discAmt.toFixed(2)}</span></div>
        {prevBal > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: `1px dashed ${C.border}`, color: "#d97706" }}><span>Previous Pending Balance</span><span style={{ fontWeight: 700 }}>+ Rs. {prevBal.toLocaleString()}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 4, borderTop: `2px solid ${C.border}` }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 800, color: C.text }}>Grand Total</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800, color: C.red }}>Rs. {grand.toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 11, color: C.textLight, marginTop: 6, fontStyle: "italic" }}>{toWords(grand)}</div>
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