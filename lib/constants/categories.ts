// Fixed, code-defined product categories. These stable keys are stored in
// products.category; their human labels live in messages/*.json under `Categories`.
// There is no admin UI to manage categories for now — edit this list to change them.
export const PRODUCT_CATEGORIES = [
  "analgesics",
  "antibiotics",
  "antiinflammatories",
  "antiallergics",
  "cardiac",
  "gastrointestinal",
  "respiratory",
  "dermatological",
  "wound_care",
  "disposables",
  "other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
