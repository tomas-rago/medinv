import { z } from "zod";

// Expiry on ingress paths must be today or later — a past date means the batch
// is already expired and shouldn't enter stock. (Compared as YYYY-MM-DD strings
// against the current UTC day, matching the `min` set on the date inputs.)
export const notPastDate = (v: string) => v >= new Date().toISOString().slice(0, 10);

export const StockEntrySchema = z.object({
  product_id: z.string().uuid("product_required"),
  quantity: z.coerce.number().positive("quantity_positive"),
  expiry_date: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .refine((v) => v === undefined || notPastDate(v), "expiry_date_in_past"),
  notes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type StockEntryInput = z.infer<typeof StockEntrySchema>;

// Egress: FEFO chooses the batch(es), so no expiry input here.
export const StockExitSchema = z.object({
  product_id: z.string().uuid("product_required"),
  quantity: z.coerce.number().positive("quantity_positive"),
  // Optional destination (receptor) — empty string means "none".
  receptor_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || z.uuid().safeParse(v).success, "receptor_invalid")
    .optional(),
  notes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type StockExitInput = z.infer<typeof StockExitSchema>;

// Rectification: correct quantity and/or expiry, or null the movement out.
export const RectifySchema = z
  .object({
    movement_id: z.string().uuid("movement_required"),
    nullify: z.coerce.boolean().default(false),
    quantity: z.coerce.number().min(0, "quantity_non_negative").optional(),
    expiry_date: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
    reason: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
  })
  .refine((d) => d.nullify || d.quantity !== undefined, {
    message: "quantity_required",
    path: ["quantity"],
  });

export type RectifyInput = z.infer<typeof RectifySchema>;
