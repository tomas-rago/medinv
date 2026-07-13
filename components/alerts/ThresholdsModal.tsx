"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateMinQuantity } from "@/app/(dashboard)/alerts/actions";

export type ThresholdRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  min_quantity: number;
};

interface ThresholdsModalProps {
  thresholds: ThresholdRow[];
  onClose: () => void;
}

export function ThresholdsModal({ thresholds, onClose }: ThresholdsModalProps) {
  const t = useTranslations("Alerts");
  const tErr = useTranslations("Errors");

  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(thresholds.map((r) => [r.product_id, String(r.min_quantity)]))
  );
  const [saved, setSaved] = useState<Record<string, number>>(() =>
    Object.fromEntries(thresholds.map((r) => [r.product_id, r.min_quantity]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const filtered = search.trim()
    ? thresholds.filter((r) => r.product_name.toLowerCase().includes(search.trim().toLowerCase()))
    : thresholds;

  async function handleSave(productId: string) {
    const parsed = Number(values[productId]);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setErrorKey("invalid_quantity");
      return;
    }
    setErrorKey(null);
    setSavingId(productId);
    const result = await updateMinQuantity(productId, parsed);
    setSavingId(null);
    if (result.ok) {
      setSaved((prev) => ({ ...prev, [productId]: parsed }));
    } else {
      setErrorKey(result.error ?? "unexpected");
    }
  }

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("thresholds_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {t("thresholds_subtitle")}
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
          <input
            className="mi-input mb-3"
            style={{ paddingTop: 8, paddingBottom: 8 }}
            placeholder={t("thresholds_search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {errorKey && (
            <p className="mi-field-error mb-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {tErr(errorKey as any)}
            </p>
          )}

          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <p className="text-ink3" style={{ fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                {t("thresholds_empty")}
              </p>
            ) : (
              filtered.map((r) => {
                const dirty = Number(values[r.product_id]) !== saved[r.product_id];
                return (
                  <div
                    key={r.product_id}
                    className="flex items-center gap-3 py-2 border-b"
                    style={{ borderColor: "color-mix(in srgb,var(--c-line) 60%,transparent)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-ink font-medium truncate" style={{ fontSize: 14 }}>
                        {r.product_name}
                      </div>
                      <div className="text-ink3" style={{ fontSize: 12 }}>
                        {t("thresholds_on_hand", { quantity: r.quantity })}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="mi-input"
                      style={{ width: 90, paddingTop: 6, paddingBottom: 6, textAlign: "right" }}
                      value={values[r.product_id] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [r.product_id]: e.target.value }))
                      }
                      aria-label={t("thresholds_min_label", { product: r.product_name })}
                    />
                    <button
                      type="button"
                      className="mi-btn mi-btn--soft mi-btn--sm"
                      disabled={!dirty || savingId === r.product_id}
                      onClick={() => handleSave(r.product_id)}
                      style={{ minWidth: 84 }}
                    >
                      {savingId === r.product_id ? t("saving") : t("save")}
                    </button>
                  </div>
                );
              })
            )}
          </div>
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
