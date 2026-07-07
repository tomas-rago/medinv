// Pure math tests for the regression/EOQ model — no credentials needed.
//
//   npx vitest run tests/predictive
//
import { describe, it, expect } from "vitest";
import { RegressionEoqModel } from "@/lib/predictive/regression-eoq";
import type { PredictionInputs, ProductHistory } from "@/lib/predictive/base";

const model = new RegressionEoqModel();

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
    unitCost: null,
    ...overrides,
  };
}

const noCosts: PredictionInputs = {
  leadTimeDays: 7,
  orderingCost: null,
  holdingCostRate: null,
};

describe("RegressionEoqModel", () => {
  it("returns insufficient_data below the minimum consumption days", async () => {
    const p = await model.predict(
      history({ consumption: [{ date: daysAgo(5), quantity: 4 }, { date: daysAgo(2), quantity: 3 }] }),
      noCosts,
      AS_OF
    );
    expect(p.method).toBe("insufficient_data");
    expect(p.dailyDemand).toBeNull();
    expect(p.reorderPoint).toBeNull();
    expect(p.eoq).toBeNull();
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
      noCosts,
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
      noCosts,
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
    const p = await model.predict(history({ consumption }), noCosts, AS_OF);
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
    const p = await model.predict(history({ consumption }), noCosts, AS_OF);
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
    const p = await model.predict(history({ consumption }), noCosts, AS_OF);
    expect(p.method).toBe("regression");
    expect(p.dailyDemand).toBe(0);
    // No demand → no stockout horizon, no EOQ.
    expect(p.daysUntilReorder).toBeNull();
    expect(p.eoq).toBeNull();
  });

  it("computes reorder point, days-until-reorder and the EOQ formula", async () => {
    // 30 units on each of 3 days, first 8 days ago → 90 / 9 = 10/day.
    const h = history({
      consumption: [
        { date: daysAgo(8), quantity: 30 },
        { date: daysAgo(7), quantity: 30 },
        { date: daysAgo(6), quantity: 30 },
      ],
      currentStock: 130,
      minQuantity: 10,
      unitCost: 40,
    });
    const inputs: PredictionInputs = {
      leadTimeDays: 5,
      orderingCost: 100,
      holdingCostRate: 0.25,
    };
    const p = await model.predict(h, inputs, AS_OF);
    expect(p.method).toBe("average");
    expect(p.dailyDemand).toBeCloseTo(10, 10);
    // ceil(10 * 5 + 10)
    expect(p.reorderPoint).toBe(60);
    // floor((130 - 60) / 10)
    expect(p.daysUntilReorder).toBe(7);
    // ceil(sqrt(2 * 3650 * 100 / (0.25 * 40))) = ceil(270.18…)
    expect(p.eoq).toBe(271);
    // round(271 / 10)
    expect(p.orderIntervalDays).toBe(27);
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
    const p = await model.predict(h, { ...noCosts, leadTimeDays: 5 }, AS_OF);
    expect(p.daysUntilReorder).toBe(0);
  });

  it("leaves EOQ null without cost configuration or unit cost", async () => {
    const consumption = [
      { date: daysAgo(8), quantity: 30 },
      { date: daysAgo(7), quantity: 30 },
      { date: daysAgo(6), quantity: 30 },
    ];
    // No org cost settings.
    const p1 = await model.predict(history({ consumption, unitCost: 40 }), noCosts, AS_OF);
    expect(p1.eoq).toBeNull();
    expect(p1.reorderPoint).not.toBeNull(); // reorder point works regardless

    // Costs configured but the product has no purchase price on record.
    const p2 = await model.predict(
      history({ consumption, unitCost: null }),
      { leadTimeDays: 7, orderingCost: 100, holdingCostRate: 0.25 },
      AS_OF
    );
    expect(p2.eoq).toBeNull();
  });
});
