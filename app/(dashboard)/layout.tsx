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
  if (profileError) console.log("[dashboard layout] profile error:", profileError.code, profileError.message);

  console.log("[dashboard layout] user:", user.id, "app_metadata:", JSON.stringify(user.app_metadata), "profile:", JSON.stringify(profile));
  if (!profile?.organization_id) redirect("/onboarding");

  return (
    <>
      <IconSprite />
      <div className="h-screen flex overflow-hidden">
        <Sidebar
          activeSection="panel"
          profile={{ full_name: profile.full_name, role: profile.role }}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
