import { z } from "zod";

// Structured output for the chief-doctor dashboard summary. The model is
// forced to emit exactly this shape via a single tool (see
// lib/ai/dashboard-summary.ts), so this schema is both the tool's input_schema
// source of truth and the validator for what we persist and render. Keeping it
// tight (bounded lengths, small enums) means a misbehaving model produces a
// validation error we can surface, never arbitrary markup on the dashboard.

export const CHART_TYPES = ["bar", "hbar"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const CHART_TONES = ["danger", "warn", "normal"] as const;
export type ChartTone = (typeof CHART_TONES)[number];

export const ChartPointSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.number().finite().nonnegative(),
  tone: z.enum(CHART_TONES).optional(),
});

export const SummaryChartSchema = z.object({
  type: z.enum(CHART_TYPES),
  title: z.string().trim().min(1).max(80),
  unit: z.string().trim().max(20).optional(),
  // 1 is valid — an org with a single urgent product yields a one-bar chart.
  points: z.array(ChartPointSchema).min(1).max(8),
});

export const DashboardSummaryContentSchema = z.object({
  headline: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1200),
  actions: z.array(z.string().trim().min(1).max(200)).max(5),
  // null when a chart adds nothing — the model decides.
  chart: SummaryChartSchema.nullable(),
});

export type SummaryChart = z.infer<typeof SummaryChartSchema>;
export type DashboardSummaryContent = z.infer<typeof DashboardSummaryContentSchema>;

// What the client receives / renders: the validated blob plus when it was made.
export type DashboardSummary = {
  content: DashboardSummaryContent;
  generatedAt: string;
};
