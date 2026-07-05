import { z } from "zod";

// Line items travel as a JSON string in a hidden form field (the create and
// receive modals build them dynamically), so both schemas parse from string.

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const CreateItemSchema = z.object({
  product_id: z.string().uuid("product_required"),
  quantity: z.coerce.number().positive("quantity_positive"),
  unit_price: z.coerce.number().min(0, "price_non_negative").optional(),
});

export const CreatePurchaseSchema = z.object({
  provider_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || z.string().uuid().safeParse(v).success, "provider_required")
    .optional(),
  notes: optionalText,
  items: z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "items_required" });
        return z.NEVER;
      }
    })
    .pipe(z.array(CreateItemSchema).min(1, "items_required"))
    .refine(
      (items) => new Set(items.map((i) => i.product_id)).size === items.length,
      "items_duplicate_product"
    ),
});

export type CreatePurchaseInput = z.infer<typeof CreatePurchaseSchema>;

const ReceiveItemSchema = z.object({
  id: z.string().uuid(),
  accepted_quantity: z.coerce.number().min(0, "quantity_non_negative"),
  expiry_date: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export const ReceivePurchaseSchema = z.object({
  purchase_id: z.string().uuid(),
  items: z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "items_required" });
        return z.NEVER;
      }
    })
    .pipe(z.array(ReceiveItemSchema).min(1, "items_required")),
});

export type ReceivePurchaseInput = z.infer<typeof ReceivePurchaseSchema>;
