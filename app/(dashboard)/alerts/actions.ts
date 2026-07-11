"use server";

import { createClient } from "@/lib/supabase/server";
import { AlertSettingsSchema, MinQuantitySchema } from "@/lib/schemas/alerts/settings";
import { canManageAlerts } from "@/lib/constants/roles";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type AcknowledgeAlertResult = {
  ok: boolean;
  error?: string;
};

export async function acknowledgeAlert(alertId: string): Promise<AcknowledgeAlertResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) return { ok: false, error: "org_not_found" };

  const { error } = await supabase
    .from("alerts")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
    .eq("id", alertId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[acknowledgeAlert] update error:", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

type AlertSettingsFieldErrors = {
  expiry_days_ahead?: string[];
  _form?: string[];
};

export type SaveAlertSettingsResult = {
  ok: boolean;
  errors: AlertSettingsFieldErrors;
};

export async function saveAlertSettings(
  _prevState: SaveAlertSettingsResult,
  formData: FormData
): Promise<SaveAlertSettingsResult> {
  const raw = {
    low_stock_enabled: formData.get("low_stock_enabled") === "on",
    expiry_enabled: formData.get("expiry_enabled") === "on",
    reorder_enabled: formData.get("reorder_enabled") === "on",
    expiry_days_ahead: formData.get("expiry_days_ahead"),
  };

  const result = AlertSettingsSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  if (!canManageAlerts(user.app_metadata?.role as string)) {
    return { ok: false, errors: { _form: ["no_permission"] } };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, errors: { _form: ["org_not_found"] } };
  }

  const { error } = await supabase.from("alert_settings").upsert({
    organization_id: organizationId,
    low_stock_enabled: result.data.low_stock_enabled,
    expiry_enabled: result.data.expiry_enabled,
    reorder_enabled: result.data.reorder_enabled,
    expiry_days_ahead: result.data.expiry_days_ahead,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[saveAlertSettings] upsert error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  // Re-evaluate immediately so disabling a type or changing the expiry
  // window is reflected without waiting for the next page load.
  await supabase.rpc("sweep_alerts");

  revalidatePath("/alerts");
  return { ok: true, errors: {} };
}

export type UpdateMinQuantityResult = {
  ok: boolean;
  error?: string;
};

// Per-product low-stock threshold. The stock trigger re-evaluates the
// alert condition on this update, so alerts fire/resolve immediately.
export async function updateMinQuantity(
  productId: string,
  minQuantity: number
): Promise<UpdateMinQuantityResult> {
  const result = MinQuantitySchema.safeParse({ product_id: productId, min_quantity: minQuantity });
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "unexpected" };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (!canManageAlerts(user.app_metadata?.role as string)) {
    return { ok: false, error: "no_permission" };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) return { ok: false, error: "org_not_found" };

  const { error } = await supabase
    .from("stock")
    .update({ min_quantity: result.data.min_quantity })
    .eq("product_id", result.data.product_id)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[updateMinQuantity] update error:", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/alerts");
  revalidatePath("/stock");
  return { ok: true };
}
