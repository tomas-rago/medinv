-- In-app alerts: low stock + near-expiry batches. Email delivery is
-- deferred, so there is no scheduler: low stock is evaluated synchronously
-- by a trigger on `stock` (every ingress/egress path funnels through that
-- table), and expiry alerts come from an org-scoped sweep RPC invoked on
-- page load. pg_cron can replace the sweep if/when email lands.
--
-- Lifecycle (accepted 2026-07-05): fire once per condition, auto-resolve
-- when the condition clears, re-arm after resolution — a recurrence creates
-- a new row, so history is kept. Acknowledging only silences the unread
-- badge; the alert stays active until the condition actually clears.

-- Org-level configuration. Low-stock thresholds themselves are per product
-- (the existing stock.min_quantity).
create table if not exists alert_settings (
  organization_id   uuid primary key references organizations(id) on delete cascade,
  low_stock_enabled boolean not null default true,
  expiry_enabled    boolean not null default true,
  expiry_days_ahead int not null default 30
    check (expiry_days_ahead between 1 and 365),
  updated_at        timestamptz not null default now()
);

create table if not exists alerts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id      uuid not null references products(id) on delete cascade,
  type            text not null check (type in ('low_stock', 'expiry')),
  status          text not null default 'active' check (status in ('active', 'resolved')),
  quantity        numeric,  -- on hand when triggered/refreshed (batch qty for expiry)
  threshold       numeric,  -- min_quantity snapshot (low_stock only)
  expiry_date     date,     -- expiry alerts only
  triggered_at    timestamptz not null default now(),
  resolved_at     timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references profiles(id) on delete set null
);

-- Fire-once dedup: at most one active alert per underlying condition.
create unique index if not exists alerts_active_low_stock_key
  on alerts (organization_id, product_id)
  where type = 'low_stock' and status = 'active';
create unique index if not exists alerts_active_expiry_key
  on alerts (organization_id, product_id, expiry_date)
  where type = 'expiry' and status = 'active';
create index if not exists alerts_org_status_idx
  on alerts (organization_id, status, triggered_at desc);

alter table alert_settings enable row level security;
alter table alerts enable row level security;

create policy "org members read alert_settings" on alert_settings
  for select using (organization_id = current_organization_id());
create policy "chief_doctor manages alert_settings" on alert_settings
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  );

create policy "org members read alerts" on alerts
  for select using (organization_id = current_organization_id());
-- Update is limited to the acknowledge columns via column privileges below;
-- rows are created and resolved only inside the security definer functions.
create policy "org members acknowledge alerts" on alerts
  for update using (organization_id = current_organization_id())
  with check (organization_id = current_organization_id());

revoke insert, update, delete on table alerts from anon, authenticated;
grant update (acknowledged_at, acknowledged_by) on table alerts to authenticated;

-- Low-stock evaluation on every stock write. SECURITY DEFINER so any role
-- that can move stock (or a purchase reception) can produce/resolve alerts
-- without needing direct write access to `alerts`; the org always comes
-- from the stock row itself, never from client input.
create or replace function _sync_low_stock_alert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  select low_stock_enabled into v_enabled
    from alert_settings where organization_id = new.organization_id;
  if not coalesce(v_enabled, true) then
    return new;
  end if;

  if new.quantity <= new.min_quantity then
    insert into alerts (organization_id, product_id, type, quantity, threshold)
    values (new.organization_id, new.product_id, 'low_stock', new.quantity, new.min_quantity)
    on conflict (organization_id, product_id)
      where type = 'low_stock' and status = 'active'
      do update set quantity = excluded.quantity, threshold = excluded.threshold;
  else
    update alerts
      set status = 'resolved', resolved_at = now()
      where organization_id = new.organization_id
        and product_id = new.product_id
        and type = 'low_stock'
        and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists stock_low_stock_alert on stock;
create trigger stock_low_stock_alert
  after insert or update of quantity, min_quantity on stock
  for each row execute function _sync_low_stock_alert();

-- Expiry sweep for the caller's org, invoked on page load. SECURITY DEFINER
-- (clients have no write access to `alerts`), org pinned to the caller's
-- JWT claim so it cannot cross tenants. Also clears lingering alerts of a
-- type the org has since disabled.
create or replace function sweep_alerts() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := current_organization_id();
  s alert_settings;
begin
  if v_org is null or auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into s from alert_settings where organization_id = v_org;
  if not found then
    s.low_stock_enabled := true;
    s.expiry_enabled := true;
    s.expiry_days_ahead := 30;
  end if;

  if not s.low_stock_enabled then
    update alerts set status = 'resolved', resolved_at = now()
      where organization_id = v_org and type = 'low_stock' and status = 'active';
  end if;

  if not s.expiry_enabled then
    update alerts set status = 'resolved', resolved_at = now()
      where organization_id = v_org and type = 'expiry' and status = 'active';
    return;
  end if;

  -- Resolve alerts whose batch was consumed, or that fell outside the
  -- window (e.g. the org shrank expiry_days_ahead). An expired batch that
  -- still has stock keeps its alert active — it must be discarded.
  update alerts a
    set status = 'resolved', resolved_at = now()
    where a.organization_id = v_org and a.type = 'expiry' and a.status = 'active'
      and not exists (
        select 1 from stock_batches b
        where b.organization_id = v_org
          and b.product_id = a.product_id
          and b.expiry_date = a.expiry_date
          and b.quantity > 0
          and b.expiry_date <= current_date + s.expiry_days_ahead
      );

  insert into alerts (organization_id, product_id, type, quantity, expiry_date)
  select b.organization_id, b.product_id, 'expiry', b.quantity, b.expiry_date
    from stock_batches b
    where b.organization_id = v_org
      and b.quantity > 0
      and b.expiry_date is not null
      and b.expiry_date <= current_date + s.expiry_days_ahead
  on conflict (organization_id, product_id, expiry_date)
    where type = 'expiry' and status = 'active'
    do update set quantity = excluded.quantity;
end;
$$;

grant execute on function sweep_alerts() to authenticated;

-- Backfill: the trigger only sees future writes, so evaluate current stock
-- levels once. Expiry alerts backfill themselves on the first sweep.
insert into alerts (organization_id, product_id, type, quantity, threshold)
select organization_id, product_id, 'low_stock', quantity, min_quantity
  from stock
  where quantity <= min_quantity;
