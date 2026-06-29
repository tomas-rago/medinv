"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForgotPasswordSchema } from "@/lib/schemas/forgot-password/forgot-password";
import { cookies } from "next/headers";

export type ForgotPasswordResult = {
  ok: boolean;
  errors: { email?: string[]; _form?: string[] };
};

export async function requestPasswordReset(
  _prevState: ForgotPasswordResult,
  formData: FormData
): Promise<ForgotPasswordResult> {
  const raw = { email: formData.get("email") };

  const result = ForgotPasswordSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectTo = `${siteUrl}/auth/callback?type=recovery`;

  if (process.env.NODE_ENV === "development") {
    const adminClient = createAdminClient();
    const { data: linkData, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: result.data.email,
      options: { redirectTo },
    });
    if (error) {
      console.error(`[DEV] generateLink error:`, error.message);
    } else if (linkData?.properties?.action_link) {
      console.log(
        `\n🔗 DEV password reset link for ${result.data.email}:\n${linkData.properties.action_link}\n`
      );
    } else {
      console.warn(`[DEV] generateLink returned no action_link`, linkData);
    }
  } else {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await supabase.auth.resetPasswordForEmail(result.data.email, { redirectTo });
  }

  // Always return ok — never reveal whether the email exists
  return { ok: true, errors: {} };
}
