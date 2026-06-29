-- Revert handle_new_user to only create the bare profile row.
-- Populating organization_id and role from the invitation is handled
-- in the completeProfile server action instead, which also has a
-- fallback query against invitations for robustness.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;
