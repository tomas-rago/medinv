import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Onboarding } from "@/components/onboarding/Onboarding";

export default async function OnboardingPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profile?.organization_id) redirect("/dashboard");

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, monthly_price, user_limit, token_limit_per_month")
    .eq("active", true)
    .order("monthly_price");
  console.log(plans);

  return <Onboarding plans={plans ?? []} />;
}
