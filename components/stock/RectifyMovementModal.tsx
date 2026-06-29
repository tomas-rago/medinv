"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { rectifyStockMovement } from "@/app/(dashboard)/stock/actions";
import type { RectifyResult } from "@/app/(dashboard)/stock/actions";

const initialState: RectifyResult = { ok: false, errors: {} };

export type RectifiableMovement = {
  id: string;
  type: string;
  quantity: number;
  expiry_date: string | null;
  product_name: string;
};

interface RectifyMovementModalProps {
  movement: RectifiableMovement;
  onClose: () => void;
}

export function RectifyMovementModal({ movement, onClose }: RectifyMovementModalProps) {
  const t = useTranslations("Stock");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(rectifyStockMovement, initialState);
  const [nullify, setNullify] = useState(false);

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
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("rectify_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {movement.product_name} · {t.has(`type_${movement.type}`) ? t(`type_${movement.type}`) : movement.type}
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
          <p className="text-ink2" style={{ fontSize: 13, marginBottom: 12 }}>
            {t("rectify_help")}
          </p>

          <form id="rectify-form" action={action}>
            <input type="hidden" name="movement_id" value={movement.id} />

            {/* "b" flow — null the movement out */}
            <label className="flex items-center gap-2" style={{ cursor: "pointer", marginBottom: 4 }}>
              <input
                type="checkbox"
                name="nullify"
                checked={nullify}
                onChange={(e) => setNullify(e.target.checked)}
              />
              <span className="text-ink" style={{ fontSize: 14, fontWeight: 600 }}>{t("rectify_nullify_label")}</span>
            </label>
            <p className="text-ink3" style={{ fontSize: 12, marginBottom: 12 }}>{t("rectify_nullify_hint")}</p>

            {/* "a" flow — correct quantity and/or expiry */}
            <div className="mi-field">
              <label htmlFor="rec-qty" className="mi-label">{t("rectify_new_quantity")}</label>
              <input
                id="rec-qty"
                name="quantity"
                type="number"
                min="0"
                step="any"
                className="mi-input"
                defaultValue={movement.quantity}
                disabled={nullify}
                autoComplete="off"
              />
              {state.errors.quantity?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="rec-expiry" className="mi-label">{t("rectify_new_expiry")}</label>
              <input
                id="rec-expiry"
                name="expiry_date"
                type="date"
                className="mi-input"
                defaultValue={movement.expiry_date ?? ""}
                disabled={nullify}
              />
            </div>

            <div className="mi-field">
              <label htmlFor="rec-reason" className="mi-label">{t("rectify_reason")}</label>
              <input id="rec-reason" name="reason" className="mi-input" placeholder={t("rectify_reason_placeholder")} autoComplete="off" />
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
          <button type="submit" form="rectify-form" disabled={isPending} className="mi-btn mi-btn--primary">
            {isPending ? t("saving") : t("rectify_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
