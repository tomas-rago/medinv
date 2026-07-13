// @vitest-environment node
//
// RLS integration tests for providers / provider_products.
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

describe.skipIf(!hasCreds)("providers RLS", () => {
  let admin: Client;
  let orgA: string;
  let orgB: string;
  let productA: string;
  const userIds: string[] = [];

  let chiefA: Client; // chief_doctor in org A
  let doctorA: Client; // doctor in org A
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

    [chiefA, doctorA, chiefB] = await Promise.all([
      createUser("chief_doctor", orgA),
      createUser("doctor", orgA),
      createUser("chief_doctor", orgB),
    ]);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("provider_products").delete().in("organization_id", [orgA, orgB]);
    await admin.from("providers").delete().in("organization_id", [orgA, orgB]);
    await admin.from("products").delete().eq("id", productA);
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id);
    }
    await admin.from("profiles").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
  });

  it("chief_doctor can create a provider in their org", async () => {
    const { data, error } = await chiefA
      .from("providers")
      .insert({ organization_id: orgA, name: `${runId}-provider` })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it("doctor cannot create a provider", async () => {
    const { error } = await doctorA
      .from("providers")
      .insert({ organization_id: orgA, name: `${runId}-provider-doctor` })
      .select("id")
      .single();
    expect(error).not.toBeNull();
  });

  it("chief_doctor cannot create a provider in another org", async () => {
    const { error } = await chiefB
      .from("providers")
      .insert({ organization_id: orgA, name: `${runId}-provider-cross` })
      .select("id")
      .single();
    expect(error).not.toBeNull();
  });

  it("org members can read their org's providers; other orgs cannot", async () => {
    const { data: mine, error: mineError } = await doctorA
      .from("providers")
      .select("id, name")
      .eq("organization_id", orgA);
    expect(mineError).toBeNull();
    expect(mine?.some((p) => p.name === `${runId}-provider`)).toBe(true);

    const { data: theirs } = await chiefB
      .from("providers")
      .select("id")
      .eq("organization_id", orgA);
    expect(theirs ?? []).toHaveLength(0);
  });

  it("chief_doctor can associate products; doctor cannot; other org cannot read", async () => {
    const { data: provider } = await chiefA
      .from("providers")
      .select("id")
      .eq("organization_id", orgA)
      .eq("name", `${runId}-provider`)
      .single();
    expect(provider).not.toBeNull();

    const { error: insertError } = await chiefA
      .from("provider_products")
      .insert({ organization_id: orgA, provider_id: provider!.id, product_id: productA });
    expect(insertError).toBeNull();

    const { error: doctorInsertError } = await doctorA
      .from("provider_products")
      .insert({ organization_id: orgA, provider_id: provider!.id, product_id: productA });
    expect(doctorInsertError).not.toBeNull();

    const { data: crossRead } = await chiefB
      .from("provider_products")
      .select("id")
      .eq("organization_id", orgA);
    expect(crossRead ?? []).toHaveLength(0);
  });
});
