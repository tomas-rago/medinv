"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PurchaseModal } from "./PurchaseModal";
import { ReceivePurchaseModal } from "./ReceivePurchaseModal";
import { PurchaseDetailModal } from "./PurchaseDetailModal";
import { PurchaseStatusModal } from "./PurchaseStatusModal";
import type { ProviderOption } from "@/app/(dashboard)/purchases/actions";
import { Pagination } from "@/components/ui/Pagination";
import { DataCard, DataRow } from "@/components/ui/DataCard";

export type PurchaseListRow = {
  id: string;
  status: "draft" | "confirmed" | "received" | "cancelled";
  notes: string | null;
  provider_name: string | null;
  created_at: string;
  received_at: string | null;
  item_count: number;
  total: number;
  has_prices: boolean;
  has_discrepancy: boolean;
};

interface PurchasesPageProps {
  purchases: PurchaseListRow[];
  providers: ProviderOption[];
  count: number;
  page: number;
  pageSize: number;
  status: string;
  providerId: string;
  canManage: boolean;
}

const STATUS_BADGE: Record<PurchaseListRow["status"], string> = {
  draft: "mi-badge--gray",
  confirmed: "mi-badge--blue",
  received: "mi-badge--green",
  cancelled: "mi-badge--danger",
};

export function PurchasesPage({
  purchases, providers, count, page, pageSize, status, providerId, canManage,
}: PurchasesPageProps) {
  const t = useTranslations("Purchases");
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [receiving, setReceiving] = useState<PurchaseListRow | null>(null);
  const [viewing, setViewing] = useState<PurchaseListRow | null>(null);
  const [transition, setTransition] = useState<{ purchase: PurchaseListRow; action: "confirm" | "cancel" } | null>(null);
  const [stat, setStat] = useState(status);
  const [prov, setProv] = useState(providerId);

  const colCount = canManage ? 7 : 6;

  function navigate(next: { status?: string; provider?: string; page?: number; size?: number }) {
    const params = new URLSearchParams();
    const ns = next.status ?? stat;
    const np2 = next.provider ?? prov;
    const np = next.page ?? 1;
    const nsize = next.size ?? pageSize;
    if (ns) params.set("status", ns);
    if (np2) params.set("provider", np2);
    if (np > 1) params.set("page", String(np));
    if (nsize !== 20) params.set("size", String(nsize));
    const qs = params.toString();
    router.push(qs ? `/purchases?${qs}` : "/purchases");
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatMoney(value: number) {
    return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
  }

  function rowActions(p: PurchaseListRow) {
    return (
      <>
        <button
          type="button"
          className="mi-iconbtn"
          aria-label={t("action_view")}
          title={t("action_view")}
          onClick={() => setViewing(p)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        {p.status === "draft" && (
          <button
            type="button"
            className="mi-iconbtn"
            aria-label={t("action_confirm")}
            title={t("action_confirm")}
            onClick={() => setTransition({ purchase: p, action: "confirm" })}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>
            </svg>
          </button>
        )}
        {(p.status === "draft" || p.status === "confirmed") && (
          <>
            <button
              type="button"
              className="mi-iconbtn"
              aria-label={t("action_receive")}
              title={t("action_receive")}
              onClick={() => setReceiving(p)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>
              </svg>
            </button>
            <button
              type="button"
              className="mi-iconbtn"
              aria-label={t("action_cancel")}
              title={t("action_cancel")}
              onClick={() => setTransition({ purchase: p, action: "cancel" })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="m8 8 8 8M16 8l-8 8"/>
              </svg>
            </button>
          </>
        )}
      </>
    );
  }

  function statusBadges(p: PurchaseListRow) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`mi-badge ${STATUS_BADGE[p.status]}`}>{t(`status_${p.status}`)}</span>
        {p.has_discrepancy && (
          <span className="mi-badge mi-badge--amber" title={t("discrepancy_hint")}>
            {t("discrepancy_badge")}
          </span>
        )}
      </div>
    );
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
            <span className="text-ink2 font-medium">{t("breadcrumb_purchases")}</span>
          </div>
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {t("heading")}
          </h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
          </p>
        </div>
        {canManage && (
          <button data-tutorial="actions" className="mi-btn mi-btn--primary" onClick={() => setShowCreate(true)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            {t("new_button")}
          </button>
        )}
      </div>

      {/* Table */}
      <div data-tutorial="main" className="mi-card mi-shadow overflow-hidden flex flex-col flex-1 min-h-0">
        <div
          className="flex flex-wrap items-center gap-3 p-4 border-b"
          style={{ borderColor: "var(--c-line)" }}
        >
          <select
            className="mi-input"
            style={{ maxWidth: 180, paddingTop: 8, paddingBottom: 8 }}
            value={stat}
            onChange={(e) => { setStat(e.target.value); navigate({ status: e.target.value, page: 1 }); }}
          >
            <option value="">{t("all_statuses")}</option>
            <option value="draft">{t("status_draft")}</option>
            <option value="confirmed">{t("status_confirmed")}</option>
            <option value="received">{t("status_received")}</option>
            <option value="cancelled">{t("status_cancelled")}</option>
          </select>
          <select
            className="mi-input"
            style={{ maxWidth: 220, paddingTop: 8, paddingBottom: 8 }}
            value={prov}
            onChange={(e) => { setProv(e.target.value); navigate({ provider: e.target.value, page: 1 }); }}
          >
            <option value="">{t("all_providers")}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex-1" />
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("purchase_count", { count })}
          </span>
        </div>

        <div className="hidden md:block md:flex-1 md:min-h-0 overflow-auto mi-table-scroll">
          <table className="mi-table">
            <thead>
              <tr>
                <th>{t("table_date")}</th>
                <th>{t("table_provider")}</th>
                <th>{t("table_items")}</th>
                <th>{t("table_total")}</th>
                <th>{t("table_status")}</th>
                <th>{t("table_received")}</th>
                {canManage && <th style={{ textAlign: "right" }}>{t("table_actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-ink3" style={{ textAlign: "center", padding: "32px 0" }}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="text-ink2" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      {formatDate(p.created_at)}
                    </td>
                    <td>
                      <span className="font-semibold text-ink">{p.provider_name ?? t("no_provider")}</span>
                    </td>
                    <td className="text-ink2" style={{ fontSize: 13 }}>
                      {t("item_count", { count: p.item_count })}
                    </td>
                    <td className="text-ink2" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      {p.has_prices ? formatMoney(p.total) : "—"}
                    </td>
                    <td>{statusBadges(p)}</td>
                    <td className="text-ink3" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      {p.received_at ? formatDate(p.received_at) : "—"}
                    </td>
                    {canManage && (
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {rowActions(p)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="flex-1 min-h-0 overflow-auto md:hidden p-3">
          {purchases.length === 0 ? (
            <div className="text-ink3" style={{ textAlign: "center", padding: "24px 0", fontSize: 14 }}>
              {t("empty")}
            </div>
          ) : (
            purchases.map((p) => (
              <DataCard
                key={p.id}
                header={
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">{p.provider_name ?? t("no_provider")}</span>
                    <span className="text-ink3" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{formatDate(p.created_at)}</span>
                  </span>
                }
                meta={<span className={`mi-badge ${STATUS_BADGE[p.status]}`}>{t(`status_${p.status}`)}</span>}
              >
                <dl className="mi-dl">
                  <DataRow label={t("table_items")}>{t("item_count", { count: p.item_count })}</DataRow>
                  <DataRow label={t("table_total")}>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.has_prices ? formatMoney(p.total) : "—"}</span>
                  </DataRow>
                  <DataRow label={t("table_status")}>{statusBadges(p)}</DataRow>
                  <DataRow label={t("table_received")}>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.received_at ? formatDate(p.received_at) : "—"}</span>
                  </DataRow>
                  {canManage && (
                    <DataRow label={t("table_actions")}>
                      <span className="flex items-center justify-end gap-1">{rowActions(p)}</span>
                    </DataRow>
                  )}
                </dl>
              </DataCard>
            ))
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

      {showCreate && <PurchaseModal providers={providers} onClose={() => setShowCreate(false)} />}
      {receiving && (
        <ReceivePurchaseModal
          purchase={{ id: receiving.id, provider_name: receiving.provider_name }}
          onClose={() => setReceiving(null)}
        />
      )}
      {viewing && (
        <PurchaseDetailModal
          purchase={{
            id: viewing.id,
            provider_name: viewing.provider_name,
            status: viewing.status,
            notes: viewing.notes,
            created_at: viewing.created_at,
            received_at: viewing.received_at,
          }}
          onClose={() => setViewing(null)}
        />
      )}
      {transition && (
        <PurchaseStatusModal
          purchase={{ id: transition.purchase.id, provider_name: transition.purchase.provider_name }}
          action={transition.action}
          onClose={() => setTransition(null)}
        />
      )}
    </div>
  );
}
