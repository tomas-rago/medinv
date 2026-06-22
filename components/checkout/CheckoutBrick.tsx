"use client";

import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// initMercadoPago is global state — track the key to reinitialize if it changes
let initializedKey = "";

type Props = {
  publicKey: string;
  amount: number;
  planName: string;
  billingCycle: "monthly" | "annual";
  checkoutType?: "initial" | "upgrade";
};

export function CheckoutBrick({ publicKey, amount, planName, billingCycle, checkoutType = "initial" }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (publicKey && initializedKey !== publicKey) {
    initMercadoPago(publicKey, { locale: "es-AR" });
    initializedKey = publicKey;
  }

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
      setError("No se pudo tokenizar la tarjeta. Intentá de nuevo.");
      return;
    }

    setSubmitting(true);
    setError(null);

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
        setError(data.error ?? "Error al procesar el pago. Intentá de nuevo.");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Error de conexión. Verificá tu internet e intentá de nuevo.");
      setSubmitting(false);
    }
  }

  function onError(error: unknown) {
    console.error("[CheckoutBrick] error:", error);
    setError("Ocurrió un error con el formulario de pago.");
  }

  return (
    <div className="mi-card mi-card-pad">
      <p className="text-ink2 mb-6" style={{ fontSize: 14 }}>
        Ingresá los datos de tu tarjeta para activar tu suscripción a{" "}
        <strong className="text-ink">{planName}</strong>. Podés cancelar cuando querés.
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
          <p className="text-ink2" style={{ fontSize: 14 }}>Procesando tu suscripción…</p>
        </div>
      ) : (
        <Payment
          initialization={initialization}
          customization={customization}
          onSubmit={onSubmit}
          onError={onError}
        />
      )}

      {error && (
        <p className="mi-field-error mt-4">{error}</p>
      )}
    </div>
  );
}
