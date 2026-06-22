"use client";

import { useActionState } from "react";
import {
  updateProfile,
  updatePassword,
} from "@/app/(dashboard)/settings/actions";
import type {
  UpdateProfileResult,
  UpdatePasswordResult,
} from "@/app/(dashboard)/settings/actions";

const initProfile: UpdateProfileResult = { ok: false, errors: {} };
const initPassword: UpdatePasswordResult = { ok: false, errors: {} };

interface SettingsPageProps {
  email: string;
  initialFirstName: string;
  initialLastName: string;
}

export function SettingsPage({ email, initialFirstName, initialLastName }: SettingsPageProps) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initProfile);
  const [passwordState, passwordAction, passwordPending] = useActionState(updatePassword, initPassword);

  return (
    <div
      className="flex-1 overflow-y-auto px-7 py-7"
      style={{ display: "flex", flexDirection: "column", gap: "var(--d-section-gap)" }}
    >
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 text-ink3 mb-1" style={{ fontSize: 13 }}>
          <span>Cuenta</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6"/>
          </svg>
          <span className="text-ink2 font-medium">Ajustes</span>
        </div>
        <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>Ajustes</h1>
        <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
          Gestioná tu nombre y contraseña.
        </p>
      </div>

      {/* Section 1: Mi perfil */}
      <section className="mi-card mi-shadow" style={{ maxWidth: 520, padding: "var(--d-card-pad)" }}>
        <h2 className="font-display text-ink" style={{ fontSize: 18, marginBottom: 4 }}>Mi perfil</h2>
        <p className="text-ink3 mb-5" style={{ fontSize: 13 }}>{email}</p>

        {profileState.ok && (
          <div
            className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl"
            style={{ background: "var(--c-ok-soft)", color: "var(--c-primary-d)", fontSize: 14 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            Perfil actualizado correctamente.
          </div>
        )}

        <form action={profileAction}>
          <div className="grid grid-cols-2 gap-3">
            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="firstName" className="mi-label">Nombre</label>
              <input
                id="firstName"
                name="firstName"
                className="mi-input"
                defaultValue={initialFirstName}
                autoComplete="given-name"
              />
              {profileState.errors.firstName?.map((e) => (
                <p key={e} className="mi-field-error">{e}</p>
              ))}
            </div>
            <div className="mi-field" style={{ marginTop: 0 }}>
              <label htmlFor="lastName" className="mi-label">Apellido</label>
              <input
                id="lastName"
                name="lastName"
                className="mi-input"
                defaultValue={initialLastName}
                autoComplete="family-name"
              />
              {profileState.errors.lastName?.map((e) => (
                <p key={e} className="mi-field-error">{e}</p>
              ))}
            </div>
          </div>
          {profileState.errors._form && (
            <p className="mi-field-error mt-3">{profileState.errors._form[0]}</p>
          )}
          <button
            type="submit"
            disabled={profilePending}
            className="mi-btn mi-btn--primary"
            style={{ marginTop: 20 }}
          >
            {profilePending ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </section>

      {/* Section 2: Cambiar contraseña */}
      <section className="mi-card mi-shadow" style={{ maxWidth: 520, padding: "var(--d-card-pad)" }}>
        <h2 className="font-display text-ink" style={{ fontSize: 18, marginBottom: 16 }}>Cambiar contraseña</h2>

        {passwordState.ok && (
          <div
            className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl"
            style={{ background: "var(--c-ok-soft)", color: "var(--c-primary-d)", fontSize: 14 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            Contraseña actualizada correctamente.
          </div>
        )}

        <form action={passwordAction}>
          <div className="mi-field" style={{ marginTop: 0 }}>
            <label htmlFor="currentPassword" className="mi-label">Contraseña actual</label>
            <div className="mi-input-group">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                className="mi-input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {passwordState.errors.currentPassword?.map((e) => (
              <p key={e} className="mi-field-error">{e}</p>
            ))}
          </div>

          <div className="mi-field">
            <label htmlFor="newPassword" className="mi-label">Nueva contraseña</label>
            <div className="mi-input-group">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                className="mi-input"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
            </div>
            {passwordState.errors.newPassword?.map((e) => (
              <p key={e} className="mi-field-error">{e}</p>
            ))}
          </div>

          <div className="mi-field">
            <label htmlFor="confirmPassword" className="mi-label">Repetir nueva contraseña</label>
            <div className="mi-input-group">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="mi-input"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            {passwordState.errors.confirmPassword?.map((e) => (
              <p key={e} className="mi-field-error">{e}</p>
            ))}
          </div>

          {passwordState.errors._form && (
            <p className="mi-field-error mt-3">{passwordState.errors._form[0]}</p>
          )}

          <button
            type="submit"
            disabled={passwordPending}
            className="mi-btn mi-btn--primary"
            style={{ marginTop: 20 }}
          >
            {passwordPending ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </div>
  );
}
