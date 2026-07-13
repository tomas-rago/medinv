"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { searchProducts } from "@/app/(dashboard)/stock/actions";
import type { ProductMatch } from "@/app/(dashboard)/stock/actions";
import { searchReceptors } from "@/app/(dashboard)/receptors/actions";
import type { ReceptorRow } from "@/app/(dashboard)/receptors/actions";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";
import { PRODUCT_CRITICALITIES } from "@/lib/constants/criticality";
import { MOVEMENT_TYPES } from "@/lib/schemas/stock/filters";
import type { MovementFilters } from "@/lib/schemas/stock/filters";
import { movementsUrl, hasActiveFilters } from "./movements-url";

interface MovementsFilterBarProps {
  filters: MovementFilters;
  providers: { id: string; name: string }[];
  // Names of the entities behind the product/receptor uuid params, resolved
  // server-side so the chips survive a reload.
  selectedProductName: string | null;
  selectedReceptorName: string | null;
}

// Debounced entity search combobox (product / receptor pickers of the report
// filter bar). Selection is communicated upward as an id.
function FilterCombobox<T extends { id: string }>({
  id,
  placeholder,
  selectedName,
  search,
  renderResult,
  onSelect,
  onClear,
}: {
  id: string;
  placeholder: string;
  selectedName: string | null;
  search: (term: string) => Promise<T[]>;
  renderResult: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const reqId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function onChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = value.trim();
    if (term.length < 2) {
      reqId.current++;
      setResults([]);
      return;
    }
    const current = ++reqId.current;
    timerRef.current = setTimeout(async () => {
      const res = await search(term);
      if (current !== reqId.current) return; // stale response
      setResults(res);
    }, 300);
  }

  if (selectedName) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-xl px-3"
        style={{
          border: "1px solid var(--c-line)",
          background: "var(--c-primary-t)",
          fontSize: 13,
          height: 38,
          maxWidth: 200,
        }}
      >
        <span className="truncate font-medium text-ink">{selectedName}</span>
        <button
          type="button"
          className="mi-iconbtn"
          style={{ width: 22, height: 22, flexShrink: 0 }}
          aria-label="×"
          onClick={onClear}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M18 6 6 18"/>
          </svg>
        </button>
      </span>
    );
  }

  return (
    <div className="relative" style={{ minWidth: 160, maxWidth: 200 }}>
      <input
        id={id}
        className="mi-input"
        style={{ paddingTop: 8, paddingBottom: 8 }}
        placeholder={placeholder}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {results.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: 4,
            border: "1px solid var(--c-line)",
            background: "var(--c-surface)",
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
          }}
        >
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full text-left px-3 py-2"
              style={{ borderBottom: "1px solid var(--c-line)", fontSize: 13 }}
              onClick={() => {
                setResults([]);
                setQuery("");
                onSelect(item);
              }}
            >
              {renderResult(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MovementsFilterBar({
  filters,
  providers,
  selectedProductName,
  selectedReceptorName,
}: MovementsFilterBarProps) {
  const t = useTranslations("Stock");
  const tCat = useTranslations("Categories");
  const tCrit = useTranslations("Criticality");
  const router = useRouter();

  function navigate(next: Partial<MovementFilters>) {
    // Merge onto current filters; undefined values drop the param. Any filter
    // change resets pagination.
    const merged: MovementFilters = { ...filters, ...next };
    for (const key of Object.keys(merged) as (keyof MovementFilters)[]) {
      if (merged[key] === undefined) delete merged[key];
    }
    router.push(movementsUrl(merged));
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 p-4 border-b"
      style={{ borderColor: "var(--c-line)" }}
    >
      <FilterCombobox<ProductMatch>
        id="mov-filter-product"
        placeholder={t("filter_product")}
        selectedName={selectedProductName}
        search={searchProducts}
        renderResult={(p) => (
          <span className="font-medium text-ink">{p.name}</span>
        )}
        onSelect={(p) => navigate({ product: p.id })}
        onClear={() => navigate({ product: undefined })}
      />

      <FilterCombobox<ReceptorRow>
        id="mov-filter-receptor"
        placeholder={t("filter_receptor")}
        selectedName={selectedReceptorName}
        search={searchReceptors}
        renderResult={(r) => (
          <span className="font-medium text-ink">
            {r.name}
            {r.external_id ? <span className="text-ink3"> · {r.external_id}</span> : null}
          </span>
        )}
        onSelect={(r) => navigate({ receptor: r.id })}
        onClear={() => navigate({ receptor: undefined })}
      />

      <select
        className="mi-input"
        style={{ maxWidth: 170, paddingTop: 8, paddingBottom: 8 }}
        value={filters.category ?? ""}
        onChange={(e) => navigate({ category: (e.target.value || undefined) as MovementFilters["category"] })}
      >
        <option value="">{t("filter_all_categories")}</option>
        {PRODUCT_CATEGORIES.map((c) => (
          <option key={c} value={c}>{tCat(c)}</option>
        ))}
      </select>

      <select
        className="mi-input"
        style={{ maxWidth: 150, paddingTop: 8, paddingBottom: 8 }}
        value={filters.type ?? ""}
        onChange={(e) => navigate({ type: (e.target.value || undefined) as MovementFilters["type"] })}
      >
        <option value="">{t("filter_all_types")}</option>
        {MOVEMENT_TYPES.map((mt) => (
          <option key={mt} value={mt}>{t(`type_${mt}`)}</option>
        ))}
      </select>

      <select
        className="mi-input"
        style={{ maxWidth: 150, paddingTop: 8, paddingBottom: 8 }}
        value={filters.crit ?? ""}
        onChange={(e) => navigate({ crit: (e.target.value || undefined) as MovementFilters["crit"] })}
      >
        <option value="">{t("filter_all_criticalities")}</option>
        {PRODUCT_CRITICALITIES.map((c) => (
          <option key={c} value={c}>{tCrit(c)}</option>
        ))}
      </select>

      <select
        className="mi-input"
        style={{ maxWidth: 170, paddingTop: 8, paddingBottom: 8 }}
        value={filters.provider ?? ""}
        onChange={(e) => navigate({ provider: e.target.value || undefined })}
      >
        <option value="">{t("filter_all_providers")}</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <label className="flex items-center gap-1 text-ink3" style={{ fontSize: 13 }}>
        {t("filter_from")}
        <input
          type="date"
          className="mi-input"
          style={{ maxWidth: 150, paddingTop: 8, paddingBottom: 8 }}
          value={filters.from ?? ""}
          max={filters.to ?? undefined}
          onChange={(e) => navigate({ from: e.target.value || undefined })}
        />
      </label>
      <label className="flex items-center gap-1 text-ink3" style={{ fontSize: 13 }}>
        {t("filter_to")}
        <input
          type="date"
          className="mi-input"
          style={{ maxWidth: 150, paddingTop: 8, paddingBottom: 8 }}
          value={filters.to ?? ""}
          min={filters.from ?? undefined}
          onChange={(e) => navigate({ to: e.target.value || undefined })}
        />
      </label>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          className="mi-btn mi-btn--ghost mi-btn--sm"
          onClick={() =>
            navigate({
              product: undefined,
              category: undefined,
              type: undefined,
              crit: undefined,
              provider: undefined,
              receptor: undefined,
              from: undefined,
              to: undefined,
            })
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M18 6 6 18"/>
          </svg>
          {t("clear_filters")}
        </button>
      )}
    </div>
  );
}
