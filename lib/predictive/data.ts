import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { predictiveModel } from "./index";
import type { ConsumptionPoint, ProductPrediction } from "./base";

const DEFAULT_LEAD_TIME_DAYS = 7;

export type PredictiveSettingsRow = {
  ordering_cost: number;
  holding_cost_rate: number; // percent per year, as stored
  lead_time_days: number;
};

export type PredictionRow = {
  product_id: string;
  product_name: string;
  current_stock: number;
  min_quantity: number;
  unit_cost: number | null;
  prediction: ProductPrediction;
};

// Assembles org-scoped inputs (RLS does the scoping — the caller's client
// carries the user's JWT) and runs the active predictive model per product.
// Shared seam for the page today and the dashboard/chatbot later.
export async function getPredictions(supabase: SupabaseClient<Database>): Promise<{
  rows: PredictionRow[];
  settings: PredictiveSettingsRow | null;
}> {
  const [{ data: settings }, { data: stockRows }, { data: movements }, { data: priceRows }] =
    await Promise.all([
      supabase
        .from("predictive_settings")
        .select("ordering_cost, holding_cost_rate, lead_time_days")
        .maybeSingle(),
      supabase.from("stock").select("product_id, quantity, min_quantity, products(name)"),
      supabase
        .from("stock_movements")
        .select("id, product_id, type, quantity, created_at, corrects_movement_id")
        .in("type", ["entry", "exit"])
        .order("created_at", { ascending: true }),
      supabase
        .from("purchase_items")
        .select("product_id, unit_price, purchases!inner(status)")
        .not("unit_price", "is", null)
        .neq("purchases.status", "cancelled"),
    ]);

  // Demand = exit movements, netting rectification pairs: a compensating
  // movement (corrects_movement_id set) adjusts the exit it corrects in
  // place, attributed to the original date. Compensators of entries fall
  // out naturally — only exits seed the map.
  const exitEvents = new Map<string, { productId: string; date: string; quantity: number }>();
  for (const m of movements ?? []) {
    if (m.type === "exit" && m.corrects_movement_id === null) {
      exitEvents.set(m.id, {
        productId: m.product_id,
        date: m.created_at.slice(0, 10),
        quantity: m.quantity,
      });
    }
  }
  for (const m of movements ?? []) {
    if (m.corrects_movement_id === null) continue;
    const original = exitEvents.get(m.corrects_movement_id);
    if (!original) continue;
    original.quantity += m.type === "entry" ? -m.quantity : m.quantity;
  }

  // Per-product daily consumption series.
  const byProduct = new Map<string, Map<string, number>>();
  for (const e of exitEvents.values()) {
    if (e.quantity <= 0) continue;
    let days = byProduct.get(e.productId);
    if (!days) byProduct.set(e.productId, (days = new Map()));
    days.set(e.date, (days.get(e.date) ?? 0) + e.quantity);
  }

  // Average purchase price per product (accepted EOQ input).
  const priceAgg = new Map<string, { total: number; n: number }>();
  for (const p of priceRows ?? []) {
    if (p.unit_price === null) continue;
    const agg = priceAgg.get(p.product_id) ?? { total: 0, n: 0 };
    agg.total += p.unit_price;
    agg.n += 1;
    priceAgg.set(p.product_id, agg);
  }

  const inputs = {
    leadTimeDays: settings?.lead_time_days ?? DEFAULT_LEAD_TIME_DAYS,
    orderingCost: settings?.ordering_cost ?? null,
    holdingCostRate: settings ? settings.holding_cost_rate / 100 : null,
  };
  const asOf = new Date();

  const rows = await Promise.all(
    (stockRows ?? []).map(async (s): Promise<PredictionRow> => {
      const days = byProduct.get(s.product_id);
      const consumption: ConsumptionPoint[] = [...(days ?? new Map<string, number>())]
        .map(([date, quantity]) => ({ date, quantity }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const agg = priceAgg.get(s.product_id);
      const unitCost = agg ? agg.total / agg.n : null;

      const prediction = await predictiveModel.predict(
        {
          productId: s.product_id,
          consumption,
          currentStock: s.quantity,
          minQuantity: s.min_quantity,
          unitCost,
        },
        inputs,
        asOf
      );

      return {
        product_id: s.product_id,
        product_name: s.products?.name ?? "",
        current_stock: s.quantity,
        min_quantity: s.min_quantity,
        unit_cost: unitCost,
        prediction,
      };
    })
  );

  // Most urgent first; products without an estimate go last.
  rows.sort((a, b) => {
    const da = a.prediction.daysUntilReorder;
    const db = b.prediction.daysUntilReorder;
    if (da !== null && db !== null && da !== db) return da - db;
    if (da !== null && db === null) return -1;
    if (da === null && db !== null) return 1;
    return a.product_name.localeCompare(b.product_name);
  });

  return { rows, settings: settings ?? null };
}
