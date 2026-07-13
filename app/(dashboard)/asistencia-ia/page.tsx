import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgMonthlyConsumption, getTokenLimit } from "@/lib/ai/quota";
import AsistenteChat from "@/components/asistencia-ia/AsistenteChat";

export default async function AsistenciaIAPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const t = await getTranslations("AsistenciaIA");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.organization_id as string | undefined;
  if (!orgId) redirect("/onboarding");

  // limit > 0 is the hasAiAccess condition; the number itself feeds the
  // usage meter, so fetch it once.
  const tokenLimit = await getTokenLimit(supabase, orgId);

  if (tokenLimit <= 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center" style={{ maxWidth: 420 }}>
          <div
            className="mx-auto mb-5 flex items-center justify-center rounded-2xl"
            style={{ width: 64, height: 64, background: "color-mix(in srgb, var(--c-primary) 10%, var(--c-surface))" }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4z"/>
              <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>
            </svg>
          </div>
          <h1 className="font-display text-ink mb-2" style={{ fontSize: 24 }}>{t("upsell_title")}</h1>
          <p className="text-ink2 mb-6" style={{ fontSize: 15 }}>
            {t("upsell_body")}
          </p>
          <Link href="/cuenta/suscripcion" className="mi-btn mi-btn--primary">
            {t("upsell_cta")}
          </Link>
        </div>
      </div>
    );
  }

  // Org-wide month-to-date consumption for the meter; the quota itself is
  // re-checked by the API route on every message.
  const usedTokens = await getOrgMonthlyConsumption(createAdminClient(), orgId);

  return <AsistenteChat usedTokens={usedTokens} tokenLimit={tokenLimit} />;
}
