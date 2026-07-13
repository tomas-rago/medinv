// Pure math tests for the regression/ROP model — no credentials needed.
//
//   npx vitest run tests/predictive
//
import { describe, it, expect } from "vitest";
import { RegressionRopModel } from "@/lib/predictive/regression-rop";
import type { PredictionInputs, ProductHistory } from "@/lib/predictive/base";

const model = new RegressionRopModel();

// Fixed reference day; consumption dates are built relative to it.
const AS_OF = new Date("2026-07-06T12:00:00Z");

function daysAgo(n: number): string {
  const d = new Date(AS_OF);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function history(overrides: Partial<ProductHistory>): ProductHistory {
  return {
    productId: "p1",
    consumption: [],
    currentStock: 100,
    minQuantity: 0,
    safetyStockDays: 0,
    ...overrides,
  };
}

const baseInputs: PredictionInputs = {
  leadTimeDays: 7,
  coverageDays: 30,
};

describe("RegressionRopModel", () => {
  it("returns insufficient_data below the minimum consumption days", async () => {
    const p = await model.predict(
      history({ consumption: [{ date: daysAgo(5), quantity: 4 }, { date: daysAgo(2), quantity: 3 }] }),
      baseInputs,
      AS_OF
    );
    expect(p.method).toBe("insufficient_data");
    expect(p.dailyDemand).toBeNull();
    expect(p.reorderPoint).toBeNull();
    expect(p.suggestedQuantity).toBeNull();
  });

  it("ignores fully rectified (zero-quantity) days", async () => {
    const p = await model.predict(
      history({
        consumption: [
          { date: daysAgo(6), quantity: 0 },
          { date: daysAgo(4), quantity: 2 },
          { date: daysAgo(2), quantity: 3 },
        ],
      }),
      baseInputs,
      AS_OF
    );
    expect(p.method).toBe("insufficient_data");
  });

  it("uses a simple average over the elapsed span when history is short", async () => {
    // 5 + 3 + 2 = 10 units over a 10-day span (first event 9 days ago).
    const p = await model.predict(
      history({
        consumption: [
          { date: daysAgo(9), quantity: 5 },
          { date: daysAgo(5), quantity: 3 },
          { date: daysAgo(1), quantity: 2 },
        ],
      }),
      baseInputs,
      AS_OF
    );
    expect(p.method).toBe("average");
    expect(p.dailyDemand).toBeCloseTo(1, 10);
    expect(p.trendPerDay).toBeNull();
  });

  it("switches to regression with enough points and span; flat series has no trend", async () => {
    // 2 units every day for 20 days.
    const consumption = Array.from({ length: 20 }, (_, i) => ({
      date: daysAgo(19 - i),
      quantity: 2,
    }));
    const p = await model.predict(history({ consumption }), baseInputs, AS_OF);
    expect(p.method).toBe("regression");
    expect(p.dailyDemand).toBeCloseTo(2, 10);
    expect(p.trendPerDay).toBeCloseTo(0, 10);
  });

  it("regression projects today's demand from a linear trend", async () => {
    // Consumption grows 1, 2, …, 14 over 14 days → demand today ≈ 14.
    const consumption = Array.from({ length: 14 }, (_, i) => ({
      date: daysAgo(13 - i),
      quantity: i + 1,
    }));
    const p = await model.predict(history({ consumption }), baseInputs, AS_OF);
    expect(p.method).toBe("regression");
    expect(p.trendPerDay).toBeCloseTo(1, 10);
    expect(p.dailyDemand).toBeCloseTo(14, 10);
  });

  it("clamps projected demand at zero when the trend has died out", async () => {
    // Heavy consumption long ago, nothing since → projection would go negative.
    const consumption = Array.from({ length: 6 }, (_, i) => ({
      date: daysAgo(40 - i),
      quantity: 10,
    }));
    const p = await model.predict(history({ consumption }), baseInputs, AS_OF);
    expect(p.method).toBe("regression");
    expect(p.dailyDemand).toBe(0);
    // No demand → no stockout horizon, no suggested quantity.
    expect(p.daysUntilReorder).toBeNull();
    expect(p.suggestedQuantity).toBeNull();
  });

  it("computes reorder point, days-until-reorder and the coverage-target quantity", async () => {
    // 30 units on each of 3 days, first 8 days ago → 90 / 9 = 10/day.
    const h = history({
      consumption: [
        { date: daysAgo(8), quantity: 30 },
        { date: daysAgo(7), quantity: 30 },
        { date: daysAgo(6), quantity: 30 },
      ],
      currentStock: 130,
      minQuantity: 10,
    });
    const inputs: PredictionInputs = {
      leadTimeDays: 5,
      coverageDays: 30,
    };
    const p = await model.predict(h, inputs, AS_OF);
    expect(p.method).toBe("average");
    expect(p.dailyDemand).toBeCloseTo(10, 10);
    // ceil(10 * 5 + 10)
    expect(p.reorderPoint).toBe(60);
    // floor((130 - 60) / 10)
    expect(p.daysUntilReorder).toBe(7);
    // ceil(10 * (5 + 30) + 10 - 130)
    expect(p.suggestedQuantity).toBe(230);
  });

  it("flags order-now when stock is already at the reorder point", async () => {
    const h = history({
      consumption: [
        { date: daysAgo(8), quantity: 30 },
        { date: daysAgo(7), quantity: 30 },
        { date: daysAgo(6), quantity: 30 },
      ],
      currentStock: 40, // below reorder point of 60
      minQuantity: 10,
    });
    const p = await model.predict(h, { ...baseInputs, leadTimeDays: 5 }, AS_OF);
    expect(p.daysUntilReorder).toBe(0);
  });

  it("clamps the suggested quantity at zero when stock exceeds the coverage target", async () => {
    const h = history({
      consumption: [
        { date: daysAgo(8), quantity: 30 },
        { date: daysAgo(7), quantity: 30 },
        { date: daysAgo(6), quantity: 30 },
      ],
      currentStock: 1000, // far above the 360-unit coverage target
      minQuantity: 10,
    });
    const p = await model.predict(h, { leadTimeDays: 5, coverageDays: 30 }, AS_OF);
    expect(p.suggestedQuantity).toBe(0);
    expect(p.reorderPoint).toBe(60); // reorder point unaffected by coverage
  });

  it("criticality safety days scale the safety stock with demand", async () => {
    // 10/day demand; 3 safety days beat the 10-unit floor: safety stock 30.
    const h = history({
      consumption: [
        { date: daysAgo(8), quantity: 30 },
        { date: daysAgo(7), quantity: 30 },
        { date: daysAgo(6), quantity: 30 },
      ],
      currentStock: 130,
      minQuantity: 10,
      safetyStockDays: 3,
    });
    const p = await model.predict(h, { leadTimeDays: 5, coverageDays: 30 }, AS_OF);
    expect(p.safetyStock).toBe(30);
    // ceil(10 * 5 + 30)
    expect(p.reorderPoint).toBe(80);
    // ceil(10 * (5 + 30) + 30 - 130)
    expect(p.suggestedQuantity).toBe(250);
  });

  it("a larger manual min_quantity still wins over the criticality buffer", async () => {
    const h = history({
      consumption: [
        { date: daysAgo(8), quantity: 30 },
        { date: daysAgo(7), quantity: 30 },
        { date: daysAgo(6), quantity: 30 },
      ],
      currentStock: 500,
      minQuantity: 100, // > 10/day x 3 days
      safetyStockDays: 3,
    });
    const p = await model.predict(h, { leadTimeDays: 5, coverageDays: 30 }, AS_OF);
    expect(p.safetyStock).toBe(100);
    // ceil(10 * 5 + 100)
    expect(p.reorderPoint).toBe(150);
  });
});
