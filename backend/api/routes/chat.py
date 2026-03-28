import os
import json
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from auth import get_current_user, get_db

router = APIRouter(prefix="/chat", tags=["chat"])

MAX_ROWS = 200
WARN_ROWS = 50
MAX_RESULT_CHARS = 8000

# ─────────────────────────────────────────────
# Schema (with dataset-scoping context)
# ─────────────────────────────────────────────
_BASE_SCHEMA = """
You have read-only access to a PostgreSQL database via Supabase with these tables:

TABLE: assets
  id          uuid PK
  dataset_id  uuid FK→datasets.id
  version_id  uuid FK→dataset_versions.id
  uri         text   (file path / storage URI)
  media_type  text   (e.g. image/jpeg, text/plain, video/mp4)
  metadata    jsonb  (key-value stats, dimensions, etc.)
  status      text   (registered | processing | processed | failed)
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

TABLE: dataset_versions
  id          uuid PK
  dataset_id  uuid FK→datasets.id
  version     integer
  status      text  (draft | ingesting | processing | eda_generating | exporting | processed | failed)
  created_at  timestamptz

TABLE: transforms
  id          uuid PK
  dataset_id  uuid FK→datasets.id
  version_id  uuid FK→dataset_versions.id
  op          text
  params      jsonb
  status      text
  created_at  timestamptz

TABLE: data_sources
  id          uuid PK
  dataset_id  uuid FK→datasets.id
  version_id  uuid FK→dataset_versions.id
  source_type text
  source_uri  text
  options     jsonb
  created_at  timestamptz
"""


def _build_system_prompt(dataset_id: str, dataset_name: str, version_id: Optional[str]) -> str:
    scope_note = f"""
SCOPE CONTEXT:
- The user is querying dataset: "{dataset_name}" (id = '{dataset_id}')
- ALL queries MUST include WHERE dataset_id = '{dataset_id}' to scope results to this dataset.
"""
    if version_id:
        scope_note += f"- Unless the user asks cross-version, also filter by version_id = '{version_id}'.\n"

    return f"""You are a data analyst assistant embedded in an ETL platform.
The user is exploring a specific dataset and wants to ask questions about its assets, labels, jobs, and versions.

{_BASE_SCHEMA}
{scope_note}
RULES:
1. Output ONLY valid JSON with these EXACT keys:
   - "sql": a safe read-only SELECT statement (always scoped to dataset_id = '{dataset_id}')
   - "reasoning": brief one-line explanation of what the query does
2. Use standard PostgreSQL syntax. Always LIMIT {MAX_ROWS} on queries that could return many rows.
3. If the question cannot be answered with SQL (e.g. "how do I..." or "what is EDA?"), set "sql" to null and explain in "reasoning".
4. NEVER use INSERT/UPDATE/DELETE/DROP/TRUNCATE/CREATE/ALTER/GRANT/REVOKE.
5. NEVER omit the dataset_id filter — users must only see their own dataset's data.
6. For asset questions (count, types, status breakdown, metadata) query the assets table.
7. For labeling questions query the labels table joined to assets.
8. For pipeline/job questions query the jobs table.
9. For version questions query the dataset_versions table.
"""


# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    dataset_id: str
    dataset_name: str = "this dataset"
    version_id: Optional[str] = None
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    answer: str
    sql: Optional[str] = None
    rows: Optional[List[Dict[str, Any]]] = None
    row_count: int = 0
    truncated: bool = False
    error: Optional[str] = None


# ─────────────────────────────────────────────
# Gemini
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


def _build_prompt(system: str, message: str, history: List[ChatMessage]) -> str:
    parts = [system, ""]
    for msg in history[-6:]:
        parts.append(f"{msg.role.upper()}: {msg.content}")
    parts.append(f"USER: {message}")
    return "\n".join(parts)


def _extract_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(l for l in lines if not l.strip().startswith("```"))
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise ValueError(f"Could not parse JSON from model output: {raw[:300]}")


def _is_safe_sql(sql: str) -> bool:
    normalized = sql.strip().upper()
    forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "CREATE", "ALTER",
                 "GRANT", "REVOKE", "EXECUTE", "CALL", "DO "]
    if not normalized.startswith("SELECT") and not normalized.startswith("WITH"):
        return False
    for kw in forbidden:
        if kw in normalized:
            return False
    return True


