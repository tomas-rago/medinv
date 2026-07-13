import { z } from "zod";

// Empty-string form fields become `undefined` so optional values stay clean.
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const ProviderSchema = z.object({
  name: z.string().trim().min(2, "min_2"),
  contact_name: optionalText,
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || z.email().safeParse(v).success, "email_invalid")
    .optional(),
  phone: optionalText,
  address: optionalText,
  notes: optionalText,
});

export type ProviderInput = z.infer<typeof ProviderSchema>;

export const UpdateProviderSchema = ProviderSchema.extend({
  id: z.string().uuid("provider_required"),
});

export type UpdateProviderInput = z.infer<typeof UpdateProviderSchema>;
