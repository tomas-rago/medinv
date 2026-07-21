-- Align write RLS with the "Funcionalidades por rol" matrix. Mirrors the
-- helpers in lib/constants/roles.ts:
--   * inventory writers (products/stock/movements/batches/ean_lookup) now
--     include 'administrative' → chief_doctor, doctor, nurse, administrative
--   * every "operations" capability (purchases, providers, alerts config,
--     predictive config, receptors) becomes chief_doctor, nurse, administrative
--     — 'doctor' is dropped (doctor is inventory-only), 'administrative' and
--     'nurse' are added.
-- Reads stay org-scoped for all roles; the movements-report gate is UI-only.

-- ── Inventory writers: add 'administrative' ──────────────────────────────────

-- products
drop policy if exists "writers insert products" on products;
create policy "writers insert products" on products
  for insert with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse','administrative'])
  );
drop policy if exists "writers update products" on products;
create policy "writers update products" on products
  for update using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse','administrative'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse','administrative'])
  );

-- stock
drop policy if exists "writers manage stock" on stock;
create policy "writers manage stock" on stock
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse','administrative'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse','administrative'])
  );

-- stock_movements
drop policy if exists "writers insert movements" on stock_movements;
create policy "writers insert movements" on stock_movements
  for insert with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse','administrative'])
  );

-- stock_batches
drop policy if exists "writers manage stock_batches" on stock_batches;
create policy "writers manage stock_batches" on stock_batches
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse','administrative'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','doctor','nurse','administrative'])
  );

-- ean_lookup
drop policy if exists "writers insert ean_lookup" on ean_lookup;
create policy "writers insert ean_lookup" on ean_lookup
  for insert with check (
    "current_role"() = any (array['chief_doctor','doctor','nurse','administrative'])
  );

-- ── Operations roles: chief_doctor, nurse, administrative (not doctor) ────────

-- purchases + purchase_items
drop policy if exists "writers manage purchases" on purchases;
create policy "writers manage purchases" on purchases
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  );

drop policy if exists "writers manage purchase items" on purchase_items;
create policy "writers manage purchase items" on purchase_items
  for all using (
    exists (
      select 1 from purchases p
      where p.id = purchase_items.purchase_id
        and p.organization_id = current_organization_id()
        and "current_role"() = any (array['chief_doctor','nurse','administrative'])
    )
  ) with check (
    exists (
      select 1 from purchases p
      where p.id = purchase_items.purchase_id
        and p.organization_id = current_organization_id()
        and "current_role"() = any (array['chief_doctor','nurse','administrative'])
    )
  );

-- providers + provider_products
drop policy if exists "chief_doctor manages providers" on providers;
create policy "operations manage providers" on providers
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  );

drop policy if exists "chief_doctor manages provider_products" on provider_products;
create policy "operations manage provider_products" on provider_products
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  );

-- alert_settings
drop policy if exists "chief_doctor manages alert_settings" on alert_settings;
create policy "operations manage alert_settings" on alert_settings
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  );

-- predictive_settings
drop policy if exists "chief_doctor manages predictive_settings" on predictive_settings;
create policy "operations manage predictive_settings" on predictive_settings
  for all using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  );

-- receptors: insert + update both move to the operations roles
drop policy if exists "writers insert receptors" on receptors;
create policy "operations insert receptors" on receptors
  for insert with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  );
drop policy if exists "chief_doctor updates receptors" on receptors;
create policy "operations update receptors" on receptors
  for update using (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  ) with check (
    organization_id = current_organization_id()
    and "current_role"() = any (array['chief_doctor','nurse','administrative'])
  );
