import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/ai/access";
import { getPredictions } from "@/lib/predictive/data";
import { HomePage, type AtRiskItem } from "@/components/home/HomePage";

// A product is "reponer pronto" when the model says the reorder point is at
// most this many days away.
const URGENT_DAYS = 7;

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata?.role as string) ?? "administrative";
  const orgId = user.app_metadata?.organization_id as string | undefined;

  // getPredictions also runs inside the layout's syncReorderAlerts; cheap at
  // this scale (see layout comment) and keeps the tile consistent with
  // /predictive. The layout already synced reorder alerts — no sync here.
  const [{ data: profile }, alertsRes, purchasesRes, predictions, aiAccess] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .is("acknowledged_at", null),
      supabase
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "confirmed"]),
      getPredictions(supabase),
      orgId ? hasAiAccess(supabase, orgId) : Promise.resolve(false),
    ]);

  const urgent = (days: number | null): days is number =>
    days !== null && days <= URGENT_DAYS;

  const reorderSoonCount = predictions.rows.filter(
    (r) =>
      urgent(r.prediction.daysUntilReorder) || r.current_stock <= r.min_quantity
  ).length;

  // Rows come sorted most-urgent-first; chief_doctor gets the oversight list.
  const atRisk: AtRiskItem[] | null =
    role === "chief_doctor"
      ? predictions.rows
          .filter((r) => urgent(r.prediction.daysUntilReorder))
          .slice(0, 5)
          .map((r) => ({
            product_id: r.product_id,
            product_name: r.product_name,
            daysUntilReorder: r.prediction.daysUntilReorder as number,
            suggestedQuantity: r.prediction.suggestedQuantity,
            currentStock: r.current_stock,
          }))
      : null;

  return (
    <HomePage
      fullName={profile?.full_name ?? null}
      role={role}
      alertCount={alertsRes.count ?? 0}
      reorderSoonCount={reorderSoonCount}
      pendingPurchases={purchasesRes.count ?? 0}
      hasAiAccess={aiAccess}
      atRisk={atRisk}
    />
  );
}
