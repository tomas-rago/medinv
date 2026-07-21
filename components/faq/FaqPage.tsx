"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const GROUPS: { id: string; items: string[] }[] = [
  {
    id: "inventory",
    items: ["stock_in", "stock_out", "batches_expiry", "min_quantity", "scanner"],
  },
  {
    id: "alerts_purchases",
    items: ["alert_types", "acknowledge_alerts", "purchase_flow", "purchase_reception", "providers"],
  },
  {
    id: "predictive",
    items: ["predictive_how", "reorder_point", "suggested_qty"],
  },
  {
    id: "account",
    items: ["roles_permissions", "ai_assistant", "subscription"],
  },
  {
    id: "contact",
    items: ["create_password", "unlock_user", "contact_email", "pause_subscription", "payment_methods"],
  },
];

export function FaqPage() {
  const t = useTranslations("Faq");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-7"
      style={{ display: "flex", flexDirection: "column", gap: "var(--d-section-gap)" }}
    >
      {/* Page header */}
      <div data-tutorial="page-header" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-ink3 mb-1" style={{ fontSize: 13 }}>
            <span>{t("breadcrumb_account")}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            <span className="text-ink2 font-medium">{t("breadcrumb_faq")}</span>
          </div>
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {t("heading")}
          </h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
          </p>
        </div>
      </div>

      {/* Q&A */}
      <div data-tutorial="main" className="mi-card mi-shadow mi-card-pad" style={{ paddingTop: 8, paddingBottom: 8 }}>
        {GROUPS.map((group) => (
          <div key={group.id}>
            <div className="mi-nav-label mt-6 mb-1" style={{ padding: 0 }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t(`groups.${group.id}` as any)}
            </div>
            {group.items.map((id) => {
              const open = openId === id;
              const panelId = `faq-panel-${id}`;
              return (
                <div key={id} className="mi-faq-item">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenId(open ? null : id)}
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <span>{t(`items.${id}.q` as any)}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {open && (
                    <div id={panelId} className="mi-faq-body mi-fade">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {t(`items.${id}.a` as any)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
