import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { generateDashboardSummary } from "@/lib/ai/dashboard-summary";
import {
  getOrgMonthlyConsumption,
  getTokenLimit,
  isOverQuota,
  recordTokenUsage,
} from "@/lib/ai/quota";

export const dynamic = "force-dynamic";

// Chief-doctor-only management summary. Same auth/gate/quota/metering skeleton
// as /api/ai/explain, but a single non-streaming forced-tool call returns a
// structured blob that we persist (one cached row per org) and return as JSON.
const jsonError = (key: string, status: number) =>
  Response.json({ ok: false, error: key }, { status });

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("not_authenticated", 401);

  // The summary is a chief-doctor feature; RLS also enforces this on the table.
  const role = user.app_metadata?.role as string | undefined;
  if (role !== "chief_doctor") return jsonError("no_ai_access", 403);

  const orgId = user.app_metadata?.organization_id as string | undefined;
  if (!orgId) return jsonError("no_ai_access", 403);

  // limit > 0 is exactly the hasAiAccess condition; the number also serves the
  // quota check, so one query covers both.
  const limit = await getTokenLimit(supabase, orgId);
  if (limit <= 0) return jsonError("no_ai_access", 403);

  if (!process.env.ANTHROPIC_API_KEY) return jsonError("ai_unavailable", 500);

  const admin = createAdminClient();
  const used = await getOrgMonthlyConsumption(admin, orgId);
  if (isOverQuota(used, limit)) return jsonError("ai_quota_exceeded", 429);

  const today = new Date().toISOString().slice(0, 10);
  // Mutated in place, so partial consumption is metered even on abort/throw.
  const usage = { inputTokens: 0, outputTokens: 0 };
  let content = null;
  try {
    const result = await generateDashboardSummary(
      supabase,
      today,
      usage,
      req.signal
    );
    content = result.content;
  } catch (err) {
    console.error("[ai/dashboard-summary] generation failed:", err);
  } finally {
    if (usage.inputTokens + usage.outputTokens > 0) {
      await recordTokenUsage(admin, {
        organizationId: orgId,
        userId: user.id,
        ...usage,
      }).catch((err) =>
        console.error("[ai/dashboard-summary] metering failed:", err)
      );
    }
  }

  if (!content) return jsonError("ai_summary_failed", 500);

  const generatedAt = new Date().toISOString();
  // Upsert on the RLS-scoped client (chief-doctor policy allows it); one cached
  // row per org. A write failure shouldn't lose the summary the user is waiting
  // on — log it and still return the content so the tile renders.
  const { error: upsertError } = await supabase
    .from("ai_dashboard_summaries")
    .upsert({
      organization_id: orgId,
      content: content as unknown as Json,
      generated_at: generatedAt,
      generated_by: user.id,
    });
  if (upsertError) {
    console.error("[ai/dashboard-summary] persist failed:", upsertError);
  }

  return Response.json(
    { ok: true, content, generatedAt },
    { headers: { "Cache-Control": "no-store" } }
  );
}
