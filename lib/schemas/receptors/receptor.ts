import { z } from "zod";
import { RECEPTOR_PATIENT_TYPES } from "@/lib/constants/receptor-types";

// Empty-string form fields become `undefined` so optional values stay clean.
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const ReceptorSchema = z.object({
  name: z.string().trim().min(2, "min_2"),
  external_id: optionalText,
  patient_type: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .refine(
      (v) =>
        v === undefined ||
        RECEPTOR_PATIENT_TYPES.includes(v as (typeof RECEPTOR_PATIENT_TYPES)[number]),
      "patient_type_invalid"
    )
    .optional(),
  phone: optionalText,
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || z.email().safeParse(v).success, "email_invalid")
    .optional(),
  notes: optionalText,
});

export type ReceptorInput = z.infer<typeof ReceptorSchema>;

export const UpdateReceptorSchema = ReceptorSchema.extend({
  id: z.string().uuid("receptor_required"),
});

export type UpdateReceptorInput = z.infer<typeof UpdateReceptorSchema>;
