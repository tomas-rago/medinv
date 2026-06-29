type CreatePreapprovalPlanParams = {
  reason: string;
  billingCycle: "monthly" | "annual";
  transactionAmount: number;
  backUrl?: string;
};

type PreapprovalPlanResult = {
  id: string;
  status: string;
};

export async function createPreapprovalPlan(
  params: CreatePreapprovalPlanParams
): Promise<PreapprovalPlanResult> {
  const { reason, billingCycle, transactionAmount, backUrl } = params;

  const accessToken = process.env.MP_TEST_ACCESS_TOKEN ?? process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN is not set");

  const currencyId = process.env.MP_CURRENCY_ID ?? "ARS";

  const resolvedBackUrl =
    backUrl ?? (process.env.MP_WEBHOOK_URL?.startsWith("https://")
      ? process.env.MP_WEBHOOK_URL
      : undefined);

  const body: Record<string, unknown> = {
    reason,
    auto_recurring: {
      frequency: 1,
      frequency_type: billingCycle === "annual" ? "years" : "months",
      transaction_amount: transactionAmount,
      currency_id: currencyId,
    },
  };

  if (resolvedBackUrl) body.back_url = resolvedBackUrl;

  const res = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const message =
      data?.message ?? data?.cause?.[0]?.description ?? `MP API error ${res.status}`;
    throw new Error(message);
  }

  return { id: data.id, status: data.status };
}
