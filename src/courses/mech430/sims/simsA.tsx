/* Group A simulations — Ch 4 (sound), Ch 5 (isentropic), Ch 6 (nozzles & rockets), PS1–PS4. */
import { useMemo, useState } from 'react';
import { Plot, sample } from '../../../core/Plot';
import { Readout, SimFrame, Slider, Tex } from '../../../core/ui';
import * as ise from '../lib/isentropic';
import { gasR, soundSpeed, cp as cpOf } from '../lib/gas';
import { rocket, optimumAreaRatio, infiniteNozzleVe } from '../lib/rocket';
import { criticalPressures } from '../lib/nozzle';
import { FlowSection3D, FieldPoint, PlumeKind } from '../viz/FlowSection3D';
import { fmt } from './common';

const btnRow = { display: 'flex', flexWrap: 'wrap' as const, gap: 6, margin: '0.3rem 0 0.6rem' };
const blend = (a: number, b: number, s: number) => a + (b - a) * 0.5 * (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, s))));

/**
 * Isentropic path between two Mach numbers, as area A(x)/A* and M(x) for x ∈ [0, 1].
 * If the stations are on different branches the duct goes through a throat (A = A*) at x = 0.5.
 */
export function isentropicPath(M1: number, M2: number, g = 1.4) {
  const r1 = ise.A_Astar(M1, g);
  const r2 = ise.A_Astar(M2, g);
  const crosses = (M1 - 1) * (M2 - 1) < 0;
  const b1: ise.Branch = M1 < 1 ? 'sub' : 'sup';
  const b2: ise.Branch = M2 < 1 ? 'sub' : 'sup';
  const A = (x: number) => (crosses ? (x < 0.5 ? blend(r1, 1, x / 0.5) : blend(1, r2, (x - 0.5) / 0.5)) : blend(r1, r2, x));
  const M = (x: number) => ise.M_from_A_Astar(Math.max(1, A(x)), crosses ? (x < 0.5 ? b1 : b2) : b1, g);
  const field = (x: number): FieldPoint => {
    const m = M(x);
    return { M: m, p: ise.p_p0(m, g), T: ise.T_T0(m, g) };
  };
  return { A, M, field, crosses, Amax: Math.max(r1, r2) };
}

/* =====================================================================================
   0. Generic isentropic duct in 3-D (problem setups)
   ===================================================================================== */
export function IsentropicDuct3D({
  M1,
  M2,
  g = 1.4,
  wall = 'duct',
  plume = 'none',
  label1,
  label2,
  colorBy = 'M',
  height = 260,
}: {
  M1: number;
  M2: number;
  g?: number;
  wall?: 'engine' | 'duct' | 'plain';
  plume?: PlumeKind;
  label1?: string;
  label2?: string;
  colorBy?: 'M' | 'p' | 'T';
  height?: number;
}) {
  const path = useMemo(() => isentropicPath(M1, M2, g), [M1, M2, g]);
  const L = 1.6;
  const labels: { x: number; text: string; side?: 'top' | 'bottom' }[] = [
    { x: 0.04 * L, text: label1 ?? `1 · M = ${fmt(M1, 3)}` },
    { x: 0.96 * L, text: label2 ?? `2 · M = ${fmt(M2, 3)}` },
  ];
  if (path.crosses) labels.push({ x: 0.5 * L, text: 'throat = A* · M = 1', side: 'bottom' });
  return (
    <FlowSection3D
      wall={wall}
      x0={0}
      x1={L}
      profile={(x) => 0.3 * Math.sqrt(path.A(x / L) / path.Amax)}
      field={(x) => path.field(x / L)}
      colorBy={colorBy}
      plume={{ kind: plume }}
      labels={labels}
      height={height}
    />
  );
}

/* =====================================================================================
   1. Bell Centre: a converging nozzle with back pressure
   ===================================================================================== */
const convArea = (x: number) => blend(3, 1, x); // A/A_exit, inlet 3× the exit

function bellMach(x: number, pb: number, g: number) {
  if (pb >= 0.9999) return 0;
  const choked = pb <= ise.pstar_p0(g);
  const Me = choked ? 1 : ise.M_from_p_p0(pb, g);
  const Astar = 1 / ise.A_Astar(Me, g);
  return ise.M_from_A_Astar(Math.max(1, convArea(x) / Astar), 'sub', g);
}

