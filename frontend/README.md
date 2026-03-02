# Unified ETL Frontend

This directory contains the user interface for the Unified ETL platform.

## Features

- **Auth**: User authentication interface integrated with Supabase Auth.
- **Dataset Management**: UI component workflows allowing users to create, label, auto-label, and manage dataset versions.
- **Connectors**: Dashboard interface to manage metadata tracking for datasets.
- **Pipelines**: Workflows to track background EDA and asset tasks.

## Technologies Used

- **Framework**: Next.js 14
- **Components/Styling**: Tailwind CSS
- **Backend Link**: Communicates with the Supabase API and standard FastAPI backend endpoints.

## Local Setup

```bash
npm install # inside the frontend/ directory
npm run dev
```

Ensure that the `.env.local` contains valid API keys for both Next.js public routes and internal application configs.
