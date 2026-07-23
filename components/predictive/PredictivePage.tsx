"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PredictionRow, PredictiveSettingsRow } from "@/lib/predictive/data";
import type { ProductCriticality } from "@/lib/constants/criticality";
import { PredictiveSettingsModal } from "./PredictiveSettingsModal";
import { ExplainButton } from "@/components/asistencia-ia/ExplainButton";
import { InfoTip } from "@/components/ui/InfoTip";
import { Pagination } from "@/components/ui/Pagination";
import { DataCard, DataRow } from "@/components/ui/DataCard";

const CRITICALITY_BADGE: Record<ProductCriticality, string> = {
  vital: "mi-badge--danger",
  essential: "mi-badge--amber",
  desirable: "mi-badge--gray",
};

interface PredictivePageProps {
  rows: PredictionRow[];
  count: number;
  page: number;
  pageSize: number;
  settings: PredictiveSettingsRow | null;
  canManage: boolean;
  aiExplain: boolean;
}

function fmtQty(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// Batch dates are plain YYYY-MM-DD; parse as local midnight so the day does
// not shift backwards in negative-offset timezones.
function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PredictivePage({ rows, count, page, pageSize, settings, canManage, aiExplain }: PredictivePageProps) {
  const t = useTranslations("Predictive");
  const tCrit = useTranslations("Criticality");
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);

  function navigate(next: { page?: number; size?: number }) {
    const params = new URLSearchParams();
    const np = next.page ?? 1;
    const nsize = next.size ?? pageSize;
    if (np > 1) params.set("page", String(np));
    if (nsize !== 20) params.set("size", String(nsize));
    const qs = params.toString();
    router.push(qs ? `/predictive?${qs}` : "/predictive");
  }

  function demandCell(p: PredictionRow["prediction"]) {
    if (p.method === "insufficient_data" || p.dailyDemand === null) {
      return <span className="mi-badge mi-badge--gray">{t("method_insufficient")}</span>;
    }
    return (
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
    );
  }

  function suggestionCell(p: PredictionRow["prediction"]) {
    const noData = p.method === "insufficient_data";
    if (noData) return <span className="text-ink3" style={{ fontSize: 13 }}>{t("suggestion_no_data")}</span>;
    if (p.dailyDemand === 0) return <span className="text-ink3" style={{ fontSize: 13 }}>{t("suggestion_no_demand")}</span>;
    if (p.daysUntilReorder === 0) return <span className="mi-badge mi-badge--danger">{t("suggestion_order_now")}</span>;
    if (p.daysUntilReorder !== null) {
      return <span className="text-ink2" style={{ fontSize: 13 }}>{t("suggestion_order_in", { days: p.daysUntilReorder })}</span>;
    }
    return <span className="text-ink3">—</span>;
  }

  function suggestedQtyCell(p: PredictionRow["prediction"]) {
    // Coverage-target quantity. Always shown so the configured coverage days
    // are legible, but muted until the reorder point is reached — at which
    // point it becomes the number to act on.
    //
    // A zero is an answer ("you are already covered"), not a gap, so it reads
    // differently from the dash, which means there is no demand estimate to
    // compute from — that case the Sugerencia column spells out.
    if (p.suggestedQuantity === null) return <span className="text-ink3">—</span>;
    if (p.suggestedQuantity === 0) {
      return (
        <span className="text-ink3" title={t("suggested_qty_covered")}>
          {t("suggested_units", { quantity: 0 })}
        </span>
      );
    }
    const due = p.daysUntilReorder === 0;
    return (
      <span
        className={due ? "text-ink font-medium" : "text-ink3"}
        title={due ? undefined : t("suggested_qty_hint")}
      >
        {t("suggested_units", { quantity: fmtQty(p.suggestedQuantity) })}
      </span>
    );
  }

  function stockCell(r: PredictionRow) {
    // Usable stock only — total minus already-expired lots. Expired batches
    // can't be removed from the system and will be discarded anyway, so the
    // aggregate is not a number worth surfacing here.
    return <span className="text-ink2">{fmtQty(r.usable_stock)}</span>;
  }

  function wasteIcon(p: PredictionRow["prediction"]) {
    if (p.projectedWaste === null || p.projectedWaste <= 0) return null;
    const label = t("waste_warning", {
      quantity: fmtQty(p.projectedWaste),
      date: p.firstWasteDate ? fmtDate(p.firstWasteDate) : "",
    });
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        style={{ color: "var(--c-warn)", display: "inline-flex" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
        </svg>
      </span>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-7"
      style={{ display: "flex", flexDirection: "column", gap: "var(--d-section-gap)" }}
    >
      {/* Page header */}
      <div data-tutorial="page-header" className="flex flex-wrap items-end justify-between gap-4">
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
        {(canManage || aiExplain) && (
          <div data-tutorial="actions" className="flex items-center gap-2">
            {aiExplain && <ExplainButton screen="predictive" />}
            {canManage && (
              <button className="mi-btn mi-btn--primary" onClick={() => setShowSettings(true)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"/>
                </svg>
                {t("settings_button")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div data-tutorial="main" className="mi-card mi-shadow overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="hidden md:block md:flex-1 md:min-h-0 overflow-auto mi-table-scroll">
          <table className="mi-table">
            <thead>
              <tr>
                <th>{t("table_product")}</th>
                <th>{t("table_stock")}</th>
                <th>
                  <span className="inline-flex items-center gap-1">
                    {t("table_demand")}
                    <InfoTip text={t("hint_demand")} />
                  </span>
                </th>
                <th>
                  <span className="inline-flex items-center gap-1">
                    {t("table_reorder_point")}
                    <InfoTip text={t("hint_reorder_point")} />
                  </span>
                </th>
                <th>
                  <span className="inline-flex items-center gap-1">
                    {t("table_suggestion")}
                    <InfoTip text={t("hint_suggestion")} />
                  </span>
                </th>
                <th>
                  <span className="inline-flex items-center gap-1">
                    {t("table_suggested_qty")}
                    <InfoTip text={t("hint_suggested_qty")} />
                  </span>
                </th>
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
                          {wasteIcon(p)}
                        </div>
                      </td>
                      <td>{stockCell(r)}</td>
                      <td>{demandCell(p)}</td>
                      <td className="text-ink2">{p.reorderPoint !== null ? fmtQty(p.reorderPoint) : "—"}</td>
                      <td>{suggestionCell(p)}</td>
                      <td>{suggestedQtyCell(p)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="flex-1 min-h-0 overflow-auto md:hidden p-3">
          {rows.length === 0 ? (
            <div className="text-ink3" style={{ textAlign: "center", padding: "24px 0", fontSize: 14 }}>
              {t("empty")}
            </div>
          ) : (
            rows.map((r) => {
              const p = r.prediction;
              return (
                <DataCard
                  key={r.product_id}
                  header={
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/predictive/${r.product_id}`}
                        className="font-semibold text-ink hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.product_name}
                      </Link>
                      {r.criticality && (
                        <span className={`mi-badge ${CRITICALITY_BADGE[r.criticality]}`}>{tCrit(r.criticality)}</span>
                      )}
                      {wasteIcon(p)}
                    </span>
                  }
                  meta={suggestionCell(p)}
                >
                  <dl className="mi-dl">
                    <DataRow label={t("table_stock")}>{stockCell(r)}</DataRow>
                    <DataRow label={t("table_demand")}>{demandCell(p)}</DataRow>
                    <DataRow label={t("table_reorder_point")}>{p.reorderPoint !== null ? fmtQty(p.reorderPoint) : "—"}</DataRow>
                    <DataRow label={t("table_suggested_qty")}>{suggestedQtyCell(p)}</DataRow>
                  </dl>
                </DataCard>
              );
            })
          )}
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          count={count}
          onPageChange={(pg) => navigate({ page: pg })}
          onPageSizeChange={(s) => navigate({ size: s, page: 1 })}
        />
      </div>

      {showSettings && (
        <PredictiveSettingsModal settings={settings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
