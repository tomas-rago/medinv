-- The reorder_suggested alert lagged the /predictive page in two ways, both
-- because it re-derived its own trigger in SQL instead of trusting the model
-- that produced the reorder point:
--
--   1. Reactive, not forward-looking. It fired only once stock had ALREADY
--      fallen to the reorder point, so the model's lead-time lookahead — which
--      fires early when an expiring lot would strand stock during the lead
--      time — could never reach it. The alert arrived exactly too late to act
--      on, which is the case it exists to prevent.
--   2. Raw aggregate, not usable stock. It compared stock.quantity, which
--      still counts lots that have already expired (nothing writes them off),
--      so it stayed silent whenever dead stock padded the total above the
--      reorder point while usable stock was already below it.
--
-- Both close by making the model the single source of truth — the same stance
-- the reorder point itself already takes (computed in TS, never duplicated in
-- SQL). The payload now carries the model's verdict (should_fire) and the
-- stock figure it reasoned about (usable_stock), and this function stops
-- reading stock.quantity for the decision. The stock join is kept purely as
-- the cross-tenant guard it always doubled as.
--
-- Payload item shape (lib/predictive/alerts.ts):
--   { product_id, reorder_point, usable_stock, should_fire }
-- should_fire is required: a payload missing it fires nothing and resolves
-- everything, so this migration and that file must ship together.
--
-- Note: zero-demand products have a reorder point but no reorder day, so they
-- no longer raise reorder_suggested. That is intended — there is nothing to
-- reorder without demand, and the static low_stock alert still covers the
-- min_quantity floor.

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

  -- Resolve actives the model no longer flags: the product dropped out of the
  -- payload (its data basis disappeared) or should_fire went false. Matching
  -- on a.product_id keeps this org-scoped — product ids are unique per org, so
  -- a foreign id in the payload cannot keep another tenant's alert alive.
  update alerts a
    set status = 'resolved', resolved_at = now()
    where a.organization_id = v_org
      and a.type = 'reorder_suggested'
      and a.status = 'active'
      and not exists (
        select 1
        from jsonb_array_elements(p_items) e
        where (e->>'product_id')::uuid = a.product_id
          and (e->>'should_fire')::boolean
      );

  -- Fire/refresh exactly where the model says to. Payload is deduplicated so
  -- ON CONFLICT never sees the same row twice; the stock join pins the product
  -- to the caller's org. quantity snapshots the usable stock the model used,
  -- falling back to the aggregate only if the field is absent.
  insert into alerts (organization_id, product_id, type, quantity, threshold)
  select v_org, s.product_id, 'reorder_suggested',
         coalesce(i.usable_stock, s.quantity), i.reorder_point
    from (
      select (e->>'product_id')::uuid as product_id,
             max((e->>'reorder_point')::numeric) as reorder_point,
             max((e->>'usable_stock')::numeric) as usable_stock
        from jsonb_array_elements(p_items) e
       where (e->>'should_fire')::boolean
       group by 1
    ) i
    join stock s on s.organization_id = v_org and s.product_id = i.product_id
  on conflict (organization_id, product_id)
    where type = 'reorder_suggested' and status = 'active'
    do update set quantity = excluded.quantity, threshold = excluded.threshold;
end;
$$;

revoke execute on function sync_reorder_alerts(jsonb) from public, anon;
grant execute on function sync_reorder_alerts(jsonb) to authenticated;
