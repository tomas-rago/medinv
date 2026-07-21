"use client";

import { useTranslations } from "next-intl";

const GLYPHS = ["M", "+", "i", "N", "V", "M", "+", "i", "V", "N", "M", "+", "i", "N", "V", "M", "+", "i", "V", "N", "M", "+", "i", "N", "V"];

interface AuthArtProps {
  caption: string;
}

export function AuthArt({ caption }: AuthArtProps) {
  const t = useTranslations("AuthArt");
  const BULLETS = [t("bullet_0"), t("bullet_1"), t("bullet_2")];

  return (
    <div className="mi-auth-art" style={{ minHeight: "100vh" }}>
      <div className="mi-tilewall">
        {GLYPHS.map((g, i) => (
          <span key={i}>{g}</span>
        ))}
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(155deg, color-mix(in srgb,var(--c-primary) 55%, transparent) 0%, var(--c-primary-d) 92%)",
        }}
      />
      <div className="relative h-full flex flex-col justify-end p-12">
        <span
          className="mb-8"
          style={{
            display: "inline-flex",
            width: "fit-content",
            padding: 10,
            background: "#fff",
            borderRadius: 16,
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,.25))",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG; next/image adds no optimization for SVGs */}
          <img src="/isotype.svg" alt="" width={48} height={48} className="mi-iso" />
        </span>
        <h2 className="font-display text-white leading-tight max-w-md" style={{ fontSize: 34 }}>
          {caption}
        </h2>
        <p className="text-white/80 mt-3 max-w-md" style={{ fontSize: 15 }}>
          {t("description")}
        </p>
        <ul className="mt-8 space-y-3">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-center gap-3 text-white/90" style={{ fontSize: 14 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5L16 9"/>
              </svg>
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
