import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SuscripcionPage } from "@/components/cuenta/SuscripcionPage";

export default async function SuscripcionRoute() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Admin-only page
  const role = user.app_metadata?.role;
  if (role !== "chief_doctor") redirect("/dashboard");

  const orgId = user.app_metadata?.organization_id as string | undefined;
  if (!orgId) redirect("/onboarding");

  const adminClient = createAdminClient();

  const [{ data: org }, { data: plans }] = await Promise.all([
    adminClient
      .from("organizations")
      .select("id, plan_id, mp_subscription_id, subscription_status, billing_cycle, current_period_end")
      .eq("id", orgId)
      .single(),
    adminClient
      .from("plans")
      .select("id, name, monthly_price, token_limit_per_month, mp_plan_id")
      .eq("active", true)
      .order("monthly_price", { ascending: true }),
  ]);

  if (!org || !plans) redirect("/dashboard");

  const currentPlan = plans.find((p) => p.id === org.plan_id);
  if (!currentPlan) redirect("/dashboard");

  return (
    <SuscripcionPage
      org={org}
      currentPlan={currentPlan}
      plans={plans}
    />
  );
}
