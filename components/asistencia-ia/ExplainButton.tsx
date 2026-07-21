"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createNdjsonParser } from "@/lib/ai/wire";
import type { ExplainScreen } from "@/lib/schemas/asistencia-ia/explain";

// "Analizar con IA" header button + modal for the one-shot screen analysis.
// The request carries only the screen id (and product for the detail screen);
// the server rebuilds the data itself. Rendered only when the org has AI
// access — the server pages gate it.

interface ExplainButtonProps {
  screen: ExplainScreen;
  productId?: string;
}

function SparkleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4z" />
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </svg>
  );
}

export function ExplainButton({ screen, productId }: ExplainButtonProps) {
  const t = useTranslations("AsistenciaIA");
  const tErr = useTranslations("Errors");

  const [open, setOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async () => {
    if (streaming) return;
    setText("");
    setErrorKey(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen, ...(productId ? { productId } : {}) }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let key = "ai_unavailable";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") key = data.error;
        } catch {
          // Non-JSON failure body; keep the generic key.
        }
        setErrorKey(key);
        return;
      }

      const parser = createNdjsonParser((event) => {
        if (event.type === "text") {
          setText((prev) => prev + event.delta);
        } else if (event.type === "error") {
          setErrorKey(event.key);
        } else if (event.type === "done" && event.truncated) {
          setErrorKey("ai_response_truncated");
        }
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.flush();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setErrorKey("ai_unavailable");
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [screen, productId, streaming]);

  const openAndRun = useCallback(() => {
    setOpen(true);
    void run();
  }, [run]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  return (
    <>
      <button className="mi-btn mi-btn--soft" onClick={openAndRun} aria-label={t("explain_button")} title={t("explain_button")}>
        <SparkleIcon size={17} />
        <span className="mi-btn__label">{t("explain_button")}</span>
      </button>

      {open && (
        <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="mi-modal mi-shadow-lg mi-fade" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
              <div className="flex items-center gap-3">
                <span
                  className="grid place-items-center w-10 h-10 rounded-xl"
                  style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
                >
                  <SparkleIcon size={20} />
                </span>
                <div>
                  <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                    {t("explain_title")}
                  </div>
                  <div className="text-ink2" style={{ fontSize: 13 }}>
                    {t("explain_subtitle")}
                  </div>
                </div>
              </div>
              <button className="mi-iconbtn" onClick={close} aria-label={t("close")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {text.length === 0 && streaming && !errorKey && (
                <span className="flex items-center gap-2 text-ink3" style={{ fontSize: 13 }}>
                  <svg
                    className="animate-spin"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  {t("explain_loading")}
                </span>
              )}
              {text.length > 0 && (
                <p className="whitespace-pre-wrap text-ink" style={{ fontSize: 14 }}>
                  {text}
                  {streaming && (
                    <span
                      className="inline-block align-baseline ml-0.5"
                      style={{
                        width: 7,
                        height: 14,
                        background: "var(--c-primary)",
                        animation: "pulse 1s ease-in-out infinite",
                      }}
                    />
                  )}
                </p>
              )}
              {errorKey && (
                <p className="mi-field-error mt-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {tErr(errorKey as any)}
                </p>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between gap-3 p-4 border-t"
              style={{ borderColor: "var(--c-line)" }}
            >
              <p className="text-ink3" style={{ fontSize: 11 }}>
                {t("disclaimer")}
              </p>
              <button className="mi-btn mi-btn--soft" onClick={() => void run()} disabled={streaming}>
                {t("explain_retry")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
