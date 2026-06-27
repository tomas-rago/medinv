import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingCheckoutCookie, deletePendingCheckoutCookie } from "@/lib/mp/cookie";
import { createPreapproval } from "@/lib/mp/preapproval";
import { CheckoutSchema } from "@/lib/schemas/checkout/checkout";

// Like /api/mp/subscribe but for existing orgs upgrading from the free plan.
// Creates the MP preapproval and updates the existing organization instead of creating one.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const role = user.app_metadata?.role;
  if (role !== "chief_doctor") {
    return Response.json({ ok: false, error: "Sin permisos" }, { status: 403 });
  }

  const orgId = user.app_metadata?.organization_id as string | undefined;
  if (!orgId) {
    return Response.json({ ok: false, error: "Organización no encontrada" }, { status: 400 });
  }

  const pending = await getPendingCheckoutCookie(cookieStore);
  if (!pending || pending.type !== "upgrade") {
    return Response.json(
      { ok: false, error: "Sesión de pago expirada. Volvé a elegir un plan." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { token, billingCycle } = parsed.data;

  const adminClient = createAdminClient();

  const { data: plan, error: planError } = await adminClient
    .from("plans")
    .select("id, name, monthly_price, mp_plan_id")
    .eq("id", pending.planId)
    .single();

  if (planError || !plan || !plan.mp_plan_id) {
    return Response.json({ ok: false, error: "Plan no encontrado o sin configuración de pago" }, { status: 400 });
  }

  const amount =
    billingCycle === "annual"
      ? Math.round(plan.monthly_price * 0.8)
      : plan.monthly_price;

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
    return Response.json({ ok: false, error: message }, { status: 400 });
  }

  const subscriptionStatus = mpStatus === "authorized" ? "active" : "pending";

  const { error: updateError } = await adminClient
    .from("organizations")
    .update({
      plan_id: plan.id,
      mp_subscription_id: mpSubscriptionId,
      subscription_status: subscriptionStatus,
      billing_cycle: billingCycle,
    })
    .eq("id", orgId);

  if (updateError) {
    return Response.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  await deletePendingCheckoutCookie(cookieStore);

  return Response.json({ ok: true });
}
