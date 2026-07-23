// Abstract predictive-model interface. Calling code (page, future dashboard,
// future chatbot tools) depends only on these types and on the active model
// exported from lib/predictive/index.ts, so a future ML-based model can
// replace the formula-based one without touching consumers.

import type { StockBatch } from "./expiry";

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
  // On-hand lots, for expiry-aware projection. Empty = no batch tracking for
  // this product, in which case currentStock is treated as one lot that never
  // expires (pre-batch-tracking data).
  batches: StockBatch[];
  // Per-product safety floor (stock.min_quantity, same value alerts use).
  minQuantity: number;
  // Days of demand held as criticality safety buffer (resolved by the data
  // layer from products.criticality + org settings); 0 when unclassified.
  safetyStockDays: number;
}

// Resolved per product by the data layer (lead time may come from the org
// setting or from the product's average purchase delivery time).
export interface PredictionInputs {
  leadTimeDays: number;
  // Days of consumption each order should cover beyond the lead time.
  coverageDays: number;
}

export interface ProductPrediction {
  productId: string;
  method: PredictionMethod;
  // Units per day expected as of `asOf`; null when insufficient data.
  dailyDemand: number | null;
  // Regression slope (units/day per day); null for non-regression methods.
  trendPerDay: number | null;
  // currentStock minus lots that have already expired. Every projection below
  // is built on this, not on the raw aggregate.
  usableStock: number;
  // Units past their expiry date that are still counted in `stock.quantity`
  // because nothing writes them off; 0 without batch tracking.
  expiredStock: number;
  // Units expected to expire unconsumed within lead time + coverage days;
  // null when demand is unknown.
  projectedWaste: number | null;
  // Expiry date of the first such loss; null when nothing is projected lost.
  firstWasteDate: string | null;
  // max(minQuantity, dailyDemand x safetyStockDays); null when no estimate.
  safetyStock: number | null;
  // Stock level at which a new order should be placed.
  reorderPoint: number | null;
  // Days until stock reaches the reorder point; 0 = order now.
  daysUntilReorder: number | null;
  // Coverage-target order size: what tops stock back up to
  // demand x (lead time + coverage days) + safety stock, counting only the
  // stock that will still be usable when demand reaches it. Clamped at 0 when
  // stock already exceeds the target; null when demand is unknown or zero.
  suggestedQuantity: number | null;
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
