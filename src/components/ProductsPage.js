// src/components/ProductsPage.js
import { useState } from "react";
import api from "../api";
import { C } from "../constants";
import { Lbl, Modal, Spin, PageHeader } from "./UI";

const DEFAULT_DISCOUNT = 14;

function ProductModal({ existing, onClose, onRefresh }) {
  const [name,        setName]        = useState(existing?.name        || "");
  const [rate,        setRate]        = useState(existing?.rate        != null ? String(existing.rate)    : "");
  const [rateGst,     setRateGst]     = useState(existing?.rateGst     != null ? String(existing.rateGst) : "");
  const [discount,    setDiscount]    = useState(existing?.discount    != null ? String(existing.discount) : String(DEFAULT_DISCOUNT));
  const [unitsPerBox, setUnitsPerBox] = useState(existing?.unitsPerBox != null ? String(existing.unitsPerBox) : "0");
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState("");

  async function handleSave() {
    if (!name.trim())               return setErr("Product name is required.");
    if (!rate || Number(rate) <= 0) return setErr("Enter a valid Non-GST rate.");
    const rateGstVal = rateGst !== "" ? Number(rateGst) : Number(rate);
    if (isNaN(rateGstVal) || rateGstVal < 0) return setErr("Enter a valid GST rate.");
    const discVal = Number(discount);
    if (isNaN(discVal) || discVal < 0 || discVal > 100) return setErr("Discount must be 0–100.");
    setLoading(true); setErr("");
    try {
      const payload = {
        name:        name.trim(),
        rate:        Number(rate),
        rateGst:     rateGstVal,
        discount:    discVal,
        unitsPerBox: Number(unitsPerBox) || 0,
      };
      if (existing) {
        await api.put(`/products/${existing._id || existing.id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      onRefresh();
      onClose();
    } catch (e) { setErr(e.message || "Failed to save. Try again."); setLoading(false); }
  }

  return (
    <Modal title={existing ? "✏️ Edit Product" : "➕ Add New Product"} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Lbl>Product Name *</Lbl>
        <input className="inp" placeholder="e.g. 05.MINI CHOCOBAR [1*30]"
          value={name} onChange={e => { setName(e.target.value); setErr(""); }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <Lbl>Non-GST Rate (Rs./box) *</Lbl>
          <input className="inp" type="number" min="0" placeholder="e.g. 127"
            value={rate} onChange={e => { setRate(e.target.value); setErr(""); }} />
        </div>
        <div>
          <Lbl>GST Rate (Rs./box) *</Lbl>
          <input className="inp" type="number" min="0" placeholder="Same as non-GST by default"
            value={rateGst} onChange={e => { setRateGst(e.target.value); setErr(""); }} />
        </div>
        <div>
          <Lbl>Discount % (default 14)</Lbl>
          <input className="inp" type="number" min="0" max="100" step="0.01" placeholder="14"
            value={discount} onChange={e => { setDiscount(e.target.value); setErr(""); }} />
        </div>
        <div>
          <Lbl>Units Per Box</Lbl>
          <input className="inp" type="number" min="0" placeholder="e.g. 30"
            value={unitsPerBox} onChange={e => { setUnitsPerBox(e.target.value); setErr(""); }} />
        </div>
      </div>
      {err && <div className="err-box">⚠️ {err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button className="btn btn-red" style={{ flex: 1 }} onClick={handleSave} disabled={loading}>
          {loading ? <><Spin /> Saving...</> : existing ? "💾 Update Product" : "➕ Add Product"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ product, onConfirm, onCancel, loading }) {
  return (
    <div className="mo" onClick={e => { if (e.target.className === "mo") onCancel(); }}>
      <div className="mbox su" style={{ width: 400, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: C.redDark, fontWeight: 800, marginBottom: 8 }}>Delete Product?</div>
        <div style={{ background: "#fff0f0", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", marginBottom: 6, fontSize: 13, fontWeight: 700, color: C.text }}>{product.name}</div>
        <div style={{ fontSize: 12, color: C.textLight, marginBottom: 20 }}>
          Non-GST: Rs. {(product.rate || 0).toLocaleString()} &nbsp;·&nbsp; GST: Rs. {(product.rateGst || product.rate || 0).toLocaleString()} &nbsp;·&nbsp; Disc: {product.discount ?? DEFAULT_DISCOUNT}% &nbsp;·&nbsp; This cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-red" style={{ flex: 1, background: "#dc2626" }} onClick={onConfirm} disabled={loading}>
            {loading ? <><Spin /> Deleting...</> : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductsPage({ products, onRefresh }) {
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [delLoading,   setDelLoading]   = useState(false);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || String(p.rate).includes(search)
  );

  async function doDelete() {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await api.delete(`/products/${deleteTarget._id || deleteTarget.id}`);
      setDeleteTarget(null);
      onRefresh();
    }
    catch (e) { alert("Failed to delete. Please try again."); }
    setDelLoading(false);
  }

  return (
    <div className="fi">
      {modal === "add"          && <ProductModal existing={null}  onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal && modal !== "add" && <ProductModal existing={modal} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {deleteTarget && <DeleteConfirmModal product={deleteTarget} onConfirm={doDelete} onCancel={() => setDeleteTarget(null)} loading={delLoading} />}

      <div className="page-header-sticky">
        <PageHeader
          title="Product Master 📦"
          sub={`${products.length} products · Non-GST & GST rates for billing`}
          action={<button className="btn btn-red" onClick={() => setModal("add")}>+ Add Product</button>}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="inp" placeholder="🔍 Search by name or rate..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 380 }} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        {[
          { label: "Total Products", value: products.length, bg: "#fff0f0", color: C.redDark },
          { label: "Showing",        value: filtered.length, bg: "#eff6ff", color: "#1e40af" },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 120 }}>
            <div style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">📦</div>
          <p>{search ? `No products matching "${search}"` : "No products yet."}</p>
          {!search && <button className="btn btn-red" style={{ marginTop: 10 }} onClick={() => setModal("add")}>+ Add First Product</button>}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {/* Desktop header */}
          <div className="mobile-product-hide" style={{ display: "grid", gridTemplateColumns: "40px 1fr 100px 100px 70px 80px 80px", gap: 8, padding: "10px 16px", background: "#fff8f8", borderRadius: "14px 14px 0 0", borderBottom: `1px solid ${C.border}` }}>
            {["#", "Product Name", "Non-GST Rate", "GST Rate", "Disc %", "Units/Box", "Actions"].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>
          {filtered.map((p, i) => (
            <div key={p._id || p.id} className="tr mobile-product-row"
              style={{ display: "grid", gridTemplateColumns: "40px 1fr 100px 100px 70px 80px 80px", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 11, color: C.textLight, fontWeight: 700 }}>{i + 1}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.redDark }}>Rs. {(p.rate || 0).toLocaleString()}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>Rs. {(p.rateGst || p.rate || 0).toLocaleString()}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#d97706" }}>{p.discount ?? DEFAULT_DISCOUNT}%</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textLight }}>{p.unitsPerBox || "—"}</div>
              <div className="mobile-product-actions" style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost"  style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => setModal(p)}>✏️</button>
                <button className="btn btn-danger" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => setDeleteTarget(p)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
