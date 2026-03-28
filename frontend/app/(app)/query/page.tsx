"use client";

import { useEffect, useRef, useState } from "react";
import { apiPost } from "@/components/api";
import { useSessionUser } from "@/components/session";

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

// ─────────────────────────────────────────────
// Suggestion chips shown on empty state
// ─────────────────────────────────────────────
const SUGGESTIONS = [
  "How many datasets do I have?",
  "List all dataset versions and their status",
  "Which assets failed processing?",
  "Show my most recent jobs",
  "How many assets are in each dataset?",
  "Which datasets have more than one version?",
];

// ─────────────────────────────────────────────
// Small result table component
// ─────────────────────────────────────────────
function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows || rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div
      style={{
        overflowX: "auto",
        marginTop: 12,
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "rgba(255,255,255,0.6)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  color: "var(--muted)",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid var(--line)",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(78,90,86,0.03)" }}>
              {cols.map((c) => (
                <td
                  key={c}
                  style={{
                    padding: "8px 12px",
                    borderBottom: ri < rows.length - 1 ? "1px solid var(--line)" : "none",
                    maxWidth: 240,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--ink-soft)",
                  }}
                  title={String(row[c] ?? "")}
                >
                  {row[c] === null ? <span style={{ color: "var(--muted)", fontStyle: "italic" }}>null</span>
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
// SQL toggle block
// ─────────────────────────────────────────────
function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen((x) => !x)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 99,
          border: "1px solid var(--line)",
          background: "rgba(255,255,255,0.5)",
          color: "var(--muted)",
          fontSize: "0.75rem",
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.04em",
        }}
      >
        {open ? "▾" : "▸"} SQL
      </button>
      {open && (
        <pre
          style={{
            marginTop: 8,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "rgba(29,26,23,0.04)",
            fontFamily: "var(--mono)",
            fontSize: "0.78rem",
            lineHeight: 1.65,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            color: "var(--ink)",
          }}
        >
          {sql}
        </pre>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Typing indicator dots
// ─────────────────────────────────────────────
function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--accent)",
            display: "inline-block",
            animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
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
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: isUser
            ? "var(--accent-strong)"
            : "linear-gradient(135deg, rgba(78,90,86,0.2), rgba(78,90,86,0.08))",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.85rem",
          fontWeight: 700,
          color: isUser ? "#f7f4ee" : "var(--accent-strong)",
        }}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: "75%",
          minWidth: 80,
          padding: "14px 18px",
          borderRadius: isUser ? "20px 4px 20px 20px" : "4px 20px 20px 20px",
          border: "1px solid var(--line)",
          background: isUser
            ? "var(--accent-strong)"
            : "rgba(255,255,255,0.82)",
          color: isUser ? "#f7f4ee" : "var(--ink)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 16px rgba(39,34,30,0.06)",
        }}
      >
        {msg.isLoading ? (
          <TypingDots />
        ) : (
          <>
            <div style={{ fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {msg.content}
            </div>

            {/* Error badge */}
            {msg.error && (
              <div
                style={{
                  marginTop: 10,
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "rgba(159,86,71,0.12)",
                  border: "1px solid rgba(159,86,71,0.22)",
                  color: "#8b4638",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                Error: {msg.error}
              </div>
            )}

            {/* Row count + truncation notice */}
            {msg.rowCount != null && msg.rowCount > 0 && (
              <div style={{ marginTop: 8, fontSize: "0.76rem", color: "var(--muted)", fontWeight: 700 }}>
                {msg.rowCount} row{msg.rowCount !== 1 ? "s" : ""}
                {msg.truncated && " · Results capped — refine your question to see more specific data"}
              </div>
            )}

            {/* Result table */}
            {msg.rows && msg.rows.length > 0 && <ResultTable rows={msg.rows} />}

            {/* SQL toggle */}
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
export default function QueryPage() {
  const { user, loading } = useSessionUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || isThinking) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: question };
    const loadingMsg: ChatMessage = { role: "assistant", content: "", isLoading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsThinking(true);

    // Build history for context (exclude isLoading messages)
    const history = messages
      .filter((m) => !m.isLoading)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await apiPost("/chat", { message: question, history });
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

  function clearChat() {
    setMessages([]);
  }

  if (!loading && !user) {
    return (
      <main className="card fade-up" style={{ textAlign: "center", padding: "64px 32px" }}>
        <div className="page-title" style={{ fontSize: "2rem", marginBottom: 12 }}>Query your data</div>
        <p className="muted" style={{ marginBottom: 24 }}>Please sign in to use the natural language query interface.</p>
        <a href="/auth" className="btn">Sign In</a>
      </main>
    );
  }

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

      <main
        className="fade-up"
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          height: "calc(100svh - 120px)",
          gap: 0,
          minHeight: 0,
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 0 20px",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--display)",
                fontSize: "clamp(1.6rem, 2.5vw, 2.4rem)",
                fontWeight: 600,
                letterSpacing: "-0.04em",
              }}
            >
              Query your data
            </h1>
            <div className="muted" style={{ fontSize: "0.88rem", marginTop: 4 }}>
              Ask questions in plain English — AI will translate to SQL and summarise the results.
            </div>
          </div>
          {!isEmpty && (
            <button
              className="btn ghost small"
              onClick={clearChat}
              style={{ flexShrink: 0 }}
            >
              Clear chat
            </button>
          )}
        </div>

        {/* ── Message area ── */}
        <div
          style={{
            overflowY: "auto",
            paddingRight: 4,
            scrollbarWidth: "thin",
          }}
        >
          {isEmpty ? (
            /* Empty state */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 32,
                padding: "40px 20px",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    margin: "0 auto 16px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, rgba(78,90,86,0.15), rgba(78,90,86,0.05))",
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.8rem",
                  }}
                >
                  🔍
                </div>
                <div
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    marginBottom: 6,
                  }}
                >
                  Ask anything about your datasets
                </div>
                <div className="muted" style={{ fontSize: "0.88rem" }}>
                  No SQL knowledge required. Just ask in plain English.
                </div>
              </div>

              {/* Suggestion chips */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  justifyContent: "center",
                  maxWidth: 640,
                }}
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 999,
                      border: "1px solid var(--line)",
                      background: "rgba(255,255,255,0.65)",
                      color: "var(--ink-soft)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "transform 140ms ease, background 140ms ease, border-color 140ms ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(78,90,86,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.transform = "";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 20, padding: "4px 0 16px" }}>
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input bar ── */}
        <div style={{ paddingTop: 16 }}>
          <div
            className="query-input-wrap"
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 24,
              border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.82)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 8px 24px rgba(39,34,30,0.07)",
              transition: "border-color 180ms ease, box-shadow 180ms ease",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your data… (Enter to send, Shift+Enter for new line)"
              disabled={isThinking}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                border: "none",
                background: "transparent",
                outline: "none",
                fontFamily: "var(--sans)",
                fontSize: "0.92rem",
                lineHeight: 1.55,
                color: "var(--ink)",
                padding: 0,
                minHeight: 24,
                maxHeight: 160,
                overflowY: "auto",
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || isThinking}
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "none",
                background: !input.trim() || isThinking ? "rgba(78,90,86,0.15)" : "var(--accent-strong)",
                color: !input.trim() || isThinking ? "var(--muted)" : "#f7f4ee",
                cursor: !input.trim() || isThinking ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                transition: "background 180ms ease, transform 140ms ease",
                transform: input.trim() && !isThinking ? "scale(1)" : "scale(0.9)",
              }}
              aria-label="Send"
            >
              ↑
            </button>
          </div>
          <div
            style={{
              textAlign: "center",
              marginTop: 8,
              fontSize: "0.74rem",
              color: "var(--muted)",
              letterSpacing: "0.01em",
            }}
          >
            Powered by Gemini · Read-only · Results capped at 200 rows
          </div>
        </div>
      </main>
    </>
  );
}
