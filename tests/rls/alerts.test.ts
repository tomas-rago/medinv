// @vitest-environment node
//
// RLS + lifecycle integration tests for alerts / alert_settings.
// Runs against the live Supabase project using ephemeral orgs and users;
// skipped entirely when the service-role key is not available.
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

const runId = `rls-alr-${Date.now()}`;

function isoDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!hasCreds)("alerts RLS + lifecycle", () => {
  let admin: Client;
  let orgA: string;
  let orgB: string;
  let productLow: string; // low-stock scenario
  let productExp: string; // expiry scenario
  const userIds: string[] = [];

  let chiefA: Client; // chief_doctor in org A (manages settings/thresholds)
  let nurseA: Client; // nurse in org A (moves stock)
  let adminAssistA: Client; // administrative in org A (read + acknowledge only)
  let adminAssistAId: string;
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

    const { data: products, error: productError } = await admin
      .from("products")
      .insert([
        { organization_id: orgA, name: `${runId}-low` },
        { organization_id: orgA, name: `${runId}-exp` },
      ])
      .select("id, name");
    if (productError || !products || products.length !== 2) {
      throw new Error(`product setup failed: ${productError?.message}`);
    }
    productLow = products.find((p) => p.name.endsWith("-low"))!.id;
    productExp = products.find((p) => p.name.endsWith("-exp"))!.id;

    const [chief, nurse, assist, chiefOther] = await Promise.all([
      createUser("chief_doctor", orgA),
      createUser("nurse", orgA),
      createUser("administrative", orgA),
      createUser("chief_doctor", orgB),
    ]);
    chiefA = chief.client;
    nurseA = nurse.client;
    adminAssistA = assist.client;
    adminAssistAId = assist.id;
    chiefB = chiefOther.client;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("alerts").delete().in("organization_id", [orgA, orgB]);
    await admin.from("alert_settings").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock_movements").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock_batches").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock").delete().in("organization_id", [orgA, orgB]);
    await admin.from("products").delete().in("id", [productLow, productExp]);
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id);
    }
    await admin.from("profiles").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
  });

  it("no alert while stock is above the threshold", async () => {
    const { error: entryError } = await nurseA.rpc("register_stock_movement", {
      p_product_id: productLow,
      p_type: "entry",
      p_quantity: 10,
    });
    expect(entryError).toBeNull();

    // chief raises the per-product threshold; 10 > 5 → still no alert.
    const { error: minError } = await chiefA
      .from("stock")
      .update({ min_quantity: 5 })
      .eq("product_id", productLow)
      .eq("organization_id", orgA);
    expect(minError).toBeNull();

    const { data: alerts } = await adminAssistA
      .from("alerts")
      .select("id")
      .eq("product_id", productLow)
      .eq("status", "active");
    expect(alerts ?? []).toHaveLength(0);
  });

  it("crossing the threshold fires a low_stock alert, invisible to other orgs", async () => {
    const { error } = await nurseA.rpc("register_stock_exit", {
      p_product_id: productLow,
      p_quantity: 6,
    });
    expect(error).toBeNull();

    const { data: alerts } = await adminAssistA
      .from("alerts")
      .select("id, type, status, quantity, threshold")
      .eq("product_id", productLow)
      .eq("status", "active");
    expect(alerts).toHaveLength(1);
    expect(alerts![0].type).toBe("low_stock");
    expect(alerts![0].quantity).toBe(4);
    expect(alerts![0].threshold).toBe(5);

    const { data: foreign } = await chiefB.from("alerts").select("id");
    expect(foreign ?? []).toHaveLength(0);
  });

  it("members can acknowledge but cannot resolve or insert alerts", async () => {
    const { data: alert } = await adminAssistA
      .from("alerts")
      .select("id")
      .eq("product_id", productLow)
      .eq("status", "active")
      .single();

    const { error: ackError } = await adminAssistA
      .from("alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: adminAssistAId })
      .eq("id", alert!.id);
    expect(ackError).toBeNull();

    // status is not covered by the column-level update grant
    const { error: resolveError } = await adminAssistA
      .from("alerts")
      .update({ status: "resolved" })
      .eq("id", alert!.id);
    expect(resolveError).not.toBeNull();

    // and direct inserts are revoked entirely
    const { error: insertError } = await adminAssistA.from("alerts").insert({
      organization_id: orgA,
      product_id: productLow,
      type: "low_stock",
    });
    expect(insertError).not.toBeNull();
  });

  it("auto-resolves when the condition clears and re-arms on recurrence", async () => {
    const { error: entryError } = await nurseA.rpc("register_stock_movement", {
      p_product_id: productLow,
      p_type: "entry",
      p_quantity: 10, // 4 + 10 = 14 > 5 → resolves
    });
    expect(entryError).toBeNull();

    const { data: active } = await nurseA
      .from("alerts")
      .select("id")
      .eq("product_id", productLow)
      .eq("status", "active");
    expect(active ?? []).toHaveLength(0);

    const { error: exitError } = await nurseA.rpc("register_stock_exit", {
      p_product_id: productLow,
      p_quantity: 12, // 14 - 12 = 2 <= 5 → fires again as a new row
    });
    expect(exitError).toBeNull();

    const { data: all } = await nurseA
      .from("alerts")
      .select("id, status, resolved_at")
      .eq("product_id", productLow)
      .eq("type", "low_stock")
      .order("triggered_at", { ascending: true });
    expect(all).toHaveLength(2);
    expect(all![0].status).toBe("resolved");
    expect(all![0].resolved_at).toBeTruthy();
    expect(all![1].status).toBe("active");
  });

  it("sweep fires an expiry alert for near-expiry batches, org-scoped", async () => {
    const { error: entryError } = await nurseA.rpc("register_stock_movement", {
      p_product_id: productExp,
      p_type: "entry",
      p_quantity: 8,
      p_expiry_date: isoDate(10), // inside the default 30-day window
    });
    expect(entryError).toBeNull();

    const { error: sweepError } = await adminAssistA.rpc("sweep_alerts");
    expect(sweepError).toBeNull();

    const { data: alerts } = await adminAssistA
      .from("alerts")
      .select("type, status, quantity, expiry_date")
      .eq("product_id", productExp)
      .eq("status", "active");
    expect(alerts).toHaveLength(1);
    expect(alerts![0].type).toBe("expiry");
    expect(alerts![0].quantity).toBe(8);
    expect(alerts![0].expiry_date).toBe(isoDate(10));

    // sweeping from another org neither errors nor leaks anything
    const { error: foreignSweep } = await chiefB.rpc("sweep_alerts");
    expect(foreignSweep).toBeNull();
    const { data: foreign } = await chiefB.from("alerts").select("id");
    expect(foreign ?? []).toHaveLength(0);
  });

  it("only chief_doctor can write alert_settings", async () => {
    const { error: denied } = await adminAssistA.from("alert_settings").upsert({
      organization_id: orgA,
      expiry_days_ahead: 5,
    });
    expect(denied).not.toBeNull();

    const { error } = await chiefA.from("alert_settings").upsert({
      organization_id: orgA,
      expiry_days_ahead: 5,
    });
    expect(error).toBeNull();
  });

  it("shrinking the expiry window resolves alerts that fall outside it", async () => {
    // window is now 5 days; the batch expires in 10 → out of scope
    const { error: sweepError } = await nurseA.rpc("sweep_alerts");
    expect(sweepError).toBeNull();

    const { data: active } = await nurseA
      .from("alerts")
      .select("id")
      .eq("product_id", productExp)
      .eq("status", "active");
    expect(active ?? []).toHaveLength(0);
  });

  it("disabling low_stock alerts resolves the active ones on sweep", async () => {
    const { error: settingsError } = await chiefA
      .from("alert_settings")
      .update({ low_stock_enabled: false })
      .eq("organization_id", orgA);
    expect(settingsError).toBeNull();

    const { error: sweepError } = await adminAssistA.rpc("sweep_alerts");
    expect(sweepError).toBeNull();

    const { data: active } = await adminAssistA
      .from("alerts")
      .select("id")
      .eq("organization_id", orgA)
      .eq("status", "active");
    expect(active ?? []).toHaveLength(0);
  });
});
