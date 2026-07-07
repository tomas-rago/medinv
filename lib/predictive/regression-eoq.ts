import type {
  PredictionInputs,
  PredictionMethod,
  PredictiveModel,
  ProductHistory,
  ProductPrediction,
} from "./base";

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

export class RegressionEoqModel implements PredictiveModel {
  readonly id = "regression-eoq";

  async predict(
    history: ProductHistory,
    inputs: PredictionInputs,
    asOf: Date
  ): Promise<ProductPrediction> {
    const empty: ProductPrediction = {
      productId: history.productId,
      method: "insufficient_data",
      dailyDemand: null,
      trendPerDay: null,
      reorderPoint: null,
      daysUntilReorder: null,
      eoq: null,
      orderIntervalDays: null,
    };

    const points = history.consumption.filter((p) => p.quantity > 0);
    if (points.length < MIN_CONSUMPTION_DAYS) return empty;

    const today = toUtcDateString(asOf);
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

    const reorderPoint = Math.ceil(dailyDemand * inputs.leadTimeDays + history.minQuantity);

    let daysUntilReorder: number | null = null;
    if (dailyDemand > 0) {
      daysUntilReorder = Math.max(
        0,
        Math.floor((history.currentStock - reorderPoint) / dailyDemand)
      );
    }

    let eoq: number | null = null;
    let orderIntervalDays: number | null = null;
    if (
      dailyDemand > 0 &&
      inputs.orderingCost !== null &&
      inputs.orderingCost > 0 &&
      inputs.holdingCostRate !== null &&
      inputs.holdingCostRate > 0 &&
      history.unitCost !== null &&
      history.unitCost > 0
    ) {
      const annualDemand = dailyDemand * 365;
      const holdingCostPerUnit = inputs.holdingCostRate * history.unitCost;
      eoq = Math.ceil(Math.sqrt((2 * annualDemand * inputs.orderingCost) / holdingCostPerUnit));
      orderIntervalDays = Math.max(1, Math.round(eoq / dailyDemand));
    }

    return {
      productId: history.productId,
      method,
      dailyDemand,
      trendPerDay,
      reorderPoint,
      daysUntilReorder,
      eoq,
      orderIntervalDays,
    };
  }
}
