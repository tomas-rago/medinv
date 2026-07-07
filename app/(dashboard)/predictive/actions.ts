"use server";

import { createClient } from "@/lib/supabase/server";
import { PredictiveSettingsSchema } from "@/lib/schemas/predictive/settings";
import { canManagePredictive } from "@/lib/constants/roles";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

type PredictiveSettingsFieldErrors = {
  ordering_cost?: string[];
  holding_cost_rate?: string[];
  lead_time_days?: string[];
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
    ordering_cost: formData.get("ordering_cost"),
    holding_cost_rate: formData.get("holding_cost_rate"),
    lead_time_days: formData.get("lead_time_days"),
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
    ordering_cost: result.data.ordering_cost,
    holding_cost_rate: result.data.holding_cost_rate,
    lead_time_days: result.data.lead_time_days,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[savePredictiveSettings] upsert error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/predictive");
  return { ok: true, errors: {} };
}
