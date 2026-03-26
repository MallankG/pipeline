import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routes.datasets import router as datasets_router
from routes.jobs import router as jobs_router

load_dotenv()

app = FastAPI(title="Unified ETL API")

configured_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
origins = set(configured_origins)
for origin in configured_origins:
    if "localhost" in origin:
        origins.add(origin.replace("localhost", "127.0.0.1"))
    if "127.0.0.1" in origin:
        origins.add(origin.replace("127.0.0.1", "localhost"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(datasets_router)
app.include_router(jobs_router)
