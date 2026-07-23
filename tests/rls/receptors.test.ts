// @vitest-environment node
//
// RLS integration tests for receptors (egress destinations) and the
// receptor-aware register_stock_exit RPC.
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

const runId = `rls-test-${Date.now()}`;

describe.skipIf(!hasCreds)("receptors RLS", () => {
  let admin: Client;
  let orgA: string;
  let orgB: string;
  let productA: string;
  let receptorA: string; // created by the nurse in org A
  let receptorB: string; // org B receptor, for cross-org RPC checks
  const userIds: string[] = [];

  let chiefA: Client; // chief_doctor in org A
  let nurseA: Client; // nurse in org A (operations role — manages receptors)
  let doctorA: Client; // doctor in org A (inventory only — no receptor writes)
  let chiefB: Client; // chief_doctor in org B

  async function createUser(role: string, organizationId: string): Promise<Client> {
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
    return client;
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
    productA = product.id;

    const { data: rb, error: rbError } = await admin
      .from("receptors")
      .insert({ organization_id: orgB, name: `${runId}-receptor-B` })
      .select("id")
      .single();
    if (rbError || !rb) throw new Error(`receptor B setup failed: ${rbError?.message}`);
    receptorB = rb.id;

    [chiefA, nurseA, doctorA, chiefB] = await Promise.all([
      createUser("chief_doctor", orgA),
      createUser("nurse", orgA),
      createUser("doctor", orgA),
      createUser("chief_doctor", orgB),
    ]);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("stock_movements").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock_batches").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock").delete().in("organization_id", [orgA, orgB]);
    await admin.from("receptors").delete().in("organization_id", [orgA, orgB]);
    await admin.from("products").delete().eq("id", productA);
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id);
    }
    await admin.from("profiles").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
  });

  it("nurse (operations role) can create a receptor", async () => {
    const { data, error } = await nurseA
      .from("receptors")
      .insert({
        organization_id: orgA,
        name: `${runId}-receptor`,
        patient_type: "social_security",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    receptorA = data!.id;
  });

  it("doctor cannot update a receptor; nurse and chief_doctor can", async () => {
    // Receptors are an "operations" capability: chief_doctor, nurse and
    // administrative, but not doctor (doctor is inventory-only).
    // RLS silently filters non-matching rows on update — assert no row changed.
    const { data: doctorUpdate } = await doctorA
      .from("receptors")
      .update({ name: `${runId}-renamed-by-doctor` })
      .eq("id", receptorA)
      .select("id");
    expect(doctorUpdate ?? []).toHaveLength(0);

    // Update a non-name field so the duplicate-name case below keeps its
    // collision target.
    const { data: nurseUpdate, error: nurseError } = await nurseA
      .from("receptors")
      .update({ phone: "+54 11 4444-4444" })
      .eq("id", receptorA)
      .select("id");
    expect(nurseError).toBeNull();
    expect(nurseUpdate).toHaveLength(1);

    const { data: chiefUpdate, error: chiefError } = await chiefA
      .from("receptors")
      .update({ phone: "+54 11 5555-5555" })
      .eq("id", receptorA)
      .select("id");
    expect(chiefError).toBeNull();
    expect(chiefUpdate).toHaveLength(1);
  });

  it("other orgs cannot read or create receptors across org boundaries", async () => {
    const { data: crossRead } = await chiefB
      .from("receptors")
      .select("id")
      .eq("organization_id", orgA);
    expect(crossRead ?? []).toHaveLength(0);

    const { error: crossInsert } = await chiefB
      .from("receptors")
      .insert({ organization_id: orgA, name: `${runId}-cross` })
      .select("id")
      .single();
    expect(crossInsert).not.toBeNull();
  });

  it("duplicate name (without external_id) and duplicate external_id are rejected", async () => {
    const { error: dupName } = await nurseA
      .from("receptors")
      .insert({ organization_id: orgA, name: `${runId}-RECEPTOR` }) // lower() index
      .select("id")
      .single();
    expect(dupName?.code).toBe("23505");

    const { error: firstExt } = await nurseA
      .from("receptors")
      .insert({ organization_id: orgA, name: `${runId}-ext-1`, external_id: `${runId}-HC-1` })
      .select("id")
      .single();
    expect(firstExt).toBeNull();

    const { error: dupExt } = await nurseA
      .from("receptors")
      .insert({ organization_id: orgA, name: `${runId}-ext-2`, external_id: `${runId}-HC-1` })
      .select("id")
      .single();
    expect(dupExt?.code).toBe("23505");
  });

  it("register_stock_exit rejects a receptor from another org", async () => {
    // Seed stock so the exit would otherwise succeed.
    const { error: entryError } = await nurseA.rpc("register_stock_movement", {
      p_product_id: productA,
      p_type: "entry",
      p_quantity: 10,
      p_expiry_date: "2027-01-31",
    });
    expect(entryError).toBeNull();

    const { error } = await nurseA.rpc("register_stock_exit", {
      p_product_id: productA,
      p_quantity: 1,
      p_receptor_id: receptorB,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("receptor_not_found");
  });

  it("multi-batch exit stamps the receptor on every emitted movement row", async () => {
    // Second batch with an earlier expiry: the FEFO loop must consume it first
    // and spill into the 2027 batch, emitting two 'exit' rows.
    const { error: entryError } = await nurseA.rpc("register_stock_movement", {
      p_product_id: productA,
      p_type: "entry",
      p_quantity: 2,
      p_expiry_date: "2026-08-01",
    });
    expect(entryError).toBeNull();

    const { error } = await nurseA.rpc("register_stock_exit", {
      p_product_id: productA,
      p_quantity: 5,
      p_receptor_id: receptorA,
    });
    expect(error).toBeNull();

    const { data: exits } = await nurseA
      .from("stock_movements")
      .select("quantity, expiry_date, receptor_id")
      .eq("product_id", productA)
      .eq("type", "exit");
    expect(exits).toHaveLength(2);
    for (const row of exits!) {
      expect(row.receptor_id).toBe(receptorA);
    }
    expect(exits!.reduce((sum, r) => sum + r.quantity, 0)).toBe(5);
  });

  it("an inactive receptor is rejected by register_stock_exit", async () => {
    await chiefA.from("receptors").update({ active: false }).eq("id", receptorA);

    const { error } = await nurseA.rpc("register_stock_exit", {
      p_product_id: productA,
      p_quantity: 1,
      p_receptor_id: receptorA,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("receptor_not_found");
  });
});
