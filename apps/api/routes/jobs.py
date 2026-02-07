from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..auth import get_db
from ..tasks import run_pipeline_async

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/{job_id}/run")
def run_job(job_id: str, db: Client = Depends(get_db)):
    job = db.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    db.table("jobs").update({"status": "running"}).eq("id", job_id).execute()
    run_pipeline_async(job_id)
    return {"status": "started", "job_id": job_id}
