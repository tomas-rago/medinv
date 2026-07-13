"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { updateReceptor } from "@/app/(dashboard)/receptors/actions";
import type { UpdateReceptorResult } from "@/app/(dashboard)/receptors/actions";
import { RECEPTOR_PATIENT_TYPES } from "@/lib/constants/receptor-types";

const initialState: UpdateReceptorResult = { ok: false, errors: {} };

export type EditableReceptor = {
  id: string;
  name: string;
  external_id: string | null;
  patient_type: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

interface EditReceptorModalProps {
  receptor: EditableReceptor;
  onClose: () => void;
}

export function EditReceptorModal({ receptor, onClose }: EditReceptorModalProps) {
  const t = useTranslations("Receptors");
  const tPT = useTranslations("PatientTypes");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(updateReceptor, initialState);

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
          <form id="edit-receptor-form" action={action}>
            <input type="hidden" name="id" value={receptor.id} />

            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="ercp-name" className="mi-label">{t("field_name")}</label>
              <input id="ercp-name" name="name" className="mi-input" defaultValue={receptor.name} autoComplete="off" />
              {state.errors.name?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="ercp-external" className="mi-label">{t("field_external_id")}</label>
              <input id="ercp-external" name="external_id" className="mi-input" defaultValue={receptor.external_id ?? ""} autoComplete="off" />
              {state.errors.external_id?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="ercp-type" className="mi-label">{t("field_patient_type")}</label>
              <select id="ercp-type" name="patient_type" className="mi-input" defaultValue={receptor.patient_type ?? ""}>
                <option value="">{t("field_patient_type_none")}</option>
                {RECEPTOR_PATIENT_TYPES.map((pt) => (
                  <option key={pt} value={pt}>{tPT(pt)}</option>
                ))}
              </select>
              {state.errors.patient_type?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="ercp-phone" className="mi-label">{t("field_phone")}</label>
              <input id="ercp-phone" name="phone" className="mi-input" inputMode="tel" defaultValue={receptor.phone ?? ""} autoComplete="off" />
            </div>

            <div className="mi-field">
              <label htmlFor="ercp-email" className="mi-label">{t("field_email")}</label>
              <input id="ercp-email" name="email" className="mi-input" inputMode="email" defaultValue={receptor.email ?? ""} autoComplete="off" />
              {state.errors.email?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="ercp-notes" className="mi-label">{t("field_notes")}</label>
              <input id="ercp-notes" name="notes" className="mi-input" defaultValue={receptor.notes ?? ""} autoComplete="off" />
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
          <button type="submit" form="edit-receptor-form" disabled={isPending} className="mi-btn mi-btn--primary">
            {isPending ? t("saving") : t("save_changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
