"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ReceptorModal } from "./ReceptorModal";
import { EditReceptorModal } from "./EditReceptorModal";
import type { EditableReceptor } from "./EditReceptorModal";
import { ReceptorActiveModal } from "./ReceptorActiveModal";

type Receptor = {
  id: string;
  name: string;
  external_id: string | null;
  patient_type: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

interface ReceptorsPageProps {
  receptors: Receptor[];
  count: number;
  page: number;
  pageSize: number;
  q: string;
  status: string;
  canCreate: boolean;
  canManage: boolean;
}

export function ReceptorsPage({ receptors, count, page, pageSize, q, status, canCreate, canManage }: ReceptorsPageProps) {
  const t = useTranslations("Receptors");
  const tPT = useTranslations("PatientTypes");
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EditableReceptor | null>(null);
  const [toggling, setToggling] = useState<Receptor | null>(null);
  const [search, setSearch] = useState(q);
  const [stat, setStat] = useState(status);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const rangeFrom = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, count);

  const colCount = canManage ? 6 : 5;

  function navigate(next: { q?: string; status?: string; page?: number }) {
    const params = new URLSearchParams();
    const nq = next.q ?? search;
    const ns = next.status ?? stat;
    const np = next.page ?? 1;
    if (nq) params.set("q", nq);
    if (ns) params.set("status", ns);
    if (np > 1) params.set("page", String(np));
    const qs = params.toString();
    router.push(qs ? `/receptors?${qs}` : "/receptors");
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => navigate({ q: value, page: 1 }), 400);
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
            <span>{t("breadcrumb_operation")}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
            <span className="text-ink2 font-medium">{t("breadcrumb_receptors")}</span>
          </div>
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {t("heading")}
          </h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
          </p>
        </div>
        {canCreate && (
          <button data-tutorial="actions" className="mi-btn mi-btn--primary" onClick={() => setShowCreate(true)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            {t("new_button")}
          </button>
        )}
      </div>

      {/* Table */}
      <div data-tutorial="main" className="mi-card mi-shadow overflow-hidden">
        <div
          className="flex flex-wrap items-center gap-3 p-4 border-b"
          style={{ borderColor: "var(--c-line)" }}
        >
          <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
          <select
            className="mi-input"
            style={{ maxWidth: 160, paddingTop: 8, paddingBottom: 8 }}
            value={stat}
            onChange={(e) => { setStat(e.target.value); navigate({ status: e.target.value, page: 1 }); }}
          >
            <option value="">{t("all_statuses")}</option>
            <option value="active">{t("status_active")}</option>
            <option value="inactive">{t("status_inactive")}</option>
          </select>
          <div className="flex-1" />
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("receptor_count", { count })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="mi-table">
            <thead>
              <tr>
                <th>{t("table_name")}</th>
                <th>{t("table_external_id")}</th>
                <th>{t("table_patient_type")}</th>
                <th>{t("table_phone")}</th>
                <th>{t("table_email")}</th>
                {canManage && <th style={{ textAlign: "right" }}>{t("table_actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {receptors.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-ink3" style={{ textAlign: "center", padding: "32px 0" }}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                receptors.map((r) => (
                  <tr key={r.id} style={r.active ? undefined : { opacity: 0.55 }}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{r.name}</span>
                        {!r.active && (
                          <span className="mi-badge mi-badge--gray">{t("inactive_badge")}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-ink3" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{r.external_id ?? "—"}</td>
                    <td>
                      {r.patient_type ? (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <span className="mi-badge mi-badge--gray">{tPT(r.patient_type as any)}</span>
                      ) : (
                        <span className="text-ink3" style={{ fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td className="text-ink3" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{r.phone ?? "—"}</td>
                    <td className="text-ink2" style={{ fontSize: 13 }}>{r.email ?? "—"}</td>
                    {canManage && (
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="mi-iconbtn"
                            aria-label={t("action_edit")}
                            title={t("action_edit")}
                            onClick={() => setEditing(r)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="mi-iconbtn"
                            aria-label={r.active ? t("action_deactivate") : t("action_reactivate")}
                            title={r.active ? t("action_deactivate") : t("action_reactivate")}
                            onClick={() => setToggling(r)}
                          >
                            {r.active ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-3 p-4 border-t" style={{ borderColor: "var(--c-line)" }}>
          <span className="text-ink3" style={{ fontSize: 13 }}>
            {t("pagination_range", { from: rangeFrom, to: rangeTo, total: count })}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="mi-btn mi-btn--ghost mi-btn--sm"
              disabled={page <= 1}
              onClick={() => navigate({ page: page - 1 })}
            >
              {t("prev")}
            </button>
            <span className="text-ink2" style={{ fontSize: 13 }}>
              {t("page_of", { page, total: totalPages })}
            </span>
            <button
              className="mi-btn mi-btn--ghost mi-btn--sm"
              disabled={page >= totalPages}
              onClick={() => navigate({ page: page + 1 })}
            >
              {t("next")}
            </button>
          </div>
        </div>
      </div>

      {showCreate && <ReceptorModal onClose={() => setShowCreate(false)} />}
      {editing && (
        <EditReceptorModal
          receptor={{
            id: editing.id,
            name: editing.name,
            external_id: editing.external_id,
            patient_type: editing.patient_type,
            phone: editing.phone,
            email: editing.email,
            notes: editing.notes,
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {toggling && (
        <ReceptorActiveModal
          receptor={{ id: toggling.id, name: toggling.name, active: toggling.active }}
          onClose={() => setToggling(null)}
        />
      )}
    </div>
  );
}
