"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { requestPasswordReset } from "@/app/(auth)/forgot-password/actions";
import type { ForgotPasswordResult } from "@/app/(auth)/forgot-password/actions";
import { Logo } from "@/components/ui/Logo";
import { AuthArt } from "@/components/ui/AuthArt";
import { IconSprite } from "@/components/ui/Icons";

const initialState: ForgotPasswordResult = { ok: false, errors: {} };

export function ForgotPassword() {
  const t = useTranslations("ForgotPassword");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");
  const tFoot = useTranslations("Footer");
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
                  {t("success_heading")}
                </h1>
                <p className="text-ink2 mt-3" style={{ fontSize: 15 }}>
                  {t("success_body")}
                </p>
                <p className="text-ink3 mt-3" style={{ fontSize: 13 }}>
                  {t("success_spam")}
                </p>
                <Link
                  href="/login"
                  className="mi-btn mi-btn--ghost mi-btn--block mi-btn--lg"
                  style={{ marginTop: 28 }}
                >
                  {t("back_to_login")}
                </Link>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          <p className="text-center text-ink3" style={{ fontSize: 12 }}>
            {tFoot("copyright")} ·{" "}
            <a href="#" className="hover:text-ink2">{tFoot("privacy")}</a> ·{" "}
            <a href="#" className="hover:text-ink2">{tFoot("terms")}</a>
          </p>
        </div>

        <AuthArt caption={t("art_caption")} />
      </section>
    </>
  );
}
