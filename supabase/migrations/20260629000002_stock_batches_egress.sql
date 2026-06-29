-- Per-batch (lot) expiry tracking + FEFO egress + movement rectification.

-- 1. Per-batch on-hand quantities, keyed by (org, product, expiry).
--    The aggregate `stock` table is kept as the per-product total + min_quantity
--    threshold; the RPCs below maintain both so stock.quantity == sum(batches).
create table if not exists stock_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  expiry_date date,
  quantity numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- NULLS NOT DISTINCT (PG15+) so the single "no expiry" bucket upserts cleanly.
  constraint stock_batches_org_product_expiry_key
    unique nulls not distinct (organization_id, product_id, expiry_date)
);

alter table stock_batches enable row level security;

-- Read for any org member; write for inventory roles — mirrors `stock`.
create policy "org members read stock_batches" on stock_batches
  for select using (organization_id = current_organization_id());
create policy "writers manage stock_batches" on stock_batches
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse'])
  );

-- 2. Link a compensating movement to the movement it rectifies.
alter table stock_movements
  add column if not exists corrects_movement_id uuid references stock_movements(id);
create index if not exists stock_movements_corrects_idx
  on stock_movements (corrects_movement_id);

-- 3. Helper: apply a signed delta to a batch (upsert), rejecting negative results.
create or replace function _apply_batch_delta(
  p_org uuid, p_product uuid, p_expiry date, p_delta numeric
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_qty numeric;
begin
  insert into stock_batches (organization_id, product_id, expiry_date, quantity)
  values (p_org, p_product, p_expiry, p_delta)
  on conflict (organization_id, product_id, expiry_date)
  do update set quantity = stock_batches.quantity + p_delta, updated_at = now()
  returning quantity into v_qty;

  if v_qty < 0 then
    raise exception 'insufficient_stock';
  end if;
end;
$$;

-- 4. Rewrite ingress RPC to also maintain the matching batch in the same tx.
create or replace function register_stock_movement(
  p_product_id uuid,
  p_type text,
  p_quantity numeric,
  p_expiry_date date default null,
  p_notes text default null
) returns stock
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := current_organization_id();
  v_user uuid := auth.uid();
  v_delta numeric;
  v_stock stock;
begin
  if v_org is null or v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;
  if p_type not in ('entry','exit','adjustment','expiry') then
    raise exception 'invalid_type';
  end if;

  insert into stock_movements (organization_id, product_id, user_id, type, quantity, expiry_date, notes)
  values (v_org, p_product_id, v_user, p_type, p_quantity, p_expiry_date, p_notes);

  v_delta := case
    when p_type = 'entry' then p_quantity
    when p_type in ('exit','expiry') then -p_quantity
    else p_quantity
  end;

  perform _apply_batch_delta(v_org, p_product_id, p_expiry_date, v_delta);

  insert into stock (organization_id, product_id, quantity)
  values (v_org, p_product_id, v_delta)
  on conflict (organization_id, product_id)
  do update set quantity = stock.quantity + v_delta, updated_at = now()
  returning * into v_stock;

  return v_stock;
end;
$$;

-- 5. FEFO egress: deduct across batches, earliest expiry first.
create or replace function register_stock_exit(
  p_product_id uuid,
  p_quantity numeric,
  p_notes text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := current_organization_id();
  v_user uuid := auth.uid();
  v_available numeric;
  v_remaining numeric := p_quantity;
  v_take numeric;
  b record;
begin
  if v_org is null or v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select coalesce(sum(quantity), 0) into v_available
    from stock_batches
    where organization_id = v_org and product_id = p_product_id;

  if v_available < p_quantity then
    raise exception 'insufficient_stock';
  end if;

  for b in
    select id, expiry_date, quantity
      from stock_batches
      where organization_id = v_org and product_id = p_product_id and quantity > 0
      order by expiry_date asc nulls last
  loop
    exit when v_remaining <= 0;
    v_take := least(b.quantity, v_remaining);

    insert into stock_movements (organization_id, product_id, user_id, type, quantity, expiry_date, notes)
    values (v_org, p_product_id, v_user, 'exit', v_take, b.expiry_date, p_notes);

    update stock_batches set quantity = quantity - v_take, updated_at = now() where id = b.id;
    v_remaining := v_remaining - v_take;
  end loop;

  update stock set quantity = quantity - p_quantity, updated_at = now()
    where organization_id = v_org and product_id = p_product_id;
end;
$$;

-- 6. Rectify a movement: correct quantity and/or expiry, or null it out
--    (p_new_quantity = 0). Never mutates the original — emits compensating
--    movement(s) tagged with corrects_movement_id.
create or replace function rectify_stock_movement(
  p_movement_id uuid,
  p_new_quantity numeric,
  p_new_expiry_date date default null,
  p_reason text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := current_organization_id();
  v_user uuid := auth.uid();
  m stock_movements;
  v_dir int;
  v_old_expiry date;
  v_new_expiry date;
  v_remove numeric;  -- undo original effect on old batch
  v_add numeric;     -- apply corrected effect on new batch
  v_net numeric;
begin
  if v_org is null or v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'invalid_quantity';
  end if;

  select * into m from stock_movements
    where id = p_movement_id and organization_id = v_org;
  if not found then
    raise exception 'movement_not_found';
  end if;
  if m.corrects_movement_id is not null
     or exists (select 1 from stock_movements where corrects_movement_id = m.id) then
    raise exception 'already_rectified';
  end if;
  if m.type not in ('entry','exit') then
    raise exception 'not_rectifiable';
  end if;

  v_dir := case when m.type = 'entry' then 1 else -1 end;
  v_old_expiry := m.expiry_date;
  v_new_expiry := coalesce(p_new_expiry_date, m.expiry_date);

  v_remove := -v_dir * m.quantity;       -- remove original
  v_add := v_dir * p_new_quantity;       -- apply corrected

  if v_old_expiry is not distinct from v_new_expiry then
    -- Same batch → single net delta + single compensating movement.
    v_net := v_remove + v_add;           -- = v_dir*(p_new_quantity - m.quantity)
    if v_net = 0 then
      raise exception 'no_change';
    end if;
    perform _apply_batch_delta(v_org, m.product_id, v_old_expiry, v_net);
    insert into stock_movements (organization_id, product_id, user_id, type, quantity, expiry_date, notes, corrects_movement_id)
    values (v_org, m.product_id, v_user,
            case when v_net > 0 then 'entry' else 'exit' end,
            abs(v_net), v_old_expiry, p_reason, m.id);
    update stock set quantity = quantity + v_net, updated_at = now()
      where organization_id = v_org and product_id = m.product_id;
  else
    -- Expiry changed → move quantity between batches (two movements).
    if v_remove <> 0 then
      perform _apply_batch_delta(v_org, m.product_id, v_old_expiry, v_remove);
      insert into stock_movements (organization_id, product_id, user_id, type, quantity, expiry_date, notes, corrects_movement_id)
      values (v_org, m.product_id, v_user,
              case when v_remove > 0 then 'entry' else 'exit' end,
              abs(v_remove), v_old_expiry, p_reason, m.id);
    end if;
    if v_add <> 0 then
      perform _apply_batch_delta(v_org, m.product_id, v_new_expiry, v_add);
      insert into stock_movements (organization_id, product_id, user_id, type, quantity, expiry_date, notes, corrects_movement_id)
      values (v_org, m.product_id, v_user,
              case when v_add > 0 then 'entry' else 'exit' end,
              abs(v_add), v_new_expiry, p_reason, m.id);
    end if;
    v_net := v_remove + v_add;
    if v_net <> 0 then
      update stock set quantity = quantity + v_net, updated_at = now()
        where organization_id = v_org and product_id = m.product_id;
    end if;
  end if;
end;
$$;

grant execute on function _apply_batch_delta(uuid, uuid, date, numeric) to authenticated;
grant execute on function register_stock_exit(uuid, numeric, text) to authenticated;
grant execute on function rectify_stock_movement(uuid, numeric, date, text) to authenticated;

-- 7. Backfill batches from existing movements so sum(batches) == stock.quantity.
insert into stock_batches (organization_id, product_id, expiry_date, quantity)
select organization_id, product_id, expiry_date,
       sum(case when type = 'entry' then quantity
                when type in ('exit','expiry') then -quantity
                else quantity end) as qty
from stock_movements
group by organization_id, product_id, expiry_date
having sum(case when type = 'entry' then quantity
                when type in ('exit','expiry') then -quantity
                else quantity end) <> 0
on conflict (organization_id, product_id, expiry_date) do nothing;
