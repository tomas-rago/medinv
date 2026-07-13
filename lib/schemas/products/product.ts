import { z } from "zod";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";
import { PRODUCT_CRITICALITIES } from "@/lib/constants/criticality";

// Empty-string form fields become `undefined` so optional values stay clean.
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const ProductSchema = z.object({
  name: z.string().trim().min(2, "min_2"),
  ean: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || /^\d{6,14}$/.test(v), "ean_invalid")
    .optional(),
  category: z
    .enum(PRODUCT_CATEGORIES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  criticality: z
    .enum(PRODUCT_CRITICALITIES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  presentation: optionalText,
  unit: z.string().trim().min(1).default("unit"),
  description: optionalText,
});

export type ProductInput = z.infer<typeof ProductSchema>;
