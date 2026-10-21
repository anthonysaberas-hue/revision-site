/**
 * MECH 341 figures for the exam pages (final 2021, tutorials, mocks). Numbers come from the lib.
 */
import { Figure } from '../../../core/ui';
import { Plot, Series } from '../../../core/Plot';
import { lnKpAt } from '../lib/equilibrium';
import { areaRatio, machFromAreaRatio, P0_P } from '../lib/compressible';

const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

/* ---------------------------------------------------------------- exam format */
export interface MarkPart {
  label: string;
  marks: number;
  mandatory?: boolean;
}

/** Stacked bar of the marks of an exam: mandatory problems in solid colors, the choose-two block hatched. */
export function ExamFormatFigure({ parts, caption }: { parts?: MarkPart[]; caption?: string }) {
  const P: MarkPart[] = parts ?? [
    { label: 'P1 jet engine', marks: 25, mandatory: true },
    { label: 'P2 combustion', marks: 15, mandatory: true },
    { label: 'P3 equilibrium', marks: 10, mandatory: true },
    { label: 'P4', marks: 25 },
    { label: 'P5', marks: 25 },
    { label: 'P6', marks: 25 },
  ];
  const total = P.reduce((a, p) => a + p.marks, 0);
  const W = 640;
  const x0 = 8;
  const bw = W - 2 * x0;
  let x = x0;
  return (
    <Figure caption={caption ?? 'Format of the final: P1-P3 (50 marks) are mandatory; of P4, P5 and P6 you hand in two (50 marks). If you solve all three, the best two count.'}>
      <svg viewBox={`0 0 ${W} 96`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="marks of each problem">
        {P.map((p, k) => {
          const w = (p.marks / total) * bw;
          const cx = x + w / 2;
          const el = (
            <g key={p.label}>
              <rect x={x} y={14} width={w} height={42} fill={p.mandatory ? COLORS[k % COLORS.length] : 'var(--surface-2)'} stroke={p.mandatory ? 'var(--surface)' : COLORS[3]} strokeWidth={p.mandatory ? 1.5 : 2} strokeDasharray={p.mandatory ? undefined : '6 3'} />
              <text x={cx} y={40} textAnchor="middle" style={{ fill: p.mandatory ? '#fff' : 'var(--text)', fontSize: 15, fontWeight: 700 }}>
                {p.marks}
              </text>
              <text x={cx} y={74} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 11.5 }}>
                {p.label}
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

/* ---------------------------------------------------------------- Kp comparison (final 2021 P3a) */
/** ln Kp of CO2 dissociation and of NO formation (as written for N2 + O2 -> 2NO) against temperature; the 4000 K comparison is marked. */
export function KpCompareFigure({ T0 = 4000 }: { T0?: number }) {
  const Ts = range(2000, 5000, 60);
  const co2: Series = { points: Ts.map((T) => ({ x: T, y: lnKpAt('CO₂ ⇌ CO + ½O₂', T) })), color: 'var(--c1)', width: 2.4, label: 'CO2 -> CO + 1/2 O2' };
  const no: Series = { points: Ts.map((T) => ({ x: T, y: 2 * lnKpAt('½N₂ + ½O₂ ⇌ NO', T) })), color: 'var(--c3)', width: 2.4, label: 'N2 + O2 -> 2 NO' };
  return (
    <Figure caption={`ln Kp of the two candidate reactions of the 2021 final, P3(a). Above Kp = 1 (ln Kp = 0) a reaction is more than half complete at 1 atm. At ${T0} K CO2 dissociation has ln Kp = ${lnKpAt('CO₂ ⇌ CO + ½O₂', T0).toFixed(2)} (Kp = ${Math.exp(lnKpAt('CO₂ ⇌ CO + ½O₂', T0)).toFixed(2)}) and the NO reaction ln Kp = ${(2 * lnKpAt('½N₂ + ½O₂ ⇌ NO', T0)).toFixed(2)} (Kp = ${Math.exp(2 * lnKpAt('½N₂ + ½O₂ ⇌ NO', T0)).toFixed(3)}).`}>
      <Plot
        x={[2000, 5000]}
        y={[-9, 4]}
        height={280}
        xLabel="T (K)"
        yLabel="ln Kp"
        series={[co2, no]}
        legend
        hlines={[{ y: 0, color: 'var(--muted)', dash: true }]}
        vlines={[{ x: T0, color: 'var(--c2)', dash: true, label: `${T0} K` }]}
        dots={[
          { x: T0, y: lnKpAt('CO₂ ⇌ CO + ½O₂', T0), color: 'var(--c1)', r: 5 },
          { x: T0, y: 2 * lnKpAt('½N₂ + ½O₂ ⇌ NO', T0), color: 'var(--c3)', r: 5 },
        ]}
      />
    </Figure>
  );
}

/* ---------------------------------------------------------------- choked converging nozzle (17-48C) */
/** Mass flow of a converging nozzle, relative to the choked value, against the back pressure ratio: it stops rising at the critical ratio. */
export function ChokedFlowFigure({ k = 1.4 }: { k?: number }) {
  const Pc = Math.pow(2 / (k + 1), k / (k - 1));
  const flow = (r: number) => {
    const rr = Math.max(r, Pc);
    const num = Math.pow(rr, 2 / k) - Math.pow(rr, (k + 1) / k);
    const den = Math.pow(Pc, 2 / k) - Math.pow(Pc, (k + 1) / k);
    return Math.sqrt(num / den);
  };
  const s: Series = { points: range(0, 1, 120).map((r) => ({ x: r, y: flow(r) })), color: 'var(--c1)', width: 2.6, label: 'm / m*' };
  return (
    <Figure caption={`17-48C: mass flow through a converging nozzle (inlet stagnation state fixed) against the back pressure. Above the critical ratio ${Pc.toFixed(4)} the flow grows as the back pressure falls; below it the exit stays sonic at P* and the flow stays at its maximum m*.`}>
      <Plot x={[0, 1]} y={[0, 1.1]} height={260} xLabel="back pressure / inlet stagnation pressure" yLabel="m / m*" series={[s]} vlines={[{ x: Pc, color: 'var(--c3)', dash: true, label: `P*/P0 = ${Pc.toFixed(3)}` }]} dots={[{ x: Pc, y: 1, color: 'var(--c3)', r: 5 }]} />
    </Figure>
  );
}

/* ---------------------------------------------------------------- C-D nozzle regimes (mock B P6) */
/** P/P0 against A/A* on the two isentropic branches of a converging-diverging nozzle, with the two critical back pressures of the exit area ratio. */
export function NozzleRegimesFigure({ AR = 2, k = 1.4 }: { AR?: number; k?: number }) {
  const ARs = range(1, 2.6, 60);
  const sub: Series = { points: ARs.map((a) => ({ x: a, y: 1 / P0_P(machFromAreaRatio(a, k, 'sub'), k) })), color: 'var(--c1)', width: 2.4, label: 'subsonic branch' };
  const sup: Series = { points: ARs.map((a) => ({ x: a, y: 1 / P0_P(machFromAreaRatio(a, k, 'sup'), k) })), color: 'var(--c3)', width: 2.4, label: 'supersonic branch' };
  const Msub = machFromAreaRatio(AR, k, 'sub');
  const Msup = machFromAreaRatio(AR, k, 'sup');
  const p1 = 1 / P0_P(Msub, k);
  const p3 = 1 / P0_P(Msup, k);
  return (
    <Figure caption={`Diverging part of a C-D nozzle (A/A* = ${AR} at the exit; check: A/A* at Ma = ${Msup.toFixed(3)} is ${areaRatio(Msup, k).toFixed(3)}). The pressure at the exit is P/P0 = ${p1.toFixed(3)} when the throat is just sonic (first critical back pressure, subsonic diffuser) and ${p3.toFixed(4)} on the design (supersonic) branch; between the two a normal shock sits inside the diverging part and for back pressures above the first value the throat is not sonic.`}>
      <Plot x={[1, 2.6]} y={[0, 1.02]} height={270} xLabel="A / A*" yLabel="P / P0" series={[sub, sup]} legend vlines={[{ x: AR, color: 'var(--muted)', dash: true, label: 'exit' }]} dots={[{ x: AR, y: p1, color: 'var(--c1)', r: 5 }, { x: AR, y: p3, color: 'var(--c3)', r: 5 }]} />
    </Figure>
  );
}
