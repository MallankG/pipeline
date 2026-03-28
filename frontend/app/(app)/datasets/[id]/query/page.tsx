"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost } from "@/components/api";
import { useSessionUser } from "@/components/session";
import PageLoader from "@/components/PageLoader";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sql?: string;
  rows?: Record<string, unknown>[];
  rowCount?: number;
  truncated?: boolean;
  error?: string;
  isLoading?: boolean;
}

type Dataset = { id: string; name: string; description?: string };
type Version  = { id: string; version: number; status: string };

// ─────────────────────────────────────────────
// Suggestion chips (dataset-specific)
// ─────────────────────────────────────────────
const SUGGESTIONS = [
  "How many assets are in this dataset?",
  "What are the different media types in this dataset?",
  "Show assets that failed processing",
  "How many assets per version?",
  "What jobs have run on this dataset?",
  "List the data sources connected to this dataset",
  "What is the status of each version?",
  "Show assets added in the last 7 days",
];

// ─────────────────────────────────────────────
// Result table
// ─────────────────────────────────────────────
function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows || rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div style={{ overflowX: "auto", marginTop: 12, borderRadius: 14, border: "1px solid var(--line)", background: "rgba(255,255,255,0.6)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ padding: "8px 12px", textAlign: "left", color: "var(--muted)", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(78,90,86,0.03)" }}>
              {cols.map((c) => (
                <td key={c} style={{ padding: "8px 12px", borderBottom: ri < rows.length - 1 ? "1px solid var(--line)" : "none", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-soft)" }} title={String(row[c] ?? "")}>
                  {row[c] === null
                    ? <span style={{ color: "var(--muted)", fontStyle: "italic" }}>null</span>
                    : typeof row[c] === "object"
                    ? JSON.stringify(row[c])
                    : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// SQL toggle
// ─────────────────────────────────────────────
function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen((x) => !x)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, border: "1px solid var(--line)", background: "rgba(255,255,255,0.5)", color: "var(--muted)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}>
        {open ? "▾" : "▸"} SQL
      </button>
      {open && (
        <pre style={{ marginTop: 8, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "rgba(29,26,23,0.04)", fontFamily: "var(--mono)", fontSize: "0.78rem", lineHeight: 1.65, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--ink)" }}>
          {sql}
        </pre>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Typing dots
// ─────────────────────────────────────────────
function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 12, alignItems: "flex-start" }}>
      <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", background: isUser ? "var(--accent-strong)" : "linear-gradient(135deg, rgba(78,90,86,0.2), rgba(78,90,86,0.08))", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700, color: isUser ? "#f7f4ee" : "var(--accent-strong)" }}>
        {isUser ? "U" : "AI"}
      </div>
      <div style={{ maxWidth: "75%", minWidth: 80, padding: "14px 18px", borderRadius: isUser ? "20px 4px 20px 20px" : "4px 20px 20px 20px", border: "1px solid var(--line)", background: isUser ? "var(--accent-strong)" : "rgba(255,255,255,0.82)", color: isUser ? "#f7f4ee" : "var(--ink)", backdropFilter: "blur(8px)", boxShadow: "0 4px 16px rgba(39,34,30,0.06)" }}>
        {msg.isLoading ? <TypingDots /> : (
          <>
            <div style={{ fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>
            {msg.error && (
              <div style={{ marginTop: 10, padding: "6px 10px", borderRadius: 10, background: "rgba(159,86,71,0.12)", border: "1px solid rgba(159,86,71,0.22)", color: "#8b4638", fontSize: "0.78rem", fontWeight: 600 }}>
                Error: {msg.error}
              </div>
            )}
            {msg.rowCount != null && msg.rowCount > 0 && (
              <div style={{ marginTop: 8, fontSize: "0.76rem", color: isUser ? "rgba(247,244,238,0.7)" : "var(--muted)", fontWeight: 700 }}>
                {msg.rowCount} row{msg.rowCount !== 1 ? "s" : ""}
                {msg.truncated && " · Results capped — refine your question for more specific data"}
              </div>
            )}
            {msg.rows && msg.rows.length > 0 && <ResultTable rows={msg.rows} />}
            {msg.sql && <SqlBlock sql={msg.sql} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function DatasetQueryPage() {
  const params = useParams<{ id: string }>();
  const datasetId = params?.id;
  const { user, loading: authLoading } = useSessionUser();

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [pageReady, setPageReady] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load dataset + versions
  useEffect(() => {
    if (!user || !datasetId) return;
    Promise.all([
      apiGet(`/datasets/${datasetId}`),
      apiGet(`/datasets/${datasetId}/versions`),
    ]).then(([ds, vs]) => {
      setDataset(ds);
      const sorted = (vs || []).sort((a: Version, b: Version) => b.version - a.version);
      setVersions(sorted);
      if (sorted.length > 0) setSelectedVersionId(sorted[0].id);
      setPageReady(true);
    });
  }, [datasetId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || isThinking || !dataset) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: question };
    const loadingMsg: ChatMessage = { role: "assistant", content: "", isLoading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsThinking(true);

    const history = messages
      .filter((m) => !m.isLoading)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await apiPost("/chat", {
        message: question,
        dataset_id: datasetId,
        dataset_name: dataset.name,
        version_id: selectedVersionId || null,
        history,
      });
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: res.answer ?? "No answer returned.",
        sql: res.sql,
        rows: res.rows,
        rowCount: res.row_count,
        truncated: res.truncated,
        error: res.error,
      };
      setMessages((prev) => [...prev.slice(0, -1), aiMsg]);
    } catch (err: unknown) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        error: "request_failed",
      };
      setMessages((prev) => [...prev.slice(0, -1), errMsg]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // --- Guard renders ---
  if (authLoading) return <PageLoader />;

  if (!user) {
    return (
      <main className="card fade-up" style={{ textAlign: "center", padding: "40px" }}>
        <p>Please <a href="/auth">sign in</a> to query this dataset.</p>
      </main>
    );
  }

  if (!pageReady || !dataset) return <PageLoader />;

  const isEmpty = messages.length === 0;

  return (
    <>
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .query-input-wrap:focus-within {
          border-color: rgba(78, 90, 86, 0.5) !important;
          box-shadow: 0 0 0 4px rgba(78, 90, 86, 0.1) !important;
        }
      `}</style>

      <main style={{ display: "grid", gridTemplateRows: "auto 1fr auto", height: "calc(100svh - 120px)", gap: 0, minHeight: 0 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "0 0 20px", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <a href={`/datasets/${datasetId}`} style={{ color: "var(--muted)", fontSize: "0.85rem", textDecoration: "none" }}>
                ← {dataset.name}
              </a>
            </div>
            <h1 style={{ margin: "4px 0 0", fontFamily: "var(--display)", fontSize: "clamp(1.4rem, 2.2vw, 2rem)", fontWeight: 600, letterSpacing: "-0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Query: {dataset.name}
            </h1>
            <div className="muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
              Ask questions about this dataset in plain English — the AI will translate to SQL and summarise the results.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
            {versions.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>Version scope:</label>
                <select
                  value={selectedVersionId}
                  onChange={(e) => {
                    setSelectedVersionId(e.target.value);
                    setMessages([]);
                  }}
                  style={{ fontSize: "0.85rem", padding: "6px 10px", borderRadius: 10 }}
                >
                  <option value="">All versions</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>v{v.version} — {v.status}</option>
                  ))}
                </select>
              </div>
            )}
            {!isEmpty && (
              <button className="btn ghost small" onClick={() => setMessages([])}>Clear chat</button>
            )}
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={{ overflowY: "auto", paddingRight: 4, scrollbarWidth: "thin" }}>
          {isEmpty ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 32, padding: "40px 20px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, margin: "0 auto 16px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(78,90,86,0.15), rgba(78,90,86,0.05))", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem" }}>
                  📊
                </div>
                <div style={{ fontFamily: "var(--display)", fontSize: "1.2rem", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>
                  Ask anything about <em>{dataset.name}</em>
                </div>
                <div className="muted" style={{ fontSize: "0.86rem" }}>
                  All queries are automatically scoped to this dataset.{selectedVersionId ? ` Filtering to the selected version.` : " Searching across all versions."}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 640 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{ padding: "9px 16px", borderRadius: 999, border: "1px solid var(--line)", background: "rgba(255,255,255,0.65)", color: "var(--ink-soft)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", transition: "transform 140ms ease, border-color 140ms ease" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(78,90,86,0.3)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)"; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 20, padding: "4px 0 16px" }}>
              {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input bar ── */}
        <div style={{ paddingTop: 16 }}>
          <div
            className="query-input-wrap"
            style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: "12px 14px", borderRadius: 24, border: "1px solid var(--line)", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(39,34,30,0.07)", transition: "border-color 180ms ease, box-shadow 180ms ease" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${dataset.name}… (Enter to send, Shift+Enter for new line)`}
              disabled={isThinking}
              rows={1}
              style={{ flex: 1, resize: "none", border: "none", background: "transparent", outline: "none", fontFamily: "var(--sans)", fontSize: "0.92rem", lineHeight: 1.55, color: "var(--ink)", padding: 0, minHeight: 24, maxHeight: 160, overflowY: "auto" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || isThinking}
              style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", border: "none", background: !input.trim() || isThinking ? "rgba(78,90,86,0.15)" : "var(--accent-strong)", color: !input.trim() || isThinking ? "var(--muted)" : "#f7f4ee", cursor: !input.trim() || isThinking ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", transition: "background 180ms ease, transform 140ms ease", transform: input.trim() && !isThinking ? "scale(1)" : "scale(0.9)" }}
              aria-label="Send"
            >
              ↑
            </button>
          </div>
          <div style={{ textAlign: "center", marginTop: 8, fontSize: "0.74rem", color: "var(--muted)" }}>
            Powered by Gemini · Read-only queries · Results capped at 200 rows
          </div>
        </div>
      </main>
    </>
  );
}
