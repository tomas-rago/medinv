-- monthly_token_consumption was created as a SECURITY DEFINER view (the
-- default), which bypasses token_usage RLS: any authenticated user could
-- read every org's consumption through it. Flagged as ERROR by the Supabase
-- security advisor. security_invoker makes the querying user's RLS apply.
alter view monthly_token_consumption set (security_invoker = true);
