import { z } from "zod";

export const CheckoutSchema = z.object({
  token: z.string().min(1, "Card token is required"),
  paymentMethodId: z.string().min(1, "Payment method is required"),
  issuerId: z.string().optional(),
  billingCycle: z.enum(["monthly", "annual"]),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;
