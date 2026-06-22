"use client";

import { useState, useTransition } from "react";
import { initiateUpgrade } from "@/app/(dashboard)/cuenta/actions";

type Plan = {
  id: string;
  name: string;
  monthly_price: number;
  token_limit_per_month: number;
  mp_plan_id: string | null;
};

type Org = {
  id: string;
  plan_id: string;
  mp_subscription_id: string | null;
  subscription_status: string;
  billing_cycle: "monthly" | "annual";
  current_period_end: string | null;
};

type Props = {
  org: Org;
  currentPlan: Plan;
  plans: Plan[];
};

const TIER_META: { desc: string; feats: string[] }[] = [
  {
    desc: "Para farmacias que recién arrancan.",
    feats: ["Inventario y control de stock", "Compras y seguimiento de pedidos", "Alertas de stock y vencimiento"],
  },
  {
    desc: "Para equipos que crecen y quieren IA.",
    feats: ["Todo lo del plan anterior", "Asistente IA — chatbot integrado", "Sugerencias predictivas de compra", "Reportes y exportación"],
  },
  {
    desc: "Para cadenas y multi-sucursal.",
    feats: ["Todo lo del plan anterior", "Usuarios ilimitados", "Multi-sucursal centralizado", "Soporte prioritario 24/7", "Acceso a la API"],
  },
];

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  active:    { label: "Activa",        tone: "green" },
  past_due:  { label: "Pago pendiente", tone: "amber" },
  cancelled: { label: "Cancelada",      tone: "danger" },
  pending:   { label: "Pendiente",      tone: "gray" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

type ConfirmState =
  | { type: "none" }
  | { type: "change"; plan: Plan; billingCycle: "monthly" | "annual"; requiresCheckout: boolean }
  | { type: "cancel" };

export function SuscripcionPage({ org, currentPlan, plans }: Props) {
  const [confirmState, setConfirmState] = useState<ConfirmState>({ type: "none" });
  const [annual, setAnnual] = useState(org.billing_cycle === "annual");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isFreePlan = !org.mp_subscription_id || currentPlan.monthly_price === 0;
  const status = STATUS_LABELS[org.subscription_status] ?? { label: org.subscription_status, tone: "gray" };

  function price(plan: Plan) {
    if (plan.monthly_price === 0) return 0;
    return annual ? Math.round(plan.monthly_price * 0.8) : plan.monthly_price;
  }

  function handleSelectPlan(plan: Plan) {
    if (plan.id === currentPlan.id) return;
    setError(null);
    setSuccess(null);
    const requiresCheckout = isFreePlan && plan.monthly_price > 0;
    setConfirmState({ type: "change", plan, billingCycle: annual ? "annual" : "monthly", requiresCheckout });
  }

  function handleCancelClick() {
    setError(null);
    setSuccess(null);
    setConfirmState({ type: "cancel" });
  }

  async function handleConfirm() {
    if (confirmState.type === "none") return;

    if (confirmState.type === "cancel" || (confirmState.type === "change" && confirmState.plan.monthly_price === 0)) {
      // Find free plan
      const freePlan = plans.find((p) => p.monthly_price === 0);
      if (!freePlan) {
        setError("No se encontró el plan gratuito.");
        setConfirmState({ type: "none" });
        return;
      }
      startTransition(async () => {
        const res = await fetch("/api/mp/subscription/change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPlanId: freePlan.id }),
        });
        const data = await res.json() as { ok: boolean; error?: string };
        if (!data.ok) {
          setError(data.error ?? "Error al cancelar la suscripción.");
        } else {
          setSuccess("Tu suscripción fue cancelada. Seguís con el plan gratuito.");
          // Reload to reflect new plan
          window.location.reload();
        }
        setConfirmState({ type: "none" });
      });
      return;
    }

    if (confirmState.type === "change") {
      const { plan, billingCycle, requiresCheckout } = confirmState;

      if (requiresCheckout) {
        // Free → Paid: set cookie and redirect to checkout via server action
        startTransition(async () => {
          await initiateUpgrade(plan.id, billingCycle);
        });
        return;
      }

      // Paid → Paid: update amount in place
      startTransition(async () => {
        const res = await fetch("/api/mp/subscription/change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPlanId: plan.id, billingCycle }),
        });
        const data = await res.json() as { ok: boolean; error?: string };
        if (!data.ok) {
          setError(data.error ?? "Error al cambiar el plan.");
        } else {
          setSuccess(`Plan actualizado a ${plan.name}.`);
          window.location.reload();
        }
        setConfirmState({ type: "none" });
      });
    }
  }

  const paidPlans = plans.filter((p) => p.monthly_price > 0);
  const featuredIndex = Math.floor(paidPlans.length / 2);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="font-display text-ink" style={{ fontSize: 26 }}>Suscripción</h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            Administrá el plan de tu institución.
          </p>
        </div>

        {/* Feedback banners */}
        {error && (
          <div className="mi-card mi-card-pad" style={{ borderColor: "var(--c-danger)", background: "color-mix(in srgb, var(--c-danger) 6%, var(--c-surface))" }}>
            <p className="text-danger" style={{ fontSize: 14 }}>{error}</p>
          </div>
        )}
        {success && (
          <div className="mi-card mi-card-pad" style={{ borderColor: "var(--c-green)", background: "color-mix(in srgb, var(--c-green) 6%, var(--c-surface))" }}>
            <p style={{ fontSize: 14, color: "var(--c-green)" }}>{success}</p>
          </div>
        )}

        {/* Current plan card */}
        <div className="mi-card mi-card-pad">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-ink3 mb-1" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Plan actual</p>
              <h2 className="font-display text-ink" style={{ fontSize: 22 }}>{currentPlan.name}</h2>
              {isFreePlan ? (
                <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>Sin suscripción activa</p>
              ) : (
                <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
                  US${price(currentPlan)}/mes ·{" "}
                  {org.billing_cycle === "annual" ? "facturado anualmente" : "facturado mensualmente"}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {!isFreePlan && (
                <span className={`mi-badge mi-badge--${status.tone}`} style={{ padding: "4px 10px", fontSize: 12 }}>
                  {status.label}
                </span>
              )}
              {org.current_period_end && !isFreePlan && (
                <p className="text-ink3" style={{ fontSize: 12 }}>
                  Próximo cobro: {formatDate(org.current_period_end)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Plan selection */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-display text-ink" style={{ fontSize: 18 }}>Cambiar plan</h2>
            <div className="mi-seg">
              <button type="button" className={!annual ? "is-on" : ""} onClick={() => setAnnual(false)}>
                Mensual
              </button>
              <button type="button" className={annual ? "is-on" : ""} onClick={() => setAnnual(true)}>
                Anual <span className="mi-badge mi-badge--green" style={{ fontSize: 10, padding: "1px 6px", marginLeft: 4 }}>−20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5 items-stretch">
            {paidPlans.map((plan, idx) => {
              const meta = TIER_META[Math.min(idx, TIER_META.length - 1)];
              const isFeatured = idx === featuredIndex;
              const isCurrent = plan.id === currentPlan.id;

              return (
                <div
                  key={plan.id}
                  className={`mi-card mi-card-pad mi-plan relative ${isFeatured ? "is-featured" : ""}`}
                  style={isCurrent && !isFeatured ? { borderColor: "var(--c-primary)" } : {}}
                >
                  {isCurrent && (
                    <span
                      className="mi-badge mi-badge--green mi-shadow"
                      style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "4px 12px" }}
                    >
                      Plan actual
                    </span>
                  )}
                  {isFeatured && !isCurrent && (
                    <span
                      className="mi-badge mi-badge--green mi-shadow"
                      style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "4px 12px" }}
                    >
                      Recomendado
                    </span>
                  )}

                  <div className="font-display text-ink" style={{ fontSize: 18 }}>{plan.name}</div>
                  <p className="text-ink2 mt-1 mb-4 leading-snug" style={{ fontSize: 13 }}>{meta.desc}</p>

                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-ink" style={{ fontSize: 34 }}>US${price(plan)}</span>
                    <span className="text-ink3" style={{ fontSize: 13 }}>/mes</span>
                  </div>

                  <button
                    type="button"
                    disabled={isCurrent || isPending}
                    onClick={() => handleSelectPlan(plan)}
                    className={`mi-btn mi-btn--block mt-4 ${isFeatured && !isCurrent ? "mi-btn--primary" : "mi-btn--soft"}`}
                  >
                    {isCurrent ? "Plan actual" : `Elegir ${plan.name}`}
                  </button>

                  <hr className="mi-divider my-4" />

                  <ul className="space-y-2">
                    {meta.feats.map((feat) => (
                      <li key={feat} className="mi-feat is-on" style={{ fontSize: 13 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9"/>
                          <path d="m8.5 12 2.5 2.5L16 9"/>
                        </svg>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cancel section — only show if on paid plan */}
        {!isFreePlan && (
          <div
            className="mi-card mi-card-pad"
            style={{ borderColor: "color-mix(in srgb, var(--c-danger) 30%, var(--c-line))" }}
          >
            <h3 className="font-semibold text-ink mb-1" style={{ fontSize: 15 }}>Cancelar suscripción</h3>
            <p className="text-ink2 mb-4" style={{ fontSize: 13 }}>
              Al cancelar, tu cuenta pasará al plan gratuito de inmediato. Esta acción no tiene vuelta atrás.
            </p>
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isPending}
              className="mi-btn mi-btn--soft"
              style={{ color: "var(--c-danger)", borderColor: "color-mix(in srgb, var(--c-danger) 40%, transparent)" }}
            >
              Cancelar suscripción
            </button>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmState.type !== "none" && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)", zIndex: 50 }}
        >
          <div className="mi-card mi-card-pad" style={{ maxWidth: 440, width: "90%", margin: "0 auto" }}>
            {confirmState.type === "cancel" && (
              <>
                <h3 className="font-display text-ink mb-2" style={{ fontSize: 20 }}>¿Cancelar suscripción?</h3>
                <p className="text-ink2 mb-6" style={{ fontSize: 14 }}>
                  Tu cuenta pasará al plan gratuito inmediatamente. Perderás acceso a las funciones del plan{" "}
                  <strong>{currentPlan.name}</strong>.
                </p>
              </>
            )}

            {confirmState.type === "change" && (
              <>
                <h3 className="font-display text-ink mb-2" style={{ fontSize: 20 }}>
                  Cambiar a {confirmState.plan.name}
                </h3>
                {confirmState.requiresCheckout ? (
                  <p className="text-ink2 mb-6" style={{ fontSize: 14 }}>
                    Para activar el plan <strong>{confirmState.plan.name}</strong> (US${price(confirmState.plan)}/mes),
                    necesitás ingresar los datos de tu tarjeta.
                  </p>
                ) : (
                  <p className="text-ink2 mb-6" style={{ fontSize: 14 }}>
                    Tu suscripción se actualizará a <strong>{confirmState.plan.name}</strong> por{" "}
                    US${price(confirmState.plan)}/mes. El cambio se aplica de inmediato.
                  </p>
                )}
              </>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="mi-btn mi-btn--soft"
                onClick={() => setConfirmState({ type: "none" })}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mi-btn mi-btn--primary"
                onClick={handleConfirm}
                disabled={isPending}
              >
                {isPending
                  ? "Procesando…"
                  : confirmState.type === "cancel"
                  ? "Sí, cancelar"
                  : confirmState.type === "change" && confirmState.requiresCheckout
                  ? "Ingresar datos de pago"
                  : "Confirmar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
