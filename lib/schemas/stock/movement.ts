import { z } from "zod";

export const StockEntrySchema = z.object({
  product_id: z.string().uuid("product_required"),
  quantity: z.coerce.number().positive("quantity_positive"),
  expiry_date: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  notes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type StockEntryInput = z.infer<typeof StockEntrySchema>;
