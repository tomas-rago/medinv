"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { resolveScreenId, tutorialStorageKey } from "@/lib/tutorial/steps";
import { TutorialOverlay } from "./TutorialOverlay";

const subscribeNoop = () => () => {};

/**
 * Mounted once in DashboardShell. Resolves the current screen from the
 * pathname, auto-starts its tour on first visit (localStorage flag) and
 * renders a floating help button to replay it.
 */
export function TutorialProvider() {
  const t = useTranslations("Tutorial");
  const pathname = usePathname();
  const screen = resolveScreenId(pathname);
  const [active, setActive] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);

  // Portal + localStorage are client-only: render nothing until hydrated.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  // End any running tour on navigation without marking it seen (state
  // adjustment during render, same pattern as DashboardShell's drawer).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setActive(false);
  }

  useEffect(() => {
    if (!screen) return;
    if (localStorage.getItem(tutorialStorageKey(screen))) return;
    // Small delay so the page content paints before the spotlight measures it.
    const timer = window.setTimeout(() => setActive(true), 600);
    return () => window.clearTimeout(timer);
  }, [screen]);

  if (!mounted || !screen) return null;

  return createPortal(
    active ? (
      <TutorialOverlay
        screen={screen}
        onClose={(completed) => {
          localStorage.setItem(tutorialStorageKey(screen), completed ? "done" : "skipped");
          setActive(false);
          fabRef.current?.focus();
        }}
      />
    ) : (
      <button
        ref={fabRef}
        type="button"
        className="mi-help-fab"
        aria-label={t("help_button")}
        title={t("help_button")}
        onClick={() => setActive(true)}
      >
        <svg aria-hidden="true">
          <use href="#i-help" />
        </svg>
      </button>
    ),
    document.body
  );
}
