import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canManagePredictive } from "@/lib/constants/roles";
import { hasAiAccess } from "@/lib/ai/access";
import { getPredictions } from "@/lib/predictive/data";
import { syncReorderAlerts } from "@/lib/predictive/alerts";
import { PredictivePage } from "@/components/predictive/PredictivePage";
import { resolvePage, resolvePageSize } from "@/lib/pagination";

export default async function PredictiveServerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const canManage = canManagePredictive(user.app_metadata?.role as string);

  const orgId = user.app_metadata?.organization_id as string | undefined;
  const aiExplain = orgId ? await hasAiAccess(supabase, orgId) : false;

  // Predictions are computed + sorted most-urgent-first across the whole
  // catalog, so we compute the full list (also needed for alert sync) and
  // paginate by slicing — sorting stays across all rows, not per page.
  const { rows, settings } = await getPredictions(supabase);
  await syncReorderAlerts(supabase, rows);

  const page = resolvePage(sp.page);
  const pageSize = resolvePageSize(sp.size);
  const from = (page - 1) * pageSize;
  const pageRows = rows.slice(from, from + pageSize);

  return (
    <PredictivePage
      rows={pageRows}
      count={rows.length}
      page={page}
      pageSize={pageSize}
      settings={settings}
      canManage={canManage}
      aiExplain={aiExplain}
    />
  );
}
