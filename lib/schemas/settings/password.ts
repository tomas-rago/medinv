import { z } from "zod";

export const UpdatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "required"),
    newPassword: z.string().min(8, "password_min"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "passwords_no_match",
    path: ["confirmPassword"],
  });
