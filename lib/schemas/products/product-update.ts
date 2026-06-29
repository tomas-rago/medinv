import { z } from "zod";
import { ProductSchema } from "./product";

// Same rules as ProductSchema but the name is intentionally omitted — names are
// locked after creation for historical accuracy. `id` identifies the row to update.
export const UpdateProductSchema = ProductSchema.omit({ name: true }).extend({
  id: z.string().uuid(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
