"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getPurchaseItems } from "@/app/(dashboard)/purchases/actions";
import type { PurchaseItemRow } from "@/app/(dashboard)/purchases/actions";

interface PurchaseDetailModalProps {
  purchase: {
    id: string;
    provider_name: string | null;
    status: "draft" | "confirmed" | "received" | "cancelled";
    notes: string | null;
    created_at: string;
    received_at: string | null;
  };
  onClose: () => void;
}

export function PurchaseDetailModal({ purchase, onClose }: PurchaseDetailModalProps) {
  const t = useTranslations("Purchases");

  const [items, setItems] = useState<PurchaseItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPurchaseItems(purchase.id).then((rows) => {
      if (!cancelled) {
        setItems(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [purchase.id]);

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatMoney(value: number) {
    return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
  }

  const isReconciled = purchase.status === "received";

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
                <circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2.2l2.1 12.4a1.5 1.5 0 0 0 1.5 1.2h8.8a1.5 1.5 0 0 0 1.5-1.2L21 7H5.3"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("detail_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {purchase.provider_name ?? t("no_provider")} · {formatDate(purchase.created_at)} · {t(`status_${purchase.status}`)}
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
          {loading ? (
            <p className="text-ink3" style={{ fontSize: 13 }}>{t("loading")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="mi-table">
                <thead>
                  <tr>
                    <th>{t("line_product")}</th>
                    <th style={{ width: 90 }}>{t("line_ordered")}</th>
                    {isReconciled && <th style={{ width: 90 }}>{t("line_accepted")}</th>}
                    <th style={{ width: 120 }}>{t("line_unit_price")}</th>
                    <th style={{ width: 120 }}>{t("line_expiry")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const differs = i.accepted_quantity !== null && i.accepted_quantity !== i.quantity;
                    return (
                      <tr key={i.id}>
                        <td>
                          <span className="font-medium text-ink" style={{ fontSize: 14 }}>{i.product_name}</span>
                        </td>
                        <td className="text-ink2" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                          {i.quantity}
                        </td>
                        {isReconciled && (
                          <td
                            style={{
                              fontSize: 13,
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: differs ? 600 : undefined,
                              color: differs ? "var(--c-warn)" : "var(--c-ink-2)",
                            }}
                          >
                            {i.accepted_quantity ?? "—"}
                          </td>
                        )}
                        <td className="text-ink2" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                          {i.unit_price !== null ? formatMoney(i.unit_price) : "—"}
                        </td>
                        <td className="text-ink3" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                          {i.expiry_date ? formatDate(i.expiry_date) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {purchase.notes && (
            <p className="text-ink2 mt-4" style={{ fontSize: 13 }}>
              <span className="text-ink3">{t("field_notes")}:</span> {purchase.notes}
            </p>
          )}
          {purchase.received_at && (
            <p className="text-ink3 mt-2" style={{ fontSize: 13 }}>
              {t("received_on", { date: formatDate(purchase.received_at) })}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
