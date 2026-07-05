// @vitest-environment node
//
// RLS + receive-flow integration tests for purchases / purchase_items.
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

const runId = `rls-pur-${Date.now()}`;

describe.skipIf(!hasCreds)("purchases RLS + receive flow", () => {
  let admin: Client;
  let orgA: string;
  let orgB: string;
  let productA: string;
  const userIds: string[] = [];

  let doctorA: Client; // doctor in org A (purchase writer)
  let adminAssistA: Client; // administrative in org A (read-only)
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

    [doctorA, adminAssistA, chiefB] = await Promise.all([
      createUser("doctor", orgA),
      createUser("administrative", orgA),
      createUser("chief_doctor", orgB),
    ]);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("purchases").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock_movements").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock_batches").delete().in("organization_id", [orgA, orgB]);
    await admin.from("stock").delete().in("organization_id", [orgA, orgB]);
    await admin.from("products").delete().eq("id", productA);
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id);
    }
    await admin.from("profiles").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
  });

  it("administrative cannot create a purchase; doctor can", async () => {
    const { error: deniedError } = await adminAssistA.rpc("create_purchase", {
      p_provider_id: null,
      p_notes: null,
      p_items: [{ product_id: productA, quantity: 3, unit_price: null }],
    });
    expect(deniedError).not.toBeNull();

    const { data: purchaseId, error } = await doctorA.rpc("create_purchase", {
      p_provider_id: null,
      p_notes: `${runId} order`,
      p_items: [{ product_id: productA, quantity: 10, unit_price: 150 }],
    });
    expect(error).toBeNull();
    expect(purchaseId).toBeTruthy();
  });

  it("other orgs cannot see the purchase", async () => {
    const { data } = await chiefB.from("purchases").select("id").eq("organization_id", orgA);
    expect(data ?? []).toHaveLength(0);
  });

  it("receive with partial acceptance updates lines, stock and movements", async () => {
    const { data: purchase } = await doctorA
      .from("purchases")
      .select("id, purchase_items(id, quantity)")
      .eq("notes", `${runId} order`)
      .single();
    expect(purchase).not.toBeNull();
    const line = purchase!.purchase_items[0];

    const { error } = await doctorA.rpc("receive_purchase", {
      p_purchase_id: purchase!.id,
      p_items: [{ id: line.id, accepted_quantity: 7, expiry_date: "2027-01-31" }],
    });
    expect(error).toBeNull();

    const { data: after } = await doctorA
      .from("purchases")
      .select("status, received_at, purchase_items(accepted_quantity, expiry_date)")
      .eq("id", purchase!.id)
      .single();
    expect(after?.status).toBe("received");
    expect(after?.received_at).toBeTruthy();
    expect(after?.purchase_items[0].accepted_quantity).toBe(7);
    expect(after?.purchase_items[0].expiry_date).toBe("2027-01-31");

    // Accepted quantity entered stock through the shared ingress path.
    const { data: stock } = await doctorA
      .from("stock")
      .select("quantity")
      .eq("product_id", productA)
      .single();
    expect(stock?.quantity).toBe(7);

    const { data: batch } = await doctorA
      .from("stock_batches")
      .select("quantity")
      .eq("product_id", productA)
      .eq("expiry_date", "2027-01-31")
      .single();
    expect(batch?.quantity).toBe(7);

    const { data: movements } = await doctorA
      .from("stock_movements")
      .select("type, quantity, notes")
      .eq("product_id", productA);
    expect(movements).toHaveLength(1);
    expect(movements![0].type).toBe("entry");
    expect(movements![0].quantity).toBe(7);
    expect(movements![0].notes).toBe(`purchase:${purchase!.id}`);
  });

  it("a received purchase cannot be received again", async () => {
    const { data: purchase } = await doctorA
      .from("purchases")
      .select("id, purchase_items(id)")
      .eq("notes", `${runId} order`)
      .single();

    const { error } = await doctorA.rpc("receive_purchase", {
      p_purchase_id: purchase!.id,
      p_items: [{ id: purchase!.purchase_items[0].id, accepted_quantity: 1, expiry_date: null }],
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("purchase_not_receivable");
  });

  it("cancelling a draft leaves stock untouched", async () => {
    const { data: purchaseId } = await doctorA.rpc("create_purchase", {
      p_provider_id: null,
      p_notes: `${runId} cancel-me`,
      p_items: [{ product_id: productA, quantity: 5, unit_price: null }],
    });

    const { error } = await doctorA
      .from("purchases")
      .update({ status: "cancelled" })
      .eq("id", purchaseId!);
    expect(error).toBeNull();

    const { data: stock } = await doctorA
      .from("stock")
      .select("quantity")
      .eq("product_id", productA)
      .single();
    expect(stock?.quantity).toBe(7);
  });
});
