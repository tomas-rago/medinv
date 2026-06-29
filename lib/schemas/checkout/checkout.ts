import { z } from "zod";

export const CheckoutSchema = z.object({
  token: z.string().min(1, "card_token_required"),
  paymentMethodId: z.string().min(1, "payment_method_required"),
  issuerId: z.string().optional(),
  billingCycle: z.enum(["monthly", "annual"]),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;
