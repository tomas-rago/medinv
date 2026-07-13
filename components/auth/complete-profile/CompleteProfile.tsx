"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { completeProfile } from "@/app/(auth)/auth/complete-profile/actions";
import type { CompleteProfileResult } from "@/app/(auth)/auth/complete-profile/actions";
import { Logo } from "@/components/ui/Logo";
import { AuthArt } from "@/components/ui/AuthArt";
import { IconSprite } from "@/components/ui/Icons";

const initialState: CompleteProfileResult = { ok: false, errors: {} };

export function CompleteProfile({ email }: { email: string }) {
  const t = useTranslations("CompleteProfile");
  const tVal = useTranslations("Validation");
  const tErr = useTranslations("Errors");
  const [state, action, isPending] = useActionState(completeProfile, initialState);

  return (
    <>
      <IconSprite />
      <section className="mi-auth mi-fade">
        <div className="mi-auth-panel">
          <Logo size="md" />

          <div
            className="flex-1 flex flex-col justify-center w-full mx-auto py-10"
            style={{ maxWidth: 380 }}
          >
            <h1 className="font-display text-ink leading-tight" style={{ fontSize: 30 }}>
              {t("heading")}
            </h1>
            <p className="text-ink2 mt-2 mb-7" style={{ fontSize: 15 }}>
              {t("subheading_prefix")} <b className="text-ink">{email}</b>{t("subheading_suffix")}
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
          </div>
        </div>

        <AuthArt caption={t("art_caption")} />
      </section>
    </>
  );
}
