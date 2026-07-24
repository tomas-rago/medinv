import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getPredictions, type PredictionRow } from "./data";

// Pushes the model's reorder verdict into the alerts lifecycle: the
// sync_reorder_alerts RPC (security definer) fires/refreshes an active
// reorder_suggested alert for every product the model flags and resolves the
// rest. Called on page load like sweep_alerts — no scheduler. Fire and
// forget: alert sync must never break a page render.
//
// The payload shape is coupled to migration 20260723000001: `should_fire` is
// required, and a payload without it fires nothing and resolves everything.
export async function syncReorderAlerts(
  supabase: SupabaseClient<Database>,
  rows?: PredictionRow[]
): Promise<void> {
  try {
    const predictionRows = rows ?? (await getPredictions(supabase)).rows;
    const items = predictionRows
      .filter((r) => r.prediction.reorderPoint !== null)
      .map((r) => ({
        product_id: r.product_id,
        reorder_point: r.prediction.reorderPoint,
        // The stock figure the model actually reasoned about. The DB must not
        // re-read stock.quantity: it still counts lots that have already
        // expired, because nothing writes them off.
        usable_stock: r.usable_stock,
        // The model's verdict. It folds in the lead-time lookahead over the
        // FEFO projection — a temporal walk SQL cannot redo — so the decision
        // is passed in rather than re-derived. Zero-demand products have a
        // reorder point but no reorder day, so they never fire here; the
        // static low_stock alert still covers their floor.
        should_fire: r.prediction.daysUntilReorder === 0,
      }));
    const { error } = await supabase.rpc("sync_reorder_alerts", { p_items: items });
    if (error) console.error("sync_reorder_alerts failed:", error.message);
  } catch (e) {
    console.error("syncReorderAlerts failed:", e);
  }
}
