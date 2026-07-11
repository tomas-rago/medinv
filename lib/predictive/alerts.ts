import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getPredictions, type PredictionRow } from "./data";

// Pushes the model's reorder points into the alerts lifecycle: the
// sync_reorder_alerts RPC (security definer) fires/refreshes an active
// reorder_suggested alert where stock <= reorder point and resolves the
// rest. Called on page load like sweep_alerts — no scheduler. Fire and
// forget: alert sync must never break a page render.
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
      }));
    const { error } = await supabase.rpc("sync_reorder_alerts", { p_items: items });
    if (error) console.error("sync_reorder_alerts failed:", error.message);
  } catch (e) {
    console.error("syncReorderAlerts failed:", e);
  }
}
