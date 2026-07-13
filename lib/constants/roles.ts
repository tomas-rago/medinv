// Roles allowed to create products and register stock movements. Must stay in
// sync with the write RLS policies on products/stock/stock_movements.
export const INVENTORY_WRITER_ROLES = ["chief_doctor", "doctor", "nurse"] as const;

export function canWriteInventory(role: string | null | undefined): boolean {
  return INVENTORY_WRITER_ROLES.includes(role as (typeof INVENTORY_WRITER_ROLES)[number]);
}

// Providers are managed by the org-owner role only. Must stay in sync with
// the RLS policies on providers/provider_products.
export function canManageProviders(role: string | null | undefined): boolean {
  return role === "chief_doctor";
}

// Alert configuration (org settings + per-product thresholds) is the
// org-owner's call. Must stay in sync with the RLS policy on alert_settings.
export function canManageAlerts(role: string | null | undefined): boolean {
  return role === "chief_doctor";
}

// Predictive/ROP configuration (lead time, coverage, safety days) is the
// org-owner's call. Must stay in sync with the RLS policy on
// predictive_settings.
export function canManagePredictive(role: string | null | undefined): boolean {
  return role === "chief_doctor";
}

// Receptors (egress destinations): any inventory writer can create one inline
// from the stock exit modal; editing/deactivating is the org-owner's call.
// Must stay in sync with the RLS policies on receptors.
export function canCreateReceptors(role: string | null | undefined): boolean {
  return canWriteInventory(role);
}

export function canManageReceptors(role: string | null | undefined): boolean {
  return role === "chief_doctor";
}

// Purchase orders are managed by doctors and up. Must stay in sync with the
// RLS policies on purchases/purchase_items.
const PURCHASE_WRITER_ROLES = ["chief_doctor", "doctor"] as const;

export function canManagePurchases(role: string | null | undefined): boolean {
  return PURCHASE_WRITER_ROLES.includes(role as (typeof PURCHASE_WRITER_ROLES)[number]);
}
