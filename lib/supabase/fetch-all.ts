// PostgREST caps every response at 1000 rows on this project (db-max-rows),
// and neither .limit() nor .range() lifts it — a query that matches more rows
// silently returns the first 1000 with no error and no signal. For an ordered
// read that means losing the tail: `getPredictions` orders movements ascending,
// so past 1000 entry/exit movements an organization would quietly lose its most
// RECENT consumption and the model would estimate demand from stale history.
//
// This pages through instead. Callers pass a builder so each page is a fresh
// query — PostgREST range headers cannot be re-applied to a built one.

export const PAGE_SIZE = 1000;

// Safety valve: at ~50 movements/day this is years of history, and it keeps a
// runaway query from pinning the 8s statement timeout on `authenticated`.
export const FETCH_ALL_MAX_ROWS = 50_000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  maxRows = FETCH_ALL_MAX_ROWS
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("[fetchAllRows] page error:", error.message);
      break;
    }
    if (!data?.length) break;
    rows.push(...data);
    // A short page means the server ran out of rows, not out of window.
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}
