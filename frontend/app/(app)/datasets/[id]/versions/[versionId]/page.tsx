"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/components/api";
import { useSessionUser } from "@/components/session";
import VersionActions from "@/components/VersionActions";
import { useJobWebSocket } from "@/components/useJobWebSocket";
import PageLoader from "@/components/PageLoader";

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

function stageName(stage: string): string {
  const map: Record<string, string> = {
    waiting: "Waiting",
    queued: "Queued — starting shortly",
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

function statusColor(stage: string): string {
  if (["completed", "processed"].includes(stage)) return "var(--ok)";
  if (["failed", "error"].includes(stage)) return "var(--warn)";
  if (["ingesting", "processing", "eda_generating", "exporting", "running"].includes(stage))
    return "#d97706";
  if (stage === "queued") return "#6366f1";
  return "var(--muted)";
}

// ─── Animated orbital spinner ───────────────────────────────────
function Spinner({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: `2px solid ${color}33`,
        borderTopColor: color,
        animation: "spin 0.8s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Active job panel ────────────────────────────────────────────
function ActiveJobPanel({ jobId, dbStatus }: { jobId: string; dbStatus: string }) {
  const { isConnected, progress } = useJobWebSocket(jobId);

  // If the WS hasn't received events yet, fall back to the DB status
  const displayStage =
    progress.currentStage === "waiting" && dbStatus !== "waiting"
      ? dbStatus
      : progress.currentStage;

  const isActive = !["completed", "processed", "failed", "error"].includes(displayStage);
  const dotColor = statusColor(displayStage);

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          padding: "20px 24px",
          borderRadius: 20,
          border: `1px solid ${dotColor}33`,
          background: `${dotColor}08`,
          display: "grid",
          gap: 16,
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: "0.95rem" }}>
            {isActive ? (
              <Spinner color={dotColor} />
            ) : (
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: dotColor,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            )}
            Pipeline — {stageName(displayStage)}
          </div>
          <span
            style={{
              fontSize: "0.74rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: isConnected ? "var(--ok)" : progress.isComplete ? "var(--muted)" : "#6366f1",
            }}
          >
            {isConnected
              ? "● Live"
              : progress.isComplete
              ? "Done"
              : isActive
              ? "● Connecting…"
              : ""}
          </span>
        </div>

        {/* Queued notice */}
        {displayStage === "queued" && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(99,102,241,0.07)",
              border: "1px solid rgba(99,102,241,0.18)",
              fontSize: "0.86rem",
              color: "#4f46e5",
              fontWeight: 600,
            }}
          >
            The pipeline has been queued and will start automatically. This page will update in real-time once processing begins.
          </div>
        )}

        {/* Asset progress stats */}
        {(progress.stats.total || progress.assetProgress.total > 0) && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.86rem", color: "var(--ink-soft)" }}>
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

        {/* Progress bar (shown during asset processing) */}
        {progress.assetProgress.total > 0 && !progress.isComplete && (
          <div>
            <div
              style={{
                height: 8,
                borderRadius: 99,
                background: "rgba(29,26,23,0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 99,
                  background: dotColor,
                  width: `${Math.round(
                    (progress.assetProgress.current / progress.assetProgress.total) * 100
                  )}%`,
                  transition: "width 400ms ease",
                }}
              />
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: "0.8rem",
                color: "var(--muted)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>
                {progress.assetProgress.current} / {progress.assetProgress.total} assets
              </span>
              <span>
                {Math.round(
                  (progress.assetProgress.current / progress.assetProgress.total) * 100
                )}%
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {progress.error && (
          <div className="alert warn" style={{ fontSize: "0.85rem", wordBreak: "break-word" }}>
            {progress.error}
          </div>
        )}

        {/* Stage log */}
        {progress.logs.length > 0 && (
          <details style={{ fontSize: "0.8rem" }}>
            <summary
              style={{
                cursor: "pointer",
                color: "var(--muted)",
                fontWeight: 700,
                userSelect: "none",
                listStyle: "none",
              }}
            >
              <span>▸ Logs ({progress.logs.length})</span>
            </summary>
            <div
              style={{
                marginTop: 8,
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(29,26,23,0.04)",
                border: "1px solid var(--line)",
                fontFamily: "var(--mono)",
                fontSize: "0.78rem",
                lineHeight: 1.65,
                maxHeight: 240,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {progress.logs.slice(-50).join("\n")}
            </div>
          </details>
        )}
      </div>
    </>
  );
}

// ─── Stage pipeline steps ────────────────────────────────────────
const STAGES = [
  { key: "ingesting", label: "Ingest" },
  { key: "processing", label: "Process" },
  { key: "eda_generating", label: "EDA" },
  { key: "exporting", label: "Export" },
  { key: "processed", label: "Done" },
];

function stageIndex(status: string): number {
  return STAGES.findIndex((s) => s.key === status);
}

function PipelineSteps({ status }: { status: string }) {
  const current = stageIndex(status);
  const isFailed = status === "failed";
  if (["queued", "draft", "waiting", "running"].includes(status)) return null;
  return (
    <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
      {STAGES.map((s, i) => {
        const done = current > i;
        const active = current === i;
        const failed = isFailed && active;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < STAGES.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: failed
                    ? "var(--warn)"
                    : done || active
                    ? statusColor(s.key)
                    : "var(--line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: done || active ? "#fff" : "var(--muted)",
                  transition: "background 400ms ease",
                }}
              >
                {done ? "✓" : failed ? "✗" : i + 1}
              </div>
              <span style={{ fontSize: "0.7rem", color: active ? statusColor(s.key) : "var(--muted)", fontWeight: active ? 700 : 400, whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: done ? statusColor(s.key) : "var(--line)",
                  margin: "0 4px",
                  marginBottom: 20,
                  transition: "background 400ms ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────
export default function VersionPage() {
  const params = useParams<{ id: string; versionId: string }>();
  const datasetId = params?.id;
  const versionId = params?.versionId;
  const { user, loading: authLoading } = useSessionUser();

  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [versionStatus, setVersionStatus] = useState<string>("draft");
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const activeJob = (jobs ?? []).find((j) =>
    ["running", "queued"].includes(j.status)
  );

  // Initial load
  useEffect(() => {
    if (!user || !datasetId || !versionId) return;
    Promise.all([
      apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`),
      apiGet(`/datasets/${datasetId}/versions/${versionId}/jobs`),
      apiGet(`/datasets/${datasetId}/versions`),
    ])
      .then(([assetsResult, jobsResult, versions]) => {
        setAssets(assetsResult || []);
        setJobs(jobsResult || []);
        const v = (versions || []).find((v: { id: string }) => v.id === versionId);
        if (v) setVersionStatus(v.status);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load version data");
        setAssets([]);
        setJobs([]);
      });
  }, [datasetId, versionId, user]);

  // Live polling — runs whenever there's an active (queued/running) job
  const poll = useCallback(async () => {
    if (!datasetId || !versionId) return;
    try {
      const [jobsResult, versions, assetsResult] = await Promise.all([
        apiGet(`/datasets/${datasetId}/versions/${versionId}/jobs`),
        apiGet(`/datasets/${datasetId}/versions`),
        apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`),
      ]);
      const updatedJobs: Job[] = jobsResult || [];
      const v = (versions || []).find((v: { id: string }) => v.id === versionId);
      setJobs(updatedJobs);
      setAssets(assetsResult || []);
      if (v) setVersionStatus(v.status);

      // Stop polling once all jobs are terminal
      const hasActive = updatedJobs.some((j) => ["running", "queued"].includes(j.status));
      if (!hasActive) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch {
      // silently ignore poll errors
    }
  }, [datasetId, versionId]);

  // Start/stop polling based on whether there's an active job
  useEffect(() => {
    if (jobs === null) return; // not yet loaded

    const hasActive = (jobs ?? []).some((j) => ["running", "queued"].includes(j.status));
    if (hasActive && !pollingRef.current) {
      // Poll every 3 seconds
      pollingRef.current = setInterval(poll, 3000);
    } else if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobs, poll]);

  if (authLoading) return <PageLoader />;

  if (!user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to access this version.</div>
      </main>
    );
  }

  if (assets === null || jobs === null) return <PageLoader />;

  const terminalJobs = (jobs ?? []).filter((j) =>
    ["completed", "failed"].includes(j.status)
  );

  return (
    <main className="grid fade-up" style={{ gap: 24 }}>
      {error && <section className="alert warn">{error}</section>}

      {datasetId && versionId && (
        <VersionActions datasetId={datasetId} versionId={versionId} />
      )}

      {/* Pipeline section — shown whenever any jobs exist */}
      {jobs.length > 0 && (
        <section className="card" style={{ gap: 20, display: "grid" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div className="section-title" style={{ fontSize: "1.1rem", margin: 0 }}>
              Pipeline Status
            </div>
            <a
              href={`/datasets/${datasetId}/curate/${versionId}`}
              className="btn ghost small"
              style={{ fontSize: "0.8rem" }}
            >
              Open Curation →
            </a>
          </div>

          {/* Stage steps (visible once pipeline has moved beyond queued) */}
          <PipelineSteps status={versionStatus} />

          {/* Active job tracker */}
          {activeJob && (
            <ActiveJobPanel
              key={activeJob.id}
              jobId={activeJob.id}
              dbStatus={activeJob.status}
            />
          )}

          {/* Job history */}
          {terminalJobs.length > 0 && (
            <details style={{ fontSize: "0.82rem" }}>
              <summary style={{ cursor: "pointer", color: "var(--muted)", fontWeight: 700, userSelect: "none" }}>
                Past runs ({terminalJobs.length})
              </summary>
              <div className="table-container" style={{ marginTop: 10 }}>
                <table className="table">
                  <thead>
                    <tr><th>Type</th><th>Status</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {terminalJobs.map((j) => (
                      <tr key={j.id}>
                        <td>{j.type}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "0.85rem", color: statusColor(j.status) }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor(j.status), display: "inline-block" }} />
                            {stageName(j.status)}
                          </span>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{new Date(j.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      )}

      {/* Assets */}
      <section className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <div className="section-title" style={{ fontSize: "1.1rem", margin: 0 }}>
            Assets {assets.length > 0 && <span className="badge" style={{ marginLeft: 8 }}>{assets.length}</span>}
          </div>
          {assets.length > 0 && (
            <div style={{ display: "flex", gap: 8, fontSize: "0.78rem", color: "var(--muted)", flexWrap: "wrap" }}>
              {Object.entries(
                assets.reduce<Record<string, number>>((acc, a) => {
                  acc[a.status] = (acc[a.status] || 0) + 1;
                  return acc;
                }, {})
              ).map(([status, count]) => (
                <span key={status} style={{ color: statusColor(status), fontWeight: 700 }}>
                  {count} {status}
                </span>
              ))}
            </div>
          )}
        </div>

        {assets.length === 0 ? (
          <div className="muted">No assets yet. Add data and run the pipeline.</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>URI</th><th>Type</th><th>Status</th></tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span title={a.uri}>{a.uri}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{a.media_type}</td>
                    <td>
                      <span style={{ color: statusColor(a.status), fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor(a.status), display: "inline-block" }} />
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-title" style={{ fontSize: "1.1rem" }}>Labeling</div>
        <a className="btn secondary" href={`/label/${datasetId}/${versionId}`}>Open Labeling UI</a>
      </section>
    </main>
  );
}
