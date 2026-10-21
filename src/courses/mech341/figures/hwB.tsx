/**
 * MECH 341 figures for the assignment pages a06-a10 (gas mixtures, psychrometrics, combustion, equilibrium, compressible flow).
 * Numbers come from the lib; schematics use the site's CSS variables.
 */
import { Figure } from '../../../core/ui';
import { Plot, Series } from '../../../core/Plot';
import { water } from '../lib/props';
import { areaRatio } from '../lib/compressible';

const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

/* ---------------------------------------------------------------- composition bar */
export interface BarPart {
  label: string;
  y: number; // mole (or mass) fraction
}

/** One horizontal stacked bar of a gas composition, with the fraction written on each segment that is wide enough. */
export function MoleBarFigure({ title, parts, caption }: { title: string; parts: BarPart[]; caption?: string }) {
  const total = parts.reduce((a, p) => a + p.y, 0);
  const W = 640;
  const x0 = 10;
  const bw = W - 2 * x0;
  let x = x0;
  return (
    <Figure caption={caption}>
      <svg viewBox={`0 0 ${W} 112`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={title}>
        <text x={x0} y={18} style={{ fill: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
          {title}
        </text>
        {parts.map((p, k) => {
          const w = (p.y / total) * bw;
          const cx = x + w / 2;
          const el = (
            <g key={p.label}>
              <rect x={x} y={30} width={w} height={34} fill={COLORS[k % COLORS.length]} stroke="var(--surface)" strokeWidth={1.5} />
              {w > 46 && (
                <text x={cx} y={52} textAnchor="middle" style={{ fill: '#fff', fontSize: 12.5, fontWeight: 600 }}>
                  {p.y.toFixed(p.y < 0.1 ? 3 : 3)}
                </text>
              )}
              <text x={cx} y={k % 2 === 0 ? 82 : 100} textAnchor="middle" style={{ fill: COLORS[k % COLORS.length], fontSize: 12.5, fontWeight: 600 }}>
                {p.label}
                {w <= 46 ? ` ${p.y.toFixed(3)}` : ''}
              </text>
            </g>
          );
          x += w;
          return el;
        })}
      </svg>
    </Figure>
  );
}

/* ---------------------------------------------------------------- 13-56 */
export interface TankSpec {
  gas: string;
  mass: string;
  T: string;
  P: string;
  V: string;
  insulated?: boolean;
}

/** Two rigid tanks joined by a valve (13-42, 13-56): what is in each tank before the valve is opened. */
export function TwoTankFigure({ left, right, caption }: { left: TankSpec; right: TankSpec; caption?: string }) {
  const tank = (x: number, t: TankSpec, c: string) => (
    <g>
      <rect x={x} y={30} width={190} height={110} rx={10} fill="var(--surface-2)" stroke={t.insulated ? 'var(--c2)' : 'var(--text)'} strokeWidth={t.insulated ? 4 : 1.6} strokeDasharray={t.insulated ? '10 4' : undefined} />
      <text x={x + 95} y={56} textAnchor="middle" style={{ fill: c, fontSize: 15, fontWeight: 700 }}>
        {t.gas} ({t.mass})
      </text>
      <text x={x + 95} y={80} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 12.5 }}>
        {t.T}, {t.P}
      </text>
      <text x={x + 95} y={100} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 12.5 }}>
        V = {t.V}
      </text>
      <text x={x + 95} y={124} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 11.5 }}>
        {t.insulated ? 'insulated' : 'not insulated'}
      </text>
    </g>
  );
  return (
    <Figure caption={caption}>
      <svg viewBox="0 0 520 160" style={{ width: '100%', height: 'auto' }} role="img" aria-label="two tanks joined by a valve">
        {tank(10, left, 'var(--c1)')}
        {tank(320, right, 'var(--c3)')}
        <line x1={200} y1={85} x2={320} y2={85} stroke="var(--text)" strokeWidth={5} />
        <polygon points="248,70 272,70 260,85" fill="var(--text)" />
        <polygon points="248,100 272,100 260,85" fill="var(--text)" />
        <text x={260} y={62} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 12 }}>
          valve
        </text>
      </svg>
    </Figure>
  );
}

/* ---------------------------------------------------------------- dew point */
/** P_sat(T) of water with the partial pressure of the vapor drawn as a horizontal line: the temperature where they meet is the dew point. */
export function DewPointFigure({ Pv, label, caption, Tmax = 100 }: { Pv: number; label?: string; caption?: string; Tmax?: number }) {
  const Tdp = water.Tsat(Pv);
  const curve: Series = { points: range(0, Tmax, 50).map((T) => ({ x: T, y: water.Psat(T) })), color: 'var(--c1)', width: 2.4, label: 'P_sat(T)' };
  return (
    <Figure caption={caption}>
      <Plot
        x={[0, Tmax]}
        y={[0, water.Psat(Tmax) * 1.02]}
        height={260}
        xLabel="T (°C)"
        yLabel="P_sat (kPa)"
        series={[curve]}
        hlines={[{ y: Pv, color: 'var(--c2)', dash: true, label: label ?? `P_v = ${Pv} kPa` }]}
        vlines={[{ x: Tdp, color: 'var(--c3)', dash: true, label: `T_dp = ${Tdp.toFixed(1)} °C` }]}
        dots={[{ x: Tdp, y: Pv, color: 'var(--c3)', r: 5 }]}
      />
    </Figure>
  );
}

