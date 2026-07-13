import type { BacktestDay } from "@/lib/predictive/backtest";

// Projected line color: the theme's --c-info is too desaturated to read as
// data ink; this blue passed the palette validator (lightness band, chroma
// floor, CVD separation, 3:1 contrast) against all three theme surfaces.
// Series identity is double-encoded: bars vs. line plus the legend.
const PROJECTED_COLOR = "#2E6FA8";

const VIEW_W = 720;
const VIEW_H = 260;
const M = { top: 14, right: 10, bottom: 26, left: 40 };
const PLOT_W = VIEW_W - M.left - M.right;
const PLOT_H = VIEW_H - M.top - M.bottom;

interface ConsumptionChartProps {
  days: BacktestDay[];
  labels: { actual: string; projected: string };
}

function fmtTick(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

function fmtQty(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// 1/2/5 x 10^k step giving ~3 gridlines.
function niceStep(rawStep: number): number {
  const pow = 10 ** Math.floor(Math.log10(rawStep));
  for (const m of [1, 2, 5, 10]) {
    if (m * pow >= rawStep) return m * pow;
  }
  return 10 * pow;
}

export function ConsumptionChart({ days, labels }: ConsumptionChartProps) {
  const rawMax = Math.max(1, ...days.map((d) => Math.max(d.actual, d.projected ?? 0)));
  const step = niceStep(rawMax / 3);
  const yMax = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  for (let v = step; v <= yMax; v += step) ticks.push(v);

  const slotW = PLOT_W / days.length;
  const barW = Math.min(14, Math.max(4, slotW - 4));
  const x = (i: number) => M.left + i * slotW + slotW / 2;
  const y = (v: number) => M.top + PLOT_H * (1 - v / yMax);

  const hasProjection = days.some((d) => d.projected !== null);
  const linePoints = hasProjection
    ? days.map((d, i) => `${x(i).toFixed(1)},${y(d.projected ?? 0).toFixed(1)}`).join(" ")
    : "";

  const xTickIndexes = [0, 7, 14, 21, days.length - 1].filter((i) => i < days.length);

  return (
    <div>
      {/* Legend — identity also carried by mark shape (bars vs line). */}
      <div className="flex items-center gap-4 mb-2" style={{ fontSize: 12 }}>
        <span className="flex items-center gap-1.5 text-ink2">
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: "var(--c-primary)",
              opacity: 0.8,
              display: "inline-block",
            }}
          />
          {labels.actual}
        </span>
        {hasProjection && (
          <span className="flex items-center gap-1.5 text-ink2">
            <span
              aria-hidden
              style={{
                width: 14,
                height: 0,
                borderTop: `2px solid ${PROJECTED_COLOR}`,
                display: "inline-block",
              }}
            />
            {labels.projected}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
      >
        {/* Gridlines + y labels */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={M.left}
              x2={VIEW_W - M.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--c-line)"
              strokeWidth="1"
            />
            <text
              x={M.left - 6}
              y={y(v) + 3.5}
              textAnchor="end"
              fill="var(--c-ink-3)"
              style={{ fontSize: 11 }}
            >
              {fmtQty(v)}
            </text>
          </g>
        ))}
        {/* Baseline */}
        <line
          x1={M.left}
          x2={VIEW_W - M.right}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--c-line)"
          strokeWidth="1.5"
        />

        {/* Actual bars (full-slot hit target, native tooltip) */}
        {days.map((d, i) => {
          const h = (d.actual / yMax) * PLOT_H;
          return (
            <g key={d.date}>
              <title>
                {`${fmtTick(d.date)} — ${labels.actual}: ${fmtQty(d.actual)}${
                  d.projected !== null ? ` · ${labels.projected}: ${fmtQty(d.projected)}` : ""
                }`}
              </title>
              {/* invisible hit target across the slot's full height */}
              <rect
                x={M.left + i * slotW}
                y={M.top}
                width={slotW}
                height={PLOT_H}
                fill="transparent"
              />
              {d.actual > 0 && (
                <rect
                  x={x(i) - barW / 2}
                  y={y(d.actual)}
                  width={barW}
                  height={Math.max(1, h)}
                  rx={3}
                  fill="var(--c-primary)"
                  opacity={0.8}
                />
              )}
            </g>
          );
        })}

        {/* Projected line */}
        {hasProjection && (
          <polyline
            points={linePoints}
            fill="none"
            stroke={PROJECTED_COLOR}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* X ticks */}
        {xTickIndexes.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={VIEW_H - 8}
            textAnchor="middle"
            fill="var(--c-ink-3)"
            style={{ fontSize: 11 }}
          >
            {fmtTick(days[i].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
