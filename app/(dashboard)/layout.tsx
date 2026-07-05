import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/ai/access";
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

  const aiAccess = await hasAiAccess(supabase, profile.organization_id);

  return (
    <>
      <IconSprite />
      <div className="h-screen flex overflow-hidden">
        <Sidebar
          activeSection="panel"
          profile={{ full_name: profile.full_name ?? "", role: profile.role ?? "administrative" }}
          hasAiAccess={aiAccess}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
