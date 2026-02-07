# Unified ETL Platform

End-to-end ETL platform for images, text, and numerical data with:
- Supabase Auth + Row Level Security
- FastAPI backend API
- Celery worker pipeline
- Next.js web frontend
- Dataset versioning, labeling, and ETL job runs

## Architecture
- Frontend: `apps/web` (deploy to Vercel)
- Backend API: `apps/api` (deploy to Render Web Service)
- Worker: `apps/worker` (deploy to Render Worker)
- Supabase: auth, Postgres, storage buckets (`raw`, `processed`)

## Supabase Setup
1. Create a Supabase project.
2. Run SQL in `infra/supabase/schema.sql`.
3. Create storage buckets: `raw`, `processed`.
4. Collect keys:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Environment Variables

### API (`apps/api/.env`)
```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET_RAW=raw
SUPABASE_STORAGE_BUCKET_PROCESSED=processed
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000,https://<your-vercel-app>.vercel.app
```

### Worker (`apps/worker/.env`)
```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET_PROCESSED=processed
REDIS_URL=redis://localhost:6379/0
```

### Web (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Local Run

### 1) API
```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2) Worker
```bash
cd apps/worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
celery -A celery_app worker --loglevel=info
```

### 3) Web
```bash
cd apps/web
npm install
npm run dev
```

## Deployment

### Backend on Render
- `render.yaml` is included at repo root.
- Services:
- `unified-etl-api` from `apps/api/Dockerfile`
- `unified-etl-worker` from `apps/worker/Dockerfile`

### Frontend on Vercel
- Set project root to `apps/web`.
- `apps/web/vercel.json` is included.
- Configure `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Security Model
- All API routes (except `/health`) require bearer auth.
- API validates Supabase JWT via `auth.get_user`.
- Data access is done with user-scoped Supabase client (`anon key + bearer token`).
- Supabase RLS policies restrict all dataset/version/asset/label/job rows to `auth.uid()` ownership.

## ETL Behavior
- Worker processes assets by media type and updates metadata/status.
- On completion, worker exports `manifest.jsonl` to:
- `processed/datasets/<dataset_id>/versions/<version_id>/manifest.jsonl`
- Auto-label endpoint currently generates baseline placeholder labels.
