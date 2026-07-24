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

// Length limits TRUNCATE instead of rejecting. A model that runs slightly long
// on one action must never cost the user the whole summary (that produced a
// 500 in practice); the caps are generous enough that realistic output passes
// through untouched, and pathological output gets cut rather than discarded.
const bounded = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s));

export const ChartPointSchema = z.object({
  label: bounded(80),
  // Clamp instead of rejecting: a stray negative shouldn't drop the chart.
  value: z.number().finite().transform((v) => Math.max(0, v)),
  tone: z.enum(CHART_TONES).optional(),
});

export const SummaryChartSchema = z.object({
  type: z.enum(CHART_TYPES),
  title: bounded(100),
  unit: z
    .string()
    .trim()
    .transform((s) => s.slice(0, 24))
    .optional(),
  // 1 is valid — an org with a single urgent product yields a one-bar chart.
  // Extra points are dropped rather than failing the chart.
  points: z
    .array(ChartPointSchema)
    .min(1)
    .transform((p) => p.slice(0, 8)),
});

export const DashboardSummaryContentSchema = z.object({
  headline: bounded(200),
  summary: bounded(2000),
  actions: z.array(bounded(400)).transform((a) => a.slice(0, 5)),
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
