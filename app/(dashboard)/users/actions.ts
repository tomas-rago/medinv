"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteSchema } from "@/lib/schemas/users/invite";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type InviteResult = {
  ok: boolean;
  errors: { email?: string[]; role?: string[]; _form?: string[] };
};

export async function inviteUser(
  _prevState: InviteResult,
  formData: FormData
): Promise<InviteResult> {
  const raw = {
    email: formData.get("email"),
    role: formData.get("role"),
  };

  const result = InviteSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  // Only admins can invite
  if (user.app_metadata?.role !== "chief_doctor") {
    return { ok: false, errors: { _form: ["no_invite_permission"] } };
  }

  const organizationId = user.app_metadata?.organization_id as string;

  if (!organizationId) {
    return { ok: false, errors: { _form: ["org_not_found"] } };
  }

  const adminClient = createAdminClient();

  // Send invitation email via Supabase Auth first — only persist the invitation
  // row if the auth call succeeds, so we never have orphaned invitation records.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteOptions = {
    data: { role: result.data.role },
    redirectTo: `${siteUrl}/auth/invite`,
  };

  if (process.env.NODE_ENV === "development") {
    // generateLink skips email sending entirely — link is logged to the server console.
    // This bypasses Supabase's dev-instance email rate limit.
    const { data: linkData, error: authError } =
      await adminClient.auth.admin.generateLink({
        type: "invite",
        email: result.data.email,
        options: inviteOptions,
      });
    if (authError) {
      console.error("[inviteUser] generateLink error:", authError.message);
      return { ok: false, errors: { _form: [authError.message] } };
    }
    console.log(
      `\n🔗 DEV invite link for ${result.data.email}:\n${linkData?.properties?.action_link}\n`
    );
  } else {
    const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(
      result.data.email,
      inviteOptions
    );
    if (authError) {
      console.error("[inviteUser] inviteUserByEmail error:", authError.message);
      return { ok: false, errors: { _form: [authError.message] } };
    }
  }

  const { error: invError } = await adminClient.from("invitations").insert({
    organization_id: organizationId,
    email: result.data.email,
    role: result.data.role,
    invited_by: user.id,
  });

  if (invError) {
    console.error("[inviteUser] invitations insert error:", invError.message);
    return { ok: false, errors: { _form: [invError.message] } };
  }

  revalidatePath("/users");
  return { ok: true, errors: {} };
}

export type ToggleActiveResult = {
  ok: boolean;
  error?: string;
};

export async function toggleUserActive(
  userId: string,
  active: boolean
): Promise<ToggleActiveResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (user.app_metadata?.role !== "chief_doctor") {
    return { ok: false, error: "no_modify_permission" };
  }

  if (userId === user.id) {
    return { ok: false, error: "cannot_deactivate_self" };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, error: "org_not_found" };
  }

  const adminClient = createAdminClient();

  const { error: dbError } = await adminClient
    .from("profiles")
    .update({ active })
    .eq("id", userId)
    .eq("organization_id", organizationId);

  if (dbError) {
    return { ok: false, error: dbError.message };
  }

  revalidatePath("/users");
  return { ok: true };
}
