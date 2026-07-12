import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/ai/access";
import { syncReorderAlerts } from "@/lib/predictive/alerts";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { IconSprite } from "@/components/ui/Icons";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, full_name, role")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) redirect("/onboarding");

  const aiAccess = await hasAiAccess(supabase, profile.organization_id);

  // Refresh expiry + reorder alerts (in-app only, no scheduler), then count
  // unread for the sidebar badge. Cheap at this scale; pg_cron can take over
  // the sweeps if email notifications land.
  await supabase.rpc("sweep_alerts");
  await syncReorderAlerts(supabase);
  const { count: alertCount } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .is("acknowledged_at", null);

  return (
    <>
      <IconSprite />
      <DashboardShell
        alertCount={alertCount ?? 0}
        sidebar={
          <Sidebar
            profile={{ full_name: profile.full_name ?? "", role: profile.role ?? "administrative" }}
            hasAiAccess={aiAccess}
            alertCount={alertCount ?? 0}
          />
        }
      >
        {children}
      </DashboardShell>
    </>
  );
}
