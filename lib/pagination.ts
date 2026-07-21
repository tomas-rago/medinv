// Shared pagination sizing for server pages. The size selector exposes these
// fixed choices; anything else (or absent) falls back to the default.
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

// Resolve a page size from the ?size= search param, clamped to the allowed set.
export function resolvePageSize(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

// Parse a 1-based page number from the ?page= search param.
export function resolvePage(raw: string | undefined): number {
  return Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
}
