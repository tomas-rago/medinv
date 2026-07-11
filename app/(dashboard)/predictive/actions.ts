"use server";

import { createClient } from "@/lib/supabase/server";
import { PredictiveSettingsSchema } from "@/lib/schemas/predictive/settings";
import { canManagePredictive } from "@/lib/constants/roles";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

type PredictiveSettingsFieldErrors = {
  lead_time_days?: string[];
  coverage_days?: string[];
  safety_days_vital?: string[];
  safety_days_essential?: string[];
  safety_days_desirable?: string[];
  _form?: string[];
};

export type SavePredictiveSettingsResult = {
  ok: boolean;
  errors: PredictiveSettingsFieldErrors;
};

export async function savePredictiveSettings(
  _prevState: SavePredictiveSettingsResult,
  formData: FormData
): Promise<SavePredictiveSettingsResult> {
  const raw = {
    lead_time_days: formData.get("lead_time_days"),
    coverage_days: formData.get("coverage_days"),
    safety_days_vital: formData.get("safety_days_vital"),
    safety_days_essential: formData.get("safety_days_essential"),
    safety_days_desirable: formData.get("safety_days_desirable"),
  };

  const result = PredictiveSettingsSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  if (!canManagePredictive(user.app_metadata?.role as string)) {
    return { ok: false, errors: { _form: ["no_permission"] } };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, errors: { _form: ["org_not_found"] } };
  }

  const { error } = await supabase.from("predictive_settings").upsert({
    organization_id: organizationId,
    lead_time_days: result.data.lead_time_days,
    coverage_days: result.data.coverage_days,
    safety_days_vital: result.data.safety_days_vital,
    safety_days_essential: result.data.safety_days_essential,
    safety_days_desirable: result.data.safety_days_desirable,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[savePredictiveSettings] upsert error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/predictive");
  return { ok: true, errors: {} };
}
