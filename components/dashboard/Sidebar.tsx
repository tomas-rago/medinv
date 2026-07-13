import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import { SidebarNav, SidebarNavLink, type SidebarNavGroup, type SidebarNavItem } from "./SidebarNav";

interface SidebarProps {
  profile: { full_name: string | null; role: string };
  hasAiAccess?: boolean;
  alertCount?: number;
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export async function Sidebar({ profile, hasAiAccess = false, alertCount = 0 }: SidebarProps) {
  const t = await getTranslations("Sidebar");

  const ROLE_LABELS: Record<string, string> = {
    chief_doctor: t("roles.chief_doctor"),
    doctor: t("roles.doctor"),
    nurse: t("roles.nurse"),
    administrative: t("roles.administrative"),
  };

  type NavItem = SidebarNavItem & { adminOnly?: boolean };

  const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
    {
      label: t("groups.general"),
      items: [{ id: "panel", href: "/dashboard", icon: "i-home", label: t("nav.panel") }],
    },
    {
      label: t("groups.operation"),
      items: [
        { id: "insumos", href: "/products", icon: "i-box", label: t("nav.products") },
        { id: "inventario", href: "/stock", icon: "i-pill", label: t("nav.inventory") },
        {
          id: "alertas",
          href: "/alerts",
          icon: "i-bell",
          label: t("nav.alerts"),
          ...(alertCount > 0 ? { badge: String(alertCount), badgeTone: "danger" } : {}),
        } as NavItem,
        { id: "compras", href: "/purchases", icon: "i-cart", label: t("nav.purchases") },
        { id: "proveedores", href: "/providers", icon: "i-truck", label: t("nav.providers") },
        { id: "receptores", href: "/receptors", icon: "i-user", label: t("nav.receptors") },
        { id: "prediccion", href: "/predictive", icon: "i-chart", label: t("nav.predictive") },
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

  const groups: SidebarNavGroup[] = NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => !item.adminOnly || profile.role === "chief_doctor"),
  }));

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

      <SidebarNav groups={groups} />

      <div className="p-3 border-t" style={{ borderColor: "color-mix(in srgb,var(--c-line) 70%,transparent)" }}>
        <SidebarNavLink
          item={{ id: "ajustes", href: "/settings", icon: "i-settings", label: t("nav.settings") }}
        />
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
              <svg width="19" height="19" aria-hidden="true">
                <use href="#i-logout" />
              </svg>
            </Link>
          </form>
        </div>
      </div>
    </aside>
  );
}
