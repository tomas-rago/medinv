"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { useTranslations } from "next-intl";

interface BarcodeScannerProps {
  onDetected: (ean: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const t = useTranslations("Scanner");
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);

  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | undefined;
    let stopped = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, ctrl) => {
        if (stopped) return;
        if (result) {
          stopped = true;
          ctrl.stop();
          onDetectedRef.current(result.getText());
        }
      })
      .then((ctrl) => {
        controls = ctrl;
        if (stopped) ctrl.stop();
      })
      .catch(() => setError("camera_denied"));

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const value = manual.trim();
    if (value) onDetectedRef.current(value);
  }

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 7v10M11 7v10M15 7v10M18 7v10"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                {t("title")}
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {t("subtitle")}
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
        <div className="p-5">
          {error ? (
            <p className="mi-field-error" style={{ marginBottom: 12 }}>{t(error)}</p>
          ) : (
            <div
              className="overflow-hidden rounded-xl"
              style={{ background: "#000", aspectRatio: "4 / 3", position: "relative" }}
            >
              <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} playsInline muted />
              <div
                style={{
                  position: "absolute", inset: "22% 12%", border: "2px solid rgba(255,255,255,.85)",
                  borderRadius: 12, boxShadow: "0 0 0 9999px rgba(0,0,0,.25)",
                }}
              />
            </div>
          )}

          <form onSubmit={submitManual} className="mi-field" style={{ marginTop: 16 }}>
            <label htmlFor="scan-manual" className="mi-label">{t("manual_label")}</label>
            <div className="flex gap-2">
              <input
                id="scan-manual"
                className="mi-input"
                inputMode="numeric"
                placeholder={t("manual_placeholder")}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
              <button type="submit" className="mi-btn mi-btn--soft">{t("use")}</button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
