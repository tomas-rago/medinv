"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { resetPassword } from "@/app/(auth)/auth/reset-password/actions";
import type { ResetPasswordResult } from "@/app/(auth)/auth/reset-password/actions";
import { Logo } from "@/components/ui/Logo";
import { AuthArt } from "@/components/ui/AuthArt";
import { IconSprite } from "@/components/ui/Icons";

const initialState: ResetPasswordResult = { ok: false, errors: {} };

export function ResetPassword() {
  const t = useTranslations("ResetPassword");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");
  const tFoot = useTranslations("Footer");
  const [state, action, isPending] = useActionState(resetPassword, initialState);

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
            <h1 className="font-display text-ink leading-tight" style={{ fontSize: 30 }}>
              {t("heading")}
            </h1>
            <p className="text-ink2 mt-2 mb-8" style={{ fontSize: 15 }}>
              {t("subheading")}
            </p>

            <form action={action}>
              <div className="mi-field" style={{ marginTop: 0 }}>
                <label htmlFor="password" className="mi-label">{t("new_password")}</label>
                <div className="mi-input-group">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="mi-input"
                    placeholder={t("new_password_placeholder")}
                    autoComplete="new-password"
                  />
                </div>
                {state.errors.password?.map((e) => (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <p key={e} className="mi-field-error">{tVal(e as any)}</p>
                ))}
              </div>

              <div className="mi-field">
                <label htmlFor="confirmPassword" className="mi-label">{t("confirm_password")}</label>
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
                {state.errors.confirmPassword?.map((e) => (
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
              <Link href="/login" className="font-semibold text-primary hover:text-primaryd">
                {t("back_to_login")}
              </Link>
            </p>
          </div>

          <p className="text-center text-ink3" style={{ fontSize: 12 }}>
            {tFoot("copyright")} ·{" "}
            <a href="/terms" className="hover:text-ink2">{tFoot("privacy")}</a> ·{" "}
            <a href="/terms" className="hover:text-ink2">{tFoot("terms")}</a>
          </p>
        </div>

        <AuthArt caption={t("art_caption")} />
      </section>
    </>
  );
}
