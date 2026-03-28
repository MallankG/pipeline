"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiDelete } from "@/components/api";
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  function initiateDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault(); // Prevent navigating to the dataset detail page
    setDeleteTarget({ id, name });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiDelete(`/datasets/${deleteTarget.id}`);
      setDatasets((prev) => (prev ? prev.filter((d) => d.id !== deleteTarget.id) : prev));
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete dataset");
    } finally {
      setIsDeleting(false);
    }
  }

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
          <a key={d.id} className="card" href={`/datasets/${d.id}`} style={{ display: "flex", flexDirection: "column", position: "relative" }}>
            <button 
                onClick={(e) => initiateDelete(e, d.id, d.name)} 
                title="Delete dataset"
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--alert-color)', cursor: 'pointer', padding: '4px', opacity: 0.7, transform: 'scale(0.9)', transition: 'all 0.2s', zIndex: 10 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.transform = 'scale(0.9)'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <div className="card-title" style={{ paddingRight: '24px' }}>{d.name}</div>
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

      {deleteTarget && (
        <div style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 20
        }}>
          <div className="card" style={{ maxWidth: 400, width: "100%", margin: 0, position: "relative" }}>
            <button
              onClick={() => setDeleteTarget(null)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "1.2rem",
                color: "var(--muted)",
                lineHeight: 1
              }}
            >
              ✕
            </button>
            <h3 style={{ marginTop: 0 }}>Delete Dataset</h3>
            <p className="muted">
              Are you sure you want to permanently delete "{deleteTarget.name}"? This action cannot be undone.
            </p>
            <div className="inline-actions" style={{ marginTop: 24, justifyContent: "flex-end" }}>
              <button
                className="btn secondary"
                onClick={(e) => { e.preventDefault(); setDeleteTarget(null); }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: "var(--warn, #ef4444)", border: "none", color: "white" }}
                onClick={(e) => { e.preventDefault(); confirmDelete(); }}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
