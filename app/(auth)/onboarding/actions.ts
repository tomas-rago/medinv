"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingSchema } from "@/lib/schemas/onboarding/onboarding";
import { setPendingCheckoutCookie } from "@/lib/mp/cookie";
import { provisionOrganization } from "@/lib/org";
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

  const adminClient = createAdminClient();
  const { data: plan, error: planError } = await adminClient
    .from("plans")
    .select("monthly_price")
    .eq("id", result.data.planId)
    .single();

  if (planError || !plan) {
    return { ok: false, errors: { _form: ["Plan no encontrado"] } };
  }

  if (Number(plan.monthly_price) === 0) {
    try {
      await provisionOrganization({
        userId: user.id,
        orgName: result.data.orgName,
        planId: result.data.planId,
        billingCycle: result.data.billingCycle,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al crear la organización";
      return { ok: false, errors: { _form: [message] } };
    }

    await supabase.auth.refreshSession();
    redirect("/dashboard");
  }

  await setPendingCheckoutCookie(cookieStore, {
    orgName: result.data.orgName,
    planId: result.data.planId,
    billingCycle: result.data.billingCycle,
  });

  redirect("/checkout");
}
