"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuthLinkFallback, sendsRealAuthEmails } from "@/lib/auth/email-mode";
import { SignUpSchema } from "@/lib/schemas/sign-up/sign-up";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type SignUpResult = {
  ok: false;
  errors: {
    firstName?: string[];
    lastName?: string[];
    email?: string[];
    password?: string[];
    terms?: string[];
    _form?: string[];
  };
};

export async function signup(
  _prevState: SignUpResult,
  formData: FormData
): Promise<SignUpResult> {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    terms: formData.get("terms"),
  };

  const result = SignUpSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const { firstName, lastName, email, password } = result.data;
  const fullName = `${firstName} ${lastName}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!sendsRealAuthEmails()) {
    // In dev, create the user as auto-confirmed and sign them in immediately.
    // generateLink was tried before but its confirmation URL uses implicit flow
    // (hash fragment) which the Route Handler can't read — the new session was
    // never established and the old cookie session persisted instead.
    const adminClient = createAdminClient();
    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name: fullName },
        email_confirm: true,
      });

    if (!created?.user) {
      return { ok: false, errors: { _form: ["cannot_create_user"] } };
    }

    if (createError) {
      return { ok: false, errors: { _form: [createError.message] } };
    }

    // Sign in with the new credentials so session cookies are set for this user
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return { ok: false, errors: { _form: [signInError.message] } };
    }

    redirect("/onboarding");
  } else {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      console.error("[signup] signUp error:", error.message);
      // The confirmation email didn't go out — mint a console link instead so the
      // account is still reachable. Safe to invalidate: nothing landed in an inbox.
      const link = await logAuthLinkFallback({
        type: "signup",
        email,
        password,
        data: { full_name: fullName },
      });
      if (!link) return { ok: false, errors: { _form: [error.message] } };
    }

    redirect("/auth/confirm");
  }
}
