"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";
import CreateVersion from "@/components/CreateVersion";

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
  const { user, loading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [sourcesByVersion, setSourcesByVersion] = useState<Record<string, Source[]>>({});

  useEffect(() => {
    async function load() {
      if (!user || !datasetId) {
        return;
      }
      const ds = await apiGet(`/datasets/${datasetId}`);
      const vs = await apiGet(`/datasets/${datasetId}/versions`);
      setDataset(ds);
      setVersions(vs || []);

      const sourcesMap: Record<string, Source[]> = {};
      for (const version of vs || []) {
        const src = await apiGet(`/datasets/${datasetId}/versions/${version.id}/sources`);
        sourcesMap[version.id] = src || [];
      }
      setSourcesByVersion(sourcesMap);
    }
    load();
  }, [datasetId, user]);

  const latestVersion = useMemo(() => versions.slice().sort((a, b) => b.version - a.version)[0], [versions]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to access this dataset.</div>
      </main>
    );
  }

  return (
    <main className="grid fade-up" style={{ gap: 32 }}>
      <section className="card">
        <div className="toolbar">
          <div>
            <h1 className="page-title" style={{ margin: "0 0 8px 0" }}>{dataset?.name || "Dataset"}</h1>
            <div className="muted">{dataset?.description || "No description yet."}</div>
          </div>
          <div className="inline-actions">
            {latestVersion && (
              <a className="btn" href={`/datasets/${datasetId}/curate/${latestVersion.id}`}>Resume Curation</a>
            )}
            <a className="btn secondary" href="/connectors">Add Source</a>
          </div>
        </div>
        <div className="chip-group" style={{ marginTop: 12 }}>
          {(dataset?.data_types || []).map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
      </section>

      {datasetId && (
        <CreateVersion datasetId={datasetId} />
      )}

      <section className="card">
        <div className="section-title">Versions</div>
        {versions.length === 0 && <div className="muted">No versions yet. Create one to begin curation.</div>}
        <div className="card-grid">
          {versions.map((v) => (
            <div key={v.id} className="card">
              <div className="card-title">Version v{v.version}</div>
              <div className="muted">Status: {v.status}</div>
              <div style={{ fontSize: 12, color: "#6a625a", marginTop: 8 }}>
                Created {new Date(v.created_at).toLocaleString()}
              </div>
              <div className="inline-actions" style={{ marginTop: 12 }}>
                <a className="btn" href={`/datasets/${datasetId}/curate/${v.id}`}>Curate</a>
                <a className="btn secondary" href={`/datasets/${datasetId}/versions/${v.id}`}>Add Data</a>
                <a className="btn ghost" href={`/datasets/${datasetId}/eda/${v.id}`}>EDA</a>
                <a className="btn ghost" href={`/datasets/${datasetId}/final/${v.id}`}>Final</a>
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
    </main>
  );
}