export function BellCentreSim({ initialPb = 0.8 }: { initialPb?: number }) {
  const g = 1.4;
  const [pb, setPb] = useState(initialPb);
  const pstar = ise.pstar_p0(g);
  const choked = pb <= pstar;
  const noFlow = pb >= 0.9999;
  const Me = noFlow ? 0 : choked ? 1 : ise.M_from_p_p0(pb, g);
  const Mjet = noFlow ? 0 : ise.M_from_p_p0(pb, g);
  const mdotRatio = Me > 0 ? 1 / ise.A_Astar(Me, g) : 0;
  const pAlong = (x: number) => (x <= 1 ? ise.p_p0(bellMach(x, pb, g), g) : choked ? blend(pstar, pb, (x - 1) / 0.3) : pb);
  const plume: PlumeKind = noFlow ? 'none' : !choked ? 'subsonic' : pb > pstar - 0.01 ? 'ideal' : 'under';
  return (
    <SimFrame title="The Bell Centre exit" subtitle="lower the back pressure: once the door is sonic, the crowd can't leave any faster">
      <div className="controls">
        <Slider label="Back pressure p_b / p₀ (clear the concourse)" value={pb} min={0.05} max={1} step={0.001} onChange={setPb} format={(v) => v.toFixed(3)} />
      </div>
      <div className="regime">
        {noFlow
          ? 'p_b = p₀: nobody moves'
          : choked
            ? `CHOKED: M_exit = 1, p_exit = p* = ${pstar.toFixed(4)} p₀ ≠ p_b. The jet finishes expanding outside.`
            : `Subsonic: p_exit = p_b (latex balloon), M_exit = ${fmt(Me, 3)}`}
      </div>
      <FlowSection3D
        wall="plain"
        x0={0}
        x1={1}
        profile={(x) => 0.11 * Math.sqrt(convArea(x))}
        field={(x) => {
          const M = bellMach(x, pb, g);
          return { M, p: ise.p_p0(M, g), T: ise.T_T0(M, g) };
        }}
        plume={{ kind: plume, strength: choked ? Math.min(1.5, Mjet - 0.6) : 1 }}
        labels={[
          { x: 0.05, text: 'arena · p₀, T₀' },
          { x: 1, text: `door · M = ${fmt(Me, 3)}` },
        ]}
        flowSpeed={noFlow ? 0 : 1}
        height={260}
      />
      <div className="twocol">
        <Plot
          x={[0, 1.3]}
          y={[0, 1.05]}
          height={220}
          xLabel="x (nozzle 0 → 1, then the jet)"
          yLabel="p / p₀"
          series={[{ points: sample(pAlong, 0, 1.3, 150), width: 3, label: 'pressure along the flow' }]}
          hlines={[{ y: pstar, label: 'p* = 0.5283 p₀' }]}
          vlines={[{ x: 1, label: 'exit' }]}
        />
        <Plot
          x={[0, 1]}
          y={[0, 1.08]}
          height={220}
          xLabel="p_b / p₀"
          yLabel="ṁ / ṁ_max"
          series={[{ points: sample((p) => (p <= pstar ? 1 : 1 / ise.A_Astar(ise.M_from_p_p0(p, g), g)), 0.001, 0.9999, 200), width: 3 }]}
          vlines={[{ x: pstar, label: 'p*' }]}
          dots={[{ x: pb, y: mdotRatio, label: 'you are here' }]}
        />
      </div>
      <Readout
        items={[
          ['M_exit', fmt(Me, 3)],
          ['p_exit / p₀', fmt(noFlow ? 1 : Math.max(pb, pstar), 4)],
          ['ṁ / ṁ_max', fmt(mdotRatio, 4)],
          ['jet Mach once expanded to p_b', fmt(Mjet, 3)],
        ]}
      />
    </SimFrame>
  );
}

/* =====================================================================================
   2. Velocity–area rule
   ===================================================================================== */
