"use server";

import { createClient } from "@/lib/supabase/server";
import { LoginSchema } from "@/lib/schemas/login/credentials";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type LoginResult = {
  ok: boolean;
  errors: { email?: string[]; password?: string[]; _form?: string[] };
};

export async function login(
  _prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = LoginSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    return { ok: false, errors: { _form: ["email_or_password_incorrect"] } };
  }

  redirect("/dashboard");
}
