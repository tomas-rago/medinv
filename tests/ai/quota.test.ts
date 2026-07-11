// Pure tests for quota math — no credentials needed.
//
//   npx vitest run tests/ai
//
import { describe, it, expect } from "vitest";
import { isOverQuota, monthStartISO, sumMonthlyRows } from "@/lib/ai/quota";

describe("monthStartISO", () => {
  it("returns the UTC start of the month", () => {
    expect(monthStartISO(new Date("2026-07-11T15:30:00Z"))).toBe("2026-07-01T00:00:00Z");
  });

  it("uses the UTC month, not the local one, at month boundaries", () => {
    // 2026-07-31 23:30 UTC is already August in UTC+3 local time — the
    // bucket must still be July because the view truncates in UTC.
    expect(monthStartISO(new Date("2026-07-31T23:30:00Z"))).toBe("2026-07-01T00:00:00Z");
    expect(monthStartISO(new Date("2026-08-01T00:00:00Z"))).toBe("2026-08-01T00:00:00Z");
  });

  it("zero-pads single-digit months", () => {
    expect(monthStartISO(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-01T00:00:00Z");
  });
});

describe("sumMonthlyRows", () => {
  it("sums per-user view rows, treating null as zero", () => {
    expect(
      sumMonthlyRows([
        { total_tokens: 1200 },
        { total_tokens: null },
        { total_tokens: 800 },
      ])
    ).toBe(2000);
  });

  it("returns 0 with no rows", () => {
    expect(sumMonthlyRows([])).toBe(0);
  });
});

describe("isOverQuota", () => {
  it("blocks at exactly the limit (>= semantics)", () => {
    expect(isOverQuota(9_999, 10_000)).toBe(false);
    expect(isOverQuota(10_000, 10_000)).toBe(true);
    expect(isOverQuota(10_001, 10_000)).toBe(true);
  });
});
