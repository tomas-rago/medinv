const GLYPHS = ["M", "+", "i", "N", "V", "M", "+", "i", "V", "N", "M", "+", "i", "N", "V", "M", "+", "i", "V", "N", "M", "+", "i", "N", "V"];

const BULLETS = [
  "Control de stock y vencimientos en tiempo real",
  "Compras y pedidos con seguimiento de estado",
  "Tu equipo con roles y permisos a medida",
];

interface AuthArtProps {
  caption: string;
}

export function AuthArt({ caption }: AuthArtProps) {
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
          className="mi-iso mb-8"
          style={{ width: 48, height: 48, filter: "drop-shadow(0 4px 12px rgba(0,0,0,.25))" }}
        >
          <span className="t-m" style={{ background: "#fff", color: "var(--c-primary)" }}>M</span>
          <span className="t-plus" style={{ background: "#fff", color: "var(--c-accent)" }}>+</span>
          <span className="t-i" style={{ background: "#fff", color: "var(--c-primary)" }}>i</span>
          <span className="t-empty" />
        </span>
        <h2 className="font-display text-white leading-tight max-w-md" style={{ fontSize: 34 }}>
          {caption}
        </h2>
        <p className="text-white/80 mt-3 max-w-md" style={{ fontSize: 15 }}>
          Med+Inv reúne inventario, compras y personal en un solo sistema, con un asistente de IA opcional.
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
