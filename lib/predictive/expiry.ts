// FEFO (first-expired, first-out) stock math. Pure — no Supabase — so the
// projection the predictive model runs can be unit-tested on its own.
//
// The DB egress RPC consumes lots earliest-expiry-first (migration
// 20260629000002), so projecting future stock has to walk the lots in that
// same order: the aggregate `stock.quantity` hides the fact that part of the
// on-hand total may expire before demand ever reaches it. Nothing writes
// expired lots off, so the aggregate also still counts stock that expired
// yesterday.

export type StockBatch = {
  expiryDate: string | null; // YYYY-MM-DD; null = no expiry tracked
  quantity: number;
};

const MS_PER_DAY = 86_400_000;

export function toUtcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return toUtcDateString(new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY));
}

// Earliest expiry first, undated lots last — the order the egress RPC uses.
export function compareBatchesFefo(a: StockBatch, b: StockBatch): number {
  if (a.expiryDate === b.expiryDate) return 0;
  if (a.expiryDate === null) return 1;
  if (b.expiryDate === null) return -1;
  return a.expiryDate < b.expiryDate ? -1 : 1;
}

export function sortBatchesFefo(batches: StockBatch[]): StockBatch[] {
  return [...batches].sort(compareBatchesFefo);
}

// A lot is usable through its expiry date itself; it is gone the day after.
function isUsableOn(batch: StockBatch, date: string): boolean {
  return batch.expiryDate === null || batch.expiryDate >= date;
}

export function usableStock(batches: StockBatch[], today: string): number {
  return batches.reduce((sum, b) => (isUsableOn(b, today) ? sum + b.quantity : sum), 0);
}

export function expiredStock(batches: StockBatch[], today: string): number {
  return batches.reduce((sum, b) => (isUsableOn(b, today) ? sum : sum + b.quantity), 0);
}

export type FefoProjection = {
  // levels[i] = usable stock at the START of day `today + i`, i.e. after that
  // day's expiries have been dropped but before its demand is consumed.
  // Length is horizonDays + 1, and levels[0] is today's usable stock — which
  // keeps it directly comparable to the reorder point.
  levels: number[];
  // Units that expire unconsumed within the horizon. Lots that had already
  // expired before `today` are not counted here — those are reported
  // separately as expiredStock, they are a write-off, not a forecast.
  waste: number;
  // Date of the first such loss, or null when nothing is wasted.
  firstWasteDate: string | null;
};

// Walks the horizon day by day: drop the lots that have expired as of that
// day, then consume `dailyDemand` FEFO from what is left. Assumes no
// replenishment arrives — that is the point, it answers "what happens if I
// do nothing".
export function simulateFefo(
  batches: StockBatch[],
  dailyDemand: number,
  today: string,
  horizonDays: number
): FefoProjection {
  // Local mutable copy so the caller's lots are untouched; already-expired
  // lots are dropped up front rather than charged to the forecast.
  const lots = sortBatchesFefo(
    batches.filter((b) => b.quantity > 0 && isUsableOn(b, today))
  ).map((b) => ({ ...b }));

  const levels: number[] = [];
  let waste = 0;
  let firstWasteDate: string | null = null;
  const horizon = Math.max(0, Math.floor(horizonDays));

  for (let day = 0; day <= horizon; day++) {
    const date = day === 0 ? today : addDays(today, day);

    // Expire first: stock that lapsed before `date` cannot serve its demand.
    for (const lot of lots) {
      if (lot.quantity > 0 && !isUsableOn(lot, date)) {
        waste += lot.quantity;
        if (firstWasteDate === null) firstWasteDate = lot.expiryDate;
        lot.quantity = 0;
      }
    }

    levels.push(lots.reduce((sum, l) => sum + l.quantity, 0));

    let remaining = dailyDemand;
    for (const lot of lots) {
      if (remaining <= 0) break;
      if (lot.quantity <= 0) continue;
      const taken = Math.min(lot.quantity, remaining);
      lot.quantity -= taken;
      remaining -= taken;
    }
  }

  return { levels, waste, firstWasteDate };
}
