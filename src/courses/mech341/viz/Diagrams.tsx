import { Plot, Series } from '../../../core/Plot';
import { water, r134a } from '../lib/props';
import { omega } from '../lib/psychro';

export interface TsPoint {
  s: number;
  T: number;
  label?: string;
}

/** Saturation dome (sf, sg vs T) for a fluid. */
function dome(fluid: 'water' | 'r134a') {
  const f = fluid === 'water' ? water : r134a;
  const T0 = fluid === 'water' ? 0.01 : -40;
  const Tc = f.crit.T;
  const liq: { x: number; y: number }[] = [];
  const vap: { x: number; y: number }[] = [];
  const n = 70;
  for (let i = 0; i <= n; i++) {
    const T = T0 + ((Tc - 0.5 - T0) * i) / n;
    try {
      const st = f.satT(T);
      if (isFinite(st.sf) && isFinite(st.sg)) {
        liq.push({ x: st.sf, y: T });
        vap.push({ x: st.sg, y: T });
      }
    } catch {
      /* outside table range: skip */
    }
  }
  return { liq, vap, Tc, T0 };
}

/** T-s diagram: saturation dome for the fluid plus a cycle polyline through `path` (indices into `points`). */
export function TsDiagramView({ fluid, points, path, height = 340 }: { fluid: 'water' | 'r134a'; points: TsPoint[]; path?: number[]; height?: number }) {
  const { liq, vap, Tc, T0 } = dome(fluid);
  const smax = Math.max(...vap.map((p) => p.x), ...points.map((p) => p.s)) * 1.05;
  const smin = Math.min(0, ...liq.map((p) => p.x), ...points.map((p) => p.s));
  const Tmax = Math.max(Tc, ...points.map((p) => p.T)) + 40;
  const Tmin = Math.min(T0, ...points.map((p) => p.T)) - 20;
  const series: Series[] = [
    { points: liq, color: 'var(--muted)', width: 1.8 },
    { points: vap, color: 'var(--muted)', width: 1.8 },
  ];
  const idx = path ?? points.map((_, i) => i);
  const cyc = idx.filter((i) => points[i]).map((i) => ({ x: points[i].s, y: points[i].T }));
  if (cyc.length > 1) series.push({ points: cyc, color: 'var(--c1)', width: 2.4 });
  return (
    <Plot
      x={[smin, smax]}
      y={[Tmin, Tmax]}
      height={height}
      xLabel="s (kJ/kg·K)"
      yLabel="T (°C)"
      series={series}
      dots={points.map((p, i) => ({ x: p.s, y: p.T, label: p.label ?? String(i + 1), color: 'var(--c2)' }))}
      legend={false}
    />
  );
}

export interface PsyPoint {
  T: number;
  w: number;
  label?: string;
}

/** Psychrometric chart: T 0-50 °C, ω 0-0.03; φ = 10…100 %, a few constant-h and wet-bulb lines. */
export function PsychroChartView({ points = [], P = 101.325 }: { points?: PsyPoint[]; P?: number }) {
  const Ts = Array.from({ length: 51 }, (_, i) => i);
  const series: Series[] = [];
  for (let phi = 10; phi <= 100; phi += 10) {
    series.push({
      points: Ts.map((T) => ({ x: T, y: omega(T, phi / 100, P) })),
      color: phi === 100 ? 'var(--c1)' : 'var(--muted)',
      width: phi === 100 ? 2.4 : 1.1,
    });
  }
  // constant enthalpy lines (kJ/kg dry air), cut at the saturation curve
  for (const h of [20, 40, 60, 80, 100]) {
    const pts: { x: number; y: number }[] = [];
    for (let T = 0; T <= 50; T += 1) {
      const w = (h - 1.005 * T) / (2501.3 + 1.82 * T);
      if (w < 0 || w > omega(T, 1, P)) continue;
      pts.push({ x: T, y: w });
    }
    if (pts.length > 1) series.push({ points: pts, color: 'var(--c3)', width: 1, dash: true });
  }
  // constant wet-bulb lines from the adiabatic-saturation relation
  for (const Twb of [10, 15, 20, 25]) {
    const wsat = omega(Twb, 1, P);
    const pts: { x: number; y: number }[] = [];
    for (let T = Twb; T <= 50; T += 2) {
      const w = ((2501.3 - 2.381 * Twb) * wsat - 1.005 * (T - Twb)) / (2501.3 + 1.82 * T - 4.186 * Twb);
      if (w >= 0 && isFinite(w)) pts.push({ x: T, y: w });
    }
    if (pts.length > 1) series.push({ points: pts, color: 'var(--c4)', width: 1, dash: true });
  }
  return (
    <>
      <Plot
        x={[0, 50]}
        y={[0, 0.03]}
        height={340}
        xLabel="dry-bulb T (°C)"
        yLabel="ω (kg/kg dry air)"
        series={series}
        dots={points.map((p, i) => ({ x: p.T, y: p.w, label: p.label ?? String(i + 1), color: 'var(--c2)' }))}
        legend={false}
      />
      <div className="srcnote">Solid: φ = 10…100 % (coloured = saturation). Dashed: constant h (20…100 kJ/kg) and constant wet-bulb (10…25 °C). P = {P} kPa.</div>
    </>
  );
}
