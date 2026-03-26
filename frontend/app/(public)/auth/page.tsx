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
      window.location.href = "/dashboard";
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
        window.location.href = "/dashboard";
        return;
      }
      try {
        const session = await signInWithPassword(email, password);
        setAccessToken(session.access_token);
        window.location.href = "/dashboard";
      } catch {
        setNotice("Account created. Check your email to confirm, then sign in.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    }
  }

  if (loading) {
    return <main className="card" style={{ margin: 24 }}>Checking session...</main>;
  }

  if (!hasSupabaseEnv()) {
    return (
      <main className="card" style={{ margin: 24 }}>
        <div>Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.</div>
      </main>
    );
  }

  if (user) {
    return (
      <main className="card" style={{ margin: 24 }}>
        <div className="section-title">Authenticated</div>
        <div className="badge">{user.email || user.id}</div>
        <div style={{ marginTop: 12 }}>
          <a className="btn" href="/dashboard">Go to Dashboard</a>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-poster fade-up">
      <section className="auth-poster-panel">
        <div className="auth-poster-copy">
          <div className="poster-brand">
            <span>Unified ETL</span>
            <strong>Unified ETL</strong>
          </div>
          <div className="badge">{mode === "signin" ? "Resume workspace" : "Create workspace"}</div>
          <h1 className="poster-title" style={{ maxWidth: 520 }}>
            {mode === "signin" ? "Continue the dataset flow." : "Start the first dataset version."}
          </h1>
          <p className="poster-summary" style={{ maxWidth: 500 }}>
            Authenticate once, then move through dataset creation, connector setup, curation, EDA, and export from the same product surface.
          </p>
          <div className="poster-mini-list">
            <div><strong>Inputs</strong><span>Files, object storage, warehouses, databases, streams</span></div>
            <div><strong>Stages</strong><span>Ingest, validate, normalize, label, EDA, export</span></div>
            <div><strong>Outputs</strong><span>COCO, YOLO, JSONL, Parquet, lineage metadata</span></div>
          </div>
        </div>

        <div className="auth-poster-form">
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
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            <button className="btn" type="submit">
              {mode === "signin" ? "Enter Dashboard" : "Create Account"}
            </button>
            {error && <div className="alert warn">{error}</div>}
            {notice && <div className="alert info">{notice}</div>}
          </form>
        </div>
      </section>
    </main>
  );
}
