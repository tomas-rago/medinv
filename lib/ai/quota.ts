import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Token accounting for AI features.
//
// Counting rule (applied everywhere): a turn's input_tokens is the sum over
// all API-loop iterations of usage.input_tokens + cache_creation_input_tokens
// + cache_read_input_tokens; output_tokens sums usage.output_tokens. Quota
// consumed = input + output, matching what monthly_token_consumption sums
// (view: sum(input_tokens + output_tokens) grouped by org/user/month).
// Cached reads are billed cheaper by Anthropic but count 1:1 here — the plan
// limit reads literally as "tokens processed per month".

export type TurnUsage = { inputTokens: number; outputTokens: number };

// UTC start of the current month, matching the view's
// date_trunc('month', created_at) buckets (DB runs in UTC).
export function monthStartISO(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01T00:00:00Z`;
}

export function sumMonthlyRows(rows: { total_tokens: number | null }[]): number {
  return rows.reduce((total, row) => total + (row.total_tokens ?? 0), 0);
}

// Org-wide consumption for the current month. Requires the service-role
// client: the view is security_invoker and token_usage RLS only shows a
// user their own rows (org-wide for chief_doctor), but the quota is org-wide
// regardless of who is asking.
export async function getOrgMonthlyConsumption(
  admin: SupabaseClient<Database>,
  organizationId: string,
  now: Date = new Date()
): Promise<number> {
  const { data, error } = await admin
    .from("monthly_token_consumption")
    .select("total_tokens")
    .eq("organization_id", organizationId)
    .gte("month", monthStartISO(now));
  if (error) throw error;
  return sumMonthlyRows(data ?? []);
}

// The org's monthly token allowance; 0/absent means no AI access (same
// condition hasAiAccess checks — callers that also need the number use this
// instead of two queries).
export async function getTokenLimit(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<number> {
  const { data } = await supabase
    .from("organizations")
    .select("plans(token_limit_per_month)")
    .eq("id", organizationId)
    .single();
  return data?.plans?.token_limit_per_month ?? 0;
}

export function isOverQuota(used: number, limit: number): boolean {
  return used >= limit;
}

// One row per assistant turn. token_usage deliberately has no INSERT policy;
// writes go through the service-role client only.
export async function recordTokenUsage(
  admin: SupabaseClient<Database>,
  params: { organizationId: string; userId: string } & TurnUsage
): Promise<void> {
  const { error } = await admin.from("token_usage").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
  });
  if (error) throw error;
}
