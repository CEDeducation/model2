-- OpenLab v1.1: Netflix-style lab profiles on top of one authenticated lab account.
-- The main email/password is handled by Supabase Auth. A lab can expose at most
-- four active profile cards. Each profile is protected by a bcrypt PIN hash.

create table if not exists lab_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'student' check (role in ('owner','researcher','student','viewer')),
  avatar_color text not null default '#2d6f63' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  pin_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lab_profiles_workspace_idx on lab_profiles(workspace_id, created_at);

alter table lab_profiles enable row level security;

-- Members may see safe profile metadata. PIN hashes are protected separately by
-- column privileges and are never requested by the OpenLab client.
create policy "lab profiles read" on lab_profiles
for select using (is_workspace_member(workspace_id));

create policy "lab profiles owner delete" on lab_profiles
for delete using (has_workspace_role(workspace_id, array['owner','admin']));

revoke all on table lab_profiles from anon;
revoke all on table lab_profiles from authenticated;
grant select (id, workspace_id, display_name, role, avatar_color, is_active, created_at, updated_at)
on table lab_profiles to authenticated;

-- Create profiles only through this function so the 4-profile limit and PIN
-- hashing cannot be bypassed from the browser.
create or replace function create_lab_profile(
  target_workspace uuid,
  profile_name text,
  profile_role text,
  profile_pin text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
  profile_count integer;
  palette text[] := array['#2d6f63','#6b63d9','#b96849','#4f7ca5'];
begin
  if not has_workspace_role(target_workspace, array['owner','admin']) then
    raise exception 'Only a lab owner or admin can create profiles';
  end if;

  if profile_name is null or char_length(trim(profile_name)) < 1 then
    raise exception 'Profile name is required';
  end if;

  if profile_role not in ('owner','researcher','student','viewer') then
    raise exception 'Invalid profile role';
  end if;

  if profile_pin !~ '^[0-9]{4,8}$' then
    raise exception 'Profile PIN must contain 4 to 8 digits';
  end if;

  select count(*) into profile_count
  from lab_profiles
  where workspace_id = target_workspace and is_active = true;

  if profile_count >= 4 then
    raise exception 'A lab workspace can have at most 4 active profiles';
  end if;

  insert into lab_profiles(workspace_id, display_name, role, avatar_color, pin_hash)
  values (
    target_workspace,
    left(trim(profile_name), 60),
    profile_role,
    palette[(profile_count % array_length(palette, 1)) + 1],
    crypt(profile_pin, gen_salt('bf', 10))
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function verify_lab_profile_pin(
  profile_id uuid,
  profile_pin text
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from lab_profiles p
    where p.id = profile_id
      and p.is_active = true
      and is_workspace_member(p.workspace_id)
      and p.pin_hash = crypt(profile_pin, p.pin_hash)
  );
$$;

grant execute on function create_lab_profile(uuid, text, text, text) to authenticated;
grant execute on function verify_lab_profile_pin(uuid, text) to authenticated;

-- Optional profile attribution for normalized audit rows.
alter table audit_log add column if not exists lab_profile_id uuid references lab_profiles(id) on delete set null;
