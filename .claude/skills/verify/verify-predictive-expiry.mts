// Throwaway end-to-end verification for expiry-aware predictions: usable vs.
// aggregate stock, the expired-lot badge, the always-visible suggested
// quantity, and the projected-waste tile. Same pattern as verify-home.mts —
// ephemeral org/users on the live project, real session cookies, SSR HTML.
import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import type { Database } from "./lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const pk = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const sk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OUT_DIR = process.env.VERIFY_OUT ?? ".verify-out";
const BASE = "http://localhost:3000";

const runId = `verify-expiry-${Date.now()}`;
const admin = createClient<Database>(url, sk) as SupabaseClient<Database>;

const userIds: string[] = [];
let orgId: string | undefined;

let failures = 0;
function check(label: string, ok: boolean, extra?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

function isoDay(offset: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
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

async function cleanup() {
  if (!orgId) return;
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

// Backdates the three most recent exits to 8/7/6 days ago → 90 units over a
// 9-day span = 10/day, the same recipe tests/rls/predictive.test.ts uses.
async function seedDemand(client: SupabaseClient<Database>, productId: string) {
  for (let i = 0; i < 3; i++) {
    const { error } = await client.rpc("register_stock_exit", {
      p_product_id: productId,
      p_quantity: 30,
    });
    if (error) throw new Error(`exit: ${error.message}`);
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
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const { data: plans } = await admin.from("plans").select("id, token_limit_per_month");
  if (!plans?.length) throw new Error("no plans");
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: runId, plan_id: plans[0].id })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`org: ${orgErr?.message}`);
  orgId = org.id;

  const { data: products, error: prodErr } = await admin
    .from("products")
    .insert([
      { organization_id: orgId, name: `${runId}-lotes` },
      { organization_id: orgId, name: `${runId}-simple` },
      { organization_id: orgId, name: `${runId}-cubierto` },
    ])
    .select("id, name");
  if (prodErr || !products) throw new Error(`products: ${prodErr?.message}`);
  const lotted = products.find((p) => p.name.endsWith("-lotes"))!.id;
  const simple = products.find((p) => p.name.endsWith("-simple"))!.id;
  const covered = products.find((p) => p.name.endsWith("-cubierto"))!.id;

  const chief = await createUser("chief_doctor", "María Pérez");
  const entry = (productId: string, quantity: number, expiry?: string) =>
    chief.client.rpc("register_stock_movement", {
      p_product_id: productId,
      p_type: "entry",
      p_quantity: quantity,
      ...(expiry ? { p_expiry_date: expiry } : {}),
    });

  // --- Product A: demand first (so FEFO does not eat the lots below), then
  //     three lots — one already lapsed, one lapsing inside the horizon, one
  //     long-dated. Aggregate 120, usable 100, expired 20.
  const { error: aEntry } = await entry(lotted, 90);
  if (aEntry) throw new Error(`A entry: ${aEntry.message}`);
  await seedDemand(chief.client, lotted);
  for (const [qty, exp] of [
    [20, isoDay(-1)],
    [40, isoDay(2)],
    [60, isoDay(400)],
  ] as [number, string][]) {
    const { error } = await entry(lotted, qty, exp);
    if (error) throw new Error(`A lot ${exp}: ${error.message}`);
  }

  // --- Product B: no expiry anywhere, stock above the reorder point. Proves
  //     the suggested quantity now shows before the reorder point is hit.
  const { error: bEntry } = await entry(simple, 200);
  if (bEntry) throw new Error(`B entry: ${bEntry.message}`);
  await seedDemand(chief.client, simple);

  // --- Product C: real demand but stock well past the coverage target, so the
  //     suggested quantity is a genuine zero rather than a missing value.
  const { error: cEntry } = await entry(covered, 500);
  if (cEntry) throw new Error(`C entry: ${cEntry.message}`);
  await seedDemand(chief.client, covered);

  const { error: settingsErr } = await chief.client
    .from("predictive_settings")
    .upsert({ organization_id: orgId, lead_time_days: 10, coverage_days: 20 });
  if (settingsErr) throw new Error(`settings: ${settingsErr.message}`);

  // Confirm the seed landed as intended before asserting on the UI.
  const { data: batches } = await admin
    .from("stock_batches")
    .select("product_id, expiry_date, quantity")
    .eq("organization_id", orgId);
  const { data: stockRows } = await admin
    .from("stock")
    .select("product_id, quantity")
    .eq("organization_id", orgId);
  const aggA = Number(stockRows?.find((s) => s.product_id === lotted)?.quantity ?? 0);
  const aggB = Number(stockRows?.find((s) => s.product_id === simple)?.quantity ?? 0);
  check("seed: product A aggregate stock is 120", aggA === 120, `got ${aggA}`);
  check("seed: product B aggregate stock is 110", aggB === 110, `got ${aggB}`);
  const aggC = Number(stockRows?.find((s) => s.product_id === covered)?.quantity ?? 0);
  check("seed: product C aggregate stock is 410", aggC === 410, `got ${aggC}`);
  console.log(JSON.stringify(batches));

  // ---- /predictive ----
  // Demand 10/day, lead 10 → reorder point 100.
  // A: usable 100 (20 already lapsed) → order now. Lot of 40 expiring in 2
  //    days only sees 30 units of demand → 10 wasted. Coverage target
  //    10*(10+20) = 300, minus (100 - 10 wasted) → 210.
  //    Pre-change behaviour would have read stock 120 and suggested 180.
  // B: usable 110 > 100 → not due yet, but 190 is still shown (muted).
  const list = await get("/predictive", chief.session);
  writeFileSync(`${OUT_DIR}/predictive-list.html`, list.html);
  const h = list.html;
  check("/predictive responds 200", list.status === 200, `got ${list.status}`);
  // ">"-anchored: the RSC flight payload embeds all of es.json, so bare
  // .includes() would match strings that are never rendered.
  check("A: usable stock 100 rendered, not the 120 aggregate", h.includes(">100<") && !h.includes(">120<"));
  check("A: no expired-lot badge, just the number", !h.includes("vencidas<"));
  check("A: waste warning on the row", h.includes("10 u. vencerían sin usarse"));
  check("A: order-now badge", h.includes(">Pedir ahora<"));
  check("A: expiry-adjusted suggested quantity 210", h.includes(">210 u.<"));
  check("A: does NOT show the pre-change 180", !h.includes(">180 u.<"));
  check("B: suggested quantity shown before the reorder point", h.includes(">190 u.<"));
  check("B: stock 110 rendered", h.includes(">110<"));
  // C: usable 410, coverage target 300 → a real zero, distinct from the dash
  // that means "no demand estimate to compute from".
  check("C: covered rows read 0 u., not a dash", h.includes(">0 u.<"));
  check(
    "C: zero carries the already-covered tooltip",
    /title="No hace falta comprar[^"]*"[^>]*>0 u\.</.test(h) ||
      /<span[^>]*title="No hace falta comprar[^"]*">\s*0 u\./.test(h)
  );

  // ---- /predictive/[id] ----
  const detail = await get(`/predictive/${lotted}`, chief.session);
  writeFileSync(`${OUT_DIR}/predictive-detail.html`, detail.html);
  const d = detail.html;
  check("/predictive/[id] responds 200", detail.status === 200, `got ${detail.status}`);
  check("detail: waste tile present", d.includes(">Vencerá sin usarse<"));
  check("detail: waste value 10 u.", d.includes(">10 u.<"));
  check("detail: stock tile shows usable 100, no expired badge", d.includes(">100<") && !d.includes("vencidas<"));
  check("detail: suggested quantity 210", d.includes(">210 u.<"));

  const detailB = await get(`/predictive/${simple}`, chief.session);
  writeFileSync(`${OUT_DIR}/predictive-detail-b.html`, detailB.html);
  check("detail B: suggested quantity shown before reorder", detailB.html.includes(">190 u.<"));
  check("detail B: no waste tile", !detailB.html.includes(">Vencerá sin usarse<"));
  check("detail B: no already-covered badge", !detailB.html.includes(">Ya cubierto<"));

  const detailC = await get(`/predictive/${covered}`, chief.session);
  writeFileSync(`${OUT_DIR}/predictive-detail-c.html`, detailC.html);
  check("detail C: zero suggested quantity", detailC.html.includes(">0 u.<"));
  check("detail C: already-covered badge", detailC.html.includes(">Ya cubierto<"));

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("SCRIPT ERROR:", e);
    process.exitCode = 1;
  })
  .finally(cleanup);
