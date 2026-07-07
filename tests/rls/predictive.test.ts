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
      ordering_cost: 500,
      holding_cost_rate: 25,
    });
    expect(denied).not.toBeNull();

    const { error } = await chiefA.from("predictive_settings").upsert({
      organization_id: orgA,
      ordering_cost: 500,
      holding_cost_rate: 25,
      lead_time_days: 10,
    });
    expect(error).toBeNull();
  });

  it("org members read their own org's settings; other orgs see nothing", async () => {
    const { data: mine } = await nurseA
      .from("predictive_settings")
      .select("ordering_cost, holding_cost_rate, lead_time_days");
    expect(mine).toHaveLength(1);
    expect(mine![0].ordering_cost).toBe(500);
    expect(mine![0].lead_time_days).toBe(10);

    const { data: foreign } = await chiefB.from("predictive_settings").select("organization_id");
    expect(foreign ?? []).toHaveLength(0);
  });

  it("a chief cannot write settings for another org", async () => {
    const { error } = await chiefB.from("predictive_settings").upsert({
      organization_id: orgA,
      ordering_cost: 1,
      holding_cost_rate: 1,
    });
    expect(error).not.toBeNull();
  });

  it("check constraints reject out-of-range values", async () => {
    const { error: badRate } = await chiefA.from("predictive_settings").upsert({
      organization_id: orgA,
      ordering_cost: 500,
      holding_cost_rate: 150,
    });
    expect(badRate).not.toBeNull();

    const { error: badCost } = await chiefA.from("predictive_settings").upsert({
      organization_id: orgA,
      ordering_cost: 0,
      holding_cost_rate: 25,
    });
    expect(badCost).not.toBeNull();
  });

  it("getPredictions assembles demand, prices and settings end-to-end", async () => {
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

    // Purchase history → unit cost 40 (cancelled purchases must not count).
    const { data: purchase } = await admin
      .from("purchases")
      .insert({ organization_id: orgA, created_by: chiefAId, status: "received" })
      .select("id")
      .single();
    const { data: cancelled } = await admin
      .from("purchases")
      .insert({ organization_id: orgA, created_by: chiefAId, status: "cancelled" })
      .select("id")
      .single();
    await admin.from("purchase_items").insert([
      { purchase_id: purchase!.id, product_id: productId, quantity: 100, unit_price: 40 },
      { purchase_id: cancelled!.id, product_id: productId, quantity: 100, unit_price: 9999 },
    ]);

    const { rows, settings } = await getPredictions(nurseA);
    // Settings row was created by the chief in the earlier test.
    expect(settings).toMatchObject({ ordering_cost: 500, holding_cost_rate: 25, lead_time_days: 10 });
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.product_id).toBe(productId);
    expect(r.current_stock).toBe(10);
    expect(r.unit_cost).toBe(40);
    expect(r.prediction.method).toBe("average");
    expect(r.prediction.dailyDemand).toBeCloseTo(10, 6);
    // ceil(10/day * 10 lead days + 0 min) = 100; stock 10 is far below it.
    expect(r.prediction.reorderPoint).toBe(100);
    expect(r.prediction.daysUntilReorder).toBe(0);
    // ceil(sqrt(2 * 3650 * 500 / (0.25 * 40)))
    expect(r.prediction.eoq).toBe(605);
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
});
