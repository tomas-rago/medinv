import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
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

  // Fetch org plan to determine AI feature access
  let hasAiAccess = false;
  const { data: org } = await supabase
    .from("organizations")
    .select("plan_id")
    .eq("id", profile.organization_id)
    .single();

  if (org?.plan_id) {
    const { data: plan } = await supabase
      .from("plans")
      .select("token_limit_per_month")
      .eq("id", org.plan_id)
      .single();
    hasAiAccess = (plan?.token_limit_per_month ?? 0) > 0;
  }

  return (
    <>
      <IconSprite />
      <div className="h-screen flex overflow-hidden">
        <Sidebar
          activeSection="panel"
          profile={{ full_name: profile.full_name ?? "", role: profile.role ?? "read_only" }}
          hasAiAccess={hasAiAccess}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
