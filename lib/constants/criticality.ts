// Fixed, code-defined VED criticality levels. These stable keys are stored
// in products.criticality; their human labels live in messages/*.json under
// `Criticality`. Each level maps to an org-configurable days-of-demand
// safety buffer in predictive_settings (safety_days_*).
export const PRODUCT_CRITICALITIES = ["vital", "essential", "desirable"] as const;

export type ProductCriticality = (typeof PRODUCT_CRITICALITIES)[number];
