"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SummaryChart } from "./SummaryChart";
import type {
  DashboardSummary,
  DashboardSummaryContent,
} from "@/lib/schemas/asistencia-ia/dashboard-summary";

// Chief-doctor AI management summary tile. Rendered only when the server has
// already gated on role === chief_doctor && hasAiAccess.
//
// Caching model (the point of the feature): the server passes the org's cached
// summary as initialSummary. If present, it renders instantly and never calls
// the model on its own — only the Regenerate button does. If absent (first ever
// visit), it auto-generates exactly once on mount. This keeps the costly call
// from firing on every dashboard entry.

interface DashboardSummaryCardProps {
  initialSummary: DashboardSummary | null;
}

function SparkleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} aria-hidden="true">
      <use href="#i-spark" />
    </svg>
  );
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

function relFromNow(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function DashboardSummaryCard({ initialSummary }: DashboardSummaryCardProps) {
  const t = useTranslations("Home");
  const tErr = useTranslations("Errors");

  const [content, setContent] = useState<DashboardSummaryContent | null>(
    initialSummary?.content ?? null
  );
  const [generatedAt, setGeneratedAt] = useState<string | null>(
    initialSummary?.generatedAt ?? null
  );
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setErrorKey(null);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/ai/dashboard-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErrorKey(
          typeof data?.error === "string" ? data.error : "ai_unavailable"
        );
        return;
      }
      setContent(data.content as DashboardSummaryContent);
      setGeneratedAt(typeof data.generatedAt === "string" ? data.generatedAt : null);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setErrorKey("ai_unavailable");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [loading]);

  // Auto-generate once on first-ever visit (no cached summary). The ref guards
  // against React strict-mode's double mount firing two costly calls.
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (!initialSummary && !didAutoRun.current) {
      didAutoRun.current = true;
      void generate();
    }
  }, [initialSummary, generate]);

  return (
    <div data-tutorial="ai-summary" className="mi-card mi-shadow overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <span
            className="grid place-items-center w-10 h-10 rounded-xl flex-none"
            style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
          >
            <SparkleIcon size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-ink" style={{ fontSize: 16 }}>
              {t("aiSummary.title")}
            </h2>
            <p className="text-ink3" style={{ fontSize: 13 }}>
              {loading ? (
                t("aiSummary.generating")
              ) : generatedAt ? (
                // Relative time depends on the client clock; suppress the rare
                // unit-boundary hydration mismatch instead of an effect.
                <span suppressHydrationWarning>
                  {t("aiSummary.generatedAgo", { time: relFromNow(generatedAt) })}
                </span>
              ) : (
                t("aiSummary.subtitle")
              )}
            </p>
          </div>
        </div>
        <button
          className="mi-btn mi-btn--soft mi-btn--sm"
          onClick={() => void generate()}
          disabled={loading}
        >
          {loading ? <Spinner /> : <SparkleIcon size={15} />}
          <span className="mi-btn__label">
            {content ? t("aiSummary.regenerate") : t("aiSummary.generate")}
          </span>
        </button>
      </div>

      {/* Body */}
      <div className="px-5 pb-5" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {loading && !content && (
          <span className="flex items-center gap-2 text-ink3" style={{ fontSize: 13 }}>
            <Spinner size={12} />
            {t("aiSummary.generating")}
          </span>
        )}

        {errorKey && (
          <p className="mi-field-error">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {tErr(errorKey as any)}
          </p>
        )}

        {content && (
          <>
            <div>
              <p className="font-semibold text-ink" style={{ fontSize: 15 }}>
                {content.headline}
              </p>
              <p className="whitespace-pre-wrap text-ink2 mt-1" style={{ fontSize: 14 }}>
                {content.summary}
              </p>
            </div>

            {content.actions.length > 0 && (
              <div>
                <h3 className="font-semibold text-ink mb-2" style={{ fontSize: 13 }}>
                  {t("aiSummary.actionsTitle")}
                </h3>
                <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {content.actions.map((action, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-ink2"
                      style={{ fontSize: 14 }}
                    >
                      <span
                        aria-hidden
                        className="flex-none"
                        style={{
                          marginTop: 6,
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: "var(--c-primary)",
                        }}
                      />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {content.chart && (
              <div className="mi-card" style={{ padding: 16, background: "var(--c-surface-2, transparent)" }}>
                <SummaryChart spec={content.chart} />
              </div>
            )}

            <p className="text-ink3" style={{ fontSize: 11 }}>
              {t("aiSummary.disclaimer")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
