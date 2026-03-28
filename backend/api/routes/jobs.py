from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from supabase import Client

from auth import get_db
from tasks import run_pipeline_sync

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}")
def get_job(job_id: str, db: Client = Depends(get_db)):
    """Fetch current job status from the database (used for polling on reconnect)."""
    job = db.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.data


@router.post("/{job_id}/run")
def run_job(job_id: str, background_tasks: BackgroundTasks, db: Client = Depends(get_db)):
    job = db.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.data.get("status") in {"running", "completed"}:
        raise HTTPException(status_code=409, detail="Job already started")

    db.table("jobs").update({"status": "running"}).eq("id", job_id).execute()
    background_tasks.add_task(run_pipeline_sync, job_id)
    return {"status": "started", "job_id": job_id}
