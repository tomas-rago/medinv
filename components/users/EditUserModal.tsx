"use client";

import { useState } from "react";
import { toggleUserActive } from "@/app/(dashboard)/users/actions";

type Profile = {
  id: string;
  full_name: string | null;
  active: boolean;
};

interface EditUserModalProps {
  profile: Profile;
  onClose: () => void;
}

export function EditUserModal({ profile, onClose }: EditUserModalProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setIsPending(true);
    setError(null);
    const result = await toggleUserActive(profile.id, !profile.active);
    setIsPending(false);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error ?? "Error inesperado");
    }
  };

  const actionLabel = profile.active ? "Desactivar" : "Activar";

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
                <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
              </svg>
            </span>
            <div>
              <div className="font-display text-ink leading-tight" style={{ fontSize: 18 }}>
                Editar usuario
              </div>
              <div className="text-ink2" style={{ fontSize: 13 }}>
                {profile.full_name ?? "Usuario"}
              </div>
            </div>
          </div>
          <button className="mi-iconbtn" onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-ink2" style={{ fontSize: 14 }}>Estado actual:</span>
            <span
              className="inline-flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 600, color: profile.active ? "var(--c-ok)" : "var(--c-ink-3)" }}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: profile.active ? "var(--c-ok)" : "var(--c-ink-3)",
                  flexShrink: 0,
                }}
              />
              {profile.active ? "Activo" : "Inactivo"}
            </span>
          </div>

          <p className="text-ink2" style={{ fontSize: 14 }}>
            ¿Querés {profile.active ? "desactivar" : "activar"} a{" "}
            <b className="text-ink">{profile.full_name ?? "este usuario"}</b>?
            {profile.active && (
              <span className="text-ink3" style={{ display: "block", marginTop: 6, fontSize: 13 }}>
                El usuario ya no podrá acceder al sistema.
              </span>
            )}
          </p>

          {error && <p className="mi-field-error mt-4">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t" style={{ borderColor: "var(--c-line)" }}>
          <button type="button" className="mi-btn mi-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            className="mi-btn"
            style={
              profile.active
                ? { background: "var(--c-danger)", color: "#fff" }
                : { background: "var(--c-primary)", color: "#fff" }
            }
            onClick={handleToggle}
          >
            {isPending ? "Guardando…" : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
