-- Order reconciliation with partial acceptance.
--
-- Lifecycle: draft → confirmed (optionally marked as sent to the provider)
-- → received | cancelled. The existing status check constraint already
-- covers these states. Reconciliation records, per line, how much of the
-- ordered quantity actually entered stock (accepted_quantity; 0 = line
-- rejected) — the ordered quantity is never mutated, so discrepancies stay
-- visible for audit and, later, predictive use.

alter table purchase_items
  add column if not exists accepted_quantity numeric
    check (accepted_quantity is null or accepted_quantity >= 0);

create index if not exists purchases_org_created_idx
  on purchases (organization_id, created_at desc);
create index if not exists purchase_items_purchase_idx
  on purchase_items (purchase_id);

-- Atomic reconciliation: records accepted quantities and pushes accepted
-- stock through the existing ingress RPC (register_stock_movement), which
-- maintains stock, stock_batches and stock_movements in the same tx.
-- p_items must cover every line of the purchase:
--   [{ "id": uuid, "accepted_quantity": numeric, "expiry_date": date|null }]
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
        'purchase:' || p_purchase_id
      );
    end if;
  end loop;

  update purchases
    set status = 'received', received_at = now()
    where id = p_purchase_id;
end;
$$;

grant execute on function receive_purchase(uuid, jsonb) to authenticated;