export function AreaVelocitySim({ initialM = 0.5 }: { initialM?: number }) {
  const g = 1.4;
  const [M, setM] = useState(initialM);
  const [sign, setSign] = useState<-1 | 1>(-1);
  const k = 1 / (M * M - 1);
  const dV = k * sign;
  const sonic = Math.abs(M - 1) < 0.02;
  const arrow = (v: number) => (sonic ? '∞ (M = 1!)' : v > 0 ? '↑ increases' : '↓ decreases');
  const Am = ise.A_Astar(M, g);
  const branch: ise.Branch = M < 1 ? 'sub' : 'sup';
  const Ax = (x: number) => Am * (1 + sign * 0.5 * (x - 0.5));
  const chokes = Ax(sign < 0 ? 1 : 0) < 1;
  const field = (x: number): FieldPoint => {
    const m = ise.M_from_A_Astar(Math.max(1, Ax(x)), branch, g);
    return { M: m, p: ise.p_p0(m, g), T: ise.T_T0(m, g) };
  };
  return (
    <SimFrame title="Velocity–area rule" subtitle="dV/V = (dA/A) / (M² − 1): the sign of (M² − 1) flips everything">
      <div className="controls">
        <Slider label="Mach number in the middle of the duct" value={M} min={0.1} max={3} step={0.01} onChange={setM} />
      </div>
      <div style={btnRow}>
        <button className={`btn ${sign < 0 ? 'primary' : ''}`} onClick={() => setSign(-1)}>
          converging (dA &lt; 0)
        </button>
        <button className={`btn ${sign > 0 ? 'primary' : ''}`} onClick={() => setSign(1)}>
          diverging (dA &gt; 0)
        </button>
      </div>
      <div className="regime">
        {M < 1 ? 'Subsonic' : 'Supersonic'} flow in a {sign < 0 ? 'converging' : 'diverging'} duct →{' '}
        {sonic ? 'M = 1 is only possible where dA = 0 (a throat)' : dV > 0 ? 'it ACCELERATES (a nozzle)' : 'it DECELERATES (a diffuser)'}
        {chokes ? ' — but this much contraction would need A < A*: in reality the duct would choke.' : ''}
      </div>
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={1.4}
        profile={(x) => 0.18 * Math.sqrt(Ax(x / 1.4) / (Am * 1.25))}
        field={(x) => field(x / 1.4)}
        labels={[
          { x: 0.06, text: `in · M = ${fmt(field(0).M, 3)}` },
          { x: 1.34, text: `out · M = ${fmt(field(1).M, 3)}` },
        ]}
        height={230}
      />
      <Plot
        x={[0, 3]}
        y={[-6, 6]}
        height={200}
        xLabel="M"
        yLabel="(dV/V)/(dA/A)"
        series={[
          { points: sample((m) => 1 / (m * m - 1), 0.01, 0.92, 120), width: 3, label: '1/(M² − 1)' },
          { points: sample((m) => 1 / (m * m - 1), 1.08, 3, 120), width: 3, color: 'var(--c1)' },
        ]}
        hlines={[{ y: 0 }]}
        vlines={[{ x: 1, label: 'M = 1' }]}
        dots={Math.abs(M - 1) > 0.08 ? [{ x: M, y: k }] : []}
      />
      <Readout
        items={[
          ['V', arrow(dV)],
          ['M', arrow((1 + ((g - 1) / 2) * M * M) * dV)],
          ['p', arrow(-g * M * M * dV)],
          ['ρ', arrow(-M * M * dV)],
          ['T', arrow(-(g - 1) * M * M * dV)],
          ['|dV/V| per 1% of area', sonic ? '∞' : `${fmt(Math.abs(k), 3)}%`],
        ]}
      />
    </SimFrame>
  );
}

/* =====================================================================================
   3. Stagnation & sonic ratios (chart)
   ===================================================================================== */
