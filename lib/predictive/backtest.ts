import type { ConsumptionPoint, ProductPrediction } from "./base";

const MS_PER_DAY = 86_400_000;

export type BacktestDay = {
  date: string; // YYYY-MM-DD
  actual: number;
  // null when the pre-window history was insufficient to fit the model.
  projected: number | null;
};

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

// Aligns the actual daily consumption (zero-filled) against what a model
// fitted only on pre-window history projected for each window day:
// regression extends its trend from the window start, average is flat.
export function buildBacktestSeries(
  consumption: ConsumptionPoint[],
  fitted: ProductPrediction,
  windowStart: string,
  windowDays = 30
): BacktestDay[] {
  const actualByDate = new Map<string, number>();
  for (const p of consumption) {
    actualByDate.set(p.date, (actualByDate.get(p.date) ?? 0) + p.quantity);
  }

  const days: BacktestDay[] = [];
  for (let d = 0; d < windowDays; d++) {
    const date = addDays(windowStart, d);
    let projected: number | null = null;
    if (fitted.method === "average" && fitted.dailyDemand !== null) {
      projected = Math.max(0, fitted.dailyDemand);
    } else if (fitted.method === "regression" && fitted.dailyDemand !== null) {
      projected = Math.max(0, fitted.dailyDemand + (fitted.trendPerDay ?? 0) * d);
    }
    days.push({ date, actual: actualByDate.get(date) ?? 0, projected });
  }
  return days;
}
