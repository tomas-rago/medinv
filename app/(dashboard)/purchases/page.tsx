import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canManagePurchases } from "@/lib/constants/roles";
import { PurchasesPage } from "@/components/purchases/PurchasesPage";

const PAGE_SIZE = 20;

export default async function PurchasesServerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; provider?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const canManage = canManagePurchases(user.app_metadata?.role as string);

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const status = (sp.status ?? "").trim();
  const providerId = (sp.provider ?? "").trim();

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("purchases")
    .select(
      "id, status, notes, supplier, created_at, received_at, provider_id, providers(name), purchase_items(quantity, unit_price, accepted_quantity)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (["draft", "confirmed", "received", "cancelled"].includes(status)) {
    query = query.eq("status", status as "draft" | "confirmed" | "received" | "cancelled");
  }
  if (providerId) query = query.eq("provider_id", providerId);

  const [{ data, count }, { data: providers }] = await Promise.all([
    query,
    supabase.from("providers").select("id, name").eq("active", true).order("name"),
  ]);

  const purchases = (data ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    notes: p.notes,
    provider_name: p.providers?.name ?? p.supplier,
    created_at: p.created_at,
    received_at: p.received_at,
    item_count: p.purchase_items.length,
    total: p.purchase_items.reduce(
      (sum, i) => (i.unit_price === null ? sum : sum + i.quantity * i.unit_price),
      0
    ),
    has_prices: p.purchase_items.some((i) => i.unit_price !== null),
    has_discrepancy:
      p.purchase_items.some(
        (i) => i.accepted_quantity !== null && i.accepted_quantity !== i.quantity
      ),
  }));

  return (
    <PurchasesPage
      purchases={purchases}
      providers={providers ?? []}
      count={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      status={status}
      providerId={providerId}
      canManage={canManage}
    />
  );
}
