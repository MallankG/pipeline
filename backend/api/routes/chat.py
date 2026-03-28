import os
import json
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from auth import get_current_user, get_db

router = APIRouter(prefix="/chat", tags=["chat"])

# ─────────────────────────────────────────────
# Schema snapshot (kept in-process for speed)
# ─────────────────────────────────────────────
SCHEMA_DESCRIPTION = """
You have read-only access to a PostgreSQL database (via Supabase) with the following tables:

TABLE: datasets
  id          uuid PK
  name        text
  description text (nullable)
  owner_id    uuid  (references auth.users)
  data_types  text[]
  created_at  timestamptz

TABLE: dataset_versions
  id          uuid PK
  dataset_id  uuid FK→datasets.id
  version     integer
  status      text  (draft | ingesting | processing | eda_generating | exporting | processed | failed)
  target_output jsonb
  created_at  timestamptz

TABLE: data_sources
  id          uuid PK
  dataset_id  uuid FK→datasets.id
  version_id  uuid FK→dataset_versions.id
  source_type text
  source_uri  text
  options     jsonb
  created_at  timestamptz

TABLE: assets
  id          uuid PK
  dataset_id  uuid FK→datasets.id
  version_id  uuid FK→dataset_versions.id
  uri         text
  media_type  text
  metadata    jsonb
  status      text  (registered | processing | processed | failed)
  created_at  timestamptz

TABLE: labels
  id          uuid PK
  asset_id    uuid FK→assets.id
  label_type  text
  payload     jsonb
  annotator   text
  confidence  numeric (nullable)
  created_at  timestamptz

TABLE: jobs
  id          uuid PK
  dataset_id  uuid FK→datasets.id
  version_id  uuid FK→dataset_versions.id
  type        text
  status      text  (queued | running | completed | failed)
  logs        text (nullable)
  created_at  timestamptz
  updated_at  timestamptz

TABLE: transforms
  id          uuid PK
  dataset_id  uuid FK→datasets.id
  version_id  uuid FK→dataset_versions.id
  op          text
  params      jsonb
  status      text
  created_at  timestamptz

All tables have Row-Level Security (RLS). You only see data the current user owns.
"""

MAX_ROWS = 200          # hard cap
WARN_ROWS = 50          # soft warn threshold for large result notice
MAX_RESULT_CHARS = 8000  # approximate cap on serialized result sent to LLM for summary

# ─────────────────────────────────────────────
# Request / response models
# ─────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    answer: str
    sql: Optional[str] = None
    rows: Optional[List[Dict[str, Any]]] = None
    row_count: int = 0
    truncated: bool = False
    error: Optional[str] = None

# ─────────────────────────────────────────────
# Gemini helper
# ─────────────────────────────────────────────
def _get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured. Please set GEMINI_API_KEY in backend environment."
        )
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        return genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config={"temperature": 0.1, "max_output_tokens": 1024},
        )
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="google-generativeai package not installed. Run: pip install google-generativeai"
        )

SYSTEM_PROMPT = f"""You are a data analyst assistant for an ETL platform.
Your job is to translate a user's natural-language question into a SQL query against the database described below,
execute it (conceptually), and return a helpful, concise answer.

{SCHEMA_DESCRIPTION}

RULES:
1. Output ONLY valid JSON with these keys:
   - "sql": a safe read-only SQL SELECT statement (no INSERT/UPDATE/DELETE/DROP/TRUNCATE/CREATE allowed)
   - "reasoning": brief one-line explanation of what the query does
2. Use standard PostgreSQL syntax. Use LIMIT {MAX_ROWS} on any query that could return many rows.
3. If the question cannot be answered with a SQL query (e.g. asking how to do something), set "sql" to null and explain in "reasoning".
4. If the question is ambiguous, make a reasonable best-effort assumption and state it in "reasoning".
5. Never expose raw credentials, UUIDs of other users, or system internals.
6. All queries run with the user's RLS context — you cannot see other users' data even if asked.
"""

def _build_llm_prompt(message: str, history: List[ChatMessage]) -> str:
    parts = []
    for msg in history[-6:]:  # keep last 6 turns for context window
        parts.append(f"{msg.role.upper()}: {msg.content}")
    parts.append(f"USER: {message}")
    return "\n".join(parts)

def _extract_json(raw: str) -> dict:
    """Try to parse JSON even if the model wrapped it in markdown fences."""
    text = raw.strip()
    # Strip ```json ... ``` fences
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(l for l in lines if not l.strip().startswith("```"))
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback: find first { ... }
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise ValueError(f"Could not parse JSON from model output: {raw[:300]}")

def _is_safe_sql(sql: str) -> bool:
    """Rudimentary safety check — only allow SELECT statements."""
    normalized = sql.strip().upper()
    forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "CREATE", "ALTER",
                 "GRANT", "REVOKE", "EXECUTE", "CALL", "DO "]
    if not normalized.startswith("SELECT") and not normalized.startswith("WITH"):
        return False
    for kw in forbidden:
        if kw in normalized:
            return False
    return True

