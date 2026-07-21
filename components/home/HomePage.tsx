import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { canWriteInventory, canManagePurchases } from "@/lib/constants/roles";
import type { DashboardSummary } from "@/lib/schemas/asistencia-ia/dashboard-summary";
import { DashboardSummaryCard } from "./DashboardSummaryCard";

export interface AtRiskItem {
  product_id: string;
  product_name: string;
  daysUntilReorder: number;
  suggestedQuantity: number | null;
  currentStock: number;
}

interface HomePageProps {
  fullName: string | null;
  role: string;
  alertCount: number;
  reorderSoonCount: number;
  pendingPurchases: number;
  hasAiAccess: boolean;
  // Non-null only for chief_doctor: predictive oversight section.
  atRisk: AtRiskItem[] | null;
  // Chief-doctor + AI-access only: whether to show the AI summary tile, and its
  // cached content (null on first-ever visit — the tile generates it).
  showAiSummary: boolean;
  initialSummary: DashboardSummary | null;
}

function fmtQty(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function IconTile({ id, color = "var(--c-primary)" }: { id: string; color?: string }) {
  return (
    <span
      className="flex-none"
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        display: "inline-grid",
        placeItems: "center",
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <svg width={20} height={20} aria-hidden="true">
        <use href={`#${id}`} />
      </svg>
    </span>
  );
}

export async function HomePage({
  fullName,
  role,
  alertCount,
  reorderSoonCount,
  pendingPurchases,
  hasAiAccess,
  atRisk,
  showAiSummary,
  initialSummary,
}: HomePageProps) {
  const t = await getTranslations("Home");
  const tSidebar = await getTranslations("Sidebar");

  const firstName = fullName?.trim().split(/\s+/)[0];
  const roleLabel = ["chief_doctor", "doctor", "nurse", "administrative"].includes(role)
    ? tSidebar(`roles.${role}`)
    : role;

  const kpis = [
    {
      id: "alerts",
      href: "/alerts",
      icon: "i-bell",
      value: alertCount,
      tone: alertCount > 0 ? "var(--c-danger)" : undefined,
    },
    {
      id: "reorder",
      href: "/predictive",
      icon: "i-chart",
      value: reorderSoonCount,
      tone: reorderSoonCount > 0 ? "var(--c-warn)" : undefined,
    },
    {
      id: "purchases",
      href: "/purchases",
      icon: "i-cart",
      value: pendingPurchases,
      tone: undefined,
    },
  ];

  const isChief = role === "chief_doctor";
  const shortcuts = [
    { id: "stock", href: "/stock", icon: "i-pill", descKey: canWriteInventory(role) ? "desc_write" : "desc_read", show: true },
    { id: "products", href: "/products", icon: "i-box", descKey: "desc", show: true },
    { id: "alerts", href: "/alerts", icon: "i-bell", descKey: "desc", show: true },
    { id: "purchases", href: "/purchases", icon: "i-cart", descKey: canManagePurchases(role) ? "desc_write" : "desc_read", show: true },
    { id: "providers", href: "/providers", icon: "i-truck", descKey: "desc", show: true },
    { id: "predictive", href: "/predictive", icon: "i-chart", descKey: "desc", show: true },
    { id: "users", href: "/users", icon: "i-users", descKey: "desc", show: isChief },
    { id: "subscription", href: "/cuenta/suscripcion", icon: "i-card", descKey: "desc", show: isChief },
    { id: "ai", href: "/asistencia-ia", icon: "i-spark", descKey: "desc", show: hasAiAccess },
  ].filter((s) => s.show);

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-7"
      // Grid, not flex-column: this element has a definite height (flex-1 inside
      // the h-screen shell), so as a flex container its children would shrink to
      // fit — and cards carrying `overflow-hidden` have an automatic minimum
      // size of 0, so they were squashed and their content cropped. Grid rows
      // size to their content; align-content:start keeps them from stretching.
      style={{
        display: "grid",
        // minmax(0, 1fr) keeps a wide child (a table, a chart) from stretching
        // the column past the viewport instead of scrolling inside its own box.
        gridTemplateColumns: "minmax(0, 1fr)",
        alignContent: "start",
        gap: "var(--d-section-gap)",
      }}
    >
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-ink3 mb-1" style={{ fontSize: 13 }}>
            <span>{t("breadcrumb")}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            <span className="text-ink2 font-medium">{tSidebar("nav.panel")}</span>
          </div>
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {firstName ? t("greeting", { name: firstName }) : t("greeting_fallback")}
          </h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
          </p>
        </div>
        <span className="mi-badge mi-badge--blue">{roleLabel}</span>
      </div>

      {/* KPI tiles */}
      <div data-tutorial="kpis" className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Link
            key={kpi.id}
            href={kpi.href}
            className="mi-card mi-shadow flex items-center gap-4"
            style={{ padding: "var(--d-card-pad)" }}
          >
            <IconTile id={kpi.icon} color={kpi.tone ?? "var(--c-primary)"} />
            <div className="min-w-0">
              <div
                className="font-display leading-none"
                style={{ fontSize: 30, color: kpi.tone ?? "var(--c-ink)" }}
              >
                {kpi.value}
              </div>
              <div className="text-ink2 mt-1" style={{ fontSize: 13 }}>
                {t(`kpi.${kpi.id}`)}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Chief-only AI management summary */}
      {showAiSummary && <DashboardSummaryCard initialSummary={initialSummary} />}

      {/* Chief-only predictive oversight */}
      {atRisk !== null && (
        <div data-tutorial="main" className="mi-card mi-shadow overflow-hidden">
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3"
          >
            <div>
              <h2 className="font-semibold text-ink" style={{ fontSize: 16 }}>
                {t("risk.title")}
              </h2>
              <p className="text-ink3" style={{ fontSize: 13 }}>
                {t("risk.subtitle")}
              </p>
            </div>
            <Link href="/predictive" className="mi-btn mi-btn--ghost mi-btn--sm">
              {t("risk.view_all")}
            </Link>
          </div>
          {atRisk.length === 0 ? (
            <p className="text-ink3 px-5 pb-5" style={{ fontSize: 14 }}>
              {t("risk.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="mi-table">
                <thead>
                  <tr>
                    <th>{t("risk.col_product")}</th>
                    <th>{t("risk.col_stock")}</th>
                    <th>{t("risk.col_when")}</th>
                    <th>{t("risk.col_qty")}</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((item) => (
                    <tr key={item.product_id}>
                      <td>
                        <Link
                          href={`/predictive/${item.product_id}`}
                          className="font-semibold text-ink hover:underline"
                        >
                          {item.product_name}
                        </Link>
                      </td>
                      <td className="text-ink2">{fmtQty(item.currentStock)}</td>
                      <td>
                        {item.daysUntilReorder === 0 ? (
                          <span className="mi-badge mi-badge--danger">{t("risk.order_now")}</span>
                        ) : (
                          <span className="mi-badge mi-badge--amber">
                            {t("risk.in_days", { days: item.daysUntilReorder })}
                          </span>
                        )}
                      </td>
                      <td className="text-ink2">
                        {item.suggestedQuantity !== null && item.suggestedQuantity > 0
                          ? t("risk.qty_units", { quantity: fmtQty(item.suggestedQuantity) })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Shortcuts */}
      <div>
        <h2 className="font-semibold text-ink mb-3" style={{ fontSize: 16 }}>
          {t("shortcuts.title")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              className="mi-card mi-shadow flex items-start gap-3"
              style={{ padding: "var(--d-card-pad)" }}
            >
              <IconTile id={s.icon} />
              <div className="min-w-0">
                <div className="font-semibold text-ink" style={{ fontSize: 14 }}>
                  {t(`shortcuts.${s.id}.title`)}
                </div>
                <p className="text-ink3 mt-0.5" style={{ fontSize: 13 }}>
                  {t(`shortcuts.${s.id}.${s.descKey}`)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
