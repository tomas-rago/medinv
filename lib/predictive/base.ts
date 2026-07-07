// Abstract predictive-model interface. Calling code (page, future dashboard,
// future chatbot tools) depends only on these types and on the active model
// exported from lib/predictive/index.ts, so a future ML-based model can
// replace the formula-based one without touching consumers.

export type PredictionMethod = "regression" | "average" | "insufficient_data";

// Net units consumed on a calendar day (rectification pairs already netted).
export interface ConsumptionPoint {
  date: string; // YYYY-MM-DD
  quantity: number;
}

export interface ProductHistory {
  productId: string;
  // Ascending by date; days without consumption may be omitted.
  consumption: ConsumptionPoint[];
  currentStock: number;
  // Per-product safety floor (stock.min_quantity, same value alerts use).
  minQuantity: number;
  // Average purchase price, null when the product was never bought.
  unitCost: number | null;
}

export interface PredictionInputs {
  leadTimeDays: number;
  // Both null while the org has not configured predictive_settings;
  // EOQ-derived outputs are null in that case.
  orderingCost: number | null;
  // Annual holding cost as a fraction of unit cost (0.25 = 25 %/year).
  holdingCostRate: number | null;
}

export interface ProductPrediction {
  productId: string;
  method: PredictionMethod;
  // Units per day expected as of `asOf`; null when insufficient data.
  dailyDemand: number | null;
  // Regression slope (units/day per day); null for non-regression methods.
  trendPerDay: number | null;
  // Stock level at which a new order should be placed.
  reorderPoint: number | null;
  // Days until stock reaches the reorder point; 0 = order now.
  daysUntilReorder: number | null;
  // Economic order quantity and the reorder cycle it implies.
  eoq: number | null;
  orderIntervalDays: number | null;
}

export interface PredictiveModel {
  readonly id: string;
  // Async so a remote/ML implementation can slot in without API changes.
  predict(
    history: ProductHistory,
    inputs: PredictionInputs,
    asOf: Date
  ): Promise<ProductPrediction>;
}
