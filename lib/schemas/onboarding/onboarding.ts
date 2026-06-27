import { z } from "zod";

export const OnboardingSchema = z.object({
  orgName: z.string().min(2, "min_2"),
  planId: z.string().min(1, "select_plan"),
  billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
});

export type OnboardingInput = z.infer<typeof OnboardingSchema>;
