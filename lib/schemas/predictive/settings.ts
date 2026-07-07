import { z } from "zod";

export const PredictiveSettingsSchema = z.object({
  ordering_cost: z.coerce
    .number()
    .positive("ordering_cost_positive"),
  holding_cost_rate: z.coerce
    .number()
    .gt(0, "holding_rate_range")
    .max(100, "holding_rate_range"),
  lead_time_days: z.coerce
    .number()
    .int("lead_time_range")
    .min(1, "lead_time_range")
    .max(365, "lead_time_range"),
});

export type PredictiveSettingsInput = z.infer<typeof PredictiveSettingsSchema>;
