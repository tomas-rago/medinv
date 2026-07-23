import type {
  PredictionInputs,
  PredictionMethod,
  PredictiveModel,
  ProductHistory,
  ProductPrediction,
} from "./base";
import { expiredStock, simulateFefo, usableStock, type StockBatch } from "./expiry";

// Distinct consumption days needed before any estimate is produced.
const MIN_CONSUMPTION_DAYS = 3;
// Regression needs enough points and enough elapsed time to be meaningful;
// below these, a simple average is the honest estimate (the common path
// while movement history is small).
const REGRESSION_MIN_DAYS = 5;
const REGRESSION_MIN_SPAN_DAYS = 14;

const MS_PER_DAY = 86_400_000;

function dayIndex(date: string, origin: string): number {
  return Math.round((Date.parse(date) - Date.parse(origin)) / MS_PER_DAY);
}

function toUtcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Least squares over the zero-filled daily series. Zero days must be
// included: regressing only over active days ignores the idle stretches
// and overestimates demand.
function linearRegression(series: number[]): { slope: number; intercept: number } {
  const n = series.length;
  const meanX = (n - 1) / 2;
  const meanY = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let x = 0; x < n; x++) {
    num += (x - meanX) * (series[x] - meanY);
    den += (x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

// Reorder-point model: regression (or average) demand estimate, ROP =
// demand x lead time + safety floor, and a coverage-days suggested order
// quantity. No cost inputs — holding cost is effectively zero for small
// health institutions, so EOQ was dropped in favor of this.
//
// Stock is projected through batch expiry (FEFO, matching the egress RPC):
// the aggregate total overstates what will actually be available, both
// because expired lots are never written off and because some lots lapse
// before demand reaches them.
export class RegressionRopModel implements PredictiveModel {
  readonly id = "regression-rop";

  async predict(
    history: ProductHistory,
    inputs: PredictionInputs,
    asOf: Date
  ): Promise<ProductPrediction> {
    const today = toUtcDateString(asOf);

    // A product with no batch rows predates batch tracking: treat its
    // aggregate stock as a single lot that never expires, which reduces every
    // formula below to the pre-expiry behaviour.
    const lots: StockBatch[] = history.batches.length
      ? history.batches
      : [{ expiryDate: null, quantity: history.currentStock }];
    const usable = usableStock(lots, today);
    const expired = expiredStock(lots, today);

    const empty: ProductPrediction = {
      productId: history.productId,
      method: "insufficient_data",
      dailyDemand: null,
      trendPerDay: null,
      usableStock: usable,
      expiredStock: expired,
      projectedWaste: null,
      firstWasteDate: null,
      safetyStock: null,
      reorderPoint: null,
      daysUntilReorder: null,
      suggestedQuantity: null,
    };

    const points = history.consumption.filter((p) => p.quantity > 0);
    if (points.length < MIN_CONSUMPTION_DAYS) return empty;

    const origin = points[0].date;
    // Days elapsed from the first consumption through today, inclusive.
    const span = Math.max(1, dayIndex(today, origin) + 1);

    let method: PredictionMethod;
    let dailyDemand: number;
    let trendPerDay: number | null = null;

    if (points.length >= REGRESSION_MIN_DAYS && span >= REGRESSION_MIN_SPAN_DAYS) {
      method = "regression";
      const series = new Array<number>(span).fill(0);
      for (const p of points) {
        const i = dayIndex(p.date, origin);
        if (i >= 0 && i < span) series[i] += p.quantity;
      }
      const { slope, intercept } = linearRegression(series);
      dailyDemand = Math.max(0, intercept + slope * (span - 1));
      trendPerDay = slope;
    } else {
      method = "average";
      const total = points.reduce((a, p) => a + p.quantity, 0);
      dailyDemand = total / span;
    }

    // Criticality buffer scales with demand; a manually raised per-product
    // min_quantity still wins when it is the larger of the two.
    const safetyStock = Math.max(history.minQuantity, dailyDemand * history.safetyStockDays);
    const reorderPoint = Math.ceil(dailyDemand * inputs.leadTimeDays + safetyStock);

    let daysUntilReorder: number | null = null;
    let suggestedQuantity: number | null = null;
    let projectedWaste: number | null = null;
    let firstWasteDate: string | null = null;
    if (dailyDemand > 0) {
      // Order on the first day whose stock projected a lead time later would
      // fall to the safety buffer: order then and the resupply lands just as
      // stock reaches safety. Under smooth depletion this is exactly "usable
      // <= reorderPoint today" (since ROP = demand x lead + safety); an expiry
      // cliff inside the lead-time window makes it fire earlier, before the
      // cliff can strand stock below safety with an order still in transit.
      const lead = Math.max(0, Math.round(inputs.leadTimeDays));
      const daysToSafety = Math.max(0, Math.floor((usable - safetyStock) / dailyDemand));
      const { levels } = simulateFefo(lots, dailyDemand, today, daysToSafety + lead);
      daysUntilReorder = daysToSafety;
      for (let k = 0; k <= daysToSafety; k++) {
        if (levels[k + lead] <= safetyStock) {
          daysUntilReorder = k;
          break;
        }
      }

      // Order size covers the whole lead time + coverage window, and stock
      // that will lapse before demand reaches it does not count toward it.
      const orderHorizon = inputs.leadTimeDays + inputs.coverageDays;
      const projection = simulateFefo(lots, dailyDemand, today, orderHorizon);
      projectedWaste = projection.waste;
      firstWasteDate = projection.firstWasteDate;

      const target = dailyDemand * orderHorizon + safetyStock;
      suggestedQuantity = Math.max(0, Math.ceil(target - (usable - projection.waste)));
    }

    return {
      productId: history.productId,
      method,
      dailyDemand,
      trendPerDay,
      usableStock: usable,
      expiredStock: expired,
      projectedWaste,
      firstWasteDate,
      safetyStock,
      reorderPoint,
      daysUntilReorder,
      suggestedQuantity,
    };
  }
}
