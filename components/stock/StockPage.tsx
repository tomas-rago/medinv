"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { StockEntryModal } from "./StockEntryModal";
import { StockExitModal } from "./StockExitModal";
import { RectifyMovementModal } from "./RectifyMovementModal";
import type { RectifiableMovement } from "./RectifyMovementModal";
import { ExplainButton } from "@/components/asistencia-ia/ExplainButton";

type MovementRow = {
  id: string;
  type: string;
  quantity: number;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  corrects_movement_id: string | null;
  product_name: string;
  category: string | null;
  user_name: string;
};

type ExistenciaRow = {
  product_id: string;
  product_name: string;
  category: string | null;
  unit: string;
  quantity: number;
  min_quantity: number;
  low: boolean;
  batches: { expiry_date: string | null; quantity: number }[];
};

interface StockPageProps {
  movements: MovementRow[];
  count: number;
  page: number;
  pageSize: number;
  canWrite: boolean;
  rectifiedIds: string[];
  existencias: ExistenciaRow[];
  aiExplain: boolean;
}

const TYPE_TONES: Record<string, string> = {
  entry: "green",
  exit: "danger",
  adjustment: "blue",
  expiry: "amber",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

export function StockPage({ movements, count, page, pageSize, canWrite, rectifiedIds, existencias, aiExplain }: StockPageProps) {
  const t = useTranslations("Stock");
  const tCat = useTranslations("Categories");
  const tUnit = useTranslations("Units");
  const router = useRouter();
  const [showEntry, setShowEntry] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [rectifying, setRectifying] = useState<RectifiableMovement | null>(null);
  const [tab, setTab] = useState<"stock" | "movements">("stock");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rectifiedSet = new Set(rectifiedIds);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const rangeFrom = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, count);

  function goto(p: number) {
    router.push(p > 1 ? `/stock?page=${p}` : "/stock");
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const colSpanMovements = canWrite ? 8 : 7;

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
        {(canWrite || aiExplain) && (
          <div className="flex items-center gap-2">
            {aiExplain && <ExplainButton screen="stock" />}
            {canWrite && (
              <>
                <button className="mi-btn mi-btn--soft" onClick={() => setShowExit(true)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                  {t("exit_button")}
                </button>
                <button className="mi-btn mi-btn--primary" onClick={() => setShowEntry(true)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  {t("entry_button")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          className={tab === "stock" ? "mi-btn mi-btn--soft mi-btn--sm" : "mi-btn mi-btn--ghost mi-btn--sm"}
          onClick={() => setTab("stock")}
        >
          {t("tab_stock")}
        </button>
        <button
          className={tab === "movements" ? "mi-btn mi-btn--soft mi-btn--sm" : "mi-btn mi-btn--ghost mi-btn--sm"}
          onClick={() => setTab("movements")}
        >
          {t("tab_movements")}
        </button>
      </div>

      {tab === "stock" ? (
        /* Existencias (on-hand) */
        <div className="mi-card mi-shadow overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: "var(--c-line)" }}>
            <span className="font-semibold text-ink">{t("existencias_title")}</span>
            <div className="flex-1" />
            <span className="text-ink3" style={{ fontSize: 13 }}>
              {t("existencias_count", { count: existencias.length })}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="mi-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>{t("existencias_product")}</th>
                  <th>{t("table_product_category")}</th>
                  <th>{t("existencias_on_hand")}</th>
                </tr>
              </thead>
              <tbody>
                {existencias.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-ink3" style={{ textAlign: "center", padding: "32px 0" }}>
                      {t("existencias_empty")}
                    </td>
                  </tr>
                ) : (
                  existencias.map((s) => {
                    const isOpen = expanded.has(s.product_id);
                    const unitLabel = tUnit.has(s.unit) ? tUnit(s.unit) : s.unit;
                    return (
                      <Fragment key={s.product_id}>
                        <tr style={{ cursor: s.batches.length ? "pointer" : "default" }} onClick={() => s.batches.length && toggleExpand(s.product_id)}>
                          <td className="text-ink3">
                            {s.batches.length > 0 && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
                                <path d="m9 6 6 6-6 6"/>
                              </svg>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink">{s.product_name}</span>
                              {s.low && <span className="mi-badge mi-badge--amber">{t("existencias_low")}</span>}
                            </div>
                          </td>
                          <td>
                            {s.category ? (
                              <span className="mi-badge mi-badge--gray">{tCat(s.category)}</span>
                            ) : (
                              <span className="text-ink3">—</span>
                            )}
                          </td>
                          <td className="text-ink" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                            {s.quantity} <span className="text-ink3" style={{ fontWeight: 400, fontSize: 13 }}>{unitLabel}</span>
                          </td>
                        </tr>
                        {isOpen && s.batches.map((b, i) => (
                          <tr key={`${s.product_id}-${i}`} style={{ background: "var(--c-surface-2)" }}>
                            <td></td>
                            <td className="text-ink2" style={{ fontSize: 13 }} colSpan={2}>
                              {t("existencias_expiry")}: {b.expiry_date ? fmtDate(b.expiry_date) : t("existencias_no_expiry")}
                            </td>
                            <td className="text-ink2" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{b.quantity}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Movements log */
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
                  {canWrite && <th style={{ textAlign: "right" }}>{t("table_actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={colSpanMovements} className="text-ink3" style={{ textAlign: "center", padding: "32px 0" }}>
                      {t("empty")}
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isRectification = m.corrects_movement_id !== null;
                    const alreadyRectified = rectifiedSet.has(m.id);
                    const canRollback = canWrite && !isRectification && !alreadyRectified && (m.type === "entry" || m.type === "exit");
                    return (
                      <tr key={m.id}>
                        <td className="text-ink3" style={{ fontSize: 13 }}>{fmtDate(m.created_at)}</td>
                        <td className="font-medium text-ink">{m.product_name}</td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className={`mi-badge mi-badge--${TYPE_TONES[m.type] ?? "gray"}`}>
                              {t.has(`type_${m.type}`) ? t(`type_${m.type}`) : m.type}
                            </span>
                            {isRectification && (
                              <span className="mi-badge mi-badge--blue">{t("type_rectification")}</span>
                            )}
                          </div>
                        </td>
                        <td className="text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {m.type === "entry" ? "+" : m.type === "exit" || m.type === "expiry" ? "−" : ""}{m.quantity}
                        </td>
                        <td className="text-ink2" style={{ fontSize: 13 }}>
                          {m.expiry_date ? fmtDate(m.expiry_date) : "—"}
                        </td>
                        <td className="text-ink2" style={{ fontSize: 13 }}>{m.user_name}</td>
                        <td className="text-ink3" style={{ fontSize: 13 }}>{m.notes ?? "—"}</td>
                        {canWrite && (
                          <td>
                            <div className="flex items-center justify-end">
                              {canRollback ? (
                                <button
                                  type="button"
                                  className="mi-iconbtn"
                                  aria-label={t("rectify_action")}
                                  title={t("rectify_action")}
                                  onClick={() => setRectifying({ id: m.id, type: m.type, quantity: m.quantity, expiry_date: m.expiry_date, product_name: m.product_name })}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
                                  </svg>
                                </button>
                              ) : (
                                <span className="text-ink3" style={{ fontSize: 13 }}>{alreadyRectified ? t("rectified_tag") : "—"}</span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
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
      )}

      {showEntry && <StockEntryModal onClose={() => setShowEntry(false)} />}
      {showExit && <StockExitModal onClose={() => setShowExit(false)} />}
      {rectifying && (
        <RectifyMovementModal movement={rectifying} onClose={() => setRectifying(null)} />
      )}
    </div>
  );
}
