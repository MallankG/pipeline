"use client";

import { useSessionUser } from "@/components/session";

export default function ProfilePage() {
  const { user, loading } = useSessionUser();

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to view your profile.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="section-title">Profile</div>
        <div className="grid">
          <div className="stat">
            <strong>Primary Email</strong>
            <div>{user?.email || "-"}</div>
          </div>
          <div className="stat">
            <strong>User ID</strong>
            <div>{user?.id || "-"}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">Connected Accounts</div>
        <div className="grid">
          <div className="stat">
            <strong>Email + Password</strong>
            <div>Active</div>
          </div>
          <div className="stat">
            <strong>GitHub</strong>
            <div>Not connected</div>
          </div>
          <div className="stat">
            <strong>Google</strong>
            <div>Not connected</div>
          </div>
        </div>
      </section>
    </main>
  );
}
