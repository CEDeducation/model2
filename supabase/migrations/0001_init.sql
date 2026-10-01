-- OpenLab v1.0 cloud schema
-- Run in a fresh Supabase project. All application tables use RLS.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'scientist' check (role in ('owner','admin','scientist','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Security-definer helpers prevent recursive RLS lookups on workspace_members.
create or replace function is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = auth.uid()
  );
$$;

create or replace function has_workspace_role(target_workspace uuid, accepted_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = auth.uid()
      and m.role = any(accepted_roles)
  );
$$;

create or replace function add_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into workspace_members(workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = excluded.role;
  return new;
end;
$$;

drop trigger if exists workspace_owner_membership on workspaces;
create trigger workspace_owner_membership
after insert on workspaces
for each row execute function add_workspace_owner_membership();

create table if not exists workspace_snapshots (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'Active' check (status in ('Active','Paused','Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notebook_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  status text not null default 'Draft',
  tags text[] not null default '{}',
  objective text not null default '',
  protocol text not null default '',
  results text not null default '',
  notes text not null default '',
  linked_entity_ids uuid[] not null default '{}',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists protocols (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  category text not null default 'General',
  version integer not null default 1 check (version > 0),
  description text not null default '',
  steps jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists registry_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  entity_type text not null,
  schema_name text not null default '',
  description text not null default '',
  aliases text[] not null default '{}',
  parent_id uuid references registry_entities(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  registry_entity_id uuid references registry_entities(id) on delete set null,
  name text not null,
  molecule_type text not null default 'DNA' check (molecule_type in ('DNA','RNA')),
  topology text not null default 'Circular' check (topology in ('Circular','Linear')),
  sequence text not null,
  accession text,
  source_label text,
  source_url text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sequence_features (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sequence_id uuid not null references sequences(id) on delete cascade,
  name text not null,
  feature_type text not null default 'misc_feature',
  start_bp integer not null check (start_bp >= 0),
  end_bp integer not null check (end_bp >= start_bp),
  direction smallint not null default 1 check (direction in (-1,1)),
  color text not null default '#7257c7',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists primers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sequence_id uuid references sequences(id) on delete set null,
  name text not null,
  oligo_sequence text not null,
  start_bp integer,
  end_bp integer,
  direction smallint not null default 1 check (direction in (-1,1)),
  tm_c numeric,
  gc_percent numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  registry_entity_id uuid references registry_entities(id) on delete set null,
  name text not null,
  category text not null default 'Other',
  location text not null default '',
  container text not null default '',
  quantity numeric not null default 0,
  unit text not null default '',
  low_stock_at numeric not null default 0,
  lot text not null default '',
  vendor text not null default '',
  catalog_number text not null default '',
  expiry date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  status text not null default 'Backlog',
  assignee text not null default '',
  linked_entity_ids uuid[] not null default '{}',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  content text not null,
  url text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid default auth.uid() references auth.users(id) on delete set null,
  action text not null,
  object_type text not null,
  object_id text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists notebook_workspace_updated_idx on notebook_entries(workspace_id, updated_at desc);
create index if not exists registry_workspace_type_idx on registry_entities(workspace_id, entity_type);
create index if not exists inventory_workspace_location_idx on inventory_items(workspace_id, location);
create index if not exists sequence_workspace_updated_idx on sequences(workspace_id, updated_at desc);
create index if not exists audit_workspace_created_idx on audit_log(workspace_id, created_at desc);

-- Enable row-level security.
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_snapshots enable row level security;
alter table projects enable row level security;
alter table notebook_entries enable row level security;
alter table protocols enable row level security;
alter table registry_entities enable row level security;
alter table sequences enable row level security;
alter table sequence_features enable row level security;
alter table primers enable row level security;
alter table inventory_items enable row level security;
alter table workflow_tasks enable row level security;
alter table sources enable row level security;
alter table audit_log enable row level security;

create policy "profile self read" on profiles for select using (id = auth.uid());
create policy "profile self update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profile self insert" on profiles for insert with check (id = auth.uid());

create policy "workspace member read" on workspaces for select using (is_workspace_member(id) or owner_id = auth.uid());
create policy "workspace create" on workspaces for insert with check (owner_id = auth.uid());
create policy "workspace admin update" on workspaces for update using (has_workspace_role(id, array['owner','admin'])) with check (has_workspace_role(id, array['owner','admin']));
create policy "workspace owner delete" on workspaces for delete using (has_workspace_role(id, array['owner']));

create policy "member list" on workspace_members for select using (is_workspace_member(workspace_id));
create policy "member admin add" on workspace_members for insert with check (has_workspace_role(workspace_id, array['owner','admin']));
create policy "member admin update" on workspace_members for update using (has_workspace_role(workspace_id, array['owner','admin'])) with check (has_workspace_role(workspace_id, array['owner','admin']));
create policy "member admin delete" on workspace_members for delete using (has_workspace_role(workspace_id, array['owner','admin']));

-- Common policies for workspace-owned data.
create policy "snapshots read" on workspace_snapshots for select using (is_workspace_member(workspace_id));
create policy "snapshots write" on workspace_snapshots for insert with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));
create policy "snapshots update" on workspace_snapshots for update using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "projects read" on projects for select using (is_workspace_member(workspace_id));
create policy "projects write" on projects for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "notebook read" on notebook_entries for select using (is_workspace_member(workspace_id));
create policy "notebook write" on notebook_entries for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "protocols read" on protocols for select using (is_workspace_member(workspace_id));
create policy "protocols write" on protocols for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "registry read" on registry_entities for select using (is_workspace_member(workspace_id));
create policy "registry write" on registry_entities for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "sequences read" on sequences for select using (is_workspace_member(workspace_id));
create policy "sequences write" on sequences for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "features read" on sequence_features for select using (is_workspace_member(workspace_id));
create policy "features write" on sequence_features for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "primers read" on primers for select using (is_workspace_member(workspace_id));
create policy "primers write" on primers for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "inventory read" on inventory_items for select using (is_workspace_member(workspace_id));
create policy "inventory write" on inventory_items for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "tasks read" on workflow_tasks for select using (is_workspace_member(workspace_id));
create policy "tasks write" on workflow_tasks for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "sources read" on sources for select using (is_workspace_member(workspace_id));
create policy "sources write" on sources for all using (has_workspace_role(workspace_id, array['owner','admin','scientist'])) with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

create policy "audit read" on audit_log for select using (is_workspace_member(workspace_id));
create policy "audit insert" on audit_log for insert with check (has_workspace_role(workspace_id, array['owner','admin','scientist']));

-- Storage bucket for attachments. Private by default.
insert into storage.buckets(id, name, public)
values ('openlab-files', 'openlab-files', false)
on conflict (id) do nothing;

-- Store files under workspace_id/... and enforce membership from the first path segment.
create policy "openlab files read" on storage.objects for select
using (bucket_id = 'openlab-files' and is_workspace_member((storage.foldername(name))[1]::uuid));

create policy "openlab files insert" on storage.objects for insert
with check (bucket_id = 'openlab-files' and has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','scientist']));

create policy "openlab files update" on storage.objects for update
using (bucket_id = 'openlab-files' and has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','scientist']))
with check (bucket_id = 'openlab-files' and has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','scientist']));

create policy "openlab files delete" on storage.objects for delete
using (bucket_id = 'openlab-files' and has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','scientist']));
