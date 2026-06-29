"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProductModal } from "./ProductModal";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";

type Product = {
  id: string;
  name: string;
  ean: string | null;
  presentation: string | null;
  category: string | null;
  unit: string;
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
  canWrite: boolean;
}

export function ProductsPage({ products, count, page, pageSize, q, category, canWrite }: ProductsPageProps) {
  const t = useTranslations("Products");
  const tCat = useTranslations("Categories");
  const tUnit = useTranslations("Units");
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState(q);
  const [cat, setCat] = useState(category);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const rangeFrom = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, count);

  function navigate(next: { q?: string; category?: string; page?: number }) {
    const params = new URLSearchParams();
    const nq = next.q ?? search;
    const nc = next.category ?? cat;
    const np = next.page ?? 1;
    if (nq) params.set("q", nq);
    if (nc) params.set("category", nc);
    if (np > 1) params.set("page", String(np));
    const qs = params.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => navigate({ q: value, page: 1 }), 400);
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
          <button className="mi-btn mi-btn--primary" onClick={() => setShowCreate(true)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            {t("new_button")}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mi-card mi-shadow overflow-hidden">
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
          <div className="flex-1" />
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("product_count", { count })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="mi-table">
            <thead>
              <tr>
                <th>{t("table_name")}</th>
                <th>{t("table_category")}</th>
                <th>{t("table_presentation")}</th>
                <th>{t("table_ean")}</th>
                <th>{t("table_unit")}</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-ink3" style={{ textAlign: "center", padding: "32px 0" }}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-semibold text-ink">{p.name}</div>
                    </td>
                    <td>
                      {p.category ? (
                        <span className="mi-badge mi-badge--gray">{tCat(p.category)}</span>
                      ) : (
                        <span className="text-ink3">—</span>
                      )}
                    </td>
                    <td className="text-ink2" style={{ fontSize: 13 }}>{p.presentation ?? "—"}</td>
                    <td className="text-ink3" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{p.ean ?? "—"}</td>
                    <td className="text-ink2" style={{ fontSize: 13 }}>{tUnit.has(p.unit) ? tUnit(p.unit) : p.unit}</td>
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
            <button
              className="mi-btn mi-btn--ghost mi-btn--sm"
              disabled={page <= 1}
              onClick={() => navigate({ page: page - 1 })}
            >
              {t("prev")}
            </button>
            <span className="text-ink2" style={{ fontSize: 13 }}>
              {t("page_of", { page, total: totalPages })}
            </span>
            <button
              className="mi-btn mi-btn--ghost mi-btn--sm"
              disabled={page >= totalPages}
              onClick={() => navigate({ page: page + 1 })}
            >
              {t("next")}
            </button>
          </div>
        </div>
      </div>

      {showCreate && <ProductModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
