"use client";

import { useTranslations } from "next-intl";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

interface PaginationProps {
  page: number;
  pageSize: number;
  count: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({ page, pageSize, count, onPageChange, onPageSizeChange }: PaginationProps) {
  const t = useTranslations("Common");

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const rangeFrom = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, count);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 p-4 border-t"
      style={{ borderColor: "var(--c-line)" }}
    >
      <div className="flex items-center gap-3">
        <span className="text-ink3" style={{ fontSize: 13 }}>
          {t("pagination_range", { from: rangeFrom, to: rangeTo, total: count })}
        </span>
        <label className="flex items-center gap-2 text-ink3" style={{ fontSize: 13 }}>
          <span className="hidden sm:inline">{t("rows_per_page")}</span>
          <select
            className="mi-input"
            style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 8, width: "auto" }}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label={t("rows_per_page")}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="mi-btn mi-btn--ghost mi-btn--sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t("prev")}
        </button>
        <span className="text-ink2" style={{ fontSize: 13 }}>
          {t("page_of", { page, total: totalPages })}
        </span>
        <button
          className="mi-btn mi-btn--ghost mi-btn--sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
