import { z } from "zod";

export const OnboardingSchema = z.object({
  orgName: z.string().min(2, "Mínimo 2 caracteres"),
  planId: z.string().min(1, "Seleccioná un plan"),
});

export type OnboardingInput = z.infer<typeof OnboardingSchema>;
