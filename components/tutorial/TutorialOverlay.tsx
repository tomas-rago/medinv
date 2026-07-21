"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TUTORIALS, type ScreenId, type TutorialStep } from "@/lib/tutorial/steps";

interface TutorialOverlayProps {
  screen: ScreenId;
  onClose: (completed: boolean) => void;
}

const SPOT_PADDING = 6;
const DIALOG_GAP = 12;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TutorialOverlay({ screen, onClose }: TutorialOverlayProps) {
  const t = useTranslations("Tutorial");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  // Resolve once on mount: drop steps whose target isn't in the DOM
  // (role-gated buttons, empty states), so the counter stays honest.
  const [steps] = useState<TutorialStep[]>(() =>
    TUTORIALS[screen].filter(
      (s) => !s.target || document.querySelector(`[data-tutorial="${s.target}"]`)
    )
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [measuredRect, setMeasuredRect] = useState<DOMRect | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  // Targetless steps render a plain backdrop; measuredRect may briefly hold
  // the previous step's box while the new target is being measured, which the
  // spotlight transition animates through.
  const rect = step?.target ? measuredRect : null;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Nothing worth touring (e.g. only the intro on an empty page with no main
  // card) — bail out.
  useEffect(() => {
    if (steps.length === 0) onCloseRef.current(true);
  }, [steps]);

  // Measure the current step's target; keep measuring on scroll/resize since
  // the page scrolls inside its own overflow-y-auto container, not the window.
  useEffect(() => {
    if (!step?.target) return;
    const el = document.querySelector(`[data-tutorial="${step.target}"]`);
    if (!el) return;

    const measure = () => setMeasuredRect(el.getBoundingClientRect());
    const reduced = prefersReducedMotion();
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    // Wait for the smooth scroll to settle before the first measurement.
    const timer = window.setTimeout(measure, reduced ? 0 : 350);

    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, { capture: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, { capture: true });
    };
  }, [step]);

  const goNext = useCallback(() => {
    if (isLast) onCloseRef.current(true);
    else setStepIndex((i) => i + 1);
  }, [isLast]);

  const goPrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => onCloseRef.current(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip, goNext, goPrev]);

  // Keep keyboard focus inside the tour as steps change.
  useEffect(() => {
    nextBtnRef.current?.focus();
  }, [stepIndex]);

  // Position the dialog relative to the spotlight (or center it).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const place = () => {
      const { width, height } = dialog.getBoundingClientRect();
      if (window.innerWidth < 640) {
        // Bottom sheet on small screens: skip the overlap math entirely.
        dialog.style.left = "12px";
        dialog.style.right = "12px";
        dialog.style.top = "auto";
        dialog.style.bottom = "12px";
        return;
      }
      dialog.style.right = "auto";
      dialog.style.bottom = "auto";
      if (!rect) {
        dialog.style.left = `${(window.innerWidth - width) / 2}px`;
        dialog.style.top = `${(window.innerHeight - height) / 2}px`;
        return;
      }
      let top = rect.bottom + SPOT_PADDING + DIALOG_GAP;
      if (top + height + 12 > window.innerHeight) {
        top = rect.top - SPOT_PADDING - DIALOG_GAP - height;
      }
      top = Math.min(Math.max(top, 12), window.innerHeight - height - 12);
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.min(Math.max(left, 12), window.innerWidth - width - 12);
      dialog.style.top = `${top}px`;
      dialog.style.left = `${left}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [rect, stepIndex]);

  if (steps.length === 0 || !step) return null;

  return (
    <>
      {/* Shield swallows page clicks while the tour is running. */}
      <div className="mi-tour-shield" onClick={skip} />
      {rect ? (
        <div
          className="mi-tour-spot"
          style={{
            top: rect.top - SPOT_PADDING,
            left: rect.left - SPOT_PADDING,
            width: rect.width + SPOT_PADDING * 2,
            height: rect.height + SPOT_PADDING * 2,
          }}
        />
      ) : (
        <div className="mi-tour-backdrop" />
      )}
      <div
        ref={dialogRef}
        className="mi-tour-dialog mi-fade"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div id={titleId} className="font-display text-ink" style={{ fontSize: 17 }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {t(`${screen}.${step.id}_title` as any)}
        </div>
        <p className="text-ink2 mt-2" style={{ fontSize: 14, lineHeight: 1.55 }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {t(`${screen}.${step.id}_body` as any)}
        </p>
        <div className="flex items-center gap-2 mt-4">
          <span className="text-ink3 flex-1" style={{ fontSize: 12.5 }}>
            {t("step_counter", { current: stepIndex + 1, total: steps.length })}
          </span>
          {!isLast && (
            <button type="button" className="mi-btn mi-btn--ghost mi-btn--sm" onClick={skip}>
              {t("skip")}
            </button>
          )}
          {stepIndex > 0 && (
            <button type="button" className="mi-btn mi-btn--ghost mi-btn--sm" onClick={goPrev}>
              {t("prev")}
            </button>
          )}
          <button
            ref={nextBtnRef}
            type="button"
            className="mi-btn mi-btn--primary mi-btn--sm"
            onClick={goNext}
          >
            {isLast ? t("done") : t("next")}
          </button>
        </div>
      </div>
    </>
  );
}
