import type { SummaryChart as SummaryChartSpec } from "@/lib/schemas/asistencia-ia/dashboard-summary";

// Renders the model-chosen chart spec as inline SVG, following the project's
// chart conventions (see components/predictive/ConsumptionChart.tsx): CSS-var
// theming, es-AR formatting, <title> hover tooltips, thin rounded marks
// anchored to the baseline, recessive grid. Single series, so no legend — the
// title names it. Bars are colored by the point's tone, one of the design
// system's reserved status colors; the value/axis also carries magnitude, so
// tone is reinforcement, never the sole encoding.

const TONE_COLOR: Record<string, string> = {
  danger: "var(--c-danger)",
  warn: "var(--c-warn)",
  normal: "var(--c-primary)",
};

function toneColor(tone?: string): string {
  return (tone && TONE_COLOR[tone]) || "var(--c-primary)";
}

function fmtValue(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// 1/2/5 x 10^k step giving ~3 gridlines (same helper as ConsumptionChart).
function niceStep(rawStep: number): number {
  const pow = 10 ** Math.floor(Math.log10(rawStep || 1));
  for (const m of [1, 2, 5, 10]) {
    if (m * pow >= rawStep) return m * pow;
  }
  return 10 * pow;
}

function fmtLabelWithUnit(spec: SummaryChartSpec, value: number): string {
  return spec.unit ? `${fmtValue(value)} ${spec.unit}` : fmtValue(value);
}

// Horizontal bars — the default for long product-name labels.
function HorizontalBars({ spec }: { spec: SummaryChartSpec }) {
  const VIEW_W = 720;
  const ROW_H = 34;
  const M = { top: 8, right: 56, bottom: 8, left: 150 };
  const plotW = VIEW_W - M.left - M.right;
  const viewH = M.top + M.bottom + spec.points.length * ROW_H;
  const rawMax = Math.max(1, ...spec.points.map((p) => p.value));
  const step = niceStep(rawMax / 3);
  const xMax = Math.ceil(rawMax / step) * step;
  const barH = 14;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${viewH}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={spec.title}
    >
      {spec.points.map((p, i) => {
        const rowY = M.top + i * ROW_H;
        const barY = rowY + (ROW_H - barH) / 2;
        const w = xMax > 0 ? (p.value / xMax) * plotW : 0;
        return (
          <g key={`${p.label}-${i}`}>
            <title>{`${p.label}: ${fmtLabelWithUnit(spec, p.value)}`}</title>
            {/* Label (truncated by the fixed left column) */}
            <text
              x={M.left - 10}
              y={rowY + ROW_H / 2 + 4}
              textAnchor="end"
              fill="var(--c-ink-2)"
              style={{ fontSize: 12 }}
            >
              {p.label.length > 22 ? `${p.label.slice(0, 21)}…` : p.label}
            </text>
            {/* Track */}
            <rect
              x={M.left}
              y={barY}
              width={plotW}
              height={barH}
              rx={4}
              fill="var(--c-line)"
              opacity={0.4}
            />
            {/* Value bar, rounded end anchored to the axis */}
            <rect
              x={M.left}
              y={barY}
              width={Math.max(2, w)}
              height={barH}
              rx={4}
              fill={toneColor(p.tone)}
            />
            {/* Value label at the end */}
            <text
              x={M.left + Math.max(2, w) + 8}
              y={rowY + ROW_H / 2 + 4}
              fill="var(--c-ink-3)"
              style={{ fontSize: 11 }}
            >
              {fmtValue(p.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Vertical bars.
function VerticalBars({ spec }: { spec: SummaryChartSpec }) {
  const VIEW_W = 720;
  const VIEW_H = 240;
  const M = { top: 14, right: 10, bottom: 44, left: 40 };
  const plotW = VIEW_W - M.left - M.right;
  const plotH = VIEW_H - M.top - M.bottom;
  const rawMax = Math.max(1, ...spec.points.map((p) => p.value));
  const step = niceStep(rawMax / 3);
  const yMax = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  for (let v = step; v <= yMax; v += step) ticks.push(v);

  const slotW = plotW / spec.points.length;
  const barW = Math.min(48, Math.max(8, slotW - 16));
  const x = (i: number) => M.left + i * slotW + slotW / 2;
  const y = (v: number) => M.top + plotH * (1 - v / yMax);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={spec.title}
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
            {fmtValue(v)}
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

      {spec.points.map((p, i) => {
        const h = (p.value / yMax) * plotH;
        const label = p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label;
        return (
          <g key={`${p.label}-${i}`}>
            <title>{`${p.label}: ${fmtLabelWithUnit(spec, p.value)}`}</title>
            {/* invisible hit target across the slot */}
            <rect x={M.left + i * slotW} y={M.top} width={slotW} height={plotH} fill="transparent" />
            {/* Zero-valued bars still draw a 2px stub at the baseline — a chart
                of all-zero values (e.g. "días hasta reposición" when everything
                is due now) must not render as a blank panel. */}
            <rect
              x={x(i) - barW / 2}
              y={y(p.value) - (p.value > 0 ? 0 : 2)}
              width={barW}
              height={Math.max(2, h)}
              rx={4}
              fill={toneColor(p.tone)}
            />
            {/* x label */}
            <text
              x={x(i)}
              y={VIEW_H - 26}
              textAnchor="middle"
              fill="var(--c-ink-2)"
              style={{ fontSize: 11 }}
            >
              {label}
            </text>
            {/* value below label */}
            <text
              x={x(i)}
              y={VIEW_H - 12}
              textAnchor="middle"
              fill="var(--c-ink-3)"
              style={{ fontSize: 10 }}
            >
              {fmtValue(p.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// A chart whose values are all zero carries no information (and reads as an
// empty panel), so the card treats it as "no chart" rather than rendering it.
export function isRenderableChart(
  spec: SummaryChartSpec | null | undefined
): spec is SummaryChartSpec {
  return !!spec && spec.points.some((p) => p.value > 0);
}

export function SummaryChart({ spec }: { spec: SummaryChartSpec }) {
  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="text-ink2 mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
        {spec.title}
        {spec.unit ? <span className="text-ink3 font-normal"> ({spec.unit})</span> : null}
      </figcaption>
      {spec.type === "bar" ? (
        <VerticalBars spec={spec} />
      ) : (
        <HorizontalBars spec={spec} />
      )}
    </figure>
  );
}
