"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingSchema } from "@/lib/schemas/onboarding/onboarding";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type OnboardingResult = {
  ok: boolean;
  errors: { orgName?: string[]; planId?: string[]; _form?: string[] };
};

export async function completeOnboarding(
  _prevState: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  const raw = {
    orgName: formData.get("orgName"),
    planId: formData.get("planId"),
  };

  const result = OnboardingSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  console.log("[onboarding] user:", user.id, user.email);

  // Create organization via admin client — user has no org yet so RLS would block this
  const adminClient = createAdminClient();
  const { data: org, error: orgError } = await adminClient
    .from("organizations")
    .insert({ name: result.data.orgName, plan_id: result.data.planId })
    .select("id")
    .single();

  console.log("[onboarding] org insert:", org?.id ?? null, orgError?.message ?? null);

  if (orgError || !org) {
    return { ok: false, errors: { _form: [orgError?.message ?? "Error al crear la organización"] } };
  }

  // Check if profile row exists before updating
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, organization_id")
    .eq("id", user.id)
    .single();
  console.log("[onboarding] existing profile:", JSON.stringify(existingProfile));

  const { data: updatedProfile, error: profileError } = await adminClient
    .from("profiles")
    .update({ organization_id: org.id, role: "admin" })
    .eq("id", user.id)
    .select()
    .single();

  console.log("[onboarding] profile update result:", JSON.stringify(updatedProfile), "error:", profileError?.message ?? null);

  if (profileError) {
    return { ok: false, errors: { _form: [profileError.message] } };
  }

  const { error: metaError } = await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: { role: "admin", organization_id: org.id },
  });

  console.log("[onboarding] app_metadata update error:", metaError?.message ?? null);

  // Refresh the session so the new JWT (with org + role in app_metadata) is written
  // to cookies before the redirect — otherwise the dashboard layout reads a stale JWT
  // that lacks app_metadata, causing RLS to block the profile read.
  const { error: refreshError } = await supabase.auth.refreshSession();
  console.log("[onboarding] session refresh error:", refreshError?.message ?? null);

  revalidatePath("/");
  redirect("/dashboard");
}
