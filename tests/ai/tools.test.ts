// Tests for chatbot tool argument validation and product-name resolution —
// no credentials needed (supabase is stubbed).
//
//   npx vitest run tests/ai
//
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  CHAT_TOOLS,
  TOOL_ARG_SCHEMAS,
  executeTool,
  isChatToolName,
} from "@/lib/ai/tools";

// Minimal chainable stub for the products name-lookup query
// (.from().select().ilike().limit() → { data, error }).
function productsStub(rows: { id: string; name: string }[]) {
  const builder = {
    select: () => builder,
    ilike: () => builder,
    limit: async () => ({ data: rows, error: null }),
  };
  return { from: () => builder } as unknown as SupabaseClient<Database>;
}

describe("tool definitions", () => {
  it("every declared tool has an argument schema, and vice versa", () => {
    const declared = CHAT_TOOLS.map((t) => t.name).sort();
    const withSchemas = Object.keys(TOOL_ARG_SCHEMAS).sort();
    expect(declared).toEqual(withSchemas);
    for (const name of declared) expect(isChatToolName(name)).toBe(true);
    expect(isChatToolName("drop_tables")).toBe(false);
  });
});

describe("argument schemas", () => {
  it("clamps get_alerts limit to 1..50 and rejects unknown enums", () => {
    const schema = TOOL_ARG_SCHEMAS.get_alerts;
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ limit: 50, type: "expiry" }).success).toBe(true);
    expect(schema.safeParse({ limit: 0 }).success).toBe(false);
    expect(schema.safeParse({ limit: 51 }).success).toBe(false);
    expect(schema.safeParse({ type: "everything" }).success).toBe(false);
    expect(schema.safeParse({ status: "archived" }).success).toBe(false);
  });

  it("requires a non-empty product for the detail tool", () => {
    const schema = TOOL_ARG_SCHEMAS.get_product_prediction_detail;
    expect(schema.safeParse({ product: "gasas" }).success).toBe(true);
    expect(schema.safeParse({ product: "  " }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("accepts empty args where every field is optional", () => {
    expect(TOOL_ARG_SCHEMAS.get_stock_levels.safeParse({}).success).toBe(true);
    expect(TOOL_ARG_SCHEMAS.get_predictions.safeParse({}).success).toBe(true);
  });
});

describe("executeTool", () => {
  const anySupabase = productsStub([]);

  it("rejects unknown tools without touching the database", async () => {
    const result = await executeTool(anySupabase, "delete_everything", {});
    expect(result.isError).toBe(true);
  });

  it("returns is_error (not a throw) on invalid arguments so the model can retry", async () => {
    const result = await executeTool(anySupabase, "get_alerts", { limit: 999 });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("get_alerts");
  });

  it("reports no-match product searches as an error result", async () => {
    const result = await executeTool(productsStub([]), "get_product_prediction_detail", {
      product: "inexistente",
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("inexistente");
  });

  it("returns the candidate list when a product name is ambiguous", async () => {
    const candidates = [
      { id: "11111111-1111-1111-1111-111111111111", name: "Gasas 10x10" },
      { id: "22222222-2222-2222-2222-222222222222", name: "Gasas 5x5" },
    ];
    const result = await executeTool(
      productsStub(candidates),
      "get_product_prediction_detail",
      { product: "gasas" }
    );
    expect(result.isError).toBe(false);
    const payload = JSON.parse(result.content);
    expect(payload.ambiguous).toBe(true);
    expect(payload.candidates).toEqual(candidates);
  });
});
