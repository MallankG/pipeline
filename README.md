# Unified ETL Platform

Unified ETL is a full-stack platform to ingest, curate, version, and export AI-ready datasets from multiple sources.

- Frontend: Next.js (`frontend`) for landing, auth, dashboard, dataset workflows
- Backend: FastAPI (`backend/api`) for dataset/version/source/asset/job APIs
- Worker: (Not currently needed) FastAPI BackgroundTasks are used for async ETL jobs.
- Data/Auth/Storage: Supabase (Auth, Postgres with RLS, Storage)

## Core Features

- Auth via Supabase email/password
- Row Level Security (RLS) by user ownership
- Dataset creation with type selection (`image`, `text`, `numerical`)
- Versioned datasets (multiple versions per dataset)
- Source connectors (local upload + warehouses/lakes/db/streams)
- Curation flow (ingest, validate, normalize, label, EDA, final export)
- Add data into existing dataset versions
- Duplicate dataset-name protection per user
- Type auto-detection and auto-correction during upload/ingestion
- **Phase 2 Implementation**: Granular curation status tracking (Ingesting, Processing, EDA, Exporting)
- **Phase 3 Implementation**: 
  - Advanced monitoring with dataset lineage metadata in final exports.
  - Rich EDA visualization (metadata summary table).
  - Team collaboration and RBAC infrastructure (Teams & Dataset-Team mapping).

## Project Structure

```text
frontend/  # Next.js frontend (deploy to Vercel)
backend/
  api/       # FastAPI backend
infra/
  supabase/
    schema.sql
packages/
render.yaml
```

## Prerequisites

- Node.js 20+
- Python 3.11+
- Supabase project

## Environment Variables

### `frontend/.env`

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### `backend/api/.env`

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET_RAW=raw
SUPABASE_STORAGE_BUCKET_PROCESSED=processed
CORS_ORIGINS=http://localhost:3000
```


## Supabase Setup

1. Create a Supabase project.
2. Apply schema from `infra/supabase/schema.sql`.
3. Create storage buckets:
   - `raw`
   - `processed`
4. Ensure email/password provider is enabled in Supabase Auth.

## Run Locally

### 1) API

```bash
cd backend/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2) Web

```bash
cd frontend
npm install
npm run dev
```

### 3) Pipeline
The backend uses FastAPI's `BackgroundTasks` to process ETL jobs asynchronously once triggered via the API.

## Build / Verification

### Web

```bash
cd frontend
npm run build
```

### API

```bash
python3 -m compileall backend/api
```

## Deployment

## Vercel (Frontend)

- Root directory: `frontend`
- Required env vars:
  - `NEXT_PUBLIC_API_BASE`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Render (Backend)

- Use root `render.yaml` blueprint.
- The blueprint handles the Docker build context from the repository root.
- Ensure all Supabase environment variables are set in the Render dashboard.

## Security Model

- API routes require bearer auth (except health endpoints).
- API validates user with Supabase auth.
- Data access is scoped to user via RLS policies.
- Dataset assets/sources/versions/jobs are owner-isolated.

## Product Spec

Detailed PRD is available at:

- `docs/PRD.md`