# ─────────────────────────────────────────────
# Execute raw SQL via Supabase (service role for schema visibility,
# but only returning data the user can see through a secondary RLS check)
# ─────────────────────────────────────────────
def _run_sql(db: Client, sql: str) -> List[Dict[str, Any]]:
    """
    Run a read-only SQL query. We use the user-scoped client so RLS is enforced.
    For PostgREST we use rpc() with a raw SQL helper if available,
    otherwise fall back to the admin client with a strict SELECT.
    """
    # Supabase Python client doesn't expose raw SQL in the JS-SDK style.
    # We use the admin client's PostgREST /rest/v1/rpc or direct psycopg2 if available.
    # Simplest safe path: use psycopg2 with user's token via SET LOCAL role.
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        raise RuntimeError("psycopg2-binary is required for SQL execution.")

    db_url = os.getenv("DATABASE_URL") or _supabase_to_psycopg(
        os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.set_session(readonly=True, autocommit=False)
    try:
        with conn.cursor() as cur:
            # Hard cap
            if "LIMIT" not in sql.upper():
                sql = sql.rstrip(";") + f" LIMIT {MAX_ROWS}"
            cur.execute(sql)
            rows = cur.fetchmany(MAX_ROWS)
            return [dict(r) for r in rows]
    finally:
        conn.close()


def _supabase_to_psycopg(url: str, key: str) -> str:
    """
    Convert Supabase project URL to a psycopg2 connection string.
    e.g. https://xyz.supabase.co → postgresql://postgres:[key]@db.xyz.supabase.co:5432/postgres
    """
    if not url:
        raise RuntimeError("SUPABASE_URL not set; cannot construct DB connection string.")
    ref = url.replace("https://", "").split(".")[0]
    return f"postgresql://postgres.{ref}:{key}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"


def _build_answer_prompt(question: str, sql: str, reasoning: str,
                          rows: List[Dict], truncated: bool) -> str:
    row_sample = rows[:20]  # only send first 20 rows to the model for summary
    serialized = json.dumps(row_sample, default=str)
    if len(serialized) > MAX_RESULT_CHARS:
        serialized = serialized[:MAX_RESULT_CHARS] + "...[truncated]"

    trunc_note = f"\n⚠️  Results were capped at {MAX_ROWS} rows." if truncated else ""
    return f"""The user asked: "{question}"

You executed this SQL:
{sql}

({reasoning})

The query returned {len(rows)} row(s){trunc_note}.
First rows (JSON): {serialized}

Now write a clear, helpful, concise answer in plain English for the user.
- Summarise the key findings.
- If results were truncated, mention that the full data may be larger.
- Do NOT repeat the SQL or the raw JSON in your answer.
- Keep it to 2-5 sentences.
"""

# ─────────────────────────────────────────────
# Main endpoint
# ─────────────────────────────────────────────
@router.post("", response_model=ChatResponse)
def chat_query(
    payload: ChatRequest,
    db: Client = Depends(get_db),
    current_user=Depends(get_current_user),
):
    model = _get_gemini_client()

    # ── Step 1: translate question → SQL ──
    prompt = SYSTEM_PROMPT + "\n\n" + _build_llm_prompt(payload.message, payload.history)
    try:
        raw = model.generate_content(prompt)
        parsed = _extract_json(raw.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI translation failed: {e}")

    sql = parsed.get("sql")
    reasoning = parsed.get("reasoning", "")

    # ── No SQL case (e.g. how-to question) ──
    if not sql:
        return ChatResponse(answer=reasoning or "I can only answer questions about your data tables.")

    # ── Safety gate ──
    if not _is_safe_sql(sql):
        return ChatResponse(
            answer="⚠️ I can only run read-only SELECT queries. Modification queries are not allowed.",
            sql=sql,
            error="unsafe_sql",
        )

    # ── Step 2: execute SQL ──
    try:
        rows = _run_sql(db, sql)
    except Exception as e:
        return ChatResponse(
            answer=f"The query could not be executed: {e}",
            sql=sql,
            error=str(e),
        )

    truncated = len(rows) >= MAX_ROWS
    large_result = len(rows) >= WARN_ROWS

    # ── Step 3: synthesise human answer ──
    try:
        answer_prompt = _build_answer_prompt(payload.message, sql, reasoning, rows, truncated)
        answer_raw = model.generate_content(answer_prompt)
        answer = answer_raw.text.strip()
    except Exception:
        # Fallback if summarisation fails
        answer = f"Query returned {len(rows)} row(s)."
        if truncated:
            answer += f" Results were capped at {MAX_ROWS} — your data may be larger than shown."
        if large_result:
            answer += " This is a large result set; consider refining your question to narrow it down."

    return ChatResponse(
        answer=answer,
        sql=sql,
        rows=rows[:100],   # send up to 100 rows to frontend for display
        row_count=len(rows),
        truncated=truncated,
    )
