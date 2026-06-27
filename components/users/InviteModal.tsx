"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { inviteUser } from "@/app/(dashboard)/users/actions";
import type { InviteResult } from "@/app/(dashboard)/users/actions";

const initialState: InviteResult = { ok: false, errors: {} };

interface InviteModalProps {
  onClose: () => void;
}

export function InviteModal({ onClose }: InviteModalProps) {
  const t = useTranslations("InviteModal");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");
  const [state, action, isPending] = useActionState(inviteUser, initialState);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const ROLE_OPTIONS = [
    { value: "operator", label: t("role_operator") },
    { value: "read_only", label: t("role_read_only") },
  ];

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
                <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {t("subtitle")}
              </div>
            </div>
          </div>
          <button
            className="mi-iconbtn"
            onClick={onClose}
            aria-label={t("close")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <form id="invite-form" action={action}>
            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="inv-email" className="mi-label">{t("email")}</label>
              <div className="mi-input-group">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>
                </svg>
                <input
                  id="inv-email"
                  name="email"
                  type="email"
                  className="mi-input"
                  placeholder={t("email_placeholder")}
                  autoComplete="off"
                />
              </div>
              {state.errors.email?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="inv-role" className="mi-label">{t("role")}</label>
              <select id="inv-role" name="role" className="mi-input">
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {state.errors.role?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            {state.errors._form && (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <p className="mi-field-error mt-3">{tErr(state.errors._form[0] as any)}</p>
            )}

            <div
              className="flex items-start gap-2 mt-4 p-3 rounded-xl"
              style={{ background: "var(--c-surface-2)", fontSize: 12, color: "var(--c-ink-2)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 3l8 3v6c0 4.5-3.2 7.5-8 9-4.8-1.5-8-4.5-8-9V6z"/>
              </svg>
              {t("role_hint")}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="submit"
            form="invite-form"
            disabled={isPending}
            className="mi-btn mi-btn--primary"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>
            </svg>
            {isPending ? t("submitting") : t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
