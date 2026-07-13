-- Providers + provider↔product catalog, and a provider reference on purchases.
--
-- Providers are internal records for order tracking (no automated
-- communication in MVP). A product can have multiple providers and vice
-- versa. Pricing is captured at order time (purchase_items.unit_price),
-- not on the provider-product relationship.

create table if not exists providers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  contact_name    text,
  email           text,
  phone           text,
  address         text,
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- One provider name per org (case-insensitive).
create unique index if not exists providers_org_name_key
  on providers (organization_id, lower(name));
create index if not exists providers_org_idx on providers (organization_id);

create table if not exists provider_products (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider_id     uuid not null references providers(id) on delete cascade,
  product_id      uuid not null references products(id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint provider_products_provider_product_key unique (provider_id, product_id)
);

create index if not exists provider_products_org_product_idx
  on provider_products (organization_id, product_id);

alter table providers enable row level security;
alter table provider_products enable row level security;

-- Read for any org member (order creation needs the provider list);
-- manage restricted to chief_doctor.
create policy "org members read providers" on providers
  for select using (organization_id = current_organization_id());
create policy "chief_doctor manages providers" on providers
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  );

create policy "org members read provider_products" on provider_products
  for select using (organization_id = current_organization_id());
create policy "chief_doctor manages provider_products" on provider_products
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = 'chief_doctor'
  );

-- Purchases reference a provider record; the legacy free-text `supplier`
-- column stays for rows created before providers existed.
alter table purchases
  add column if not exists provider_id uuid references providers(id);
create index if not exists purchases_provider_idx on purchases (provider_id);
