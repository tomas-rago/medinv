// ---------------------------------------------------------------------------
// Demo-account seeder.
//
//   npm run seed:demo                 wipe + rebuild the demo org's data
//   npm run seed:demo -- --wipe-only  leave the org empty
//   npm run seed:demo -- --no-wipe    append (rarely what you want)
//   npm run seed:demo -- --seed=7     reshuffle the noise
//   npm run seed:demo -- --days=180   longer history
//
// Iterate by editing scripts/seed/catalog.ts and re-running: the script ends by
// printing the predictive verdict per product, which is the whole point of the
// data existing.
//
// WHY IT WRITES TABLES DIRECTLY: register_stock_movement / register_stock_exit
// stamp created_at = now(), so history cannot be built through the RPCs. This
// script is the one deliberate exception to the "stock ingress goes through the
// RPC" rule in CLAUDE.md, and it earns it by preserving the invariant the RPCs
// maintain — stock.quantity == sum(stock_batches) == signed sum of movements —
// and asserting it against the database before it exits.
//
// It NEVER touches auth.users, profiles, organizations or invitations. The demo
// accounts survive every reload; that is checked, not assumed.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";
import { fetchAllRows } from "../lib/supabase/fetch-all";
import { PRODUCTS, PROVIDERS, RECEPTORS } from "./seed/catalog";
import { generatePlan, type Role, type SeedPlan } from "./seed/generate";

type Db = SupabaseClient<Database>;

const DEFAULT_EMAIL = "j.romero@gmail.com";
const DEFAULT_DAYS = 90;
const DEFAULT_SEED = 20260723;
const CHUNK = 500;

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

async function chunked<T>(rows: T[], write: (batch: T[]) => Promise<void>): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await write(rows.slice(i, i + CHUNK));
  }
}

function check(error: { message: string } | null, label: string): void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

// --- org resolution ---------------------------------------------------------

type Target = {
  orgId: string;
  orgName: string;
  usersByRole: Record<Role, string>;
  profileIds: string[];
};

