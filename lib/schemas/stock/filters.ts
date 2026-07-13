import { z } from "zod";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";
import { PRODUCT_CRITICALITIES } from "@/lib/constants/criticality";

// Movement report filters — the single source of truth for both the /stock
// page searchParams and the export server action. Every field is optional;
// invalid values are dropped on the page (field-wise safeParse) and rejected
// in the action (whole-object safeParse).

export const MOVEMENT_TYPES = ["entry", "exit", "adjustment", "expiry"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// Sortable columns. Embedded (product/receptor) sorts use PostgREST's
// to-one embedded-column order syntax; see buildMovementsQuery.
export const MOVEMENT_SORT_KEYS = [
  "date",
  "product",
  "category",
  "criticality",
  "type",
  "quantity",
  "expiry",
  "receptor",
] as const;
export type MovementSortKey = (typeof MOVEMENT_SORT_KEYS)[number];

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export const MovementFiltersSchema = z.object({
  product: z.string().uuid().optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  type: z.enum(MOVEMENT_TYPES).optional(),
  crit: z.enum(PRODUCT_CRITICALITIES).optional(),
  provider: z.string().uuid().optional(),
  receptor: z.string().uuid().optional(),
  from: dateString,
  to: dateString,
  sort: z.enum(MOVEMENT_SORT_KEYS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

export type MovementFilters = z.infer<typeof MovementFiltersSchema>;

// Parse raw searchParams leniently: each invalid field is dropped instead of
// failing the whole set (a bad hand-edited URL should not 500 the page).
export function parseMovementFilters(raw: Record<string, string | undefined>): MovementFilters {
  const filters: MovementFilters = {};
  for (const key of Object.keys(MovementFiltersSchema.shape) as (keyof MovementFilters)[]) {
    const single = MovementFiltersSchema.shape[key].safeParse(raw[key]);
    if (single.success && single.data !== undefined) {
      filters[key] = single.data as never;
    }
  }
  return filters;
}
