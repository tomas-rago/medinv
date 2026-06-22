"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/(auth)/login/actions";
import type { LoginResult } from "@/app/(auth)/login/actions";
import { Logo } from "@/components/ui/Logo";
import { AuthArt } from "@/components/ui/AuthArt";
import { IconSprite } from "@/components/ui/Icons";

const initialState: LoginResult = { ok: false, errors: {} };

export function Login() {
  const [state, action, isPending] = useActionState(login, initialState);

  return (
    <>
      <IconSprite />
      <section className="mi-auth mi-fade">
        {/* Left panel */}
        <div className="mi-auth-panel">
          <Logo size="md" />

          <div
            className="flex-1 flex flex-col justify-center w-full mx-auto py-12"
            style={{ maxWidth: 360 }}
          >
            <h1 className="font-display text-ink leading-tight" style={{ fontSize: 30 }}>
              Bienvenid@ de nuevo
            </h1>
            <p className="text-ink2 mt-2 mb-8" style={{ fontSize: 15 }}>
              Gestioná tu inventario, compras y equipo desde un solo lugar.
            </p>

            <form action={action}>
              <div className="mi-field" style={{ marginTop: 0 }}>
                <label htmlFor="email" className="mi-label">Email</label>
                <div className="mi-input-group">
                  <svg><use href="#i-mail" /></svg>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="mi-input"
                    placeholder="tu@farmacia.com"
                    autoComplete="email"
                  />
                </div>
                {state.errors.email?.map((e) => (
                  <p key={e} className="mi-field-error">{e}</p>
                ))}
              </div>

              <div className="mi-field">
                <div className="flex items-center justify-between" style={{ marginBottom: 7 }}>
                  <label htmlFor="password" className="mi-label" style={{ marginBottom: 0 }}>
                    Contraseña
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-primary hover:text-primaryd"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="mi-input-group">
                  <svg><use href="#i-lock" /></svg>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="mi-input"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                {state.errors.password?.map((e) => (
                  <p key={e} className="mi-field-error">{e}</p>
                ))}
              </div>

              {state.errors._form && (
                <p className="mi-field-error mt-3">{state.errors._form[0]}</p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="mi-btn mi-btn--primary mi-btn--block mi-btn--lg"
                style={{ marginTop: 28 }}
              >
                {isPending ? "Iniciando sesión…" : "Iniciar sesión"}
              </button>
            </form>

            <p className="text-center text-ink2 mt-7" style={{ fontSize: 14 }}>
              ¿No tenés una cuenta?{" "}
              <Link
                href="/sign-up"
                className="font-semibold text-primary hover:text-primaryd"
              >
                Registrate
              </Link>
            </p>
          </div>

          <p className="text-center text-ink3" style={{ fontSize: 12 }}>
            © 2026 Med+Inv ·{" "}
            <a href="#" className="hover:text-ink2">Privacidad</a> ·{" "}
            <a href="#" className="hover:text-ink2">Términos</a>
          </p>
        </div>

        {/* Right art panel */}
        <AuthArt caption="Accedé a tu farmacia" />
      </section>
    </>
  );
}
