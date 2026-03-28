"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";
import PageLoader from "@/components/PageLoader";

type Dataset = {
  id: string;
  name: string;
  data_types: string[];
  created_at: string;
  description?: string;
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useSessionUser();
  const [datasets, setDatasets] = useState<Dataset[] | null>(null); // null = not yet loaded
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    apiGet("/datasets")
      .then((r) => setDatasets(r || []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load datasets");
        setDatasets([]);
      });
  }, [user]);

  const filtered = useMemo(() => {
    if (!datasets) return [];
    if (!query.trim()) return datasets;
    const q = query.toLowerCase();
    return datasets.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q)
    );
  }, [datasets, query]);

  // Auth loading
  if (authLoading) return <PageLoader lines={2} />;

  // Not signed in
  if (!user) {
    return (
      <main className="card fade-up" style={{ textAlign: "center", padding: "40px" }}>
        <h2>Authentication Required</h2>
        <p className="muted" style={{ marginBottom: "24px" }}>Please sign in to access your dashboard.</p>
        <a href="/auth" className="btn">Sign In</a>
      </main>
    );
  }

  // Data loading
  if (datasets === null) return <PageLoader lines={2} />;

  return (
    <main className="grid fade-up" style={{ gap: 32 }}>
      <section className="toolbar card" style={{ padding: "32px", background: "linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(59, 130, 246, 0.05))" }}>
        <div>
          <h1 className="page-title">Your datasets</h1>
          <p className="muted" style={{ marginTop: "8px", fontSize: "16px" }}>Launch new versions, connect sources, and track curation in one view.</p>
        </div>
        <div className="inline-actions">
          <a className="btn" href="/datasets/new">Create Dataset</a>
          <a className="btn secondary" href="/connectors">Connect Sources</a>
        </div>
      </section>

      <section>
        <div className="toolbar" style={{ marginBottom: "16px" }}>
          <h2 className="section-title" style={{ margin: 0 }}>Search datasets</h2>
          <div className="badge">{datasets.length} total</div>
        </div>
        <input
          placeholder="Search by name or description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", maxWidth: "600px" }}
        />
      </section>

      {error && <section className="alert warn">{error}</section>}

      <section className="card-grid">
        <a className="card" href="/datasets/new" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", borderStyle: "dashed", backgroundColor: "rgba(255, 255, 255, 0.01)" }}>
          <div>
            <div className="card-title">New dataset</div>
            <div className="muted" style={{ fontSize: "14px", lineHeight: "1.5" }}>Spin up a fresh pipeline with guided intake and validation.</div>
          </div>
          <div style={{ marginTop: 24, alignSelf: "flex-start" }} className="badge">+ Create</div>
        </a>

        {filtered.map((d) => (
          <a key={d.id} className="card" href={`/datasets/${d.id}`} style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-title">{d.name}</div>
            <div className="muted" style={{ fontSize: "14px", marginBottom: "16px", flex: 1 }}>{d.description || "No description provided."}</div>
            <div className="chip-group" style={{ marginTop: "auto", marginBottom: "16px" }}>
              {(d.data_types || []).map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
              Created {new Date(d.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </div>
          </a>
        ))}
      </section>
    </main>
  );
}