def _enforce_dataset_scope(sql: str, dataset_id: str) -> str:
    """Last-resort check: ensure the dataset_id appears in the query."""
    if dataset_id.lower() not in sql.lower():
        raise ValueError(
            f"Query does not reference dataset_id '{dataset_id}'. Refusing to run."
        )
    return sql


# ─────────────────────────────────────────────
# SQL execution via psycopg2
# ─────────────────────────────────────────────
def _supabase_to_psycopg(url: str, key: str) -> str:
    if not url:
        raise RuntimeError("SUPABASE_URL not set.")
    ref = url.replace("https://", "").split(".")[0]
    return f"postgresql://postgres.{ref}:{key}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"


def _run_sql(sql: str) -> List[Dict[str, Any]]:
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
            if "LIMIT" not in sql.upper():
                sql = sql.rstrip(";") + f" LIMIT {MAX_ROWS}"
            cur.execute(sql)
            rows = cur.fetchmany(MAX_ROWS)
            return [dict(r) for r in rows]
    finally:
        conn.close()


# ─────────────────────────────────────────────
# Answer summarisation
# ─────────────────────────────────────────────
def _build_answer_prompt(question: str, dataset_name: str, sql: str,
                          reasoning: str, rows: List[Dict], truncated: bool) -> str:
    sample = rows[:20]
    serialized = json.dumps(sample, default=str)
    if len(serialized) > MAX_RESULT_CHARS:
        serialized = serialized[:MAX_RESULT_CHARS] + "...[truncated]"
    trunc = f"\n⚠️ Results were capped at {MAX_ROWS} rows." if truncated else ""
    return f"""The user is exploring the dataset "{dataset_name}" and asked: "{question}"

SQL executed:
{sql}
({reasoning})

Query returned {len(rows)} row(s){trunc}.
First rows: {serialized}

Write a clear, concise plain-English answer (2-5 sentences):
- Summarise the key findings specific to this dataset.
- If results are truncated, mention the user should refine the question.
- Do NOT repeat the SQL or raw JSON.
"""


# ─────────────────────────────────────────────
# Endpoint
# ─────────────────────────────────────────────
@router.post("", response_model=ChatResponse)
def chat_query(
    payload: ChatRequest,
    db: Client = Depends(get_db),
    current_user=Depends(get_current_user),
):
    model = _get_gemini_client()
    system = _build_system_prompt(payload.dataset_id, payload.dataset_name, payload.version_id)

    # Step 1: NL → SQL
    prompt = _build_prompt(system, payload.message, payload.history)
    try:
        raw = model.generate_content(prompt)
        parsed = _extract_json(raw.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI translation failed: {e}")

    sql = parsed.get("sql")
    reasoning = parsed.get("reasoning", "")

    if not sql:
        return ChatResponse(answer=reasoning or "I can only answer questions about your dataset's data.")

    if not _is_safe_sql(sql):
        return ChatResponse(
            answer="⚠️ I can only run read-only SELECT queries. Modification queries are not allowed.",
            sql=sql, error="unsafe_sql",
        )

    # Enforce dataset scope
    try:
        _enforce_dataset_scope(sql, payload.dataset_id)
    except ValueError as e:
        return ChatResponse(
            answer=f"⚠️ The generated query was not properly scoped to your dataset. Please rephrase your question.",
            sql=sql, error=str(e),
        )

    # Step 2: Execute
    try:
        rows = _run_sql(sql)
    except Exception as e:
        return ChatResponse(
            answer=f"The query could not be executed: {e}",
            sql=sql, error=str(e),
        )

    truncated = len(rows) >= MAX_ROWS
    large_result = len(rows) >= WARN_ROWS

    # Step 3: Summarise
    try:
        answer_prompt = _build_answer_prompt(
            payload.message, payload.dataset_name, sql, reasoning, rows, truncated
        )
        answer_raw = model.generate_content(answer_prompt)
        answer = answer_raw.text.strip()
    except Exception:
        answer = f"Query returned {len(rows)} row(s)."
        if truncated:
            answer += f" Results were capped at {MAX_ROWS} rows — refine your question for more specific data."
        if large_result and not truncated:
            answer += " This is a large result set; consider filtering by version or status."

    return ChatResponse(
        answer=answer,
        sql=sql,
        rows=rows[:100],
        row_count=len(rows),
        truncated=truncated,
    )
