"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { InviteModal } from "./InviteModal";
import { EditUserModal } from "./EditUserModal";
import { Pagination } from "@/components/ui/Pagination";
import { DataCard, DataRow } from "@/components/ui/DataCard";
import { FilterBar } from "@/components/ui/FilterBar";

type Profile = {
  id: string;
  full_name: string | null;
  role: "chief_doctor" | "doctor" | "nurse" | "administrative" | null;
  active: boolean;
  created_at: string;
};

const ROLE_TONES: Record<string, string> = {
  chief_doctor: "green",
  doctor: "blue",
  nurse: "amber",
  administrative: "gray",
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "var(--c-primary)",
  "var(--c-info)",
  "#8C7A52",
  "var(--c-accent)",
  "#7A8C52",
  "#5E8C7D",
];

interface UsersPageProps {
  profiles: Profile[];
  count: number;
  page: number;
  pageSize: number;
  q: string;
  isAdmin: boolean;
}

export function UsersPage({ profiles, count, page, pageSize, q, isAdmin }: UsersPageProps) {
  const t = useTranslations("Users");
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [search, setSearch] = useState(q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ROLE_LABELS: Record<string, string> = {
    chief_doctor: t("roles.chief_doctor"),
    doctor: t("roles.doctor"),
    nurse: t("roles.nurse"),
    administrative: t("roles.administrative"),
  };

  function navigate(next: { q?: string; page?: number; size?: number }) {
    const params = new URLSearchParams();
    const nq = next.q ?? search;
    const np = next.page ?? 1;
    const nsize = next.size ?? pageSize;
    if (nq) params.set("q", nq);
    if (np > 1) params.set("page", String(np));
    if (nsize !== 20) params.set("size", String(nsize));
    const qs = params.toString();
    router.push(qs ? `/users?${qs}` : "/users");
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => navigate({ q: value, page: 1 }), 400);
  }

  function fmtSince(value: string) {
    return new Date(value).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  }

  function roleBadge(p: Profile) {
    return (
      <span className={`mi-badge mi-badge--${ROLE_TONES[p.role ?? ""] ?? "gray"}`}>
        {ROLE_LABELS[p.role ?? ""] ?? p.role}
      </span>
    );
  }

  function statusPill(p: Profile) {
    return (
      <span className="inline-flex items-center gap-2 text-ink2" style={{ fontSize: 13 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.active ? "var(--c-ok)" : "var(--c-ink-3)" }} />
        {p.active ? t("status_active") : t("status_inactive")}
      </span>
    );
  }

  function rowActions(p: Profile) {
    return (
      <>
        <button className="mi-iconbtn" title={t("edit_tooltip")} onClick={() => setEditProfile(p)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
          </svg>
        </button>
        <button className="mi-iconbtn" title={t("more_tooltip")}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>
          </svg>
        </button>
      </>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-7"
      style={{ display: "flex", flexDirection: "column", gap: "var(--d-section-gap)" }}
    >
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-ink3 mb-1" style={{ fontSize: 13 }}>
            <span>{t("breadcrumb_account")}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            <span className="text-ink2 font-medium">{t("breadcrumb_users")}</span>
          </div>
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {t("heading")}
          </h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
          </p>
        </div>
        {isAdmin && (
          <button
            data-tutorial="actions"
            className="mi-btn mi-btn--primary"
            onClick={() => setShowInvite(true)}
            aria-label={t("invite_button")}
            title={t("invite_button")}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            <span className="mi-btn__label">{t("invite_button")}</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div data-tutorial="main" className="mi-card mi-shadow overflow-hidden flex flex-col flex-1 min-h-0">
        <FilterBar hasActive={Boolean(search)}>
        <div
          className="flex flex-wrap items-center gap-3 p-4 border-b"
          style={{ borderColor: "var(--c-line)" }}
        >
          <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
            <svg
              width="16" height="16"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-ink-3)" }}
            >
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
            </svg>
            <input
              className="mi-input"
              style={{ paddingLeft: 40, paddingTop: 8, paddingBottom: 8 }}
              placeholder={t("search_placeholder")}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="flex-1" />
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("user_count", { count })}
          </span>
        </div>
        </FilterBar>

        <div className="hidden md:block md:flex-1 md:min-h-0 overflow-auto mi-table-scroll">
          <table className="mi-table">
            <thead>
              <tr>
                <th>{t("table_user")}</th>
                <th>{t("table_role")}</th>
                <th>{t("table_status")}</th>
                <th>{t("table_since")}</th>
                {isAdmin && <th>{t("table_actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, idx) => {
                const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="mi-avatar" style={{ background: color }}>
                          {initials(p.full_name)}
                        </span>
                        <div className="leading-tight">
                          <div className="font-semibold text-ink">{p.full_name ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td>{roleBadge(p)}</td>
                    <td>{statusPill(p)}</td>
                    <td className="text-ink3" style={{ fontSize: 13 }}>{fmtSince(p.created_at)}</td>
                    {isAdmin && (
                      <td>
                        <div className="inline-flex gap-1">{rowActions(p)}</div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="flex-1 min-h-0 overflow-auto md:hidden p-3">
          {profiles.length === 0 ? (
            <div className="text-ink3" style={{ textAlign: "center", padding: "24px 0", fontSize: 14 }}>
              {t("empty")}
            </div>
          ) : (
            profiles.map((p, idx) => {
              const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              return (
                <DataCard
                  key={p.id}
                  header={
                    <span className="flex items-center gap-3">
                      <span className="mi-avatar" style={{ background: color }}>{initials(p.full_name)}</span>
                      <span className="font-semibold text-ink">{p.full_name ?? "—"}</span>
                    </span>
                  }
                  meta={roleBadge(p)}
                >
                  <dl className="mi-dl">
                    <DataRow label={t("table_status")}>{statusPill(p)}</DataRow>
                    <DataRow label={t("table_since")}>{fmtSince(p.created_at)}</DataRow>
                    {isAdmin && (
                      <DataRow label={t("table_actions")}>
                        <span className="inline-flex gap-1">{rowActions(p)}</span>
                      </DataRow>
                    )}
                  </dl>
                </DataCard>
              );
            })
          )}
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          count={count}
          onPageChange={(pg) => navigate({ page: pg })}
          onPageSizeChange={(s) => navigate({ size: s, page: 1 })}
        />
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {editProfile && (
        <EditUserModal profile={editProfile} onClose={() => setEditProfile(null)} />
      )}
    </div>
  );
}
