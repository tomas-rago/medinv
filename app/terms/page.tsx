import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Terms");
  return { title: `${t("heading")} — Med+Inv` };
}

const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

export default async function TermsPage() {
  const t = await getTranslations("Terms");

  return (
    <main className="min-h-screen py-10 px-4 sm:px-6">
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <div className="mb-6">
          <Logo size="md" href="/" />
        </div>

        <article className="mi-card mi-shadow mi-card-pad mi-fade">
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {t("heading")}
          </h1>
          <p className="text-ink3 mt-1" style={{ fontSize: 13 }}>
            {t("updated_at")}
          </p>

          {SECTIONS.map((s) => (
            <section key={s} className="mt-7">
              <h2 className="text-ink font-semibold" style={{ fontSize: 17 }}>
                {t(`${s}_title`)}
              </h2>
              <p className="text-ink2 mt-2" style={{ fontSize: 14.5, lineHeight: 1.65 }}>
                {t(`${s}_body`)}
              </p>
            </section>
          ))}
        </article>

        <p className="text-center text-ink2 mt-6" style={{ fontSize: 14 }}>
          <Link href="/sign-up" className="font-semibold text-primary hover:text-primaryd">
            {t("back_to_signup")}
          </Link>
        </p>
      </div>
    </main>
  );
}
