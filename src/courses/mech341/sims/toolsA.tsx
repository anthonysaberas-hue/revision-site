/**
 * MECH 341 calculators, part A: PropsCalc, BraytonCalc, RankineCalc, RefrigCalc.
 * Every number comes from the tested lib. Out-of-range inputs and states show "outside table range" (never NaN, never silent extrapolation):
 * water T > 1300 C or P > 60 MPa; R-134a P > 4 MPa or T outside -40...200 C; air-table gas T outside 200-3000 K.
 */
import { ReactNode, useState } from 'react';
import { Plot, Series } from '../../../core/Plot';
import { Readout } from '../../../core/ui';
import { Chips, Note, Num, Sel, Two, f as fmt } from '../viz/Kit';
import { TsDiagramView, TsPoint } from '../viz/Diagrams';
import { water, r134a, State } from '../lib/props';
import { airTable, atmosphere } from '../lib/gas';
import { brayton, braytonVariable, rpMaxWork, turbojet, rankine } from '../lib/cycles';
import { vcr, flashTwoStage, gasRefrigeration } from '../lib/refrig';

/** table values to 5 significant digits */
const f = (v: number, d = 5) => fmt(v, d);

/* ====================================================================== shared helpers (also used by toolsB) */
export const OOR = 'outside table range';

export function useForm<T extends object>(def: T): [T, (p: Partial<T>) => void, (p: Partial<T>) => void] {
  const [s, setS] = useState<T>(def);
  return [s, (p) => setS((o) => ({ ...o, ...p })), (p) => setS({ ...def, ...p })];
}

export function CalcAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" style={{ border: '1px solid var(--c3, #d33)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', margin: '8px 0', fontSize: '.9rem' }}>
      <b style={{ color: 'var(--c3, #d33)' }}>{children}</b>
    </div>
  );
}

export function PresetBar({ items }: { items: [string, () => void][] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '6px 0 10px' }}>
      <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Check against:</span>
      {items.map(([t, run]) => (
        <button key={t} className="btn" onClick={run}>
          {t}
        </button>
      ))}
    </div>
  );
}

