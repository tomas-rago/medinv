import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canWriteInventory, canViewReports } from "@/lib/constants/roles";
import { hasAiAccess } from "@/lib/ai/access";
import { parseMovementFilters } from "@/lib/schemas/stock/filters";
import { buildMovementsQuery } from "./query";
import { StockPage } from "@/components/stock/StockPage";
import { resolvePage, resolvePageSize } from "@/lib/pagination";

type ProductJoin = { name: string; category: string | null; criticality: string | null };
type StockProductJoin = { name: string; category: string | null; unit: string };
type NameJoin = { name: string };
type PurchaseJoin = { provider_id: string | null; providers: NameJoin | NameJoin[] | null };

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function StockServerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = user.app_metadata?.role as string;
  const canWrite = canWriteInventory(role);
  // Movements log/export is a "report" — reserved for operational roles.
  // Doctor keeps stock access (Existencias tab) but not the movements report.
  const showReports = canViewReports(role);

  const orgId = user.app_metadata?.organization_id as string | undefined;
  const aiExplain = orgId ? await hasAiAccess(supabase, orgId) : false;

  const filters = parseMovementFilters(sp);
  const initialTab =
    showReports && sp.tab === "movements" ? ("movements" as const) : ("stock" as const);

  const page = resolvePage(sp.page);
  const pageSize = resolvePageSize(sp.size);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: movements, count } = await buildMovementsQuery(supabase, filters).range(from, to);

  // Set of movement ids that have already been rectified (a child references them),
  // so their rollback action can be disabled.
  const { data: corrections } = await supabase
    .from("stock_movements")
    .select("corrects_movement_id")
    .not("corrects_movement_id", "is", null);
  const rectifiedIds = [
    ...new Set((corrections ?? []).map((c) => c.corrects_movement_id as string)),
  ];

  // stock_movements.user_id references auth.users, so there is no PostgREST
  // relationship to profiles — resolve the names with a separate lookup.
  const userIds = [...new Set((movements ?? []).map((m) => m.user_id))];
  let names: Record<string, string> = {};
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name ?? "—"]));
  }

  const rows = (movements ?? []).map((m) => {
    const product = one<ProductJoin>(m.products as ProductJoin | ProductJoin[] | null);
    const receptor = one<NameJoin>(m.receptors as NameJoin | NameJoin[] | null);
    const purchase = one<PurchaseJoin>(m.purchases as PurchaseJoin | PurchaseJoin[] | null);
    const provider = purchase ? one<NameJoin>(purchase.providers) : null;
    return {
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      expiry_date: m.expiry_date,
      notes: m.notes,
      created_at: m.created_at,
      corrects_movement_id: m.corrects_movement_id,
      product_name: product?.name ?? "—",
      category: product?.category ?? null,
      criticality: product?.criticality ?? null,
      user_name: names[m.user_id] ?? "—",
      provider_name: provider?.name ?? null,
      receptor_name: receptor?.name ?? null,
    };
  });

  // Filter-bar data: providers for the select; names behind uuid params so
  // the product/receptor combobox chips survive a reload.
  const { data: providerRows } = await supabase
    .from("providers")
    .select("id, name")
    .eq("active", true)
    .order("name");

  let selectedProductName: string | null = null;
  if (filters.product) {
    const { data: p } = await supabase
      .from("products")
      .select("name")
      .eq("id", filters.product)
      .maybeSingle();
    selectedProductName = p?.name ?? null;
  }

  let selectedReceptorName: string | null = null;
  if (filters.receptor) {
    const { data: r } = await supabase
      .from("receptors")
      .select("name")
      .eq("id", filters.receptor)
      .maybeSingle();
    selectedReceptorName = r?.name ?? null;
  }

  // Current on-hand stock (Existencias): aggregate per product + per-batch breakdown.
  const { data: stockRows } = await supabase
    .from("stock")
    .select("product_id, quantity, min_quantity, products(name, category, unit)");

  const { data: batchRows } = await supabase
    .from("stock_batches")
    .select("product_id, expiry_date, quantity")
    .neq("quantity", 0);

  const batchesByProduct = new Map<string, { expiry_date: string | null; quantity: number }[]>();
  for (const b of batchRows ?? []) {
    const list = batchesByProduct.get(b.product_id) ?? [];
    list.push({ expiry_date: b.expiry_date, quantity: b.quantity });
    batchesByProduct.set(b.product_id, list);
  }

  const existencias = (stockRows ?? [])
    .map((s) => {
      const product = one<StockProductJoin>(
        s.products as StockProductJoin | StockProductJoin[] | null
      );
      const batches = (batchesByProduct.get(s.product_id) ?? []).sort((a, b) => {
        if (a.expiry_date === b.expiry_date) return 0;
        if (a.expiry_date === null) return 1;
        if (b.expiry_date === null) return -1;
        return a.expiry_date < b.expiry_date ? -1 : 1;
      });
      return {
        product_id: s.product_id,
        product_name: product?.name ?? "—",
        category: product?.category ?? null,
        unit: product?.unit ?? "unit",
        quantity: s.quantity,
        min_quantity: s.min_quantity,
        low: s.quantity <= s.min_quantity,
        batches,
      };
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name, "es"));

  return (
    <StockPage
      movements={rows}
      count={count ?? 0}
      page={page}
      pageSize={pageSize}
      canWrite={canWrite}
      canViewReports={showReports}
      rectifiedIds={rectifiedIds}
      existencias={existencias}
      aiExplain={aiExplain}
      filters={filters}
      initialTab={initialTab}
      providers={providerRows ?? []}
      selectedProductName={selectedProductName}
      selectedReceptorName={selectedReceptorName}
    />
  );
}
