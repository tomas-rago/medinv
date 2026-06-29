"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createProduct } from "@/app/(dashboard)/products/actions";
import type { CreateProductResult, ProductRow } from "@/app/(dashboard)/products/actions";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";

const UNIT_OPTIONS = ["unit", "box", "blister", "ampoule", "ml", "mg", "g"] as const;

const initialState: CreateProductResult = { ok: false, errors: {} };

interface ProductModalProps {
  onClose: () => void;
  onCreated?: (product: ProductRow) => void;
  initialEan?: string;
}

export function ProductModal({ onClose, onCreated, initialEan }: ProductModalProps) {
  const t = useTranslations("Products");
  const tCat = useTranslations("Categories");
  const tUnit = useTranslations("Units");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(createProduct, initialState);
  const [ean, setEan] = useState(initialEan ?? "");
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (state.ok && state.product) {
      onCreated?.(state.product);
      onClose();
    }
  }, [state.ok, state.product, onCreated, onClose]);

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
          <form id="product-form" action={action}>
            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="prod-name" className="mi-label">{t("field_name")}</label>
              <input id="prod-name" name="name" className="mi-input" placeholder={t("field_name_placeholder")} autoComplete="off" autoFocus />
              {state.errors.name?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="prod-category" className="mi-label">{t("field_category")}</label>
              <select id="prod-category" name="category" className="mi-input" defaultValue="">
                <option value="">{t("category_none")}</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{tCat(c)}</option>
                ))}
              </select>
            </div>

            <div className="mi-field">
              <label htmlFor="prod-ean" className="mi-label">{t("field_ean")}</label>
              <div className="flex gap-2">
                <input
                  id="prod-ean"
                  name="ean"
                  className="mi-input"
                  inputMode="numeric"
                  placeholder={t("field_ean_placeholder")}
                  autoComplete="off"
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                />
                <button type="button" className="mi-btn mi-btn--soft" onClick={() => setShowScanner(true)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 7v10M11 7v10M15 7v10"/>
                  </svg>
                  {t("scan")}
                </button>
              </div>
              {state.errors.ean?.map((e) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p key={e} className="mi-field-error">{tVal(e as any)}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="prod-presentation" className="mi-label">{t("field_presentation")}</label>
              <input id="prod-presentation" name="presentation" className="mi-input" placeholder={t("field_presentation_placeholder")} autoComplete="off" />
            </div>

            <div className="mi-field">
              <label htmlFor="prod-unit" className="mi-label">{t("field_unit")}</label>
              <select id="prod-unit" name="unit" className="mi-input" defaultValue="unit">
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{tUnit(u)}</option>
                ))}
              </select>
            </div>

            <div className="mi-field">
              <label htmlFor="prod-description" className="mi-label">{t("field_description")}</label>
              <input id="prod-description" name="description" className="mi-input" placeholder={t("field_description_placeholder")} autoComplete="off" />
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
          <button type="submit" form="product-form" disabled={isPending} className="mi-btn mi-btn--primary">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {isPending ? t("saving") : t("save")}
          </button>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner
          onDetected={(code) => {
            setEan(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
