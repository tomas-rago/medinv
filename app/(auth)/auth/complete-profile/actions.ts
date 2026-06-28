"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompleteProfileSchema } from "@/lib/schemas/complete-profile/complete-profile";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type CompleteProfileResult = {
  ok: boolean;
  errors: {
    firstName?: string[];
    lastName?: string[];
    password?: string[];
    _form?: string[];
  };
};

export async function completeProfile(
  _prevState: CompleteProfileResult,
  formData: FormData
): Promise<CompleteProfileResult> {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    password: formData.get("password"),
  };

  const result = CompleteProfileSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = `${result.data.firstName} ${result.data.lastName}`;

  // Set password and update full_name in user metadata
  const { error: updateError } = await supabase.auth.updateUser({
    password: result.data.password,
    data: { full_name: fullName },
  });

  if (updateError) {
    return { ok: false, errors: { _form: [updateError.message] } };
  }

  const adminClient = createAdminClient();

  // The DB trigger populates organization_id and role from the pending invitation
  // when the user is created. Fall back to the invitations table if the trigger
  // ran before the fix (profile row exists but fields are null).
  const { data: profile, error: profileLookupError } = await adminClient
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileLookupError) {
    return { ok: false, errors: { _form: ["profile_not_found"] } };
  }

  let organizationId = profile?.organization_id;
  let role = profile?.role;

  if (!organizationId || !role) {
    const { data: invitation } = await adminClient
      .from("invitations")
      .select("organization_id, role")
      .eq("email", user.email!)
      .eq("accepted", false)
      .single();

    organizationId = invitation?.organization_id ?? null;
    role = invitation?.role ?? null;
  }

  if (!organizationId || !role) {
    return { ok: false, errors: { _form: ["profile_not_found"] } };
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ full_name: fullName, organization_id: organizationId, role })
    .eq("id", user.id);

  if (profileError) {
    return { ok: false, errors: { _form: [profileError.message] } };
  }

  // Sync app_metadata so JWT carries role + org for RLS
  await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: { role, organization_id: organizationId },
  });

  // Refresh session so the updated app_metadata is written to cookies before the
  // redirect — without this, the dashboard layout reads a stale JWT and RLS blocks
  // the profile read, causing an immediate redirect back to onboarding.
  await supabase.auth.refreshSession();

  // Mark invitation as accepted
  await adminClient
    .from("invitations")
    .update({ accepted: true })
    .eq("email", user.email!)
    .eq("accepted", false);

  redirect("/dashboard");
}
