import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  getPredictions,
  groupBatchesByProduct,
  STOCK_BATCH_COLUMNS,
} from "@/lib/predictive/data";
import { getProductDetail } from "@/lib/predictive/detail";
import type { ChatToolName } from "./wire";

// Read-only tools for the chatbot. Every query runs through the caller's
// RLS-scoped client, so org scoping is automatic and nothing here can see
// another organization's data. Executors clamp limits server-side — the
// model's arguments are untrusted input.

const STOCK_ROW_CAP = 200;
const CONSUMPTION_POINT_CAP = 60;

// Fixed order: tools render at the start of the prompt, so any reordering
// would invalidate the prompt cache.
export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_stock_levels",
    description:
      "Consulta las existencias actuales de insumos. Usala para responder cuánto stock hay de un producto, qué productos están por debajo del stock mínimo, o qué lotes vencen pronto (con include_batches).",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Filtro por nombre de producto (coincidencia parcial, sin distinguir mayúsculas).",
        },
        only_below_min: {
          type: "boolean",
          description: "Si es true, devuelve solo productos con stock igual o menor al mínimo.",
        },
        include_batches: {
          type: "boolean",
          description: "Si es true, incluye los lotes de cada producto con su fecha de vencimiento.",
        },
      },
    },
  },
  {
    name: "get_alerts",
    description:
      "Consulta las alertas del inventario: stock bajo (low_stock), vencimiento próximo (expiry) y sugerencia de pedido (reorder_suggested).",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["low_stock", "expiry", "reorder_suggested"],
          description: "Filtrar por tipo de alerta.",
        },
        status: {
          type: "string",
          enum: ["active", "resolved"],
          description: "Estado de la alerta; por defecto solo activas.",
        },
        limit: {
          type: "integer",
          description: "Cantidad máxima de alertas (1 a 50, por defecto 20).",
        },
      },
    },
  },
  {
    name: "get_predictions",
    description:
      "Resumen de predicciones de reposición para los productos, ordenado de más a menos urgente. days_until_reorder 0 significa pedir ahora; method insufficient_data significa que falta historial de consumo.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Cantidad máxima de productos (1 a 50, por defecto 15).",
        },
        only_urgent: {
          type: "boolean",
          description:
            "Si es true, devuelve solo productos cuyo stock alcanza el punto de pedido dentro de su lead time.",
        },
      },
    },
  },
  {
    name: "get_product_prediction_detail",
    description:
      "Detalle predictivo de UN producto: demanda diaria, punto de pedido, cantidad sugerida, consumo reciente y validación de los últimos 30 días. Acepta el nombre del producto o su id (uuid). Si hay varios candidatos, devuelve la lista para desambiguar.",
    input_schema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description: "Nombre (parcial) o id (uuid) del producto.",
        },
      },
      required: ["product"],
    },
  },
];

// Per-tool argument schemas: a parse failure becomes an is_error tool_result
// so the model can correct itself instead of the request failing.
export const TOOL_ARG_SCHEMAS = {
  get_stock_levels: z.object({
    query: z.string().trim().min(1).max(200).optional(),
    only_below_min: z.boolean().optional(),
    include_batches: z.boolean().optional(),
  }),
  get_alerts: z.object({
    type: z.enum(["low_stock", "expiry", "reorder_suggested"]).optional(),
    status: z.enum(["active", "resolved"]).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  get_predictions: z.object({
    limit: z.number().int().min(1).max(50).optional(),
    only_urgent: z.boolean().optional(),
  }),
  get_product_prediction_detail: z.object({
    product: z.string().trim().min(1).max(200),
  }),
} satisfies Record<ChatToolName, z.ZodTypeAny>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isChatToolName(name: string): name is ChatToolName {
  return name in TOOL_ARG_SCHEMAS;
}

// Drops null/undefined entries so tool results stay compact for the model.
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  );
}

export type ToolResult = { content: string; isError: boolean };

const ok = (payload: unknown): ToolResult => ({
  content: JSON.stringify(payload),
  isError: false,
});
const fail = (message: string): ToolResult => ({
  content: message,
  isError: true,
});

