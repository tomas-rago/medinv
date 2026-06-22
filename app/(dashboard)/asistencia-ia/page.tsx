import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AsistenciaIAPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = user.app_metadata?.organization_id as string | undefined;
  if (!orgId) redirect("/onboarding");

  // Check if the org's plan includes AI (token_limit_per_month > 0)
  const { data: org } = await supabase
    .from("organizations")
    .select("plan_id")
    .eq("id", orgId)
    .single();

  let hasAiAccess = false;
  if (org?.plan_id) {
    const { data: plan } = await supabase
      .from("plans")
      .select("token_limit_per_month")
      .eq("id", org.plan_id)
      .single();
    hasAiAccess = (plan?.token_limit_per_month ?? 0) > 0;
  }

  if (!hasAiAccess) {
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
          <h1 className="font-display text-ink mb-2" style={{ fontSize: 24 }}>Asistente IA</h1>
          <p className="text-ink2 mb-6" style={{ fontSize: 15 }}>
            Esta función está disponible a partir del plan intermedio. Actualizá tu plan para acceder al chatbot, sugerencias predictivas y más.
          </p>
          <Link href="/cuenta/suscripcion" className="mi-btn mi-btn--primary">
            Ver planes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center" style={{ maxWidth: 480 }}>
        <div
          className="mx-auto mb-5 flex items-center justify-center rounded-2xl"
          style={{ width: 64, height: 64, background: "color-mix(in srgb, var(--c-primary) 10%, var(--c-surface))" }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4z"/>
            <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>
          </svg>
        </div>
        <h1 className="font-display text-ink mb-2" style={{ fontSize: 24 }}>Asistente IA</h1>
        <p className="text-ink2 mb-2" style={{ fontSize: 15 }}>
          Tu asistente inteligente para gestión de inventario, predicción de compras y consultas en lenguaje natural.
        </p>
        <p className="text-ink3" style={{ fontSize: 13 }}>Próximamente disponible.</p>
      </div>
    </div>
  );
}
