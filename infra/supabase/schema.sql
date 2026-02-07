create extension if not exists pgcrypto;

create table if not exists datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null default auth.uid(),
  data_types text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists dataset_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  version int not null,
  status text not null default 'draft',
  target_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(dataset_id, version)
);

create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  version_id uuid not null references dataset_versions(id) on delete cascade,
  source_type text not null,
  source_uri text not null,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  version_id uuid not null references dataset_versions(id) on delete cascade,
  uri text not null,
  media_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'registered',
  created_at timestamptz not null default now()
);

create table if not exists labels (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  label_type text not null,
  payload jsonb not null,
  annotator text not null,
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists transforms (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  version_id uuid not null references dataset_versions(id) on delete cascade,
  op text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  version_id uuid not null references dataset_versions(id) on delete cascade,
  type text not null,
  status text not null default 'queued',
  logs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_datasets_owner on datasets(owner_id);
create index if not exists idx_versions_dataset on dataset_versions(dataset_id);
create index if not exists idx_assets_version on assets(version_id);
create index if not exists idx_assets_dataset on assets(dataset_id);
create index if not exists idx_labels_asset on labels(asset_id);
create index if not exists idx_jobs_version on jobs(version_id);
create index if not exists idx_jobs_dataset on jobs(dataset_id);
create index if not exists idx_sources_dataset on data_sources(dataset_id);

alter table datasets enable row level security;
alter table dataset_versions enable row level security;
alter table data_sources enable row level security;
alter table assets enable row level security;
alter table labels enable row level security;
alter table transforms enable row level security;
alter table jobs enable row level security;

drop policy if exists datasets_select_own on datasets;
drop policy if exists datasets_insert_own on datasets;
drop policy if exists datasets_update_own on datasets;
drop policy if exists datasets_delete_own on datasets;

create policy datasets_select_own on datasets
for select using (owner_id = auth.uid());

create policy datasets_insert_own on datasets
for insert with check (owner_id = auth.uid());

create policy datasets_update_own on datasets
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy datasets_delete_own on datasets
for delete using (owner_id = auth.uid());

drop policy if exists dataset_versions_all_own on dataset_versions;
create policy dataset_versions_all_own on dataset_versions
for all using (
  exists (
    select 1 from datasets d
    where d.id = dataset_versions.dataset_id
      and d.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from datasets d
    where d.id = dataset_versions.dataset_id
      and d.owner_id = auth.uid()
  )
);

drop policy if exists data_sources_all_own on data_sources;
create policy data_sources_all_own on data_sources
for all using (
  exists (
    select 1 from datasets d
    where d.id = data_sources.dataset_id
      and d.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from datasets d
    where d.id = data_sources.dataset_id
      and d.owner_id = auth.uid()
  )
);

drop policy if exists assets_all_own on assets;
create policy assets_all_own on assets
for all using (
  exists (
    select 1 from datasets d
    where d.id = assets.dataset_id
      and d.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from datasets d
    where d.id = assets.dataset_id
      and d.owner_id = auth.uid()
  )
);

drop policy if exists transforms_all_own on transforms;
create policy transforms_all_own on transforms
for all using (
  exists (
    select 1 from datasets d
    where d.id = transforms.dataset_id
      and d.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from datasets d
    where d.id = transforms.dataset_id
      and d.owner_id = auth.uid()
  )
);

drop policy if exists jobs_all_own on jobs;
create policy jobs_all_own on jobs
for all using (
  exists (
    select 1 from datasets d
    where d.id = jobs.dataset_id
      and d.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from datasets d
    where d.id = jobs.dataset_id
      and d.owner_id = auth.uid()
  )
);

drop policy if exists labels_all_own on labels;
create policy labels_all_own on labels
for all using (
  exists (
    select 1
    from assets a
    join datasets d on d.id = a.dataset_id
    where a.id = labels.asset_id
      and d.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from assets a
    join datasets d on d.id = a.dataset_id
    where a.id = labels.asset_id
      and d.owner_id = auth.uid()
  )
);
