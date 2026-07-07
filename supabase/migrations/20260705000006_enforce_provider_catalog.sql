-- When an order is tied to a provider, every line must be a product that
-- provider actually provides (provider_products). Orders without a provider
-- (informal restocking) stay unrestricted.
create or replace function create_purchase(
  p_provider_id uuid,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := current_organization_id();
  v_user uuid := auth.uid();
  v_id uuid;
  item record;
begin
  if v_org is null or v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_required';
  end if;
  if p_provider_id is not null and not exists (
    select 1 from providers
    where id = p_provider_id and organization_id = v_org and active
  ) then
    raise exception 'provider_not_found';
  end if;

  insert into purchases (organization_id, created_by, provider_id, notes)
  values (v_org, v_user, p_provider_id, p_notes)
  returning id into v_id;

  for item in
    select * from jsonb_to_recordset(p_items)
      as x(product_id uuid, quantity numeric, unit_price numeric)
  loop
    if item.quantity is null or item.quantity <= 0 then
      raise exception 'invalid_quantity';
    end if;
    if item.unit_price is not null and item.unit_price < 0 then
      raise exception 'invalid_price';
    end if;
    if not exists (
      select 1 from products
      where id = item.product_id and organization_id = v_org and active
    ) then
      raise exception 'product_not_found';
    end if;
    if p_provider_id is not null and not exists (
      select 1 from provider_products
      where provider_id = p_provider_id and product_id = item.product_id
    ) then
      raise exception 'product_not_provided';
    end if;

    insert into purchase_items (purchase_id, product_id, quantity, unit_price)
    values (v_id, item.product_id, item.quantity, item.unit_price);
  end loop;

  return v_id;
end;
$$;
