import { z } from "zod";

export const CompleteProfileSchema = z.object({
  firstName: z.string().min(1, "Ingresá tu nombre"),
  lastName: z.string().min(1, "Ingresá tu apellido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
