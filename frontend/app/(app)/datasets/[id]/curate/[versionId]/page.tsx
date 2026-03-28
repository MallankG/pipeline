"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";
import { useJobWebSocket } from "@/components/useJobWebSocket";

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

type Job = {
  id: string;
  status: string;
};

const CURATION_STAGES = [
  { label: "Ingest", detail: "Pulling raw data from connected sources" },
  { label: "Validate", detail: "Schema and type checks across assets" },
  { label: "Normalize", detail: "Cleaning and structuring outputs" },
  { label: "Label", detail: "Auto labeling and human review" },
  { label: "EDA", detail: "Generating summary statistics" },
];

type Version = {
  id: string;
  status: string;
  version: number;
};

export default function CuratePage() {
  const params = useParams<{ id: string; versionId: string }>();
  const datasetId = params?.id;
  const versionId = params?.versionId;
  const { user, loading } = useSessionUser();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [version, setVersion] = useState<Version | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Connect to WebSocket for real-time updates
  const { isConnected, progress } = useJobWebSocket(activeJobId);

  useEffect(() => {
    async function load() {
      if (!user || !datasetId || !versionId) {
        return;
      }
      const ds = await apiGet(`/datasets/${datasetId}`);
      const assetsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`);
      const sourcesResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/sources`);
      const versions = await apiGet(`/datasets/${datasetId}/versions`);
      const currentV = versions?.find((v: Version) => v.id === versionId);
      const jobsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/jobs`);

      // Find active running job
      const activeJob = jobsResult?.find((j: Job) => j.status === "running");
      if (activeJob) {
        setActiveJobId(activeJob.id);
      }

      setDataset(ds);
      setVersion(currentV);
      setAssets(assetsResult || []);
      setSources(sourcesResult || []);
    }
    load();
  }, [datasetId, versionId, user]);

  // Polling as fallback when WebSocket is not connected
  useEffect(() => {
    if (!user || !datasetId || !versionId) return;
    setPolling(true);
    const timer = setInterval(async () => {
      const assetsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`);
      const versions = await apiGet(`/datasets/${datasetId}/versions`);
      const currentV = versions?.find((v: Version) => v.id === versionId);

      setAssets(assetsResult || []);
      setVersion(currentV);
      if (currentV?.status === "processed" || currentV?.status === "failed") {
        setPolling(false);
        clearInterval(timer);
        setActiveJobId(null);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [datasetId, versionId, user, activeJobId]);

  // Merge WebSocket progress with version status
  const stageIndex = useMemo(() => {
    // Use WebSocket stage if available
    const wsStage = progress?.currentStage;
    if (wsStage === "ingesting") return 0;
    if (wsStage === "processing") return 1;
    if (wsStage === "eda_generating") return 3;
    if (wsStage === "exporting") return 4;
    if (wsStage === "completed") return 5;

    // Fall back to version status
    const s = version?.status || "draft";
    if (s === "ingesting") return 0;
    if (s === "processing") return 1;
    if (s === "eda_generating") return 3;
    if (s === "exporting") return 4;
    if (s === "processed") return 5;
    return -1;
  }, [version, progress]);

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
            <div className="muted">Version v{version?.version} (Current status: {version?.status})</div>
          </div>
          <div className="chip-group">
            {(dataset?.data_types || []).map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16 }} className={`alert ${version?.status === "failed" ? "warn" : "info"}`}>
          {isConnected && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                animation: "pulse 2s infinite"
              }} />
              <span>Live updates connected</span>
            </div>
          )}
          {progress.error ? (
            <div className="warn">Error: {progress.error}</div>
          ) : progress.assetProgress.total > 0 ? (
            <div>
              <div style={{ marginBottom: 8 }}>
                Processing: {progress.assetProgress.current} / {progress.assetProgress.total} assets
                ({Math.round((progress.assetProgress.current / progress.assetProgress.total) * 100)}%)
              </div>
              <div style={{
                height: 4,
                background: "#e5e7eb",
                borderRadius: 2,
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${(progress.assetProgress.current / progress.assetProgress.total) * 100}%`,
                  background: "#8b5cf6",
                  transition: "width 0.3s ease"
                }} />
              </div>
              {progress.assetProgress.currentAssetId && (
                <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                  Current: {progress.assetProgress.currentAssetId} ({progress.assetProgress.currentAssetStatus})
                </div>
              )}
            </div>
          ) : (
            polling ? "Pipeline is active. We are tracking progress through the ingest and processing stages." : version?.status === "processed" ? "Curation complete." : version?.status === "failed" ? "Curation failed. Check job logs." : "Curation paused."
          )}
        </div>
      </section>

      {/* Live Processing Logs */}
      {progress.logs.length > 0 && (
        <section className="card">
          <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Live Processing Logs</span>
            {isConnected && <span className="badge" style={{ background: "#22c55e", color: "white" }}>Live</span>}
          </div>
          <div style={{
            background: "#1f2937",
            color: "#e5e7eb",
            padding: 12,
            borderRadius: 6,
            fontFamily: "monospace",
            fontSize: 12,
            maxHeight: 300,
            overflow: "auto"
          }}>
            {progress.logs.map((log, idx) => (
              <div key={idx} style={{ marginBottom: 4 }}>
                {log}
              </div>
            ))}
          </div>
          {progress.stats && (
            <div style={{ marginTop: 12 }} className="grid">
              {progress.stats.total !== undefined && (
                <div className="stat">
                  <strong>{progress.stats.total}</strong>
                  <div className="muted">Total Assets</div>
                </div>
              )}
              {progress.stats.processed !== undefined && (
                <div className="stat">
                  <strong style={{ color: "#22c55e" }}>{progress.stats.processed}</strong>
                  <div className="muted">Processed</div>
                </div>
              )}
              {progress.stats.failed !== undefined && progress.stats.failed > 0 && (
                <div className="stat">
                  <strong style={{ color: "#ef4444" }}>{progress.stats.failed}</strong>
                  <div className="muted">Failed</div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <div className="section-title">Curation stages</div>
        <div className="grid">
          {CURATION_STAGES.map((s, idx) => (
            <div key={s.label} className="stat" style={{ 
              borderColor: idx === stageIndex ? "var(--accent)" : idx < stageIndex ? "rgba(31, 122, 140, 0.6)" : undefined,
              background: idx === stageIndex ? "rgba(139, 92, 246, 0.05)" : undefined
            }}>
              <strong>{s.label}</strong>
              <div className="muted">{s.detail}</div>
              <div style={{ marginTop: 8 }} className="badge">{idx === stageIndex ? "In Progress" : idx < stageIndex ? "Complete" : "Queued"}</div>
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
        <div className="section-title">Incoming Assets ({assets.length})</div>
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
                <td><span className={`chip ${a.status === "processed" ? "primary" : a.status === "failed" ? "warn" : ""}`}>{a.status}</span></td>
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