async function getStockLevels(
  supabase: SupabaseClient<Database>,
  args: z.infer<(typeof TOOL_ARG_SCHEMAS)["get_stock_levels"]>
): Promise<ToolResult> {
  const { data: stockRows, error } = await supabase
    .from("stock")
    .select("product_id, quantity, min_quantity, products(name, category, unit)");
  if (error) return fail("No se pudo consultar el stock; probá de nuevo.");

  const needle = args.query?.toLocaleLowerCase("es");
  let rows = (stockRows ?? []).filter((s) => {
    const name = s.products?.name ?? "";
    if (needle && !name.toLocaleLowerCase("es").includes(needle)) return false;
    if (args.only_below_min && s.quantity > s.min_quantity) return false;
    return true;
  });
  rows.sort((a, b) =>
    (a.products?.name ?? "").localeCompare(b.products?.name ?? "", "es")
  );

  const omitted = Math.max(0, rows.length - STOCK_ROW_CAP);
  rows = rows.slice(0, STOCK_ROW_CAP);

  // FEFO-ordered, same grouping the predictive model runs on.
  let batchesByProduct: Map<string, { expiry_date: string | null; quantity: number }[]> | null =
    null;
  if (args.include_batches) {
    const { data: batchRows } = await supabase
      .from("stock_batches")
      .select(STOCK_BATCH_COLUMNS)
      .neq("quantity", 0);
    batchesByProduct = new Map();
    for (const [productId, lots] of groupBatchesByProduct(batchRows ?? [])) {
      batchesByProduct.set(
        productId,
        lots.map((l) => ({ expiry_date: l.expiryDate, quantity: l.quantity }))
      );
    }
  }

  return ok({
    products: rows.map((s) =>
      compact({
        product_id: s.product_id,
        name: s.products?.name ?? null,
        category: s.products?.category ?? null,
        unit: s.products?.unit ?? null,
        quantity: s.quantity,
        min_quantity: s.min_quantity,
        below_min: s.quantity <= s.min_quantity,
        batches: batchesByProduct?.get(s.product_id),
      })
    ),
    ...(omitted > 0 ? { omitted_products: omitted } : {}),
  });
}

async function getAlerts(
  supabase: SupabaseClient<Database>,
  args: z.infer<(typeof TOOL_ARG_SCHEMAS)["get_alerts"]>
): Promise<ToolResult> {
  let query = supabase
    .from("alerts")
    .select("id, type, status, quantity, threshold, expiry_date, triggered_at, products(name)")
    .order("triggered_at", { ascending: false })
    .limit(args.limit ?? 20);
  query = query.eq("status", args.status ?? "active");
  if (args.type) query = query.eq("type", args.type);

  const { data, error } = await query;
  if (error) return fail("No se pudieron consultar las alertas; probá de nuevo.");

  return ok({
    alerts: (data ?? []).map((a) =>
      compact({
        product_name: a.products?.name ?? null,
        type: a.type,
        status: a.status,
        quantity: a.quantity,
        threshold: a.threshold,
        expiry_date: a.expiry_date,
        triggered_at: a.triggered_at,
      })
    ),
  });
}

type PredictionRowLike = Awaited<ReturnType<typeof getPredictions>>["rows"][number];

function compactPredictionRow(row: PredictionRowLike): Record<string, unknown> {
  const p = row.prediction;
  return compact({
    product_id: row.product_id,
    name: row.product_name,
    criticality: row.criticality,
    current_stock: row.current_stock,
    usable_stock: row.usable_stock,
    expired_stock: p.expiredStock,
    min_quantity: row.min_quantity,
    lead_time_days: row.lead_time_days,
    method: p.method,
    daily_demand: p.dailyDemand,
    projected_waste: p.projectedWaste,
    safety_stock: p.safetyStock,
    reorder_point: p.reorderPoint,
    days_until_reorder: p.daysUntilReorder,
    suggested_quantity: p.suggestedQuantity,
  });
}

async function getPredictionsSummary(
  supabase: SupabaseClient<Database>,
  args: z.infer<(typeof TOOL_ARG_SCHEMAS)["get_predictions"]>
): Promise<ToolResult> {
  const { rows, settings } = await getPredictions(supabase);

  let selected = rows;
  if (args.only_urgent) {
    selected = selected.filter(
      (r) =>
        r.prediction.daysUntilReorder !== null &&
        r.prediction.daysUntilReorder <= r.lead_time_days
    );
  }
  const omitted = Math.max(0, selected.length - (args.limit ?? 15));
  selected = selected.slice(0, args.limit ?? 15);

  return ok({
    // Already sorted most-urgent-first by getPredictions.
    products: selected.map(compactPredictionRow),
    ...(omitted > 0 ? { omitted_products: omitted } : {}),
    settings: compact({
      coverage_days: settings?.coverage_days ?? 30,
      lead_time_days:
        settings?.lead_time_days ?? "auto (promedio de entregas por producto)",
    }),
  });
}

