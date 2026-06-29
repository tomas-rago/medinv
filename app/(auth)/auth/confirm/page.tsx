import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function ConfirmPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--c-sidebar)" }}
    >
      <div className="mb-10">
        <Logo size="lg" />
      </div>

      <div className="mi-card mi-card-pad mi-shadow text-center" style={{ maxWidth: 440 }}>
        {/* Envelope icon */}
        <span
          className="inline-grid place-items-center w-16 h-16 rounded-2xl mb-5"
          style={{ background: "var(--c-primary-t)" }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--c-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m2 7 10 6 10-6" />
            <path d="m9 13 2 2 4-4" />
          </svg>
        </span>

        <h1 className="font-display text-ink leading-tight" style={{ fontSize: 26 }}>
          Revisá tu email
        </h1>
        <p className="text-ink2 mt-3" style={{ fontSize: 15 }}>
          Te enviamos un enlace de confirmación a tu dirección de email.
          Hacé clic en el enlace para activar tu cuenta y continuar con la configuración.
        </p>
        <p className="text-ink3 mt-4" style={{ fontSize: 13 }}>
          ¿No lo ves? Revisá la carpeta de spam o correo no deseado.
        </p>

        <div className="mt-7">
          <Link href="/login" className="mi-btn mi-btn--ghost mi-btn--block">
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
