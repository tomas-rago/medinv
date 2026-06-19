import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  // Invited user: org is set in profile but not yet in app_metadata JWT — sync it
  if (profile?.organization_id && !user.app_metadata?.organization_id) {
    const adminClient = createAdminClient();
    await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: {
        role: profile.role,
        organization_id: profile.organization_id,
      },
    });
  }

  if (!profile?.organization_id) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
