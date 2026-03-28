"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";
import VersionActions from "@/components/VersionActions";
import { useJobWebSocket } from "@/components/useJobWebSocket";

type Asset = {
  id: string;
  uri: string;
  media_type: string;
  status: string;
};

type Job = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  logs?: string;
};

/** Map DB/WS stage values → friendly label */
function stageName(stage: string): string {
  const map: Record<string, string> = {
    waiting: "Waiting",
    queued: "Queued",
    running: "Running",
    ingesting: "Ingesting sources",
    processing: "Processing assets",
    eda_generating: "Generating EDA",
    exporting: "Exporting manifest",
    completed: "Completed ✓",
    failed: "Failed ✗",
    error: "Error ✗",
    draft: "Draft",
    processed: "Completed ✓",
  };
  return map[stage] ?? stage;
}

/** Status dot colour */
function statusColor(stage: string): string {
  if (["completed", "processed"].includes(stage)) return "var(--ok)";
  if (["failed", "error"].includes(stage)) return "var(--warn)";
  if (["ingesting", "processing", "eda_generating", "exporting", "running"].includes(stage)) return "#d97706";
  return "var(--muted)";
}

/** Show the active pipeline job's progress inline, recoverable after page reload */
function ActiveJobPanel({ jobId }: { jobId: string }) {
  const { isConnected, progress } = useJobWebSocket(jobId);
  const spinnerStyle: React.CSSProperties = {
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: statusColor(progress.currentStage),
    marginRight: 8,
    flexShrink: 0,
    animation: progress.isComplete ? "none" : "pulse 1.6s ease-in-out infinite",
  };

  return (
    <div
      style={{
        padding: "20px 24px",
        borderRadius: 20,
        border: "1px solid rgba(78, 90, 86, 0.2)",
        background: "rgba(78, 90, 86, 0.07)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.93rem" }}>
          <span style={spinnerStyle} />
          Pipeline — {stageName(progress.currentStage)}
        </div>
        <span
          style={{
            fontSize: "0.76rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: isConnected ? "var(--ok)" : "var(--muted)",
          }}
        >
          {isConnected ? "● Live" : progress.isComplete ? "Done" : "● Reconnecting…"}
        </span>
      </div>

      {/* Progress stats */}
      {(progress.stats.total || progress.assetProgress.total > 0) && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          {progress.stats.total != null && (
            <span>📦 {progress.stats.total} asset{progress.stats.total !== 1 ? "s" : ""}</span>
          )}
          {progress.stats.processed != null && (
            <span>✓ {progress.stats.processed} processed</span>
          )}
          {progress.stats.failed != null && progress.stats.failed > 0 && (
            <span style={{ color: "var(--warn)" }}>✗ {progress.stats.failed} failed</span>
          )}
        </div>
      )}

      {/* Asset progress bar */}
      {progress.assetProgress.total > 0 && !progress.isComplete && (
        <div>
          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: "rgba(29, 26, 23, 0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 99,
                background: "var(--accent)",
                width: `${Math.round((progress.assetProgress.current / progress.assetProgress.total) * 100)}%`,
                transition: "width 400ms ease",
              }}
            />
          </div>
          <div style={{ marginTop: 4, fontSize: "0.78rem", color: "var(--muted)" }}>
            {progress.assetProgress.current} / {progress.assetProgress.total} assets
          </div>
        </div>
      )}

      {/* Error */}
      {progress.error && (
        <div className="alert warn" style={{ fontSize: "0.85rem", wordBreak: "break-word" }}>
          {progress.error}
        </div>
      )}

      {/* Last few log lines */}
      {progress.logs.length > 0 && (
        <details style={{ fontSize: "0.8rem" }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)", fontWeight: 700, userSelect: "none" }}>
            Logs ({progress.logs.length})
          </summary>
          <div
            style={{
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(29, 26, 23, 0.04)",
              border: "1px solid var(--line)",
              fontFamily: "var(--mono)",
              fontSize: "0.78rem",
              lineHeight: 1.65,
              maxHeight: 200,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {progress.logs.slice(-30).join("\n")}
          </div>
        </details>
      )}
    </div>
  );
}

export default function VersionPage() {
  const params = useParams<{ id: string; versionId: string }>();
  const datasetId = params?.id;
  const versionId = params?.versionId;
  const { user, loading } = useSessionUser();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Find the most recently running/queued job to track live
  const activeJob = jobs.find((j) => ["running", "queued"].includes(j.status));

  useEffect(() => {
    async function load() {
      if (!user || !datasetId || !versionId) {
        return;
      }
      try {
        const assetsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`);
        const jobsResult = await apiGet(`/datasets/${datasetId}/versions/${versionId}/jobs`);
        setAssets(assetsResult || []);
        setJobs(jobsResult || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load version data");
      }
    }
    load();
  }, [datasetId, versionId, user]);

  if (!loading && !user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to access this version.</div>
      </main>
    );
  }

  return (
    <main className="grid" style={{ gap: 24 }}>
      {error && <section className="alert warn">{error}</section>}

      {datasetId && versionId && (
        <VersionActions datasetId={datasetId} versionId={versionId} />
      )}

      {/* Live pipeline tracker — shown whenever any job was recorded for this version */}
      {jobs.length > 0 && (
        <section className="card" style={{ gap: 16, display: "grid" }}>
          <div className="section-title" style={{ fontSize: "1.2rem" }}>Pipeline Status</div>

          {/* Active job panel with live WebSocket updates */}
          {activeJob && (
            <ActiveJobPanel key={activeJob.id} jobId={activeJob.id} />
          )}

          {/* Job history table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.type}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: statusColor(j.status),
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: statusColor(j.status),
                            display: "inline-block",
                          }}
                        />
                        {stageName(j.status)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(j.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <div className="section-title" style={{ fontSize: "1.2rem" }}>Assets</div>
        {assets.length === 0 ? (
          <div className="muted">No assets yet. Add data and run the pipeline.</div>
        ) : (
          <div className="table-container">
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
                    <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span title={a.uri}>{a.uri}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{a.media_type}</td>
                    <td style={{ color: statusColor(a.status), fontWeight: 600 }}>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-title" style={{ fontSize: "1.2rem" }}>Labeling</div>
        <a className="btn secondary" href={`/label/${datasetId}/${versionId}`}>Open Labeling UI</a>
      </section>
    </main>
  );
}
