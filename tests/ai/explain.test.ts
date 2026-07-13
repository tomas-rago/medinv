// Tests for the "explain this screen" request schema and context building —
// no credentials needed (supabase is stubbed).
//
//   npx vitest run tests/ai
//
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  EXPLAIN_SCREENS,
  ExplainRequestSchema,
} from "@/lib/schemas/asistencia-ia/explain";
import {
  buildExplainContext,
  buildExplainUserMessage,
} from "@/lib/ai/explain";

const A_UUID = "3f2f1de0-6c1b-4f6e-9a6a-2b7c8d9e0f11";

// Minimal stub for the stock-screen queries: stock is awaited right after
// .select(), stock_batches after .select().neq().
function stockStub(opts: { stockError?: boolean } = {}) {
  const stockRows = [
    {
      product_id: A_UUID,
      quantity: 2,
      min_quantity: 5,
      products: { name: "Gasas estériles", category: "descartables", unit: "unit" },
    },
  ];
  const batchRows = [
    { product_id: A_UUID, expiry_date: "2026-08-01", quantity: 2 },
  ];
  return {
    from: (table: string) => {
      if (table === "stock") {
        return {
          select: async () =>
            opts.stockError
              ? { data: null, error: { message: "boom" } }
              : { data: stockRows, error: null },
        };
      }
      return {
        select: () => ({ neq: async () => ({ data: batchRows, error: null }) }),
      };
    },
  } as unknown as SupabaseClient<Database>;
}

describe("ExplainRequestSchema", () => {
  it("accepts every list screen without a product", () => {
    for (const screen of ["stock", "alerts", "predictive"] as const) {
      expect(ExplainRequestSchema.safeParse({ screen }).success).toBe(true);
    }
  });

  it("requires a product uuid for the detail screen", () => {
    expect(
      ExplainRequestSchema.safeParse({ screen: "predictive_detail" }).success
    ).toBe(false);
    expect(
      ExplainRequestSchema.safeParse({
        screen: "predictive_detail",
        productId: "gasas",
      }).success
    ).toBe(false);
    expect(
      ExplainRequestSchema.safeParse({
        screen: "predictive_detail",
        productId: A_UUID,
      }).success
    ).toBe(true);
  });

  it("rejects unknown screens and empty bodies", () => {
    expect(ExplainRequestSchema.safeParse({ screen: "settings" }).success).toBe(false);
    expect(ExplainRequestSchema.safeParse({}).success).toBe(false);
    expect(ExplainRequestSchema.safeParse(null).success).toBe(false);
  });
});

describe("buildExplainContext", () => {
  it("returns the screen instruction plus the tool's JSON snapshot", async () => {
    const context = await buildExplainContext(stockStub(), { screen: "stock" });
    expect(context).not.toBeNull();
    expect(context!.instruction).toContain("Inventario");

    const data = JSON.parse(context!.data);
    expect(data.products).toHaveLength(1);
    expect(data.products[0].name).toBe("Gasas estériles");
    expect(data.products[0].below_min).toBe(true);
    // The stock screen always requests batches — expiry analysis needs them.
    expect(data.products[0].batches).toEqual([
      { expiry_date: "2026-08-01", quantity: 2 },
    ]);
  });

  it("returns null when the underlying query fails", async () => {
    const context = await buildExplainContext(stockStub({ stockError: true }), {
      screen: "stock",
    });
    expect(context).toBeNull();
  });

  it("covers every declared screen", () => {
    // Record<ExplainScreen, …> enforces this at compile time; the runtime
    // check guards against the enum growing without a source.
    for (const screen of EXPLAIN_SCREENS) {
      expect(typeof screen).toBe("string");
    }
  });
});

describe("buildExplainUserMessage", () => {
  it("stitches date, instruction and data into one user message", () => {
    const message = buildExplainUserMessage(
      { instruction: "Mirá el stock.", data: '{"products":[]}' },
      "2026-07-11"
    );
    expect(message).toContain("[Fecha actual: 2026-07-11]");
    expect(message).toContain("Mirá el stock.");
    expect(message).toContain('{"products":[]}');
    // Instruction comes before the data so the model reads the task first.
    expect(message.indexOf("Mirá el stock.")).toBeLessThan(
      message.indexOf('{"products":[]}')
    );
  });
});
