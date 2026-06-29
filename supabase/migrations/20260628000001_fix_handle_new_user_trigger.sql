-- Fix handle_new_user trigger to populate organization_id and role from
-- a pending invitation when an invited user is created in auth.users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  inv record;
begin
  select organization_id, role into inv
  from public.invitations
  where email = new.email and status = 'pending'
  limit 1;

  insert into public.profiles (id, full_name, organization_id, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    inv.organization_id,
    inv.role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
