import os
import json
import mimetypes
import asyncio
from typing import Dict, Any
from dotenv import load_dotenv
from supabase import create_client
from websocket import (
    send_progress_update,
    send_asset_update,
    send_stage_complete,
    send_error,
    send_job_complete
)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
PROCESSED_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET_PROCESSED", "processed")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else None

def _update_asset(asset_id: str, fields: Dict[str, Any]) -> None:
    if not supabase: return
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
    if not supabase: return
    sources = (
        supabase.table("data_sources")
        .select("*")
        .eq("dataset_id", dataset_id)
        .eq("version_id", version_id)
        .execute()
    ).data or []

    for source in sources:
        raw_uri = (source.get("source_uri") or "").strip()
        if not raw_uri:
            continue

        uri_candidates = [u.strip() for chunk in raw_uri.splitlines() for u in chunk.split(",")]
        uris = [u for u in uri_candidates if u]

        for uri in uris:
            guessed, _ = mimetypes.guess_type(uri)
            media_type = guessed or "application/octet-stream"
            placeholder = {
                "dataset_id": dataset_id,
                "version_id": version_id,
                "uri": uri,
                "media_type": media_type,
                "metadata": {
                    "source_type": source["source_type"],
                    "source_id": source["id"],
                    "ingest_note": "Connector URI registered for ETL processing.",
                },
                "status": "registered",
            }
            supabase.table("assets").insert(placeholder).execute()

def _update_version_status(version_id: str, status: str) -> None:
    if not supabase: return
    supabase.table("dataset_versions").update({"status": status}).eq("id", version_id).execute()

async def run_pipeline_async(job_id: str) -> None:
    if not supabase: return
    job = supabase.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
    if not job.data:
        return

    dataset_id = job.data["dataset_id"]
    version_id = job.data["version_id"]
    logs = []

    async def log_and_update(message: str):
        """Log message and send via WebSocket."""
        logs.append(message)
        await send_progress_update(job_id, "running", message, {"total_logs": len(logs)})

    try:
        # Stage 1: Ingest
        await log_and_update("Stage: Ingesting sources...")
        _update_version_status(version_id, "ingesting")
        await send_progress_update(job_id, "ingesting", "Reading from data sources...")
        _ingest_sources(dataset_id, version_id)

        # Get assets count for progress tracking
        assets_result = supabase.table("assets").select("*").eq("dataset_id", dataset_id).eq("version_id", version_id).execute()
        assets = assets_result.data or []
        total_assets = len(assets)

        await send_progress_update(
            job_id,
            "ingesting",
            f"Ingested {total_assets} assets",
            {"total_assets": total_assets, "stage": "ingest_complete"}
        )
        await send_stage_complete(job_id, "ingesting", {"assets_ingested": total_assets})

        # Stage 2: Validate & Process
        _update_version_status(version_id, "processing")
        await log_and_update(f"Stage: Processing {total_assets} assets...")

        processed_count = 0
        failed_count = 0

        for idx, asset in enumerate(assets):
            try:
                media_type = asset["media_type"]
                _update_asset(asset["id"], {"status": "processing"})

                # Send asset processing start update
                await send_asset_update(job_id, asset["id"], "processing", {
                    "index": idx + 1,
                    "total": total_assets,
                    "media_type": media_type
                })

                if media_type.startswith("image/"):
                    meta = _process_image(asset)
                elif media_type.startswith("text/"):
                    meta = _process_text(asset)
                else:
                    meta = _process_numerical(asset)

                new_meta = dict(asset.get("metadata") or {})
                new_meta.update(meta)
                _update_asset(asset["id"], {"metadata": new_meta, "status": "processed"})
                processed_count += 1

                # Send asset processed update
                await send_asset_update(job_id, asset["id"], "processed", {
                    "index": idx + 1,
                    "total": total_assets,
                    "progress_pct": round((processed_count + failed_count) / total_assets * 100, 1),
                    **meta
                })

                await log_and_update(f"Processed {asset['id']} ({media_type})")

            except Exception as e:
                failed_count += 1
                _update_asset(asset["id"], {"status": "failed"})
                await send_asset_update(job_id, asset["id"], "failed", {"error": str(e)})
                await log_and_update(f"Failed {asset['id']}: {e}")

        await send_progress_update(
            job_id,
            "processing",
            f"Processed {processed_count} assets, {failed_count} failed",
            {
                "processed": processed_count,
                "failed": failed_count,
                "total": total_assets
            }
        )
        await send_stage_complete(job_id, "processing", {
            "processed": processed_count,
            "failed": failed_count
        })

        # Stage 3: EDA
        _update_version_status(version_id, "eda_generating")
        await log_and_update("Stage: Generating EDA...")
        await send_progress_update(job_id, "eda_generating", "Computing summary statistics...")

        # Calculate EDA stats from processed assets
        eda_stats = _compute_eda_stats(assets)
        await send_progress_update(
            job_id,
            "eda_generating",
            "EDA complete",
            {"eda_stats": eda_stats}
        )
        await send_stage_complete(job_id, "eda_generating", eda_stats)

        # Stage 4: Export
        _update_version_status(version_id, "exporting")
        await log_and_update("Stage: Exporting manifest...")
        await send_progress_update(job_id, "exporting", "Building manifest file...")

        manifest_path = _export_manifest(dataset_id, version_id)

        await send_progress_update(
            job_id,
            "exporting",
            "Export complete",
            {"manifest_path": manifest_path}
        )
        await send_stage_complete(job_id, "exporting", {"manifest_generated": True})

        # Finalize
        _update_version_status(version_id, "processed")
        supabase.table("jobs").update({
            "status": "completed",
            "logs": "\n".join(logs)
        }).eq("id", job_id).execute()

        await send_job_complete(job_id, {
            "total_assets": total_assets,
            "processed": processed_count,
            "failed": failed_count
        })

    except Exception as e:
        error_msg = f"Pipeline failed: {e}"
        await send_error(job_id, error_msg)
        _update_version_status(version_id, "failed")
        supabase.table("jobs").update({
            "status": "failed",
            "logs": f"{error_msg}\n" + "\n".join(logs)
        }).eq("id", job_id).execute()


