"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { StockEntryModal } from "./StockEntryModal";

type MovementRow = {
  id: string;
  type: string;
  quantity: number;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  product_name: string;
  category: string | null;
  user_name: string;
};

interface StockPageProps {
  movements: MovementRow[];
  count: number;
  page: number;
  pageSize: number;
  canWrite: boolean;
}

const TYPE_TONES: Record<string, string> = {
  entry: "green",
  exit: "danger",
  adjustment: "blue",
  expiry: "amber",
};

export function StockPage({ movements, count, page, pageSize, canWrite }: StockPageProps) {
  const t = useTranslations("Stock");
  const router = useRouter();
  const [showEntry, setShowEntry] = useState(false);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const rangeFrom = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, count);

  function goto(p: number) {
    router.push(p > 1 ? `/stock?page=${p}` : "/stock");
  }

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
            <span className="text-ink2 font-medium">{t("breadcrumb_inventory")}</span>
          </div>
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {t("heading")}
          </h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
          </p>
        </div>
        {canWrite && (
          <button className="mi-btn mi-btn--primary" onClick={() => setShowEntry(true)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            {t("entry_button")}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mi-card mi-shadow overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: "var(--c-line)" }}>
          <span className="font-semibold text-ink">{t("movements_title")}</span>
          <div className="flex-1" />
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("movement_count", { count })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="mi-table">
            <thead>
              <tr>
                <th>{t("table_date")}</th>
                <th>{t("table_product")}</th>
                <th>{t("table_type")}</th>
                <th>{t("table_quantity")}</th>
                <th>{t("table_expiry")}</th>
                <th>{t("table_user")}</th>
                <th>{t("table_notes")}</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-ink3" style={{ textAlign: "center", padding: "32px 0" }}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td className="text-ink3" style={{ fontSize: 13 }}>
                      {new Date(m.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="font-medium text-ink">{m.product_name}</td>
                    <td>
                      <span className={`mi-badge mi-badge--${TYPE_TONES[m.type] ?? "gray"}`}>
                        {t.has(`type_${m.type}`) ? t(`type_${m.type}`) : m.type}
                      </span>
                    </td>
                    <td className="text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {m.type === "entry" ? "+" : m.type === "exit" || m.type === "expiry" ? "−" : ""}{m.quantity}
                    </td>
                    <td className="text-ink2" style={{ fontSize: 13 }}>
                      {m.expiry_date
                        ? new Date(m.expiry_date).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="text-ink2" style={{ fontSize: 13 }}>{m.user_name}</td>
                    <td className="text-ink3" style={{ fontSize: 13 }}>{m.notes ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-3 p-4 border-t" style={{ borderColor: "var(--c-line)" }}>
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("pagination_range", { from: rangeFrom, to: rangeTo, total: count })}
          </span>
          <div className="flex items-center gap-2">
            <button className="mi-btn mi-btn--ghost mi-btn--sm" disabled={page <= 1} onClick={() => goto(page - 1)}>
              {t("prev")}
            </button>
            <span className="text-ink2" style={{ fontSize: 13 }}>
              {t("page_of", { page, total: totalPages })}
            </span>
            <button className="mi-btn mi-btn--ghost mi-btn--sm" disabled={page >= totalPages} onClick={() => goto(page + 1)}>
              {t("next")}
            </button>
          </div>
        </div>
      </div>

      {showEntry && <StockEntryModal onClose={() => setShowEntry(false)} />}
    </div>
  );
}
