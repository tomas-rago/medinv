"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getPurchaseItems, receivePurchase } from "@/app/(dashboard)/purchases/actions";
import type { PurchaseItemRow, ReceivePurchaseResult } from "@/app/(dashboard)/purchases/actions";

const initialState: ReceivePurchaseResult = { ok: false, errors: {} };

type ReceiveLine = {
  id: string;
  product_name: string;
  ordered: number;
  accepted: string;
  expiry_date: string;
};

interface ReceivePurchaseModalProps {
  purchase: { id: string; provider_name: string | null };
  onClose: () => void;
}

export function ReceivePurchaseModal({ purchase, onClose }: ReceivePurchaseModalProps) {
  const t = useTranslations("Purchases");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(receivePurchase, initialState);
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPurchaseItems(purchase.id).then((items: PurchaseItemRow[]) => {
      if (cancelled) return;
      setLines(
        items.map((i) => ({
          id: i.id,
          product_name: i.product_name,
          ordered: i.quantity,
          accepted: String(i.quantity),
          expiry_date: i.expiry_date ?? "",
        }))
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [purchase.id]);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  function updateLine(id: string, patch: Partial<Pick<ReceiveLine, "accepted" | "expiry_date">>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  const itemsJson = JSON.stringify(
    lines.map((l) => ({
      id: l.id,
      accepted_quantity: l.accepted,
      expiry_date: l.expiry_date,
    }))
  );

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("receive_title")}
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
        <div className="p-5" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <p className="text-ink2 mb-4" style={{ fontSize: 13 }}>
            {t("receive_hint")}
          </p>

          <form id="receive-form" action={action}>
            <input type="hidden" name="purchase_id" value={purchase.id} />
            <input type="hidden" name="items" value={itemsJson} />

            {loading ? (
              <p className="text-ink3" style={{ fontSize: 13 }}>{t("loading")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="mi-table">
                  <thead>
                    <tr>
                      <th>{t("line_product")}</th>
                      <th style={{ width: 90 }}>{t("line_ordered")}</th>
                      <th style={{ width: 110 }}>{t("line_accepted")}</th>
                      <th style={{ width: 160 }}>{t("line_expiry")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const acceptedNum = Number(l.accepted);
                      const differs = !Number.isNaN(acceptedNum) && acceptedNum !== l.ordered;
                      return (
                        <tr key={l.id}>
                          <td>
                            <span className="font-medium text-ink" style={{ fontSize: 14 }}>{l.product_name}</span>
                          </td>
                          <td className="text-ink2" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                            {l.ordered}
                          </td>
                          <td>
                            <input
                              className="mi-input"
                              style={{
                                paddingTop: 6, paddingBottom: 6,
                                ...(differs ? { borderColor: "var(--c-warn)" } : {}),
                              }}
                              type="number"
                              min="0"
                              step="any"
                              aria-label={t("line_accepted")}
                              value={l.accepted}
                              onChange={(e) => updateLine(l.id, { accepted: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              className="mi-input"
                              style={{ paddingTop: 6, paddingBottom: 6 }}
                              type="date"
                              aria-label={t("line_expiry")}
                              value={l.expiry_date}
                              onChange={(e) => updateLine(l.id, { expiry_date: e.target.value })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {state.errors.items?.map((e) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <p key={e} className="mi-field-error mt-2">{tVal(e as any)}</p>
            ))}
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
          <button
            type="submit"
            form="receive-form"
            disabled={isPending || loading || lines.length === 0}
            className="mi-btn mi-btn--primary"
          >
            {isPending ? t("saving") : t("receive_submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
