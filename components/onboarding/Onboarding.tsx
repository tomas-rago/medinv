"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
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

const ANNUAL_DISCOUNT = 0.8;

const initialState: OnboardingResult = { ok: false, errors: {} };

export function Onboarding({ plans }: { plans: Plan[] }) {
  const t = useTranslations("Onboarding");
  const tVal = useTranslations("Validation");
  const [state, action, isPending] = useActionState(completeOnboarding, initialState);
  const [annual, setAnnual] = useState(false);
  const defaultPlan = plans[Math.min(1, plans.length - 1)]?.id ?? "";
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);

  const TIER_META: { desc: string; feats: [boolean, string][] }[] = [
    {
      desc: t("tier_0_desc"),
      feats: [
        [true,  t("tier_0_feat_0")],
        [true,  t("tier_0_feat_1")],
        [true,  t("tier_0_feat_2")],
        [false, t("tier_0_feat_3")],
        [false, t("tier_0_feat_4")],
      ],
    },
    {
      desc: t("tier_1_desc"),
      feats: [
        [true, t("tier_1_feat_0")],
        [true, t("tier_1_feat_1")],
        [true, t("tier_1_feat_2")],
        [true, t("tier_1_feat_3")],
        [true, t("tier_1_feat_4")],
      ],
    },
    {
      desc: t("tier_2_desc"),
      feats: [
        [true, t("tier_2_feat_0")],
        [true, t("tier_2_feat_1")],
        [true, t("tier_2_feat_2")],
        [true, t("tier_2_feat_3")],
        [true, t("tier_2_feat_4")],
        [true, t("tier_2_feat_5")],
      ],
    },
  ];

  const price = (p: Plan) =>
    annual ? Math.round(p.monthly_price * ANNUAL_DISCOUNT) : p.monthly_price;

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
                {t("heading")}
              </h1>
              <p className="text-ink2 mt-3" style={{ fontSize: 15 }}>
                {t("subheading")}
              </p>

              <div className="mt-6 flex items-center justify-center gap-3">
                <div className="mi-seg">
                  <button type="button" className={!annual ? "is-on" : ""} onClick={() => setAnnual(false)}>
                    {t("billing_monthly")}
                  </button>
                  <button type="button" className={annual ? "is-on" : ""} onClick={() => setAnnual(true)}>
                    {t("billing_annual")}
                  </button>
                </div>
                <span className="mi-badge mi-badge--green">{t("free_months_badge")}</span>
              </div>
            </div>

            {/* Org name field */}
            <div className="mt-10 mx-auto" style={{ maxWidth: 440 }}>
              <label htmlFor="orgName" className="mi-label">
                {t("org_name_label")}
              </label>
              <form id="onboarding-form" action={action}>
                <input type="hidden" name="planId" value={selectedPlan} />
                <input type="hidden" name="billingCycle" value={annual ? "annual" : "monthly"} />
                <input
                  id="orgName"
                  name="orgName"
                  className="mi-input"
                  placeholder={t("org_name_placeholder")}
                />
                {state.errors.orgName?.map((e) => (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <p key={e} className="mi-field-error">{tVal(e as any)}</p>
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
                        {t("recommended")}
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
                        ${price(plan)}
                      </span>
                      <span className="text-ink3" style={{ fontSize: 14 }}>{t("price_per_month")}</span>
                    </div>
                    <p className="text-ink3 mt-1" style={{ fontSize: 12, height: 16 }}>
                      {annual ? t("billed_annually") : t("billed_monthly")}
                    </p>

                    <button
                      type="submit"
                      form="onboarding-form"
                      disabled={isPending}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`mi-btn mi-btn--block mt-5 ${isFeatured ? "mi-btn--primary" : "mi-btn--soft"}`}
                    >
                      {isPending && isSelected ? t("continuing") : t("choose_plan", { name: plan.name })}
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
              {t("price_note")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
