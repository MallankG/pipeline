"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiDelete } from "@/components/api";
import { useSessionUser } from "@/components/session";
import CreateVersion from "@/components/CreateVersion";
import PageLoader from "@/components/PageLoader";

type Dataset = {
  id: string;
  name: string;
  description?: string;
  data_types: string[];
  created_at?: string;
};

type Version = {
  id: string;
  version: number;
  status: string;
  created_at: string;
};

type Source = {
  id: string;
  source_type: string;
  source_uri: string;
  created_at: string;
};

export default function DatasetPage() {
  const params = useParams<{ id: string }>();
  const datasetId = params?.id;
  const { user, loading: authLoading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [versions, setVersions] = useState<Version[] | null>(null); // null = loading
  const [sourcesByVersion, setSourcesByVersion] = useState<Record<string, Source[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Version | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user || !datasetId) return;
    async function load() {
      try {
        const [ds, vs] = await Promise.all([
          apiGet(`/datasets/${datasetId}`),
          apiGet(`/datasets/${datasetId}/versions`),
        ]);
        setDataset(ds);
        setVersions(vs || []);

        // Parallel fetch of sources per version
        const entries = await Promise.all(
          (vs || []).map(async (v: Version) => {
            const src = await apiGet(`/datasets/${datasetId}/versions/${v.id}/sources`);
            return [v.id, src || []] as [string, Source[]];
          })
        );
        setSourcesByVersion(Object.fromEntries(entries));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load dataset");
        setVersions([]);
      }
    }
    load();
  }, [datasetId, user]);

  const latestVersion = useMemo(
    () => (versions ?? []).slice().sort((a, b) => b.version - a.version)[0],
    [versions]
  );
  
  async function handleDeleteVersion() {
    if (!datasetId || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiDelete(`/datasets/${datasetId}/versions/${deleteTarget.id}`);
      setVersions((vs) => (vs || []).filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete version");
    } finally {
      setIsDeleting(false);
    }
  }

  if (authLoading) return <PageLoader />;

  if (!user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to access this dataset.</div>
      </main>
    );
  }

  // Full-page loader until both dataset + versions are ready
  if (!dataset || versions === null) return <PageLoader />;

  return (
    <main className="grid fade-up" style={{ gap: 32 }}>
      {error && <div className="alert warn">{error}</div>}

      <section className="card">
        <div className="toolbar">
          <div>
            <h1 className="page-title" style={{ margin: "0 0 8px 0" }}>{dataset.name}</h1>
            <div className="muted">{dataset.description || "No description yet."}</div>
          </div>
          <div className="inline-actions">
            {latestVersion && latestVersion.status !== "processed" && (
              <a className="btn secondary" href={`/datasets/${datasetId}/curate/${latestVersion.id}`}>Resume Curation (v{latestVersion.version})</a>
            )}
            {latestVersion && latestVersion.status === "processed" && (
              <a className="btn secondary" href={`/datasets/${datasetId}/curate/${latestVersion.id}`}>View Curation (v{latestVersion.version})</a>
            )}
            <a className="btn secondary" href="/connectors">Add Source</a>
            <a className="btn secondary" href={`/datasets/${datasetId}/query`}>Query Data</a>
          </div>
        </div>
        <div className="chip-group" style={{ marginTop: 12 }}>
          {(dataset.data_types || []).map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
      </section>

      {datasetId && <CreateVersion datasetId={datasetId} />}

      <section className="card">
        <div className="section-title">Versions</div>
        {versions.length === 0 && <div className="muted">No versions yet. Create one to begin curation.</div>}
        <div className="card-grid" style={{ marginTop: 16 }}>
          {versions.map((v) => (
            <div key={v.id} className="card" style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: 16, right: 16 }}>
                 <button className="btn secondary" style={{ padding: "4px 8px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none" }} onClick={() => setDeleteTarget(v)}>Delete</button>
              </div>
              <div className="card-title">Version v{v.version}</div>
              <div className="muted">Status: {v.status}</div>
              <div style={{ fontSize: 12, color: "#6a625a", marginTop: 8 }}>
                Created {new Date(v.created_at).toLocaleString()}
              </div>
              <div className="inline-actions" style={{ marginTop: 12 }}>
                <a className="btn secondary" href={`/datasets/${datasetId}/curate/${v.id}`}>Curate</a>
                <a className="btn secondary" href={`/datasets/${datasetId}/versions/${v.id}`}>Add Data</a>
                {v.status === "processed" ? (
                  <>
                    <a className="btn secondary" href={`/datasets/${datasetId}/eda/${v.id}`}>EDA</a>
                    <a className="btn secondary" href={`/datasets/${datasetId}/final/${v.id}`}>Final</a>
                  </>
                ) : (
                  <>
                    <button className="btn secondary" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>EDA</button>
                    <button className="btn secondary" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>Final</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">Connected Sources</div>
        {versions.length === 0 && <div className="muted">No versions yet.</div>}
        {versions.map((v) => (
          <div key={v.id} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Version v{v.version}</div>
            <div className="grid grid-3">
              {(sourcesByVersion[v.id] || []).map((s) => (
                <div key={s.id} className="stat">
                  <strong>{s.source_type}</strong>
                  <div><a href={s.source_uri} className="muted" style={{ textDecoration: "underline", color: "var(--accent-2)" }}>{s.source_uri}</a></div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>Added {new Date(s.created_at).toLocaleString()}</div>
                </div>
              ))}
              {(sourcesByVersion[v.id] || []).length === 0 && (
                <div className="stat">
                  <strong>No sources</strong>
                  <div>Connect one in the create flow or via Connectors.</div>
                  <div style={{ marginTop: 8 }}>
                    <a className="btn secondary" href="/connectors">Go to Connectors</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Delete Version Confirmation Modal */}
      {deleteTarget && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(29, 26, 23, 0.2)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
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
            <h3 style={{ marginTop: 0 }}>Delete Version v{deleteTarget.version}</h3>
            <p className="muted">
              Are you sure you want to permanently delete version v{deleteTarget.version}? This action cannot be undone and will delete all associated data assets.
            </p>
            <div className="inline-actions" style={{ marginTop: 24, justifyContent: "flex-end" }}>
              <button className="btn secondary ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</button>
              <button className="btn" onClick={handleDeleteVersion} disabled={isDeleting} style={{ background: "#ef4444", borderColor: "#ef4444", color: "#fff" }}>
                {isDeleting ? "Deleting..." : "Delete Version"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
