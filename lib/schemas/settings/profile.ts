import { z } from "zod";

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1, "Ingresá tu nombre"),
  lastName: z.string().min(1, "Ingresá tu apellido"),
});
