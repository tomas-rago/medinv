"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarNavItem {
  id: string;
  href: string;
  icon: string;
  label: string;
  badge?: string;
  badgeTone?: string;
}

export interface SidebarNavGroup {
  label: string;
  items: SidebarNavItem[];
}

function Icon({ id }: { id: string }) {
  const paths: Record<string, React.ReactNode> = {
    "i-home": <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></>,
    "i-pill": <><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(45 12 12)"/><path d="m9 9 6 6"/></>,
    "i-box": <><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></>,
    "i-cart": <><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2.2l2.1 12.4a1.5 1.5 0 0 0 1.5 1.2h8.8a1.5 1.5 0 0 0 1.5-1.2L21 7H5.3"/></>,
    "i-truck": <><path d="M1 5h13v11H1z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="5.5" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/></>,
    "i-bell": <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
    "i-chart": <><path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/></>,
    "i-users": <><circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6"/><path d="M17.5 14.2A6 6 0 0 1 21 20"/></>,
    "i-card": <><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></>,
    "i-spark": <><path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></>,
    "i-settings": <><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"/></>,
    "i-logout": <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5M15 12H3"/></>,
  };
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[id]}
    </svg>
  );
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

export function SidebarNavLink({ item }: { item: SidebarNavItem }) {
  const isActive = useIsActive()(item.href);
  return (
    <Link href={item.href} className={`mi-nav-item ${isActive ? "is-active" : ""}`}>
      <Icon id={item.icon} />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className={`mi-badge mi-badge--${item.badgeTone ?? "gray"}`} style={{ padding: "2px 8px", fontSize: 11 }}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function SidebarNav({ groups }: { groups: SidebarNavGroup[] }) {
  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-1">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mi-nav-label mt-4 mb-1">{group.label}</div>
          {group.items.map((item) => (
            <SidebarNavLink key={item.id} item={item} />
          ))}
        </div>
      ))}
    </nav>
  );
}
