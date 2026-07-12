// Throwaway end-to-end verification for the home page + responsive shell.
// Creates an ephemeral org/users on the live project (same pattern as
// tests/rls), mints @supabase/ssr session cookies, drives the dev server
// over HTTP, and inspects the SSR HTML. Cleans up after itself.
import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import type { Database } from "./lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const pk = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const sk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OUT_DIR = process.env.VERIFY_OUT ?? ".verify-out";
const BASE = "http://localhost:3000";

const runId = `verify-home-${Date.now()}`;
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
  const html = await res.text();
  return { status: res.status, html, location: res.headers.get("location") };
}

async function cleanup() {
  if (!orgId) return;
  await admin.from("alerts").delete().eq("organization_id", orgId);
  await admin.from("alert_settings").delete().eq("organization_id", orgId);
  await admin.from("predictive_settings").delete().eq("organization_id", orgId);
  await admin.from("purchase_items").delete().eq("organization_id", orgId);
  await admin.from("purchases").delete().eq("organization_id", orgId);
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
  mkdirSync(OUT_DIR, { recursive: true });

  // Org on an AI-enabled plan so the AI shortcut path renders.
  const { data: plans } = await admin.from("plans").select("id, token_limit_per_month");
  if (!plans?.length) throw new Error("no plans");
  const aiPlan = plans.find((p) => (p.token_limit_per_month ?? 0) > 0) ?? plans[0];
  const hasAiPlan = (aiPlan.token_limit_per_month ?? 0) > 0;
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
  const assist = await createUser("administrative", "Carlos Gómez");

  // Consumption history: 100 in, 3×30 out backdated → 10/day, stock 10,
  // lead 10 + coverage 20 → daysUntilReorder 0, suggested 290 (same recipe
  // as tests/rls/predictive.test.ts).
  const { error: entryErr } = await chief.client.rpc("register_stock_movement", {
    p_product_id: productId,
    p_type: "entry",
    p_quantity: 100,
  });
  if (entryErr) throw new Error(`entry: ${entryErr.message}`);
  for (let i = 0; i < 3; i++) {
    const { error } = await chief.client.rpc("register_stock_exit", {
      p_product_id: productId,
      p_quantity: 30,
    });
    if (error) throw new Error(`exit ${i}: ${error.message}`);
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
  const { error: settingsErr } = await chief.client
    .from("predictive_settings")
    .upsert({ organization_id: orgId, lead_time_days: 10, coverage_days: 20 });
  if (settingsErr) throw new Error(`settings: ${settingsErr.message}`);

  // One draft purchase → "Compras pendientes" = 1.
  const { error: purchaseErr } = await chief.client.rpc("create_purchase", {
    p_provider_id: null,
    p_notes: `${runId} draft`,
    p_items: [{ product_id: productId, quantity: 5, unit_price: 100 }],
  });
  if (purchaseErr) throw new Error(`purchase: ${purchaseErr.message}`);

  // ---- Drive the app ----

  // Chief home
  const chiefHome = await get("/dashboard", chief.session);
  writeFileSync(`${OUT_DIR}/chief-dashboard.html`, chiefHome.html);
  check("chief /dashboard responds 200", chiefHome.status === 200, `got ${chiefHome.status} ${chiefHome.location ?? ""}`);
  const h = chiefHome.html;
  check("greeting uses first name", h.includes("¡Hola, María!"));
  check("subheading present", h.includes("¿Qué querés hacer hoy?"));
  check("KPI: Alertas activas", h.includes("Alertas activas"));
  check("KPI: Para reponer pronto", h.includes("Para reponer pronto"));
  check("KPI: Compras pendientes", h.includes("Compras pendientes"));
  // ">"-anchored matching: the raw HTML also embeds the whole es.json bundle
  // in the RSC flight payload, so bare .includes() would match every string.
  check("chief sees at-risk section", h.includes(">Insumos que conviene reponer<"));
  check("at-risk row: Pedir ahora badge", h.includes("Pedir ahora"));
  check("at-risk row: suggested 290 u.", h.includes("290"));
  check("shortcuts heading", h.includes("Accesos rápidos"));
  check("chief shortcut: users desc", h.includes(">Invitá y administrá"));
  check("chief shortcut: subscription desc", h.includes(">Tu plan y la facturación"));
  if (hasAiPlan) check("chief shortcut: AI desc (AI plan)", h.includes(">Preguntá sobre stock"));
  else console.log("SKIP  AI shortcut (no AI-enabled plan found)");
  check("write copy for stock shortcut", h.includes(">Consultá el stock y registrá entradas y salidas"));
  check("topbar markup present", h.includes("mi-topbar"));
  check("drawer wrapper present", h.includes("mi-drawer"));
  check("hamburger aria-label", h.includes("Abrir menú"));
  const activeCount = (h.match(/is-active/g) ?? []).length;
  check("exactly one active nav item on /dashboard", activeCount === 1, `count=${activeCount}`);
  check(
    "Panel is the active item",
    /class="mi-nav-item is-active"[^>]*href="\/dashboard"|href="\/dashboard"[^>]*class="mi-nav-item is-active"/.test(h)
  );

  // Chief /alerts — active-nav bug fix
  const chiefAlerts = await get("/alerts", chief.session);
  writeFileSync(`${OUT_DIR}/chief-alerts.html`, chiefAlerts.html);
  check("chief /alerts responds 200", chiefAlerts.status === 200);
  const ha = chiefAlerts.html;
  check(
    "/alerts nav item active (bug fix)",
    /href="\/alerts"[^>]*class="mi-nav-item is-active"|class="mi-nav-item is-active"[^>]*href="\/alerts"/.test(ha)
  );
  check(
    "Panel NOT active on /alerts",
    !/href="\/dashboard"[^>]*class="mi-nav-item is-active"|class="mi-nav-item is-active"[^>]*href="\/dashboard"/.test(ha)
  );

  // Chief /predictive/[id] — startsWith highlight on dynamic route
  const chiefDetail = await get(`/predictive/${productId}`, chief.session);
  writeFileSync(`${OUT_DIR}/chief-predictive-detail.html`, chiefDetail.html);
  check("chief /predictive/[id] responds 200", chiefDetail.status === 200);
  check(
    "Predicción active on dynamic route",
    /href="\/predictive"[^>]*class="mi-nav-item is-active"|class="mi-nav-item is-active"[^>]*href="\/predictive"/.test(
      chiefDetail.html
    )
  );

  // Administrative home — role gating
  const assistHome = await get("/dashboard", assist.session);
  writeFileSync(`${OUT_DIR}/assist-dashboard.html`, assistHome.html);
  check("assist /dashboard responds 200", assistHome.status === 200);
  const g = assistHome.html;
  check("assist greeting", g.includes("¡Hola, Carlos!"));
  check("assist does NOT see at-risk section", !g.includes(">Insumos que conviene reponer<"));
  check("assist read-only stock copy", g.includes(">Mirá cuánto stock queda"));
  check("assist read-only purchases copy", g.includes(">Seguí el estado de los pedidos"));
  check("assist has no users shortcut", !g.includes(">Invitá y administrá"));
  check("assist has no subscription shortcut", !g.includes(">Tu plan y la facturación"));

  // Logged-out: /dashboard must bounce to /login
  const anon = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check("anonymous /dashboard redirects", anon.status >= 300 && anon.status < 400, `got ${anon.status} → ${anon.headers.get("location")}`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("SCRIPT ERROR:", e);
    process.exitCode = 1;
  })
  .finally(cleanup);
