"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

type ConfirmState =
  | { type: "none" }
  | { type: "change"; plan: Plan; billingCycle: "monthly" | "annual"; requiresCheckout: boolean }
  | { type: "cancel" };

export function SuscripcionPage({ org, currentPlan, plans }: Props) {
  const t = useTranslations("Subscription");
  const [confirmState, setConfirmState] = useState<ConfirmState>({ type: "none" });
  const [annual, setAnnual] = useState(org.billing_cycle === "annual");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isFreePlan = !org.mp_subscription_id || currentPlan.monthly_price === 0;

  const STATUS_MAP: Record<string, { tone: string; key: string }> = {
    active:    { tone: "green",  key: "status_active" },
    past_due:  { tone: "amber",  key: "status_past_due" },
    cancelled: { tone: "danger", key: "status_cancelled" },
    pending:   { tone: "gray",   key: "status_pending" },
  };
  const statusEntry = STATUS_MAP[org.subscription_status] ?? { tone: "gray", key: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusLabel = statusEntry.key ? t(statusEntry.key as any) : org.subscription_status;

  const TIER_META: { desc: string; feats: string[] }[] = [
    {
      desc: t("tier_0_desc"),
      feats: [t("tier_0_feat_0"), t("tier_0_feat_1"), t("tier_0_feat_2")],
    },
    {
      desc: t("tier_1_desc"),
      feats: [t("tier_1_feat_0"), t("tier_1_feat_1"), t("tier_1_feat_2"), t("tier_1_feat_3")],
    },
    {
      desc: t("tier_2_desc"),
      feats: [t("tier_2_feat_0"), t("tier_2_feat_1"), t("tier_2_feat_2"), t("tier_2_feat_3"), t("tier_2_feat_4")],
    },
  ];

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
      const freePlan = plans.find((p) => p.monthly_price === 0);
      if (!freePlan) {
        setError(t("error_free_plan_not_found"));
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
          setError(t("error_cancel"));
        } else {
          setSuccess(t("success_cancelled"));
          window.location.reload();
        }
        setConfirmState({ type: "none" });
      });
      return;
    }

    if (confirmState.type === "change") {
      const { plan, billingCycle, requiresCheckout } = confirmState;

      if (requiresCheckout) {
        startTransition(async () => {
          await initiateUpgrade(plan.id, billingCycle);
        });
        return;
      }

      startTransition(async () => {
        const res = await fetch("/api/mp/subscription/change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPlanId: plan.id, billingCycle }),
        });
        const data = await res.json() as { ok: boolean; error?: string };
        if (!data.ok) {
          setError(t("error_change"));
        } else {
          setSuccess(t("success_plan_updated", { name: plan.name }));
          window.location.reload();
        }
        setConfirmState({ type: "none" });
      });
    }
  }

  const paidPlans = plans.filter((p) => p.monthly_price > 0);
  const featuredIndex = Math.floor(paidPlans.length / 2);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="font-display text-ink" style={{ fontSize: 26 }}>{t("heading")}</h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
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
              <p className="text-ink3 mb-1" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t("current_plan_label")}
              </p>
              <h2 className="font-display text-ink" style={{ fontSize: 22 }}>{currentPlan.name}</h2>
              {isFreePlan ? (
                <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>{t("no_active_subscription")}</p>
              ) : (
                <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
                  ${price(currentPlan)}/mes ·{" "}
                  {org.billing_cycle === "annual" ? t("billed_annually") : t("billed_monthly")}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {!isFreePlan && (
                <span className={`mi-badge mi-badge--${statusEntry.tone}`} style={{ padding: "4px 10px", fontSize: 12 }}>
                  {statusLabel}
                </span>
              )}
              {org.current_period_end && !isFreePlan && (
                <p className="text-ink3" style={{ fontSize: 12 }}>
                  {t("next_billing", { date: formatDate(org.current_period_end) })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Plan selection */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-display text-ink" style={{ fontSize: 18 }}>{t("change_plan")}</h2>
            <div className="mi-seg">
              <button type="button" className={!annual ? "is-on" : ""} onClick={() => setAnnual(false)}>
                {t("billing_monthly")}
              </button>
              <button type="button" className={annual ? "is-on" : ""} onClick={() => setAnnual(true)}>
                {t("billing_annual")} <span className="mi-badge mi-badge--green" style={{ fontSize: 10, padding: "1px 6px", marginLeft: 4 }}>−20%</span>
              </button>
            </div>
          </div>

          <div
            className="grid gap-5 items-stretch mx-auto"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              maxWidth: paidPlans.length === 1 ? 380 : paidPlans.length === 2 ? 720 : undefined,
            }}
          >
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
                      {t("plan_current")}
                    </span>
                  )}
                  {isFeatured && !isCurrent && (
                    <span
                      className="mi-badge mi-badge--green mi-shadow"
                      style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "4px 12px" }}
                    >
                      {t("plan_recommended")}
                    </span>
                  )}

                  <div className="font-display text-ink" style={{ fontSize: 18 }}>{plan.name}</div>
                  <p className="text-ink2 mt-1 mb-4 leading-snug" style={{ fontSize: 13 }}>{meta.desc}</p>

                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-ink" style={{ fontSize: 34 }}>${price(plan)}</span>
                    <span className="text-ink3" style={{ fontSize: 13 }}>{t("price_per_month")}</span>
                  </div>

                  <button
                    type="button"
                    disabled={isCurrent || isPending}
                    onClick={() => handleSelectPlan(plan)}
                    className={`mi-btn mi-btn--block mt-4 ${isFeatured && !isCurrent ? "mi-btn--primary" : "mi-btn--soft"}`}
                  >
                    {isCurrent ? t("plan_current") : t("choose_plan", { name: plan.name })}
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

        {/* Cancel section */}
        {!isFreePlan && (
          <div
            className="mi-card mi-card-pad"
            style={{ borderColor: "color-mix(in srgb, var(--c-danger) 30%, var(--c-line))" }}
          >
            <h3 className="font-semibold text-ink mb-1" style={{ fontSize: 15 }}>{t("cancel_title")}</h3>
            <p className="text-ink2 mb-4" style={{ fontSize: 13 }}>
              {t("cancel_body")}
            </p>
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isPending}
              className="mi-btn mi-btn--soft"
              style={{ color: "var(--c-danger)", borderColor: "color-mix(in srgb, var(--c-danger) 40%, transparent)" }}
            >
              {t("cancel_button")}
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
                <h3 className="font-display text-ink mb-2" style={{ fontSize: 20 }}>{t("confirm_cancel_title")}</h3>
                <p className="text-ink2 mb-6" style={{ fontSize: 14 }}>
                  {t("confirm_cancel_body_prefix")}{" "}
                  <strong>{currentPlan.name}</strong>.
                </p>
              </>
            )}

            {confirmState.type === "change" && (
              <>
                <h3 className="font-display text-ink mb-2" style={{ fontSize: 20 }}>
                  {t("confirm_change_title", { name: confirmState.plan.name })}
                </h3>
                {confirmState.requiresCheckout ? (
                  <p className="text-ink2 mb-6" style={{ fontSize: 14 }}>
                    {t("confirm_change_checkout_prefix")}{" "}
                    <strong>{confirmState.plan.name}</strong>{" "}
                    (${price(confirmState.plan)}/mes),{" "}
                    {t("confirm_change_checkout_suffix")}
                  </p>
                ) : (
                  <p className="text-ink2 mb-6" style={{ fontSize: 14 }}>
                    {t("confirm_change_body_prefix")}{" "}
                    <strong>{confirmState.plan.name}</strong>{" "}
                    {t("price_per_month", { count: price(confirmState.plan) })}.{" "}
                    {t("confirm_change_body_suffix")}
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
                {t("cancel_action")}
              </button>
              <button
                type="button"
                className="mi-btn mi-btn--primary"
                onClick={handleConfirm}
                disabled={isPending}
              >
                {isPending
                  ? t("processing")
                  : confirmState.type === "cancel"
                  ? t("confirm_cancel_action")
                  : confirmState.type === "change" && confirmState.requiresCheckout
                  ? t("confirm_checkout")
                  : t("confirm_change")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
