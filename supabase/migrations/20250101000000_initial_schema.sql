-- ============================================================
-- Initial schema baseline
-- Reflects the state of the DB before the MP integration.
-- Run this only on a fresh database; the production DB already
-- has these tables created via the Supabase dashboard.
-- ============================================================

-- Plans (seeded manually in the Supabase dashboard)
create table if not exists public.plans (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  monthly_price         integer not null,
  user_limit            integer not null,
  token_limit_per_month integer not null,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- Organizations
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  plan_id    uuid not null references public.plans(id),
  created_at timestamptz not null default now()
);

-- Profiles — one row per auth.users row, created by a trigger
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  full_name       text,
  role            text check (role in ('admin', 'operator', 'read_only')),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Invitations — created by admins, accepted by invited users
create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email           text not null,
  role            text not null check (role in ('operator', 'read_only')),
  invited_by      uuid not null references auth.users(id),
  status          text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at      timestamptz not null default now()
);

-- Trigger: create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table public.plans        enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.invitations   enable row level security;

-- Plans: anyone authenticated can read
create policy "plans_select" on public.plans
  for select using (auth.role() = 'authenticated');

-- Organizations: members can read their own org
create policy "organizations_select" on public.organizations
  for select using (
    id = (auth.jwt()->'app_metadata'->>'organization_id')::uuid
  );

-- Profiles: users can read their own; admins can read all in their org
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_select_org" on public.profiles
  for select using (
    organization_id = (auth.jwt()->'app_metadata'->>'organization_id')::uuid
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Invitations: admins can insert for their org; users can read their own pending invite
create policy "invitations_insert_admin" on public.invitations
  for insert with check (
    organization_id = (auth.jwt()->'app_metadata'->>'organization_id')::uuid
    and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

create policy "invitations_select_own" on public.invitations
  for select using (email = auth.email());
