"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProductModal } from "./ProductModal";
import { EditProductModal } from "./EditProductModal";
import type { EditableProduct } from "./EditProductModal";
import { ProductActiveModal } from "./ProductActiveModal";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";
import type { ProductCriticality } from "@/lib/constants/criticality";
import { Pagination } from "@/components/ui/Pagination";
import { DataCard, DataRow } from "@/components/ui/DataCard";
import { FilterBar } from "@/components/ui/FilterBar";

const CRITICALITY_BADGE: Record<ProductCriticality, string> = {
  vital: "mi-badge--danger",
  essential: "mi-badge--amber",
  desirable: "mi-badge--gray",
};

type Product = {
  id: string;
  name: string;
  ean: string | null;
  presentation: string | null;
  category: string | null;
  criticality: string | null;
  unit: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

interface ProductsPageProps {
  products: Product[];
  count: number;
  page: number;
  pageSize: number;
  q: string;
  category: string;
  status: string;
  canWrite: boolean;
}

export function ProductsPage({ products, count, page, pageSize, q, category, status, canWrite }: ProductsPageProps) {
  const t = useTranslations("Products");
  const tCat = useTranslations("Categories");
  const tCrit = useTranslations("Criticality");
  const tUnit = useTranslations("Units");
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [toggling, setToggling] = useState<Product | null>(null);
  const [search, setSearch] = useState(q);
  const [cat, setCat] = useState(category);
  const [stat, setStat] = useState(status);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colCount = canWrite ? 7 : 6;

  function navigate(next: { q?: string; category?: string; status?: string; page?: number; size?: number }) {
    const params = new URLSearchParams();
    const nq = next.q ?? search;
    const nc = next.category ?? cat;
    const ns = next.status ?? stat;
    const np = next.page ?? 1;
    const nsize = next.size ?? pageSize;
    if (nq) params.set("q", nq);
    if (nc) params.set("category", nc);
    if (ns) params.set("status", ns);
    if (np > 1) params.set("page", String(np));
    if (nsize !== 20) params.set("size", String(nsize));
    const qs = params.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => navigate({ q: value, page: 1 }), 400);
  }

  function rowActions(p: Product) {
    return (
      <>
        <button
          type="button"
          className="mi-iconbtn"
          aria-label={t("action_edit")}
          title={t("action_edit")}
          onClick={() => setEditing(p)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
          </svg>
        </button>
        <button
          type="button"
          className="mi-iconbtn"
          aria-label={p.active ? t("action_deactivate") : t("action_reactivate")}
          title={p.active ? t("action_deactivate") : t("action_reactivate")}
          onClick={() => setToggling(p)}
        >
          {p.active ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
            </svg>
          )}
        </button>
      </>
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
            <span className="text-ink2 font-medium">{t("breadcrumb_products")}</span>
          </div>
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {t("heading")}
          </h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
          </p>
        </div>
        {canWrite && (
          <button data-tutorial="actions" className="mi-btn mi-btn--primary" onClick={() => setShowCreate(true)} aria-label={t("new_button")} title={t("new_button")}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            <span className="mi-btn__label">{t("new_button")}</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div data-tutorial="main" className="mi-card mi-shadow overflow-hidden flex flex-col flex-1 min-h-0">
        <FilterBar hasActive={Boolean(search || cat || stat)}>
        <div
          className="flex flex-wrap items-center gap-3 p-4 border-b"
          style={{ borderColor: "var(--c-line)" }}
        >
          <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-ink-3)" }}
            >
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
            </svg>
            <input
              className="mi-input"
              style={{ paddingLeft: 40, paddingTop: 8, paddingBottom: 8 }}
              placeholder={t("search_placeholder")}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <select
            className="mi-input"
            style={{ maxWidth: 220, paddingTop: 8, paddingBottom: 8 }}
            value={cat}
            onChange={(e) => { setCat(e.target.value); navigate({ category: e.target.value, page: 1 }); }}
          >
            <option value="">{t("all_categories")}</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{tCat(c)}</option>
            ))}
          </select>
          <select
            className="mi-input"
            style={{ maxWidth: 160, paddingTop: 8, paddingBottom: 8 }}
            value={stat}
            onChange={(e) => { setStat(e.target.value); navigate({ status: e.target.value, page: 1 }); }}
          >
            <option value="">{t("all_statuses")}</option>
            <option value="active">{t("status_active")}</option>
            <option value="inactive">{t("status_inactive")}</option>
          </select>
          <div className="flex-1" />
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("product_count", { count })}
          </span>
        </div>
        </FilterBar>

        <div className="hidden md:block md:flex-1 md:min-h-0 overflow-auto mi-table-scroll">
          <table className="mi-table">
            <thead>
              <tr>
                <th>{t("table_name")}</th>
                <th>{t("table_category")}</th>
                <th>{t("table_criticality")}</th>
                <th>{t("table_presentation")}</th>
                <th>{t("table_ean")}</th>
                <th>{t("table_unit")}</th>
                {canWrite && <th style={{ textAlign: "right" }}>{t("table_actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-ink3" style={{ textAlign: "center", padding: "32px 0" }}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} style={p.active ? undefined : { opacity: 0.55 }}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{p.name}</span>
                        {!p.active && (
                          <span className="mi-badge mi-badge--gray">{t("inactive_badge")}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {p.category ? (
                        <span className="mi-badge mi-badge--gray">{tCat(p.category)}</span>
                      ) : (
                        <span className="text-ink3">—</span>
                      )}
                    </td>
                    <td>
                      {p.criticality ? (
                        <span className={`mi-badge ${CRITICALITY_BADGE[p.criticality as ProductCriticality]}`}>
                          {tCrit(p.criticality)}
                        </span>
                      ) : (
                        <span className="text-ink3">—</span>
                      )}
                    </td>
                    <td className="text-ink2" style={{ fontSize: 13 }}>{p.presentation ?? "—"}</td>
                    <td className="text-ink3" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{p.ean ?? "—"}</td>
                    <td className="text-ink2" style={{ fontSize: 13 }}>{tUnit.has(p.unit) ? tUnit(p.unit) : p.unit}</td>
                    {canWrite && (
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
          {products.length === 0 ? (
            <div className="text-ink3" style={{ textAlign: "center", padding: "24px 0", fontSize: 14 }}>
              {t("empty")}
            </div>
          ) : (
            products.map((p) => (
              <DataCard
                key={p.id}
                header={
                  <span className="flex items-center gap-2" style={p.active ? undefined : { opacity: 0.6 }}>
                    <span className="font-semibold text-ink">{p.name}</span>
                    {!p.active && <span className="mi-badge mi-badge--gray">{t("inactive_badge")}</span>}
                  </span>
                }
              >
                <dl className="mi-dl">
                  <DataRow label={t("table_category")}>
                    {p.category ? <span className="mi-badge mi-badge--gray">{tCat(p.category)}</span> : "—"}
                  </DataRow>
                  <DataRow label={t("table_criticality")}>
                    {p.criticality ? (
                      <span className={`mi-badge ${CRITICALITY_BADGE[p.criticality as ProductCriticality]}`}>{tCrit(p.criticality)}</span>
                    ) : "—"}
                  </DataRow>
                  <DataRow label={t("table_presentation")}>{p.presentation ?? "—"}</DataRow>
                  <DataRow label={t("table_ean")}><span style={{ fontVariantNumeric: "tabular-nums" }}>{p.ean ?? "—"}</span></DataRow>
                  <DataRow label={t("table_unit")}>{tUnit.has(p.unit) ? tUnit(p.unit) : p.unit}</DataRow>
                  {canWrite && (
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
          onPageChange={(p) => navigate({ page: p })}
          onPageSizeChange={(s) => navigate({ size: s, page: 1 })}
        />
      </div>

      {showCreate && <ProductModal onClose={() => setShowCreate(false)} />}
      {editing && (
        <EditProductModal
          product={{
            id: editing.id,
            name: editing.name,
            ean: editing.ean,
            category: editing.category,
            criticality: editing.criticality,
            presentation: editing.presentation,
            unit: editing.unit,
            description: editing.description,
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {toggling && (
        <ProductActiveModal
          product={{ id: toggling.id, name: toggling.name, active: toggling.active }}
          onClose={() => setToggling(null)}
        />
      )}
    </div>
  );
}
