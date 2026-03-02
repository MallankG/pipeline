"use client";

import { useState } from "react";
import { getAccessToken, setAccessToken, useSessionUser } from "./session";
import { signOut } from "./supabase";

export default function ProfileMenu() {
  const { user, loading } = useSessionUser();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    const token = getAccessToken();
    if (token) {
      await signOut(token);
    }
    setAccessToken(null);
    window.location.href = "/auth";
  }

  if (loading || !user) {
    return null;
  }

  return (
    <div style={{ position: "relative" }}>
      <button className="profile-btn" onClick={() => setOpen((v) => !v)}>
        <span className="profile-dot" />
        {user.email || "Account"}
      </button>
      {open && (
        <div className="profile-menu">
          <a href="/profile">Profile</a>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      )}
    </div>
  );
}