export function Check({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem', margin: '6px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Tbl({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: '.85rem', margin: '8px 0', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={{ textAlign: i ? 'right' : 'left', padding: '2px 6px', borderBottom: '1px solid var(--border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{ textAlign: j ? 'right' : 'left', padding: '2px 6px', fontFamily: j ? 'ui-monospace, monospace' : undefined }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px 6px', margin: '8px 0' }}>
    <b style={{ fontSize: '.85rem' }}>{title}</b>
    {children}
  </div>
);

type Fl = 'water' | 'r134a';
const LIM: Record<Fl, { Pmin: number; Pmax: number; Tmin: number; Tmax: number; name: string }> = {
  water: { Pmin: 0.6117, Pmax: 60000, Tmin: 0.01, Tmax: 1300, name: 'water' },
  r134a: { Pmin: 51.25, Pmax: 4000, Tmin: -40, Tmax: 200, name: 'R-134a' },
};
const FL = { water, r134a };
const fl = (x: Fl) => FL[x];

/** message when P (kPa) or T (C) is outside the tables of the fluid, otherwise null */
export function badP(x: Fl, P: number, label = 'P'): string | null {
  const L = LIM[x];
  if (!Number.isFinite(P) || P < L.Pmin || P > L.Pmax) return `${OOR}: ${label} = ${f(P)} kPa; ${L.name} tables cover ${L.Pmin}–${L.Pmax} kPa.`;
  return null;
}
export function badT(x: Fl, T: number, label = 'T'): string | null {
  const L = LIM[x];
  if (!Number.isFinite(T) || T < L.Tmin || T > L.Tmax) return `${OOR}: ${label} = ${f(T)} °C; ${L.name} tables cover ${L.Tmin}–${L.Tmax} °C.`;
  return null;
}
function stOK(s: State | undefined, x: Fl) {
  if (!s) return false;
  const L = LIM[x];
  return (
    [s.T, s.P, s.v, s.h, s.s].every(Number.isFinite) &&
    !s.outOfRange &&
    s.T >= L.Tmin - 1e-6 &&
    s.T <= L.Tmax + 1e-6 &&
    s.P >= L.Pmin * 0.999 &&
    s.P <= L.Pmax * 1.001
  );
}
const first = (...m: (string | null)[]) => m.find((x) => x) ?? null;
const errMsg = (e: unknown) => `Could not solve this case (${e instanceof Error ? e.message : 'invalid inputs'}).`;
const xText = (s: { x?: number; phase: string }) => (s.x !== undefined && s.x > 0 && s.x < 1 ? f(s.x, 4) : s.phase.replace('saturated ', 'sat. ').replace('superheated vapor', 'sup. vapor').replace('compressed liquid', 'comp. liq.'));

/* ====================================================================== 1. PropsCalc */
type Pair = 'PT' | 'Px' | 'Tx' | 'Ph' | 'Ps';
const PROPS_DEF = { fluid: 'water' as Fl, pair: 'PT' as Pair, P: 1600, T: 300, x: 0.5, h: 3035.4, s: 6.8863 };

export function PropsCalc() {
  const [S, set, load] = useForm(PROPS_DEF);
  const F = fl(S.fluid);
  const L = LIM[S.fluid];
  let st: State | null = null;
  let err: string | null = null;
  try {
    if (S.pair === 'PT') err = first(badP(S.fluid, S.P), badT(S.fluid, S.T));
    else if (S.pair === 'Px') err = first(badP(S.fluid, S.P), S.P >= F.crit.P ? `No saturated mixture at or above the critical pressure (${f(F.crit.P)} kPa).` : null, S.x < 0 || S.x > 1 ? 'Quality must be between 0 and 1.' : null);
    else if (S.pair === 'Tx') err = first(badT(S.fluid, S.T), S.T >= F.crit.T ? `No saturated mixture at or above the critical temperature (${f(F.crit.T)} °C).` : null, S.x < 0 || S.x > 1 ? 'Quality must be between 0 and 1.' : null);
    else err = badP(S.fluid, S.P);
    if (!err) {
      st = S.pair === 'PT' ? F.PT(S.P, S.T) : S.pair === 'Px' ? F.Px(S.P, S.x) : S.pair === 'Tx' ? F.Tx(S.T, S.x) : S.pair === 'Ph' ? F.Ph(S.P, S.h) : F.Ps(S.P, S.s);
      if (!stOK(st, S.fluid)) {
        st = null;
        err = `${OOR}: that combination falls outside the ${L.name} tables (P ${L.Pmin}–${L.Pmax} kPa, T ${L.Tmin}–${L.Tmax} °C).`;
      }
    }
  } catch (e) {
    err = errMsg(e);
  }
  const sat = st && st.P < F.crit.P ? F.satP(st.P) : null;
  const pts: TsPoint[] = st ? [{ s: st.s, T: st.T, label: 'state', P: st.P }] : [];
  const units = { P: 'kPa', T: '°C', x: '', h: 'kJ/kg', s: 'kJ/kg·K' };
  const pairIn: Record<Pair, ('P' | 'T' | 'x' | 'h' | 's')[]> = { PT: ['P', 'T'], Px: ['P', 'x'], Tx: ['T', 'x'], Ph: ['P', 'h'], Ps: ['P', 's'] };
  return (
    <div>
      <PresetBar
        items={[
          ['2021 final P4: h₁ at 1.6 MPa, 300 °C', () => load({ fluid: 'water', pair: 'PT', P: 1600, T: 300 })],
          ['2021 final P4: state 4 (P = 10 kPa, s = 6.8863)', () => load({ fluid: 'water', pair: 'Ps', P: 10, s: 6.8863 })],
          ['R-134a: sat. vapor at 200 kPa', () => load({ fluid: 'r134a', pair: 'Px', P: 200, x: 1 })],
        ]}
      />
      <Two
        left={
          <div>
            <Sel label="Fluid" value={S.fluid} onChange={(v) => load({ fluid: v, pair: S.pair, P: v === 'water' ? 1600 : 800, T: v === 'water' ? 300 : 50, x: 0.5, h: v === 'water' ? 3000 : 300, s: v === 'water' ? 6.8 : 1.0 })} options={[{ v: 'water', t: 'Water (A-4…A-7)' }, { v: 'r134a', t: 'Refrigerant R-134a (A-11…A-13)' }]} />
            <Sel
              label="Known properties"
              value={S.pair}
              onChange={(v) => set({ pair: v })}
              options={[
                { v: 'PT', t: 'P and T' },
                { v: 'Px', t: 'P and x (saturated)' },
                { v: 'Tx', t: 'T and x (saturated)' },
                { v: 'Ph', t: 'P and h' },
                { v: 'Ps', t: 'P and s' },
              ]}
            />
            {pairIn[S.pair].map((k) => (
              <Num key={k} label={k === 'x' ? 'Quality x (0–1)' : k === 'P' ? 'Pressure P' : k === 'T' ? 'Temperature T' : k === 'h' ? 'Enthalpy h' : 'Entropy s'} unit={units[k]} value={S[k]} onChange={(v) => set({ [k]: v } as Partial<typeof S>)} />
            ))}
            <Note>
              Table range: P {L.Pmin}–{L.Pmax} kPa, T {L.Tmin}–{L.Tmax} °C. Compressed liquid uses Çengel eq. 3-8 (h ≈ h<sub>f</sub> + v<sub>f</sub>(P − P<sub>sat</sub>)).
            </Note>
          </div>
        }
        right={
          <div>
            {err && <CalcAlert>{err}</CalcAlert>}
            {st && (
              <>
                <Readout
                  items={[
                    ['Phase', st.phase],
                    ['Quality x', st.x !== undefined && st.x > 0 && st.x < 1 ? f(st.x, 4) : st.phase === 'saturated liquid' ? '0' : st.phase === 'saturated vapor' ? '1' : '— (single phase)'],
                    ['T', `${f(st.T)} °C`],
                    ['P', `${f(st.P)} kPa`],
                    ['v', `${f(st.v)} m³/kg`],
                    ['u', `${f(st.u)} kJ/kg`],
                    ['h', `${f(st.h)} kJ/kg`],
                    ['s', `${f(st.s)} kJ/kg·K`],
                  ]}
                />
                {sat && (
                  <Tbl
                    head={['Saturation at this state', 'T_sat (°C)', 'P_sat (kPa)', 'v_f', 'v_g', 'h_f', 'h_fg', 'h_g', 's_f', 's_g']}
                    rows={[
                      [
                        `P = ${f(st.P)} kPa`,
                        f(sat.T),
                        f(sat.P),
                        f(sat.vf),
                        f(sat.vg),
                        f(sat.hf),
                        f(sat.hfg),
                        f(sat.hg),
                        f(sat.sf),
                        f(sat.sg),
                      ],
                    ]}
                  />
                )}
                <TsDiagramView fluid={S.fluid} points={pts} isobars={st.P < F.crit.P ? [st.P] : []} height={280} />
              </>
            )}
          </div>
        }
      />
    </div>
  );
}

/* ====================================================================== 2. BraytonCalc */
const BR_DEF = {
  mode: 'brayton' as 'brayton' | 'jet',
  // Brayton
  T1: 300,
  P1: 100,
  rp: 8,
  T3: 1300,
  actual: false,
  etaC: 0.8,
  etaT: 0.85,
  regenOn: false,
  eps: 0.75,
  cpModel: 'const' as 'const' | 'table',
  cp: 1.005,
  k: 1.4,
  mdot: 1,
  // turbojet
  amb: 'isa' as 'isa' | 'manual',
  z: 10000,
  Ta: 241.15,
  Pa: 32,
  speedBy: 'V' as 'V' | 'Ma',
  V: 280,
  Ma: 0.9,
  jmdot: 50,
  rc: 12,
  T04: 1100,
  etaD: 1,
  jEtaC: 1,
  jEtaT: 1,
  etaN: 1,
  cpa: 1.005,
  ka: 1.4,
  cpg: 1.005,
  kg: 1.4,
  fuel: 'none' as 'none' | 'f' | 'QHV',
  fval: 0.02,
  QHV: 42700,
  nozzle: 'CD' as 'CD' | 'C',
  fuelMass: false,
};
type BS = typeof BR_DEF;

interface BrOut {
  T2s: number; T2: number; T4s: number; T4: number; T5: number; T6: number;
  wc: number; wt: number; wnet: number; qin: number; eta: number; rbw: number; h?: number[];
}
function brayEval(S: BS, rp: number): BrOut {
  const eC = S.actual ? S.etaC : 1;
  const eT = S.actual ? S.etaT : 1;
  const reg = S.regenOn ? S.eps : 0;
  if (S.cpModel === 'const') {
    const r = brayton({ T1: S.T1, rp, T3: S.T3, etaC: eC, etaT: eT, cp: S.cp, k: S.k, regen: reg });
    return { ...r };
  }
  if (S.T1 < 200 || S.T1 > 3000 || S.T3 < 200 || S.T3 > 3000) throw new Error(`${OOR}: the air table covers 200–3000 K`);
  const r = braytonVariable({ T1: S.T1, rp, T3: S.T3, etaC: eC, etaT: eT, regen: reg });
  const qreg = reg * (r.h4 - r.h2);
  const T2s = airTable.T_Pr(airTable.Pr(S.T1) * rp);
  const T4s = airTable.T_Pr(airTable.Pr(S.T3) / rp);
  const T5 = airTable.T_h(r.h2 + qreg);
  const T6 = airTable.T_h(r.h4 - qreg);
  const out: BrOut = { T2s, T2: r.T2, T4s, T4: r.T4, T5, T6, wc: r.wc, wt: r.wt, wnet: r.wnet, qin: r.qin, eta: r.eta, rbw: r.rbw, h: [r.h1, r.h2, r.h3, r.h4] };
  for (const T of [T2s, r.T2, T4s, r.T4, T5, T6]) if (!(T >= 200 && T <= 3000)) throw new Error(`${OOR}: a state temperature (${f(T)} K) leaves the 200–3000 K air table`);
  return out;
}

export function BraytonCalc() {
  const [S, set, load] = useForm(BR_DEF);
  const presets: [string, () => void][] = [
    ['9-95: gas turbine, 6484 kW', () => load({ mode: 'brayton', T1: 313.15, P1: 100, rp: 16, T3: 1681.98, actual: true, etaC: 0.85, etaT: 0.88, regenOn: false, cpModel: 'const', cp: 1.108, k: 1.35, mdot: 15.763 })],
    ['9-136: turbojet, Vₑ = 832.5 m/s', () => load({ mode: 'jet', amb: 'manual', Ta: 241.15, Pa: 32, speedBy: 'V', V: 280, jmdot: 50, rc: 12, T04: 1100, etaD: 1, jEtaC: 1, jEtaT: 1, etaN: 1, cpa: 1.005, ka: 1.4, cpg: 1.005, kg: 1.4, fuel: 'none', nozzle: 'CD', fuelMass: false })],
    ['2021 final P1: turbojet, CD nozzle', () => load({ mode: 'jet', amb: 'manual', Ta: 223.26, Pa: 26.5, speedBy: 'V', V: 270, jmdot: 0.5, rc: 15, T04: 1400, etaD: 1, jEtaC: 0.85, jEtaT: 0.9, etaN: 1, cpa: 1.005, ka: 1.4, cpg: 1.147, kg: 1.333, fuel: 'f', fval: 0.020636, nozzle: 'CD', fuelMass: false })],
  ];
  return (
    <div>
      <PresetBar items={presets} />
      <Sel label="Mode" value={S.mode} onChange={(v) => set({ mode: v })} options={[{ v: 'brayton', t: 'Brayton cycle (gas turbine)' }, { v: 'jet', t: 'Turbojet engine (flight conditions, thrust)' }]} />
      {S.mode === 'brayton' ? <BraytonCycle S={S} set={set} /> : <Turbojet S={S} set={set} />}
    </div>
  );
}

function BraytonCycle({ S, set }: { S: BS; set: (p: Partial<BS>) => void }) {
  let r: BrOut | null = null;
  let err: string | null = null;
  try {
    if (!(S.rp > 1)) err = 'The pressure ratio must exceed 1.';
    else if (!(S.T3 > S.T1) || S.T1 <= 0) err = 'Need T₃ > T₁ > 0 (K).';
    else if (S.cpModel === 'const' && (S.cp <= 0 || S.k <= 1)) err = 'Need c_p > 0 and k > 1.';
    else if (S.actual && (!(S.etaC > 0 && S.etaC <= 1) || !(S.etaT > 0 && S.etaT <= 1))) err = 'Efficiencies must be between 0 and 1.';
    else if (S.regenOn && !(S.eps >= 0 && S.eps <= 1)) err = 'Regenerator effectiveness must be between 0 and 1.';
    else r = brayEval(S, S.rp);
  } catch (e) {
    err = e instanceof Error && e.message.startsWith(OOR) ? e.message : errMsg(e);
  }
  const table = S.cpModel === 'table';
  const Rg = table ? 0.287 : (S.cp * (S.k - 1)) / S.k;
  const reg = S.regenOn && S.eps > 0;
  const mdot = S.mdot;
  // sweep
  const sweepX = Array.from({ length: 70 }, (_, i) => 1.5 + (i * (42 - 1.5)) / 69);
  const sweep = sweepX.map((rp) => {
    try {
      const o = brayEval(S, rp);
      return Number.isFinite(o.wnet) && Number.isFinite(o.eta) ? { rp, w: o.wnet, e: o.eta } : null;
    } catch {
      return null;
    }
  });
  const wS = sweep.filter((p) => p).map((p) => ({ x: p!.rp, y: p!.w }));
  const eS = sweep.filter((p) => p).map((p) => ({ x: p!.rp, y: p!.e * 100 }));
  const wMax = Math.max(1, ...wS.map((p) => p.y));
  const rpOpt = !table && S.T3 > S.T1 ? rpMaxWork(S.T1, S.T3, S.k) : NaN;
  // T-s sketch
  const sOf = (T: number, P: number) => (table ? airTable.s0(T) - airTable.s0(S.T1) : S.cp * Math.log(T / S.T1)) - Rg * Math.log(P / S.P1);
  const P2 = S.P1 * S.rp;
  const iso = (Ta: number, Tb: number, P: number, n = 20) => Array.from({ length: n + 1 }, (_, i) => { const T = Ta + ((Tb - Ta) * i) / n; return { x: sOf(T, P), y: T }; });
  let ts: ReactNode = null;
  if (r && !err) {
    const Tlo = Math.min(S.T1, r.T6, r.T2) - 0;
    const Thi = Math.max(S.T3, r.T4);
    const series: Series[] = [
      { points: iso(Tlo, Thi, S.P1), color: 'var(--muted)', width: 1, dash: true },
      { points: iso(Math.min(r.T2, r.T2s), Thi, P2), color: 'var(--muted)', width: 1, dash: true },
      { points: [{ x: 0, y: S.T1 }, { x: sOf(r.T2, P2), y: r.T2 }], color: 'var(--c1)', width: 2.4 },
      { points: iso(r.T2, S.T3, P2), color: 'var(--c1)', width: 2.4 },
      { points: [{ x: sOf(S.T3, P2), y: S.T3 }, { x: sOf(r.T4, S.P1), y: r.T4 }], color: 'var(--c1)', width: 2.4 },
      { points: iso(r.T4, S.T1, S.P1), color: 'var(--c1)', width: 2.4 },
    ];
    const dots = [
      { x: 0, y: S.T1, label: '1' },
      { x: sOf(r.T2, P2), y: r.T2, label: '2' },
      { x: sOf(S.T3, P2), y: S.T3, label: '3' },
      { x: sOf(r.T4, S.P1), y: r.T4, label: '4' },
      { x: sOf(r.T2s, P2) - 0, y: r.T2s, label: '2s', color: 'var(--muted)', r: 3 },
      { x: sOf(r.T4s, S.P1), y: r.T4s, label: '4s', color: 'var(--muted)', r: 3 },
      ...(reg ? [{ x: sOf(r.T5, P2), y: r.T5, label: '5', color: 'var(--c3)' }, { x: sOf(r.T6, S.P1), y: r.T6, label: '6', color: 'var(--c3)' }] : []),
    ];
    const xs = dots.map((d) => d.x);
    const xmin = Math.min(...xs, 0);
    const xmax = Math.max(...xs);
    const pad = (xmax - xmin) * 0.12 + 0.02;
    ts = <Plot x={[xmin - pad, xmax + pad]} y={[Math.max(0, Math.min(...dots.map((d) => d.y)) - 60), Thi + 80]} height={300} xLabel="s − s₁ (kJ/kg·K)" yLabel="T (K)" series={series} dots={dots} legend={false} />;
  }
  return (
    <Two
      left={
        <div>
          <Sel label="Specific heats" value={S.cpModel} onChange={(v) => set({ cpModel: v })} options={[{ v: 'const', t: 'Constant c_p, k (cold-air-standard)' }, { v: 'table', t: 'Variable: air table A-17 (h, P_r)' }]} />
          <Num label="Compressor inlet T₁" unit="K" value={S.T1} onChange={(v) => set({ T1: v })} />
          <Num label="Inlet pressure P₁" unit="kPa" value={S.P1} onChange={(v) => set({ P1: v })} />
          <Num label="Pressure ratio r_p" value={S.rp} onChange={(v) => set({ rp: v })} />
          <Num label="Turbine inlet T₃" unit="K" value={S.T3} onChange={(v) => set({ T3: v })} />
          {!table && (
            <>
              <Num label="c_p" unit="kJ/kg·K" value={S.cp} onChange={(v) => set({ cp: v })} />
              <Num label="k" value={S.k} onChange={(v) => set({ k: v })} />
            </>
          )}
          <Check label="Actual cycle (isentropic efficiencies)" checked={S.actual} onChange={(v) => set({ actual: v })} />
          {S.actual && (
            <>
              <Num label="η_C" value={S.etaC} onChange={(v) => set({ etaC: v })} step={0.01} />
              <Num label="η_T" value={S.etaT} onChange={(v) => set({ etaT: v })} step={0.01} />
            </>
          )}
          <Check label="Regenerator" checked={S.regenOn} onChange={(v) => set({ regenOn: v })} />
          {S.regenOn && <Num label="Effectiveness ε" value={S.eps} onChange={(v) => set({ eps: v })} step={0.05} />}
          <Num label="Mass flow (for power)" unit="kg/s" value={S.mdot} onChange={(v) => set({ mdot: v })} />
        </div>
      }
      right={
        <div>
          {err && <CalcAlert>{err}</CalcAlert>}
          {r && !err && (
            <>
              <Readout
                items={[
                  ['w_net', `${f(r.wnet)} kJ/kg`],
                  ['η_th', `${f(r.eta * 100, 4)} %`],
                  ['w_C (compressor)', `${f(r.wc)} kJ/kg`],
                  ['w_T (turbine)', `${f(r.wt)} kJ/kg`],
                  ['Back-work ratio', f(r.rbw, 4)],
                  ['q_in', `${f(r.qin)} kJ/kg`],
                  ['q_out', `${f(r.qin - r.wnet)} kJ/kg`],
                  ['Net power', `${f(r.wnet * mdot)} kW`],
                ]}
              />
              {r.wnet <= 0 && <Chips items={[['Warning', 'net work ≤ 0: turbine cannot drive the compressor', 'bad']]} />}
              {reg && r.T4 <= r.T2 && <Chips items={[['Note', 'T₄ ≤ T₂: the regenerator cannot help', 'warn']]} />}
              <Tbl
                head={['State', 'T (K)', 'P (kPa)', table ? 'h (kJ/kg)' : 'process']}
                rows={[
                  ['1 compressor in', f(S.T1), f(S.P1), table ? f(r.h![0]) : '—'],
                  ['2s isentropic exit', f(r.T2s), f(P2), '—'],
                  ['2 compressor out', f(r.T2), f(P2), table ? f(r.h![1]) : 'actual'],
                  ...(reg ? [['5 after regenerator', f(r.T5), f(P2), '—']] : []),
                  ['3 turbine in', f(S.T3), f(P2), table ? f(r.h![2]) : '—'],
                  ['4s isentropic exit', f(r.T4s), f(S.P1), '—'],
                  ['4 turbine out', f(r.T4), f(S.P1), table ? f(r.h![3]) : 'actual'],
                  ...(reg ? [['6 gas leaving regenerator', f(r.T6), f(S.P1), '—']] : []),
                ]}
              />
              {Number.isFinite(rpOpt) && (
                <Note>
                  Ideal constant-c_p cycle: r_p for maximum net work = (T₃/T₁)<sup>k/[2(k−1)]</sup> = <b>{f(rpOpt, 4)}</b>. Ideal efficiency 1 − r_p<sup>−(k−1)/k</sup> = {f((1 - Math.pow(S.rp, -(S.k - 1) / S.k)) * 100, 4)} %.
                </Note>
              )}
              {ts}
            </>
          )}
          {wS.length > 1 && (
            <Plot
              x={[1.5, 42]}
              y={[0, wMax * 1.1]}
              height={220}
              xLabel="pressure ratio r_p"
              yLabel="w_net (kJ/kg)"
              series={[{ points: wS, color: 'var(--c1)' }]}
              vlines={[{ x: S.rp, label: 'r_p', color: 'var(--c2)' }, ...(Number.isFinite(rpOpt) && !S.actual && !S.regenOn && rpOpt < 42 ? [{ x: rpOpt, label: 'max work', color: 'var(--c3)' }] : [])]}
              legend={false}
            />
          )}
          {eS.length > 1 && <Plot x={[1.5, 42]} y={[0, Math.max(10, Math.max(...eS.map((p) => p.y)) * 1.1)]} height={220} xLabel="pressure ratio r_p" yLabel="η_th (%)" series={[{ points: eS, color: 'var(--c4)' }]} vlines={[{ x: S.rp, label: 'r_p', color: 'var(--c2)' }]} legend={false} />}
        </div>
      }
    />
  );
}

function Turbojet({ S, set }: { S: BS; set: (p: Partial<BS>) => void }) {
  let Ta = S.Ta;
  let Pa = S.Pa;
  let err: string | null = null;
  if (S.amb === 'isa') {
    if (!(S.z >= 0 && S.z <= 20000)) err = `${OOR}: the standard atmosphere here covers 0–20 000 m.`;
    else {
      const a = atmosphere(S.z);
      Ta = a.T;
      Pa = a.P;
    }
  }
  const aSound = Math.sqrt(S.ka * 0.287 * 1000 * Ta);
  const V = S.speedBy === 'V' ? S.V : S.Ma * aSound;
  let r: ReturnType<typeof turbojet> | null = null;
  let Te = NaN;
  let P06 = NaN;
  let MaE = NaN;
  if (!err) {
    try {
      if (!(S.rc > 1)) err = 'The compressor pressure ratio must exceed 1.';
      else if (!(Ta > 0 && Pa > 0)) err = 'Ambient T and P must be positive.';
      else if ([S.etaD, S.jEtaC, S.jEtaT, S.etaN].some((e) => !(e > 0 && e <= 1))) err = 'Efficiencies must be between 0 and 1.';
      else if (!(S.jmdot > 0) || V < 0) err = 'Need ṁ > 0 and V ≥ 0.';
      else {
        r = turbojet({
          Ta, Pa, V, mdot: S.jmdot, rc: S.rc, T04: S.T04, etaD: S.etaD, etaC: S.jEtaC, etaT: S.jEtaT, etaN: S.etaN,
          cpa: S.cpa, ka: S.ka, cpg: S.cpg, kg: S.kg, nozzle: S.nozzle, fuelMassInTurbine: S.fuelMass,
          f: S.fuel === 'f' ? S.fval : undefined, QHV: S.fuel === 'QHV' ? S.QHV : undefined,
        });
        const need = [r.T01, r.P01, r.T03, r.P03, r.T05, r.P05, r.Ve, r.Ae, r.F];
        if (!need.every(Number.isFinite) || !(r.Ve > 0) || !(r.T05 > 0)) {
          err = r.P05 < Pa ? `The turbine exit pressure P₀₅ = ${f(r.P05)} kPa is below the ambient pressure ${f(Pa)} kPa: the gas cannot expand through the nozzle (no thrust). Lower r_c or raise T₀₄.` : 'No valid solution: the turbine cannot drive the compressor with this T₀₄ and r_c.';
          r = null;
        } else if ([r.T03, S.T04, r.T05].some((T) => T > 6000)) {
          err = `${OOR}: a stagnation temperature is outside 200–6000 K.`;
          r = null;
        } else {
          Te = r.T05 - r.Ve * r.Ve / (2000 * S.cpg);
          P06 = r.Pe * Math.pow(r.T05 / Te, S.kg / (S.kg - 1));
          MaE = r.Ve / Math.sqrt(S.kg * 0.287 * 1000 * Te);
        }
      }
    } catch (e) {
      err = errMsg(e);
    }
  }
  // T-s sketch with stagnation states (relative to the ambient state)
  let ts: ReactNode = null;
  if (r) {
    const Rg = (S.cpg * (S.kg - 1)) / S.kg;
    const Ra = (S.cpa * (S.ka - 1)) / S.ka;
    const sA = (T: number, P: number) => S.cpa * Math.log(T / Ta) - Ra * Math.log(P / Pa);
    const s02 = sA(r.T02, r.P02);
    const s03 = sA(r.T03, r.P03);
    const s04 = s03 + S.cpg * Math.log(S.T04 / r.T03);
    const s05 = s04 + S.cpg * Math.log(r.T05 / S.T04) - Rg * Math.log(r.P05 / r.P04);
    const se = s05 + S.cpg * Math.log(Te / r.T05) - Rg * Math.log(r.Pe / r.P05);
    const pts = [
      { x: 0, y: Ta, label: 'a' },
      { x: sA(r.T01, r.P01), y: r.T01, label: '1' },
      { x: s02, y: r.T02, label: '2' },
      { x: s03, y: r.T03, label: '3' },
      { x: s04, y: S.T04, label: '4' },
      { x: s05, y: r.T05, label: '5' },
      { x: se, y: Te, label: 'e', color: 'var(--c3)' },
    ];
    const xs = pts.map((p) => p.x);
    const pad = (Math.max(...xs) - Math.min(...xs)) * 0.12 + 0.02;
    ts = <Plot x={[Math.min(...xs) - pad, Math.max(...xs) + pad]} y={[Math.max(0, Math.min(...pts.map((p) => p.y)) - 50), S.T04 + 100]} height={290} xLabel="s − s_a (kJ/kg·K)" yLabel="T₀ (K) (stagnation; e = static exit)" series={[{ points: pts, color: 'var(--c1)', width: 2.4 }]} dots={pts} legend={false} />;
  }
  const fSimple = r && S.QHV > 0 ? (S.cpg * (S.T04 - r.T03)) / S.QHV : NaN;
  return (
    <Two
      left={
        <div>
          <Group title="Flight conditions">
            <Sel label="Ambient" value={S.amb} onChange={(v) => set({ amb: v })} options={[{ v: 'isa', t: 'Standard atmosphere at altitude (A-16)' }, { v: 'manual', t: 'Enter T and P' }]} />
            {S.amb === 'isa' ? <Num label="Altitude z" unit="m" value={S.z} onChange={(v) => set({ z: v })} /> : (
              <>
                <Num label="Ambient T_a" unit="K" value={S.Ta} onChange={(v) => set({ Ta: v })} />
                <Num label="Ambient P_a" unit="kPa" value={S.Pa} onChange={(v) => set({ Pa: v })} />
              </>
            )}
            <Sel label="Flight speed given as" value={S.speedBy} onChange={(v) => set({ speedBy: v })} options={[{ v: 'V', t: 'Speed V (m/s)' }, { v: 'Ma', t: 'Mach number' }]} />
            {S.speedBy === 'V' ? <Num label="Flight speed V" unit="m/s" value={S.V} onChange={(v) => set({ V: v })} /> : <Num label="Flight Mach number" value={S.Ma} onChange={(v) => set({ Ma: v })} />}
            <Num label="Air mass flow ṁ" unit="kg/s" value={S.jmdot} onChange={(v) => set({ jmdot: v })} />
          </Group>
          <Group title="Engine">
            <Num label="Compressor ratio r_c" value={S.rc} onChange={(v) => set({ rc: v })} />
            <Num label="Turbine inlet T₀₄" unit="K" value={S.T04} onChange={(v) => set({ T04: v })} />
            <Num label="η diffuser" value={S.etaD} onChange={(v) => set({ etaD: v })} step={0.01} />
            <Num label="η compressor" value={S.jEtaC} onChange={(v) => set({ jEtaC: v })} step={0.01} />
            <Num label="η turbine" value={S.jEtaT} onChange={(v) => set({ jEtaT: v })} step={0.01} />
            <Num label="η nozzle" value={S.etaN} onChange={(v) => set({ etaN: v })} step={0.01} />
            <Sel label="Nozzle" value={S.nozzle} onChange={(v) => set({ nozzle: v })} options={[{ v: 'CD', t: 'Converging–diverging (expands to P_a)' }, { v: 'C', t: 'Converging only (chokes if P₀₅ is high)' }]} />
          </Group>
          <Group title="Gas properties">
            <Num label="c_p air" unit="kJ/kg·K" value={S.cpa} onChange={(v) => set({ cpa: v })} />
            <Num label="k air" value={S.ka} onChange={(v) => set({ ka: v })} />
            <Num label="c_p gas (hot)" unit="kJ/kg·K" value={S.cpg} onChange={(v) => set({ cpg: v })} />
            <Num label="k gas (hot)" value={S.kg} onChange={(v) => set({ kg: v })} />
          </Group>
          <Group title="Fuel">
            <Sel label="Fuel flow" value={S.fuel} onChange={(v) => set({ fuel: v })} options={[{ v: 'none', t: 'Ignore (f = 0, as in 9-136)' }, { v: 'f', t: 'Fuel/air ratio f given' }, { v: 'QHV', t: 'From heating value (energy balance)' }]} />
            {S.fuel === 'f' && <Num label="f" value={S.fval} onChange={(v) => set({ fval: v })} step={0.001} />}
            {S.fuel !== 'f' && <Num label="Heating value Q_HV" unit="kJ/kg" value={S.QHV} onChange={(v) => set({ QHV: v })} />}
            <Check label="Count the fuel mass in the turbine and nozzle flow" checked={S.fuelMass} onChange={(v) => set({ fuelMass: v })} />
          </Group>
        </div>
      }
      right={
        <div>
          {err && <CalcAlert>{err}</CalcAlert>}
          {r && !err && (
            <>
              <Readout
                items={[
                  ['Flight V / Ma', `${f(V)} m/s / ${f(r.Ma, 4)}`],
                  ['Ambient T_a / P_a', `${f(Ta)} K / ${f(Pa)} kPa`],
                  ['Ram ratio P₀₁/P_a', f(r.ramRatio, 4)],
                  ['Compressor work w_C', `${f(r.wc)} kJ/kg`],
                  ['Fuel/air f', S.fuel === 'none' ? '0 (ignored)' : f(r.f, 5)],
                  ['Exit velocity Vₑ', `${f(r.Ve)} m/s`],
                  ['Exit static T / P', `${f(Te)} K / ${f(r.Pe)} kPa`],
                  ['Exit Mach', f(MaE, 4)],
                  ['Exit area Aₑ', `${f(r.Ae, 4)} m²`],
                  ['Thrust F', `${f(r.F)} N`],
                  ['Propulsive power', `${f(r.Wp)} kW`],
                  ['TSFC', S.fuel === 'none' ? '—' : `${f((r.TSFC * 1e6))} g/(kN·s)`],
                  ['Fuel heat Q_in', S.fuel === 'QHV' ? `${f(r.Qin)} kW` : '—'],
                  ['Overall η = W_p/Q_in', S.fuel === 'QHV' ? f(r.etaP, 4) : '—'],
                ]}
              />
              <Chips
                items={[
                  ['Momentum thrust', `${f(r.Fmom)} N (${f((100 * r.Fmom) / r.F, 3)} %)`],
                  ['Pressure thrust', `${f(r.Fpres)} N (${f((100 * r.Fpres) / r.F, 3)} %)`],
                  ...(S.nozzle === 'C' ? ([[r.choked ? 'Nozzle' : 'Nozzle', r.choked ? `choked: P_e = P_crit = ${f(r.Pcrit)} kPa > P_a` : 'not choked (fully expanded to P_a)', r.choked ? 'warn' : 'ok']] as [string, string, 'ok' | 'warn'][]) : []),
                ]}
              />
              {Number.isFinite(fSimple) && S.fuel === 'QHV' && (
                <Note>
                  Short form used in the textbook problems, f ≈ c_p(T₀₄ − T₀₃)/Q_HV = {f(fSimple, 4)}, ṁ<sub>f</sub> = {f(fSimple * S.jmdot, 4)} kg/s (the exact balance above gives f = {f(r.f, 4)}).
                </Note>
              )}
              <Tbl
                head={['Station', 'T₀ (K)', 'P₀ (kPa)']}
                rows={[
                  ['a  ambient (static)', f(Ta), f(Pa)],
                  ['1  after ram (inlet)', f(r.T01), f(r.P01)],
                  ['2  diffuser exit / compressor in', f(r.T02), f(r.P02)],
                  ['3  compressor exit', f(r.T03), f(r.P03)],
                  ['4  turbine inlet (burner exit)', f(S.T04), f(r.P04)],
                  ['5  turbine exit', f(r.T05), f(r.P05)],
                  ['6  nozzle exit', f(r.T05), f(P06)],
                ]}
              />
              {ts}
            </>
          )}
        </div>
      }
    />
  );
}

/* ====================================================================== 3. RankineCalc */
const RK_DEF = {
  Pb: 3000, Tb: 350, Pc: 20, etaT: 1, etaP: 1,
  reheat: false, Prh: 1000, Trh: 350,
  heater: 'none' as 'none' | 'ofwh' | 'cfwh-back' | 'cfwh-fwd', Pf: 1000,
  power: 'mdot' as 'mdot' | 'Wnet', mdot: 1, Wnet: 100000,
};

export function RankineCalc() {
  const [S, set, load] = useForm(RK_DEF);
  let out: ReturnType<typeof rankine> | null = null;
  let err: string | null = null;
  const hasH = S.heater !== 'none';
  try {
    err = first(
      badP('water', S.Pb, 'boiler P'), badT('water', S.Tb, 'turbine inlet T'), badP('water', S.Pc, 'condenser P'),
      S.Pc >= S.Pb ? 'The condenser pressure must be below the boiler pressure.' : null,
      !(S.etaT > 0 && S.etaT <= 1) || !(S.etaP > 0 && S.etaP <= 1) ? 'Efficiencies must be between 0 and 1.' : null,
      S.Pb >= water.crit.P ? 'This calculator takes a subcritical boiler pressure (below 22.06 MPa).' : null,
      S.reheat ? first(badP('water', S.Prh, 'reheat P'), badT('water', S.Trh, 'reheat T'), S.Prh <= S.Pc || S.Prh >= S.Pb ? 'Reheat pressure must lie between the condenser and boiler pressures.' : null) : null,
      hasH ? first(badP('water', S.Pf, 'heater P'), S.Pf <= S.Pc || S.Pf >= S.Pb ? 'The heater (bleed) pressure must lie between the condenser and boiler pressures.' : null, S.reheat && Math.abs(S.Pf - S.Prh) / S.Prh < 0.005 ? 'Use different pressures for the bleed and the reheat.' : null) : null,
    );
    if (!err) {
      out = rankine({
        Pb: S.Pb, Tb: S.Tb, Pc: S.Pc, etaT: S.etaT, etaP: S.etaP,
        reheat: S.reheat ? { P: S.Prh, T: S.Trh } : undefined,
        ofwh: S.heater === 'ofwh' ? { P: S.Pf } : undefined,
        cfwh: S.heater === 'cfwh-back' ? { P: S.Pf, drain: 'back' } : S.heater === 'cfwh-fwd' ? { P: S.Pf, drain: 'forward' } : undefined,
        mdot: S.power === 'mdot' ? S.mdot : undefined,
        Wnet: S.power === 'Wnet' ? S.Wnet : undefined,
      });
      const bad = Object.values(out.states).some((s) => !stOK(s, 'water')) || ![out.wT, out.wP, out.qin, out.eta, out.mdot, out.y].every(Number.isFinite);
      if (bad) {
        out = null;
        err = `${OOR}: one of the cycle states leaves the steam tables (water T ≤ 1300 °C, P ≤ 60 MPa).`;
      } else if (!(out.wnet > 0)) {
        err = 'Net work is not positive for these inputs.';
        out = null;
      }
    }
  } catch (e) {
    err = errMsg(e);
    out = null;
  }
  let rows: ReactNode[][] = [];
  let pts: TsPoint[] = [];
  let path: number[] = [];
  if (out) {
    const st = out.states;
    const cyc = ['condExit', 'pump1Exit', ...(S.heater === 'ofwh' ? ['fwhExit', 'pump2Exit'] : S.heater === 'cfwh-back' ? ['fwhExit'] : S.heater === 'cfwh-fwd' ? ['fwhExit', 'mix'] : []), 'turbineIn', ...(S.reheat ? ['reheatIn', 'reheatOut'] : []), 'turbineExit'].filter((k) => st[k]);
    const extra = ['bleed', 'drain', 'drainPump'].filter((k) => st[k]);
    const all = [...cyc, ...extra];
    pts = all.map((k, i) => ({ s: st[k].s, T: st[k].T, label: String(i + 1), P: st[k].P }));
    path = [...cyc.map((_, i) => i), 0];
    rows = all.map((k, i) => [`${i + 1}  ${st[k].label}`, f(st[k].T), f(st[k].P), f(st[k].h), f(st[k].s), xText(st[k])]);
  }
  const exitX = out ? out.x_exit : NaN;
  return (
    <div>
      <PresetBar
        items={[
          ['10-55: closed FWH (drain back), 740.9 / 3.03 / 2352.5', () => load({ Pb: 3000, Tb: 350, Pc: 20, etaT: 1, etaP: 1, reheat: false, heater: 'cfwh-back', Pf: 1000, power: 'mdot', mdot: 1 })],
          ['10-98: open FWH, 150 MW, ṁ = 159.7 kg/s', () => load({ Pb: 10000, Tb: 500, Pc: 10, etaT: 0.8, etaP: 0.95, reheat: false, heater: 'ofwh', Pf: 500, power: 'Wnet', Wnet: 150000 })],
        ]}
      />
      <Two
        left={
          <div>
            <Num label="Boiler pressure P_b" unit="kPa" value={S.Pb} onChange={(v) => set({ Pb: v })} />
            <Num label="Turbine inlet T_b" unit="°C" value={S.Tb} onChange={(v) => set({ Tb: v })} />
            <Num label="Condenser pressure P_c" unit="kPa" value={S.Pc} onChange={(v) => set({ Pc: v })} />
            <Num label="η turbine" value={S.etaT} onChange={(v) => set({ etaT: v })} step={0.01} />
            <Num label="η pump" value={S.etaP} onChange={(v) => set({ etaP: v })} step={0.01} />
            <Check label="Reheat" checked={S.reheat} onChange={(v) => set({ reheat: v })} />
            {S.reheat && (
              <>
                <Num label="Reheat pressure" unit="kPa" value={S.Prh} onChange={(v) => set({ Prh: v })} />
                <Num label="Reheat exit T" unit="°C" value={S.Trh} onChange={(v) => set({ Trh: v })} />
              </>
            )}
            <Sel label="Feedwater heater (one)" value={S.heater} onChange={(v) => set({ heater: v })} options={[{ v: 'none', t: 'None (simple / reheat Rankine)' }, { v: 'ofwh', t: 'Open (mixing) heater' }, { v: 'cfwh-back', t: 'Closed heater, drain throttled back' }, { v: 'cfwh-fwd', t: 'Closed heater, drain pumped forward' }]} />
            {hasH && <Num label="Bleed (heater) pressure" unit="kPa" value={S.Pf} onChange={(v) => set({ Pf: v })} />}
            <Sel label="Plant size given as" value={S.power} onChange={(v) => set({ power: v })} options={[{ v: 'mdot', t: 'Steam flow ṁ (kg/s)' }, { v: 'Wnet', t: 'Net power (kW)' }]} />
            {S.power === 'mdot' ? <Num label="Steam flow ṁ" unit="kg/s" value={S.mdot} onChange={(v) => set({ mdot: v })} /> : <Num label="Net power" unit="kW" value={S.Wnet} onChange={(v) => set({ Wnet: v })} />}
            <Note>Pump work is v ΔP/η_P; with one extraction the turbine efficiency is applied to the isentropic drop from the start of each turbine section.</Note>
          </div>
        }
        right={
          <div>
            {err && <CalcAlert>{err}</CalcAlert>}
            {out && (
              <>
                <Readout
                  items={[
                    ['η_th', `${f(out.eta * 100, 4)} %`],
                    ['w_T', `${f(out.wT)} kJ/kg`],
                    ['w_P', `${f(out.wP)} kJ/kg`],
                    ['w_net', `${f(out.wnet)} kJ/kg`],
                    ['q_in', `${f(out.qin)} kJ/kg`],
                    ['q_out', `${f(out.qout)} kJ/kg`],
                    ['Back-work ratio', f(out.bwr, 4)],
                    ['Bled fraction y', hasH ? f(out.y, 4) : '—'],
                    ['x at turbine exit', Number.isFinite(exitX) ? f(exitX, 4) : 'superheated'],
                    ['Steam flow ṁ', `${f(out.mdot)} kg/s`],
                    ['Net power', `${f(out.mdot * out.wnet)} kW`],
                    ['Heat input Q_in', `${f(out.mdot * out.qin)} kW`],
                  ]}
                />
                {Number.isFinite(exitX) && exitX < 0.88 && <Chips items={[['Exit quality', `x = ${f(exitX, 3)} < 0.88: blade erosion risk`, 'warn']]} />}
                <Tbl head={['State', 'T (°C)', 'P (kPa)', 'h (kJ/kg)', 's (kJ/kg·K)', 'x / phase']} rows={rows} />
                <TsDiagramView fluid="water" points={pts} path={path} isobars={[S.Pb, S.Pc, ...(hasH ? [S.Pf] : []), ...(S.reheat ? [S.Prh] : [])]} height={320} />
              </>
            )}
          </div>
        }
      />
    </div>
  );
}

/* ====================================================================== 4. RefrigCalc */
type LevelIn = { by: 'P' | 'T'; v: number };
const lvlToP = (l: LevelIn) => (l.by === 'P' ? l.v : r134a.Psat(l.v));
function lvlErr(l: LevelIn, label: string): string | null {
  if (l.by === 'P') return first(badP('r134a', l.v, label), l.v >= r134a.crit.P ? `${OOR}: ${label} is above the critical pressure of R-134a.` : null);
  return first(badT('r134a', l.v, `${label} (saturation T)`), l.v >= r134a.crit.T ? `${OOR}: ${label} saturation temperature is above the critical point (${f(r134a.crit.T)} °C).` : null);
}
function Level({ label, v, onChange }: { label: string; v: LevelIn; onChange: (v: LevelIn) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, alignItems: 'end' }}>
      <Sel label={label} value={v.by} onChange={(by) => onChange({ by, v: by === 'P' ? (Number.isFinite(v.v) ? Math.round(lvlSafe(v) * 10) / 10 : 500) : Math.round(r134a.Tsat(lvlSafe(v)) * 10) / 10 })} options={[{ v: 'P', t: 'P kPa' }, { v: 'T', t: 'T °C' }]} />
      <Num label={v.by === 'P' ? 'pressure' : 'saturation T'} unit={v.by === 'P' ? 'kPa' : '°C'} value={v.v} onChange={(x) => onChange({ ...v, v: x })} />
    </div>
  );
}
const lvlSafe = (l: LevelIn) => {
  try {
    return Math.min(4000, Math.max(51.25, l.by === 'P' ? l.v : r134a.Psat(l.v)));
  } catch {
    return 500;
  }
};

const RF_DEF = {
  mode: 'vcr' as 'vcr' | 'two' | 'gas',
  low: { by: 'P', v: 200 } as LevelIn,
  high: { by: 'P', v: 1400 } as LevelIn,
  mid: { by: 'T', v: -10.1 } as LevelIn,
  superheat: 0, subcool: 0, etaC: 1,
  flow: 'mdot' as 'mdot' | 'QL' | 'QH', flowVal: 0.05,
  QL: 30, layout: 'separator' as 'separator' | 'flash',
  rp: 5, gT1: 273.15, gT3: 308.15, gT5: 193.15, gEtaC: 0.8, gEtaT: 0.85, gmdot: 0.4, cp: 1.005, k: 1.4,
};
type RS = typeof RF_DEF;

function PhPlot({ pts, series, PL, PH }: { pts: { h: number; P: number; label: string }[]; series: { h: number; P: number }[][]; PL: number; PH: number }) {
  const dl: { x: number; y: number }[] = [];
  const dv: { x: number; y: number }[] = [];
  for (let T = -40; T <= 100; T += 3) {
    const s = r134a.satT(T);
    dl.push({ x: s.hf, y: s.P });
    dv.push({ x: s.hg, y: s.P });
  }
  const cs = r134a.satT(101);
  dl.push({ x: (cs.hf + cs.hg) / 2, y: cs.P });
  dv.push({ x: (cs.hf + cs.hg) / 2, y: cs.P });
  const hmax = Math.max(...pts.map((p) => p.h), 440) * 1.04;
  const lo = Math.max(51.25, PL * 0.7);
  const hi = Math.min(5500, PH * 1.5);
  const ticks = [50, 100, 200, 500, 1000, 2000, 4000].filter((t) => t >= lo && t <= hi);
  const ser: Series[] = [{ points: dl, color: 'var(--muted)', width: 1.6 }, { points: dv, color: 'var(--muted)', width: 1.6 }, ...series.map((s) => ({ points: s.map((p) => ({ x: p.h, y: p.P })), color: 'var(--c1)', width: 2.4 }))];
  return <Plot x={[Math.min(0, ...pts.map((p) => p.h)) - 10, hmax]} y={[lo, hi]} logY yTicks={ticks} height={300} xLabel="h (kJ/kg)" yLabel="P (kPa, log)" series={ser} dots={pts.map((p) => ({ x: p.h, y: p.P, label: p.label }))} legend={false} />;
}

export function RefrigCalc() {
  const [S, set, load] = useForm(RF_DEF);
  const presets: [string, () => void][] = [
    ['11-21: VCR with superheat/subcool, COP 2.72', () => load({ mode: 'vcr', low: { by: 'P', v: 200 }, high: { by: 'P', v: 1400 }, superheat: 10.1, subcool: 4.4, etaC: 0.88, flow: 'mdot', flowVal: 0.025 })],
    ['11-60: two-stage, 0.160 / 0.230 kg/s', () => load({ mode: 'two', low: { by: 'T', v: -40 }, mid: { by: 'T', v: -10.1 }, high: { by: 'P', v: 800 }, QL: 30, layout: 'separator' })],
    ['11-79: gas cycle, COP 0.478', () => load({ mode: 'gas', rp: 5, gT1: 273.15, gT3: 308.15, gT5: 193.15, gEtaC: 0.8, gEtaT: 0.85, gmdot: 0.4, cp: 1.005, k: 1.4 })],
  ];
  return (
    <div>
      <PresetBar items={presets} />
      <Sel label="Cycle" value={S.mode} onChange={(v) => set({ mode: v })} options={[{ v: 'vcr', t: 'Vapor-compression (R-134a), ideal or actual' }, { v: 'two', t: 'Two-stage compression with flash/separator (R-134a)' }, { v: 'gas', t: 'Gas refrigeration (reverse Brayton with regenerator)' }]} />
      {S.mode === 'vcr' && <Vcr S={S} set={set} />}
      {S.mode === 'two' && <TwoStage S={S} set={set} />}
      {S.mode === 'gas' && <GasRef S={S} set={set} />}
    </div>
  );
}

function Vcr({ S, set }: { S: RS; set: (p: Partial<RS>) => void }) {
  let r: ReturnType<typeof vcr> | null = null;
  let err: string | null = null;
  let PL = NaN;
  let PH = NaN;
  try {
    err = first(lvlErr(S.low, 'evaporator'), lvlErr(S.high, 'condenser'), S.superheat < 0 || S.subcool < 0 ? 'Superheat and subcooling must be ≥ 0.' : null, !(S.etaC > 0 && S.etaC <= 1) ? 'η_C must be between 0 and 1.' : null);
    if (!err) {
      PL = lvlToP(S.low);
      PH = lvlToP(S.high);
      if (!(PL < PH)) err = 'The condenser pressure must exceed the evaporator pressure.';
      else if (r134a.Tsat(PH) - S.subcool < -40) err = `${OOR}: subcooled liquid below −40 °C.`;
      else {
        r = vcr({ PL, PH, superheat: S.superheat || undefined, subcool: S.subcool || undefined, etaC: S.etaC, mdot: S.flow === 'mdot' ? S.flowVal : undefined, QL: S.flow === 'QL' ? S.flowVal : undefined, QH: S.flow === 'QH' ? S.flowVal : undefined });
        if (!Object.values(r.states).every((s) => stOK(s, 'r134a')) || ![r.COPR, r.W, r.mdot].every(Number.isFinite)) {
          err = `${OOR}: a state of the cycle leaves the R-134a tables (P ≤ 4 MPa, T −40…200 °C), e.g. the compressor exit.`;
          r = null;
        }
      }
    }
  } catch (e) {
    err = errMsg(e);
  }
  const st = r?.states;
  const names: Record<string, string> = { 1: '1 compressor in', '2s': '2s isentropic exit', 2: '2 compressor out', 3: '3 condenser out', 4: '4 after valve' };
  return (
    <Two
      left={
        <div>
          <Level label="Evaporator" v={S.low} onChange={(low) => set({ low })} />
          <Level label="Condenser" v={S.high} onChange={(high) => set({ high })} />
          <Num label="Superheat at evaporator exit" unit="K" value={S.superheat} onChange={(v) => set({ superheat: v })} />
          <Num label="Subcooling at condenser exit" unit="K" value={S.subcool} onChange={(v) => set({ subcool: v })} />
          <Num label="Compressor η_C (1 = ideal)" value={S.etaC} onChange={(v) => set({ etaC: v })} step={0.01} />
          <Sel label="Size given as" value={S.flow} onChange={(v) => set({ flow: v })} options={[{ v: 'mdot', t: 'Refrigerant flow ṁ (kg/s)' }, { v: 'QL', t: 'Cooling load Q_L (kW)' }, { v: 'QH', t: 'Heating load Q_H (kW)' }]} />
          <Num label={S.flow === 'mdot' ? 'ṁ (kg/s)' : S.flow === 'QL' ? 'Q_L (kW)' : 'Q_H (kW)'} value={S.flowVal} onChange={(v) => set({ flowVal: v })} />
        </div>
      }
      right={
        <div>
          {err && <CalcAlert>{err}</CalcAlert>}
          {r && st && (
            <>
              <Readout
                items={[
                  ['COP_R', f(r.COPR, 4)],
                  ['COP_HP', f(r.COPHP, 4)],
                  ['q_L', `${f(r.qL)} kJ/kg`],
                  ['q_H', `${f(r.qH)} kJ/kg`],
                  ['w_in', `${f(r.w)} kJ/kg`],
                  ['ṁ', `${f(r.mdot)} kg/s`],
                  ['Q_L', `${f(r.QL)} kW`],
                  ['Q_H', `${f(r.QH)} kW`],
                  ['W_in', `${f(r.W)} kW`],
                ]}
              />
              <Tbl head={['State', 'T (°C)', 'P (kPa)', 'h (kJ/kg)', 's (kJ/kg·K)', 'x / phase']} rows={(['1', '2s', '2', '3', '4'] as const).map((k) => [names[k], f(st[k].T), f(st[k].P), f(st[k].h), f(st[k].s), xText(st[k])])} />
              <TsDiagramView
                fluid="r134a"
                points={[1, 2, 3, 4].map((i) => ({ s: st[String(i) as '1'].s, T: st[String(i) as '1'].T, label: String(i), P: st[String(i) as '1'].P })).concat([{ s: st['2s'].s, T: st['2s'].T, label: '2s', P: st['2s'].P }])}
                path={[0, 1, 2, 3, 0]}
                isobars={[PL, PH]}
                height={300}
              />
              <PhPlot
                PL={PL}
                PH={PH}
                pts={[{ h: st['1'].h, P: PL, label: '1' }, { h: st['2'].h, P: PH, label: '2' }, { h: st['3'].h, P: PH, label: '3' }, { h: st['4'].h, P: PL, label: '4' }]}
                series={[[{ h: st['1'].h, P: PL }, { h: st['2'].h, P: PH }, { h: st['3'].h, P: PH }, { h: st['4'].h, P: PL }, { h: st['1'].h, P: PL }]]}
              />
            </>
          )}
        </div>
      }
    />
  );
}

function TwoStage({ S, set }: { S: RS; set: (p: Partial<RS>) => void }) {
  let r: ReturnType<typeof flashTwoStage> | null = null;
  let err: string | null = null;
  const P = { L: NaN, m: NaN, H: NaN };
  try {
    err = first(lvlErr(S.low, 'evaporator'), lvlErr(S.mid, 'intermediate (flash)'), lvlErr(S.high, 'condenser'), !(S.QL > 0) ? 'Q_L must be positive.' : null);
    if (!err) {
      P.L = lvlToP(S.low);
      P.m = lvlToP(S.mid);
      P.H = lvlToP(S.high);
      if (!(P.L < P.m && P.m < P.H)) err = 'Need P_evaporator < P_intermediate < P_condenser.';
      else {
        r = flashTwoStage({ PH: P.H, Pm: P.m, PL: P.L, QL: S.QL, layout: S.layout });
        if (![r.mL, r.mH, r.W, r.COP, r.x6, ...Object.values(r.h)].every(Number.isFinite)) {
          err = `${OOR}: the two-stage cycle leaves the R-134a tables.`;
          r = null;
        }
      }
    }
  } catch (e) {
    err = errMsg(e);
  }
  const hp = r
    ? [
        { h: r.h[1], P: P.L, label: '1' }, { h: r.h[2], P: P.m, label: '2' }, { h: r.h[3], P: P.m, label: '3' }, { h: r.h[4], P: P.H, label: '4' },
        { h: r.h[5], P: P.H, label: '5/6' }, { h: r.h[7], P: P.m, label: '7' }, { h: r.h[8], P: P.L, label: '8' }, { h: r.h[9], P: P.m, label: '9' },
      ]
    : [];
  return (
    <Two
      left={
        <div>
          <Level label="Evaporator" v={S.low} onChange={(low) => set({ low })} />
          <Level label="Intermediate" v={S.mid} onChange={(mid) => set({ mid })} />
          <Level label="Condenser" v={S.high} onChange={(high) => set({ high })} />
          <Num label="Cooling load Q_L" unit="kW" value={S.QL} onChange={(v) => set({ QL: v })} />
          <Sel label="Intermediate device" value={S.layout} onChange={(v) => set({ layout: v })} options={[{ v: 'separator', t: 'Adiabatic separator (Çengel Fig. P11-60)' }, { v: 'flash', t: 'Flash chamber mixing with LP discharge (Ex. 11-5)' }]} />
          <Note>Isentropic compressors; saturated vapor leaves the evaporator and saturated liquid leaves the condenser and the intermediate chamber.</Note>
        </div>
      }
      right={
        <div>
          {err && <CalcAlert>{err}</CalcAlert>}
          {r && (
            <>
              <Readout
                items={[
                  ['COP_R', f(r.COP, 4)],
                  ['ṁ low stage', `${f(r.mL)} kg/s`],
                  ['ṁ high stage', `${f(r.mH)} kg/s`],
                  ['Total compressor power', `${f(r.W)} kW`],
                  ['Quality after valve, x₆', f(r.x6, 4)],
                  ['P low / mid / high', `${f(P.L)} / ${f(P.m)} / ${f(P.H)} kPa`],
                ]}
              />
              <Tbl head={['State', 'h (kJ/kg)']} rows={[['1 sat. vapor at P_L', 1], ['2 LP compressor exit', 2], ['3 vapor to HP compressor', 3], ['4 HP compressor exit', 4], ['5 sat. liquid at P_H (= h₆)', 5], ['7 sat. liquid at P_mid', 7], ['8 after valve to P_L', 8], ['9 sat. vapor at P_mid', 9]].map(([n, k]) => [n, f(r!.h[k as number])])} />
              <PhPlot
                PL={P.L}
                PH={P.H}
                pts={hp}
                series={[
                  [{ h: r.h[8], P: P.L }, { h: r.h[1], P: P.L }, { h: r.h[2], P: P.m }],
                  [{ h: r.h[3], P: P.m }, { h: r.h[4], P: P.H }, { h: r.h[5], P: P.H }, { h: r.h[5], P: P.m }],
                  [{ h: r.h[7], P: P.m }, { h: r.h[8], P: P.L }],
                  [{ h: r.h[5], P: P.m }, { h: r.h[7], P: P.m }],
                  [{ h: r.h[5], P: P.m }, { h: r.h[9], P: P.m }],
                ]}
              />
            </>
          )}
        </div>
      }
    />
  );
}

function GasRef({ S, set }: { S: RS; set: (p: Partial<RS>) => void }) {
  let r: ReturnType<typeof gasRefrigeration> | null = null;
  let err: string | null = null;
  try {
    err = first(
      !(S.rp > 1) ? 'The pressure ratio must exceed 1.' : null,
      !(S.gT1 > 0 && S.gT3 > 0 && S.gT5 > 0) ? 'Temperatures must be positive (K).' : null,
      !(S.gEtaC > 0 && S.gEtaC <= 1 && S.gEtaT > 0 && S.gEtaT <= 1) ? 'Efficiencies must be between 0 and 1.' : null,
      !(S.cp > 0 && S.k > 1) ? 'Need c_p > 0 and k > 1.' : null,
    );
    if (!err) {
      r = gasRefrigeration({ rp: S.rp, T1: S.gT1, T3: S.gT3, T5: S.gT5, etaC: S.gEtaC, etaT: S.gEtaT, mdot: S.gmdot, cp: S.cp, k: S.k });
      if (![r.T2, r.T4, r.T6, r.eps, r.QL, r.W, r.COP].every(Number.isFinite) || r.T4 <= 0 || r.T6 <= 0) {
        err = `${OOR}: no valid cycle for these temperatures.`;
        r = null;
      } else if (r.eps < 0 || r.eps > 1) {
        err = `The temperatures need a regenerator effectiveness of ${f(r.eps, 3)}, outside 0–1: the specified T₁, T₃, T₅ are inconsistent.`;
        r = null;
      }
    }
  } catch (e) {
    err = errMsg(e);
  }
  let plot: ReactNode = null;
  if (r) {
    const Rg = (S.cp * (S.k - 1)) / S.k;
    const sOf = (T: number, hi: boolean) => S.cp * Math.log(T / S.gT1) - Rg * Math.log(hi ? S.rp : 1);
    const pts = [
      { x: sOf(S.gT1, false), y: S.gT1, label: '1' },
      { x: sOf(r.T2, true), y: r.T2, label: '2' },
      { x: sOf(S.gT3, true), y: S.gT3, label: '3' },
      { x: sOf(r.T4, true), y: r.T4, label: '4' },
      { x: sOf(S.gT5, false), y: S.gT5, label: '5' },
      { x: sOf(r.T6, false), y: r.T6, label: '6' },
    ];
    const xs = pts.map((p) => p.x);
    const pad = (Math.max(...xs) - Math.min(...xs)) * 0.12 + 0.02;
    plot = <Plot x={[Math.min(...xs) - pad, Math.max(...xs) + pad]} y={[Math.max(0, Math.min(...pts.map((p) => p.y)) - 30), Math.max(...pts.map((p) => p.y)) + 40]} height={280} xLabel="s − s₁ (kJ/kg·K)" yLabel="T (K)" series={[{ points: [...pts, pts[0]], color: 'var(--c1)', width: 2.4 }]} dots={pts} legend={false} />;
  }
  return (
    <Two
      left={
        <div>
          <Num label="Pressure ratio r_p" value={S.rp} onChange={(v) => set({ rp: v })} />
          <Num label="T₁ compressor inlet (after regenerator)" unit="K" value={S.gT1} onChange={(v) => set({ gT1: v })} />
          <Num label="T₃ after heat rejection (regenerator hot inlet)" unit="K" value={S.gT3} onChange={(v) => set({ gT3: v })} />
          <Num label="T₅ turbine exit" unit="K" value={S.gT5} onChange={(v) => set({ gT5: v })} />
          <Num label="η compressor" value={S.gEtaC} onChange={(v) => set({ gEtaC: v })} step={0.01} />
          <Num label="η turbine" value={S.gEtaT} onChange={(v) => set({ gEtaT: v })} step={0.01} />
          <Num label="Mass flow ṁ" unit="kg/s" value={S.gmdot} onChange={(v) => set({ gmdot: v })} />
          <Num label="c_p" unit="kJ/kg·K" value={S.cp} onChange={(v) => set({ cp: v })} />
          <Num label="k" value={S.k} onChange={(v) => set({ k: v })} />
        </div>
      }
      right={
        <div>
          {err && <CalcAlert>{err}</CalcAlert>}
          {r && (
            <>
              <Readout
                items={[
                  ['COP_R', f(r.COP, 4)],
                  ['Q_L', `${f(r.QL)} kW`],
                  ['W_net,in', `${f(r.W)} kW`],
                  ['Regenerator ε', f(r.eps, 4)],
                  ['COP_HP', f(r.COP + 1, 4)],
                ]}
              />
              <Tbl
                head={['State', 'T (K)', 'where']}
                rows={[
                  ['1', f(S.gT1), 'compressor inlet'],
                  ['2', f(r.T2), 'compressor exit'],
                  ['3', f(S.gT3), 'after heat rejection'],
                  ['4', f(r.T4), 'after regenerator (hot side)'],
                  ['5', f(S.gT5), 'turbine exit'],
                  ['6', f(r.T6), 'after refrigerated space'],
                ]}
              />
              {plot}
            </>
          )}
        </div>
      }
    />
  );
}
