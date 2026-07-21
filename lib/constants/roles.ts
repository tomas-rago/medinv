// Role capability helpers. These MUST stay in sync with the write RLS policies
// they mirror (see supabase/migrations). The role model:
//   - doctor        → inventory only (medicines + stock movements)
//   - nurse         → inventory + all operations (alerts/predictive/purchases/
//                     providers/receptors/reports/dashboard)
//   - administrative → same as nurse
//   - chief_doctor  → everything (superuser) + user management + subscription
//
// Every "operations" capability is granted to everyone EXCEPT doctor.

// Roles allowed to create products and register stock movements. Must stay in
// sync with the write RLS policies on products/stock/stock_movements.
export const INVENTORY_WRITER_ROLES = [
  "chief_doctor",
  "doctor",
  "nurse",
  "administrative",
] as const;

// Operational roles: everyone except doctor. Drives purchases, providers,
// receptors, alerts, predictive, reports and dashboard access. Must stay in
// sync with the corresponding write RLS policies.
export const OPERATIONS_ROLES = ["chief_doctor", "nurse", "administrative"] as const;

function inList<T extends readonly string[]>(list: T, role: string | null | undefined): boolean {
  return list.includes(role as T[number]);
}

export function canWriteInventory(role: string | null | undefined): boolean {
  return inList(INVENTORY_WRITER_ROLES, role);
}

// Providers/provider_products RLS.
export function canManageProviders(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}

// Alert configuration (org settings + per-product thresholds). RLS: alert_settings.
export function canManageAlerts(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}

// Predictive/ROP configuration (lead time, coverage, safety days). RLS: predictive_settings.
export function canManagePredictive(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}

// Receptors (egress destinations). Create + manage share the operational roles.
// Must stay in sync with the RLS policies on receptors.
export function canCreateReceptors(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}

export function canManageReceptors(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}

// Purchase orders. Must stay in sync with the RLS policies on purchases/purchase_items.
export function canManagePurchases(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}

// View-only gates (nav visibility + page redirects). Not RLS-backed — movement
// reads stay org-scoped for all roles; these hide UI that the matrix reserves
// for operational roles.
export function canViewAlerts(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}

export function canViewPredictive(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}

export function canViewReports(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}

export function canViewDashboard(role: string | null | undefined): boolean {
  return inList(OPERATIONS_ROLES, role);
}
