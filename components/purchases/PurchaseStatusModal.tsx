"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { confirmPurchase, cancelPurchase } from "@/app/(dashboard)/purchases/actions";

interface PurchaseStatusModalProps {
  purchase: { id: string; provider_name: string | null };
  action: "confirm" | "cancel";
  onClose: () => void;
}

export function PurchaseStatusModal({ purchase, action, onClose }: PurchaseStatusModalProps) {
  const t = useTranslations("Purchases");
  const tErr = useTranslations("Errors");
  const [isPending, setIsPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const isCancel = action === "cancel";

  const handleSubmit = async () => {
    setIsPending(true);
    setErrorKey(null);
    const result = isCancel
      ? await cancelPurchase(purchase.id)
      : await confirmPurchase(purchase.id);
    setIsPending(false);
    if (result.ok) {
      onClose();
    } else {
      setErrorKey(result.error ?? "unexpected");
    }
  };

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
            >
              {isCancel ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/><path d="m8 8 8 8M16 8l-8 8"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>
                </svg>
              )}
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {isCancel ? t("cancel_title") : t("confirm_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {purchase.provider_name ?? t("no_provider")}
              </div>
            </div>
          </div>
          <button className="mi-iconbtn" onClick={onClose} aria-label={t("close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-ink2" style={{ fontSize: 14 }}>
            {isCancel ? t("cancel_confirm") : t("confirm_confirm")}
          </p>
          {isCancel && (
            <p className="text-ink3 mt-2" style={{ fontSize: 13 }}>
              {t("cancel_warning")}
            </p>
          )}

          {errorKey && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <p className="mi-field-error mt-4">{tErr(errorKey as any)}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
            {t("back")}
          </button>
          <button
            type="button"
            disabled={isPending}
            className="mi-btn"
            style={
              isCancel
                ? { background: "var(--c-danger)", color: "#fff" }
                : { background: "var(--c-primary)", color: "#fff" }
            }
            onClick={handleSubmit}
          >
            {isPending ? t("saving") : isCancel ? t("cancel_submit") : t("confirm_submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
