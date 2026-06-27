"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpdateProfileSchema } from "@/lib/schemas/settings/profile";
import { UpdatePasswordSchema } from "@/lib/schemas/settings/password";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type UpdateProfileResult = {
  ok: boolean;
  errors: { firstName?: string[]; lastName?: string[]; _form?: string[] };
};

export async function updateProfile(
  _prevState: UpdateProfileResult,
  formData: FormData
): Promise<UpdateProfileResult> {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  };

  const result = UpdateProfileSchema.safeParse(raw);
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

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });
  if (authError) {
    return { ok: false, errors: { _form: [authError.message] } };
  }

  const adminClient = createAdminClient();
  const { error: dbError } = await adminClient
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (dbError) {
    return { ok: false, errors: { _form: [dbError.message] } };
  }

  revalidatePath("/settings");
  return { ok: true, errors: {} };
}

export type UpdatePasswordResult = {
  ok: boolean;
  errors: {
    currentPassword?: string[];
    newPassword?: string[];
    confirmPassword?: string[];
    _form?: string[];
  };
};

export async function updatePassword(
  _prevState: UpdatePasswordResult,
  formData: FormData
): Promise<UpdatePasswordResult> {
  const raw = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const result = UpdatePasswordSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: result.data.currentPassword,
  });

  if (verifyError) {
    return { ok: false, errors: { currentPassword: ["current_password_incorrect"] } };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: result.data.newPassword,
  });

  if (updateError) {
    return { ok: false, errors: { _form: [updateError.message] } };
  }

  return { ok: true, errors: {} };
}
