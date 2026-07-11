import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canManageAlerts } from "@/lib/constants/roles";
import { hasAiAccess } from "@/lib/ai/access";
import { syncReorderAlerts } from "@/lib/predictive/alerts";
import { AlertsPage } from "@/components/alerts/AlertsPage";

const PAGE_SIZE = 20;

export default async function AlertsServerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const canManage = canManageAlerts(user.app_metadata?.role as string);

  const orgId = user.app_metadata?.organization_id as string | undefined;
  const aiExplain = orgId ? await hasAiAccess(supabase, orgId) : false;

  // Refresh expiry + reorder alerts (and clear disabled types) before reading.
  await supabase.rpc("sweep_alerts");
  await syncReorderAlerts(supabase);

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const type = (sp.type ?? "").trim(); // "" (all) | "low_stock" | "expiry" | "reorder_suggested"
  const status = (sp.status ?? "active").trim(); // "active" | "resolved" | "all"

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("alerts")
    .select(
      "id, type, status, quantity, threshold, expiry_date, triggered_at, resolved_at, acknowledged_at, products(name)",
      { count: "exact" }
    )
    .order("triggered_at", { ascending: false })
    .range(from, to);

  if (type === "low_stock" || type === "expiry" || type === "reorder_suggested")
    query = query.eq("type", type);
  if (status === "active" || status === "resolved") query = query.eq("status", status);

  const { data, count } = await query;

  const alerts = (data ?? []).map((a) => ({
    id: a.id,
    type: a.type,
    status: a.status,
    quantity: a.quantity,
    threshold: a.threshold,
    expiry_date: a.expiry_date,
    triggered_at: a.triggered_at,
    resolved_at: a.resolved_at,
    acknowledged_at: a.acknowledged_at,
    product_name: a.products?.name ?? "",
  }));

  const { data: settingsRow } = await supabase
    .from("alert_settings")
    .select("low_stock_enabled, expiry_enabled, reorder_enabled, expiry_days_ahead")
    .maybeSingle();
  const settings = settingsRow ?? {
    low_stock_enabled: true,
    expiry_enabled: true,
    reorder_enabled: true,
    expiry_days_ahead: 30,
  };

  // Per-product thresholds for the config modal (managers only).
  let thresholds: { product_id: string; product_name: string; quantity: number; min_quantity: number }[] = [];
  if (canManage) {
    const { data: stockRows } = await supabase
      .from("stock")
      .select("product_id, quantity, min_quantity, products(name)");
    thresholds = (stockRows ?? [])
      .map((s) => ({
        product_id: s.product_id,
        product_name: s.products?.name ?? "",
        quantity: s.quantity,
        min_quantity: s.min_quantity,
      }))
      .sort((a, b) => a.product_name.localeCompare(b.product_name));
  }

  return (
    <AlertsPage
      alerts={alerts}
      count={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      type={type}
      status={status}
      settings={settings}
      thresholds={thresholds}
      canManage={canManage}
      aiExplain={aiExplain}
    />
  );
}
