// src/App.js
// Root — handles auth state, session validation, and screen routing.
import { useState, useEffect } from "react";
import api from "./api";
import { CSS }                  from "./constants";
import { mapUser }              from "./helpers";
import { Logo, Spin }           from "./components/UI";
import {
  SigninScreen, SignupScreen, VerifyEmailScreen,
  ForgotPasswordScreen, ResetPasswordScreen,
} from "./components/Auth";
import { Dashboard }            from "./components/Dashboard";

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [user,   setUser]   = useState(null);
  // Set when the user lands on a /verify-email/:token or /reset-password/:token deep link
  const [verifyToken, setVerifyToken] = useState(null);
  const [resetToken,  setResetToken]  = useState(null);

  useEffect(() => {
    const path = window.location.pathname;

    // ── Handle verify-email deep link ─────────────────────────────────────
    const verifyMatch = path.match(/^\/verify-email\/([a-f0-9]+)$/i);
    if (verifyMatch) {
      setVerifyToken(verifyMatch[1]);
      setScreen("verify-email");
      return;
    }

    // ── Handle reset-password deep link ───────────────────────────────────
    const resetMatch = path.match(/^\/reset-password\/([a-f0-9]+)$/i);
    if (resetMatch) {
      setResetToken(resetMatch[1]);
      setScreen("reset-password");
      return;
    }

    // ── Listen for forced logout dispatched by api.js on refresh failure ──
    const handleLogout = () => {
      setUser(null);
      setScreen("signin");
    };
    window.addEventListener("auth:logout", handleLogout);

    // ── Validate existing session ─────────────────────────────────────────
    async function checkAuth() {
      const token = localStorage.getItem("token");
      if (!token) {
        setScreen("signin");
        return;
      }
      try {
        const res = await api.get("/auth/me");
        if (res.success) {
          setUser(mapUser(res.data.user));
          setScreen("dashboard");
        } else {
          localStorage.removeItem("token");
          setScreen("signin");
        }
      } catch {
        localStorage.removeItem("token");
        setScreen("signin");
      }
    }
    checkAuth();

    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  // ── Loading splash ─────────────────────────────────────────────────────────
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

  if (screen === "verify-email") return (
    <VerifyEmailScreen
      token={verifyToken}
      onDone={() => {
        // Clear the URL and go to sign-in
        window.history.replaceState({}, "", "/");
        setVerifyToken(null);
        setScreen("signin");
      }}
    />
  );

  if (screen === "reset-password") return (
    <ResetPasswordScreen
      token={resetToken}
      onDone={() => {
        // The reset revoked every session, so there is nothing to stay signed in to.
        window.history.replaceState({}, "", "/");
        localStorage.removeItem("token");
        setResetToken(null);
        setUser(null);
        setScreen("signin");
      }}
    />
  );

  if (screen === "forgot-password") return (
    <ForgotPasswordScreen onBack={() => setScreen("signin")} />
  );

  if (screen === "signup") return (
    <SignupScreen onDone={(u) => {
      // A Google signup returns the user and lands straight in the dashboard.
      // A local signup returns null — the password is set from the emailed link.
      if (u) { setUser(u); setScreen("dashboard"); }
      else setScreen("signin");
    }} />
  );

  if (screen === "signin") return (
    <SigninScreen
      onLogin={(u) => { setUser(u); setScreen("dashboard"); }}
      onSignup={() => setScreen("signup")}
      onForgot={() => setScreen("forgot-password")}
    />
  );

  return (
    <>
      <style>{CSS}</style>
      <Dashboard
        user={user}
        onLogout={async () => {
          try {
            await api.post("/auth/logout");
          } catch (e) {
            // Ignore error, we still want to log out locally
          }
          localStorage.removeItem("token");
          setUser(null);
          setScreen("signin");
        }}
        onUserUpdate={(updates) => setUser(u => ({ ...u, ...updates }))}
      />
    </>
  );
}
