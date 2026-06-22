import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updatePreapproval, cancelPreapproval } from "@/lib/mp/preapproval";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  // Enforce admin role via JWT app_metadata
  const role = user.app_metadata?.role;
  if (role !== "admin") {
    return Response.json({ ok: false, error: "Sin permisos" }, { status: 403 });
  }

  const orgId = user.app_metadata?.organization_id as string | undefined;
  if (!orgId) {
    return Response.json({ ok: false, error: "Organización no encontrada" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { newPlanId, billingCycle } = body as { newPlanId?: string; billingCycle?: string };
  if (!newPlanId) {
    return Response.json({ ok: false, error: "newPlanId requerido" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Fetch current org
  const { data: org, error: orgError } = await adminClient
    .from("organizations")
    .select("id, plan_id, mp_subscription_id, billing_cycle")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return Response.json({ ok: false, error: "Organización no encontrada" }, { status: 400 });
  }

  if (org.plan_id === newPlanId) {
    return Response.json({ ok: true });
  }

  // Fetch the new plan
  const { data: newPlan, error: planError } = await adminClient
    .from("plans")
    .select("id, name, monthly_price, mp_plan_id")
    .eq("id", newPlanId)
    .single();

  if (planError || !newPlan) {
    return Response.json({ ok: false, error: "Plan no encontrado" }, { status: 400 });
  }

  const effectiveBillingCycle =
    (billingCycle === "monthly" || billingCycle === "annual")
      ? billingCycle
      : org.billing_cycle;

  // Free plan (monthly_price = 0 or no mp_plan_id) → cancel current subscription
  if (newPlan.monthly_price === 0 || !newPlan.mp_plan_id) {
    if (org.mp_subscription_id) {
      try {
        await cancelPreapproval(org.mp_subscription_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al cancelar en Mercado Pago";
        return Response.json({ ok: false, error: message }, { status: 400 });
      }
    }

    const { error: updateError } = await adminClient
      .from("organizations")
      .update({
        plan_id: newPlanId,
        mp_subscription_id: null,
        subscription_status: "cancelled",
        current_period_end: null,
      })
      .eq("id", orgId);

    if (updateError) {
      return Response.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  }

  // Paid → Paid: update the subscription amount in place
  if (!org.mp_subscription_id) {
    // Currently on free plan trying to go paid — must go through checkout
    return Response.json(
      { ok: false, error: "REQUIRES_CHECKOUT" },
      { status: 400 }
    );
  }

  const newAmount =
    effectiveBillingCycle === "annual"
      ? Math.round(newPlan.monthly_price * 0.8)
      : newPlan.monthly_price;

  try {
    await updatePreapproval(org.mp_subscription_id, {
      auto_recurring: {
        transaction_amount: newAmount,
        currency_id: process.env.MP_CURRENCY_ID ?? "ARS",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar en Mercado Pago";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }

  const { error: updateError } = await adminClient
    .from("organizations")
    .update({
      plan_id: newPlanId,
      billing_cycle: effectiveBillingCycle,
    })
    .eq("id", orgId);

  if (updateError) {
    return Response.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
