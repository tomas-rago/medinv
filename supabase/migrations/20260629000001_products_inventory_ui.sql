-- Product catalog UI + stock ingress support.

-- 1. New product columns
alter table products
  add column if not exists presentation text,
  add column if not exists category text;

-- 2. Fix write RLS to use the current role names (chief_doctor, doctor, nurse).
--    The previous policies referenced 'admin'/'operator', which no longer exist
--    after the role rename, so writes were silently blocked.

-- products
drop policy if exists "operators manage products" on products;
drop policy if exists "operators update products" on products;
create policy "writers insert products" on products
  for insert with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse'])
  );
create policy "writers update products" on products
  for update using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse'])
  );

-- stock
drop policy if exists "operators manage stock" on stock;
create policy "writers manage stock" on stock
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse'])
  );

-- stock_movements
drop policy if exists "operators insert movements" on stock_movements;
create policy "writers insert movements" on stock_movements
  for insert with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse'])
  );

-- 3. Atomic ingress: insert a movement and update the current stock level in one tx.
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

  insert into stock (organization_id, product_id, quantity)
  values (v_org, p_product_id, v_delta)
  on conflict (organization_id, product_id)
  do update set quantity = stock.quantity + v_delta, updated_at = now()
  returning * into v_stock;

  return v_stock;
end;
$$;

grant execute on function register_stock_movement(uuid, text, numeric, date, text) to authenticated;
