// @vitest-environment node
//
// RLS tests for predictive_settings. Runs against the live Supabase project
// using ephemeral orgs and users; skipped entirely when the service-role key
// is not available.
//
//   npm run test:run -- tests/rls
//
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getPredictions } from "@/lib/predictive/data";
import { getProductDetail } from "@/lib/predictive/detail";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

// vitest does not load .env.local; pull the Supabase vars from it if present.
try {
  const envFile = readFileSync(resolve(__dirname, "../../.env.local"), "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {
  // no .env.local — rely on the ambient environment
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(url && publishableKey && serviceKey);

type Client = SupabaseClient<Database>;

const runId = `rls-prd-${Date.now()}`;

describe.skipIf(!hasCreds)("predictive_settings RLS", () => {
  let admin: Client;
  let orgA: string;
  let orgB: string;
  const userIds: string[] = [];

  let chiefA: Client;
  let chiefAId: string;
  let nurseA: Client;
  let chiefB: Client;
  let productId: string;

  async function createUser(role: string, organizationId: string): Promise<{ client: Client; id: string }> {
    const email = `${runId}-${role}-${organizationId.slice(0, 8)}@example.com`;
    const password = `Pw-${runId}!`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role, organization_id: organizationId },
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    userIds.push(data.user.id);

    const client = createClient<Database>(url!, publishableKey!);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`signIn failed: ${signInError.message}`);
    return { client, id: data.user.id };
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, serviceKey!);

    const { data: plan } = await admin.from("plans").select("id").limit(1).single();
    if (!plan) throw new Error("no plan available to create test orgs");

    const { data: orgs, error: orgError } = await admin
      .from("organizations")
      .insert([
        { name: `${runId}-A`, plan_id: plan.id },
        { name: `${runId}-B`, plan_id: plan.id },
      ])
      .select("id, name");
    if (orgError || !orgs || orgs.length !== 2) {
      throw new Error(`org setup failed: ${orgError?.message}`);
    }
    orgA = orgs.find((o) => o.name.endsWith("-A"))!.id;
    orgB = orgs.find((o) => o.name.endsWith("-B"))!.id;

    const [chief, nurse, chiefOther] = await Promise.all([
      createUser("chief_doctor", orgA),
      createUser("nurse", orgA),
      createUser("chief_doctor", orgB),
    ]);
    chiefA = chief.client;
    chiefAId = chief.id;
    nurseA = nurse.client;
    chiefB = chiefOther.client;

    const { data: product, error: productError } = await admin
      .from("products")
      .insert({ organization_id: orgA, name: `${runId}-product` })
      .select("id")
      .single();
    if (productError || !product) throw new Error(`product setup failed: ${productError?.message}`);
    productId = product.id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("predictive_settings").delete().in("organization_id", [orgA, orgB]);
    await admin.from("alerts").delete().in("organization_id", [orgA, orgB]);
    await admin.from("purchase_items").delete().eq("product_id", productId);
    await admin.from("purchases").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock_movements").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock_batches").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock").delete().in("organization_id", [orgA, orgB]);
    await admin.from("products").delete().eq("id", productId);
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id);
    }
    await admin.from("profiles").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
  });

  it("only chief_doctor can create the org's settings row", async () => {
    const { error: denied } = await nurseA.from("predictive_settings").upsert({
      organization_id: orgA,
      lead_time_days: 10,
      coverage_days: 20,
    });
    expect(denied).not.toBeNull();

    const { error } = await chiefA.from("predictive_settings").upsert({
      organization_id: orgA,
      lead_time_days: 10,
      coverage_days: 20,
    });
    expect(error).toBeNull();
  });

  it("org members read their own org's settings; other orgs see nothing", async () => {
    const { data: mine } = await nurseA
      .from("predictive_settings")
      .select("lead_time_days, coverage_days");
    expect(mine).toHaveLength(1);
    expect(mine![0].lead_time_days).toBe(10);
    expect(mine![0].coverage_days).toBe(20);

    const { data: foreign } = await chiefB.from("predictive_settings").select("organization_id");
    expect(foreign ?? []).toHaveLength(0);
  });

  it("a chief cannot write settings for another org", async () => {
    const { error } = await chiefB.from("predictive_settings").upsert({
      organization_id: orgA,
      lead_time_days: 1,
      coverage_days: 1,
    });
    expect(error).not.toBeNull();
  });

  it("check constraints reject out-of-range values", async () => {
    const { error: zeroCoverage } = await chiefA.from("predictive_settings").upsert({
      organization_id: orgA,
      lead_time_days: 10,
      coverage_days: 0,
    });
    expect(zeroCoverage).not.toBeNull();

    const { error: hugeCoverage } = await chiefA.from("predictive_settings").upsert({
      organization_id: orgA,
      lead_time_days: 10,
      coverage_days: 400,
    });
    expect(hugeCoverage).not.toBeNull();

    const { error: zeroLead } = await chiefA.from("predictive_settings").upsert({
      organization_id: orgA,
      lead_time_days: 0,
      coverage_days: 20,
    });
    expect(zeroLead).not.toBeNull();
  });

  it("getPredictions assembles demand and settings end-to-end", async () => {
    // 100 in, then 30 out on each of three (backdated) days → 10/day over 9 days.
    const { error: entryError } = await nurseA.rpc("register_stock_movement", {
      p_product_id: productId,
      p_type: "entry",
      p_quantity: 100,
    });
    expect(entryError).toBeNull();

    for (let i = 0; i < 3; i++) {
      const { error } = await nurseA.rpc("register_stock_exit", {
        p_product_id: productId,
        p_quantity: 30,
      });
      expect(error).toBeNull();
    }
    const { data: exits } = await admin
      .from("stock_movements")
      .select("id")
      .eq("product_id", productId)
      .eq("type", "exit")
      .order("created_at", { ascending: true });
    expect(exits).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - (8 - i));
      await admin
        .from("stock_movements")
        .update({ created_at: d.toISOString() })
        .eq("id", exits![i].id);
    }

    const { rows, settings } = await getPredictions(nurseA);
    // Settings row was created by the chief in the earlier test.
    expect(settings).toMatchObject({ lead_time_days: 10, coverage_days: 20 });
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.product_id).toBe(productId);
    expect(r.current_stock).toBe(10);
    // The seeded entry carries no expiry, so the whole aggregate is usable
    // and the FEFO projection reduces to the plain formulas below.
    expect(r.usable_stock).toBe(10);
    expect(r.prediction.expiredStock).toBe(0);
    expect(r.prediction.projectedWaste).toBe(0);
    expect(r.prediction.method).toBe("average");
    expect(r.prediction.dailyDemand).toBeCloseTo(10, 6);
    // ceil(10/day * 10 lead days + 0 min) = 100; stock 10 is far below it.
    expect(r.prediction.reorderPoint).toBe(100);
    expect(r.prediction.daysUntilReorder).toBe(0);
    // ceil(10 * (10 + 20) + 0 - 10)
    expect(r.prediction.suggestedQuantity).toBe(290);
  });

  it("getPredictions nets rectification pairs into the original exit", async () => {
    // Shrink the oldest 30-unit exit to 10; the compensating entry must
    // reduce demand instead of counting as new consumption.
    const { data: exits } = await admin
      .from("stock_movements")
      .select("id")
      .eq("product_id", productId)
      .eq("type", "exit")
      .is("corrects_movement_id", null)
      .order("created_at", { ascending: true });
    const { error: rectifyError } = await nurseA.rpc("rectify_stock_movement", {
      p_movement_id: exits![0].id,
      p_new_quantity: 10,
    });
    expect(rectifyError).toBeNull();

    const { rows } = await getPredictions(nurseA);
    expect(rows).toHaveLength(1);
    // (10 + 30 + 30) / 9 days
    expect(rows[0].prediction.dailyDemand).toBeCloseTo(70 / 9, 6);
    expect(rows[0].current_stock).toBe(30);
  });

  it("accepts null lead time (auto) and custom safety days; rejects out-of-range", async () => {
    const { error: badVital } = await chiefA.from("predictive_settings").upsert({
      organization_id: orgA,
      lead_time_days: 10,
      coverage_days: 20,
      safety_days_vital: 400,
    });
    expect(badVital).not.toBeNull();

    const { error } = await chiefA.from("predictive_settings").upsert({
      organization_id: orgA,
      lead_time_days: null,
      coverage_days: 20,
      safety_days_vital: 5,
      safety_days_essential: 3,
      safety_days_desirable: 0,
    });
    expect(error).toBeNull();

    const { data } = await nurseA
      .from("predictive_settings")
      .select("lead_time_days, safety_days_vital")
      .single();
    expect(data!.lead_time_days).toBeNull();
    expect(data!.safety_days_vital).toBe(5);
  });

  it("criticality raises the reorder point via the org's safety days", async () => {
    // Inventory writers (nurse included) can classify products.
    const { error } = await nurseA
      .from("products")
      .update({ criticality: "vital" })
      .eq("id", productId);
    expect(error).toBeNull();

    const { rows } = await getPredictions(nurseA);
    const r = rows[0];
    const demand = 70 / 9;
    expect(r.criticality).toBe("vital");
    // No received purchases yet → auto lead time falls back to 7.
    expect(r.lead_time_auto).toBe(true);
    expect(r.lead_time_days).toBe(7);
    // safetyStock = max(0, demand x 5); ROP = ceil(demand x 7 + safetyStock)
    expect(r.prediction.safetyStock).toBeCloseTo(demand * 5, 6);
    expect(r.prediction.reorderPoint).toBe(Math.ceil(demand * 7 + demand * 5));
  });

  it("auto lead time averages delivery days from received purchases", async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000).toISOString();
    const { data: purchase, error: purchaseError } = await admin
      .from("purchases")
      .insert({
        organization_id: orgA,
        created_by: chiefAId,
        status: "received",
        created_at: fourDaysAgo,
        received_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(purchaseError).toBeNull();
    const { error: itemError } = await admin.from("purchase_items").insert({
      purchase_id: purchase!.id,
      product_id: productId,
      quantity: 10,
    });
    expect(itemError).toBeNull();

    const { rows } = await getPredictions(nurseA);
    expect(rows[0].lead_time_auto).toBe(true);
    expect(rows[0].lead_time_days).toBe(4);
    const demand = 70 / 9;
    expect(rows[0].prediction.reorderPoint).toBe(Math.ceil(demand * 4 + demand * 5));
  });

  it("getProductDetail returns the 30-day backtest, org-scoped", async () => {
    const detail = await getProductDetail(nurseA, productId);
    expect(detail).not.toBeNull();
    expect(detail!.product.criticality).toBe("vital");
    expect(detail!.row.lead_time_days).toBe(4);
    expect(detail!.backtest.days).toHaveLength(30);
    // All consumption (70 after rectification) falls inside the window…
    const actualSum = detail!.backtest.days.reduce((a, d) => a + d.actual, 0);
    expect(actualSum).toBe(70);
    // …so there is no pre-window history to fit on.
    expect(detail!.backtest.method).toBe("insufficient_data");
    expect(detail!.backtest.days.every((d) => d.projected === null)).toBe(true);

    // Foreign org and malformed ids resolve to null (→ 404 upstream).
    expect(await getProductDetail(chiefB, productId)).toBeNull();
    expect(await getProductDetail(nurseA, "not-a-uuid")).toBeNull();
  });
});
