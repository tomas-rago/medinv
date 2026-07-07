-- EOQ inputs (accepted 2026-07-05): demand comes from stock_movements and
-- unit cost from purchase history, but ordering cost, holding cost rate and
-- provider lead time have no data source, so the chief doctor configures
-- them manually at the org level. No row = EOQ unconfigured; the demand
-- regression and reorder points still work without it.
create table if not exists predictive_settings (
  organization_id   uuid primary key references organizations(id) on delete cascade,
  ordering_cost     numeric not null check (ordering_cost > 0),
  -- annual holding cost as a percentage of the unit purchase cost
  holding_cost_rate numeric not null
    check (holding_cost_rate > 0 and holding_cost_rate <= 100),
  lead_time_days    int not null default 7
    check (lead_time_days between 1 and 365),
  updated_at        timestamptz not null default now()
);

alter table predictive_settings enable row level security;

create policy "org members read predictive_settings" on predictive_settings
  for select using (organization_id = current_organization_id());
create policy "chief_doctor manages predictive_settings" on predictive_settings
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  );
