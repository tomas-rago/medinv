import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Fallback when the org has no explicit lead time and the product has no
// received purchases to average.
export const DEFAULT_LEAD_TIME_DAYS = 7;

const MS_PER_DAY = 86_400_000;

// Per-product average delivery time in days from received purchases.
// purchases.created_at is order *creation* — the only order-side timestamp
// that exists (there is no confirmed/sent timestamp) — so "delivery time"
// is creation → reception. Each purchase line contributes one sample.
export async function fetchAutoLeadTimes(
  supabase: SupabaseClient<Database>,
  productId?: string
): Promise<Map<string, number>> {
  let query = supabase
    .from("purchase_items")
    .select("product_id, purchases!inner(created_at, received_at)")
    .eq("purchases.status", "received")
    .not("purchases.received_at", "is", null);
  if (productId) query = query.eq("product_id", productId);
  const { data } = await query;

  const agg = new Map<string, { total: number; n: number }>();
  for (const item of data ?? []) {
    const receivedAt = item.purchases?.received_at;
    const createdAt = item.purchases?.created_at;
    if (!receivedAt || !createdAt) continue;
    const days = (Date.parse(receivedAt) - Date.parse(createdAt)) / MS_PER_DAY;
    if (!Number.isFinite(days) || days < 0) continue;
    const a = agg.get(item.product_id) ?? { total: 0, n: 0 };
    a.total += days;
    a.n += 1;
    agg.set(item.product_id, a);
  }

  const result = new Map<string, number>();
  for (const [pid, a] of agg) {
    result.set(pid, Math.max(1, Math.round(a.total / a.n)));
  }
  return result;
}
