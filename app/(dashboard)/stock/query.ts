import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MovementFilters, MovementSortKey } from "@/lib/schemas/stock/filters";

// Sort whitelist. Embedded (to-one) columns use PostgREST's "table(column)"
// order syntax — NOT `{ referencedTable }`, which would order rows *inside*
// the embed instead of the top-level rows. Provider-name sort is not offered:
// it sits two embeds deep (purchases → providers), which PostgREST can't
// order by.
export const MOVEMENT_SORT_COLUMNS: Record<MovementSortKey, string> = {
  date: "created_at",
  product: "products(name)",
  category: "products(category)",
  criticality: "products(criticality)",
  type: "type",
  quantity: "quantity",
  expiry: "expiry_date",
  receptor: "receptors(name)",
};

// Row shape of buildMovementsQuery. The select string is assembled at runtime
// (the purchases embed flips to !inner with the provider filter), so
// supabase-js can't infer it — we pin it via .returns<>() instead. All embeds
// are to-one; the array variants cover older type fallbacks.
type NameJoin = { name: string };
export type MovementQueryRow = {
  id: string;
  type: string;
  quantity: number;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  user_id: string;
  corrects_movement_id: string | null;
  products: { name: string; category: string | null; criticality: string | null } | null;
  receptors: NameJoin | null;
  purchases: { provider_id: string | null; providers: NameJoin | NameJoin[] | null } | null;
};

// Day after a 'YYYY-MM-DD' date, for an exclusive upper bound on created_at.
// Comparisons happen at UTC midnight; es-AR is UTC-3, so late-evening local
// movements land on the next UTC day — accepted for now (org TZ would fix it).
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Filtered + sorted movements query, shared by the /stock page (with .range)
// and the export action (with .limit). `products` is a NOT NULL to-one FK, so
// !inner never drops rows and makes the category/criticality filters legal
// (without !inner they would only null the embed). `purchases` is only !inner
// when the provider filter is active — otherwise movements without a purchase
// would vanish from the list.
export function buildMovementsQuery(
  supabase: SupabaseClient<Database>,
  filters: MovementFilters
) {
  const purchasesEmbed = filters.provider
    ? "purchases!inner(provider_id, providers(name))"
    : "purchases(provider_id, providers(name))";

  let query = supabase
    .from("stock_movements")
    .select(
      "id, type, quantity, expiry_date, notes, created_at, user_id, corrects_movement_id, " +
        "products!inner(name, category, criticality), receptors(name), " +
        purchasesEmbed,
      { count: "exact" }
    );

  if (filters.product) query = query.eq("product_id", filters.product);
  if (filters.category) query = query.eq("products.category", filters.category);
  if (filters.crit) query = query.eq("products.criticality", filters.crit);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.receptor) query = query.eq("receptor_id", filters.receptor);
  if (filters.provider) query = query.eq("purchases.provider_id", filters.provider);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lt("created_at", nextDay(filters.to));

  const sortKey = filters.sort ?? "date";
  const ascending = filters.dir ? filters.dir === "asc" : sortKey !== "date";
  query = query.order(MOVEMENT_SORT_COLUMNS[sortKey], { ascending });
  // Stable tiebreak so pagination never duplicates/drops rows.
  if (sortKey !== "date") query = query.order("created_at", { ascending: false });

  return query.returns<MovementQueryRow[]>();
}
