"use client";

import { useActionState, useState } from "react";
import { completeOnboarding } from "@/app/(auth)/onboarding/actions";
import type { OnboardingResult } from "@/app/(auth)/onboarding/actions";
import { Logo } from "@/components/ui/Logo";
import { IconSprite } from "@/components/ui/Icons";
import { Stepper } from "@/components/ui/Stepper";

type Plan = {
  id: string;
  name: string;
  monthly_price: number;
  user_limit: number;
  token_limit_per_month: number;
};

// Feature lists keyed by tier position (0 = cheapest, 1 = mid, 2 = top)
const TIER_META: { desc: string; feats: [boolean, string][] }[] = [
  {
    desc: "Para farmacias que recién arrancan.",
    feats: [
      [true, "Inventario y control de stock"],
      [true, "Compras y seguimiento de pedidos"],
      [true, "Alertas de stock y vencimiento"],
      [false, "Asistente IA (chatbot)"],
      [false, "Sugerencias predictivas de compra"],
    ],
  },
  {
    desc: "Para equipos que crecen y quieren IA.",
    feats: [
      [true, "Todo lo del plan anterior"],
      [true, "Asistente IA — chatbot integrado"],
      [true, "Asistente contextual en línea"],
      [true, "Sugerencias predictivas de compra"],
      [true, "Reportes y exportación"],
    ],
  },
  {
    desc: "Para cadenas y multi-sucursal.",
    feats: [
      [true, "Todo lo del plan anterior"],
      [true, "Usuarios ilimitados"],
      [true, "Multi-sucursal centralizado"],
      [true, "Soporte prioritario 24/7"],
      [true, "Acceso a la API"],
      [true, "Onboarding dedicado"],
    ],
  },
];

const ANNUAL_DISCOUNT = 0.8;

const initialState: OnboardingResult = { ok: false, errors: {} };

export function Onboarding({ plans }: { plans: Plan[] }) {
  const [state, action, isPending] = useActionState(completeOnboarding, initialState);
  const [annual, setAnnual] = useState(false);
  // Default to the middle plan (index 1), fall back to first if only one plan exists
  const defaultPlan = plans[Math.min(1, plans.length - 1)]?.id ?? "";
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);

  const price = (p: Plan) =>
    annual ? Math.round(p.monthly_price * ANNUAL_DISCOUNT) : p.monthly_price;

  // Middle tier is "featured/recommended"
  const featuredIndex = Math.floor(plans.length / 2);

  return (
    <>
      <IconSprite />
      <div className="min-h-screen flex flex-col" style={{ background: "var(--c-page)" }}>
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-7 border-b"
          style={{ height: 68, background: "var(--c-surface)", borderColor: "var(--c-line)" }}
        >
          <Logo size="sm" />
          <Stepper step={1} />
          <span style={{ width: 80 }} />
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-12">
          <div className="max-w-5xl mx-auto">
            {/* Heading */}
            <div className="text-center mx-auto" style={{ maxWidth: 560 }}>
              <h1 className="font-display text-ink leading-tight" style={{ fontSize: 34 }}>
                Elegí el plan para tu institución
              </h1>
              <p className="text-ink2 mt-3" style={{ fontSize: 15 }}>
                Todos los planes incluyen inventario, compras y gestión de personal. El{" "}
                <b className="text-ink">Asistente IA</b> se desbloquea desde el plan intermedio.
              </p>

              <div className="mt-6 flex items-center justify-center gap-3">
                <div className="mi-seg">
                  <button type="button" className={!annual ? "is-on" : ""} onClick={() => setAnnual(false)}>
                    Mensual
                  </button>
                  <button type="button" className={annual ? "is-on" : ""} onClick={() => setAnnual(true)}>
                    Anual
                  </button>
                </div>
                <span className="mi-badge mi-badge--green">2 meses gratis</span>
              </div>
            </div>

            {/* Org name field */}
            <div className="mt-10 mx-auto" style={{ maxWidth: 440 }}>
              <label htmlFor="orgName" className="mi-label">
                Nombre de tu institución
              </label>
              <form id="onboarding-form" action={action}>
                <input type="hidden" name="planId" value={selectedPlan} />
                <input type="hidden" name="billingCycle" value={annual ? "annual" : "monthly"} />
                <input
                  id="orgName"
                  name="orgName"
                  className="mi-input"
                  placeholder="Farmacia Central"
                />
                {state.errors.orgName?.map((e) => (
                  <p key={e} className="mi-field-error">{e}</p>
                ))}
                {state.errors._form?.map((e) => (
                  <p key={e} className="mi-field-error mt-2">{e}</p>
                ))}
              </form>
            </div>

            {/* Plan cards */}
            <div className="grid md:grid-cols-3 gap-5 mt-8 items-stretch">
              {plans.map((plan, idx) => {
                const meta = TIER_META[Math.min(idx, TIER_META.length - 1)];
                const isFeatured = idx === featuredIndex;
                const isSelected = selectedPlan === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={`mi-card mi-card-pad mi-plan relative ${isFeatured ? "is-featured" : ""}`}
                    style={isSelected && !isFeatured ? { borderColor: "var(--c-primary)" } : {}}
                  >
                    {isFeatured && (
                      <span
                        className="mi-badge mi-badge--green mi-shadow"
                        style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "4px 12px" }}
                      >
                        Recomendado
                      </span>
                    )}

                    <div className="font-display text-ink" style={{ fontSize: 20 }}>
                      {plan.name}
                    </div>
                    <p className="text-ink2 mt-1 mb-4 leading-snug" style={{ fontSize: 13, minHeight: 36 }}>
                      {meta.desc}
                    </p>

                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-ink" style={{ fontSize: 40 }}>
                        US${price(plan)}
                      </span>
                      <span className="text-ink3" style={{ fontSize: 14 }}>/ mes</span>
                    </div>
                    <p className="text-ink3 mt-1" style={{ fontSize: 12, height: 16 }}>
                      {annual ? "facturado anualmente" : "facturado mensualmente"}
                    </p>

                    <button
                      type="submit"
                      form="onboarding-form"
                      disabled={isPending}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`mi-btn mi-btn--block mt-5 ${isFeatured ? "mi-btn--primary" : "mi-btn--soft"}`}
                    >
                      {isPending && isSelected ? "Continuando…" : `Elegir ${plan.name}`}
                    </button>

                    <hr className="mi-divider my-5" />

                    <ul className="space-y-2 flex-1">
                      {meta.feats.map(([on, text]) => (
                        <li key={text} className={`mi-feat ${on ? "is-on" : "is-off"}`}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {on ? (
                              <><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5L16 9"/></>
                            ) : (
                              <path d="M6 6l12 12M18 6 6 18"/>
                            )}
                          </svg>
                          <span>{text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-ink3 mt-8" style={{ fontSize: 13 }}>
              Precios por institución en USD. Cancelás cuando querés.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
