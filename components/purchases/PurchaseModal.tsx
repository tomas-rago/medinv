"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createPurchase, searchOrderProducts } from "@/app/(dashboard)/purchases/actions";
import type { CreatePurchaseResult, ProviderOption } from "@/app/(dashboard)/purchases/actions";
import { getProviderProducts } from "@/app/(dashboard)/providers/actions";
import type { ProductMatch } from "@/app/(dashboard)/stock/actions";

const initialState: CreatePurchaseResult = { ok: false, errors: {} };

type LineItem = {
  product_id: string;
  product_name: string;
  unit: string;
  quantity: string;
  unit_price: string;
};

interface PurchaseModalProps {
  providers: ProviderOption[];
  onClose: () => void;
}

export function PurchaseModal({ providers, onClose }: PurchaseModalProps) {
  const t = useTranslations("Purchases");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(createPurchase, initialState);
  const [items, setItems] = useState<LineItem[]>([]);
  const [providerId, setProviderId] = useState("");
  const [removedCount, setRemovedCount] = useState(0);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ProductMatch[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const providerRef = useRef("");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setMatches([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const providerAtSearch = providerRef.current;
      const results = await searchOrderProducts(value, providerAtSearch || undefined);
      // Discard results if the provider changed while the search was in flight.
      if (providerRef.current === providerAtSearch) setMatches(results);
    }, 300);
  }

  // Switching provider restricts the searchable catalog; lines the new
  // provider doesn't supply are dropped (with a visible notice), mirroring
  // the server-side validation in create_purchase.
  async function onProviderChange(value: string) {
    setProviderId(value);
    providerRef.current = value;
    setQuery("");
    setMatches([]);
    setRemovedCount(0);
    if (!value || items.length === 0) return;
    const provided = await getProviderProducts(value);
    const providedIds = new Set(provided.map((p) => p.id));
    setItems((prev) => {
      const kept = prev.filter((i) => providedIds.has(i.product_id));
      setRemovedCount(prev.length - kept.length);
      return kept;
    });
  }

  function addProduct(p: ProductMatch) {
    setItems((prev) =>
      prev.some((i) => i.product_id === p.id)
        ? prev
        : [...prev, { product_id: p.id, product_name: p.name, unit: p.unit, quantity: "1", unit_price: "" }]
    );
    setQuery("");
    setMatches([]);
  }

  function updateItem(productId: string, patch: Partial<Pick<LineItem, "quantity" | "unit_price">>) {
    setItems((prev) => prev.map((i) => (i.product_id === productId ? { ...i, ...patch } : i)));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }

  const itemsJson = JSON.stringify(
    items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      ...(i.unit_price.trim() === "" ? {} : { unit_price: i.unit_price }),
    }))
  );

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2.2l2.1 12.4a1.5 1.5 0 0 0 1.5 1.2h8.8a1.5 1.5 0 0 0 1.5-1.2L21 7H5.3"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("modal_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {t("modal_subtitle")}
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
          <form id="purchase-form" action={action}>
            <input type="hidden" name="items" value={itemsJson} />

            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="pur-provider" className="mi-label">{t("field_provider")}</label>
              <select
                id="pur-provider"
                name="provider_id"
                className="mi-input"
                value={providerId}
                onChange={(e) => onProviderChange(e.target.value)}
              >
                <option value="">{t("provider_none")}</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {providerId && (
                <p className="text-ink3 mt-1" style={{ fontSize: 12 }}>{t("provider_filter_hint")}</p>
              )}
              {removedCount > 0 && (
                <p className="mi-field-error mt-1">{t("items_removed_for_provider", { count: removedCount })}</p>
              )}
              {state.errors.provider_id?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field" style={{ position: "relative" }}>
              <label htmlFor="pur-prod-search" className="mi-label">{t("add_product_label")}</label>
              <input
                id="pur-prod-search"
                className="mi-input"
                placeholder={t("add_product_placeholder")}
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

            {items.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="mi-table">
                  <thead>
                    <tr>
                      <th>{t("line_product")}</th>
                      <th style={{ width: 110 }}>{t("line_quantity")}</th>
                      <th style={{ width: 140 }}>{t("line_unit_price")}</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.product_id}>
                        <td>
                          <span className="font-medium text-ink" style={{ fontSize: 14 }}>{i.product_name}</span>
                        </td>
                        <td>
                          <input
                            className="mi-input"
                            style={{ paddingTop: 6, paddingBottom: 6 }}
                            type="number"
                            min="0.01"
                            step="any"
                            aria-label={t("line_quantity")}
                            value={i.quantity}
                            onChange={(e) => updateItem(i.product_id, { quantity: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="mi-input"
                            style={{ paddingTop: 6, paddingBottom: 6 }}
                            type="number"
                            min="0"
                            step="any"
                            placeholder={t("line_unit_price_placeholder")}
                            aria-label={t("line_unit_price")}
                            value={i.unit_price}
                            onChange={(e) => updateItem(i.product_id, { unit_price: e.target.value })}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="mi-iconbtn"
                            aria-label={t("line_remove")}
                            title={t("line_remove")}
                            onClick={() => removeItem(i.product_id)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 6l12 12M18 6 6 18"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {items.length === 0 && (
              <p className="text-ink3 mt-3" style={{ fontSize: 13 }}>{t("items_empty")}</p>
            )}
            {state.errors.items?.map((e) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <p key={e} className="mi-field-error mt-2">{tVal(e as any)}</p>
            ))}

            <div className="mi-field">
              <label htmlFor="pur-notes" className="mi-label">{t("field_notes")}</label>
              <input id="pur-notes" name="notes" className="mi-input" placeholder={t("field_notes_placeholder")} autoComplete="off" />
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
          <button
            type="submit"
            form="purchase-form"
            disabled={isPending || items.length === 0}
            className="mi-btn mi-btn--primary"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {isPending ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
