"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { saveAlertSettings } from "@/app/(dashboard)/alerts/actions";
import type { SaveAlertSettingsResult } from "@/app/(dashboard)/alerts/actions";

const initialState: SaveAlertSettingsResult = { ok: false, errors: {} };

export type AlertSettings = {
  low_stock_enabled: boolean;
  expiry_enabled: boolean;
  expiry_days_ahead: number;
};

interface AlertSettingsModalProps {
  settings: AlertSettings;
  onClose: () => void;
}

export function AlertSettingsModal({ settings, onClose }: AlertSettingsModalProps) {
  const t = useTranslations("Alerts");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(saveAlertSettings, initialState);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("settings_title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {t("settings_subtitle")}
              </div>
            </div>
          </div>
          <button className="mi-iconbtn" onClick={onClose} aria-label={t("close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>

        <form action={action}>
          {/* Body */}
          <div className="p-5" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label className="flex items-center gap-3" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                name="low_stock_enabled"
                defaultChecked={settings.low_stock_enabled}
                style={{ width: 16, height: 16, accentColor: "var(--c-primary)" }}
              />
              <span>
                <span className="text-ink font-medium" style={{ display: "block", fontSize: 14 }}>
                  {t("settings_low_stock")}
                </span>
                <span className="text-ink3" style={{ fontSize: 13 }}>
                  {t("settings_low_stock_hint")}
                </span>
              </span>
            </label>

            <label className="flex items-center gap-3" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                name="expiry_enabled"
                defaultChecked={settings.expiry_enabled}
                style={{ width: 16, height: 16, accentColor: "var(--c-primary)" }}
              />
              <span>
                <span className="text-ink font-medium" style={{ display: "block", fontSize: 14 }}>
                  {t("settings_expiry")}
                </span>
                <span className="text-ink3" style={{ fontSize: 13 }}>
                  {t("settings_expiry_hint")}
                </span>
              </span>
            </label>

            <div>
              <label className="mi-label" htmlFor="expiry_days_ahead">
                {t("settings_expiry_days")}
              </label>
              <input
                id="expiry_days_ahead"
                name="expiry_days_ahead"
                type="number"
                min={1}
                max={365}
                defaultValue={settings.expiry_days_ahead}
                className="mi-input"
                style={{ maxWidth: 140 }}
              />
              {state.errors.expiry_days_ahead && (
                <p className="mi-field-error mt-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {tVal(state.errors.expiry_days_ahead[0] as any)}
                </p>
              )}
            </div>

            {state.errors._form && (
              <p className="mi-field-error">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {tErr(state.errors._form[0] as any)}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
            <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
              {t("cancel")}
            </button>
            <button type="submit" disabled={isPending} className="mi-btn mi-btn--primary">
              {isPending ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
