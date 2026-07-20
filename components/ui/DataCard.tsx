"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

interface DataCardProps {
  header: ReactNode;
  meta?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
}

// Expandable card used as the mobile replacement for a table row. The header
// (row's main identifier, plus optional right-aligned meta) is always visible
// and toggles the detail body. Pages map their bespoke row JSX into `children`.
export function DataCard({ header, meta, defaultExpanded = false, children }: DataCardProps) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(defaultExpanded);

  const toggle = () => setOpen((v) => !v);

  // The header is a div (not a button) with button semantics: some headers hold
  // interactive content — e.g. a detail <Link> — which is invalid nested inside
  // a <button>. Keyboard/ARIA are wired manually.
  return (
    <div className="mi-datacard" data-open={open}>
      <div
        className="mi-datacard-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? t("collapse") : t("expand")}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <span className="mi-datacard-title">{header}</span>
        {meta}
        <svg
          className="mi-datacard-chevron"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && <div className="mi-datacard-body">{children}</div>}
    </div>
  );
}

// One label/value pair inside a DataCard body. Wrap several in <dl className="mi-dl">.
export function DataRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="mi-dl-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
