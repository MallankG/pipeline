import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("etl_api", broker=REDIS_URL, backend=REDIS_URL)


def run_pipeline_async(job_id: str) -> None:
    celery_app.send_task("worker.run_pipeline", args=[job_id])
