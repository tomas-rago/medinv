"use server";

import { createClient } from "@/lib/supabase/server";
import { OnboardingSchema } from "@/lib/schemas/onboarding/onboarding";
import { setPendingCheckoutCookie } from "@/lib/mp/cookie";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
    billingCycle: formData.get("billingCycle"),
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

  await setPendingCheckoutCookie(cookieStore, {
    orgName: result.data.orgName,
    planId: result.data.planId,
    billingCycle: result.data.billingCycle,
  });

  redirect("/checkout");
}
