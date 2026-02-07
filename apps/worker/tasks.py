import os
import json
from typing import Dict, Any
from celery import shared_task
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
PROCESSED_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET_PROCESSED", "processed")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _update_asset(asset_id: str, fields: Dict[str, Any]) -> None:
    supabase.table("assets").update(fields).eq("id", asset_id).execute()


def _read_local_text(uri: str) -> str:
    path = uri.replace("file://", "")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _process_text(asset: Dict[str, Any]) -> Dict[str, Any]:
    text_inline = asset.get("metadata", {}).get("text_inline")
    if text_inline:
        raw = text_inline
    else:
        raw = _read_local_text(asset["uri"])
    cleaned = " ".join(raw.split())
    return {"text_length": len(cleaned), "text_preview": cleaned[:200]}


def _process_image(asset: Dict[str, Any]) -> Dict[str, Any]:
    try:
        from PIL import Image
    except Exception:
        return {"warning": "Pillow not installed"}

    path = asset["uri"].replace("file://", "")
    with Image.open(path) as img:
        return {"width": img.width, "height": img.height, "mode": img.mode, "format": img.format}


def _process_numerical(asset: Dict[str, Any]) -> Dict[str, Any]:
    try:
        import pandas as pd
    except Exception:
        return {"warning": "pandas not installed"}

    path = asset["uri"].replace("file://", "")
    df = pd.read_csv(path)
    summary = df.describe(include="all").fillna("").to_dict()
    return {"rows": len(df), "cols": len(df.columns), "summary": summary}


def _ingest_sources(dataset_id: str, version_id: str) -> None:
    sources = (
        supabase.table("data_sources")
        .select("*")
        .eq("dataset_id", dataset_id)
        .eq("version_id", version_id)
        .execute()
    ).data or []

    for source in sources:
        placeholder = {
            "dataset_id": dataset_id,
            "version_id": version_id,
            "uri": source["source_uri"],
            "media_type": "text/plain",
            "metadata": {
                "source_type": source["source_type"],
                "source_id": source["id"],
                "ingest_note": "Connector ingest placeholder. Replace with actual extractor.",
            },
            "status": "registered",
        }
        supabase.table("assets").insert(placeholder).execute()


@shared_task(name="worker.run_pipeline")
def run_pipeline(job_id: str) -> None:
    job = supabase.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
    if not job.data:
        return

    dataset_id = job.data["dataset_id"]
    version_id = job.data["version_id"]

    _ingest_sources(dataset_id, version_id)

    assets = supabase.table("assets").select("*").eq("dataset_id", dataset_id).eq("version_id", version_id).execute()
    assets = assets.data or []

    logs = []
    for asset in assets:
        try:
            media_type = asset["media_type"]
            if media_type.startswith("image/"):
                meta = _process_image(asset)
            elif media_type.startswith("text/"):
                meta = _process_text(asset)
            else:
                meta = _process_numerical(asset)

            new_meta = dict(asset.get("metadata") or {})
            new_meta.update(meta)
            _update_asset(asset["id"], {"metadata": new_meta, "status": "processed"})
            logs.append(f"Processed {asset['id']}")
        except Exception as e:
            _update_asset(asset["id"], {"status": "failed"})
            logs.append(f"Failed {asset['id']}: {e}")

    _export_manifest(dataset_id, version_id)

    supabase.table("dataset_versions").update({"status": "processed"}).eq("id", version_id).execute()
    supabase.table("jobs").update({"status": "completed", "logs": "\n".join(logs)}).eq("id", job_id).execute()


def _export_manifest(dataset_id: str, version_id: str) -> None:
    import io
    assets = supabase.table("assets").select("*").eq("dataset_id", dataset_id).eq("version_id", version_id).execute().data or []
    asset_ids = [a["id"] for a in assets]
    labels = []
    if asset_ids:
        labels = supabase.table("labels").select("*").in_("asset_id", asset_ids).execute().data or []
    label_map = {}
    for lb in labels:
        label_map.setdefault(lb["asset_id"], []).append(lb)

    lines = []
    for a in assets:
        row = {
            "id": a["id"],
            "uri": a["uri"],
            "media_type": a["media_type"],
            "metadata": a.get("metadata") or {},
            "labels": label_map.get(a["id"], []),
        }
        lines.append(json.dumps(row))

    body = "\n".join(lines).encode("utf-8")
    path = f"datasets/{dataset_id}/versions/{version_id}/manifest.jsonl"
    supabase.storage.from_(PROCESSED_BUCKET).upload(path, io.BytesIO(body), {"content-type": "application/json", "upsert": True})
