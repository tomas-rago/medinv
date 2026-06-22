import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingCheckoutCookie, deletePendingCheckoutCookie } from "@/lib/mp/cookie";
import { createPreapproval } from "@/lib/mp/preapproval";
import { CheckoutSchema } from "@/lib/schemas/checkout/checkout";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  // Read and verify the signed pending-checkout cookie
  const pending = await getPendingCheckoutCookie(cookieStore);
  if (!pending) {
    return Response.json({ ok: false, error: "Sesión de pago expirada. Volvé a elegir un plan." }, { status: 400 });
  }

  // Validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { token, billingCycle } = parsed.data;

  const adminClient = createAdminClient();

  // Fetch canonical plan price — never trust client-sent amounts
  const { data: plan, error: planError } = await adminClient
    .from("plans")
    .select("id, name, monthly_price, mp_plan_id")
    .eq("id", pending.planId)
    .single();

  if (planError || !plan) {
    return Response.json({ ok: false, error: "Plan no encontrado" }, { status: 400 });
  }

  if (!plan.mp_plan_id) {
    return Response.json({ ok: false, error: "Plan sin configuración de pago" }, { status: 400 });
  }

  const amount =
    billingCycle === "annual"
      ? Math.round(plan.monthly_price * 0.8)
      : plan.monthly_price;

  // Create Mercado Pago preapproval (subscription)
  let mpSubscriptionId: string;
  let mpStatus: string;
  try {
    const preapproval = await createPreapproval({
      userId: user.id,
      userEmail: user.email ?? "",
      planName: plan.name,
      mpPlanId: plan.mp_plan_id,
      billingCycle,
      cardToken: token,
      amount,
      currencyId: process.env.MP_CURRENCY_ID ?? "ARS",
    });
    mpSubscriptionId = preapproval.id;
    mpStatus = preapproval.status;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al procesar el pago";
    console.error("[mp/subscribe] preapproval error:", message);
    return Response.json({ ok: false, error: message }, { status: 400 });
  }

  const subscriptionStatus = mpStatus === "authorized" ? "active" : "pending";

  // Create organization
  const { data: org, error: orgError } = await adminClient
    .from("organizations")
    .insert({
      name: pending.orgName,
      plan_id: plan.id,
      mp_subscription_id: mpSubscriptionId,
      subscription_status: subscriptionStatus,
      billing_cycle: billingCycle,
    })
    .select("id")
    .single();

  if (orgError || !org) {
    console.error("[mp/subscribe] org insert error:", orgError?.message);
    return Response.json(
      { ok: false, error: orgError?.message ?? "Error al crear la organización" },
      { status: 500 }
    );
  }

  // Link profile to org with admin role
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ organization_id: org.id, role: "admin" })
    .eq("id", user.id);

  if (profileError) {
    console.error("[mp/subscribe] profile update error:", profileError.message);
    return Response.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  // Sync org + role into JWT app_metadata
  const { error: metaError } = await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: { role: "admin", organization_id: org.id },
  });
  if (metaError) {
    console.error("[mp/subscribe] app_metadata error:", metaError.message);
  }

  // Refresh session so updated JWT is written to cookies before client redirect
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.error("[mp/subscribe] session refresh error:", refreshError.message);
  }

  // Clean up the pending checkout cookie
  await deletePendingCheckoutCookie(cookieStore);

  return Response.json({ ok: true });
}
