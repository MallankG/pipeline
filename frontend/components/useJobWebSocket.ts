"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiGet } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type WebSocketMessage =
  | {
      type: "progress";
      job_id: string;
      stage: string;
      message: string;
      timestamp: number;
      progress: Record<string, any>;
    }
  | {
      type: "asset_update";
      job_id: string;
      asset_id: string;
      status: string;
      metadata: Record<string, any>;
      timestamp: number;
    }
  | {
      type: "stage_complete";
      job_id: string;
      stage: string;
      stats: Record<string, any>;
      timestamp: number;
    }
  | {
      type: "error";
      job_id: string;
      error: string;
      stage?: string;
      timestamp: number;
    }
  | {
      type: "completed";
      job_id: string;
      stats: Record<string, any>;
      timestamp: number;
    };

export interface JobProgress {
  currentStage: string;
  logs: string[];
  assetProgress: {
    current: number;
    total: number;
    currentAssetId?: string;
    currentAssetStatus?: string;
  };
  stats: {
    ingested?: number;
    processed?: number;
    failed?: number;
    total?: number;
  };
  isComplete: boolean;
  error?: string;
}

// Fetch the latest job status from the DB REST API (used on reconnect / page load)
async function fetchJobStatus(jobId: string): Promise<{ status: string; logs?: string } | null> {
  try {
    return await apiGet(`/jobs/${jobId}`);
  } catch {
    return null;
  }
}

export function useJobWebSocket(jobId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<JobProgress>({
    currentStage: "waiting",
    logs: [],
    assetProgress: { current: 0, total: 0 },
    stats: {},
    isComplete: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  // Hydrate state from DB on initial load / reconnect so closed-tab scenario works
  const hydrateFromDB = useCallback(async () => {
    if (!jobId) return;
    const job = await fetchJobStatus(jobId);
    if (!job) return;

    if (job.status === "completed") {
      const dbLogs = job.logs ? job.logs.split("\n").filter(Boolean) : [];
      setProgress((prev) => ({
        ...prev,
        currentStage: "completed",
        isComplete: true,
        logs: dbLogs.length > 0 ? dbLogs : prev.logs,
      }));
      return; // already done — skip WS
    }

    if (job.status === "failed") {
      const dbLogs = job.logs ? job.logs.split("\n").filter(Boolean) : [];
      setProgress((prev) => ({
        ...prev,
        currentStage: "failed",
        isComplete: true,
        error: "Pipeline failed — check logs for details",
        logs: dbLogs.length > 0 ? dbLogs : prev.logs,
      }));
      return;
    }

    // Job is queued or running — set stage from DB and open WS
    if (job.status === "queued" || job.status === "running") {
      setProgress((prev) => ({
        ...prev,
        currentStage: job.status, // "queued" or "running"
      }));
      // WS will connect in the caller; just return here
    }
  }, [jobId]);


  const connect = useCallback(() => {
    if (!jobId) return;

    // Don't reconnect if already complete
    setProgress((prev) => {
      if (prev.isComplete) return prev;

      const wsUrl = API_BASE.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsUrl}/ws/jobs/${jobId}`);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          setProgress((prev) => {
            const newLogs = [...prev.logs];
            if (data.type === "progress" || data.type === "error") {
              newLogs.push(`[${(data as any).stage || "system"}] ${(data as any).message || (data as any).error}`);
            }

            switch (data.type) {
              case "progress": {
                return {
                  ...prev,
                  currentStage: data.stage,
                  logs: newLogs.slice(-100),
                  stats: {
                    ...prev.stats,
                    ...data.progress,
                  },
                };
              }
              case "asset_update": {
                const current = data.metadata.index || prev.assetProgress.current;
                const total = data.metadata.total || prev.assetProgress.total;
                return {
                  ...prev,
                  currentStage: "processing",
                  logs: newLogs.slice(-100),
                  assetProgress: {
                    current,
                    total,
                    currentAssetId: data.asset_id,
                    currentAssetStatus: data.status,
                  },
                  stats: {
                    ...prev.stats,
                    processed: data.metadata.progress_pct
                      ? Math.round((data.metadata.progress_pct / 100) * total)
                      : prev.stats.processed,
                  },
                };
              }
              case "stage_complete": {
                if (data.stage === "ingesting") {
                  return {
                    ...prev,
                    logs: newLogs.slice(-100),
                    stats: {
                      ...prev.stats,
                      ingested: data.stats.assets_ingested,
                      total: data.stats.assets_ingested,
                    },
                  };
                }
                if (data.stage === "processing") {
                  return {
                    ...prev,
                    logs: newLogs.slice(-100),
                    stats: {
                      ...prev.stats,
                      processed: data.stats.processed,
                      failed: data.stats.failed,
                    },
                  };
                }
                return {
                  ...prev,
                  logs: newLogs.slice(-100),
                };
              }
              case "completed": {
                // Pipeline finished successfully — close WS and mark done
                ws.close();
                return {
                  ...prev,
                  currentStage: "completed",
                  logs: [...newLogs, "[system] Pipeline completed successfully"].slice(-100),
                  stats: {
                    ...prev.stats,
                    ...data.stats,
                  },
                  isComplete: true,
                };
              }
              case "error": {
                return {
                  ...prev,
                  currentStage: data.stage || "error",
                  logs: newLogs.slice(-100),
                  error: data.error,
                  isComplete: true,
                };
              }
              default:
                return prev;
            }
          });
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Exponential backoff: 3s, 6s, 12s, max 30s
        const delay = Math.min(3000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          setProgress((prev) => {
            if (!prev.isComplete) {
              connect();
            }
            return prev;
          });
        }, delay);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      };

      wsRef.current = ws;
      return prev;
    });
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    // First hydrate from DB (handles the "page was closed" scenario)
    hydrateFromDB().then(() => {
      // Then open WS only if job is still in-progress
      setProgress((prev) => {
        if (!prev.isComplete) {
          connect();
        }
        return prev;
      });
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const markComplete = useCallback(() => {
    setProgress((prev) => ({ ...prev, isComplete: true }));
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  return { isConnected, progress, markComplete };
}
