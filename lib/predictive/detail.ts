import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ProductCriticality } from "@/lib/constants/criticality";
import { predictiveModel } from "./index";
import { DEFAULT_LEAD_TIME_DAYS, fetchAutoLeadTimes } from "./lead-time";
import {
  buildConsumptionSeries,
  groupBatchesByProduct,
  safetyDaysFor,
  PREDICTIVE_SETTINGS_COLUMNS,
  STOCK_BATCH_COLUMNS,
} from "./data";
import { buildBacktestSeries, type BacktestDay } from "./backtest";
import type {
  ConsumptionPoint,
  PredictionMethod,
} from "./base";
import type { MovementRow, PredictionRow, PredictiveSettingsRow } from "./data";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

const MS_PER_DAY = 86_400_000;
const BACKTEST_WINDOW_DAYS = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProductDetail = {
  product: { id: string; name: string; criticality: ProductCriticality | null };
  row: PredictionRow;
  consumption: ConsumptionPoint[];
  backtest: {
    windowStart: string; // YYYY-MM-DD; window ends today
    // Method of the model fitted on pre-window history only —
    // "insufficient_data" means the projected line is unavailable.
    method: PredictionMethod;
    days: BacktestDay[];
  };
};

// Single-product version of getPredictions plus a 30-day backtest for the
// projected-vs-actual chart. RLS scopes every query, so a nonexistent or
// foreign-org product simply yields no stock row → null → 404 upstream.
export async function getProductDetail(
  supabase: SupabaseClient<Database>,
  productId: string
): Promise<ProductDetail | null> {
  // Guard before querying: a malformed id would raise a Postgres uuid
  // cast error instead of returning zero rows.
  if (!UUID_RE.test(productId)) return null;

  const [{ data: settings }, { data: stockRow }, movements, { data: batchRows }] =
    await Promise.all([
      supabase.from("predictive_settings").select(PREDICTIVE_SETTINGS_COLUMNS).maybeSingle(),
      supabase
        .from("stock")
        .select("product_id, quantity, min_quantity, products(name, criticality)")
        .eq("product_id", productId)
        .maybeSingle(),
      // Paged for the same reason as getPredictions: PostgREST returns at most
      // 1000 rows, and this read is ordered ascending, so an unpaged version
      // would drop the newest movements of a long-lived product.
      fetchAllRows<MovementRow>((from, to) =>
        supabase
          .from("stock_movements")
          .select("id, product_id, type, quantity, created_at, corrects_movement_id")
          .eq("product_id", productId)
          .in("type", ["entry", "exit"])
          .order("created_at", { ascending: true })
          .range(from, to)
      ),
      supabase.from("stock_batches").select(STOCK_BATCH_COLUMNS).eq("product_id", productId),
    ]);
  if (!stockRow) return null;

  const typedSettings = (settings ?? null) as PredictiveSettingsRow | null;
  const criticality = (stockRow.products?.criticality ?? null) as ProductCriticality | null;
  const consumption = buildConsumptionSeries(movements).get(productId) ?? [];

  const leadTimeAuto = typedSettings?.lead_time_days == null;
  const leadTimeDays = leadTimeAuto
    ? (await fetchAutoLeadTimes(supabase, productId)).get(productId) ?? DEFAULT_LEAD_TIME_DAYS
    : typedSettings!.lead_time_days!;

  const history = {
    productId,
    consumption,
    currentStock: stockRow.quantity,
    batches: groupBatchesByProduct(batchRows ?? []).get(productId) ?? [],
    minQuantity: stockRow.min_quantity,
    safetyStockDays: safetyDaysFor(typedSettings, criticality),
  };
  const inputs = {
    leadTimeDays,
    coverageDays: typedSettings?.coverage_days ?? 30,
  };

  const asOf = new Date();
  const prediction = await predictiveModel.predict(history, inputs, asOf);

  // Backtest: fit only on history strictly before the window (which ends
  // today), then project across it.
  const windowStart = new Date(asOf.getTime() - (BACKTEST_WINDOW_DAYS - 1) * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  const windowStartDate = new Date(`${windowStart}T00:00:00Z`);
  // Today's lots say nothing about a past window, so the refit runs without
  // them — only its demand estimate is used to draw the projected line.
  const fitted = await predictiveModel.predict(
    { ...history, batches: [], consumption: consumption.filter((p) => p.date < windowStart) },
    inputs,
    windowStartDate
  );

  return {
    product: {
      id: productId,
      name: stockRow.products?.name ?? "",
      criticality,
    },
    row: {
      product_id: productId,
      product_name: stockRow.products?.name ?? "",
      criticality,
      current_stock: stockRow.quantity,
      usable_stock: prediction.usableStock,
      min_quantity: stockRow.min_quantity,
      lead_time_days: leadTimeDays,
      lead_time_auto: leadTimeAuto,
      prediction,
    },
    consumption,
    backtest: {
      windowStart,
      method: fitted.method,
      days: buildBacktestSeries(consumption, fitted, windowStart, BACKTEST_WINDOW_DAYS),
    },
  };
}
