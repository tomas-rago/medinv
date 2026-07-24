// Pure math tests for the backtest series builder — no credentials needed.
//
//   npx vitest run tests/predictive
//
import { describe, it, expect } from "vitest";
import { buildBacktestSeries } from "@/lib/predictive/backtest";
import type { ProductPrediction } from "@/lib/predictive/base";

const WINDOW_START = "2026-06-09"; // + 29 days = 2026-07-08

function fitted(overrides: Partial<ProductPrediction>): ProductPrediction {
  return {
    productId: "p1",
    method: "average",
    dailyDemand: 2,
    trendPerDay: null,
    usableStock: 0,
    expiredStock: 0,
    projectedWaste: null,
    firstWasteDate: null,
    safetyStock: 0,
    reorderPoint: 0,
    daysUntilReorder: null,
    suggestedQuantity: null,
    ...overrides,
  };
}

describe("buildBacktestSeries", () => {
  it("aligns a 30-day window, zero-filling days without consumption", async () => {
    const days = buildBacktestSeries(
      [
        { date: "2026-06-09", quantity: 5 },
        { date: "2026-06-20", quantity: 3 },
        { date: "2026-07-08", quantity: 1 },
        { date: "2026-06-01", quantity: 99 }, // before the window — ignored
      ],
      fitted({}),
      WINDOW_START
    );
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({ date: "2026-06-09", actual: 5 });
    expect(days[11]).toMatchObject({ date: "2026-06-20", actual: 3 });
    expect(days[29]).toMatchObject({ date: "2026-07-08", actual: 1 });
    expect(days[1].actual).toBe(0);
    expect(days.reduce((a, d) => a + d.actual, 0)).toBe(9);
  });

  it("average fit projects a flat line", () => {
    const days = buildBacktestSeries([], fitted({ method: "average", dailyDemand: 2.5 }), WINDOW_START);
    expect(days.every((d) => d.projected === 2.5)).toBe(true);
  });

  it("regression fit extends the trend and clamps at zero", () => {
    const days = buildBacktestSeries(
      [],
      fitted({ method: "regression", dailyDemand: 10, trendPerDay: -1 }),
      WINDOW_START
    );
    expect(days[0].projected).toBe(10);
    expect(days[5].projected).toBe(5);
    expect(days[10].projected).toBe(0);
    expect(days[29].projected).toBe(0); // clamped, never negative
  });

  it("insufficient pre-window history yields null projections but real actuals", () => {
    const days = buildBacktestSeries(
      [{ date: "2026-06-15", quantity: 4 }],
      fitted({ method: "insufficient_data", dailyDemand: null, trendPerDay: null }),
      WINDOW_START
    );
    expect(days.every((d) => d.projected === null)).toBe(true);
    expect(days[6].actual).toBe(4);
  });
});
