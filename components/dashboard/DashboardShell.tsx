"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui/Logo";

interface DashboardShellProps {
  sidebar: React.ReactNode;
  alertCount: number;
  children: React.ReactNode;
}

export function DashboardShell({ sidebar, alertCount, children }: DashboardShellProps) {
  const t = useTranslations("Sidebar");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever navigation happens (state adjustment during
  // render instead of an effect: https://react.dev/learn/you-might-not-need-an-effect).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="h-screen flex overflow-hidden">
      <div className={`mi-drawer ${open ? "is-open" : ""}`}>{sidebar}</div>
      {open && <div className="mi-drawer-scrim" onClick={() => setOpen(false)} />}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="mi-topbar">
          <button
            type="button"
            className="mi-iconbtn"
            aria-label={t("open_menu")}
            onClick={() => setOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Logo size="sm" href="/dashboard" />
          <div className="flex-1" />
          <Link href="/alerts" className="mi-iconbtn" aria-label={t("nav.alerts")} style={{ position: "relative" }}>
            <svg width="19" height="19" aria-hidden="true">
              <use href="#i-bell" />
            </svg>
            {alertCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: "var(--c-danger)",
                }}
              />
            )}
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
