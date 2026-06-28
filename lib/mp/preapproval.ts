type CreatePreapprovalParams = {
  userId: string;
  userEmail: string;
  planName: string;
  mpPlanId: string;
  billingCycle: "monthly" | "annual";
  cardToken: string;
  amount: number;
  currencyId: string;
};

type PreapprovalResult = {
  id: string;
  status: string;
  init_point?: string;
};

export async function createPreapproval(
  params: CreatePreapprovalParams
): Promise<PreapprovalResult> {
  const { userId, userEmail, planName, mpPlanId, cardToken, amount, currencyId } = params;
  const accessToken = process.env.MP_TEST_ACCESS_TOKEN ?? process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN is not set");
  // In test mode the payer must be the buyer test user, not the real Supabase user
  const payerEmail = process.env.MP_TEST_PAYER_EMAIL ?? userEmail;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const body = {
    preapproval_plan_id: mpPlanId,
    reason: `Med+Inv — ${planName}`,
    external_reference: userId,
    payer_email: payerEmail,
    card_token_id: cardToken,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: amount,
      currency_id: currencyId,
    },
    back_url: `${siteUrl}/dashboard`,
    notification_url: `${siteUrl}/api/mp/webhook`,
    status: "authorized",
  };

  // Verify the preapproval plan exists
  const planVerifyRes = await fetch(`https://api.mercadopago.com/preapproval_plan/${mpPlanId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const planData = await planVerifyRes.json();
  if (!planVerifyRes.ok) throw new Error(`MP plan not found: ${planData?.message ?? planVerifyRes.status}`);

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const message = data?.message ?? data?.cause?.[0]?.description ?? `MP API error ${res.status}`;
    throw new Error(message);
  }

  return { id: data.id, status: data.status, init_point: data.init_point };
}

export async function fetchPreapproval(id: string): Promise<{ status: string; next_payment_date?: string }> {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN is not set");

  const res = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`MP API error ${res.status}`);
  const data = await res.json();
  return { status: data.status, next_payment_date: data.next_payment_date };
}

export async function updatePreapproval(
  id: string,
  fields: {
    status?: "authorized" | "paused" | "canceled";
    auto_recurring?: { transaction_amount: number; currency_id: string };
  }
): Promise<void> {
  const accessToken = process.env.MP_TEST_ACCESS_TOKEN ?? process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN is not set");

  const res = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data?.message ?? data?.cause?.[0]?.description ?? `MP API error ${res.status}`;
    throw new Error(message);
  }
}

export async function cancelPreapproval(id: string): Promise<void> {
  return updatePreapproval(id, { status: "canceled" });
}

export async function fetchAuthorizedPayment(id: string): Promise<{
  paymentStatus: string;
  preapprovalId?: string;
  nextPaymentDate?: string;
}> {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN is not set");

  const res = await fetch(`https://api.mercadopago.com/authorized_payments/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`MP API error ${res.status}`);
  const data = await res.json();
  return {
    paymentStatus: data.payment?.status ?? "unknown",
    preapprovalId: data.preapproval_id,
    nextPaymentDate: data.next_payment_date,
  };
}
