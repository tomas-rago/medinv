import { z } from "zod";

export const AlertSettingsSchema = z.object({
  low_stock_enabled: z.boolean(),
  expiry_enabled: z.boolean(),
  reorder_enabled: z.boolean(),
  expiry_days_ahead: z.coerce
    .number()
    .int("expiry_days_range")
    .min(1, "expiry_days_range")
    .max(365, "expiry_days_range"),
});

export type AlertSettingsInput = z.infer<typeof AlertSettingsSchema>;

export const MinQuantitySchema = z.object({
  product_id: z.string().uuid("product_required"),
  min_quantity: z.coerce.number().min(0, "quantity_non_negative"),
});

export type MinQuantityInput = z.infer<typeof MinQuantitySchema>;
