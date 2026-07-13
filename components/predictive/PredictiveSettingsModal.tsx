"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { savePredictiveSettings } from "@/app/(dashboard)/predictive/actions";
import type { SavePredictiveSettingsResult } from "@/app/(dashboard)/predictive/actions";
import type { PredictiveSettingsRow } from "@/lib/predictive/data";

const initialState: SavePredictiveSettingsResult = { ok: false, errors: {} };

interface PredictiveSettingsModalProps {
  settings: PredictiveSettingsRow | null;
  onClose: () => void;
}

export function PredictiveSettingsModal({ settings, onClose }: PredictiveSettingsModalProps) {
  const t = useTranslations("Predictive");
  const tCrit = useTranslations("Criticality");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");

  const [state, action, isPending] = useActionState(savePredictiveSettings, initialState);

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
                <path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>
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
            <div>
              <label className="mi-label" htmlFor="lead_time_days">
                {t("settings_lead_time")}
              </label>
              <input
                id="lead_time_days"
                name="lead_time_days"
                type="number"
                min={1}
                max={365}
                defaultValue={settings?.lead_time_days ?? ""}
                placeholder={t("settings_lead_time_auto_placeholder")}
                className="mi-input"
                style={{ maxWidth: 140 }}
              />
              <p className="text-ink3 mt-1" style={{ fontSize: 12 }}>
                {t("settings_lead_time_hint")}
              </p>
              {state.errors.lead_time_days && (
                <p className="mi-field-error mt-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {tVal(state.errors.lead_time_days[0] as any)}
                </p>
              )}
            </div>

            <div>
              <label className="mi-label" htmlFor="coverage_days">
                {t("settings_coverage_days")}
              </label>
              <input
                id="coverage_days"
                name="coverage_days"
                type="number"
                min={1}
                max={365}
                defaultValue={settings?.coverage_days ?? 30}
                className="mi-input"
                style={{ maxWidth: 140 }}
              />
              <p className="text-ink3 mt-1" style={{ fontSize: 12 }}>
                {t("settings_coverage_days_hint")}
              </p>
              {state.errors.coverage_days && (
                <p className="mi-field-error mt-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {tVal(state.errors.coverage_days[0] as any)}
                </p>
              )}
            </div>

            <div>
              <span className="mi-label">{t("settings_safety_title")}</span>
              <p className="text-ink3 mb-2" style={{ fontSize: 12 }}>
                {t("settings_safety_hint")}
              </p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    ["safety_days_vital", "vital", 7],
                    ["safety_days_essential", "essential", 3],
                    ["safety_days_desirable", "desirable", 0],
                  ] as const
                ).map(([field, level, fallback]) => (
                  <div key={field}>
                    <label className="text-ink2" htmlFor={field} style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
                      {tCrit(level)}
                    </label>
                    <input
                      id={field}
                      name={field}
                      type="number"
                      min={0}
                      max={365}
                      defaultValue={settings?.[field] ?? fallback}
                      className="mi-input"
                      style={{ maxWidth: 90 }}
                    />
                    {state.errors[field] && (
                      <p className="mi-field-error mt-1">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {tVal(state.errors[field][0] as any)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
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
