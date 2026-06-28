"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";

export default function InviteCallbackPage() {
  const t = useTranslations("InviteCallback");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      // @supabase/ssr's createBrowserClient defaults to PKCE flow and does NOT
      // auto-process #access_token hash fragments (it only looks for ?code=).
      // Supabase invite emails use implicit flow, so we parse the hash manually.
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const tokenType = params.get("type");

      if (!accessToken || !refreshToken) {
        setError(t("invalid_link"));
        return;
      }

      const supabase = createClient();
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError || !data.session) {
        setError(sessionError?.message ?? t("invalid_link"));
      } else {
        router.replace("/auth/complete-profile");
      }
    }

    run();
  }, [router, t]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--c-sidebar)" }}
    >
      <div className="mb-10">
        <Logo size="lg" />
      </div>

      <div className="mi-card mi-card-pad mi-shadow text-center" style={{ maxWidth: 400 }}>
        {error ? (
          <>
            <span
              className="inline-grid place-items-center w-14 h-14 rounded-2xl mb-4"
              style={{ background: "var(--c-danger-soft)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--c-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17.5v.5"/>
              </svg>
            </span>
            <h1 className="font-display text-ink leading-tight" style={{ fontSize: 22 }}>
              {t("error_heading")}
            </h1>
            <p className="text-ink2 mt-2" style={{ fontSize: 14 }}>{error}</p>
            <a href="/login" className="mi-btn mi-btn--ghost mi-btn--block mt-6">
              {t("go_to_login")}
            </a>
          </>
        ) : (
          <>
            <div
              className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent mb-4"
              style={{ borderColor: "var(--c-primary)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}
            />
            <p className="text-ink2" style={{ fontSize: 15 }}>{t("verifying")}</p>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
