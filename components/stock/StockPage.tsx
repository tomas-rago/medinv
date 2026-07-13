"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { StockEntryModal } from "./StockEntryModal";
import { StockExitModal } from "./StockExitModal";
import { RectifyMovementModal } from "./RectifyMovementModal";
import type { RectifiableMovement } from "./RectifyMovementModal";
import { MovementsFilterBar } from "./MovementsFilterBar";
import { movementsUrl } from "./movements-url";
import { ExplainButton } from "@/components/asistencia-ia/ExplainButton";
import { fetchMovementsForExport } from "@/app/(dashboard)/stock/actions";
import type { MovementFilters, MovementSortKey } from "@/lib/schemas/stock/filters";
import type { MovementExportRow } from "@/lib/export/movements-types";

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
  criticality: string | null;
  user_name: string;
  provider_name: string | null;
  receptor_name: string | null;
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
  filters: MovementFilters;
  initialTab: "stock" | "movements";
  providers: { id: string; name: string }[];
  selectedProductName: string | null;
  selectedReceptorName: string | null;
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

function SortHeader({
  column,
  label,
  activeSort,
  activeDir,
  onSort,
  sortLabel,
}: {
  column: MovementSortKey;
  label: string;
  activeSort: MovementSortKey;
  activeDir: "asc" | "desc";
  onSort: (key: MovementSortKey) => void;
  sortLabel: (dir: "asc" | "desc") => string;
}) {
  const isActive = activeSort === column;
  return (
    <th>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1"
        style={{ font: "inherit", color: "inherit", cursor: "pointer" }}
        aria-label={sortLabel(isActive && activeDir === "asc" ? "desc" : "asc")}
      >
        {label}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: isActive ? 1 : 0.3, transform: isActive && activeDir === "desc" ? "rotate(180deg)" : "none" }}
        >
          <path d="M12 19V5M5 12l7-7 7 7"/>
        </svg>
      </button>
    </th>
  );
}

