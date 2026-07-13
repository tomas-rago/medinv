import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ExplainRequest,
  ExplainScreen,
} from "@/lib/schemas/asistencia-ia/explain";
import { executeTool } from "./tools";
import type { ChatToolName } from "./wire";

// Context building for the one-shot "explain this screen" feature (module 6).
// Each screen maps to one of the chatbot's read-only tool executors, so the
// queries, row caps and JSON shape live in a single place (lib/ai/tools.ts)
// and everything runs on the caller's RLS-scoped client. Instructions are
// model-facing prose, not UI copy — they stay here, outside i18n.

type ScreenSource = {
  tool: ChatToolName;
  args: (req: ExplainRequest) => Record<string, unknown>;
  instruction: string;
};

const SCREEN_SOURCES: Record<ExplainScreen, ScreenSource> = {
  stock: {
    tool: "get_stock_levels",
    args: () => ({ include_batches: true }),
    instruction:
      "El usuario está viendo la pantalla de Inventario: existencias actuales por producto, con sus lotes y fechas de vencimiento. Analizá el estado general del stock: productos en o por debajo del mínimo, lotes vencidos o que vencen pronto, y cualquier situación que requiera atención.",
  },
  alerts: {
    tool: "get_alerts",
    args: () => ({ limit: 50 }),
    instruction:
      "El usuario está viendo la pantalla de Alertas: alertas activas de stock bajo (low_stock), vencimiento (expiry) y sugerencia de pedido (reorder_suggested). Resumí la situación: qué alertas son más urgentes, si hay patrones (por ejemplo, varios productos con el mismo problema) y qué conviene atender primero. Si no hay alertas activas, decilo con tranquilidad.",
  },
  predictive: {
    tool: "get_predictions",
    args: () => ({ limit: 30 }),
    instruction:
      "El usuario está viendo la pantalla de Gestión Predictiva: predicciones de reposición por producto, ordenadas de más a menos urgente. Explicá qué productos conviene pedir ahora o pronto y por qué, y mencioná aparte los que todavía no tienen historial de consumo suficiente.",
  },
  predictive_detail: {
    tool: "get_product_prediction_detail",
    args: (req) => ({ product: req.productId }),
    instruction:
      "El usuario está viendo el detalle predictivo de UN producto: demanda diaria, punto de pedido, cantidad sugerida, consumo reciente y la validación de los últimos 30 días (consumo real vs. proyectado). Explicá en lenguaje simple qué significan estos números para este producto, qué tan confiable viene siendo la estimación y qué acción conviene tomar.",
  },
};

export type ExplainContext = { instruction: string; data: string };

// Fresh, RLS-scoped snapshot of the screen's data. Null means the underlying
// query failed (or the product doesn't exist in the org) — the route turns
// that into an error response instead of analyzing nothing.
export async function buildExplainContext(
  supabase: SupabaseClient<Database>,
  req: ExplainRequest
): Promise<ExplainContext | null> {
  const source = SCREEN_SOURCES[req.screen];
  const result = await executeTool(supabase, source.tool, source.args(req));
  if (result.isError) return null;
  return { instruction: source.instruction, data: result.content };
}

// The system prompt is byte-stable for caching, so the date and all screen
// context ride on the single user message.
export function buildExplainUserMessage(
  context: ExplainContext,
  todayISO: string
): string {
  return `[Fecha actual: ${todayISO}]\n${context.instruction}\n\nDatos actuales de la pantalla (JSON):\n${context.data}`;
}
