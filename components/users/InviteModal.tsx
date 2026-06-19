"use client";

import { useActionState, useEffect } from "react";
import { inviteUser } from "@/app/(dashboard)/users/actions";
import type { InviteResult } from "@/app/(dashboard)/users/actions";

const initialState: InviteResult = { ok: false, errors: {} };

const ROLE_OPTIONS = [
  { value: "operator", label: "Operador — puede gestionar stock y compras" },
  { value: "read_only", label: "Solo lectura — puede consultar, no modificar" },
];

interface InviteModalProps {
  onClose: () => void;
}

export function InviteModal({ onClose }: InviteModalProps) {
  const [state, action, isPending] = useActionState(inviteUser, initialState);

  // Close on success
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="mi-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mi-modal mi-shadow-lg mi-fade" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--c-line)" }}>
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-10 rounded-xl"
              style={{ background: "var(--c-primary-t)", color: "var(--c-primary-d)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                Invitar usuario
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                Le enviaremos un email para unirse.
              </div>
            </div>
          </div>
          <button
            className="mi-iconbtn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <form id="invite-form" action={action}>
            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="inv-email" className="mi-label">Email</label>
              <div className="mi-input-group">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>
                </svg>
                <input
                  id="inv-email"
                  name="email"
                  type="email"
                  className="mi-input"
                  placeholder="persona@farmacia.com"
                  autoComplete="off"
                />
              </div>
              {state.errors.email?.map((e) => (
                <p key={e} className="mi-field-error">{e}</p>
              ))}
            </div>

            <div className="mi-field">
              <label htmlFor="inv-role" className="mi-label">Rol</label>
              <select id="inv-role" name="role" className="mi-input">
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {state.errors.role?.map((e) => (
                <p key={e} className="mi-field-error">{e}</p>
              ))}
            </div>

            {state.errors._form && (
              <p className="mi-field-error mt-3">{state.errors._form[0]}</p>
            )}

            <div
              className="flex items-start gap-2 mt-4 p-3 rounded-xl"
              style={{ background: "var(--c-surface-2)", fontSize: 12, color: "var(--c-ink-2)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 3l8 3v6c0 4.5-3.2 7.5-8 9-4.8-1.5-8-4.5-8-9V6z"/>
              </svg>
              El rol define a qué módulos accede. Podés cambiarlo en cualquier momento.
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button
            type="button"
            className="mi-btn mi-btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="invite-form"
            disabled={isPending}
            className="mi-btn mi-btn--primary"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>
            </svg>
            {isPending ? "Enviando…" : "Enviar invitación"}
          </button>
        </div>
      </div>
    </div>
  );
}