export function StockPage({
  movements,
  count,
  page,
  pageSize,
  canWrite,
  rectifiedIds,
  existencias,
  aiExplain,
  filters,
  initialTab,
  providers,
  selectedProductName,
  selectedReceptorName,
}: StockPageProps) {
  const t = useTranslations("Stock");
  const tCat = useTranslations("Categories");
  const tCrit = useTranslations("Criticality");
  const tUnit = useTranslations("Units");
  const router = useRouter();
  const [showEntry, setShowEntry] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [rectifying, setRectifying] = useState<RectifiableMovement | null>(null);
  const [tab, setTab] = useState<"stock" | "movements">(initialTab);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const rectifiedSet = new Set(rectifiedIds);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const rangeFrom = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, count);

  function goto(p: number) {
    router.push(movementsUrl(filters, p));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeSort: MovementSortKey = filters.sort ?? "date";
  const activeDir = filters.dir ?? (activeSort === "date" ? "desc" : "asc");

  function onSort(key: MovementSortKey) {
    // Same column toggles direction; a new column starts at its default.
    const dir =
      activeSort === key
        ? activeDir === "asc" ? "desc" : "asc"
        : key === "date" ? "desc" : "asc";
    router.push(movementsUrl({ ...filters, sort: key, dir }));
  }

  const sortHeaderProps = {
    activeSort,
    activeDir,
    onSort,
    sortLabel: (dir: "asc" | "desc") => (dir === "asc" ? t("sort_asc") : t("sort_desc")),
  };

  // Translate export row codes to labels client-side so es.json stays the
  // single label source.
  function toExportCells(rows: MovementExportRow[]): string[][] {
    return rows.map((r) => [
      fmtDate(r.created_at),
      r.product_name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.category ? tCat(r.category as any) : "—",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.criticality ? tCrit(r.criticality as any) : "—",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      t.has(`type_${r.type}` as any) ? t(`type_${r.type}` as any) : r.type,
      String(r.quantity),
      r.expiry_date ? fmtDate(r.expiry_date) : "—",
      r.user_name,
      r.provider_name ?? "—",
      r.receptor_name ?? "—",
      r.notes ?? "—",
    ]);
  }

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    setExportMenuOpen(false);
    setExportNotice(null);
    setExporting(format);
    try {
      const result = await fetchMovementsForExport(filters);
      if (!result.ok) {
        setExportNotice(t("export_failed"));
        return;
      }
      if (result.rows.length === 0) {
        setExportNotice(t("export_empty"));
        return;
      }
      const headers = [
        t("table_date"),
        t("table_product"),
        t("table_product_category"),
        t("table_criticality"),
        t("table_type"),
        t("table_quantity"),
        t("table_expiry"),
        t("table_user"),
        t("table_provider"),
        t("table_receptor"),
        t("table_notes"),
      ];
      const cells = toExportCells(result.rows);
      const filename = `movimientos-${new Date().toISOString().slice(0, 10)}`;
      const exporters = await import("@/lib/export/movements");
      if (format === "csv") exporters.exportMovementsCsv(headers, cells, filename);
      else if (format === "xlsx") await exporters.exportMovementsXlsx(headers, cells, filename);
      else await exporters.exportMovementsPdf(headers, cells, filename, t("movements_title"));
      if (result.truncated) {
        setExportNotice(t("export_truncated", { max: 5000 }));
      }
    } catch (err) {
      console.error("[export]", err);
      setExportNotice(t("export_failed"));
    } finally {
      setExporting(null);
    }
  }

  const colSpanMovements = canWrite ? 10 : 9;

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
            {exportNotice && (
              <span className="text-ink3" style={{ fontSize: 13 }}>{exportNotice}</span>
            )}
            <div className="relative">
              <button
                type="button"
                className="mi-btn mi-btn--soft mi-btn--sm"
                disabled={exporting !== null}
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
                </svg>
                {exporting ? t("exporting") : t("export_button")}
              </button>
              {exportMenuOpen && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    zIndex: 50,
                    marginTop: 4,
                    minWidth: 160,
                    border: "1px solid var(--c-line)",
                    background: "var(--c-surface)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                  }}
                >
                  {(["csv", "xlsx", "pdf"] as const).map((format) => (
                    <button
                      key={format}
                      type="button"
                      className="w-full text-left px-3 py-2 text-ink"
                      style={{ borderBottom: "1px solid var(--c-line)", fontSize: 13 }}
                      onClick={() => handleExport(format)}
                    >
                      {format === "csv" ? t("export_csv") : format === "xlsx" ? t("export_excel") : t("export_pdf")}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-ink3" style={{ fontSize: 13 }}>
              {t("movement_count", { count })}
            </span>
          </div>

          <MovementsFilterBar
            filters={filters}
            providers={providers}
            selectedProductName={selectedProductName}
            selectedReceptorName={selectedReceptorName}
          />

          <div className="overflow-x-auto">
            <table className="mi-table">
              <thead>
                <tr>
                  <SortHeader column="date" label={t("table_date")} {...sortHeaderProps} />
                  <SortHeader column="product" label={t("table_product")} {...sortHeaderProps} />
                  <SortHeader column="type" label={t("table_type")} {...sortHeaderProps} />
                  <SortHeader column="quantity" label={t("table_quantity")} {...sortHeaderProps} />
                  <SortHeader column="expiry" label={t("table_expiry")} {...sortHeaderProps} />
                  <th>{t("table_user")}</th>
                  <th>{t("table_provider")}</th>
                  <SortHeader column="receptor" label={t("table_receptor")} {...sortHeaderProps} />
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
                        <td className="text-ink2" style={{ fontSize: 13 }}>{m.provider_name ?? "—"}</td>
                        <td className="text-ink2" style={{ fontSize: 13 }}>{m.receptor_name ?? "—"}</td>
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
