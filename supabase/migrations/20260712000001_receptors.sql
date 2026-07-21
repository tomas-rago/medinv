-- Receptors: optional destination entity for stock egress movements.
-- Flexible link between an egress and whatever system the institution uses to
-- track patients (name, external patient id, patient type, optional contact).

create table if not exists receptors (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  external_id     text,          -- id in the institution's own patient system
  patient_type    text,          -- code list in lib/constants/receptor-types.ts (app-validated)
  phone           text,
  email           text,
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Two patients may share a name; the external id is the strong key when given.
-- Name-uniqueness only applies to receptors without an external id, so the
-- inline quick-create path (name only) cannot produce accidental duplicates.
create unique index if not exists receptors_org_external_id_key
  on receptors (organization_id, external_id) where external_id is not null;
create unique index if not exists receptors_org_name_key
  on receptors (organization_id, lower(name)) where external_id is null;
create index if not exists receptors_org_idx on receptors (organization_id);

alter table receptors enable row level security;

-- Read: any org member. Insert: inventory writers (inline create from the exit
-- modal). Update: chief_doctor only. No delete policy (deactivate via active).
-- Mirrored by canCreateReceptors / canManageReceptors in lib/constants/roles.ts.
create policy "org members read receptors" on receptors
  for select using (organization_id = current_organization_id());
create policy "writers insert receptors" on receptors
  for insert with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse'])
  );
create policy "chief_doctor updates receptors" on receptors
  for update using (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  );

-- Destination on egress movements (nullable; only 'exit' rows ever set it).
alter table stock_movements
  add column if not exists receptor_id uuid references receptors(id);
create index if not exists stock_movements_receptor_idx
  on stock_movements (receptor_id);

-- New signature => drop the old one first: two overloads would make PostgREST
-- RPC resolution ambiguous (PGRST203), and grants are per-signature.
drop function if exists register_stock_exit(uuid, numeric, text);

create or replace function register_stock_exit(
  p_product_id uuid,
  p_quantity numeric,
  p_notes text default null,
  p_receptor_id uuid default null
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

  -- Org-scope the receptor explicitly: the FK alone would accept another
  -- org's uuid (RLS on receptors does not gate FK validation).
  if p_receptor_id is not null then
    if not exists (
      select 1 from receptors
      where id = p_receptor_id and organization_id = v_org and active
    ) then
      raise exception 'receptor_not_found';
    end if;
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

    insert into stock_movements (organization_id, product_id, user_id, type, quantity, expiry_date, notes, receptor_id)
    values (v_org, p_product_id, v_user, 'exit', v_take, b.expiry_date, p_notes, p_receptor_id);

    update stock_batches set quantity = quantity - v_take, updated_at = now() where id = b.id;
    v_remaining := v_remaining - v_take;
  end loop;

  update stock set quantity = quantity - p_quantity, updated_at = now()
    where organization_id = v_org and product_id = p_product_id;
end;
$$;

grant execute on function register_stock_exit(uuid, numeric, text, uuid) to authenticated;
