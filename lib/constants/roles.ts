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

// Purchase orders are managed by doctors and up. Must stay in sync with the
// RLS policies on purchases/purchase_items.
const PURCHASE_WRITER_ROLES = ["chief_doctor", "doctor"] as const;

export function canManagePurchases(role: string | null | undefined): boolean {
  return PURCHASE_WRITER_ROLES.includes(role as (typeof PURCHASE_WRITER_ROLES)[number]);
}
