import { z } from "zod";

export const InviteSchema = z.object({
  email: z.email("Email inválido"),
  role: z.enum(["operator", "read_only"]),
});

export type InviteInput = z.infer<typeof InviteSchema>;
