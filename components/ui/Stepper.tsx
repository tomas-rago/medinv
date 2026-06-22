"use client";

const STEPS = ["Cuenta", "Plan", "Pago"];

export function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <span key={s} className="flex items-center gap-2">
            <span
              className="grid place-items-center w-6 h-6 rounded-full font-bold"
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
            <span style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? "var(--c-ink)" : "var(--c-ink-3)" }}>
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
