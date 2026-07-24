"use server";

import { createClient } from "@/lib/supabase/server";
import { logAuthLinkFallback, sendsRealAuthEmails } from "@/lib/auth/email-mode";
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

  if (!sendsRealAuthEmails()) {
    await logAuthLinkFallback({ type: "recovery", email: result.data.email });
  } else {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.resetPasswordForEmail(
      result.data.email,
      { redirectTo }
    );
    // The email didn't go out (rate limit, SMTP failure) — mint a console link so
    // the flow is still usable. Safe to invalidate: there is nothing in an inbox.
    if (error) {
      console.error("[requestPasswordReset] resetPasswordForEmail error:", error.message);
      await logAuthLinkFallback({ type: "recovery", email: result.data.email });
    }
  }

  // Always return ok — never reveal whether the email exists
  return { ok: true, errors: {} };
}