async function resolveTarget(supabase: Db, email: string): Promise<Target> {
  // The service-role client cannot query auth.users through PostgREST, so the
  // admin API is the way in. The project has a few dozen users; one page is
  // plenty.
  const { data: list, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  check(error, "listUsers");
  const user = must(
    list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()),
    `No auth user found for ${email}`
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role, full_name")
    .eq("id", user.id)
    .single();
  const orgId = must(profile?.organization_id, `${email} has no organization`);
  if (profile?.role !== "chief_doctor") {
    throw new Error(`${email} is ${profile?.role ?? "unknown"}, expected chief_doctor`);
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("organization_id", orgId);

  const usersByRole = {} as Record<Role, string>;
  for (const p of profiles ?? []) {
    if (p.role) usersByRole[p.role as Role] = p.id;
  }
  // Movements are attributed to real people; fall back to the chief so a
  // half-staffed org still seeds.
  for (const role of ["chief_doctor", "doctor", "nurse", "administrative"] as Role[]) {
    usersByRole[role] ??= user.id;
  }

  return {
    orgId,
    orgName: org?.name ?? "(sin nombre)",
    usersByRole,
    profileIds: (profiles ?? []).map((p) => p.id).sort(),
  };
}

// --- wipe -------------------------------------------------------------------

async function wipe(supabase: Db, orgId: string): Promise<void> {
  const del = async (
    table:
      | "alerts"
      | "ai_dashboard_summaries"
      | "token_usage"
      | "stock_movements"
      | "stock_batches"
      | "stock"
      | "purchases"
      | "provider_products"
      | "providers"
      | "receptors"
      | "products"
      | "predictive_settings"
      | "alert_settings"
  ) => {
    const { error } = await supabase.from(table).delete().eq("organization_id", orgId);
    check(error, `wipe ${table}`);
  };

  // purchase_items has no organization_id — reach it through its purchases.
  const { data: purchaseRows } = await supabase
    .from("purchases")
    .select("id")
    .eq("organization_id", orgId);
  const purchaseIds = (purchaseRows ?? []).map((p) => p.id);
  if (purchaseIds.length) {
    await chunked(purchaseIds, async (batch) => {
      const { error } = await supabase.from("purchase_items").delete().in("purchase_id", batch);
      check(error, "wipe purchase_items");
    });
  }

  // Children before parents. stock_movements references purchases, receptors
  // and products, so it goes first.
  await del("alerts");
  await del("ai_dashboard_summaries");
  await del("token_usage");
  await del("stock_movements");
  await del("stock_batches");
  await del("stock");
  await del("purchases");
  await del("provider_products");
  await del("providers");
  await del("receptors");
  await del("products");
  await del("predictive_settings");
  await del("alert_settings");
}

// --- writes -----------------------------------------------------------------

async function writePlan(supabase: Db, orgId: string, plan: SeedPlan): Promise<void> {
  const providerRows = PROVIDERS.map((p, i) => ({
    id: plan.providerRows[i].id,
    organization_id: orgId,
    name: p.name,
    contact_name: p.contact_name,
    email: p.email,
    phone: p.phone,
    address: p.address,
    notes: p.notes ?? null,
    active: true,
    created_at: plan.providerRows[i].created_at,
  }));
  check((await supabase.from("providers").insert(providerRows)).error, "insert providers");

  const productRows = PRODUCTS.map((p, i) => ({
    id: plan.productRows[i].id,
    organization_id: orgId,
    ean: p.ean,
    name: p.name,
    description: p.description ?? null,
    unit: p.unit,
    presentation: p.presentation,
    category: p.category,
    criticality: p.criticality,
    active: true,
    created_at: plan.productRows[i].created_at,
  }));
  check((await supabase.from("products").insert(productRows)).error, "insert products");

  check(
    (
      await supabase.from("provider_products").insert(
        plan.providerProducts.map((pp) => ({ ...pp, organization_id: orgId }))
      )
    ).error,
    "insert provider_products"
  );

  const receptorRows = RECEPTORS.map((r, i) => ({
    id: plan.receptorRows[i].id,
    organization_id: orgId,
    name: r.name,
    external_id: r.external_id ?? null,
    patient_type: r.patient_type,
    phone: r.phone ?? null,
    email: r.email ?? null,
    notes: r.notes ?? null,
    active: true,
    created_at: plan.receptorRows[i].created_at,
  }));
  check((await supabase.from("receptors").insert(receptorRows)).error, "insert receptors");

  check(
    (
      await supabase.from("purchases").insert(
        plan.purchases.map((p) => ({
          id: p.id,
          organization_id: orgId,
          created_by: p.created_by,
          provider_id: p.provider_id,
          supplier: p.supplier,
          status: p.status,
          notes: p.notes,
          created_at: p.created_at,
          received_at: p.received_at,
        }))
      )
    ).error,
    "insert purchases"
  );

  const items = plan.purchases.flatMap((p) =>
    p.items.map((it) => ({
      id: it.id,
      purchase_id: p.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      accepted_quantity: it.accepted_quantity,
      expiry_date: it.expiry_date,
    }))
  );
  await chunked(items, async (batch) => {
    check((await supabase.from("purchase_items").insert(batch)).error, "insert purchase_items");
  });

  // Sorted by created_at, so a compensating movement is always inserted after
  // the movement its corrects_movement_id points at.
  await chunked(plan.movements, async (batch) => {
    check(
      (
        await supabase
          .from("stock_movements")
          .insert(batch.map((m) => ({ ...m, organization_id: orgId })))
      ).error,
      "insert stock_movements"
    );
  });

  await chunked(plan.batches, async (batch) => {
    check(
      (
        await supabase
          .from("stock_batches")
          .insert(batch.map((b) => ({ ...b, organization_id: orgId })))
      ).error,
      "insert stock_batches"
    );
  });

  check(
    (
      await supabase.from("stock").insert(plan.stock.map((s) => ({ ...s, organization_id: orgId })))
    ).error,
    "insert stock"
  );

  check(
    (
      await supabase.from("predictive_settings").insert({
        organization_id: orgId,
        lead_time_days: null, // auto: averaged from the seeded purchase history
        coverage_days: 30,
        safety_days_vital: 7,
        safety_days_essential: 3,
        safety_days_desirable: 0,
      })
    ).error,
    "insert predictive_settings"
  );

  check(
    (
      await supabase.from("alert_settings").insert({
        organization_id: orgId,
        low_stock_enabled: true,
        expiry_enabled: true,
        reorder_enabled: true,
        expiry_days_ahead: 30,
      })
    ).error,
    "insert alert_settings"
  );
}

// --- verification -----------------------------------------------------------

async function verifyInvariants(supabase: Db, orgId: string): Promise<void> {
  const [{ data: stock }, { data: batches }, movements] = await Promise.all([
    supabase.from("stock").select("product_id, quantity").eq("organization_id", orgId),
    supabase
      .from("stock_batches")
      .select("product_id, expiry_date, quantity")
      .eq("organization_id", orgId),
    // Paged — PostgREST returns at most 1000 rows, so an unpaged read here
    // would "prove" the invariant against a truncated set.
    fetchAllRows<{ product_id: string; type: string; quantity: number }>((from, to) =>
      supabase
        .from("stock_movements")
        .select("product_id, type, quantity")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
  ]);

  const fromMovements = new Map<string, number>();
  for (const m of movements) {
    const delta = m.type === "entry" || m.type === "adjustment" ? m.quantity : -m.quantity;
    fromMovements.set(m.product_id, (fromMovements.get(m.product_id) ?? 0) + delta);
  }

  const fromBatches = new Map<string, number>();
  for (const b of batches ?? []) {
    fromBatches.set(b.product_id, (fromBatches.get(b.product_id) ?? 0) + b.quantity);
    if (b.quantity < 0) throw new Error(`negative batch: product ${b.product_id}`);
  }

  const problems: string[] = [];
  for (const s of stock ?? []) {
    const batchTotal = fromBatches.get(s.product_id) ?? 0;
    const movementTotal = fromMovements.get(s.product_id) ?? 0;
    if (s.quantity !== batchTotal || s.quantity !== movementTotal) {
      problems.push(
        `product ${s.product_id}: stock=${s.quantity} batches=${batchTotal} movements=${movementTotal}`
      );
    }
  }
  if (problems.length) {
    throw new Error(`stock invariant broken:\n  ${problems.join("\n  ")}`);
  }

  // Every purchase line must be a product the provider actually supplies —
  // create_purchase enforces this, and direct inserts must not undercut it.
  const { data: badLines } = await supabase
    .from("purchase_items")
    .select("id, product_id, purchases!inner(organization_id, provider_id)")
    .eq("purchases.organization_id", orgId)
    .not("purchases.provider_id", "is", null);
  const { data: catalog } = await supabase
    .from("provider_products")
    .select("provider_id, product_id")
    .eq("organization_id", orgId);
  const pairs = new Set((catalog ?? []).map((c) => `${c.provider_id}|${c.product_id}`));
  for (const line of badLines ?? []) {
    const purchase = line.purchases as unknown as { provider_id: string | null };
    if (purchase.provider_id && !pairs.has(`${purchase.provider_id}|${line.product_id}`)) {
      throw new Error(`purchase line ${line.id} is not in its provider's catalog`);
    }
  }

  console.log(`ok    invariants: stock == batches == movements (${stock?.length ?? 0} products)`);
}

async function verifyAccountsIntact(
  supabase: Db,
  orgId: string,
  before: string[]
): Promise<void> {
  const { data: after } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId);
  const ids = (after ?? []).map((p) => p.id).sort();
  if (ids.length !== before.length || ids.some((id, i) => id !== before[i])) {
    throw new Error(
      `PROFILES CHANGED — expected ${before.length} (${before.join(", ")}), got ${ids.length}`
    );
  }
  console.log(`ok    accounts intact: ${ids.length} profiles untouched`);
}

// --- reporting --------------------------------------------------------------

function pad(value: string | number, width: number, right = false): string {
  const text = String(value);
  return right ? text.padStart(width) : text.padEnd(width);
}

const NAME_COL = 30;

function printPlanSummary(plan: SeedPlan): void {
  console.log("\nplanned state (before writing)");
  console.log(
    `  ${pad("producto", NAME_COL)}${pad("narrativa", 17)}${pad("días", 6, true)}` +
      `  ${pad("método", 19)}${pad("stock", 8, true)}${pad("usable", 8, true)}`
  );
  for (const d of plan.diagnostics) {
    console.log(
      `  ${pad(d.name, NAME_COL)}${pad(d.narrative, 17)}${pad(d.consumptionDays, 6, true)}` +
        `  ${pad(d.expectedMethod, 19)}${pad(d.endStock, 8, true)}${pad(d.usableStock, 8, true)}`
    );
  }
}

// Asserts the demo actually shows what it was built to show. A narrative that
// silently failed to land is a bland demo discovered on stage, so it fails here.
function assertNarratives(plan: SeedPlan): void {
  const byMethod = (method: string) =>
    plan.diagnostics.filter((d) => d.expectedMethod === method).length;

  const failures: string[] = [];
  if (byMethod("insufficient_data") !== 1) {
    failures.push(`expected exactly 1 insufficient_data product, got ${byMethod("insufficient_data")}`);
  }
  if (byMethod("average") !== 2) {
    failures.push(`expected exactly 2 average-method products, got ${byMethod("average")}`);
  }
  if (byMethod("regression") < 8) {
    failures.push(`expected at least 8 regression products, got ${byMethod("regression")}`);
  }

  const expired = plan.diagnostics.find((d) => d.narrative === "expired_lot");
  if (!expired || expired.expiredStock <= 0) {
    failures.push("expired_lot product has no expired stock on hand");
  }
  const belowMin = plan.diagnostics.find((d) => d.narrative === "below_min");
  if (!belowMin || belowMin.usableStock > belowMin.minQuantity) {
    failures.push("below_min product is not under its min_quantity");
  }
  for (const d of plan.diagnostics) {
    if (d.endStock < 0) failures.push(`${d.key} ends with negative stock`);
  }

  if (failures.length) {
    throw new Error(`narratives did not land:\n  - ${failures.join("\n  - ")}`);
  }
  console.log("ok    narratives: 1 insufficient_data, 2 average, rest regression");
}

// The real thing: run the app's own predictive read path through an RLS-scoped
// session, so the printed table is what the demo will actually display.
async function reportPredictions(email: string, password: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!anonKey) {
    console.log("skip  prediction report (no NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)");
    return;
  }

  const client = createClient<Database>(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.log(`skip  prediction report (sign-in failed: ${error.message})`);
    return;
  }

  let getPredictions: typeof import("../lib/predictive/data").getPredictions;
  try {
    ({ getPredictions } = await import("../lib/predictive/data"));
  } catch (err) {
    console.log(`skip  prediction report (${err instanceof Error ? err.message : err})`);
    return;
  }

  const { rows, settings } = await getPredictions(client);
  console.log(
    `\npredictive verdict (lead time ${settings?.lead_time_days ?? "auto"}, coverage ${settings?.coverage_days ?? 30} d)`
  );
  console.log(
    `  ${pad("producto", NAME_COL)}${pad("método", 19)}${pad("dem/día", 9, true)}` +
      `${pad("usable", 8, true)}${pad("vencido", 9, true)}${pad("ROP", 7, true)}` +
      `${pad("días", 6, true)}${pad("sugerido", 10, true)}   ${"desperdicio"}`
  );
  for (const r of rows) {
    const p = r.prediction;
    const waste = p.projectedWaste
      ? `${Math.round(p.projectedWaste)} desde ${p.firstWasteDate}`
      : "";
    console.log(
      `  ${pad(r.product_name, NAME_COL)}${pad(p.method, 19)}` +
        `${pad(p.dailyDemand === null ? "—" : p.dailyDemand.toFixed(2), 9, true)}` +
        `${pad(r.usable_stock, 8, true)}${pad(p.expiredStock || "", 9, true)}` +
        `${pad(p.reorderPoint ?? "—", 7, true)}${pad(p.daysUntilReorder ?? "—", 6, true)}` +
        `${pad(p.suggestedQuantity ?? "—", 10, true)}   ${waste}`
    );
  }
  await client.auth.signOut();
}

// --- main -------------------------------------------------------------------

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const email = arg("email", DEFAULT_EMAIL)!;
  const days = Number(arg("days", String(DEFAULT_DAYS)));
  const seed = Number(arg("seed", String(DEFAULT_SEED)));
  const password = arg("password", "prueba123")!;
  const wipeOnly = flag("wipe-only");
  const skipWipe = flag("no-wipe");
  const skipReport = flag("no-report");

  if (!Number.isFinite(days) || days < 20) throw new Error("--days must be >= 20");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const target = await resolveTarget(supabase, email);
  console.log(`org   ${target.orgName} (${target.orgId})`);
  console.log(`user  ${email} — ${target.profileIds.length} profiles in the org\n`);

  if (!skipWipe) {
    await wipe(supabase, target.orgId);
    console.log("ok    wiped operational data (accounts untouched)");
    await verifyAccountsIntact(supabase, target.orgId, target.profileIds);
  }

  if (wipeOnly) {
    console.log("\ndone (wipe only).");
    return;
  }

  const plan = generatePlan({ days, seed, usersByRole: target.usersByRole });
  printPlanSummary(plan);
  assertNarratives(plan);

  await writePlan(supabase, target.orgId, plan);
  console.log(
    `ok    wrote ${plan.movements.length} movements, ${plan.purchases.length} purchases, ` +
      `${plan.batches.length} lots, ${PRODUCTS.length} products`
  );

  await verifyInvariants(supabase, target.orgId);
  await verifyAccountsIntact(supabase, target.orgId, target.profileIds);

  if (!skipReport) await reportPredictions(email, password);

  console.log(
    "\ndone. Alerts are not seeded — they materialise on first login, when the " +
      "dashboard layout runs sweep_alerts() and syncReorderAlerts()."
  );
}

main().catch((err) => {
  console.error(`\nFAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
