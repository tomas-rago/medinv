import { z } from "zod";

export const InviteSchema = z.object({
  email: z.email("email_invalid"),
  role: z.enum(["operator", "read_only"]),
});

export type InviteInput = z.infer<typeof InviteSchema>;
