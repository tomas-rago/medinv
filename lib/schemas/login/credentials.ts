import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email("email_invalid"),
  password: z.string().min(1, "required"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
