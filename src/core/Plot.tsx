import { ReactNode, useMemo } from 'react';

export interface Series {
  points: { x: number; y: number }[];
  color?: string;
  dash?: boolean;
  width?: number;
  label?: string;
}

export interface PlotProps {
  x: [number, number];
  y: [number, number];
  series: Series[];
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  xTicks?: number[];
  yTicks?: number[];
  /** Vertical marker lines */
  vlines?: { x: number; color?: string; label?: string; dash?: boolean }[];
  hlines?: { y: number; color?: string; label?: string; dash?: boolean }[];
  dots?: { x: number; y: number; color?: string; label?: string; r?: number }[];
  /** Shaded vertical bands */
  bands?: { x0: number; x1: number; color: string; opacity?: number; label?: string }[];
  /** Extra SVG drawn in data coordinates via helper */
  children?: (sx: (v: number) => number, sy: (v: number) => number) => ReactNode;
  legend?: boolean;
  logY?: boolean;
}

function niceTicks(a: number, b: number, n = 5): number[] {
  const span = b - a;
  if (span <= 0) return [a];
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 0.5) ?? mag * 10;
  const start = Math.ceil(a / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= b + 1e-9 * step; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const fmt = (v: number) => {
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.01 || a >= 1e4)) return v.toExponential(0);
  return String(Number(v.toPrecision(3)));
};

export function Plot({
  x,
  y,
  series,
  width = 640,
  height = 300,
  xLabel,
  yLabel,
  xTicks,
  yTicks,
  vlines = [],
  hlines = [],
  dots = [],
  bands = [],
  children,
  legend = true,
  logY = false,
}: PlotProps) {
  const m = { l: 52, r: 14, t: 12, b: 40 };
  const W = width - m.l - m.r;
  const H = height - m.t - m.b;
  const ty = (v: number) => (logY ? Math.log10(Math.max(v, 1e-12)) : v);
  const [y0, y1] = [ty(y[0]), ty(y[1])];
  const sx = (v: number) => m.l + ((v - x[0]) / (x[1] - x[0])) * W;
  const sy = (v: number) => m.t + H - ((ty(v) - y0) / (y1 - y0)) * H;
  const xt = xTicks ?? niceTicks(x[0], x[1], 6);
  const yt = yTicks ?? (logY ? range(Math.ceil(y0), Math.floor(y1)).map((e) => 10 ** e) : niceTicks(y[0], y[1], 5));

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = '';
        let pen = false;
        for (const p of s.points) {
          if (!isFinite(p.x) || !isFinite(p.y)) {
            pen = false;
            continue;
          }
          const X = sx(p.x);
          const Y = Math.max(m.t - 2, Math.min(m.t + H + 2, sy(p.y)));
          d += `${pen ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)}`;
          pen = true;
        }
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, x[0], x[1], y[0], y[1], width, height, logY],
  );

  const colors = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
  return (
    <div className="plot">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <clipPath id={`clip-${width}-${height}`}>
            <rect x={m.l} y={m.t} width={W} height={H} />
          </clipPath>
        </defs>
        {bands.map((b, i) => (
          <g key={`b${i}`}>
            <rect x={sx(b.x0)} y={m.t} width={Math.max(0, sx(b.x1) - sx(b.x0))} height={H} fill={b.color} opacity={b.opacity ?? 0.12} />
            {b.label && (
              <text x={(sx(b.x0) + sx(b.x1)) / 2} y={m.t + 12} textAnchor="middle" style={{ fontSize: 10 }}>
                {b.label}
              </text>
            )}
          </g>
        ))}
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line className="gridline" x1={m.l} x2={m.l + W} y1={sy(v)} y2={sy(v)} />
            <text x={m.l - 6} y={sy(v) + 3.5} textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <g key={`x${v}`}>
            <line className="gridline" x1={sx(v)} x2={sx(v)} y1={m.t} y2={m.t + H} />
            <text x={sx(v)} y={m.t + H + 15} textAnchor="middle">
              {fmt(v)}
            </text>
          </g>
        ))}
        <rect x={m.l} y={m.t} width={W} height={H} fill="none" stroke="var(--border)" />
        <g clipPath={`url(#clip-${width}-${height})`}>
          {hlines.map((h, i) => (
            <g key={`h${i}`}>
              <line x1={m.l} x2={m.l + W} y1={sy(h.y)} y2={sy(h.y)} stroke={h.color ?? 'var(--muted)'} strokeDasharray={h.dash === false ? undefined : '4 4'} />
              {h.label && (
                <text x={m.l + W - 4} y={sy(h.y) - 4} textAnchor="end" style={{ fill: h.color ?? 'var(--muted)' }}>
                  {h.label}
                </text>
              )}
            </g>
          ))}
          {vlines.map((v, i) => (
            <g key={`v${i}`}>
              <line x1={sx(v.x)} x2={sx(v.x)} y1={m.t} y2={m.t + H} stroke={v.color ?? 'var(--muted)'} strokeDasharray={v.dash === false ? undefined : '4 4'} strokeWidth={1.3} />
              {v.label && (
                <text x={sx(v.x) + 4} y={m.t + 12} style={{ fill: v.color ?? 'var(--muted)' }}>
                  {v.label}
                </text>
              )}
            </g>
          ))}
          {series.map((s, i) => (
            <path
              key={`s${i}`}
              d={paths[i]}
              fill="none"
              stroke={s.color ?? colors[i % colors.length]}
              strokeWidth={s.width ?? 2.2}
              strokeDasharray={s.dash ? '6 5' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {children?.(sx, sy)}
          {dots.map((d, i) => (
            <g key={`d${i}`}>
              <circle cx={sx(d.x)} cy={sy(d.y)} r={d.r ?? 4.5} fill={d.color ?? 'var(--c2)'} stroke="var(--surface)" strokeWidth={1.5} />
              {d.label && (
                <text x={sx(d.x) + 7} y={sy(d.y) - 7} style={{ fill: 'var(--text)', fontWeight: 600 }}>
                  {d.label}
                </text>
              )}
            </g>
          ))}
        </g>
        {xLabel && (
          <text x={m.l + W / 2} y={height - 6} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 12 }}>
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text transform={`translate(13 ${m.t + H / 2}) rotate(-90)`} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 12 }}>
            {yLabel}
          </text>
        )}
      </svg>
      {legend && series.some((s) => s.label) && (
        <div className="legend">
          {series
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => s.label)
            .map(({ s, i }) => (
              <span key={i} className={s.dash ? 'dash' : ''} style={{ ['--lc' as string]: s.color ?? colors[i % colors.length] }}>
                {s.label}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function range(a: number, b: number) {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/** Sample a function into plot points. */
export function sample(f: (x: number) => number, a: number, b: number, n = 200) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    let y: number;
    try {
      y = f(x);
    } catch {
      y = NaN;
    }
    pts.push({ x, y });
  }
  return pts;
}
