"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toggleReceptorActive } from "@/app/(dashboard)/receptors/actions";

type ToggleableReceptor = {
  id: string;
  name: string;
  active: boolean;
};

interface ReceptorActiveModalProps {
  receptor: ToggleableReceptor;
  onClose: () => void;
}

export function ReceptorActiveModal({ receptor, onClose }: ReceptorActiveModalProps) {
  const t = useTranslations("Receptors");
  const tErr = useTranslations("Errors");
  const [isPending, setIsPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleToggle = async () => {
    setIsPending(true);
    setErrorKey(null);
    const result = await toggleReceptorActive(receptor.id, !receptor.active);
    setIsPending(false);
    if (result.ok) {
      onClose();
    } else {
      setErrorKey(result.error ?? "unexpected");
    }
  };

  const actionLabel = receptor.active ? t("deactivate") : t("activate");

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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {receptor.active ? t("deactivate_title") : t("activate_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {receptor.name}
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
          <div className="flex items-center gap-2 mb-3">
            <span className="text-ink2" style={{ fontSize: 14 }}>{t("current_status")}</span>
            <span
              className="inline-flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 600, color: receptor.active ? "var(--c-ok)" : "var(--c-ink-3)" }}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: receptor.active ? "var(--c-ok)" : "var(--c-ink-3)",
                  flexShrink: 0,
                }}
              />
              {receptor.active ? t("status_active") : t("status_inactive")}
            </span>
          </div>

          <p className="text-ink2" style={{ fontSize: 14 }}>
            {receptor.active ? t("deactivate_confirm") : t("activate_confirm")}{" "}
            <b className="text-ink">{receptor.name}</b>?
            {receptor.active && (
              <span className="text-ink3" style={{ display: "block", marginTop: 6, fontSize: 13 }}>
                {t("deactivate_warning")}
              </span>
            )}
          </p>

          {errorKey && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <p className="mi-field-error mt-4">{tErr(errorKey as any)}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={isPending}
            className="mi-btn"
            style={
              receptor.active
                ? { background: "var(--c-danger)", color: "#fff" }
                : { background: "var(--c-primary)", color: "#fff" }
            }
            onClick={handleToggle}
          >
            {isPending ? t("saving") : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
