"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { login } from "@/app/(auth)/login/actions";
import type { LoginResult } from "@/app/(auth)/login/actions";
import { Logo } from "@/components/ui/Logo";
import { AuthArt } from "@/components/ui/AuthArt";
import { IconSprite } from "@/components/ui/Icons";

const initialState: LoginResult = { ok: false, errors: {} };

export function Login() {
  const t = useTranslations("Login");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");
  const tFoot = useTranslations("Footer");
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
              {t("heading")}
            </h1>
            <p className="text-ink2 mt-2 mb-8" style={{ fontSize: 15 }}>
              {t("subheading")}
            </p>

            <form action={action}>
              <div className="mi-field" style={{ marginTop: 0 }}>
                <label htmlFor="email" className="mi-label">{t("email")}</label>
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <p key={e} className="mi-field-error">{tVal(e as any)}</p>
                ))}
              </div>

              <div className="mi-field">
                <div className="flex items-center justify-between" style={{ marginBottom: 7 }}>
                  <label htmlFor="password" className="mi-label" style={{ marginBottom: 0 }}>
                    {t("password")}
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-primary hover:text-primaryd"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    {t("forgot_password")}
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <p key={e} className="mi-field-error">{tVal(e as any)}</p>
                ))}
              </div>

              {state.errors._form && (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <p className="mi-field-error mt-3">{tErr(state.errors._form[0] as any)}</p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="mi-btn mi-btn--primary mi-btn--block mi-btn--lg"
                style={{ marginTop: 28 }}
              >
                {isPending ? t("submitting") : t("submit")}
              </button>
            </form>

            <p className="text-center text-ink2 mt-7" style={{ fontSize: 14 }}>
              {t("no_account")}{" "}
              <Link
                href="/sign-up"
                className="font-semibold text-primary hover:text-primaryd"
              >
                {t("sign_up")}
              </Link>
            </p>
          </div>

          <p className="text-center text-ink3" style={{ fontSize: 12 }}>
            {tFoot("copyright")} ·{" "}
            <a href="/terms" className="hover:text-ink2">{tFoot("privacy")}</a> ·{" "}
            <a href="/terms" className="hover:text-ink2">{tFoot("terms")}</a>
          </p>
        </div>

        {/* Right art panel */}
        <AuthArt caption={t("art_caption")} />
      </section>
    </>
  );
}
