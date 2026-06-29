import { z } from "zod";

export const SignUpSchema = z.object({
  firstName: z.string().min(1, "required"),
  lastName: z.string().min(1, "required"),
  email: z.email("email_invalid"),
  password: z.string().min(8, "min_8"),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