async function getProductPredictionDetail(
  supabase: SupabaseClient<Database>,
  args: z.infer<(typeof TOOL_ARG_SCHEMAS)["get_product_prediction_detail"]>
): Promise<ToolResult> {
  let productId = args.product;

  if (!UUID_RE.test(productId)) {
    // The model usually knows names, not UUIDs: resolve by name first.
    const escaped = args.product.replace(/[%_]/g, "\\$&");
    const { data: candidates, error } = await supabase
      .from("products")
      .select("id, name")
      .ilike("name", `%${escaped}%`)
      .limit(6);
    if (error) return fail("No se pudo buscar el producto; probá de nuevo.");
    if (!candidates || candidates.length === 0) {
      return fail(`No se encontró ningún producto que coincida con "${args.product}".`);
    }
    if (candidates.length > 1) {
      return ok({
        ambiguous: true,
        instruction:
          "Hay varios productos que coinciden. Pedile al usuario que aclare, o volvé a llamar a esta herramienta con el id exacto.",
        candidates,
      });
    }
    productId = candidates[0].id;
  }

  const detail = await getProductDetail(supabase, productId);
  if (!detail) {
    return fail("No se encontró el producto solicitado en el stock de la organización.");
  }

  // Summarize the backtest instead of shipping 30 day-rows: total actual vs
  // projected consumption over the window is enough for the model to judge
  // how reliable the estimate has been.
  const projectedDays = detail.backtest.days.filter((d) => d.projected !== null);
  const backtest = compact({
    window_start: detail.backtest.windowStart,
    method: detail.backtest.method,
    total_actual: detail.backtest.days.reduce((sum, d) => sum + d.actual, 0),
    total_projected:
      projectedDays.length > 0
        ? Math.round(projectedDays.reduce((sum, d) => sum + (d.projected ?? 0), 0) * 100) / 100
        : null,
  });

  return ok({
    product: compactPredictionRow(detail.row),
    lead_time_auto: detail.row.lead_time_auto,
    recent_consumption: detail.consumption.slice(-CONSUMPTION_POINT_CAP),
    backtest_last_30_days: backtest,
  });
}

function invalidArgs(name: ChatToolName, error: z.ZodError): ToolResult {
  return fail(
    `Argumentos inválidos para ${name}: ${error.issues
      .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
      .join("; ")}`
  );
}

export async function executeTool(
  supabase: SupabaseClient<Database>,
  name: string,
  input: unknown
): Promise<ToolResult> {
  if (!isChatToolName(name)) {
    return fail(`Herramienta desconocida: ${name}`);
  }

  try {
    // Parsing inside each case keeps the schema ↔ executor pairing typed.
    switch (name) {
      case "get_stock_levels": {
        const parsed = TOOL_ARG_SCHEMAS[name].safeParse(input ?? {});
        if (!parsed.success) return invalidArgs(name, parsed.error);
        return await getStockLevels(supabase, parsed.data);
      }
      case "get_alerts": {
        const parsed = TOOL_ARG_SCHEMAS[name].safeParse(input ?? {});
        if (!parsed.success) return invalidArgs(name, parsed.error);
        return await getAlerts(supabase, parsed.data);
      }
      case "get_predictions": {
        const parsed = TOOL_ARG_SCHEMAS[name].safeParse(input ?? {});
        if (!parsed.success) return invalidArgs(name, parsed.error);
        return await getPredictionsSummary(supabase, parsed.data);
      }
      case "get_product_prediction_detail": {
        const parsed = TOOL_ARG_SCHEMAS[name].safeParse(input ?? {});
        if (!parsed.success) return invalidArgs(name, parsed.error);
        return await getProductPredictionDetail(supabase, parsed.data);
      }
    }
  } catch {
    return fail("La consulta falló; probá de nuevo o reformulá la pregunta.");
  }
}
