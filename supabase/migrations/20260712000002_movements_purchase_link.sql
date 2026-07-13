-- Link ingress movements to the purchase that produced them, so movements can
-- be filtered/reported by provider (movement → purchase → provider).
-- No backfill of historic rows: they keep their 'purchase:<id>' note and are
-- recoverable later via substring(notes from '^purchase:(.*)$')::uuid.

alter table stock_movements
  add column if not exists purchase_id uuid references purchases(id);
create index if not exists stock_movements_purchase_idx
  on stock_movements (purchase_id);

-- New signature => drop the old 5-arg overload first (PGRST203 ambiguity and
-- stale per-signature grant otherwise).
drop function if exists register_stock_movement(uuid, text, numeric, date, text);

create or replace function register_stock_movement(
  p_product_id uuid,
  p_type text,
  p_quantity numeric,
  p_expiry_date date default null,
  p_notes text default null,
  p_purchase_id uuid default null
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

  -- Org-scope the purchase explicitly (the FK alone would accept another
  -- org's uuid).
  if p_purchase_id is not null then
    if not exists (
      select 1 from purchases
      where id = p_purchase_id and organization_id = v_org
    ) then
      raise exception 'purchase_not_found';
    end if;
  end if;

  insert into stock_movements (organization_id, product_id, user_id, type, quantity, expiry_date, notes, purchase_id)
  values (v_org, p_product_id, v_user, p_type, p_quantity, p_expiry_date, p_notes, p_purchase_id);

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

grant execute on function register_stock_movement(uuid, text, numeric, date, text, uuid) to authenticated;

-- receive_purchase: the ingress call now passes the purchase id as a real FK
-- instead of the machine-readable 'purchase:<id>' note (notes stays free for
-- humans). Same signature — create or replace is enough.
create or replace function receive_purchase(
  p_purchase_id uuid,
  p_items jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := current_organization_id();
  v_purchase purchases;
  v_line_count int;
  v_item_count int;
  item record;
begin
  if v_org is null or auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_purchase from purchases
    where id = p_purchase_id and organization_id = v_org
    for update;
  if not found then
    raise exception 'purchase_not_found';
  end if;
  if v_purchase.status not in ('draft', 'confirmed') then
    raise exception 'purchase_not_receivable';
  end if;

  select count(*) into v_line_count from purchase_items where purchase_id = p_purchase_id;
  select count(distinct x.id) into v_item_count
    from jsonb_to_recordset(p_items) as x(id uuid, accepted_quantity numeric, expiry_date date)
    join purchase_items pi on pi.id = x.id and pi.purchase_id = p_purchase_id;
  if v_line_count = 0 or v_item_count <> v_line_count
     or v_item_count <> jsonb_array_length(p_items) then
    raise exception 'items_mismatch';
  end if;

  for item in
    select x.id, x.accepted_quantity, x.expiry_date, pi.product_id
      from jsonb_to_recordset(p_items) as x(id uuid, accepted_quantity numeric, expiry_date date)
      join purchase_items pi on pi.id = x.id
  loop
    if item.accepted_quantity is null or item.accepted_quantity < 0 then
      raise exception 'invalid_quantity';
    end if;

    update purchase_items
      set accepted_quantity = item.accepted_quantity,
          expiry_date = item.expiry_date
      where id = item.id;

    if item.accepted_quantity > 0 then
      perform register_stock_movement(
        item.product_id,
        'entry',
        item.accepted_quantity,
        item.expiry_date,
        null,
        p_purchase_id
      );
    end if;
  end loop;

  update purchases
    set status = 'received', received_at = now()
    where id = p_purchase_id;
end;
$$;

grant execute on function receive_purchase(uuid, jsonb) to authenticated;
