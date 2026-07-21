-- AI-generated management summary of stock state, shown as a dashboard tile
-- for the chief doctor. Costlier than a rule-based tile, so it is generated
-- once and cached here (one latest row per org); the tile reads it on render
-- and only re-fires on an explicit "Regenerate". content is the validated
-- model output blob (headline, summary, actions, chart) — see
-- lib/schemas/asistencia-ia/dashboard-summary.ts.
create table if not exists ai_dashboard_summaries (
  organization_id uuid primary key references organizations(id) on delete cascade,
  content         jsonb not null,
  generated_at    timestamptz not null default now(),
  generated_by    uuid references auth.users(id) on delete set null
);

alter table ai_dashboard_summaries enable row level security;

-- Chief-doctor-only feature: only the chief reads, generates and regenerates
-- the org's summary. The route upserts on the RLS-scoped client, so the write
-- policy (insert + update) is scoped the same way.
create policy "chief_doctor reads ai_dashboard_summaries" on ai_dashboard_summaries
  for select using (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  );
create policy "chief_doctor manages ai_dashboard_summaries" on ai_dashboard_summaries
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  );
