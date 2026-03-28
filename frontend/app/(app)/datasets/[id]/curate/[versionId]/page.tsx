"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost } from "@/components/api";
import { useSessionUser } from "@/components/session";
import { useJobWebSocket } from "@/components/useJobWebSocket";
import PageLoader from "@/components/PageLoader";

type Dataset = { id: string; name: string; data_types: string[] };
type Version = { id: string; status: string; version: number };
type Asset = { id: string; uri: string; media_type: string; status: string };
type Source = { id: string; source_type: string; source_uri: string; created_at: string };
type Job = { id: string; status: string };

// ─── Stage definitions ────────────────────────────────────────────────────────
// Each stage knows: how to derive its % from asset data, and its "active" key
type StageConfig = {
  label: string;
  detail: string;
  stageKey: string; // matches version.status / progress.currentStage
  icon: string;
  // Returns 0–100 or null (indeterminate) given live asset data
  getProgress: (assets: Asset[], wsProgress: { current: number; total: number }) => number | null;
};

const STAGE_CONFIGS: StageConfig[] = [
  {
    label: "Ingest",
    stageKey: "ingesting",
    icon: "↓",
    detail: "Pulling raw data from connected sources",
    getProgress: (assets) => {
      // Indeterminate during ingest itself; once done, asset count shows registered
      if (assets.length === 0) return null;
      const registered = assets.filter((a) => a.status !== "failed").length;
      return Math.min(100, (registered / assets.length) * 100);
    },
  },
  {
    label: "Validate & Process",
    stageKey: "processing",
    icon: "⚙",
    detail: "Schema checks, cleaning, and structuring outputs",
    getProgress: (assets, ws) => {
      // WebSocket gives precise per-asset progress
      if (ws.total > 0) return Math.round((ws.current / ws.total) * 100);
      // Fall back to DB asset counts
      const done = assets.filter((a) => ["processed", "failed"].includes(a.status)).length;
      const total = assets.length;
      if (total === 0) return null;
      return Math.round((done / total) * 100);
    },
  },
  {
    label: "EDA",
    stageKey: "eda_generating",
    icon: "📊",
    detail: "Generating summary statistics across all assets",
    getProgress: () => null, // always indeterminate
  },
  {
    label: "Export",
    stageKey: "exporting",
    icon: "📦",
    detail: "Building final manifest and uploading artefacts",
    getProgress: () => null, // always indeterminate
  },
];

// Map version status → stage index (which stage is ACTIVE)
function getActiveStageIndex(vStatus: string, wsStage: string): number {
  const stage = wsStage !== "waiting" ? wsStage : vStatus;
  if (stage === "ingesting") return 0;
  if (stage === "processing") return 1;
  if (stage === "eda_generating") return 2;
  if (stage === "exporting") return 3;
  if (stage === "processed" || stage === "completed") return 4; // past all stages
  return -1;
}

