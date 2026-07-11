"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PredictionRow, PredictiveSettingsRow } from "@/lib/predictive/data";
import type { ProductCriticality } from "@/lib/constants/criticality";
import { PredictiveSettingsModal } from "./PredictiveSettingsModal";

const CRITICALITY_BADGE: Record<ProductCriticality, string> = {
  vital: "mi-badge--danger",
  essential: "mi-badge--amber",
  desirable: "mi-badge--gray",
};

interface PredictivePageProps {
  rows: PredictionRow[];
  settings: PredictiveSettingsRow | null;
  canManage: boolean;
}

function fmtQty(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export function PredictivePage({ rows, settings, canManage }: PredictivePageProps) {
  const t = useTranslations("Predictive");
  const tCrit = useTranslations("Criticality");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div
      className="flex-1 overflow-y-auto px-7 py-7"
      style={{ display: "flex", flexDirection: "column", gap: "var(--d-section-gap)" }}
    >
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-ink3 mb-1" style={{ fontSize: 13 }}>
            <span>{t("breadcrumb_operation")}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            <span className="text-ink2 font-medium">{t("breadcrumb_predictive")}</span>
          </div>
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {t("heading")}
          </h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
          </p>
        </div>
        {canManage && (
          <button className="mi-btn mi-btn--primary" onClick={() => setShowSettings(true)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"/>
            </svg>
            {t("settings_button")}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mi-card mi-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="mi-table">
            <thead>
              <tr>
                <th>{t("table_product")}</th>
                <th>{t("table_stock")}</th>
                <th>{t("table_demand")}</th>
                <th>{t("table_reorder_point")}</th>
                <th>{t("table_suggestion")}</th>
                <th>{t("table_suggested_qty")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-ink3" style={{ textAlign: "center", padding: "32px 0" }}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const p = r.prediction;
                  const noData = p.method === "insufficient_data";
                  return (
                    <tr key={r.product_id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/predictive/${r.product_id}`}
                            className="font-semibold text-ink hover:underline"
                          >
                            {r.product_name}
                          </Link>
                          {r.criticality && (
                            <span className={`mi-badge ${CRITICALITY_BADGE[r.criticality]}`}>
                              {tCrit(r.criticality)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-ink2">{fmtQty(r.current_stock)}</td>
                      <td>
                        {noData || p.dailyDemand === null ? (
                          <span className="mi-badge mi-badge--gray">{t("method_insufficient")}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-ink2">{t("demand_per_day", { quantity: fmtQty(p.dailyDemand) })}</span>
                            <span
                              className="mi-badge mi-badge--blue"
                              title={p.method === "regression" ? t("method_regression_hint") : t("method_average_hint")}
                            >
                              {p.method === "regression" ? t("method_regression") : t("method_average")}
                            </span>
                            {p.method === "regression" && p.trendPerDay !== null && Math.abs(p.trendPerDay) >= 0.01 && (
                              <span
                                className="text-ink3"
                                title={t(p.trendPerDay > 0 ? "trend_up" : "trend_down")}
                                style={{ fontSize: 13 }}
                              >
                                {p.trendPerDay > 0 ? "↗" : "↘"}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-ink2">{p.reorderPoint !== null ? fmtQty(p.reorderPoint) : "—"}</td>
                      <td>
                        {noData ? (
                          <span className="text-ink3" style={{ fontSize: 13 }}>{t("suggestion_no_data")}</span>
                        ) : p.dailyDemand === 0 ? (
                          <span className="text-ink3" style={{ fontSize: 13 }}>{t("suggestion_no_demand")}</span>
                        ) : p.daysUntilReorder === 0 ? (
                          <span className="mi-badge mi-badge--danger">{t("suggestion_order_now")}</span>
                        ) : p.daysUntilReorder !== null ? (
                          <span className="text-ink2" style={{ fontSize: 13 }}>
                            {t("suggestion_order_in", { days: p.daysUntilReorder })}
                          </span>
                        ) : (
                          <span className="text-ink3">—</span>
                        )}
                      </td>
                      {/* Coverage-target quantity, shown only once the
                          reorder point is reached — earlier it would invite
                          over-ordering. */}
                      <td>
                        {p.daysUntilReorder === 0 &&
                        p.suggestedQuantity !== null &&
                        p.suggestedQuantity > 0 ? (
                          <span className="text-ink font-medium">
                            {t("suggested_units", { quantity: fmtQty(p.suggestedQuantity) })}
                          </span>
                        ) : (
                          <span className="text-ink3" title={t("suggested_qty_hint")}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSettings && (
        <PredictiveSettingsModal settings={settings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
