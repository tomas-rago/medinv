-- profiles.role is set by the subscribe flow after onboarding completes.
-- New users arrive without an org or role, so the column must allow NULL.
alter table public.profiles alter column role drop not null;
