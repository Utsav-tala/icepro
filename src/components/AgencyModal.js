// src/components/AgencyModal.js
import { useState } from "react";
import { collection, doc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Lbl, Modal, Spin } from "./UI";

export function AgencyModal({ onClose, onSaved, existing }) {
  const isEdit = !!existing;
  const blank  = { name:"", owner:"", phone:"", city:"", email:"", creditLimit:"", address:"", gst:"", totalShops:"" };

  const [form, setForm]       = useState(isEdit ? {
    name:        existing.name        || "",
    owner:       existing.owner       || "",
    phone:       existing.phone       || "",
    city:        existing.city        || "",
    email:       existing.email       || "",
    creditLimit: existing.creditLimit || "",
    address:     existing.address     || "",
    gst:         existing.gst         || "",
    totalShops:  existing.totalShops  || "",
  } : blank);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const upd = (f, v) => { setForm(p => ({ ...p, [f]: v })); setErr(""); };

  async function save() {
    if (!form.name.trim())  return setErr("Agency name is required.");
    if (!form.owner.trim()) return setErr("Owner name is required.");
    if (!form.phone.trim()) return setErr("Phone number is required.");
    if (!form.city.trim())  return setErr("City is required.");
    setLoading(true);

    const data = {
      name:        form.name.trim(),
      owner:       form.owner.trim(),
      phone:       form.phone.trim(),
      city:        form.city.trim(),
      email:       form.email.trim(),
      creditLimit: Number(form.creditLimit) || 100000,
      address:     form.address.trim(),
      gst:         form.gst.trim(),
      totalShops:  Number(form.totalShops) || 0,
    };

    try {
      if (isEdit) {
        await updateDoc(doc(db, "agencies", existing.id), { ...data, updatedAt: serverTimestamp() });
        onSaved({ ...existing, ...data });
      } else {
        const ref = await addDoc(collection(db, "agencies"), {
          ...data, outstanding: 0, status: "active", createdAt: serverTimestamp(),
        });
        onSaved({ id: ref.id, ...data, outstanding: 0, status: "active" });
      }
      onClose();
    } catch (e) {
      setErr("Failed to save. Please try again.");
      setLoading(false);
    }
  }

  const F = (label, field, type = "text", ph = "", half = false) => (
    <div style={half ? {} : { gridColumn: "1 / -1" }}>
      <Lbl>{label}</Lbl>
      <input className="inp" type={type} placeholder={ph}
        value={form[field]} onChange={e => upd(field, e.target.value)} />
    </div>
  );

  return (
    <Modal title={isEdit ? `✏️ Edit — ${existing.name}` : "➕ Add New Agency"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>{F("Agency / Shop Name *", "name", "text", "Rajkot Central Agency")}</div>
        {F("Owner Name *",      "owner",       "text",   "Mahesh Patel",        true)}
        {F("Phone *",           "phone",       "tel",    "9825011234",          true)}
        {F("City *",            "city",        "text",   "Rajkot",              true)}
        {F("Email",             "email",       "email",  "agency@email.com",    true)}
        {F("Credit Limit (Rs.)","creditLimit", "number", "100000",              true)}
        {F("Total Shops",       "totalShops",  "number", "5",                   true)}
        {F("GST Number",        "gst",         "text",   "24XXXXX0000X1Z5",     true)}
        <div style={{ gridColumn: "1 / -1" }}>
          <Lbl>Full Address</Lbl>
          <textarea className="inp" rows={2} placeholder="Shop/warehouse address..."
            value={form.address} onChange={e => upd("address", e.target.value)}
            style={{ resize: "vertical" }} />
        </div>
      </div>

      {err && <div className="err-box" style={{ marginTop: 14 }}>⚠️ {err}</div>}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn btn-red" style={{ flex: 1 }} onClick={save} disabled={loading}>
          {loading ? <><Spin /> Saving...</> : isEdit ? "💾 Save Changes" : "💾 Add Agency"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
