"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signup } from "@/app/(auth)/sign-up/actions";
import type { SignUpResult } from "@/app/(auth)/sign-up/actions";
import { Logo } from "@/components/ui/Logo";
import { AuthArt } from "@/components/ui/AuthArt";
import { IconSprite } from "@/components/ui/Icons";

const initialState: SignUpResult = { ok: false, errors: {} };

function Stepper({ step }: { step: number }) {
  const t = useTranslations("Stepper");
  const STEPS = [t("step_account"), t("step_plan"), t("step_payment")];

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <span key={s} className="flex items-center gap-2">
            <span
              className="grid place-items-center w-6 h-6 rounded-full text-white font-bold"
              style={{
                fontSize: 12,
                background: on || done ? "var(--c-primary)" : "var(--c-surface-2)",
                color: on || done ? "#fff" : "var(--c-ink-3)",
                border: on || done ? "none" : "1px solid var(--c-line)",
              }}
            >
              {done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4 12 5 5L20 6" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: on ? 600 : 400,
                color: on ? "var(--c-ink)" : "var(--c-ink-3)",
              }}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <span style={{ width: 20, height: 1, background: "var(--c-line)" }} />
            )}
          </span>
        );
      })}
    </div>
  );
}

export function SignUp() {
  const t = useTranslations("SignUp");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");
  const [state, action, isPending] = useActionState(signup, initialState);

  return (
    <>
      <IconSprite />
      <section className="mi-auth mi-fade">
        {/* Left panel */}
        <div className="mi-auth-panel">
          <Logo size="md" />

          <div
            className="flex-1 flex flex-col justify-center w-full mx-auto py-10"
            style={{ maxWidth: 380 }}
          >
            <Stepper step={0} />

            <h1
              className="font-display text-ink leading-tight mt-6"
              style={{ fontSize: 30 }}
            >
              {t("heading")}
            </h1>
            <p className="text-ink2 mt-2 mb-7" style={{ fontSize: 15 }}>
              {t("subheading")}
            </p>

            <form action={action}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="mi-field" style={{ marginTop: 0 }}>
                  <label htmlFor="firstName" className="mi-label">{t("first_name")}</label>
                  <input
                    id="firstName"
                    name="firstName"
                    className="mi-input"
                    placeholder="Carmen"
                    autoComplete="given-name"
                  />
                  {state.errors.firstName?.map((e) => (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <p key={e} className="mi-field-error">{tVal(e as any)}</p>
                  ))}
                </div>
                <div className="mi-field" style={{ marginTop: 0 }}>
                  <label htmlFor="lastName" className="mi-label">{t("last_name")}</label>
                  <input
                    id="lastName"
                    name="lastName"
                    className="mi-input"
                    placeholder="Robledo"
                    autoComplete="family-name"
                  />
                  {state.errors.lastName?.map((e) => (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <p key={e} className="mi-field-error">{tVal(e as any)}</p>
                  ))}
                </div>
              </div>

              <div className="mi-field">
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
                <label htmlFor="password" className="mi-label">{t("password")}</label>
                <div className="mi-input-group">
                  <svg><use href="#i-lock" /></svg>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="mi-input"
                    placeholder={t("password_placeholder")}
                    autoComplete="new-password"
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
                style={{ marginTop: 24 }}
              >
                {isPending ? t("submitting") : t("submit")}
              </button>
            </form>

            <p className="text-center text-ink2 mt-6" style={{ fontSize: 14 }}>
              {t("have_account")}{" "}
              <Link href="/login" className="font-semibold text-primary hover:text-primaryd">
                {t("sign_in")}
              </Link>
            </p>
          </div>
        </div>

        {/* Right art panel */}
        <AuthArt caption={t("art_caption")} />
      </section>
    </>
  );
}
