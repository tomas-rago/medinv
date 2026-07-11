-- ROP complements (accepted 2026-07-09): VED criticality drives a default
-- safety stock (days of demand, org-configurable per level), and the lead
-- time defaults to each product's average delivery time from received
-- purchases until the org sets an explicit value.

-- VED criticality. Nullable: unclassified products get no criticality
-- safety stock and behave exactly as before this migration.
alter table products
  add column criticality text
    check (criticality in ('vital', 'essential', 'desirable'));

-- Lead time nullable; NULL = auto (per-product average of
-- purchases.received_at - purchases.created_at over received purchases,
-- computed in lib/predictive/lead-time.ts). Existing rows keep their
-- explicit values; new/unsaved orgs default to auto.
alter table predictive_settings
  alter column lead_time_days drop not null,
  alter column lead_time_days drop default;

-- Days-of-demand safety buffer per criticality level. The model uses
-- safety stock = max(stock.min_quantity, demand x days), so a manually
-- raised per-product threshold still counts.
alter table predictive_settings
  add column safety_days_vital int not null default 7
    check (safety_days_vital between 0 and 365),
  add column safety_days_essential int not null default 3
    check (safety_days_essential between 0 and 365),
  add column safety_days_desirable int not null default 0
    check (safety_days_desirable between 0 and 365);
