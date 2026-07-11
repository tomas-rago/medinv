import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ProductCriticality } from "@/lib/constants/criticality";
import { predictiveModel } from "./index";
import { DEFAULT_LEAD_TIME_DAYS, fetchAutoLeadTimes } from "./lead-time";
import type { ConsumptionPoint, ProductPrediction } from "./base";

// Fallbacks while the org has no predictive_settings row; values must match
// the DB column defaults (migrations 20260707000001-2).
const DEFAULT_COVERAGE_DAYS = 30;
export const DEFAULT_SAFETY_DAYS: Record<ProductCriticality, number> = {
  vital: 7,
  essential: 3,
  desirable: 0,
};

export type PredictiveSettingsRow = {
  // null = auto: per-product average delivery time from received purchases.
  lead_time_days: number | null;
  coverage_days: number;
  safety_days_vital: number;
  safety_days_essential: number;
  safety_days_desirable: number;
};

export type PredictionRow = {
  product_id: string;
  product_name: string;
  criticality: ProductCriticality | null;
  current_stock: number;
  min_quantity: number;
  // Effective value fed to the model, and whether it was derived from
  // purchase history (vs. the org's explicit setting).
  lead_time_days: number;
  lead_time_auto: boolean;
  prediction: ProductPrediction;
};

export const PREDICTIVE_SETTINGS_COLUMNS =
  "lead_time_days, coverage_days, safety_days_vital, safety_days_essential, safety_days_desirable";

export function safetyDaysFor(
  settings: PredictiveSettingsRow | null,
  criticality: ProductCriticality | null
): number {
  if (!criticality) return 0;
  if (!settings) return DEFAULT_SAFETY_DAYS[criticality];
  switch (criticality) {
    case "vital":
      return settings.safety_days_vital;
    case "essential":
      return settings.safety_days_essential;
    case "desirable":
      return settings.safety_days_desirable;
  }
}

type MovementRow = {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  created_at: string;
  corrects_movement_id: string | null;
};

// Demand = exit movements, netting rectification pairs: a compensating
// movement (corrects_movement_id set) adjusts the exit it corrects in
// place, attributed to the original date. Compensators of entries fall
// out naturally — only exits seed the map. Returns per-product daily
// consumption series, ascending by date.
export function buildConsumptionSeries(
  movements: MovementRow[]
): Map<string, ConsumptionPoint[]> {
  const exitEvents = new Map<string, { productId: string; date: string; quantity: number }>();
  for (const m of movements) {
    if (m.type === "exit" && m.corrects_movement_id === null) {
      exitEvents.set(m.id, {
        productId: m.product_id,
        date: m.created_at.slice(0, 10),
        quantity: m.quantity,
      });
    }
  }
  for (const m of movements) {
    if (m.corrects_movement_id === null) continue;
    const original = exitEvents.get(m.corrects_movement_id);
    if (!original) continue;
    original.quantity += m.type === "entry" ? -m.quantity : m.quantity;
  }

  const byProduct = new Map<string, Map<string, number>>();
  for (const e of exitEvents.values()) {
    if (e.quantity <= 0) continue;
    let days = byProduct.get(e.productId);
    if (!days) byProduct.set(e.productId, (days = new Map()));
    days.set(e.date, (days.get(e.date) ?? 0) + e.quantity);
  }

  const series = new Map<string, ConsumptionPoint[]>();
  for (const [productId, days] of byProduct) {
    series.set(
      productId,
      [...days]
        .map(([date, quantity]) => ({ date, quantity }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );
  }
  return series;
}

// Assembles org-scoped inputs (RLS does the scoping — the caller's client
// carries the user's JWT) and runs the active predictive model per product.
// Shared seam for the page today and the dashboard/chatbot later.
export async function getPredictions(supabase: SupabaseClient<Database>): Promise<{
  rows: PredictionRow[];
  settings: PredictiveSettingsRow | null;
}> {
  const [{ data: settings }, { data: stockRows }, { data: movements }] = await Promise.all([
    supabase.from("predictive_settings").select(PREDICTIVE_SETTINGS_COLUMNS).maybeSingle(),
    supabase
      .from("stock")
      .select("product_id, quantity, min_quantity, products(name, criticality)"),
    supabase
      .from("stock_movements")
      .select("id, product_id, type, quantity, created_at, corrects_movement_id")
      .in("type", ["entry", "exit"])
      .order("created_at", { ascending: true }),
  ]);

  const consumptionByProduct = buildConsumptionSeries(movements ?? []);

  // Only pay the purchases query when lead time is on auto (explicit null
  // or no settings row at all).
  const leadTimeAuto = settings?.lead_time_days == null;
  const autoLeadTimes = leadTimeAuto ? await fetchAutoLeadTimes(supabase) : new Map<string, number>();

  const coverageDays = settings?.coverage_days ?? DEFAULT_COVERAGE_DAYS;
  const asOf = new Date();

  const rows = await Promise.all(
    (stockRows ?? []).map(async (s): Promise<PredictionRow> => {
      const criticality = (s.products?.criticality ?? null) as ProductCriticality | null;
      const leadTimeDays = leadTimeAuto
        ? autoLeadTimes.get(s.product_id) ?? DEFAULT_LEAD_TIME_DAYS
        : settings!.lead_time_days!;

      const prediction = await predictiveModel.predict(
        {
          productId: s.product_id,
          consumption: consumptionByProduct.get(s.product_id) ?? [],
          currentStock: s.quantity,
          minQuantity: s.min_quantity,
          safetyStockDays: safetyDaysFor(settings ?? null, criticality),
        },
        { leadTimeDays, coverageDays },
        asOf
      );

      return {
        product_id: s.product_id,
        product_name: s.products?.name ?? "",
        criticality,
        current_stock: s.quantity,
        min_quantity: s.min_quantity,
        lead_time_days: leadTimeDays,
        lead_time_auto: leadTimeAuto,
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
