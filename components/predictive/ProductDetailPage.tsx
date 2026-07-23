"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ProductDetail } from "@/lib/predictive/detail";
import type { ProductCriticality } from "@/lib/constants/criticality";
import { ConsumptionChart } from "./ConsumptionChart";
import { ExplainButton } from "@/components/asistencia-ia/ExplainButton";
import { InfoTip } from "@/components/ui/InfoTip";

interface ProductDetailPageProps {
  detail: ProductDetail;
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

const CRITICALITY_BADGE: Record<ProductCriticality, string> = {
  vital: "mi-badge--danger",
  essential: "mi-badge--amber",
  desirable: "mi-badge--gray",
};

export function ProductDetailPage({ detail, aiExplain }: ProductDetailPageProps) {
  const t = useTranslations("Predictive");
  const tCrit = useTranslations("Criticality");

  const { product, row, backtest } = detail;
  const p = row.prediction;
  const noData = p.method === "insufficient_data";
  const hasAnyActual = backtest.days.some((d) => d.actual > 0);
  const hasProjection = backtest.method !== "insufficient_data";

  const stats: { key: string; value: React.ReactNode; extra?: React.ReactNode; hint?: string }[] = [
    {
      // Usable stock: the aggregate minus lots that have already expired.
      key: "detail_stat_stock",
      value: fmtQty(row.usable_stock),
    },
    {
      key: "detail_stat_demand",
      hint: t("hint_demand"),
      value:
        noData || p.dailyDemand === null ? (
          <span className="mi-badge mi-badge--gray">{t("method_insufficient")}</span>
        ) : (
          t("demand_per_day", { quantity: fmtQty(p.dailyDemand) })
        ),
      extra:
        !noData && p.dailyDemand !== null ? (
          <span
            className="mi-badge mi-badge--blue"
            title={p.method === "regression" ? t("method_regression_hint") : t("method_average_hint")}
          >
            {p.method === "regression" ? t("method_regression") : t("method_average")}
          </span>
        ) : undefined,
    },
    {
      key: "detail_stat_reorder_point",
      value: p.reorderPoint !== null ? fmtQty(p.reorderPoint) : "—",
      hint: t("hint_reorder_point"),
    },
    {
      key: "detail_stat_suggested_qty",
      // Zero means "already covered" — an answer, not a missing value; the
      // dash is reserved for having no demand estimate to compute from.
      value:
        p.suggestedQuantity !== null
          ? t("suggested_units", { quantity: fmtQty(p.suggestedQuantity) })
          : "—",
      hint: t("hint_suggested_qty"),
      extra:
        p.suggestedQuantity === 0 ? (
          <span className="mi-badge mi-badge--gray" title={t("suggested_qty_covered")}>
            {t("suggested_qty_covered_short")}
          </span>
        ) : undefined,
    },
    {
      key: "detail_stat_lead_time",
      value: t("detail_lead_time_days", { days: row.lead_time_days }),
      hint: t("hint_lead_time"),
      extra: row.lead_time_auto ? (
        <span className="mi-badge mi-badge--gray" title={t("detail_lead_time_auto_hint")}>
          {t("detail_lead_time_auto")}
        </span>
      ) : undefined,
    },
    {
      key: "detail_stat_safety_stock",
      value: p.safetyStock !== null ? fmtQty(Math.ceil(p.safetyStock)) : "—",
      hint: t("hint_safety_stock"),
    },
  ];

  // Only worth a tile when something is actually projected to be lost.
  if (p.projectedWaste !== null && p.projectedWaste > 0) {
    stats.push({
      key: "detail_stat_waste",
      value: t("suggested_units", { quantity: fmtQty(p.projectedWaste) }),
      hint: t("hint_waste"),
      extra: p.firstWasteDate ? (
        <span className="text-ink3" style={{ fontSize: 12 }}>
          {t("detail_waste_from", { date: fmtDate(p.firstWasteDate) })}
        </span>
      ) : undefined,
    });
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-7"
      style={{ display: "flex", flexDirection: "column", gap: "var(--d-section-gap)" }}
    >
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-ink3 mb-1" style={{ fontSize: 13 }}>
            <span>{t("breadcrumb_operation")}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            <Link href="/predictive" className="hover:underline">
              {t("breadcrumb_predictive")}
            </Link>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            <span className="text-ink2 font-medium">{product.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
              {product.name}
            </h1>
            {product.criticality && (
              <span className={`mi-badge ${CRITICALITY_BADGE[product.criticality]}`}>
                {tCrit(product.criticality)}
              </span>
            )}
          </div>
        </div>
        {aiExplain && (
          <ExplainButton screen="predictive_detail" productId={row.product_id} />
        )}
      </div>

      {/* Stat tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {stats.map((s) => (
          <div key={s.key} className="mi-card mi-shadow p-4">
            <div className="text-ink3 mb-1 flex items-center gap-1" style={{ fontSize: 12 }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t(s.key as any)}
              {s.hint && <InfoTip text={s.hint} />}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink font-semibold" style={{ fontSize: 18 }}>
                {s.value}
              </span>
              {s.extra}
            </div>
          </div>
        ))}
      </div>

      {/* Projected vs actual chart */}
      <div className="mi-card mi-shadow p-5">
        <div className="font-display text-ink mb-3" style={{ fontSize: 17 }}>
          {t("detail_chart_title")}
        </div>
        {!hasAnyActual && !hasProjection ? (
          <p className="text-ink3" style={{ fontSize: 14 }}>
            {t("chart_empty")}
          </p>
        ) : (
          <>
            {!hasProjection && (
              <p className="text-ink3 mb-3" style={{ fontSize: 13 }}>
                {t("chart_insufficient")}
              </p>
            )}
            <ConsumptionChart
              days={backtest.days}
              labels={{
                actual: t("chart_legend_actual"),
                projected: t("chart_legend_projected"),
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
