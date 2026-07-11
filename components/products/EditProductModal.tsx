"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { updateProduct } from "@/app/(dashboard)/products/actions";
import type { UpdateProductResult } from "@/app/(dashboard)/products/actions";
import dynamic from "next/dynamic";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";
import { PRODUCT_CRITICALITIES } from "@/lib/constants/criticality";

// Loaded on demand so the heavy @zxing barcode lib never blocks this modal
// (or the page that opens it) — important for older mobile browsers.
const BarcodeScanner = dynamic(
  () => import("@/components/scanner/BarcodeScanner").then((m) => m.BarcodeScanner),
  { ssr: false }
);

const UNIT_OPTIONS = ["unit", "box", "blister", "ampoule", "ml", "mg", "g"] as const;

const initialState: UpdateProductResult = { ok: false, errors: {} };

export type EditableProduct = {
  id: string;
  name: string;
  ean: string | null;
  category: string | null;
  criticality: string | null;
  presentation: string | null;
  unit: string;
  description: string | null;
};

interface EditProductModalProps {
  product: EditableProduct;
  onClose: () => void;
}

export function EditProductModal({ product, onClose }: EditProductModalProps) {
  const t = useTranslations("Products");
  const tCat = useTranslations("Categories");
  const tCrit = useTranslations("Criticality");
  const tUnit = useTranslations("Units");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(updateProduct, initialState);
  const [ean, setEan] = useState(product.ean ?? "");
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

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
                <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("edit_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {t("edit_subtitle")}
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
          <form id="product-edit-form" action={action}>
            <input type="hidden" name="id" value={product.id} />

            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="prod-name" className="mi-label">{t("field_name")}</label>
              {/* Name is locked for historical accuracy — shown disabled, not submitted. */}
              <input id="prod-name" className="mi-input" value={product.name} disabled readOnly />
              <p className="text-ink3 mt-1" style={{ fontSize: 12 }}>{t("name_locked_hint")}</p>
            </div>

            <div className="mi-field">
              <label htmlFor="prod-category" className="mi-label">{t("field_category")}</label>
              <select id="prod-category" name="category" className="mi-input" defaultValue={product.category ?? ""}>
                <option value="">{t("category_none")}</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{tCat(c)}</option>
                ))}
              </select>
            </div>

            <div className="mi-field">
              <label htmlFor="prod-criticality" className="mi-label">{t("field_criticality")}</label>
              <select id="prod-criticality" name="criticality" className="mi-input" defaultValue={product.criticality ?? ""}>
                <option value="">{t("criticality_none")}</option>
                {PRODUCT_CRITICALITIES.map((c) => (
                  <option key={c} value={c}>{tCrit(c)}</option>
                ))}
              </select>
              <p className="text-ink3 mt-1" style={{ fontSize: 12 }}>
                {t("field_criticality_hint")}
              </p>
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
              <input id="prod-presentation" name="presentation" className="mi-input" placeholder={t("field_presentation_placeholder")} autoComplete="off" defaultValue={product.presentation ?? ""} />
            </div>

            <div className="mi-field">
              <label htmlFor="prod-unit" className="mi-label">{t("field_unit")}</label>
              <select id="prod-unit" name="unit" className="mi-input" defaultValue={product.unit}>
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{tUnit(u)}</option>
                ))}
              </select>
            </div>

            <div className="mi-field">
              <label htmlFor="prod-description" className="mi-label">{t("field_description")}</label>
              <input id="prod-description" name="description" className="mi-input" placeholder={t("field_description_placeholder")} autoComplete="off" defaultValue={product.description ?? ""} />
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
          <button type="submit" form="product-edit-form" disabled={isPending} className="mi-btn mi-btn--primary">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            {isPending ? t("saving") : t("save_changes")}
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
