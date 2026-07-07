"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { updateProvider } from "@/app/(dashboard)/providers/actions";
import type { UpdateProviderResult } from "@/app/(dashboard)/providers/actions";

const initialState: UpdateProviderResult = { ok: false, errors: {} };

export type EditableProvider = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

interface EditProviderModalProps {
  provider: EditableProvider;
  onClose: () => void;
}

export function EditProviderModal({ provider, onClose }: EditProviderModalProps) {
  const t = useTranslations("Providers");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(updateProvider, initialState);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

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
                <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("edit_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {t("edit_subtitle")}
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
          <form id="edit-provider-form" action={action}>
            <input type="hidden" name="id" value={provider.id} />

            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="eprov-name" className="mi-label">{t("field_name")}</label>
              <input id="eprov-name" name="name" className="mi-input" defaultValue={provider.name} autoComplete="off" />
              {state.errors.name?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="eprov-contact" className="mi-label">{t("field_contact")}</label>
              <input id="eprov-contact" name="contact_name" className="mi-input" defaultValue={provider.contact_name ?? ""} autoComplete="off" />
            </div>

            <div className="mi-field">
              <label htmlFor="eprov-email" className="mi-label">{t("field_email")}</label>
              <input id="eprov-email" name="email" className="mi-input" inputMode="email" defaultValue={provider.email ?? ""} autoComplete="off" />
              {state.errors.email?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="eprov-phone" className="mi-label">{t("field_phone")}</label>
              <input id="eprov-phone" name="phone" className="mi-input" inputMode="tel" defaultValue={provider.phone ?? ""} autoComplete="off" />
            </div>

            <div className="mi-field">
              <label htmlFor="eprov-address" className="mi-label">{t("field_address")}</label>
              <input id="eprov-address" name="address" className="mi-input" defaultValue={provider.address ?? ""} autoComplete="off" />
            </div>

            <div className="mi-field">
              <label htmlFor="eprov-notes" className="mi-label">{t("field_notes")}</label>
              <input id="eprov-notes" name="notes" className="mi-input" defaultValue={provider.notes ?? ""} autoComplete="off" />
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
          <button type="submit" form="edit-provider-form" disabled={isPending} className="mi-btn mi-btn--primary">
            {isPending ? t("saving") : t("save_changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
