"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { searchProducts } from "@/app/(dashboard)/stock/actions";
import type { ProductMatch } from "@/app/(dashboard)/stock/actions";
import { getProviderProducts, setProviderProducts } from "@/app/(dashboard)/providers/actions";

type SelectedProduct = { id: string; name: string };

interface ProviderProductsModalProps {
  provider: { id: string; name: string };
  onClose: () => void;
}

export function ProviderProductsModal({ provider, onClose }: ProviderProductsModalProps) {
  const t = useTranslations("Providers");
  const tErr = useTranslations("Errors");

  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ProductMatch[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProviderProducts(provider.id).then((products) => {
      if (!cancelled) {
        setSelected(products);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider.id]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setMatches([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const results = await searchProducts(value);
      setMatches(results);
    }, 300);
  }

  function addProduct(p: ProductMatch) {
    setSelected((prev) => (prev.some((s) => s.id === p.id) ? prev : [...prev, { id: p.id, name: p.name }]));
    setQuery("");
    setMatches([]);
  }

  function removeProduct(id: string) {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }

  const handleSave = async () => {
    setIsPending(true);
    setErrorKey(null);
    const result = await setProviderProducts(
      provider.id,
      selected.map((s) => s.id)
    );
    setIsPending(false);
    if (result.ok) {
      onClose();
    } else {
      setErrorKey(result.error ?? "unexpected");
    }
  };

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("products_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {provider.name}
              </div>
            </div>
          </div>
          <button className="mi-iconbtn" onClick={onClose} aria-label={t("close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <div className="mi-field" style={{ marginTop: 0, position: "relative" }}>
            <label htmlFor="prov-prod-search" className="mi-label">{t("products_search_label")}</label>
            <input
              id="prov-prod-search"
              className="mi-input"
              placeholder={t("products_search_placeholder")}
              autoComplete="off"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            {matches.length > 0 && (
              <div
                className="mi-card mi-shadow-lg"
                style={{
                  position: "absolute", left: 0, right: 0, top: "100%", zIndex: 20,
                  marginTop: 4, maxHeight: 220, overflowY: "auto",
                }}
              >
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-black/5"
                    style={{ fontSize: 14 }}
                    onClick={() => addProduct(m)}
                  >
                    <span className="font-medium text-ink">{m.name}</span>
                    {m.presentation && (
                      <span className="text-ink3" style={{ fontSize: 12, marginLeft: 8 }}>{m.presentation}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="mi-label mb-2">{t("products_selected", { count: selected.length })}</div>
            {loading ? (
              <p className="text-ink3" style={{ fontSize: 13 }}>{t("loading")}</p>
            ) : selected.length === 0 ? (
              <p className="text-ink3" style={{ fontSize: 13 }}>{t("products_empty")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selected.map((s) => (
                  <span key={s.id} className="mi-badge mi-badge--gray inline-flex items-center gap-1.5">
                    {s.name}
                    <button
                      type="button"
                      aria-label={t("products_remove", { name: s.name })}
                      onClick={() => removeProduct(s.id)}
                      style={{ display: "inline-flex", alignItems: "center" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 6l12 12M18 6 6 18"/>
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {errorKey && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <p className="mi-field-error mt-4">{tErr(errorKey as any)}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={isPending || loading}
            className="mi-btn mi-btn--primary"
            onClick={handleSave}
          >
            {isPending ? t("saving") : t("save_changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
