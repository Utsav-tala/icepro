// src/App.js
// Root — only handles auth state and routes between screens
import { useState, useEffect } from "react";
import { onAuthStateChanged }   from "firebase/auth";
import { doc, getDoc }          from "firebase/firestore";
import { auth, db }             from "./firebase";
import { CSS }                  from "./constants";
import { Logo, Spin }           from "./components/UI";
import { SigninScreen, SignupScreen } from "./components/Auth";
import { Dashboard }            from "./components/Dashboard";

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [user,   setUser]   = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fu => {
      if (fu) {
        try {
          const snap = await getDoc(doc(db, "users", fu.uid));
          const p    = snap.exists() ? snap.data() : {};
          setUser({
            uid:   fu.uid,
            name:  p.firstName ? `${p.firstName} ${p.lastName}`.trim() : fu.displayName || fu.email,
            email: fu.email,
            role:  p.role || "staff",
          });
          setScreen("dashboard");
        } catch {
          setUser({ uid: fu.uid, name: fu.displayName || fu.email, email: fu.email, role: "staff" });
          setScreen("dashboard");
        }
      } else {
        setScreen("signin");
      }
    });
    return () => unsub();
  }, []);

  // Loading splash
  if (screen === "loading") return (
    <div className="loading-screen">
      <style>{CSS}</style>
      <div style={{ textAlign: "center" }}>
        <Logo size={60} showText={false} />
        <div style={{ marginTop: 18, fontSize: 14, color: "#a07070" }}>
          <Spin /> &nbsp;Loading...
        </div>
      </div>
    </div>
  );

  if (screen === "signup") return (
    <SignupScreen onDone={u => {
      if (u) { setUser(u); setScreen("dashboard"); }
      else setScreen("signin");
    }} />
  );

  if (screen === "signin") return (
    <SigninScreen
      onLogin={u => { setUser(u); setScreen("dashboard"); }}
      onSignup={() => setScreen("signup")}
    />
  );

  return (
    <>
      <style>{CSS}</style>
      <Dashboard user={user} onLogout={() => { setUser(null); setScreen("signin"); }} />
    </>
  );
}
