from typing import List

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..auth import get_current_user, get_db
from ..models import AssetCreate, DatasetCreate, DatasetVersionCreate, JobCreate, LabelCreate, DataSourceCreate

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("")
def create_dataset(
    payload: DatasetCreate,
    db: Client = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = payload.model_dump()
    row["owner_id"] = current_user.id
    res = db.table("datasets").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create dataset")
    return res.data[0]


@router.get("")
def list_datasets(db: Client = Depends(get_db)):
    res = db.table("datasets").select("*").order("created_at", desc=True).execute()
    return res.data or []


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str, db: Client = Depends(get_db)):
    res = db.table("datasets").select("*").eq("id", dataset_id).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return res.data


@router.post("/{dataset_id}/versions")
def create_version(
    dataset_id: str,
    payload: DatasetVersionCreate,
    db: Client = Depends(get_db),
):
    existing = (
        db.table("dataset_versions")
        .select("version")
        .eq("dataset_id", dataset_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    next_version = 1
    if existing.data:
        next_version = existing.data[0]["version"] + 1

    row = {
        "dataset_id": dataset_id,
        "version": next_version,
        "target_output": payload.target_output,
        "status": "draft",
    }
    res = db.table("dataset_versions").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create version")
    return res.data[0]


@router.get("/{dataset_id}/versions")
def list_versions(dataset_id: str, db: Client = Depends(get_db)):
    res = (
        db.table("dataset_versions")
        .select("*")
        .eq("dataset_id", dataset_id)
        .order("version", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/{dataset_id}/versions/{version_id}/sources")
def add_source(
    dataset_id: str,
    version_id: str,
    payload: DataSourceCreate,
    db: Client = Depends(get_db),
):
    row = payload.model_dump()
    row.update({"dataset_id": dataset_id, "version_id": version_id})
    res = db.table("data_sources").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to add source")
    return res.data[0]


@router.get("/{dataset_id}/versions/{version_id}/sources")
def list_sources(dataset_id: str, version_id: str, db: Client = Depends(get_db)):
    res = (
        db.table("data_sources")
        .select("*")
        .eq("dataset_id", dataset_id)
        .eq("version_id", version_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/{dataset_id}/versions/{version_id}/assets")
def add_assets(
    dataset_id: str,
    version_id: str,
    assets: List[AssetCreate],
    db: Client = Depends(get_db),
):
    rows = [
        {
            "dataset_id": dataset_id,
            "version_id": version_id,
            "uri": asset.uri,
            "media_type": asset.media_type,
            "metadata": asset.metadata,
            "status": "registered",
        }
        for asset in assets
    ]
    res = db.table("assets").insert(rows).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to add assets")
    return res.data


@router.get("/{dataset_id}/versions/{version_id}/assets")
def list_assets(dataset_id: str, version_id: str, db: Client = Depends(get_db)):
    res = (
        db.table("assets")
        .select("*")
        .eq("dataset_id", dataset_id)
        .eq("version_id", version_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/{dataset_id}/versions/{version_id}/labels/{asset_id}")
def add_label(
    dataset_id: str,
    version_id: str,
    asset_id: str,
    payload: LabelCreate,
    db: Client = Depends(get_db),
):
    asset = (
        db.table("assets")
        .select("id")
        .eq("id", asset_id)
        .eq("dataset_id", dataset_id)
        .eq("version_id", version_id)
        .maybe_single()
        .execute()
    )
    if not asset.data:
        raise HTTPException(status_code=404, detail="Asset not found")

    row = {
        "asset_id": asset_id,
        "label_type": payload.label_type,
        "payload": payload.payload,
        "annotator": payload.annotator,
        "confidence": payload.confidence,
    }
    res = db.table("labels").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create label")
    return res.data[0]


@router.get("/{dataset_id}/versions/{version_id}/labels")
def list_labels(dataset_id: str, version_id: str, db: Client = Depends(get_db)):
    assets = (
        db.table("assets")
        .select("id")
        .eq("dataset_id", dataset_id)
        .eq("version_id", version_id)
        .execute()
    )
    asset_ids = [a["id"] for a in (assets.data or [])]
    if not asset_ids:
        return []
    res = db.table("labels").select("*").in_("asset_id", asset_ids).execute()
    return res.data or []


@router.post("/{dataset_id}/versions/{version_id}/auto-label")
def auto_label(
    dataset_id: str,
    version_id: str,
    db: Client = Depends(get_db),
    current_user=Depends(get_current_user),
):
    assets = (
        db.table("assets")
        .select("id")
        .eq("dataset_id", dataset_id)
        .eq("version_id", version_id)
        .execute()
    )
    rows = [
        {
            "asset_id": asset["id"],
            "label_type": "auto",
            "payload": {"label": "auto_label", "source": "baseline"},
            "annotator": current_user.id,
            "confidence": 0.5,
        }
        for asset in (assets.data or [])
    ]
    if not rows:
        return {"created": 0}
    res = db.table("labels").insert(rows).execute()
    return {"created": len(res.data or [])}


@router.post("/{dataset_id}/versions/{version_id}/jobs")
def create_job(
    dataset_id: str,
    version_id: str,
    payload: JobCreate,
    db: Client = Depends(get_db),
):
    row = {
        "dataset_id": dataset_id,
        "version_id": version_id,
        "type": payload.type,
        "status": "queued",
    }
    res = db.table("jobs").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create job")
    return res.data[0]


@router.get("/{dataset_id}/versions/{version_id}/jobs")
def list_jobs(dataset_id: str, version_id: str, db: Client = Depends(get_db)):
    res = (
        db.table("jobs")
        .select("*")
        .eq("dataset_id", dataset_id)
        .eq("version_id", version_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []
