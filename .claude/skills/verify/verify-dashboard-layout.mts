/* eslint-disable @typescript-eslint/no-explicit-any --
   Chrome DevTools Protocol messages and the untyped admin-client rows here are
   raw JSON off a WebSocket; typing them would be more ceremony than this
   throwaway verification driver warrants. */
// Layout regression check for the dashboard, driven through a REAL browser.
//
// SSR-HTML drivers can't catch this class of bug: the dashboard scroll root has
// a definite height, so a flex-column root silently squashed its children
// (cards with `overflow-hidden` have an automatic minimum size of 0) and their
// content was cropped — markup and CSS both looked correct over HTTP.
//
// Seeds an ephemeral AI-enabled org + a cached summary blob (no model call),
// drives headless Chrome over CDP with a real session cookie, and measures
// rendered card heights. Also A/B's the pre-fix flex-column on the same DOM so
// the check fails loudly if the fix is ever reverted.
//
// Run: npx tsx --env-file=.env.local .claude/skills/verify/verify-dashboard-layout.mts
// Needs the dev server on :3000. CHROME_PATH overrides the browser binary.
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

const CHROME =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const pk = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const sk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const runId = `browchk-${Date.now()}`;
const admin: any = createClient(url, sk);
let orgId: string | undefined;
const userIds: string[] = [];
let chrome: any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

try {
  const { data: plans } = await admin.from("plans").select("id, token_limit_per_month");
  const plan = plans.find((p: any) => (p.token_limit_per_month ?? 0) > 0);
  const { data: org } = await admin
    .from("organizations")
    .insert({ name: runId, plan_id: plan.id })
    .select("id")
    .single();
  orgId = org.id;
  const email = `${runId}@example.com`;
  const password = `Pw-${runId}!`;
  const { data: u } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { role: "chief_doctor", organization_id: orgId },
  });
  userIds.push(u.user.id);
  await admin.from("profiles").upsert({
    id: u.user.id, organization_id: orgId, full_name: "Maria Perez", role: "chief_doctor",
  });
  await admin.from("ai_dashboard_summaries").insert({
    organization_id: orgId, generated_by: u.user.id,
    content: {
      headline: "TITULAR DE PRUEBA para medir la altura de la tarjeta",
      summary: "Resumen largo de prueba. ".repeat(30),
      actions: [
        "Accion numero uno bastante larga para ocupar espacio vertical",
        "Accion dos", "Accion tres", "Accion cuatro", "Accion cinco",
      ],
      chart: {
        type: "hbar", title: "Grafico de prueba", unit: "u",
        points: [
          { label: "Alfa", value: 10 }, { label: "Beta", value: 290 },
          { label: "Gamma", value: 120 }, { label: "Delta", value: 45 },
          { label: "Epsilon", value: 200 }, { label: "Zeta", value: 75 },
        ],
      },
    },
  });

  const { data: si } = await createClient(url, pk).auth.signInWithPassword({ email, password });
  const session = si.session!;
  const ref = new URL(url).hostname.split(".")[0];
  const raw = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const cookies: { name: string; value: string }[] = [];
  if (raw.length <= 3180) cookies.push({ name: `sb-${ref}-auth-token`, value: raw });
  else for (let i = 0; i * 3180 < raw.length; i++)
    cookies.push({ name: `sb-${ref}-auth-token.${i}`, value: raw.slice(i * 3180, (i + 1) * 3180) });

  chrome = spawn(
    CHROME,
    ["--headless=new", "--disable-gpu", "--remote-debugging-port=9222",
     `--user-data-dir=${tmpdir().replace(/\\/g, "/")}/cdp-${runId}`,
     "--window-size=1440,900", "about:blank"],
    { stdio: "ignore" }
  );

  let targets: any = null;
  for (let i = 0; i < 40 && !targets; i++) {
    await sleep(500);
    try { targets = await (await fetch("http://127.0.0.1:9222/json/list")).json(); } catch {}
  }
  const page = targets.find((t: any) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r as any));
  let id = 0;
  const pending = new Map<number, any>();
  ws.onmessage = (e: any) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method: string, params: any = {}) =>
    new Promise<any>((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Network.enable");
  for (const c of cookies)
    await send("Network.setCookie", { name: c.name, value: c.value, domain: "localhost", path: "/" });
  await send("Page.enable");
  await send("Page.navigate", { url: "http://localhost:3000/dashboard" });
  await sleep(7000);

  const expr = `(() => {
    const card = document.querySelector('[data-tutorial="ai-summary"]');
    const risk = document.querySelector('[data-tutorial="main"]');
    const root = document.querySelector('[data-tutorial="kpis"]') ? document.querySelector('[data-tutorial="kpis"]').parentElement : null;
    const m = el => el ? Math.round(el.getBoundingClientRect().height) : -1;
    const need = el => el ? Math.round(el.scrollHeight) : -1;
    return JSON.stringify({
      found: !!card,
      rootDisplay: root ? getComputedStyle(root).display : 'none',
      rootAutoRows: root ? getComputedStyle(root).gridAutoRows : '-',
      rootScrolls: root ? root.scrollHeight > root.clientHeight + 1 : false,
      summaryH: m(card), summaryNeed: need(card),
      riskH: m(risk), riskNeed: need(risk),
      docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    });
  })()`;
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  const v = JSON.parse(r.result.result.value);
  console.log("card found     :", v.found);
  console.log("root display   :", v.rootDisplay, "| grid-auto-rows:", v.rootAutoRows);
  console.log("root scrolls   :", v.rootScrolls);
  console.log("summary card   : height", v.summaryH, "needs", v.summaryNeed,
    v.summaryH >= v.summaryNeed ? "=> OK (not cropped)" : "=> CROPPED by " + (v.summaryNeed - v.summaryH));
  console.log("at-risk card   : height", v.riskH, "needs", v.riskNeed,
    v.riskH >= v.riskNeed ? "=> OK (not cropped)" : "=> CROPPED by " + (v.riskNeed - v.riskH));
  console.log("page overflows horizontally:", v.docOverflowX ? "YES (bad)" : "no");

  // A/B on the same live DOM: force the pre-fix flex-column back and re-measure.
  const abExpr = `(() => {
    const root = document.querySelector('[data-tutorial="kpis"]').parentElement;
    root.style.display = 'flex'; root.style.flexDirection = 'column';
    root.style.gridAutoRows = ''; root.style.gridTemplateColumns = '';
    const card = document.querySelector('[data-tutorial="ai-summary"]');
    const risk = document.querySelector('[data-tutorial="main"]');
    const m = el => Math.round(el.getBoundingClientRect().height);
    return JSON.stringify({ s: m(card), sn: card.scrollHeight, r: m(risk), rn: risk.scrollHeight });
  })()`;
  const ab = JSON.parse((await send("Runtime.evaluate", { expression: abExpr, returnByValue: true })).result.result.value);
  console.log("\n-- same DOM, reverted to the old flex-column --");
  console.log("summary card   : height", ab.s, "needs", ab.sn, ab.s >= ab.sn ? "=> OK" : "=> CROPPED by " + (ab.sn - ab.s));
  console.log("at-risk card   : height", ab.r, "needs", ab.rn, ab.r >= ab.rn ? "=> OK" : "=> CROPPED by " + (ab.rn - ab.r));
  ws.close();
} finally {
  try { chrome?.kill(); } catch {}
  if (orgId) {
    await admin.from("ai_dashboard_summaries").delete().eq("organization_id", orgId);
    for (const i of userIds) await admin.auth.admin.deleteUser(i);
    await admin.from("profiles").delete().eq("organization_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    console.log("cleanup done");
  }
}