export function StagnationRatiosSim({ initialM = 1 }: { initialM?: number }) {
  const [M, setM] = useState(initialM);
  const [g, setG] = useState(1.4);
  const bars: [string, number, number, string][] = [
    ['T / T₀', ise.T_T0(M, g), ise.Tstar_T0(g), 'var(--c2)'],
    ['ρ / ρ₀', ise.rho_rho0(M, g), ise.rhostar_rho0(g), 'var(--c3)'],
    ['p / p₀', ise.p_p0(M, g), ise.pstar_p0(g), 'var(--c1)'],
  ];
  const X = (v: number) => 70 + v * 420;
  return (
    <SimFrame title="Static vs stagnation vs sonic" subtitle="how far below the reservoir state is the moving gas?">
      <div className="controls">
        <Slider label="Mach number M" value={M} min={0} max={4} step={0.01} onChange={setM} />
        <Slider label="γ" value={g} min={1.1} max={1.67} step={0.01} onChange={setG} />
      </div>
      <svg viewBox="0 0 560 154" style={{ width: '100%', height: 'auto' }}>
        {bars.map(([lab, v, s, c], i) => (
          <g key={lab} transform={`translate(0 ${6 + i * 48})`}>
            <text x={6} y={22} style={{ fontSize: 13, fill: 'var(--text)' }}>
              {lab}
            </text>
            <rect x={X(0)} y={6} width={420} height={22} fill="var(--surface-2)" stroke="var(--border)" />
            <rect x={X(0)} y={6} width={420 * v} height={22} fill={c} opacity={0.85} />
            <line x1={X(s)} x2={X(s)} y1={0} y2={34} stroke="var(--text)" strokeDasharray="3 3" />
            <text x={X(s) + 3} y={44} style={{ fontSize: 10, fill: 'var(--muted)' }}>
              sonic {s.toFixed(4)}
            </text>
            <text x={X(Math.max(v, 0.02)) + 4} y={22} style={{ fontSize: 12, fill: 'var(--text)' }}>
              {v.toFixed(4)}
            </text>
          </g>
        ))}
      </svg>
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
        Temperature falls slowest, pressure fastest (<Tex>{'p/p_0 = (T/T_0)^{\\gamma/(\\gamma-1)}'}</Tex>). The dashed marks are the sonic
        ratios; for γ = 1.4 they are <b>0.8333, 0.6339, 0.5283</b>.
      </p>
    </SimFrame>
  );
}

/* =====================================================================================
   4. The invariants method
   ===================================================================================== */
interface InvPreset {
  name: string;
  M1?: number;
  V1?: number;
  T1: number;
  p1: number;
  pUnit: string;
  A1: number;
  R: number;
  M2: number;
}
const INV_PRESETS: Record<string, InvPreset> = {
  jan27: { name: 'Jan 27 lecture: 700 m/s → M 3', V1: 700, T1: 300, p1: 1, pUnit: 'bar', A1: 1, R: 8314 / 28.9, M2: 3 },
  notes: { name: 'Notes §5.5.1: M 0.5 → 0.8', M1: 0.5, T1: 300, p1: 0.843, pUnit: 'atm', A1: 1, R: 287, M2: 0.8 },
  ps2p3: { name: 'PS2 P3: 600 m/s, 5 °C', V1: 600, T1: 278, p1: 70, pUnit: 'kPa', A1: 1, R: 287.058, M2: 2.34 },
};

export function InvariantsSim({ preset = 'jan27' }: { preset?: string }) {
  const g = 1.4;
  const [key, setKey] = useState(INV_PRESETS[preset] ? preset : 'jan27');
  const P = INV_PRESETS[key];
  const [M2, setM2] = useState(P.M2);
  const [slip, setSlip] = useState(false);
  const M1 = P.M1 ?? (P.V1 ?? 0) / soundSpeed(g, P.R, P.T1);
  const T0 = P.T1 * ise.T0_T(M1, g);
  const p0 = P.p1 * ise.p0_p(M1, g);
  const r1 = slip && key === 'jan27' ? 1.6375 : ise.A_Astar(M1, g);
  const Astar = P.A1 / r1;
  const T2 = T0 / ise.T0_T(M2, g);
  const p2 = p0 / ise.p0_p(M2, g);
  const A2 = Astar * ise.A_Astar(M2, g);
  const V2 = M2 * soundSpeed(g, P.R, T2);
  const crosses = (M1 - 1) * (M2 - 1) < 0;
  return (
    <SimFrame title="The invariants method" subtitle="find T₀, p₀, A* once at the known station, then reuse them everywhere">
      <div style={btnRow}>
        {Object.entries(INV_PRESETS).map(([k, v]) => (
          <button
            key={k}
            className={`btn ${k === key ? 'primary' : ''}`}
            onClick={() => {
              setKey(k);
              setM2(v.M2);
            }}
          >
            {v.name}
          </button>
        ))}
      </div>
      <div className="controls">
        <Slider label="Mach number at station 2" value={M2} min={0.1} max={4} step={0.01} onChange={setM2} />
      </div>
      {key === 'jan27' && (
        <label style={{ fontSize: '0.9rem', display: 'block', margin: '0.2rem 0 0.5rem' }}>
          <input type="checkbox" checked={slip} onChange={(e) => setSlip(e.target.checked)} /> use the lecture-note value A₁/A* = 1.6375 (the slip)
          instead of the exact {fmt(ise.A_Astar(M1, g), 4)}
        </label>
      )}
      <div className="regime">
        invariants: T₀ = {fmt(T0, 4)} K · p₀ = {fmt(p0, 4)} {P.pUnit} · A* = {fmt(Astar, 4)} m²
      </div>
      <IsentropicDuct3D M1={M1} M2={M2} height={240} label1={`1 · M = ${fmt(M1, 3)} · A = ${fmt(P.A1, 3)} m²`} label2={`2 · M = ${fmt(M2, 3)} · A = ${fmt(A2, 3)} m²`} />
      <Readout
        items={[
          ['M₁', fmt(M1, 4)],
          ['A₁/A*', fmt(r1, 4)],
          ['T₂', `${fmt(T2, 4)} K`],
          ['p₂', `${fmt(p2, 4)} ${P.pUnit}`],
          ['A₂', `${fmt(A2, 4)} m²`],
          ['V₂', `${fmt(V2, 4)} m/s`],
        ]}
      />
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
        {crosses
          ? 'Stations 1 and 2 are on different branches, so the duct MUST have a throat, and its area is exactly A*.'
          : 'Both stations are on the same branch. The duct never reaches M = 1, but A* is still a perfectly good reference.'}
      </p>
    </SimFrame>
  );
}

