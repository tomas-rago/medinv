import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";

interface SidebarProps {
  activeSection: string;
  profile: { full_name: string | null; role: string };
  hasAiAccess?: boolean;
}

interface NavItem {
  id: string;
  href: string;
  icon: string;
  label: string;
  badge?: string;
  badgeTone?: string;
  adminOnly?: boolean;
}

function Icon({ id }: { id: string }) {
  const paths: Record<string, React.ReactNode> = {
    "i-home": <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></>,
    "i-pill": <><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(45 12 12)"/><path d="m9 9 6 6"/></>,
    "i-cart": <><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2.2l2.1 12.4a1.5 1.5 0 0 0 1.5 1.2h8.8a1.5 1.5 0 0 0 1.5-1.2L21 7H5.3"/></>,
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

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export async function Sidebar({ activeSection, profile, hasAiAccess = false }: SidebarProps) {
  const t = await getTranslations("Sidebar");

  const ROLE_LABELS: Record<string, string> = {
    admin: t("roles.admin"),
    operator: t("roles.operator"),
    read_only: t("roles.read_only"),
  };

  const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
    {
      label: t("groups.general"),
      items: [{ id: "panel", href: "/dashboard", icon: "i-home", label: t("nav.panel") }],
    },
    {
      label: t("groups.operation"),
      items: [
        { id: "inventario", href: "/stock", icon: "i-pill", label: t("nav.inventory"), badge: "12", badgeTone: "danger" },
        { id: "compras", href: "/purchases", icon: "i-cart", label: t("nav.purchases") },
        { id: "personal", href: "/users", icon: "i-users", label: t("nav.users"), adminOnly: true },
      ],
    },
    {
      label: t("groups.account"),
      items: [
        { id: "suscripcion", href: "/cuenta/suscripcion", icon: "i-card", label: t("nav.subscription"), adminOnly: true },
        {
          id: "ia",
          href: hasAiAccess ? "/asistencia-ia" : "#",
          icon: "i-spark",
          label: t("nav.ai"),
          ...(hasAiAccess ? {} : { badge: "Pro", badgeTone: "amber" }),
        } as NavItem,
      ],
    },
  ];

  return (
    <aside
      className="w-[260px] flex-none flex flex-col border-r"
      style={{ background: "var(--c-sidebar)", borderColor: "var(--c-line)" }}
    >
      <div
        className="px-5 flex items-center border-b"
        style={{ height: 64, borderColor: "color-mix(in srgb,var(--c-line) 70%,transparent)" }}
      >
        <Logo size="sm" href="/dashboard" />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="mi-nav-label mt-4 mb-1">{group.label}</div>
            {group.items.map((item) => {
              if (item.adminOnly && profile.role !== "admin") return null;
              const isActive = activeSection === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`mi-nav-item ${isActive ? "is-active" : ""}`}
                >
                  <Icon id={item.icon} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className={`mi-badge mi-badge--${item.badgeTone ?? "gray"}`} style={{ padding: "2px 8px", fontSize: 11 }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: "color-mix(in srgb,var(--c-line) 70%,transparent)" }}>
        <Link href="/settings" className="mi-nav-item">
          <Icon id="i-settings" />
          <span>{t("nav.settings")}</span>
        </Link>
        <div
          className="flex items-center gap-2 px-3 py-2 mt-1 rounded-xl"
          style={{ background: "color-mix(in srgb,var(--c-primary) 8%,transparent)" }}
        >
          <span className="mi-avatar" style={{ background: "var(--c-primary)" }}>
            {initials(profile.full_name)}
          </span>
          <div className="leading-tight flex-1 min-w-0">
            <div className="font-semibold text-ink truncate" style={{ fontSize: 13 }}>
              {profile.full_name ?? t("user_fallback")}
            </div>
            <div className="text-ink3 truncate" style={{ fontSize: 12 }}>
              {ROLE_LABELS[profile.role] ?? profile.role}
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <Link href="/login" className="mi-iconbtn" title={t("logout")}>
              <Icon id="i-logout" />
            </Link>
          </form>
        </div>
      </div>
    </aside>
  );
}
