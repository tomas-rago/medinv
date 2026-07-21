"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { acknowledgeAlert } from "@/app/(dashboard)/alerts/actions";
import { AlertSettingsModal } from "./AlertSettingsModal";
import type { AlertSettings } from "./AlertSettingsModal";
import { ThresholdsModal } from "./ThresholdsModal";
import type { ThresholdRow } from "./ThresholdsModal";
import { ExplainButton } from "@/components/asistencia-ia/ExplainButton";
import { Pagination } from "@/components/ui/Pagination";
import { DataCard, DataRow } from "@/components/ui/DataCard";
import { FilterBar } from "@/components/ui/FilterBar";

type AlertRow = {
  id: string;
  type: "low_stock" | "expiry" | "reorder_suggested";
  status: "active" | "resolved";
  quantity: number | null;
  threshold: number | null;
  expiry_date: string | null;
  triggered_at: string;
  resolved_at: string | null;
  acknowledged_at: string | null;
  product_name: string;
};

interface AlertsPageProps {
  alerts: AlertRow[];
  count: number;
  page: number;
  pageSize: number;
  type: string;
  view: string;
  settings: AlertSettings;
  thresholds: ThresholdRow[];
  canManage: boolean;
  aiExplain: boolean;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

// expiry_date is a plain date (no TZ) — compare against the local calendar day.
function isPastDate(d: string) {
  const today = new Date();
  const localDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return d < localDay;
}

export function AlertsPage({
  alerts,
  count,
  page,
  pageSize,
  type,
  view,
  settings,
  thresholds,
  canManage,
  aiExplain,
}: AlertsPageProps) {
  const t = useTranslations("Alerts");
  const tErr = useTranslations("Errors");
  const router = useRouter();

  const [showSettings, setShowSettings] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const [typeFilter, setTypeFilter] = useState(type);
  const [viewFilter, setViewFilter] = useState(view || "unread");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function navigate(next: { type?: string; view?: string; page?: number; size?: number }) {
    const params = new URLSearchParams();
    const nt = next.type ?? typeFilter;
    const nv = next.view ?? viewFilter;
    const np = next.page ?? 1;
    const nsize = next.size ?? pageSize;
    if (nt) params.set("type", nt);
    if (nv && nv !== "unread") params.set("view", nv);
    if (np > 1) params.set("page", String(np));
    if (nsize !== 20) params.set("size", String(nsize));
    const qs = params.toString();
    router.push(qs ? `/alerts?${qs}` : "/alerts");
  }

  function handleAcknowledge(alertId: string) {
    setErrorKey(null);
    setAckingId(alertId);
    startTransition(async () => {
      const result = await acknowledgeAlert(alertId);
      setAckingId(null);
      if (!result.ok) setErrorKey(result.error ?? "unexpected");
    });
  }

  function typeBadge(a: AlertRow) {
    const expired = a.type === "expiry" && a.expiry_date !== null && isPastDate(a.expiry_date);
    if (a.type === "low_stock") return <span className="mi-badge mi-badge--amber">{t("type_low_stock")}</span>;
    if (a.type === "reorder_suggested") return <span className="mi-badge mi-badge--blue">{t("type_reorder")}</span>;
    return (
      <span className={`mi-badge ${expired ? "mi-badge--danger" : "mi-badge--blue"}`}>
        {expired ? t("type_expired") : t("type_expiry")}
      </span>
    );
  }

  function detailText(a: AlertRow) {
    return a.type === "low_stock"
      ? t("detail_low_stock", { quantity: a.quantity ?? 0, threshold: a.threshold ?? 0 })
      : a.type === "reorder_suggested"
        ? t("detail_reorder", { quantity: a.quantity ?? 0, threshold: a.threshold ?? 0 })
        : t("detail_expiry", { date: a.expiry_date ? fmtDate(a.expiry_date) : "—", quantity: a.quantity ?? 0 });
  }

  function statusBadge(a: AlertRow) {
    return a.status === "active" ? (
      <span className="mi-badge mi-badge--danger">{t("status_active_badge")}</span>
    ) : (
      <span className="mi-badge mi-badge--green">{t("status_resolved_badge")}</span>
    );
  }

  function ackAction(a: AlertRow) {
    if (a.status === "active" && !a.acknowledged_at) {
      return (
        <button
          type="button"
          className="mi-btn mi-btn--ghost mi-btn--sm"
          disabled={ackingId === a.id}
          onClick={() => handleAcknowledge(a.id)}
        >
          {ackingId === a.id ? t("acknowledging") : t("acknowledge")}
        </button>
      );
    }
    if (a.status === "active" && a.acknowledged_at) {
      return (
        <span className="text-ink3" style={{ fontSize: 12 }}>
          {t("acknowledged_on", { date: fmtDate(a.acknowledged_at) })}
        </span>
      );
    }
    return null;
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
            <span className="text-ink2 font-medium">{t("breadcrumb_alerts")}</span>
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
            {aiExplain && <ExplainButton screen="alerts" />}
            {canManage && (
              <>
                <button className="mi-btn mi-btn--soft" onClick={() => setShowThresholds(true)} aria-label={t("thresholds_button")} title={t("thresholds_button")}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>
                  </svg>
                  <span className="mi-btn__label">{t("thresholds_button")}</span>
                </button>
                <button className="mi-btn mi-btn--primary" onClick={() => setShowSettings(true)} aria-label={t("settings_button")} title={t("settings_button")}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"/>
                  </svg>
                  <span className="mi-btn__label">{t("settings_button")}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div data-tutorial="main" className="mi-card mi-shadow overflow-hidden flex flex-col flex-1 min-h-0">
        <FilterBar hasActive={Boolean(typeFilter) || viewFilter !== "unread"}>
        <div
          className="flex flex-wrap items-center gap-3 p-4 border-b"
          style={{ borderColor: "var(--c-line)" }}
        >
          <select
            className="mi-input"
            style={{ maxWidth: 190, paddingTop: 8, paddingBottom: 8 }}
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); navigate({ type: e.target.value, page: 1 }); }}
          >
            <option value="">{t("all_types")}</option>
            <option value="low_stock">{t("type_low_stock")}</option>
            <option value="expiry">{t("type_expiry")}</option>
            <option value="reorder_suggested">{t("type_reorder")}</option>
          </select>
          <select
            className="mi-input"
            style={{ maxWidth: 190, paddingTop: 8, paddingBottom: 8 }}
            value={viewFilter}
            onChange={(e) => { setViewFilter(e.target.value); navigate({ view: e.target.value, page: 1 }); }}
          >
            <option value="unread">{t("view_unread")}</option>
            <option value="active">{t("view_active")}</option>
            <option value="resolved">{t("view_resolved")}</option>
          </select>
          <div className="flex-1" />
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("alert_count", { count })}
          </span>
        </div>
        </FilterBar>

