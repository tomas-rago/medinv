"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Wraps a table-card filter/search strip and makes it collapsible below md.
// The strip is passed through untouched as children; on mobile a toggle row is
// shown above it and the strip is hidden via a CSS class (never unmounted), so
// debounced search inputs keep their in-flight state across toggles. At md+ the
// toggle is hidden and the strip is always visible — desktop is unchanged.
export function FilterBar({
  hasActive = false,
  children,
}: {
  hasActive?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle — hidden at md+. border-b only while collapsed so we
          never double up with the strip's own border-b. */}
      <button
        type="button"
        className={`md:hidden w-full flex items-center gap-2 px-4 py-3 text-ink2 ${open ? "" : "border-b"}`}
        style={{ borderColor: "var(--c-line)", fontSize: 14, fontWeight: 600 }}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5h18l-7 8v6l-4-2v-4z" />
        </svg>
        <span>{t("filters")}</span>
        {hasActive && (
          <span className="ml-0.5 inline-block rounded-full"
            style={{ width: 7, height: 7, background: "var(--c-primary)" }} />
        )}
        <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {/* Strip: hidden while collapsed on mobile; always shown at md+. Class
          toggle keeps children mounted so debounce/state survive. */}
      <div className={open ? "" : "hidden md:block"}>{children}</div>
    </>
  );
}
