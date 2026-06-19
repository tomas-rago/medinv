"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";

export default function InviteCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // @supabase/ssr's createBrowserClient defaults to PKCE flow and does NOT
    // auto-process #access_token hash fragments (it only looks for ?code=).
    // Supabase invite emails use implicit flow, so we parse the hash manually.
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const tokenType = params.get("type");

    console.log("[invite] hash type:", tokenType, "has token:", !!accessToken);

    if (!accessToken || !refreshToken) {
      setError("El enlace de invitación no es válido o ya fue usado.");
      return;
    }

    const supabase = createClient();

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error: sessionError }) => {
        console.log("[invite] setSession result:", data?.session?.user?.email ?? null, sessionError?.message ?? null);
        if (sessionError || !data.session) {
          setError(sessionError?.message ?? "El enlace de invitación no es válido o ya fue usado.");
        } else {
          router.replace("/auth/complete-profile");
        }
      });
  }, [router]);

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
              Enlace inválido
            </h1>
            <p className="text-ink2 mt-2" style={{ fontSize: 14 }}>{error}</p>
            <a href="/login" className="mi-btn mi-btn--ghost mi-btn--block mt-6">
              Ir al inicio de sesión
            </a>
          </>
        ) : (
          <>
            <div
              className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent mb-4"
              style={{ borderColor: "var(--c-primary)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}
            />
            <p className="text-ink2" style={{ fontSize: 15 }}>Verificando invitación…</p>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
