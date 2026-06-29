import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canWriteInventory } from "@/lib/constants/roles";
import { StockPage } from "@/components/stock/StockPage";

const PAGE_SIZE = 20;

type ProductJoin = { name: string; category: string | null };
type StockProductJoin = { name: string; category: string | null; unit: string };

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function StockServerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const canWrite = canWriteInventory(user.app_metadata?.role as string);

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: movements, count } = await supabase
    .from("stock_movements")
    .select(
      "id, type, quantity, expiry_date, notes, created_at, user_id, corrects_movement_id, products(name, category)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

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
      user_name: names[m.user_id] ?? "—",
    };
  });

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
      pageSize={PAGE_SIZE}
      canWrite={canWrite}
      rectifiedIds={rectifiedIds}
      existencias={existencias}
    />
  );
}
