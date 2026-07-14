// src/components/ProfilePage.js
// The signed-in user's own account: edit their name and mobile, and change their password.
//
// Username and email are shown but LOCKED, and that is deliberate:
//   username — an identity handle colleagues already know you by; changing it silently
//              rewrites history from everyone else's point of view.
//   email    — the account's proof of ownership and the password-reset destination.
//              Changing it safely means re-verifying the new address, which is its own flow.
// The page says why, rather than just greying the fields out and leaving people guessing.

import { useState } from "react";
import api from "../api";
import { C } from "../constants";
import { PageHeader, Lbl, Spin } from "./UI";

const PASSWORD_HINT = "At least 8 characters, with a letter and a number";

function passwordProblem(password) {
  if (!password || password.length < 8)                   return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Password must contain at least one letter and one number.";
  return "";
}

// A field the user cannot change, shown with the reason. Better than a disabled input
// with no explanation.
function LockedRow({ label, value, why }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Lbl>{label}</Lbl>
      <div style={{
        background: "#f7f4f4", border: `1px solid ${C.border}`, borderRadius: 10,
        padding: "10px 14px", fontSize: 13, color: C.textMid, fontWeight: 600,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
      }}>
        <span>{value || "—"}</span>
        <span style={{ fontSize: 15 }} title={why}>🔒</span>
      </div>
      <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>{why}</div>
    </div>
  );
}

