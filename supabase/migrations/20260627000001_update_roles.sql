-- Update role values: admin→chief_doctor, operator→doctor, read_only→administrative
-- New roles: chief_doctor, doctor, nurse, administrative

-- 1. Drop old check constraints and add new ones
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('chief_doctor', 'doctor', 'nurse', 'administrative'));

alter table public.invitations
  drop constraint if exists invitations_role_check;

alter table public.invitations
  add constraint invitations_role_check
    check (role in ('doctor', 'nurse', 'administrative'));

-- 2. Migrate existing data
update public.profiles set role = 'chief_doctor'  where role = 'admin';
update public.profiles set role = 'doctor'        where role = 'operator';
update public.profiles set role = 'administrative' where role = 'read_only';

update public.invitations set role = 'doctor'        where role = 'operator';
update public.invitations set role = 'administrative' where role = 'read_only';

-- 3. Update RLS policies that hard-code the 'admin' role value
drop policy if exists "profiles_select_org" on public.profiles;
create policy "profiles_select_org" on public.profiles
  for select using (
    organization_id = (auth.jwt()->'app_metadata'->>'organization_id')::uuid
    and (auth.jwt()->'app_metadata'->>'role') = 'chief_doctor'
  );

drop policy if exists "invitations_insert_admin" on public.invitations;
create policy "invitations_insert_admin" on public.invitations
  for insert with check (
    organization_id = (auth.jwt()->'app_metadata'->>'organization_id')::uuid
    and (auth.jwt()->'app_metadata'->>'role') = 'chief_doctor'
  );
