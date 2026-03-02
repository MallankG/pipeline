# Product Requirements Document (PRD)

## Product

Unified ETL Platform for AI/ML datasets.

## Objective

Enable developers and data scientists to transform raw multi-source data into curated, versioned, training-ready datasets through one web workflow.

## Target Users

- ML engineers
- Data scientists
- Developers building AI features

## Supported Data Types

- Images
- Text
- Numerical/tabular
- Multimodal (via combined dataset versions)

## Key User Flows

1. User lands on single-screen marketing page.
2. User signs up/signs in.
3. User lands on dashboard (not landing page once authenticated).
4. User creates dataset:
   - picks name/description
   - selects data types
   - connects source(s) or uploads local files
   - defines target outputs
5. Platform starts curation flow and shows live status.
6. User views EDA and final export artifacts.
7. User can create new versions or add data to existing versions.

## Functional Requirements

### Auth and Access

- Email/password sign up and sign in
- Session-aware routing
- RLS-protected records per user

### Dataset Management

- Create dataset with unique name per user
- Show list of existing datasets on dashboard
- Open dataset detail page
- Create multiple versions for same dataset
- Add data to existing version

### Source Connectivity

- Local file upload
- External source metadata registration:
  - object storage (S3/GCS/Azure)
  - data warehouses (Snowflake, BigQuery, Databricks)
  - databases (Postgres, MongoDB)
  - streams (Kafka/Kinesis)

### Data Validation and Type Safety

- Validate uploaded/fetched assets against selected data types
- Auto-detect type from MIME/extension
- Auto-correct dataset type configuration by unioning inferred types
- Show user-facing notices when auto-correction occurs

### Curation and Pipeline UX

- Curation page with stage-based progress:
  - ingest
  - validate
  - normalize
  - label
  - EDA
- Status messaging while dataset is being curated
- Incoming asset table with statuses

### EDA and Final Output

- EDA summary (counts and type breakdown)
- Final output view with export paths/artifacts

## Non-Functional Requirements

- Clear UI on desktop and mobile
- Secure by default with RLS
- Reasonable performance for dashboard and dataset pages
- Deployment-ready separation of frontend and backend

## Metrics

- Time-to-first-dataset
- Dataset creation success rate
- Curation completion rate
- Version reuse rate

## Out of Scope (Current MVP)

- Full OAuth provider linking
- Advanced schema mapping UI
- Automated model training orchestration
- Large-scale stream processing guarantees

## Release Plan

### Phase 1 (Current)

- Auth + RLS
- Dataset CRUD + versioning
- Connectors metadata
- Local uploads
- Curation/EDA/final pages

### Phase 2

- Improved pipeline status fidelity
- Better connector credential workflows

### Phase 3

- Advanced monitoring/lineage
- Rich EDA visualizations
- Team collaboration and RBAC
