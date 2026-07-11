import { z } from "zod";

// 0–365 days-of-demand safety buffer per criticality level.
const safetyDays = z.coerce
  .number()
  .int("safety_days_range")
  .min(0, "safety_days_range")
  .max(365, "safety_days_range");

export const PredictiveSettingsSchema = z.object({
  // Empty input = null = auto: per-product average delivery time from
  // received purchases (null short-circuits before the inner coercion).
  lead_time_days: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce
      .number()
      .int("lead_time_range")
      .min(1, "lead_time_range")
      .max(365, "lead_time_range")
      .nullable()
  ),
  coverage_days: z.coerce
    .number()
    .int("coverage_days_range")
    .min(1, "coverage_days_range")
    .max(365, "coverage_days_range"),
  safety_days_vital: safetyDays,
  safety_days_essential: safetyDays,
  safety_days_desirable: safetyDays,
});

export type PredictiveSettingsInput = z.infer<typeof PredictiveSettingsSchema>;