/* =====================================================================================
   5. Speed of sound in gases (chart) + Newton vs Laplace
   ===================================================================================== */
const PS1_GASES: [string, number, number][] = [
  ['He', 1.67, 4],
  ['H₂', 1.4, 2],
  ['N₂', 1.4, 28],
  ['Air', 1.4, 28.9],
  ['Ar', 1.67, 40],
  ['CO₂', 1.28, 44],
  ['SF₆', 1.09, 146],
];

export function SoundSpeedSim({ initialT = 293 }: { initialT?: number }) {
  const [T, setT] = useState(initialT);
  const [newton, setNewton] = useState(false);
  const rows = PS1_GASES.map(([n, gg, MW]) => {
    const R = gasR(MW);
    return { n, c: soundSpeed(gg, R, T), cN: Math.sqrt(R * T) };
  });
  const cmax = 3000;
  const X = (c: number) => 50 + (c / cmax) * 470;
  return (
    <SimFrame title="Speed of sound in different gases" subtitle="c = √(γℜT/MW): depends on T and on the gas, never on p">
      <div className="controls">
        <Slider label="Temperature T" value={T} min={150} max={1500} step={1} onChange={setT} unit=" K" />
      </div>
      <label style={{ fontSize: '0.9rem', display: 'block', margin: '0.2rem 0 0.5rem' }}>
        <input type="checkbox" checked={newton} onChange={(e) => setNewton(e.target.checked)} /> also show Newton's isothermal guess c = √(RT)
      </label>
      <svg viewBox={`0 0 580 ${rows.length * 30 + 12}`} style={{ width: '100%', height: 'auto' }}>
        {rows.map((r, i) => (
          <g key={r.n} transform={`translate(0 ${6 + i * 30})`}>
            <text x={6} y={17} style={{ fontSize: 12, fill: 'var(--text)' }}>
              {r.n}
            </text>
            <rect x={X(0)} y={4} width={X(Math.min(r.c, cmax)) - X(0)} height={18} fill="var(--c1)" opacity={0.85} />
            {newton && <rect x={X(0)} y={18} width={X(Math.min(r.cN, cmax)) - X(0)} height={5} fill="var(--c2)" />}
            <text x={X(Math.min(r.c, cmax)) + 4} y={17} style={{ fontSize: 11, fill: 'var(--text)' }}>
              {r.c.toFixed(0)} m/s{newton ? ` (Newton ${r.cN.toFixed(0)})` : ''}
            </text>
          </g>
        ))}
      </svg>
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
        Light molecules and monatomic gases carry sound fastest.{' '}
        {newton ? "Orange: Newton's isothermal value, too low by the factor √γ (15% for air). " : ''}γ and MW are from PS1 P6, plus H₂ and air.
      </p>
    </SimFrame>
  );
}

