// @vitest-environment node
//
// RLS + lifecycle integration tests for the sync_reorder_alerts RPC
// (reorder_suggested alerts fed by the predictive model). Runs against the
// live Supabase project using ephemeral orgs and users; skipped entirely
// when the service-role key is not available.
//
//   npm run test:run -- tests/rls
//
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

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

const runId = `rls-rop-${Date.now()}`;

describe.skipIf(!hasCreds)("reorder alerts RLS + lifecycle", () => {
  let admin: Client;
  let orgA: string;
  let orgB: string;
  let productId: string;
  const userIds: string[] = [];

  let chiefA: Client; // chief_doctor in org A (manages settings/thresholds)
  let nurseA: Client; // nurse in org A (moves stock, triggers syncs)
  let chiefB: Client; // chief_doctor in org B

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

  async function activeReorderAlerts() {
    const { data } = await admin
      .from("alerts")
      .select("id, quantity, threshold")
      .eq("organization_id", orgA)
      .eq("product_id", productId)
      .eq("type", "reorder_suggested")
      .eq("status", "active");
    return data ?? [];
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

    const { data: product, error: productError } = await admin
      .from("products")
      .insert({ organization_id: orgA, name: `${runId}-product` })
      .select("id")
      .single();
    if (productError || !product) throw new Error(`product setup failed: ${productError?.message}`);
    productId = product.id;

    const [chief, nurse, chiefOther] = await Promise.all([
      createUser("chief_doctor", orgA),
      createUser("nurse", orgA),
      createUser("chief_doctor", orgB),
    ]);
    chiefA = chief.client;
    nurseA = nurse.client;
    chiefB = chiefOther.client;

    // Baseline stock: 10 on hand, min_quantity 0 (no low_stock interference).
    const { error: entryError } = await nurseA.rpc("register_stock_movement", {
      p_product_id: productId,
      p_type: "entry",
      p_quantity: 10,
    });
    if (entryError) throw new Error(`stock setup failed: ${entryError.message}`);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("alerts").delete().in("organization_id", [orgA, orgB]);
    await admin.from("alert_settings").delete().in("organization_id", [orgA, orgB]);
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

  // Payload item shape the model pushes (lib/predictive/alerts.ts): the DB
  // fires on `should_fire` and snapshots `usable_stock` rather than re-reading
  // stock.quantity.
  function item(fields: { reorder_point: number; usable_stock: number; should_fire: boolean }) {
    return { product_id: productId, ...fields };
  }

  it("fires an active alert with usable-stock and reorder-point snapshots", async () => {
    const { error } = await nurseA.rpc("sync_reorder_alerts", {
      p_items: [item({ reorder_point: 20, usable_stock: 10, should_fire: true })],
    });
    expect(error).toBeNull();

    const alerts = await activeReorderAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].quantity).toBe(10); // usable stock the model reasoned about
    expect(alerts[0].threshold).toBe(20); // submitted reorder point
  });

  it("rejects malformed payloads and direct inserts of the type", async () => {
    const { error: badPayload } = await nurseA.rpc("sync_reorder_alerts", {
      p_items: { not: "array" },
    });
    expect(badPayload).not.toBeNull();
    expect(badPayload!.message).toContain("invalid_payload");

    const { error: insertError } = await nurseA.from("alerts").insert({
      organization_id: orgA,
      product_id: productId,
      type: "reorder_suggested",
    });
    expect(insertError).not.toBeNull();
  });

  it("cannot fabricate or touch alerts across tenants", async () => {
    // org B submits org A's product id: the org-pinned stock join matches
    // nothing, so nothing fires in B and A's alert is untouched.
    const { error } = await chiefB.rpc("sync_reorder_alerts", {
      p_items: [item({ reorder_point: 999, usable_stock: 0, should_fire: true })],
    });
    expect(error).toBeNull();

    const { data: foreign } = await chiefB.from("alerts").select("id");
    expect(foreign ?? []).toHaveLength(0);

    const alerts = await activeReorderAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].threshold).toBe(20);
  });

  it("refreshes the active alert in place instead of duplicating it", async () => {
    const { error } = await nurseA.rpc("sync_reorder_alerts", {
      p_items: [item({ reorder_point: 15, usable_stock: 10, should_fire: true })],
    });
    expect(error).toBeNull();

    const alerts = await activeReorderAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].threshold).toBe(15);
  });

  it("stays fired on the model's verdict even when raw stock is above the reorder point", async () => {
    // Raise the aggregate well clear of the reorder point. Under the old rule
    // (stock.quantity <= reorder_point) this alert would have resolved, since
    // 110 > 15 — exactly the blind spot when expired lots pad the aggregate
    // while usable stock sits below the point.
    const { error: entryError } = await nurseA.rpc("register_stock_movement", {
      p_product_id: productId,
      p_type: "entry",
      p_quantity: 100, // 10 + 100 = 110
    });
    expect(entryError).toBeNull();

    const { error } = await nurseA.rpc("sync_reorder_alerts", {
      p_items: [item({ reorder_point: 15, usable_stock: 40, should_fire: true })],
    });
    expect(error).toBeNull();

    const alerts = await activeReorderAlerts();
    expect(alerts).toHaveLength(1);
    // Snapshot is the usable stock the model used, not the 110 aggregate.
    expect(alerts[0].quantity).toBe(40);
    expect(alerts[0].threshold).toBe(15);
  });

  it("stays silent when the model says no, even with stock below the reorder point", async () => {
    // The inverse blind spot: the old rule would have fired here (110 <= 200).
    // The DB no longer second-guesses the model, so this resolves instead.
    const { error } = await nurseA.rpc("sync_reorder_alerts", {
      p_items: [item({ reorder_point: 200, usable_stock: 110, should_fire: false })],
    });
    expect(error).toBeNull();
    expect(await activeReorderAlerts()).toHaveLength(0);
  });

  it("re-arms as a new row once the model flags it again", async () => {
    const { error } = await nurseA.rpc("sync_reorder_alerts", {
      p_items: [item({ reorder_point: 200, usable_stock: 110, should_fire: true })],
    });
    expect(error).toBeNull();

    const { data: all } = await admin
      .from("alerts")
      .select("status")
      .eq("product_id", productId)
      .eq("type", "reorder_suggested")
      .order("triggered_at", { ascending: true });
    expect(all).toHaveLength(2);
    expect(all![0].status).toBe("resolved");
    expect(all![1].status).toBe("active");
  });

  it("coexists with a low_stock alert on the same product", async () => {
    // min_quantity 120 > stock 110 → the stock trigger fires low_stock while
    // the reorder alert from the previous test is still active.
    const { error } = await chiefA
      .from("stock")
      .update({ min_quantity: 120 })
      .eq("product_id", productId)
      .eq("organization_id", orgA);
    expect(error).toBeNull();

    const { data: active } = await admin
      .from("alerts")
      .select("type")
      .eq("product_id", productId)
      .eq("status", "active");
    const types = (active ?? []).map((a) => a.type).sort();
    expect(types).toEqual(["low_stock", "reorder_suggested"]);
  });

  it("resolves the alert when the product drops out of the payload (no data basis)", async () => {
    const { error } = await nurseA.rpc("sync_reorder_alerts", { p_items: [] });
    expect(error).toBeNull();

    expect(await activeReorderAlerts()).toHaveLength(0);

    // The unrelated low_stock alert must survive an empty reorder sync.
    const { data: lowStock } = await admin
      .from("alerts")
      .select("id")
      .eq("product_id", productId)
      .eq("type", "low_stock")
      .eq("status", "active");
    expect(lowStock).toHaveLength(1);
  });

  it("reorder_enabled = false blocks sync and the sweep clears actives", async () => {
    // Re-arm first.
    const { error: refire } = await nurseA.rpc("sync_reorder_alerts", {
      p_items: [item({ reorder_point: 200, usable_stock: 110, should_fire: true })],
    });
    expect(refire).toBeNull();
    expect(await activeReorderAlerts()).toHaveLength(1);

    const { error: settingsError } = await chiefA.from("alert_settings").upsert({
      organization_id: orgA,
      reorder_enabled: false,
    });
    expect(settingsError).toBeNull();

    // The sweep clears lingering reorder alerts of the disabled type.
    const { error: sweepError } = await nurseA.rpc("sweep_alerts");
    expect(sweepError).toBeNull();
    expect(await activeReorderAlerts()).toHaveLength(0);

    // And a sync while disabled fires nothing.
    const { error: blockedSync } = await nurseA.rpc("sync_reorder_alerts", {
      p_items: [item({ reorder_point: 200, usable_stock: 110, should_fire: true })],
    });
    expect(blockedSync).toBeNull();
    expect(await activeReorderAlerts()).toHaveLength(0);
  });
});
