import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default async function SettingsServerPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const [firstName = "", ...rest] = (profile?.full_name ?? "").split(" ");
  const lastName = rest.join(" ");

  return (
    <SettingsPage
      email={user.email ?? ""}
      initialFirstName={firstName}
      initialLastName={lastName}
    />
  );
}
