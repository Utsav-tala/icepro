// src/components/ProductsPage.js
import { useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { C } from "../constants";
import { Lbl, Modal, Spin, PageHeader } from "./UI";

// ── Add / Edit Product Modal ──────────────────────────────────────────────────
function ProductModal({ existing, onClose }) {
  const [name,    setName]    = useState(existing?.name    || "");
  const [rate,    setRate]    = useState(existing?.rate    ? String(existing.rate) : "");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  async function handleSave() {
    if (!name.trim())               return setErr("Product name is required.");
    if (!rate || Number(rate) <= 0) return setErr("Enter a valid rate.");
    setLoading(true); setErr("");
    try {
      if (existing) {
        await updateDoc(doc(db, "products", existing.id), {
          name:      name.trim(),
          rate:      Number(rate),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "products"), {
          name:      name.trim(),
          rate:      Number(rate),
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (e) { setErr("Failed to save. Try again."); setLoading(false); }
  }

  return (
    <Modal title={existing ? "✏️ Edit Product" : "➕ Add New Product"} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Lbl>Product Name *</Lbl>
        <input className="inp" placeholder="e.g. 05.MINI CHOCOBAR [1*30]"
          value={name} onChange={e => { setName(e.target.value); setErr(""); }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <Lbl>Rate (Rs. per box) *</Lbl>
        <input className="inp" type="number" min="1" placeholder="e.g. 127"
          value={rate} onChange={e => { setRate(e.target.value); setErr(""); }} />
      </div>
      {err && <div className="err-box">⚠️ {err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-red" style={{ flex: 1 }} onClick={handleSave} disabled={loading}>
          {loading ? <><Spin /> Saving...</> : existing ? "💾 Update Product" : "➕ Add Product"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ── Inline Delete Confirmation Modal ─────────────────────────────────────────
// Replaces window.confirm which can be blocked by browsers.
function DeleteConfirmModal({ product, onConfirm, onCancel, loading }) {
  return (
    <div className="mo" onClick={e => { if (e.target.className === "mo") onCancel(); }}>
      <div className="mbox su" style={{ width: 400, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: C.redDark, fontWeight: 800, marginBottom: 8 }}>
          Delete Product?
        </div>
        <div style={{ background: "#fff0f0", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", marginBottom: 6, fontSize: 13, fontWeight: 700, color: C.text }}>
          {product.name}
        </div>
        <div style={{ fontSize: 12, color: C.textLight, marginBottom: 20 }}>
          Rate: Rs. {(product.rate || 0).toLocaleString()} &nbsp;·&nbsp; This cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, fontSize: 13 }}
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-red"
            style={{ flex: 1, fontSize: 13, background: "#dc2626" }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <><Spin /> Deleting...</> : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Products Page ─────────────────────────────────────────────────────────────
// All users (staff + owner) can add, edit, delete products.
export function ProductsPage({ products }) {
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState(null);    // null | "add" | product-object
  const [deleteTarget, setDeleteTarget] = useState(null);    // product to delete
  const [delLoading,   setDelLoading]   = useState(false);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    String(p.rate).includes(search)
  );

  async function doDelete() {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await deleteDoc(doc(db, "products", deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      alert("Failed to delete. Please try again.");
    }
    setDelLoading(false);
  }

  return (
    <div className="fi">
      {/* Add / Edit modal */}
      {modal === "add"          && <ProductModal existing={null}  onClose={() => setModal(null)} />}
      {modal && modal !== "add" && <ProductModal existing={modal} onClose={() => setModal(null)} />}

      {/* Inline delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          product={deleteTarget}
          onConfirm={doDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={delLoading}
        />
      )}

      <PageHeader
        title="Product Master 📦"
        sub={`${products.length} products · rates used in billing`}
        action={
          <button className="btn btn-red" onClick={() => setModal("add")}>
            + Add Product
          </button>
        }
      />

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="inp"
          placeholder="🔍 Search by name or rate..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 380 }}
        />
      </div>

      {/* Stats */}
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
          {!search && (
            <button className="btn btn-red" style={{ marginTop: 10 }} onClick={() => setModal("add")}>
              + Add First Product
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr 120px 80px 90px",
            gap: 8, padding: "10px 16px",
            background: "#fff8f8",
            borderRadius: "14px 14px 0 0",
            borderBottom: `1px solid ${C.border}`,
          }}>
            {["#", "Product Name", "Rate (Rs.)", "Edit", "Delete"].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>

          {/* Product rows */}
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className="tr"
              style={{ display: "grid", gridTemplateColumns: "40px 1fr 120px 80px 90px", gap: 8, alignItems: "center" }}
            >
              <div style={{ fontSize: 11, color: C.textLight, fontWeight: 700 }}>{i + 1}</div>

              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>

              <div style={{ fontSize: 14, fontWeight: 800, color: C.redDark }}>
                Rs. {(p.rate || 0).toLocaleString()}
              </div>

              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: "4px 8px" }}
                onClick={() => setModal(p)}
              >
                ✏️ Edit
              </button>

              <button
                className="btn btn-danger"
                style={{ fontSize: 11, padding: "4px 8px" }}
                onClick={() => setDeleteTarget(p)}
              >
                🗑️ Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}