export function ProfilePage({ user, onUserUpdate }) {
  // ── Profile details ────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName,  setLastName]  = useState(user?.lastName  || "");
  const [mobile,    setMobile]    = useState(user?.mobile    || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState({ text: "", type: "" });

  // ── Password ───────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirm,         setConfirm]         = useState("");
  const [showPass,        setShowPass]        = useState(false);
  const [savingPass,      setSavingPass]      = useState(false);
  const [passMsg,         setPassMsg]         = useState({ text: "", type: "" });

  // A Google account has never had a password. It is ADDING one, not changing one, so
  // there is no "current password" to ask for — the user is already authenticated.
  const isGoogleOnly = user?.authProvider === "google";

  const profileDirty =
    firstName !== (user?.firstName || "") ||
    lastName  !== (user?.lastName  || "") ||
    mobile    !== (user?.mobile    || "");

  async function saveProfile() {
    if (!firstName.trim())            return setProfileMsg({ text: "First name is required.", type: "err" });
    if (!/^\d{10}$/.test(mobile.trim())) return setProfileMsg({ text: "Mobile number must be exactly 10 digits.", type: "err" });

    setSavingProfile(true); setProfileMsg({ text: "", type: "" });
    try {
      const res = await api.patch("/users/me", {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        mobile:    mobile.trim(),
      });
      if (res.success) {
        const u = res.data.user;
        // Push the new name up so the sidebar and greeting update immediately, rather
        // than showing the old one until the next full reload.
        onUserUpdate?.({
          firstName: u.firstName,
          lastName:  u.lastName,
          mobile:    u.mobile,
          name:      `${u.firstName} ${u.lastName || ""}`.trim(),
        });
        setProfileMsg({ text: "Profile updated.", type: "ok" });
        setTimeout(() => setProfileMsg({ text: "", type: "" }), 3000);
      }
    } catch (e) {
      setProfileMsg({ text: e.errors?.[0]?.message || e.message || "Could not save.", type: "err" });
    }
    setSavingProfile(false);
  }

  async function savePassword() {
    const problem = passwordProblem(newPassword);
    if (problem)                                 return setPassMsg({ text: problem, type: "err" });
    if (newPassword !== confirm)                 return setPassMsg({ text: "The two passwords don't match.", type: "err" });
    if (!isGoogleOnly && !currentPassword)       return setPassMsg({ text: "Enter your current password.", type: "err" });

    setSavingPass(true); setPassMsg({ text: "", type: "" });
    try {
      const res = await api.post("/users/me/password", {
        ...(isGoogleOnly ? {} : { currentPassword }),
        newPassword,
      });
      if (res.success) {
        // The server revoked every session and issued this device a new one. Store the
        // fresh access token or the very next request would 401.
        if (res.data?.token) localStorage.setItem("token", res.data.token);
        if (isGoogleOnly) onUserUpdate?.({ authProvider: "local" });

        setCurrentPassword(""); setNewPassword(""); setConfirm("");
        setPassMsg({ text: res.message || "Password updated.", type: "ok" });
      }
    } catch (e) {
      setPassMsg({ text: e.errors?.[0]?.message || e.message || "Could not change password.", type: "err" });
    }
    setSavingPass(false);
  }

  const eye = (shown, toggle) => (
    <button onClick={toggle}
      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textLight }}>
      {shown ? "🙈" : "👁️"}
    </button>
  );

  return (
    <div className="fi">
      <PageHeader
        title="My Profile 👤"
        sub={`${user?.email || ""} · ${user?.role === "owner" ? "Owner" : "Manager"}`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, maxWidth: 640 }}>

        {/* ── Account details ───────────────────────────────────────────── */}
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>Your Details</div>
          <div style={{ fontSize: 13, color: C.textLight, marginBottom: 18 }}>
            Your name appears on every bill you create.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <Lbl>First Name *</Lbl>
              <input className="inp" value={firstName} placeholder="First name"
                onChange={e => { setFirstName(e.target.value); setProfileMsg({ text: "", type: "" }); }} />
            </div>
            <div>
              <Lbl>Last Name</Lbl>
              <input className="inp" value={lastName} placeholder="Last name"
                onChange={e => { setLastName(e.target.value); setProfileMsg({ text: "", type: "" }); }} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Lbl>Mobile Number *</Lbl>
            <input className="inp" type="tel" value={mobile} placeholder="10-digit mobile number"
              onChange={e => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setProfileMsg({ text: "", type: "" }); }} />
            {mobile && mobile.length !== 10 && (
              <div style={{ color: C.red, fontSize: 11, marginTop: 4, fontWeight: 600 }}>Must be exactly 10 digits</div>
            )}
          </div>

          <LockedRow label="Username" value={user?.username}
            why="Your username is permanent — colleagues already know you by it." />
          <LockedRow label="Email Address" value={user?.email}
            why="Your email proves the account is yours and is where password resets are sent." />

          {profileMsg.text && (
            <div className={profileMsg.type === "err" ? "err-box" : "ok-box"} style={{ marginBottom: 12 }}>
              {profileMsg.type === "err" ? "⚠️" : "✅"} {profileMsg.text}
            </div>
          )}

          <button className="btn btn-red" style={{ padding: "10px 22px" }}
            onClick={saveProfile} disabled={savingProfile || !profileDirty}>
            {savingProfile ? <><Spin /> Saving...</> : "💾 Save Changes"}
          </button>
        </div>

        {/* ── Password ──────────────────────────────────────────────────── */}
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>
            {isGoogleOnly ? "🔑 Add a Password" : "🔑 Change Password"}
          </div>
          <div style={{ fontSize: 13, color: C.textLight, marginBottom: 16 }}>
            {isGoogleOnly
              ? "You sign in with Google. Adding a password lets you sign in with your email as well — Google will keep working."
              : "Changing your password signs you out on every other device. You'll stay signed in here."}
          </div>

          {!isGoogleOnly && (
            <div style={{ marginBottom: 14 }}>
              <Lbl>Current Password *</Lbl>
              <div style={{ position: "relative" }}>
                <input className="inp" type={showPass ? "text" : "password"} placeholder="Your current password"
                  value={currentPassword} style={{ paddingRight: 44 }}
                  onChange={e => { setCurrentPassword(e.target.value); setPassMsg({ text: "", type: "" }); }} />
                {eye(showPass, () => setShowPass(s => !s))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <Lbl>New Password *</Lbl>
            <div style={{ position: "relative" }}>
              <input className="inp" type={showPass ? "text" : "password"} placeholder={PASSWORD_HINT}
                value={newPassword} style={{ paddingRight: 44 }}
                onChange={e => { setNewPassword(e.target.value); setPassMsg({ text: "", type: "" }); }} />
              {isGoogleOnly && eye(showPass, () => setShowPass(s => !s))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Lbl>Confirm New Password *</Lbl>
            <input className="inp" type={showPass ? "text" : "password"} placeholder="Repeat the new password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setPassMsg({ text: "", type: "" }); }}
              onKeyDown={e => e.key === "Enter" && savePassword()} />
          </div>

          {passMsg.text && (
            <div className={passMsg.type === "err" ? "err-box" : "ok-box"} style={{ marginBottom: 12 }}>
              {passMsg.type === "err" ? "⚠️" : "✅"} {passMsg.text}
            </div>
          )}

          <button className="btn btn-red" style={{ padding: "10px 22px" }}
            onClick={savePassword} disabled={savingPass}>
            {savingPass
              ? <><Spin /> Saving...</>
              : isGoogleOnly ? "🔑 Set Password" : "🔑 Change Password"}
          </button>
        </div>

      </div>
    </div>
  );
}
