"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createProvider } from "@/app/(dashboard)/providers/actions";
import type { CreateProviderResult, ProviderRow } from "@/app/(dashboard)/providers/actions";

const initialState: CreateProviderResult = { ok: false, errors: {} };

interface ProviderModalProps {
  onClose: () => void;
  onCreated?: (provider: ProviderRow) => void;
}

export function ProviderModal({ onClose, onCreated }: ProviderModalProps) {
  const t = useTranslations("Providers");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(createProvider, initialState);

  useEffect(() => {
    if (state.ok && state.provider) {
      onCreated?.(state.provider);
      onClose();
    }
  }, [state.ok, state.provider, onCreated, onClose]);

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21V8l6-5 6 5v13"/><path d="M9 21v-6h6v6"/><path d="M15 10h6v11"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("modal_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {t("modal_subtitle")}
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
        <div className="p-5" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <form id="provider-form" action={action}>
            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="prov-name" className="mi-label">{t("field_name")}</label>
              <input id="prov-name" name="name" className="mi-input" placeholder={t("field_name_placeholder")} autoComplete="off" autoFocus />
              {state.errors.name?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="prov-contact" className="mi-label">{t("field_contact")}</label>
              <input id="prov-contact" name="contact_name" className="mi-input" placeholder={t("field_contact_placeholder")} autoComplete="off" />
            </div>

            <div className="mi-field">
              <label htmlFor="prov-email" className="mi-label">{t("field_email")}</label>
              <input id="prov-email" name="email" className="mi-input" inputMode="email" placeholder={t("field_email_placeholder")} autoComplete="off" />
              {state.errors.email?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="prov-phone" className="mi-label">{t("field_phone")}</label>
              <input id="prov-phone" name="phone" className="mi-input" inputMode="tel" placeholder={t("field_phone_placeholder")} autoComplete="off" />
            </div>

            <div className="mi-field">
              <label htmlFor="prov-address" className="mi-label">{t("field_address")}</label>
              <input id="prov-address" name="address" className="mi-input" placeholder={t("field_address_placeholder")} autoComplete="off" />
            </div>

            <div className="mi-field">
              <label htmlFor="prov-notes" className="mi-label">{t("field_notes")}</label>
              <input id="prov-notes" name="notes" className="mi-input" placeholder={t("field_notes_placeholder")} autoComplete="off" />
            </div>

            {state.errors._form && (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <p className="mi-field-error mt-3">{tErr(state.errors._form[0] as any)}</p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="provider-form" disabled={isPending} className="mi-btn mi-btn--primary">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {isPending ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
