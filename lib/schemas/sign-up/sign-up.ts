import { z } from "zod";

export const SignUpSchema = z.object({
  firstName: z.string().min(1, "Requerido"),
  lastName: z.string().min(1, "Requerido"),
  email: z.email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
