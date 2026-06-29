"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { InviteModal } from "./InviteModal";
import { EditUserModal } from "./EditUserModal";

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

export function UsersPage({ profiles, isAdmin }: { profiles: Profile[]; isAdmin: boolean }) {
  const t = useTranslations("Users");
  const [showInvite, setShowInvite] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);

  const ROLE_LABELS: Record<string, string> = {
    chief_doctor: t("roles.chief_doctor"),
    doctor: t("roles.doctor"),
    nurse: t("roles.nurse"),
    administrative: t("roles.administrative"),
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-7 py-7"
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
            className="mi-btn mi-btn--primary"
            onClick={() => setShowInvite(true)}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            {t("invite_button")}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mi-card mi-shadow overflow-hidden">
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
            />
          </div>
          <div className="flex-1" />
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("user_count", { count: profiles.length })}
          </span>
        </div>

        <div className="overflow-x-auto">
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
                    <td>
                      <span className={`mi-badge mi-badge--${ROLE_TONES[p.role ?? ""] ?? "gray"}`}>
                        {ROLE_LABELS[p.role ?? ""] ?? p.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center gap-2 text-ink2"
                        style={{ fontSize: 13 }}
                      >
                        <span
                          style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: p.active ? "var(--c-ok)" : "var(--c-ink-3)",
                          }}
                        />
                        {p.active ? t("status_active") : t("status_inactive")}
                      </span>
                    </td>
                    <td className="text-ink3" style={{ fontSize: 13 }}>
                      {new Date(p.created_at).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="inline-flex gap-1">
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
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {editProfile && (
        <EditUserModal profile={editProfile} onClose={() => setEditProfile(null)} />
      )}
    </div>
  );
}