/* =====================================================================================
   6. Rocket thrust breakdown (3-D engine + bar chart)
   ===================================================================================== */
interface RocketPreset {
  name: string;
  p0: number;
  T0: number;
  R: number;
  g: number;
  pDesign: number;
}
const ATM = 101325;
const ROCKET_PRESETS: Record<string, RocketPreset> = {
  nerva: { name: 'NERVA (H₂, 3000 K, 30 atm)', p0: 30 * ATM, T0: 3000, R: 8314 / 2, g: 1.4, pDesign: ATM },
  ps4p3: { name: 'PS4 P3 (2 MPa, 1500 K)', p0: 2e6, T0: 1500, R: 300, g: 1.4, pDesign: 1e5 },
  q2w2019: { name: 'Quiz 2 W2019 P2 (1 MPa, 2000 K)', p0: 1e6, T0: 2000, R: 300, g: 1.4, pDesign: 101300 },
};

export function RocketBreakdownSim({ preset = 'nerva' }: { preset?: string }) {
  const [key, setKey] = useState(ROCKET_PRESETS[preset] ? preset : 'nerva');
  const P = ROCKET_PRESETS[key];
  const designAR = useMemo(() => optimumAreaRatio(P.p0, P.pDesign, P.g).AR, [P]);
  const [AR, setAR] = useState(designAR);
  const [paAtm, setPaAtm] = useState(P.pDesign / ATM);
  const pa = paAtm * ATM;
  const r = rocket({ p0: P.p0, T0: P.T0, R: P.R, g: P.g, At: 1, AR, pa });
  const Vmax = infiniteNozzleVe(P.T0, P.R, P.g);
  const mom = r.momentum / r.mdot;
  const pres = r.pressure / r.mdot;
  const crit = criticalPressures(AR, P.g);
  const shockInside = pa > crit.p4 * P.p0;
  const plume: PlumeKind = Math.abs(r.pe - pa) < 0.03 * Math.max(pa, r.pe) ? 'ideal' : r.pe > pa ? 'under' : 'over';
  const path = useMemo(() => isentropicPath(0.2, Math.min(r.Me, 6), P.g), [r.Me, P.g]);
  const X = (v: number) => 170 + (v / (Vmax * 1.08)) * 400;
  const rows: [string, number, string][] = [
    ['momentum V_e', mom, 'var(--c1)'],
    ['pressure A_e(p_e−p_a)/ṁ', pres, pres >= 0 ? 'var(--c3)' : 'var(--c5)'],
    ['total F/ṁ = I_sp', r.Isp, 'var(--c2)'],
  ];
  const choose = (k: string) => {
    const Q = ROCKET_PRESETS[k];
    setKey(k);
    setAR(optimumAreaRatio(Q.p0, Q.pDesign, Q.g).AR);
    setPaAtm(Q.pDesign / ATM);
  };
  return (
    <SimFrame title="Where does the thrust come from?" subtitle="F/ṁ = V_e + A_e(p_e − p_a)/ṁ: bars in m/s, i.e. I_sp">
      <div style={btnRow}>
        {Object.entries(ROCKET_PRESETS).map(([k, v]) => (
          <button key={k} className={`btn ${k === key ? 'primary' : ''}`} onClick={() => choose(k)}>
            {v.name}
          </button>
        ))}
      </div>
      <div className="controls">
        <Slider label="Area ratio A_e/A_t" value={AR} min={1.2} max={500} step={0.01} onChange={setAR} format={(v) => v.toFixed(2)} />
        <Slider label="Ambient pressure p_a" value={paAtm} min={0} max={1.2} step={0.001} onChange={setPaAtm} unit=" atm" format={(v) => v.toFixed(3)} />
      </div>
      <div style={btnRow}>
        <button className="btn" onClick={() => setAR(designAR)}>
          optimised for sea level (A_e/A_t = {designAR.toFixed(2)})
        </button>
        <button className="btn" onClick={() => setPaAtm(0)}>
          go to space (p_a = 0)
        </button>
        <button className="btn" onClick={() => setPaAtm(P.pDesign / ATM)}>
          back to sea level
        </button>
        <button className="btn" onClick={() => setAR(500)}>
          A_e/A_t = 500
        </button>
      </div>
      <FlowSection3D
        wall="engine"
        x0={0}
        x1={1.6}
        profile={(x) => 0.32 * Math.sqrt(path.A(x / 1.6) / path.Amax)}
        field={(x) => path.field(x / 1.6)}
        plume={{ kind: plume, strength: Math.min(1.5, Math.abs(Math.log10((r.pe + 1) / (pa + 1))) + 0.3) }}
        labels={[
          { x: 0.8, text: 'throat · M = 1', side: 'bottom' },
          { x: 1.6, text: `exit · M = ${fmt(r.Me, 3)} · p_e = ${fmt(r.pe / ATM, 3)} atm` },
        ]}
        height={270}
      />
      <svg viewBox="0 0 600 145" style={{ width: '100%', height: 'auto' }}>
        {rows.map(([lab, v, c], i) => (
          <g key={lab} transform={`translate(0 ${8 + i * 38})`}>
            <text x={4} y={18} style={{ fontSize: 11, fill: 'var(--text)' }}>
              {lab}
            </text>
            <rect x={Math.min(X(v), X(0))} y={4} width={Math.abs(X(v) - X(0))} height={20} fill={c} opacity={0.85} />
            <text x={Math.max(X(v), X(0)) + 4} y={18} style={{ fontSize: 11, fill: 'var(--text)' }}>
              {v.toFixed(0)} m/s
            </text>
          </g>
        ))}
        <line x1={X(0)} x2={X(0)} y1={4} y2={122} stroke="var(--border)" />
        <line x1={X(Vmax)} x2={X(Vmax)} y1={4} y2={122} stroke="var(--text)" strokeDasharray="4 3" />
        <text x={X(Vmax) - 200} y={138} style={{ fontSize: 10, fill: 'var(--muted)' }}>
          V_max = √(2c_pT₀) = {Vmax.toFixed(0)} m/s (A_e/A_t → ∞ in vacuum)
        </text>
      </svg>
      {shockInside && (
        <div className="regime" style={{ color: 'var(--c5)' }}>
          ⚠ p_a is above the "normal shock at the exit" pressure ({((crit.p4 * P.p0) / ATM).toFixed(3)} atm): a shock would stand inside the nozzle,
          so these isentropic numbers are not valid (Ch. 8).
        </div>
      )}
      <Readout
        items={[
          ['M_e', fmt(r.Me, 4)],
          ['p_e', `${fmt(r.pe / ATM, 4)} atm`],
          ['I_sp', `${fmt(r.Isp, 4)} m/s = ${fmt(r.Isp / 9.81, 4)} s`],
          ['I_sp / V_max', fmt(r.Isp / Vmax, 4)],
          ['c_p', `${fmt(cpOf(P.g, P.R), 4)} J/kg·K`],
        ]}
      />
    </SimFrame>
  );
}

