"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { registerStockExit, searchProducts, getProductStock } from "@/app/(dashboard)/stock/actions";
import type { ProductMatch, StockExitResult } from "@/app/(dashboard)/stock/actions";
import dynamic from "next/dynamic";
import { ProductModal } from "@/components/products/ProductModal";

// Loaded on demand so the heavy @zxing barcode lib never blocks this modal
// (or the page that opens it) — important for older mobile browsers.
const BarcodeScanner = dynamic(
  () => import("@/components/scanner/BarcodeScanner").then((m) => m.BarcodeScanner),
  { ssr: false }
);

const initialState: StockExitResult = { ok: false, errors: {} };

interface StockExitModalProps {
  onClose: () => void;
}

export function StockExitModal({ onClose }: StockExitModalProps) {
  const t = useTranslations("Stock");
  const tCat = useTranslations("Categories");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(registerStockExit, initialState);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<ProductMatch | null>(null);
  const [available, setAvailable] = useState<number | null>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [createEan, setCreateEan] = useState<string | null>(null); // non-null => create modal open

  const reqId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  // Clear any pending debounce timer on unmount.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Debounced product search, driven from input/scanner handlers (not an effect).
  function scheduleSearch(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = value.trim();
    if (term.length < 2) {
      reqId.current++;
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const current = ++reqId.current;
    timerRef.current = setTimeout(async () => {
      const res = await searchProducts(term);
      if (current !== reqId.current) return; // stale response
      setResults(res);
      setSearched(true);
      setSearching(false);
    }, 300);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    scheduleSearch(value);
  }

  async function pick(p: ProductMatch) {
    setSelected(p);
    setResults([]);
    setSearched(false);
    setAvailable(null);
    const qty = await getProductStock(p.id);
    setAvailable(qty);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setAvailable(null);
  }

  const numericQuery = /^\d{6,14}$/.test(query.trim());

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-danger-t, var(--c-primary-t))", color: "var(--c-danger, var(--c-primary-d))" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("exit_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {t("exit_subtitle")}
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
          {/* Product lookup */}
          {selected ? (
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "var(--c-primary-t)", border: "1px solid var(--c-line)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink truncate">{selected.name}</div>
                <div className="text-ink2 truncate" style={{ fontSize: 12 }}>
                  {selected.category ? tCat(selected.category) : t("no_category")}
                  {selected.ean ? ` · ${selected.ean}` : ""}
                </div>
                {available !== null && (
                  <div className="text-ink3" style={{ fontSize: 12, marginTop: 2 }}>
                    {t("available_qty", { qty: available })}
                  </div>
                )}
              </div>
              <button type="button" className="mi-btn mi-btn--ghost mi-btn--sm" onClick={clearSelection}>
                {t("change_product")}
              </button>
            </div>
          ) : (
            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="stk-search" className="mi-label">{t("product_label")}</label>
              <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-ink-3)" }}
                  >
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
                  </svg>
                  <input
                    id="stk-search"
                    className="mi-input"
                    style={{ paddingLeft: 40 }}
                    placeholder={t("product_search_placeholder")}
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <button type="button" className="mi-btn mi-btn--soft" onClick={() => setShowScanner(true)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 7v10M11 7v10M15 7v10"/>
                  </svg>
                  {t("scan")}
                </button>
              </div>

              {/* Results dropdown — floats over form content, scrollable when > 4 items */}
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
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 flex items-center gap-3"
                      style={{ borderBottom: "1px solid var(--c-line)" }}
                      onClick={() => pick(p)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink truncate">{p.name}</div>
                        <div className="text-ink3 truncate" style={{ fontSize: 12 }}>
                          {p.category ? tCat(p.category) : t("no_category")}
                          {p.ean ? ` · ${p.ean}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              </div>{/* end relative anchor */}

              {searching && (
                <p className="text-ink3 mt-2" style={{ fontSize: 13 }}>{t("searching")}</p>
              )}

              {/* No match → offer creating it */}
              {!searching && searched && results.length === 0 && (
                <div
                  className="flex items-center justify-between gap-3 mt-2 p-3 rounded-xl"
                  style={{ background: "var(--c-surface-2)", fontSize: 13 }}
                >
                  <span className="text-ink2">{t("no_results")}</span>
                  <button
                    type="button"
                    className="mi-btn mi-btn--soft mi-btn--sm"
                    onClick={() => setCreateEan(numericQuery ? query.trim() : "")}
                  >
                    {t("create_product")}
                  </button>
                </div>
              )}

              <button
                type="button"
                className="mi-btn mi-btn--ghost mi-btn--sm mt-2"
                onClick={() => setCreateEan("")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                {t("create_product_new")}
              </button>
            </div>
          )}

          {/* Exit details — only meaningful once a product is chosen */}
          <form id="stock-exit-form" action={action}>
            <input type="hidden" name="product_id" value={selected?.id ?? ""} />

            <div className="mi-field">
              <label htmlFor="stk-qty" className="mi-label">{t("quantity_label")}</label>
              <input
                id="stk-qty"
                name="quantity"
                type="number"
                min="0"
                step="any"
                max={available ?? undefined}
                className="mi-input"
                placeholder={t("quantity_placeholder")}
                disabled={!selected}
                autoComplete="off"
              />
              {state.errors.quantity?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
              {state.errors.product_id?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="stk-notes" className="mi-label">{t("notes_label")}</label>
              <input id="stk-notes" name="notes" className="mi-input" placeholder={t("notes_placeholder")} disabled={!selected} autoComplete="off" />
            </div>

            {state.errors._form && (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <p className="mi-field-error mt-3">{tErr(state.errors._form[0] as any)}</p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="stock-exit-form" disabled={isPending || !selected} className="mi-btn mi-btn--primary">
            {isPending ? t("saving") : t("register_exit")}
          </button>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner
          onDetected={(code) => {
            setSelected(null);
            setQuery(code);
            scheduleSearch(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {createEan !== null && (
        <ProductModal
          initialEan={createEan}
          onClose={() => setCreateEan(null)}
          onCreated={(product) => {
            setCreateEan(null);
            pick(product);
          }}
        />
      )}
    </div>
  );
}
