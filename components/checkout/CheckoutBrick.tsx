"use client";

import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  publicKey: string;
  amount: number;
  planName: string;
  billingCycle: "monthly" | "annual";
  checkoutType?: "initial" | "upgrade";
};

export function CheckoutBrick({ publicKey, amount, planName, billingCycle, checkoutType = "initial" }: Props) {
  const t = useTranslations("Checkout");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (publicKey) {
      initMercadoPago(publicKey, { locale: "es-AR" });
    }
  }, [publicKey]);

  const initialization = { amount };

  const customization = {
    paymentMethods: {
      creditCard: "all" as const,
      debitCard: "all" as const,
    },
  };

  async function onSubmit(formData: {
    selectedPaymentMethod: string;
    formData: {
      token?: string;
      payment_method_id?: string;
      issuer_id?: string;
      installments?: number;
      payer?: { email?: string };
    };
  }) {
    const { token, payment_method_id, issuer_id } = formData.formData;
    console.log("[CheckoutBrick] onSubmit token:", token ? `${token.slice(0, 8)}… (len=${token.length})` : "MISSING", "pm:", payment_method_id);
    if (!token) {
      setErrorKey("error_tokenize");
      return;
    }

    setSubmitting(true);
    setErrorKey(null);

    try {
      const endpoint = checkoutType === "upgrade" ? "/api/mp/subscription/activate" : "/api/mp/subscribe";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          paymentMethodId: payment_method_id,
          issuerId: issuer_id,
          billingCycle,
        }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setErrorKey("error_payment");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setErrorKey("error_connection");
      setSubmitting(false);
    }
  }

  function onError(error: unknown) {
    console.error("[CheckoutBrick] error:", error);
    setErrorKey("error_form");
  }

  return (
    <div className="mi-card mi-card-pad">
      <p className="text-ink2 mb-6" style={{ fontSize: 14 }}>
        {t("card_info", { planName })}
      </p>

      {submitting ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <svg
            className="animate-spin"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--c-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <p className="text-ink2" style={{ fontSize: 14 }}>{t("processing")}</p>
        </div>
      ) : (
        <Payment
          initialization={initialization}
          customization={customization}
          onSubmit={onSubmit}
          onError={onError}
        />
      )}

      {errorKey && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <p className="mi-field-error mt-4">{t(errorKey as any)}</p>
      )}
    </div>
  );
}
