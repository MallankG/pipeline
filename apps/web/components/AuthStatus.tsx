"use client";

import { hasSupabaseEnv, signOut } from "./supabase";
import { getAccessToken, setAccessToken, useSessionUser } from "./session";

export default function AuthStatus() {
  const { user, loading } = useSessionUser();

  async function handleSignOut() {
    const token = getAccessToken();
    if (token) {
      await signOut(token);
    }
    setAccessToken(null);
    window.location.href = "/auth";
  }

  if (loading) {
    return <span className="badge">Checking auth...</span>;
  }

  if (!hasSupabaseEnv()) {
    return <span className="badge">Missing Supabase env</span>;
  }

  if (!user) {
    return <a className="btn secondary" href="/auth">Sign In</a>;
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span className="badge">{user.email || user.id}</span>
      <button className="btn secondary" onClick={handleSignOut}>Sign Out</button>
    </div>
  );
}
