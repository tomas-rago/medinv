import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canManagePredictive } from "@/lib/constants/roles";
import { getPredictions } from "@/lib/predictive/data";
import { PredictivePage } from "@/components/predictive/PredictivePage";

export default async function PredictiveServerPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const canManage = canManagePredictive(user.app_metadata?.role as string);
  const { rows, settings } = await getPredictions(supabase);

  return <PredictivePage rows={rows} settings={settings} canManage={canManage} />;
}
