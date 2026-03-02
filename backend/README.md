# Unified ETL Backend

This directory contains the backend services for the Unified ETL platform.

## Structure

- `api/`: FastAPI application handling core business logic, user authentication, and data management.
- `worker/`: Celery worker application responsible for background processing, heavy ETL tasks, and interacting with external APIs/systems.

## Technologies Used

- **Frameworks**: FastAPI (API), Celery (Worker)
- **Database Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Cache/Broker**: Redis (used by Celery)

## Local Setup

See the main README in the root format for overarching configuration. In general, you need a `.env` file with `SUPABASE_URL`, `SUPABASE_KEY`, and `REDIS_URL` in both `api` and `worker` directories.

## Deployment

Both `api` and `worker` use their respective Dockerfiles and are orchestrated via `render.yaml`.
