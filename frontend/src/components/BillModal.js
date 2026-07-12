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

export function CreateBillModal({ agencies, onClose, onSaved, preAgencyId, currentUser, bills = [], payments = [], products = [], appSettings }) {
  const [agencyId,   setAgencyId]   = useState(preAgencyId || "");
  const [notes,      setNotes]      = useState("");
  const [lockedItems,setLockedItems]= useState([]);
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState("");
  const [saved,      setSaved]      = useState(null);

  // ── Bill type: "gst" = VMP series (TAX INVOICE), "nongst" = GB series (INVOICE)
  const [billType, setBillType] = useState("nongst");

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
    if (lockedItems.length === 0) return setErr("Add at least one item.");
    if (billAmt === 0)            return setErr("Bill total cannot be Rs. 0.");
    setLoading(true);
    setErr("");
    try {
      const payload = {
        agencyId,
        billType,
        items: lockedItems,
        discountAmt: totalDiscAmt,
        notes
      };

      const res = await api.post("/bills", payload);
      if (res.success && res.data && res.data.bill) {
        setSaved({
          bill: res.data.bill,
          agency,
        });
        if (onSaved) onSaved();
      } else {
        setErr(res.message || "Failed to save bill.");
      }
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to save bill. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (saved) return (
    <Modal title="✅ Bill Created!" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🧾</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: C.redDark, marginBottom: 4 }}>{saved.bill.billNo}</div>
        <div style={{ fontSize: 14, color: C.textLight, marginBottom: 4 }}>{saved.bill.agencyName}</div>
        {/* Bill type badge */}
        <div style={{ marginBottom: 12 }}>
          {saved.bill.billType === "gst"
            ? <span style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: 20, fontSize: 11, fontWeight: 800, padding: "3px 12px" }}>✓ GST Invoice (TAX INVOICE)</span>
            : <span style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 20, fontSize: 11, fontWeight: 800, padding: "3px 12px" }}>📄 Non-GST Invoice (INVOICE)</span>
          }
        </div>
        <div style={{ background: "#fff8f8", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 18px", marginBottom: 16, textAlign: "left" }}>
          {saved.bill.discountAmt > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", color: "#065f46" }}>
              <span>Discount Saved</span><span style={{ fontWeight: 700 }}>- Rs. {saved.bill.discountAmt.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
            <span style={{ color: C.textLight }}>Current Bill</span><span style={{ fontWeight: 700 }}>Rs. {billAmt.toLocaleString()}</span>
          </div>
          {saved.bill.prevBalance > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: C.red }}>
              <span>Previous Pending Balance</span><span style={{ fontWeight: 700 }}>+ Rs. {saved.bill.prevBalance.toLocaleString()}</span>
            </div>
          )}
          {saved.bill.advanceUsed > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: "#065f46" }}>
              <span>Advance Credit Used</span><span style={{ fontWeight: 700 }}>- Rs. {saved.bill.advanceUsed.toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, padding: "8px 0 0", marginTop: 4, borderTop: `2px solid ${C.border}` }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: C.text }}>Total Due</span>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: C.red }}>Rs. {grandTotal.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#065f46" }}>✓ Saved to Database</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <PrintBillButton bill={saved.bill} label="Print / Save PDF" style={{ fontSize: 13, padding: "10px 20px" }} />
          <button className="btn btn-green" style={{ fontSize: 13, padding: "10px 20px" }} onClick={() => shareWhatsApp(saved.bill, saved.agency, appSettings)}>💬 WhatsApp</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );

  // Column layout
  const COLS = "1fr 60px 80px 55px 95px 28px";

  return (
    <Modal title="🧾 Create New Bill" onClose={onClose} wide>

      {/* ── Bill Type Toggle — GST / Non-GST ── */}
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

      {/* Agency selector */}
      <div style={{ marginBottom: 14 }}>
        <Lbl>Select Agency *</Lbl>
        <select className="sel" value={agencyId} onChange={e => { setAgencyId(e.target.value); setErr(""); }}>
          <option value="">-- Choose Agency --</option>
          {agencies.map(a => <option key={a.id} value={a.id}>{a.name} — {a.city}</option>)}
        </select>
      </div>

      {/* Balance alerts */}
      {agencyId && prevBal > 0 && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderLeft: "4px solid #ffc107", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          ⚠️ This agency has <strong>Rs. {prevBal.toLocaleString()}</strong> pending — it will be added to this bill's total.
        </div>
      )}
      {agencyId && rawBal < 0 && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderLeft: "4px solid #10b981", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#065f46" }}>
          This agency has <strong>Rs. {advanceUsed.toLocaleString()}</strong> advance credit — it will be deducted from this bill's total.
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

      {/* Totals breakdown */}
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
          {loading ? <><Spin /> Generating bill number...</> : `💾 Create Bill${lockedItems.length > 0 ? ` (${lockedItems.length} items)` : ""}`}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}