        {errorKey && (
          <p className="mi-field-error px-4 pt-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {tErr(errorKey as any)}
          </p>
        )}

        <div className="hidden md:block md:flex-1 md:min-h-0 overflow-auto mi-table-scroll">
          <table className="mi-table">
            <thead>
              <tr>
                <th>{t("table_product")}</th>
                <th>{t("table_type")}</th>
                <th>{t("table_detail")}</th>
                <th>{t("table_triggered")}</th>
                <th>{t("table_status")}</th>
                <th style={{ textAlign: "right" }}>{t("table_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-ink3" style={{ textAlign: "center", padding: "32px 0" }}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                alerts.map((a) => (
                  <tr key={a.id} style={a.status === "resolved" ? { opacity: 0.55 } : undefined}>
                    <td>
                      <div className="flex items-center gap-2">
                        {a.status === "active" && !a.acknowledged_at && (
                          <span
                            title={t("unread_hint")}
                            style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-danger)", flexShrink: 0 }}
                          />
                        )}
                        <span className="font-semibold text-ink">{a.product_name}</span>
                      </div>
                    </td>
                    <td>{typeBadge(a)}</td>
                    <td className="text-ink2" style={{ fontSize: 13 }}>{detailText(a)}</td>
                    <td className="text-ink3" style={{ fontSize: 13 }}>{fmtDate(a.triggered_at)}</td>
                    <td>{statusBadge(a)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">{ackAction(a)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="flex-1 min-h-0 overflow-auto md:hidden p-3">
          {alerts.length === 0 ? (
            <div className="text-ink3" style={{ textAlign: "center", padding: "24px 0", fontSize: 14 }}>
              {t("empty")}
            </div>
          ) : (
            alerts.map((a) => (
              <DataCard
                key={a.id}
                header={
                  <span className="flex items-center gap-2" style={a.status === "resolved" ? { opacity: 0.6 } : undefined}>
                    {a.status === "active" && !a.acknowledged_at && (
                      <span
                        title={t("unread_hint")}
                        style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-danger)", flexShrink: 0 }}
                      />
                    )}
                    <span className="font-semibold text-ink">{a.product_name}</span>
                  </span>
                }
                meta={typeBadge(a)}
              >
                <dl className="mi-dl">
                  <DataRow label={t("table_detail")}>{detailText(a)}</DataRow>
                  <DataRow label={t("table_triggered")}>{fmtDate(a.triggered_at)}</DataRow>
                  <DataRow label={t("table_status")}>{statusBadge(a)}</DataRow>
                  {ackAction(a) && <DataRow label={t("table_actions")}>{ackAction(a)}</DataRow>}
                </dl>
              </DataCard>
            ))
          )}
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          count={count}
          onPageChange={(p) => navigate({ page: p })}
          onPageSizeChange={(s) => navigate({ size: s, page: 1 })}
        />
      </div>

      {showSettings && <AlertSettingsModal settings={settings} onClose={() => setShowSettings(false)} />}
      {showThresholds && <ThresholdsModal thresholds={thresholds} onClose={() => setShowThresholds(false)} />}
    </div>
  );
}
