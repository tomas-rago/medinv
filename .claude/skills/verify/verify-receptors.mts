// Throwaway end-to-end verification for the receptors module + movements
// report filters/sort. Creates an ephemeral org/users on the live project
// (same pattern as tests/rls), mints @supabase/ssr session cookies, drives
// the dev server over HTTP, and inspects the SSR HTML. Cleans up after itself.
import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import type { Database } from "./lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const pk = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const sk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OUT_DIR = process.env.VERIFY_OUT ?? ".verify-out";
const BASE = "http://localhost:3000";

const runId = `verify-receptors-${Date.now()}`;
const admin = createClient<Database>(url, sk) as SupabaseClient<Database>;

const userIds: string[] = [];
let orgId: string | undefined;

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
  await admin.from("purchase_items").delete().eq("organization_id", orgId);
  await admin.from("purchases").delete().eq("organization_id", orgId);
  await admin.from("stock_movements").delete().eq("organization_id", orgId);
  await admin.from("stock_batches").delete().eq("organization_id", orgId);
  await admin.from("stock").delete().eq("organization_id", orgId);
  await admin.from("receptors").delete().eq("organization_id", orgId);
  await admin.from("provider_products").delete().eq("organization_id", orgId);
  await admin.from("providers").delete().eq("organization_id", orgId);
  await admin.from("products").delete().eq("organization_id", orgId);
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  await admin.from("profiles").delete().eq("organization_id", orgId);
  await admin.from("organizations").delete().eq("id", orgId);
  console.log("cleanup done");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const { data: plans } = await admin.from("plans").select("id").limit(1);
  if (!plans?.length) throw new Error("no plans");
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: runId, plan_id: plans[0].id })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`org: ${orgErr?.message}`);
  orgId = org.id;

  const { data: product, error: prodErr } = await admin
    .from("products")
    .insert({ organization_id: orgId, name: `${runId}-gasas`, category: "wound_care", criticality: "essential" })
    .select("id")
    .single();
  if (prodErr || !product) throw new Error(`product: ${prodErr?.message}`);
  const productId = product.id;

  const { data: provider, error: provErr } = await admin
    .from("providers")
    .insert({ organization_id: orgId, name: "Droguería Verify" })
    .select("id")
    .single();
  if (provErr || !provider) throw new Error(`provider: ${provErr?.message}`);

  // create_purchase enforces the provider catalog — associate the product.
  const { error: ppErr } = await admin
    .from("provider_products")
    .insert({ organization_id: orgId, provider_id: provider.id, product_id: productId });
  if (ppErr) throw new Error(`provider_products: ${ppErr.message}`);

  const chief = await createUser("chief_doctor", "María Pérez");
  const nurse = await createUser("nurse", "Lucía Fernández");

  // Nurse creates the receptor (exercises the writer-insert policy end to end).
  const { data: receptor, error: rcpErr } = await nurse.client
    .from("receptors")
    .insert({ organization_id: orgId, name: "Juan Receptor", patient_type: "social_security", external_id: "HC-9" })
    .select("id")
    .single();
  if (rcpErr || !receptor) throw new Error(`receptor: ${rcpErr?.message}`);

  // Movements: entry 100, exit 3 (with receptor), exit 30 (anonymous), and a
  // received purchase (entry 5 linked to the provider via purchase_id).
  const { error: entryErr } = await chief.client.rpc("register_stock_movement", {
    p_product_id: productId,
    p_type: "entry",
    p_quantity: 100,
  });
  if (entryErr) throw new Error(`entry: ${entryErr.message}`);
  const { error: exit1Err } = await nurse.client.rpc("register_stock_exit", {
    p_product_id: productId,
    p_quantity: 3,
    p_receptor_id: receptor.id,
  });
  if (exit1Err) throw new Error(`exit1: ${exit1Err.message}`);
  const { error: exit2Err } = await nurse.client.rpc("register_stock_exit", {
    p_product_id: productId,
    p_quantity: 30,
  });
  if (exit2Err) throw new Error(`exit2: ${exit2Err.message}`);

  const { data: purchaseId, error: poErr } = await chief.client.rpc("create_purchase", {
    p_provider_id: provider.id,
    p_notes: null,
    p_items: [{ product_id: productId, quantity: 5, unit_price: 100 }],
  });
  if (poErr) throw new Error(`purchase: ${poErr.message}`);
  const { data: po } = await chief.client
    .from("purchases")
    .select("id, purchase_items(id)")
    .eq("id", purchaseId as string)
    .single();
  const { error: recvErr } = await chief.client.rpc("receive_purchase", {
    p_purchase_id: po!.id,
    p_items: [{ id: po!.purchase_items[0].id, accepted_quantity: 5, expiry_date: null }],
  });
  if (recvErr) throw new Error(`receive: ${recvErr.message}`);

  // ---- Drive the app ----

  // (1) /receptors as chief: heading, Nuevo, edit/deactivate icons, row data.
  const chiefReceptors = await get("/receptors", chief.session);
  writeFileSync(`${OUT_DIR}/chief-receptors.html`, chiefReceptors.html);
  check("chief /receptors responds 200", chiefReceptors.status === 200, `got ${chiefReceptors.status} ${chiefReceptors.location ?? ""}`);
  const cr = chiefReceptors.html;
  check("heading Receptores rendered", cr.includes(">Receptores</h1>") || cr.includes(">Receptores<"));
  check("Nuevo button (chief)", cr.includes(">Nuevo<") || />Nuevo\s*</.test(cr.replace(/<!-- -->/g, "")));
  check("row: receptor name", cr.includes(">Juan Receptor<"));
  check("row: external id", cr.includes(">HC-9<"));
  check("row: patient type badge Obra social", cr.includes(">Obra social<"));
  check("edit action (chief)", cr.includes('aria-label="Editar"'));
  check("deactivate action (chief)", cr.includes('aria-label="Desactivar"'));
  check("sidebar has Receptores nav", /href="\/receptors"/.test(cr));
  check(
    "Receptores nav item active",
    /href="\/receptors"[^>]*class="mi-nav-item is-active"|class="mi-nav-item is-active"[^>]*href="\/receptors"/.test(cr)
  );

  // (2) /receptors as nurse: Nuevo yes, edit/deactivate no.
  const nurseReceptors = await get("/receptors", nurse.session);
  writeFileSync(`${OUT_DIR}/nurse-receptors.html`, nurseReceptors.html);
  check("nurse /receptors responds 200", nurseReceptors.status === 200);
  const nr = nurseReceptors.html;
  check("Nuevo button (nurse)", nr.includes(">Nuevo<") || />Nuevo\s*</.test(nr.replace(/<!-- -->/g, "")));
  check("no edit action (nurse)", !nr.includes('aria-label="Editar"'));
  check("no deactivate action (nurse)", !nr.includes('aria-label="Desactivar"'));

  // (3) movements tab, type=exit filter: only exit rows; new columns present.
  const exitFiltered = await get("/stock?tab=movements&type=exit", chief.session);
  writeFileSync(`${OUT_DIR}/movements-type-exit.html`, exitFiltered.html);
  check("filtered movements responds 200", exitFiltered.status === 200);
  const fx = exitFiltered.html;
  check("Proveedor column header", fx.includes(">Proveedor<") || fx.includes("Proveedor</button>") || /–?>Proveedor/.test(fx));
  check("Receptor column header", /Receptor<\/th>|Receptor\s*<svg|>Receptor</.test(fx));
  check("exit badge rendered", fx.includes(">Egreso</span>"));
  check("no entry rows under type=exit", !fx.includes(">Ingreso</span>"));
  check("receptor name in exit row", fx.includes(">Juan Receptor<"));
  check("export button", fx.includes(">Exportar<") || /Exportar\s*</.test(fx));

  // (4) provider filter: only the purchase-linked entry.
  const provFiltered = await get(`/stock?tab=movements&provider=${provider.id}`, chief.session);
  writeFileSync(`${OUT_DIR}/movements-provider.html`, provFiltered.html);
  check("provider-filtered responds 200", provFiltered.status === 200);
  const fp = provFiltered.html;
  check("entry badge present (purchase entry)", fp.includes(">Ingreso</span>"));
  check("no exit rows under provider filter", !fp.includes(">Egreso</span>"));
  check("provider name in row", fp.includes(">Droguería Verify<"));

  // (5) sort=quantity&dir=asc: quantities ascending (3, 5, 30, 100).
  const sorted = await get("/stock?tab=movements&sort=quantity&dir=asc", chief.session);
  writeFileSync(`${OUT_DIR}/movements-sorted.html`, sorted.html);
  check("sorted movements responds 200", sorted.status === 200);
  const qtys = [...sorted.html.matchAll(/tabular-nums">(?:\+|−|)(?:<!-- -->)?(\d+(?:\.\d+)?)</g)].map((m) =>
    Number(m[1])
  );
  const ascending = qtys.length >= 4 && qtys.every((q, i) => i === 0 || q >= qtys[i - 1]);
  check("quantities ascending", ascending, `got [${qtys.join(", ")}]`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("SCRIPT ERROR:", e);
    process.exitCode = 1;
  })
  .finally(cleanup);
