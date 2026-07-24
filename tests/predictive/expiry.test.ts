// Pure math tests for the FEFO stock projection — no credentials needed.
//
//   npx vitest run tests/predictive
//
import { describe, it, expect } from "vitest";
import {
  expiredStock,
  simulateFefo,
  sortBatchesFefo,
  usableStock,
  type StockBatch,
} from "@/lib/predictive/expiry";

const TODAY = "2026-07-06";

describe("sortBatchesFefo", () => {
  it("orders earliest expiry first and undated lots last", () => {
    const sorted = sortBatchesFefo([
      { expiryDate: null, quantity: 1 },
      { expiryDate: "2026-09-01", quantity: 2 },
      { expiryDate: "2026-07-20", quantity: 3 },
    ]);
    expect(sorted.map((b) => b.expiryDate)).toEqual(["2026-07-20", "2026-09-01", null]);
  });

  it("leaves the caller's array untouched", () => {
    const input: StockBatch[] = [
      { expiryDate: "2026-09-01", quantity: 2 },
      { expiryDate: "2026-07-20", quantity: 3 },
    ];
    sortBatchesFefo(input);
    expect(input[0].expiryDate).toBe("2026-09-01");
  });
});

describe("usableStock / expiredStock", () => {
  const lots: StockBatch[] = [
    { expiryDate: "2026-07-05", quantity: 10 }, // lapsed yesterday
    { expiryDate: "2026-07-06", quantity: 20 }, // usable through today
    { expiryDate: null, quantity: 5 },
  ];

  it("counts a lot as usable through its expiry date itself", () => {
    expect(usableStock(lots, TODAY)).toBe(25);
    expect(expiredStock(lots, TODAY)).toBe(10);
  });

  it("splits the whole on-hand total between the two", () => {
    expect(usableStock(lots, TODAY) + expiredStock(lots, TODAY)).toBe(35);
  });
});

describe("simulateFefo", () => {
  it("reports today's usable stock as the first level", () => {
    const { levels } = simulateFefo([{ expiryDate: null, quantity: 100 }], 10, TODAY, 3);
    expect(levels).toEqual([100, 90, 80, 70]);
  });

  it("drains the earliest-expiring lot first", () => {
    const { levels, waste } = simulateFefo(
      [
        { expiryDate: null, quantity: 50 },
        { expiryDate: "2026-07-10", quantity: 20 },
      ],
      10,
      TODAY,
      4
    );
    // The dated lot covers days 0-1, so it is gone well before it lapses.
    expect(waste).toBe(0);
    expect(levels).toEqual([70, 60, 50, 40, 30]);
  });

  it("writes off a lot that lapses before demand reaches it", () => {
    const { levels, waste, firstWasteDate } = simulateFefo(
      [{ expiryDate: "2026-07-07", quantity: 100 }],
      10,
      TODAY,
      3
    );
    // Days 0-1 consume 20; the remaining 80 lapse on 2026-07-08.
    expect(levels).toEqual([100, 90, 0, 0]);
    expect(waste).toBe(80);
    expect(firstWasteDate).toBe("2026-07-07");
  });

  it("does not charge already-expired lots to the forecast", () => {
    // Those are a write-off, reported separately as expiredStock.
    const { levels, waste } = simulateFefo(
      [
        { expiryDate: "2026-07-01", quantity: 40 },
        { expiryDate: null, quantity: 60 },
      ],
      10,
      TODAY,
      2
    );
    expect(waste).toBe(0);
    expect(levels).toEqual([60, 50, 40]);
  });

  it("everything lapses unused when there is no demand", () => {
    const { levels, waste } = simulateFefo(
      [{ expiryDate: "2026-07-07", quantity: 30 }],
      0,
      TODAY,
      2
    );
    expect(levels).toEqual([30, 30, 0]);
    expect(waste).toBe(30);
  });

  it("floors at zero rather than going negative when demand outruns stock", () => {
    const { levels } = simulateFefo([{ expiryDate: null, quantity: 15 }], 10, TODAY, 3);
    expect(levels).toEqual([15, 5, 0, 0]);
  });

  it("returns a single level for a zero-day horizon and handles no lots at all", () => {
    expect(simulateFefo([], 10, TODAY, 0)).toEqual({
      levels: [0],
      waste: 0,
      firstWasteDate: null,
    });
  });
});