// ─── Stage progress bar ───────────────────────────────────────────────────────
function StageBar({
  pct,
  active,
  done,
  failed,
}: {
  pct: number | null;
  active: boolean;
  done: boolean;
  failed: boolean;
}) {
  const color = failed
    ? "#ef4444"
    : done
    ? "var(--ok, #22c55e)"
    : active
    ? "var(--accent-strong, #4e5a56)"
    : "var(--line, #e5e0d8)";

  const barWidth = done ? 100 : pct ?? 0;

  return (
    <>
      <style>{`
        @keyframes stripe-scroll {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
        @keyframes stage-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: "rgba(29,26,23,0.07)",
          overflow: "hidden",
          marginTop: 10,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 99,
            width: `${barWidth}%`,
            minWidth: active || done ? 6 : 0,
            transition: "width 600ms ease",
            background:
              active && pct === null
                ? // Indeterminate — animated diagonal stripe
                  `repeating-linear-gradient(
                    90deg,
                    ${color} 0px,
                    ${color} 20px,
                    ${color}88 20px,
                    ${color}88 40px
                  )`
                : color,
            backgroundSize: active && pct === null ? "40px 100%" : undefined,
            animation:
              active && pct === null ? "stripe-scroll 0.8s linear infinite" : undefined,
          }}
        />
      </div>
    </>
  );
}

// ─── Stage card ───────────────────────────────────────────────────────────────
function StageCard({
  config,
  activeIdx,
  myIdx,
  assets,
  wsAssetProgress,
  totalStages,
  failed,
}: {
  config: StageConfig;
  activeIdx: number;
  myIdx: number;
  assets: Asset[];
  wsAssetProgress: { current: number; total: number };
  totalStages: number;
  failed: boolean;
}) {
  const isDone = myIdx < activeIdx;
  const isActive = myIdx === activeIdx;
  const isFailed = isActive && failed;
  const isPending = myIdx > activeIdx;

  // Compute % for this stage
  const pct =
    isActive && !isFailed
      ? config.getProgress(assets, wsAssetProgress)
      : isDone
      ? 100
      : null;

  const borderColor = isFailed
    ? "#ef444466"
    : isActive
    ? "rgba(78,90,86,0.45)"
    : isDone
    ? "rgba(34,197,94,0.35)"
    : undefined;

  const bg = isFailed
    ? "rgba(239,68,68,0.04)"
    : isActive
    ? "rgba(78,90,86,0.04)"
    : isDone
    ? "rgba(34,197,94,0.03)"
    : undefined;

  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 20,
        border: `1.5px solid ${borderColor ?? "var(--line)"}`,
        background: bg ?? "rgba(255,255,255,0.5)",
        display: "grid",
        gap: 4,
        position: "relative",
        overflow: "hidden",
        transition: "border-color 500ms ease, background 500ms ease",
      }}
    >
      {/* Completed tick */}
      {isDone && !isFailed && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            fontSize: "0.8rem",
            color: "var(--ok, #22c55e)",
            fontWeight: 700,
          }}
        >
          ✓
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: isFailed
              ? "rgba(239,68,68,0.12)"
              : isActive
              ? "rgba(78,90,86,0.1)"
              : isDone
              ? "rgba(34,197,94,0.1)"
              : "rgba(29,26,23,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.85rem",
            flexShrink: 0,
          }}
        >
          {isFailed ? "✗" : isDone ? "✓" : config.icon}
        </span>
        <span
          style={{
            fontWeight: 700,
            fontSize: "0.9rem",
            color: isPending ? "var(--muted)" : "var(--ink)",
          }}
        >
          {config.label}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: isFailed
              ? "#ef4444"
              : isActive
              ? "var(--accent-strong)"
              : isDone
              ? "var(--ok, #22c55e)"
              : "var(--muted)",
          }}
        >
          {isFailed
            ? "Failed"
            : isActive
            ? pct !== null
              ? `${Math.round(pct)}%`
              : "Running…"
            : isDone
            ? "Done"
            : `${myIdx + 1}/${totalStages}`}
        </span>
      </div>

      <div
        style={{
          fontSize: "0.8rem",
          color: "var(--muted)",
          lineHeight: 1.4,
          paddingLeft: 36,
        }}
      >
        {config.detail}
      </div>

      <div style={{ paddingLeft: 0 }}>
        <StageBar
          pct={pct}
          active={isActive}
          done={isDone}
          failed={isFailed}
        />
        {/* show numeric label for determinate bars */}
        {isActive && pct !== null && (
          <div
            style={{
              marginTop: 4,
              fontSize: "0.72rem",
              color: "var(--muted)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            {config.stageKey === "processing" && wsAssetProgress.total > 0 ? (
              <>
                <span>
                  {wsAssetProgress.current} / {wsAssetProgress.total} assets
                </span>
                <span>{Math.round(pct)}%</span>
              </>
            ) : (
              <>
                <span>{assets.filter((a) => ["processed", "failed"].includes(a.status)).length}/{assets.length} assets</span>
                <span>{Math.round(pct)}%</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CuratePage() {
  const params = useParams<{ id: string; versionId: string }>();
  const datasetId = params?.id;
  const versionId = params?.versionId;
  const { user, loading: authLoading } = useSessionUser();

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [version, setVersion] = useState<Version | null | undefined>(undefined);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const { isConnected, progress } = useJobWebSocket(activeJobId);

  // Initial full load
  useEffect(() => {
    if (!user || !datasetId || !versionId) return;
    async function load() {
      const [ds, assetsResult, sourcesResult, versions, jobsResult] = await Promise.all([
        apiGet(`/datasets/${datasetId}`),
        apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`),
        apiGet(`/datasets/${datasetId}/versions/${versionId}/sources`),
        apiGet(`/datasets/${datasetId}/versions`),
        apiGet(`/datasets/${datasetId}/versions/${versionId}/jobs`),
      ]);
      const currentV = versions?.find((v: Version) => v.id === versionId) ?? null;
      // Connect to WS for running OR queued jobs
      const activeJob = jobsResult?.find((j: Job) => ["running", "queued"].includes(j.status));
      if (activeJob) setActiveJobId(activeJob.id);

      setDataset(ds);
      setVersion(currentV);
      setAssets(assetsResult || []);
      setSources(sourcesResult || []);
      setReady(true);
    }
    load();
  }, [datasetId, versionId, user]);

  async function startPipeline() {
    if (!datasetId || !versionId) return;
    try {
      const job = await apiPost(`/datasets/${datasetId}/versions/${versionId}/jobs`, { type: "PIPELINE_RUN" });
      await apiPost(`/jobs/${job.id}/run`, {});
      setActiveJobId(job.id);
      setVersion((prev) => prev ? { ...prev, status: "ingesting" } : prev);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to start pipeline");
    }
  }

  // REST polling — bridges the gap when WS is not connected
  useEffect(() => {
    if (!user || !datasetId || !versionId || !ready) return;
    const timer = setInterval(async () => {
      const [assetsResult, versions] = await Promise.all([
        apiGet(`/datasets/${datasetId}/versions/${versionId}/assets`),
        apiGet(`/datasets/${datasetId}/versions`),
      ]);
      const currentV = versions?.find((v: Version) => v.id === versionId);
      setAssets(assetsResult || []);
      setVersion(currentV ?? null);
      if (currentV?.status === "processed" || currentV?.status === "failed") {
        clearInterval(timer);
        setActiveJobId(null);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [datasetId, versionId, user, ready, activeJobId]);

  // Derive which stage is active
  const activeStageIdx = useMemo(
    () => getActiveStageIndex(version?.status ?? "draft", progress.currentStage),
    [version, progress.currentStage]
  );

  const isFailed = version?.status === "failed";
  const isComplete = version?.status === "processed" || progress.isComplete;
  const isActive = !!activeJobId && !isComplete;

  if (authLoading) return <PageLoader />;
  if (!user) {
    return (
      <main className="card">
        <div>Please <a href="/auth">sign in</a> to curate datasets.</div>
      </main>
    );
  }
  if (!ready || !dataset || assets === null) return <PageLoader />;

  const processedCount = assets.filter((a) => a.status === "processed").length;
  const failedCount = assets.filter((a) => a.status === "failed").length;

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <main className="grid fade-up" style={{ gap: 20 }}>
        {/* ── Header card ── */}
        <section className="card">
          <div className="toolbar">
            <div>
              <div className="page-title" style={{ paddingBottom: 8, lineHeight: 1.1 }}>Curating {dataset.name}</div>
              <div className="muted" style={{ marginTop: 8, fontSize: "0.95rem" }}>
                Version v{version?.version}
                {" · "}
                <span
                  style={{
                    color: isFailed
                      ? "#ef4444"
                      : isComplete
                      ? "var(--ok, #22c55e)"
                      : isActive
                      ? "#d97706"
                      : "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  {isFailed
                    ? "Failed"
                    : isComplete
                    ? "Complete"
                    : isActive
                    ? "Running"
                    : version?.status ?? "Draft"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Live WS indicator */}
              {isActive && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: isConnected ? "var(--ok, #22c55e)" : "#d97706", fontWeight: 700 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: isConnected ? "var(--ok, #22c55e)" : "#d97706",
                      display: "inline-block",
                      animation: "pulse-dot 2s ease-in-out infinite",
                    }}
                  />
                  {isConnected ? "Live" : "Polling…"}
                </div>
              )}
              {(!isActive && assets && assets.length > 0) && (
                <button 
                   onClick={startPipeline} 
                   className="btn secondary" 
                   style={{ padding: '6px 12px', fontSize: '14px', marginLeft: '8px' }}>
                   {isComplete || isFailed ? "↺ Redo Pipeline" : "▶ Run Pipeline"}
                </button>
              )}
              <div className="chip-group">
                {(dataset.data_types || []).map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Overall summary strip */}
          {assets.length > 0 && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
                padding: "12px 16px",
                borderRadius: 14,
                background: "rgba(29,26,23,0.03)",
                border: "1px solid var(--line)",
                fontSize: "0.86rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>
                📦 <strong style={{ color: "var(--ink)" }}>{assets.length}</strong> total assets
              </span>
              {processedCount > 0 && (
                <span style={{ color: "var(--ok, #22c55e)" }}>
                  ✓ <strong>{processedCount}</strong> processed
                </span>
              )}
              {progress.assetProgress.total > 0 && (
                <span style={{ color: "#d97706" }}>
                  ⚙ <strong>{progress.assetProgress.current}</strong>/{progress.assetProgress.total} via live feed
                </span>
              )}
              {failedCount > 0 && (
                <span style={{ color: "#ef4444" }}>
                  ✗ <strong>{failedCount}</strong> failed
                </span>
              )}
            </div>
          )}

          {/* Error/complete banner */}
          {(isFailed || isComplete || progress.error) && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 16px",
                borderRadius: 12,
                background: isFailed || progress.error
                  ? "rgba(239,68,68,0.07)"
                  : "rgba(34,197,94,0.07)",
                border: `1px solid ${isFailed || progress.error ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
                color: isFailed || progress.error ? "#ef4444" : "var(--ok, #22c55e)",
                fontWeight: 600,
                fontSize: "0.88rem",
              }}
            >
              {progress.error
                ? `⚠ ${progress.error}`
                : isFailed
                ? "⚠ Curation failed — check logs below"
                : "✓ Curation complete!"}
            </div>
          )}
        </section>

        {/* ── Per-stage progress cards ── */}
        <section className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div className="section-title" style={{ margin: 0, fontSize: "1rem" }}>
              Pipeline progress
            </div>
            {isActive && activeStageIdx >= 0 && (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}
              >
                Step {activeStageIdx + 1} of {STAGE_CONFIGS.length}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {STAGE_CONFIGS.map((cfg, idx) => (
              <StageCard
                key={cfg.stageKey}
                config={cfg}
                activeIdx={activeStageIdx}
                myIdx={idx}
                assets={assets}
                wsAssetProgress={progress.assetProgress}
                totalStages={STAGE_CONFIGS.length}
                failed={isFailed}
              />
            ))}
          </div>
        </section>

        {/* ── Live log terminal ── */}
        {progress.logs.length > 0 && (
          <section className="card">
            <div
              className="section-title"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span>Processing Logs</span>
              {isConnected && (
                <span
                  className="badge"
                  style={{ background: "var(--ok, #22c55e)", color: "white" }}
                >
                  Live
                </span>
              )}
            </div>
            <div
              style={{
                background: "#1a1a1a",
                color: "#e5e7eb",
                padding: "14px 16px",
                borderRadius: 14,
                fontFamily: "var(--mono, monospace)",
                fontSize: "0.78rem",
                lineHeight: 1.7,
                maxHeight: 280,
                overflow: "auto",
              }}
            >
              {progress.logs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: 2, opacity: idx < progress.logs.length - 5 ? 0.6 : 1 }}>
                  <span style={{ color: "#6b7280", marginRight: 8 }}>{String(idx + 1).padStart(3, "0")}</span>
                  {log}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Connected Sources ── */}
        <section className="card">
          <div className="section-title">Connected Sources</div>
          <div className="grid">
            {sources.length === 0 && <div className="muted">No sources connected yet.</div>}
            {sources.map((s) => (
              <div key={s.id} className="stat">
                <strong>{s.source_type}</strong>
                <div>{s.source_uri}</div>
                <div style={{ fontSize: 12, color: "#6a625a" }}>
                  Added {new Date(s.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Assets table ── */}
        <section className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div className="section-title" style={{ margin: 0 }}>
              Incoming Assets ({assets.length})
            </div>
            {assets.length > 0 && (
              <div style={{ display: "flex", gap: 8, fontSize: "0.78rem", flexWrap: "wrap" }}>
                {Object.entries(
                  assets.reduce<Record<string, number>>((acc, a) => {
                    acc[a.status] = (acc[a.status] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([status, count]) => (
                  <span
                    key={status}
                    style={{
                      fontWeight: 700,
                      color:
                        status === "processed"
                          ? "var(--ok, #22c55e)"
                          : status === "failed"
                          ? "#ef4444"
                          : status === "processing"
                          ? "#d97706"
                          : "var(--muted)",
                    }}
                  >
                    {count} {status}
                  </span>
                ))}
              </div>
            )}
          </div>

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
                  <td
                    style={{
                      maxWidth: 320,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={decodeURIComponent(a.uri.split('/').pop() || a.uri)}
                  >
                    {decodeURIComponent(a.uri.split('/').pop() || a.uri)}
                  </td>
                  <td>{a.media_type}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        color:
                          a.status === "processed"
                            ? "var(--ok, #22c55e)"
                            : a.status === "failed"
                            ? "#ef4444"
                            : a.status === "processing"
                            ? "#d97706"
                            : "var(--muted)",
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background:
                            a.status === "processed"
                              ? "var(--ok, #22c55e)"
                              : a.status === "failed"
                              ? "#ef4444"
                              : a.status === "processing"
                              ? "#d97706"
                              : "var(--line)",
                          display: "inline-block",
                          animation:
                            a.status === "processing"
                              ? "pulse-dot 1.2s ease-in-out infinite"
                              : undefined,
                        }}
                      />
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No assets yet. Add data from the version page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }} className="inline-actions">
            <a className="btn secondary" href={`/datasets/${datasetId}/eda/${versionId}`}>
              View EDA
            </a>
            <a className="btn" href={`/datasets/${datasetId}/final/${versionId}`}>
              Final Dataset
            </a>
            <a className="btn ghost" href={`/datasets/${datasetId}/query`}>
              Query Data
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
