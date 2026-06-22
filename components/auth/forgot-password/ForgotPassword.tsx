"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/(auth)/forgot-password/actions";
import type { ForgotPasswordResult } from "@/app/(auth)/forgot-password/actions";
import { Logo } from "@/components/ui/Logo";
import { AuthArt } from "@/components/ui/AuthArt";
import { IconSprite } from "@/components/ui/Icons";

const initialState: ForgotPasswordResult = { ok: false, errors: {} };

export function ForgotPassword() {
  const [state, action, isPending] = useActionState(requestPasswordReset, initialState);

  return (
    <>
      <IconSprite />
      <section className="mi-auth mi-fade">
        <div className="mi-auth-panel">
          <Logo size="md" />

          <div
            className="flex-1 flex flex-col justify-center w-full mx-auto py-12"
            style={{ maxWidth: 360 }}
          >
            {state.ok ? (
              <div className="text-center">
                <div
                  className="grid place-items-center w-16 h-16 rounded-2xl mx-auto mb-6"
                  style={{ background: "var(--c-primary-t)" }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>
                  </svg>
                </div>
                <h1 className="font-display text-ink leading-tight" style={{ fontSize: 26 }}>
                  Revisá tu email
                </h1>
                <p className="text-ink2 mt-3" style={{ fontSize: 15 }}>
                  Si tu email está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
                </p>
                <p className="text-ink3 mt-3" style={{ fontSize: 13 }}>
                  ¿No lo ves? Revisá la carpeta de spam o correo no deseado.
                </p>
                <Link
                  href="/login"
                  className="mi-btn mi-btn--ghost mi-btn--block mi-btn--lg"
                  style={{ marginTop: 28 }}
                >
                  Volver al inicio de sesión
                </Link>
              </div>
            ) : (
              <>
                <h1 className="font-display text-ink leading-tight" style={{ fontSize: 30 }}>
                  Olvidaste tu contraseña
                </h1>
                <p className="text-ink2 mt-2 mb-8" style={{ fontSize: 15 }}>
                  Ingresá tu email y te enviaremos un enlace para restablecerla.
                </p>

                <form action={action}>
                  <div className="mi-field" style={{ marginTop: 0 }}>
                    <label htmlFor="email" className="mi-label">Email</label>
                    <div className="mi-input-group">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>
                      </svg>
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

                  {state.errors._form && (
                    <p className="mi-field-error mt-3">{state.errors._form[0]}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="mi-btn mi-btn--primary mi-btn--block mi-btn--lg"
                    style={{ marginTop: 28 }}
                  >
                    {isPending ? "Enviando…" : "Enviar enlace"}
                  </button>
                </form>

                <p className="text-center text-ink2 mt-7" style={{ fontSize: 14 }}>
                  <Link href="/login" className="font-semibold text-primary hover:text-primaryd">
                    Volver al inicio de sesión
                  </Link>
                </p>
              </>
            )}
          </div>

          <p className="text-center text-ink3" style={{ fontSize: 12 }}>
            © 2026 Med+Inv ·{" "}
            <a href="#" className="hover:text-ink2">Privacidad</a> ·{" "}
            <a href="#" className="hover:text-ink2">Términos</a>
          </p>
        </div>

        <AuthArt caption="Recuperá el acceso a tu cuenta" />
      </section>
    </>
  );
}
