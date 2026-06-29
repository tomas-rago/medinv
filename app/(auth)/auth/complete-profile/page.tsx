import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompleteProfile } from "@/components/auth/complete-profile/CompleteProfile";

export default async function CompleteProfilePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // app_metadata.organization_id is only set after the user completes this form.
  // The DB trigger sets profile.organization_id on invite, so we can't use that as the guard.
  if (user.app_metadata?.organization_id) redirect("/dashboard");

  return <CompleteProfile email={user.email!} />;
}
