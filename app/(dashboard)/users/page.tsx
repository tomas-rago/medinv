import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { UsersPage } from "@/components/users/UsersPage";

export default async function UsersServerPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = user.app_metadata?.role === "chief_doctor";

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, created_at")
    .order("created_at");

  return (
    <UsersPage
      profiles={profiles ?? []}
      isAdmin={isAdmin}
    />
  );
}
