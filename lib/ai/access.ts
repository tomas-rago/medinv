import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// AI features (chatbot, predictive suggestions, explain) are plan-gated:
// available when the org's plan includes a token allowance.
export async function hasAiAccess(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("organizations")
    .select("plans(token_limit_per_month)")
    .eq("id", organizationId)
    .single();

  return (data?.plans?.token_limit_per_month ?? 0) > 0;
}
