"use server";

import { createClient } from "@/lib/supabase/server";
import { ResetPasswordSchema } from "@/lib/schemas/reset-password/reset-password";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type ResetPasswordResult = {
  ok: boolean;
  errors: { password?: string[]; confirmPassword?: string[]; _form?: string[] };
};

export async function resetPassword(
  _prevState: ResetPasswordResult,
  formData: FormData
): Promise<ResetPasswordResult> {
  const raw = {
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const result = ResetPasswordSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: result.data.password });

  if (error) {
    return { ok: false, errors: { _form: [error.message] } };
  }

  redirect("/dashboard");
}
