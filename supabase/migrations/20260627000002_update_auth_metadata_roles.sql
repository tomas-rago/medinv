-- Sync role renames into auth.users.raw_app_meta_data so JWT app_metadata reflects new role names.
-- profiles.role was already migrated in 20260627000001; this updates the auth side.

update auth.users
  set raw_app_meta_data = jsonb_set(raw_app_meta_data, '{role}', '"chief_doctor"')
  where raw_app_meta_data->>'role' = 'admin';

update auth.users
  set raw_app_meta_data = jsonb_set(raw_app_meta_data, '{role}', '"doctor"')
  where raw_app_meta_data->>'role' = 'operator';

update auth.users
  set raw_app_meta_data = jsonb_set(raw_app_meta_data, '{role}', '"administrative"')
  where raw_app_meta_data->>'role' = 'read_only';