/* ---------------------------------------------------------------- 16-31, 16-33 */
/**
 * Equilibrium by picture: the left side of the K_p relation as a function of the extent x of reaction. The curve is monotonic,
 * so it crosses the target K_p once: that crossing is the equilibrium composition.
 */
function ExtentFigure({
  f,
  xRange,
  target,
  xStar,
  xLabel = 'extent x (kmol)',
  yLabel = 'K_p expression',
  caption,
}: {
  f: (x: number) => number;
  xRange: [number, number];
  target: number;
  xStar: number;
  xLabel?: string;
  yLabel?: string;
  caption?: string;
}) {
  const pts = range(xRange[0], xRange[1], 80)
    .map((x) => ({ x, y: f(x) }))
    .filter((p) => Number.isFinite(p.y));
  const ymax = Math.min(Math.max(...pts.map((p) => p.y)), target * 4);
  return (
    <Figure caption={caption}>
      <Plot
        x={xRange}
        y={[0, ymax]}
        height={260}
        xLabel={xLabel}
        yLabel={yLabel}
        series={[{ points: pts, color: 'var(--c1)', width: 2.4 }]}
        hlines={[{ y: target, color: 'var(--c2)', dash: true, label: `K_p = ${target.toPrecision(4)}` }]}
        vlines={[{ x: xStar, color: 'var(--c3)', dash: true, label: `x = ${xStar.toFixed(4)}` }]}
        dots={[{ x: xStar, y: target, color: 'var(--c3)', r: 5 }]}
      />
    </Figure>
  );
}

/* ---------------------------------------------------------------- 17-62 */
/** A/A* against Mach number for a given k, with the inlet and sonic points marked: 17-62 and the diffuser examples. */
export function AreaMachFigure({ k = 1.4, Ma1, caption }: { k?: number; Ma1?: number; caption?: string }) {
  const sub = range(0.15, 1, 60).map((M) => ({ x: M, y: areaRatio(M, k) }));
  const sup = range(1, 3, 60).map((M) => ({ x: M, y: areaRatio(M, k) }));
  const dots = [{ x: 1, y: 1, label: 'sonic', color: 'var(--c3)', r: 5 }];
  if (Ma1 !== undefined) dots.push({ x: Ma1, y: areaRatio(Ma1, k), label: `Ma₁ = ${Ma1.toFixed(3)}`, color: 'var(--c2)', r: 5 });
  return (
    <Figure caption={caption}>
      <Plot
        x={[0.1, 3]}
        y={[0.9, 5]}
        height={260}
        xLabel="Ma"
        yLabel="A / A*"
        series={[
          { points: sub, color: 'var(--c1)', width: 2.4, label: 'subsonic branch' },
          { points: sup, color: 'var(--c2)', width: 2.4, label: 'supersonic branch' },
        ]}
        dots={dots}
      />
    </Figure>
  );
}

/** 16-31: x / sqrt((3.76 - x/2)(1 - x/2)) against x; it equals Kp = 0.01962 at x = 0.0376 kmol NO. */
export function NOExtentFigure() {
  const Kp = Math.exp(-3.931);
  const f = (x: number) => x / Math.sqrt((3.76 - x / 2) * (1 - x / 2));
  return (
    <ExtentFigure
      f={f}
      xRange={[0, 0.1]}
      target={Kp}
      xStar={0.0376}
      xLabel="kmol NO formed, x"
      yLabel="Kp expression"
      caption="16-31: the left side of the Kp relation grows with x (Delta nu = 0, so the pressure does not enter). It reaches Kp = e^-3.931 = 0.01962 at x = 0.0376 kmol of NO per kmol of O2 in the air."
    />
  );
}

/** 16-33: the Kp expression of C + 2H2 <-> CH4 with solid carbon left out, against the kmol of CH4 that decomposes. */
export function MethaneExtentFigure() {
  const Kp = Math.exp(2.328);
  const f = (x: number) => ((1 - x) / (4 * x * x)) * (2 + x);
  return (
    <ExtentFigure
      f={f}
      xRange={[0.1, 0.5]}
      target={Kp}
      xStar={0.2066}
      xLabel="kmol CH4 decomposed, x"
      yLabel="Kp expression"
      caption="16-33: with solid carbon left out of the Kp expression and of N_total, the relation (1-x)(2+x)/(4x^2) falls as more methane decomposes and equals e^2.328 = 10.26 at x = 0.2066 kmol (0.793 kmol CH4 remains)."
    />
  );
}
