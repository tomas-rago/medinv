import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "Requerido"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
