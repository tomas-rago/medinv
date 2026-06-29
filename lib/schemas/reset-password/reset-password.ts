import { z } from "zod";

export const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, "password_min"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "passwords_no_match",
    path: ["confirmPassword"],
  });
