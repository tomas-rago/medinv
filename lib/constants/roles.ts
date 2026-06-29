// Roles allowed to create products and register stock movements. Must stay in
// sync with the write RLS policies on products/stock/stock_movements.
export const INVENTORY_WRITER_ROLES = ["chief_doctor", "doctor", "nurse"] as const;

export function canWriteInventory(role: string | null | undefined): boolean {
  return INVENTORY_WRITER_ROLES.includes(role as (typeof INVENTORY_WRITER_ROLES)[number]);
}
