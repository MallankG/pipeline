"use client";

import { FormEvent, useState } from "react";
import { hasSupabaseEnv, signInWithPassword, signUp } from "../../components/supabase";
import { setAccessToken, useSessionUser } from "../../components/session";

export default function AuthPage() {
  const { user, loading } = useSessionUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const session = await signInWithPassword(email, password);
      setAccessToken(session.access_token);
      window.location.href = "/app";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    }
  }

  async function onSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signUp(email, password);
      const session = await signInWithPassword(email, password);
      setAccessToken(session.access_token);
      window.location.href = "/app";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    }
  }

  if (loading) {
    return <main className="card">Checking session...</main>;
  }

  if (!hasSupabaseEnv()) {
    return (
      <main className="card">
        <div>Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.</div>
      </main>
    );
  }

  if (user) {
    return (
      <main className="card">
        <div className="section-title">Authenticated</div>
        <div className="badge">{user.email || user.id}</div>
        <div style={{ marginTop: 12 }}>
          <a className="btn" href="/app">Go to Dashboard</a>
        </div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gridTemplateColumns: "1.1fr 1fr", gap: 20 }}>
      <section className="card">
        <div className="section-title">Sign In</div>
        <form className="grid" onSubmit={onSignIn}>
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" type="submit">Sign In</button>
            <button className="btn secondary" type="button" onClick={onSignUp}>Create Account</button>
          </div>
          {error && <div style={{ color: "#b60000" }}>{error}</div>}
        </form>
      </section>

      <section className="card">
        <div className="section-title">Why this matters</div>
        <p style={{ color: "#6a625a" }}>
          You get a full pipeline: ingest, curate, label, EDA, and export, with dataset versioning
          and secure access controls.
        </p>
        <div className="grid">
          <div className="badge">RLS secured datasets</div>
          <div className="badge">Auto labeling hooks</div>
          <div className="badge">COCO/YOLO/JSONL exports</div>
        </div>
      </section>
    </main>
  );
}
