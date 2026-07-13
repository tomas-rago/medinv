import { z } from "zod";

// Request body for POST /api/ai/explain. The client only names the screen it
// is on (plus the product for the detail screen) — the server rebuilds the
// screen's data itself through the RLS-scoped client, so nothing the browser
// sends can inject data into the analysis.
export const EXPLAIN_SCREENS = [
  "stock",
  "alerts",
  "predictive",
  "predictive_detail",
] as const;

export type ExplainScreen = (typeof EXPLAIN_SCREENS)[number];

export const ExplainRequestSchema = z
  .object({
    screen: z.enum(EXPLAIN_SCREENS),
    productId: z.uuid().optional(),
  })
  // Zod v4 runs refinements even when earlier checks failed, so read fields
  // defensively instead of assuming the object parsed.
  .refine((body) => body?.screen !== "predictive_detail" || !!body?.productId, {
    message: "product_required",
  });

export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;
