// Throwaway end-to-end verification for the chief-doctor AI dashboard summary.
// Creates an ephemeral AI-enabled org/users on the live project, mints
// @supabase/ssr cookies, drives the dev server over HTTP (including a REAL
// model call to /api/ai/dashboard-summary), and inspects results + DB rows.
// Cleans up after itself. Run: npx tsx --env-file=.env.local <thisfile>
import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import type { Database } from "./lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const pk = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const sk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = "http://localhost:3000";

const runId = `verify-aisum-${Date.now()}`;
const admin = createClient<Database>(url, sk) as SupabaseClient<Database>;

const userIds: string[] = [];
let orgId: string | undefined;
let productId: string | undefined;

let failures = 0;
function check(label: string, ok: boolean, extra?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

async function createUser(role: string, fullName: string) {
  const email = `${runId}-${role}@example.com`;
  const password = `Pw-${runId}!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role, organization_id: orgId },
  });
  if (error || !data.user) throw new Error(`createUser ${role}: ${error?.message}`);
  userIds.push(data.user.id);
  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: data.user.id, organization_id: orgId!, full_name: fullName, role });
  if (pErr) throw new Error(`profiles upsert ${role}: ${pErr.message}`);
  const client = createClient<Database>(url, pk);
  const { data: signIn, error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr || !signIn.session) throw new Error(`signIn ${role}: ${sErr?.message}`);
  return { client, session: signIn.session };
}

function cookieFor(session: Session) {
  const ref = new URL(url).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0; i * MAX < value.length; i++) {
    parts.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  }
  return parts.join("; ");
}

async function get(path: string, session: Session) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookieFor(session) },
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}

async function postSummary(session: Session) {
  const res = await fetch(`${BASE}/api/ai/dashboard-summary`, {
    method: "POST",
    headers: { cookie: cookieFor(session), "Content-Type": "application/json" },
    body: "{}",
    redirect: "manual",
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function cleanup() {
  if (!orgId) return;
  await admin.from("ai_dashboard_summaries").delete().eq("organization_id", orgId);
  await admin.from("token_usage").delete().eq("organization_id", orgId);
  await admin.from("alerts").delete().eq("organization_id", orgId);
  await admin.from("alert_settings").delete().eq("organization_id", orgId);
  await admin.from("predictive_settings").delete().eq("organization_id", orgId);
  await admin.from("stock_movements").delete().eq("organization_id", orgId);
  await admin.from("stock_batches").delete().eq("organization_id", orgId);
  await admin.from("stock").delete().eq("organization_id", orgId);
  await admin.from("products").delete().eq("organization_id", orgId);
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  await admin.from("profiles").delete().eq("organization_id", orgId);
  await admin.from("organizations").delete().eq("id", orgId);
  console.log("cleanup done");
}

async function main() {
  // AI-enabled plan required; skip loudly if the project has none.
  const { data: plans } = await admin.from("plans").select("id, token_limit_per_month");
  const aiPlan = plans?.find((p) => (p.token_limit_per_month ?? 0) > 0);
  if (!aiPlan) {
    console.log("SKIP  no AI-enabled plan on this project; cannot verify the summary.");
    return;
  }
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: runId, plan_id: aiPlan.id })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`org: ${orgErr?.message}`);
  orgId = org.id;

  const { data: product, error: prodErr } = await admin
    .from("products")
    .insert({ organization_id: orgId, name: `${runId}-gasas` })
    .select("id")
    .single();
  if (prodErr || !product) throw new Error(`product: ${prodErr?.message}`);
  productId = product.id;

  const chief = await createUser("chief_doctor", "María Pérez");
  const nurse = await createUser("nurse", "Ana Ruiz");

  // Consumption history so predictions have something to summarize (same
  // recipe as verify-home.mts): 100 in, 3×30 out backdated → 10/day, stock 10.
  await chief.client.rpc("register_stock_movement", {
    p_product_id: productId,
    p_type: "entry",
    p_quantity: 100,
  });
  for (let i = 0; i < 3; i++) {
    await chief.client.rpc("register_stock_exit", { p_product_id: productId, p_quantity: 30 });
  }
  const { data: exits } = await admin
    .from("stock_movements")
    .select("id")
    .eq("product_id", productId)
    .eq("type", "exit")
    .order("created_at", { ascending: true });
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (8 - i));
    await admin.from("stock_movements").update({ created_at: d.toISOString() }).eq("id", exits![i].id);
  }
  await chief.client
    .from("predictive_settings")
    .upsert({ organization_id: orgId, lead_time_days: 10, coverage_days: 20 });

  // ---- 1. First dashboard visit: no cached row → card shell renders ----
  const first = await get("/dashboard", chief.session);
  check("chief /dashboard 200", first.status === 200, `got ${first.status}`);
  check("card title renders (>-anchored)", first.html.includes(">Resumen del panel con IA<"));

  // ---- 2. Nurse cannot generate (403) and does NOT see the card ----
  const nursePost = await postSummary(nurse.session);
  check("nurse POST → 403", nursePost.status === 403, `got ${nursePost.status}`);
  check("nurse POST error no_ai_access", nursePost.json?.error === "no_ai_access", JSON.stringify(nursePost.json));
  const nurseHome = await get("/dashboard", nurse.session);
  check("nurse does NOT see the card", !nurseHome.html.includes(">Resumen del panel con IA<"));

  // ---- 3. Chief generates: real model call → structured blob ----
  console.log("… calling the model (chief POST) …");
  const gen = await postSummary(chief.session);
  check("chief POST → 200", gen.status === 200, `got ${gen.status} ${JSON.stringify(gen.json)?.slice(0, 200)}`);
  const content = gen.json?.content;
  check("response ok:true", gen.json?.ok === true);
  check("content.headline is a non-empty string", typeof content?.headline === "string" && content.headline.length > 0);
  check("content.summary is a non-empty string", typeof content?.summary === "string" && content.summary.length > 0);
  check("content.actions is an array", Array.isArray(content?.actions));
  check("content.chart is object or null", content?.chart === null || typeof content?.chart === "object");
  if (content?.chart) {
    check("chart.type in {bar,hbar}", ["bar", "hbar"].includes(content.chart.type), content.chart.type);
    check("chart.points has 2-8 entries", content.chart.points?.length >= 2 && content.chart.points?.length <= 8, `${content.chart.points?.length}`);
  } else {
    console.log("INFO  model chose no chart (chart: null) — allowed.");
  }
  check("generatedAt present", typeof gen.json?.generatedAt === "string");

  // ---- 4. Row persisted + token usage metered ----
  const { data: rows } = await admin
    .from("ai_dashboard_summaries")
    .select("organization_id, generated_by, content")
    .eq("organization_id", orgId);
  check("exactly one cached row for org", rows?.length === 1, `count=${rows?.length}`);
  check("row generated_by = chief", rows?.[0]?.generated_by === userIds[0]);

  const { data: usage } = await admin
    .from("token_usage")
    .select("input_tokens, output_tokens")
    .eq("organization_id", orgId);
  check("token_usage row inserted", (usage?.length ?? 0) >= 1, `count=${usage?.length}`);
  check("token_usage has tokens > 0", (usage?.[0]?.input_tokens ?? 0) + (usage?.[0]?.output_tokens ?? 0) > 0);

  // ---- 5. Second visit: cached blob renders server-side (no new call) ----
  const second = await get("/dashboard", chief.session);
  const headline = content?.headline as string;
  check(
    "cached headline rendered in SSR HTML",
    typeof headline === "string" && second.html.includes(headline),
    headline?.slice(0, 60)
  );
  const { data: rows2 } = await admin
    .from("ai_dashboard_summaries")
    .select("organization_id")
    .eq("organization_id", orgId);
  check("still exactly one row after revisit (no re-fire)", rows2?.length === 1, `count=${rows2?.length}`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("SCRIPT ERROR:", e);
    process.exitCode = 1;
  })
  .finally(cleanup);
