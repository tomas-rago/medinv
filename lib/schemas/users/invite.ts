import { z } from "zod";

export const InviteSchema = z.object({
  email: z.email("email_invalid"),
  role: z.enum(["doctor", "nurse", "administrative"]),
});

export type InviteInput = z.infer<typeof InviteSchema>;
