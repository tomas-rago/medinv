import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  CHART_TONES,
  CHART_TYPES,
  DashboardSummaryContentSchema,
  type DashboardSummaryContent,
} from "@/lib/schemas/asistencia-ia/dashboard-summary";
import { CHAT_MODEL } from "./chat";
import { DASHBOARD_SUMMARY_SYSTEM_PROMPT } from "./prompt";
import { executeTool } from "./tools";
import type { TurnUsage } from "./quota";

// Chief-doctor dashboard management summary. Unlike the streaming chat/explain
// features, this makes ONE non-streaming, forced-tool call so the model returns
// a single structured blob (headline, summary, actions, chart) that we validate
// and persist. The context is rebuilt server-side from the RLS-scoped client,
// so nothing the browser sends can inject data into the summary.

const MAX_TOKENS = 2048;

// Snapshot of the org's stock state, assembled from the same read executors the
// chatbot uses (lib/ai/tools.ts) plus the open-orders count the dashboard tile
// already shows. Kept compact so the whole thing fits comfortably in one turn.
async function buildDashboardContext(
  supabase: SupabaseClient<Database>
): Promise<string> {
  const parseTool = async (
    name: Parameters<typeof executeTool>[1],
    input: unknown
  ): Promise<unknown> => {
    const result = await executeTool(supabase, name, input);
    if (result.isError) return { error: result.content };
    try {
      return JSON.parse(result.content);
    } catch {
      return { error: "parse_failed" };
    }
  };

  const [predictions, alerts, lowStock, purchasesRes] = await Promise.all([
    parseTool("get_predictions", { limit: 20 }),
    parseTool("get_alerts", { status: "active", limit: 30 }),
    parseTool("get_stock_levels", { only_below_min: true }),
    supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "confirmed"]),
  ]);

  return JSON.stringify({
    predicciones: predictions,
    alertas: alerts,
    stock_bajo_minimo: lowStock,
    pedidos_abiertos: purchasesRes.count ?? 0,
  });
}

// System prompt stays byte-stable for caching, so the date and snapshot ride on
// the single user message.
function buildDashboardUserMessage(context: string, todayISO: string): string {
  return `[Fecha actual: ${todayISO}]\nGenerá el resumen de gestión del panel a partir de estos datos actuales de la organización (JSON):\n${context}`;
}

// The one tool the model is forced to call — its input_schema mirrors
// DashboardSummaryContentSchema. We still validate the returned input with Zod
// (the model can drift from the schema), so this is a convenience contract, not
// the source of truth.
const EMIT_TOOL_NAME = "emit_dashboard_summary";
const EMIT_TOOL: Anthropic.Tool = {
  name: EMIT_TOOL_NAME,
  description:
    "Emití el resumen de gestión del panel para el jefe médico. Es la única forma de responder.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "Una sola línea con el estado general." },
      summary: {
        type: "string",
        description: "2 a 4 oraciones con lo más importante y el cierre sobre la decisión del equipo.",
      },
      actions: {
        type: "array",
        items: { type: "string" },
        description: "Hasta 5 acciones sugeridas, de la más a la menos urgente. Lista vacía si no hay nada urgente.",
      },
      chart: {
        type: ["object", "null"],
        description: "Gráfico que acompaña el resumen, o null si no aporta.",
        properties: {
          type: { type: "string", enum: [...CHART_TYPES] },
          title: { type: "string" },
          unit: { type: "string" },
          points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "number" },
                tone: { type: "string", enum: [...CHART_TONES] },
              },
              required: ["label", "value"],
            },
          },
        },
        required: ["type", "title", "points"],
      },
    },
    required: ["headline", "summary", "actions", "chart"],
  },
};

// content is null when the model didn't emit the tool or its output failed
// validation; usage is always populated so the route can meter what was spent
// even on a bad response. usageOut is mutated in place so partial consumption
// is still metered if the call aborts or throws mid-flight.
export type DashboardSummaryResult = {
  content: DashboardSummaryContent | null;
  usage: TurnUsage;
};

// Builds the context, makes the forced-tool call and validates the output.
export async function generateDashboardSummary(
  supabase: SupabaseClient<Database>,
  todayISO: string,
  usageOut: TurnUsage,
  signal?: AbortSignal
): Promise<DashboardSummaryResult> {
  const context = await buildDashboardContext(supabase);
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const message = await client.messages.create(
    {
      model: CHAT_MODEL,
      max_tokens: MAX_TOKENS,
      // No extended thinking: forced tool_choice is incompatible with it.
      system: [
        {
          type: "text",
          text: DASHBOARD_SUMMARY_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [EMIT_TOOL],
      tool_choice: { type: "tool", name: EMIT_TOOL_NAME },
      messages: [
        { role: "user", content: buildDashboardUserMessage(context, todayISO) },
      ],
    },
    { signal }
  );

  // Counting rule: see lib/ai/quota.ts — cache reads/writes count 1:1.
  usageOut.inputTokens +=
    message.usage.input_tokens +
    (message.usage.cache_creation_input_tokens ?? 0) +
    (message.usage.cache_read_input_tokens ?? 0);
  usageOut.outputTokens += message.usage.output_tokens;

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === EMIT_TOOL_NAME
  );
  if (!toolUse) {
    console.error(
      "[dashboard-summary] no tool_use; stop_reason=",
      message.stop_reason,
      "blocks=",
      message.content.map((b) => b.type)
    );
    return { content: null, usage: usageOut };
  }

  const parsed = DashboardSummaryContentSchema.safeParse(toolUse.input);
  if (parsed.success) return { content: parsed.data, usage: usageOut };

  // A malformed chart shouldn't lose the (valid) text summary: retry with the
  // chart dropped before giving up entirely.
  if (toolUse.input && typeof toolUse.input === "object") {
    const withoutChart = DashboardSummaryContentSchema.safeParse({
      ...(toolUse.input as Record<string, unknown>),
      chart: null,
    });
    if (withoutChart.success) return { content: withoutChart.data, usage: usageOut };
  }

  console.error(
    "[dashboard-summary] validation failed:",
    JSON.stringify(parsed.error.issues)
  );
  return { content: null, usage: usageOut };
}
