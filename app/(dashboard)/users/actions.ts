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
  if (!user) return { ok: false, errors: { _form: ["No autenticado"] } };

  // Only admins can invite
  if (user.app_metadata?.role !== "admin") {
    return { ok: false, errors: { _form: ["Sin permiso para invitar usuarios"] } };
  }

  const organizationId = user.app_metadata?.organization_id as string;

  if (!organizationId) {
    return { ok: false, errors: { _form: ["No se encontró la organización en la sesión"] } };
  }

  const adminClient = createAdminClient();

  // Use admin client — invitations RLS requires app_metadata claims that may not
  // yet be reflected in the cookie JWT after onboarding
  const { error: invError } = await adminClient.from("invitations").insert({
    organization_id: organizationId,
    email: result.data.email,
    role: result.data.role,
    invited_by: user.id,
  });

  if (invError) {
    return { ok: false, errors: { _form: [invError.message] } };
  }

  // Send invitation email via Supabase Auth
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
      return { ok: false, errors: { _form: [authError.message] } };
    }
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
  if (!user) return { ok: false, error: "No autenticado" };

  if (user.app_metadata?.role !== "admin") {
    return { ok: false, error: "Sin permiso para modificar usuarios" };
  }

  if (userId === user.id) {
    return { ok: false, error: "No podés desactivarte a ti mismo" };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, error: "No se encontró la organización en la sesión" };
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
