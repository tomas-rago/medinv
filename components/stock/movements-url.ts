import type { MovementFilters } from "@/lib/schemas/stock/filters";

// Build a /stock URL from the movement filters. Filter/sort URLs always pin
// tab=movements so reloads and shared links land on the right tab.
export function movementsUrl(filters: MovementFilters, page?: number): string {
  const params = new URLSearchParams();
  params.set("tab", "movements");
  for (const key of [
    "product",
    "category",
    "type",
    "crit",
    "provider",
    "receptor",
    "from",
    "to",
    "sort",
    "dir",
  ] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (page && page > 1) params.set("page", String(page));
  return `/stock?${params.toString()}`;
}

export function hasActiveFilters(filters: MovementFilters): boolean {
  return Boolean(
    filters.product ||
      filters.category ||
      filters.type ||
      filters.crit ||
      filters.provider ||
      filters.receptor ||
      filters.from ||
      filters.to
  );
}
