"use client";

import { FormEvent, useState } from "react";
import { hasSupabaseEnv, signInWithPassword, signUp } from "@/components/supabase";
import { setAccessToken, useSessionUser } from "@/components/session";

export default function AuthPage() {
  const { user, loading } = useSessionUser();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
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
    setNotice(null);
    try {
      const result = await signUp(email, password);
      if (result?.session?.access_token) {
        setAccessToken(result.session.access_token);
        window.location.href = "/app";
        return;
      }
      try {
        const session = await signInWithPassword(email, password);
        setAccessToken(session.access_token);
        window.location.href = "/app";
      } catch {
        setNotice("Account created. Check your email to confirm, then sign in.");
      }
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
    <main className="auth-shell fade-up">
      <section className="auth-card">
        <div className="auth-header">
          <div>
            <div className="badge">Unified ETL</div>
            <div className="page-title" style={{ marginTop: 8 }}>Welcome back</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Sign in or create an account to start building datasets.
            </div>
          </div>
        </div>

        <div className="auth-toggle">
          <button
            className={mode === "signin" ? "btn" : "btn secondary"}
            type="button"
            onClick={() => setMode("signin")}
          >
            Sign In
          </button>
          <button
            className={mode === "signup" ? "btn" : "btn secondary"}
            type="button"
            onClick={() => setMode("signup")}
          >
            Create Account
          </button>
        </div>

        <form className="grid" onSubmit={mode === "signin" ? onSignIn : onSignUp}>
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn" type="submit">
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
          {error && <div className="alert warn">{error}</div>}
          {notice && <div className="alert info">{notice}</div>}
        </form>
      </section>

      <section className="auth-side">
        <div className="section-title">Why this matters</div>
        <p className="muted">
          Full pipeline: ingest, curate, label, EDA, and export, with dataset versioning
          and secure access controls.
        </p>
        <div className="chip-group">
          <div className="chip">RLS secured datasets</div>
          <div className="chip">Auto labeling hooks</div>
          <div className="chip">COCO/YOLO/JSONL exports</div>
        </div>
        <div className="flow" style={{ marginTop: 24 }}>
          <div className="flow-item">
            <div className="flow-dot pulsing" />
            <div>Connect sources across lakes, warehouses, and streams</div>
          </div>
          <div className="flow-item">
            <div className="flow-dot pulsing" />
            <div>Launch curation and generate EDA instantly</div>
          </div>
        </div>
      </section>
    </main>
  );
}
