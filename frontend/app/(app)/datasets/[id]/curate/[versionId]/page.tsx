"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";

type Dataset = {
  id: string;
  name: string;
  data_types: string[];
};

type Asset = {
  id: string;
  uri: string;
  media_type: string;
  status: string;
};

type Source = {
  id: string;
  source_type: string;
  source_uri: string;
  created_at: string;
};

const CURATION_STAGES = [
  { label: "Ingest", detail: "Pulling raw data from connected sources" },
  { label: "Validate", detail: "Schema and type checks across assets" },
  { label: "Normalize", detail: "Cleaning and structuring outputs" },
  { label: "Label", detail: "Auto labeling and human review" },
  { label: "EDA", detail: "Generating summary statistics" },
];

export default function CuratePage() {
  const params = useParams<{ id: string; versionId: string }>();
  const datasetId = params?.id;
  const versionId = params?.versionId;
  const { user, loading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user || !datasetId || !versionId) {
        return;
      }
      const ds = await apiGet(`/datasets/${datasetId}`);
      const assetsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`);
      const sourcesResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/sources`);
      setDataset(ds);
      setAssets(assetsResult || []);
      setSources(sourcesResult || []);
    }
    load();
  }, [datasetId, versionId, user]);

  useEffect(() => {
    if (!user || !datasetId || !versionId) return;
    setPolling(true);
    const timer = setInterval(async () => {
      const assetsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`);
      setAssets(assetsResult || []);
    }, 6000);
    return () => clearInterval(timer);
  }, [datasetId, versionId, user]);

  const stageIndex = useMemo(() => {
    if (assets.length === 0) return 0;
    if (assets.some((a) => a.status === "registered")) return 1;
    if (assets.some((a) => a.status === "validated")) return 2;
    if (assets.some((a) => a.status === "normalized")) return 3;
    return 4;
  }, [assets]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to curate datasets.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <div className="toolbar">
          <div>
            <div className="page-title">Curating {dataset?.name || "Dataset"}</div>
            <div className="muted">Version {versionId}</div>
          </div>
          <div className="chip-group">
            {(dataset?.data_types || []).map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16 }} className="alert info">
          {polling ? "Curation in progress. We are checking new assets every few seconds." : "Curation paused."}
        </div>
      </section>

      <section className="card">
        <div className="section-title">Curation stages</div>
        <div className="grid">
          {CURATION_STAGES.map((s, idx) => (
            <div key={s.label} className="stat" style={{ borderColor: idx <= stageIndex ? "rgba(31, 122, 140, 0.6)" : undefined }}>
              <strong>{s.label}</strong>
              <div className="muted">{s.detail}</div>
              <div style={{ marginTop: 8 }} className="badge">{idx <= stageIndex ? "Active" : "Queued"}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">Connected Sources</div>
        <div className="grid">
          {sources.length === 0 && <div className="muted">No sources connected yet.</div>}
          {sources.map((s) => (
            <div key={s.id} className="stat">
              <strong>{s.source_type}</strong>
              <div>{s.source_uri}</div>
              <div style={{ fontSize: 12, color: "#6a625a" }}>Added {new Date(s.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">Incoming Assets</div>
        <table className="table">
          <thead>
            <tr>
              <th>URI</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td>{a.uri}</td>
                <td>{a.media_type}</td>
                <td>{a.status}</td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">No assets yet. Add data from the version page.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: 12 }} className="inline-actions">
          <a className="btn secondary" href={`/datasets/${datasetId}/eda/${versionId}`}>View EDA</a>
          <a className="btn" href={`/datasets/${datasetId}/final/${versionId}`}>Go to Final Dataset</a>
        </div>
      </section>
    </main>
  );
}
