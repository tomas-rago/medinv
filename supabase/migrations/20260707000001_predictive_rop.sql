-- ROP pivot (accepted 2026-07-07): EOQ is a poor fit for small health
-- institutions — holding cost is effectively zero, so its cost inputs were
-- noise. Replenishment guidance becomes a coverage-days target (suggested
-- quantity = demand x (lead time + coverage) + min_quantity - stock), and
-- "time to reorder" becomes a real alert type. Reorder points are computed
-- by the TS model in lib/predictive (single implementation, never duplicated
-- in SQL) and pushed in through sync_reorder_alerts() on page load, the same
-- no-scheduler stance as sweep_alerts().

-- 1. predictive_settings: coverage target replaces the EOQ cost inputs.
--    No rows existed when this was applied, so the drops discard nothing.
alter table predictive_settings
  add column coverage_days int not null default 30
    check (coverage_days between 1 and 365);
alter table predictive_settings
  drop column ordering_cost,
  drop column holding_cost_rate;

-- 2. alerts: new advisory type. Fires when stock falls to the predicted
--    reorder point (demand x lead time + min_quantity), which is >= the
--    static min_quantity floor, so it precedes low_stock and the two
--    coexist deliberately (they answer different questions).
alter table alerts drop constraint alerts_type_check;
alter table alerts add constraint alerts_type_check
  check (type in ('low_stock', 'expiry', 'reorder_suggested'));

create unique index if not exists alerts_active_reorder_key
  on alerts (organization_id, product_id)
  where type = 'reorder_suggested' and status = 'active';

alter table alert_settings
  add column reorder_enabled boolean not null default true;

-- 3. Sync RPC. SECURITY DEFINER like sweep_alerts (clients have no write
--    access to `alerts`), org pinned to the caller's JWT claim. Stock
--    quantities are read from the org's own rows; only the advisory
--    reorder_point comes from the payload. Accepted residual risk: an org
--    member can fabricate/resolve reorder alerts for their own org by
--    calling this with arbitrary reorder points — same trust altitude as
--    the existing acknowledge grant, no cross-tenant surface.
--    threshold = reorder point snapshot, quantity = stock on hand.
create or replace function sync_reorder_alerts(p_items jsonb) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := current_organization_id();
  v_enabled boolean;
begin
  if v_org is null or auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 1000 then
    raise exception 'invalid_payload';
  end if;

  select reorder_enabled into v_enabled
    from alert_settings where organization_id = v_org;
  if not coalesce(v_enabled, true) then
    update alerts set status = 'resolved', resolved_at = now()
      where organization_id = v_org
        and type = 'reorder_suggested' and status = 'active';
    return;
  end if;

  -- Resolve actives whose product is absent from the payload (e.g. the
  -- data basis disappeared) or whose stock is back above the reorder point.
  update alerts a
    set status = 'resolved', resolved_at = now()
    where a.organization_id = v_org
      and a.type = 'reorder_suggested'
      and a.status = 'active'
      and not exists (
        select 1
        from jsonb_array_elements(p_items) e
        join stock s on s.organization_id = v_org
                    and s.product_id = (e->>'product_id')::uuid
        where s.product_id = a.product_id
          and s.quantity <= (e->>'reorder_point')::numeric
      );

  -- Fire/refresh where stock is at or below the reorder point. Payload is
  -- deduplicated (max reorder point wins) so ON CONFLICT never sees the
  -- same row twice.
  insert into alerts (organization_id, product_id, type, quantity, threshold)
  select v_org, s.product_id, 'reorder_suggested', s.quantity, i.reorder_point
    from (
      select (e->>'product_id')::uuid as product_id,
             max((e->>'reorder_point')::numeric) as reorder_point
        from jsonb_array_elements(p_items) e
       group by 1
    ) i
    join stock s on s.organization_id = v_org and s.product_id = i.product_id
    where s.quantity <= i.reorder_point
  on conflict (organization_id, product_id)
    where type = 'reorder_suggested' and status = 'active'
    do update set quantity = excluded.quantity, threshold = excluded.threshold;
end;
$$;

revoke execute on function sync_reorder_alerts(jsonb) from public, anon;
grant execute on function sync_reorder_alerts(jsonb) to authenticated;

-- 4. sweep_alerts: same body as 20260706000001 plus the reorder-disabled
--    cleanup branch, so disabling the toggle clears lingering alerts on the
--    next sweep (saveAlertSettings already calls it after every save).
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
    s.reorder_enabled := true;
  end if;

  if not s.low_stock_enabled then
    update alerts set status = 'resolved', resolved_at = now()
      where organization_id = v_org and type = 'low_stock' and status = 'active';
  end if;

  if not s.reorder_enabled then
    update alerts set status = 'resolved', resolved_at = now()
      where organization_id = v_org and type = 'reorder_suggested' and status = 'active';
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
