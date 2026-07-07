-- Purchases baseline + stale role-name fixes + legacy cleanup.
--
-- `purchases` and `purchase_items` were created via the Supabase dashboard
-- (no repo migration); section 1 documents them so a fresh DB matches prod.
-- Their RLS policies (and ean_lookup insert / token_usage read) still
-- referenced the pre-rename roles 'admin'/'operator', which no longer exist,
-- so purchase writes were silently blocked — same bug fixed for products in
-- 20260629000001.

-- 1. Documentation baseline (no-op on the live DB).
create table if not exists purchases (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by      uuid not null references auth.users(id),
  supplier        text,
  status          text not null default 'draft'
    check (status in ('draft', 'confirmed', 'received', 'cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  received_at     timestamptz
);

create table if not exists purchase_items (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id  uuid not null references products(id),
  quantity    numeric not null,
  unit_price  numeric,
  expiry_date date
);

alter table purchases enable row level security;
alter table purchase_items enable row level security;

-- 2. Purchases: read for org members, manage for chief_doctor/doctor
--    (rename mapping of the old admin/operator policy).
drop policy if exists "operators manage purchases" on purchases;
create policy "writers manage purchases" on purchases
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor'])
  );

drop policy if exists "operators manage purchase items" on purchase_items;
create policy "writers manage purchase items" on purchase_items
  for all using (
    exists (
      select 1 from purchases p
      where p.id = purchase_items.purchase_id
        and p.organization_id = current_organization_id()
        and "current_role"() = any (array['chief_doctor','doctor'])
    )
  ) with check (
    exists (
      select 1 from purchases p
      where p.id = purchase_items.purchase_id
        and p.organization_id = current_organization_id()
        and "current_role"() = any (array['chief_doctor','doctor'])
    )
  );

-- 3. ean_lookup insert: align with the inventory-writer roles that create
--    products (the table is a shared EAN→name cache filled on product creation).
drop policy if exists "operators insert ean_lookup" on ean_lookup;
create policy "writers insert ean_lookup" on ean_lookup
  for insert with check (
    "current_role"() = any (array['chief_doctor','doctor','nurse'])
  );

-- 4. token_usage org-wide read was gated on 'admin' → chief_doctor.
drop policy if exists "org members read own token usage" on token_usage;
create policy "org members read own token usage" on token_usage
  for select using (
    organization_id = current_organization_id()
    and (user_id = auth.uid() or "current_role"() = 'chief_doctor')
  );

-- 5. Drop the legacy pre-multi-tenant `supplies` table (no org scoping,
--    public read policy, one leftover test row; unused by app code).
drop table if exists supplies;