/* =====================================================================================
   7. PS1 P3 jet engine in 3-D (states from the problem data)
   ===================================================================================== */
export function JetEngine3D() {
  // inlet: 166.7 m/s, 223 K air; exit: 416.7 m/s, 590.7 K, MW 27.5 (PS1 P3)
  const M1 = 166.67 / soundSpeed(1.4, 287, 223);
  const M2 = 416.67 / soundSpeed(1.4, gasR(27.5), 590.7);
  const prof = (x: number) => (x < 0.3 ? 0.2 : x < 1.2 ? blend(0.2, 0.24, (x - 0.3) / 0.9) : blend(0.24, 0.15, (x - 1.2) / 0.4));
  return (
    <FlowSection3D
      wall="duct"
      x0={0}
      x1={1.6}
      pipeStart={0.3}
      profile={prof}
      heatZone={[0.6, 1.1]}
      field={(x) => {
        const s = Math.min(1, Math.max(0, (x - 0.5) / 1.1));
        const M = M1 + (M2 - M1) * s;
        return { M, p: 0.5 + 0.5 * s, T: 0.38 + 0.62 * s };
      }}
      plume={{ kind: 'subsonic' }}
      labels={[
        { x: 0.05, text: '1 · 600 km/h · 30 kPa · −50 °C' },
        { x: 0.85, text: 'combustor: + 3 kg/s fuel', side: 'bottom' },
        { x: 1.6, text: '2 · 1500 km/h · 60 kPa · 0.2 m²' },
      ]}
      height={250}
    />
  );
}