def _compute_eda_stats(assets: list) -> dict:
    """Compute basic EDA statistics from assets."""
    stats = {
        "total_assets": len(assets),
        "by_media_type": {},
        "by_status": {}
    }

    for asset in assets:
        media_type = asset.get("media_type", "unknown")
        status = asset.get("status", "unknown")

        stats["by_media_type"][media_type] = stats["by_media_type"].get(media_type, 0) + 1
        stats["by_status"][status] = stats["by_status"].get(status, 0) + 1

        # Add image-specific stats
        if media_type.startswith("image/"):
            meta = asset.get("metadata", {})
            if "width" in meta and "height" in meta:
                if "image_stats" not in stats:
                    stats["image_stats"] = {"total_pixels": 0, "asset_count": 0}
                stats["image_stats"]["total_pixels"] += meta.get("width", 0) * meta.get("height", 0)
                stats["image_stats"]["asset_count"] += 1

        # Add text-specific stats
        if media_type.startswith("text/"):
            meta = asset.get("metadata", {})
            if "text_length" in meta:
                if "text_stats" not in stats:
                    stats["text_stats"] = {"total_chars": 0, "asset_count": 0}
                stats["text_stats"]["total_chars"] += meta.get("text_length", 0)
                stats["text_stats"]["asset_count"] += 1

    return stats


def run_pipeline_sync(job_id: str) -> None:
    """Synchronous wrapper for the async pipeline."""
    asyncio.run(run_pipeline_async(job_id))


def _export_manifest(dataset_id: str, version_id: str) -> None:
    if not supabase: return
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
            "lineage": {
                "source": a.get("metadata", {}).get("source_type", "unknown"),
                "ingested_at": a.get("created_at")
            }
        }
        lines.append(json.dumps(row))

    body = "\n".join(lines).encode("utf-8")
    path = f"datasets/{dataset_id}/versions/{version_id}/manifest.jsonl"
    supabase.storage.from_(PROCESSED_BUCKET).upload(path, io.BytesIO(body), {"content-type": "application/json", "upsert": True})
