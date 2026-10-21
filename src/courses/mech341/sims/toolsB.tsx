/**
 * MECH 341 calculators, part B: PsychroCalc, CombustionCalc, EquilibriumCalc, NozzleCalc.
 * Every number comes from the tested lib. Out-of-range inputs show "outside table range" (never NaN):
 * psychrometrics needs 0.01 <= T <= 100 C with P_g(T) < P; molar gas tables cover 200-6000 K; steam tables as in toolsA.
 */
import { ReactNode } from 'react';
import { Plot, Series } from '../../../core/Plot';
import { Readout } from '../../../core/ui';
import { Chips, Note, Num, Sel, Two, f as fmt } from '../viz/Kit';
import { water } from '../lib/props';
import { SPECIES, A28, lnKp, hR, vantHoff } from '../lib/gas';
import { omega, psyState, mixStreams, Pg, Tdp, PsyState } from '../lib/psychro';
import { burn, dewPoint, steadyQ, aft, fuelHf } from '../lib/combustion';
import { equilibrium } from '../lib/equilibrium';
import { T0_T, P0_P, rho0_rho, areaRatio, machFromAreaRatio, critical } from '../lib/compressible';
import { CalcAlert, Check, Group, OOR, PresetBar, Tbl, useForm } from './toolsA';

/** table values to 5 significant digits */
const f = (v: number, d = 5) => fmt(v, d);

const errMsg = (e: unknown) => `Could not solve this case (${e instanceof Error ? e.message : 'invalid inputs'}).`;
const first = (...m: (string | null)[]) => m.find((x) => x) ?? null;

/* ====================================================================== 5. PsychroCalc */
type By = 'phi' | 'w' | 'Twb' | 'Tdp';
const BY_OPTS: { v: By; t: string }[] = [
  { v: 'phi', t: 'relative humidity φ (%)' },
  { v: 'w', t: 'humidity ratio ω (kg/kg)' },
  { v: 'Twb', t: 'wet-bulb T (°C)' },
  { v: 'Tdp', t: 'dew-point T (°C)' },
];
type Proc = 'heat' | 'cool' | 'humid' | 'mix' | 'evap';
const PS_DEF = {
  P: 101.325,
  T1: 30, by1: 'phi' as By, v1: 70,
  process: 'cool' as Proc,
  flowBy: 'ma' as 'ma' | 'V' | 'Q', flow: 1,
  T2h: 40,
  exitBy: 'T-phi' as 'T-phi' | 'sat-T' | 'sat-room' | 'sat-w', cT2: 12, cPhi2: 100, Troom: 25, phiRoom: 40, reheat: false, T3: 25,
  hT2: 20, hPhi2: 60, hsBy: 'steam' as 'steam' | 'water', hTs: 100,
  mT: 12, mBy: 'phi' as By, mV: 100, mFlow: 10,
  eEff: 0.8,
};
type PS = typeof PS_DEF;

function mkState(P: number, T: number, by: By, v: number): PsyState {
  if (!(T >= 0.01 && T <= 100)) throw new Error(`${OOR}: T = ${f(T)} °C; psychrometrics here covers 0.01–100 °C`);
  if (!(P >= 10 && P <= 2000)) throw new Error(`${OOR}: P = ${f(P)} kPa; use 10–2000 kPa`);
  if (Pg(T) >= P) throw new Error(`${OOR}: the saturation pressure at ${f(T)} °C (${f(Pg(T))} kPa) reaches the total pressure`);
  let i: Parameters<typeof psyState>[0];
  if (by === 'phi') {
    if (!(v > 0 && v <= 100.0001)) throw new Error('Relative humidity must be between 0 and 100 %.');
    i = { T, P, phi: v / 100 };
  } else if (by === 'w') {
    if (!(v > 0)) throw new Error('Humidity ratio must be positive.');
    if (v > (0.622 * Pg(T)) / (P - Pg(T)) * 1.0001) throw new Error(`ω = ${f(v)} exceeds the saturation value at ${f(T)} °C (supersaturated).`);
    i = { T, P, w: v };
  } else if (by === 'Twb') {
    if (!(v >= 0.01 && v <= T)) throw new Error('Wet-bulb temperature must lie between 0.01 °C and the dry-bulb temperature.');
    i = { T, P, Twb: v };
  } else {
    if (!(v >= 0.01 && v <= T)) throw new Error('Dew-point temperature must lie between 0.01 °C and the dry-bulb temperature.');
    i = { T, P, Tdp: v };
  }
  const s = psyState(i);
  if (!(s.w > 0) || ![s.phi, s.h, s.v, s.Tdp].every(Number.isFinite)) throw new Error(`${OOR}: that moist-air state is outside the psychrometric range`);
  return s;
}
const statRow = (label: string, s: PsyState) => [label, f(s.T), f(s.w, 4), f(s.phi * 100, 4), f(s.h), f(s.v, 4), Number.isFinite(s.Tdp) ? f(s.Tdp) : '—', Number.isFinite(s.Twb) ? f(s.Twb) : '—'];
const hfOf = (T: number) => water.satT(T).hf;

interface PsyRes {
  states: { label: string; st: PsyState }[];
  lines: { x: number; y: number }[][];
  ma: number;
  items: [string, string][];
  notes: string[];
}

function psyProcess(S: PS): PsyRes {
  const P = S.P;
  const s1 = mkState(P, S.T1, S.by1, S.v1);
  const notes: string[] = [];
  const items: [string, string][] = [];
  const states: { label: string; st: PsyState }[] = [{ label: '1 inlet', st: s1 }];
  const lines: { x: number; y: number }[][] = [];
  const pt = (s: PsyState) => ({ x: s.T, y: s.w });
  const kgmin = (x: number) => `${f(x)} kg/s (${f(x * 60)} kg/min)`;
  const needMa = () => {
    if (S.flowBy === 'ma') return S.flow;
    if (S.flowBy === 'V') return S.flow / s1.v;
    return NaN; // coil load: only for cooling
  };
  let ma = needMa();
  if (S.flowBy === 'Q' && S.process !== 'cool') ma = S.flow; // coil-load basis only exists for cooling
  if (!(S.flowBy === 'Q' && S.process === 'cool') && !(ma > 0)) throw new Error('The flow rate must be positive.');
  const p = S.process;
  if (p === 'heat') {
    if (!(S.T2h >= 0.01 && S.T2h <= 100)) throw new Error(`${OOR}: T₂ = ${f(S.T2h)} °C`);
    if (S.T2h < s1.Tdp - 1e-9) throw new Error(`T₂ is below the dew point (${f(s1.Tdp)} °C): condensation would occur; use "cooling with dehumidification".`);
    const s2 = mkState(P, S.T2h, 'w', s1.w);
    states.push({ label: '2 outlet', st: s2 });
    lines.push([pt(s1), pt(s2)]);
    const q = s2.h - s1.h;
    items.push(['q = h₂ − h₁', `${f(q)} kJ/kg dry air`], [q >= 0 ? 'Heating rate Q' : 'Cooling rate Q', `${f(Math.abs(ma * q))} kW`], ['Dry-air flow', kgmin(ma)], ['Volume flow in → out', `${f(ma * s1.v)} → ${f(ma * s2.v)} m³/s`], ['ω', 'unchanged']);
    return { states, lines, ma, items, notes };
  }
  if (p === 'cool') {
    let s2: PsyState;
    let s3: PsyState | null = null;
    if (S.exitBy === 'T-phi') s2 = mkState(P, S.cT2, 'phi', S.cPhi2);
    else if (S.exitBy === 'sat-T') s2 = mkState(P, S.cT2, 'phi', 100);
    else if (S.exitBy === 'sat-w') s2 = mkState(P, Tdp(s1.w, P) - 0, 'phi', 100);
    else {
      const room = mkState(P, S.Troom, 'phi', S.phiRoom);
      const T2 = Tdp(room.w, P);
      if (!(T2 >= 0.01)) throw new Error(`${OOR}: the coil dew point is below 0.01 °C`);
      s2 = mkState(P, T2, 'phi', 100);
      s3 = room;
    }
    if (s2.w > s1.w * (1 + 1e-9)) throw new Error('The coil exit has more moisture than the inlet: nothing condenses. Use heating or humidification.');
    if (S.exitBy === 'sat-w') notes.push('"Saturated at the inlet ω" is just the dew point of the entering air: the lowest coil exit with no condensation.');
    const hf2 = hfOf(s2.T);
    const dh = s1.h - s2.h - (s1.w - s2.w) * hf2;
    if (S.flowBy === 'Q') ma = S.flow / dh;
    if (!(ma > 0)) throw new Error('The coil load must be positive and removes heat from the air.');
    states.push({ label: '2 coil exit', st: s2 });
    lines.push([pt(s1), { x: s1.T, y: s1.w }, pt(s2)]);
    const mw = ma * (s1.w - s2.w);
    const Qc = ma * dh;
    items.push(['Coil load Q', `${f(Qc)} kW (${f((Qc * 60) / 211)} tons)`], ['Dry-air flow', kgmin(ma)], ['Inlet volume flow V̇₁', `${f(ma * s1.v)} m³/s (${f(ma * s1.v * 60)} m³/min)`], ['Condensate', kgmin(mw)], ['Latent part of Q', `${f((ma * (s1.w - s2.w) * 2450) / Qc * 100, 3)} % (approx. h_fg)`]);
    if (s3 || S.reheat) {
      const T3 = s3 ? s3.T : S.T3;
      const st3 = s3 ?? mkState(P, T3, 'w', s2.w);
      states.push({ label: '3 after reheat', st: st3 });
      lines.push([pt(s2), pt(st3)]);
      items.push(['Reheat Q', `${f(ma * (st3.h - s2.h))} kW`]);
    }
    notes.push(`Condensate leaves at the coil exit temperature (h_f = ${f(hf2)} kJ/kg); the energy balance keeps the term ṁ_w h_f.`);
    return { states, lines, ma, items, notes };
  }
  if (p === 'humid') {
    const s2 = mkState(P, S.hT2, 'phi', S.hPhi2);
    if (s2.w < s1.w) throw new Error('The exit air is drier than the inlet: that is dehumidification, not humidification.');
    const mw0 = s2.w - s1.w;
    if (!(S.hTs >= 0.01 && S.hTs <= 373)) throw new Error(`${OOR}: the supply temperature must be 0.01–373 °C`);
    const sat = water.satT(S.hTs);
    const hs = S.hsBy === 'steam' ? sat.hg : sat.hf;
    const hAfterHeater = s2.h - mw0 * hs;
    const Tp = (hAfterHeater - 2501.3 * s1.w) / (1.005 + 1.82 * s1.w);
    let mid: PsyState | null = null;
    try {
      mid = mkState(P, Tp, 'w', s1.w);
    } catch {
      mid = null;
    }
    states.push(...(mid ? [{ label: '1′ after heating coil', st: mid }] : []), { label: '2 outlet', st: s2 });
    lines.push(mid ? [pt(s1), pt(mid), pt(s2)] : [pt(s1), pt(s2)]);
    const Q = ma * (s2.h - s1.h) - ma * mw0 * hs;
    items.push(['Water added', kgmin(ma * mw0)], [S.hsBy === 'steam' ? `Steam h_g at ${f(S.hTs)} °C` : `Water h_f at ${f(S.hTs)} °C`, `${f(hs)} kJ/kg`], [Q >= 0 ? 'Heating coil Q' : 'Cooling needed', `${f(Math.abs(Q))} kW`], ['T after heating coil', mid ? `${f(Tp)} °C` : `${OOR}`], ['Dry-air flow', kgmin(ma)], ['Inlet volume flow', `${f(ma * s1.v)} m³/s (${f(ma * s1.v * 60)} m³/min)`]);
    if (Q < 0) notes.push('Q < 0: the supplied water or steam brings more enthalpy than the exit state needs; the air would have to be cooled.');
    return { states, lines, ma, items, notes };
  }
  // evaporative cooling
  if (!(S.eEff > 0 && S.eEff <= 1)) throw new Error('Saturation effectiveness must be between 0 and 1.');
  if (!Number.isFinite(s1.Twb)) throw new Error(`${OOR}: wet-bulb temperature not defined for this state`);
  const T2 = s1.T - S.eEff * (s1.T - s1.Twb);
  const s2 = mkState(P, T2, 'Twb', s1.Twb);
  states.push({ label: '2 outlet', st: s2 });
  lines.push([pt(s1), pt(s2)]);
  items.push(['Water evaporated', kgmin(ma * (s2.w - s1.w))], ['Temperature drop', `${f(s1.T - T2)} K (limit: T₁ − T_wb = ${f(s1.T - s1.Twb)} K)`], ['Dry-air flow', kgmin(ma)], ['Volume flow in → out', `${f(ma * s1.v)} → ${f(ma * s2.v)} m³/s`], ['Heat transfer', '0 (adiabatic)']);
  notes.push('Adiabatic saturation: the air moves along the constant wet-bulb line (h nearly constant), picking up the evaporated water.');
  return { states, lines, ma, items, notes };
}

function mixProcess(S: PS): PsyRes {
  const P = S.P;
  const s1 = mkState(P, S.T1, S.by1, S.v1);
  const s2 = mkState(P, S.mT, S.mBy, S.mV);
  const ma1 = S.flowBy === 'V' ? S.flow / s1.v : S.flow;
  const ma2 = S.flowBy === 'V' ? S.mFlow / s2.v : S.mFlow;
  if (!(ma1 > 0 && ma2 > 0)) throw new Error('Both flow rates must be positive.');
  const m = mixStreams({ ma: ma1, w: s1.w, h: s1.h }, { ma: ma2, w: s2.w, h: s2.h }, P);
  const notes: string[] = [];
  const fog = m.phi > 1 + 1e-9;
  let s3: PsyState | null = null;
  if (!fog && m.T >= 0.01 && m.T <= 100) s3 = mkState(P, m.T, 'w', m.w);
  const states: { label: string; st: PsyState }[] = [{ label: '1 stream A', st: s1 }, { label: '2 stream B', st: s2 }];
  if (s3) states.push({ label: '3 mixture', st: s3 });
  const items: [string, string][] = [
    ['Mixture T₃', `${f(m.T)} °C`],
    ['Mixture ω₃', f(m.w, 4)],
    ['Mixture φ₃', fog ? '> 100 % (fog)' : `${f(m.phi * 100, 4)} %`],
    ['Mixture h₃', `${f(m.h)} kJ/kg`],
    ['Dry-air flows', `${f(ma1)} + ${f(ma2)} = ${f(m.ma)} kg/s`],
  ];
  if (fog) notes.push('The adiabatic mixture is supersaturated: it forms fog (liquid droplets) and the true end state lies on the saturation curve.');
  notes.push('Mixing is a straight line on the (h, ω) chart: the mixed state divides the segment 1–2 inversely to the dry-air flows.');
  const lines = [[{ x: s1.T, y: s1.w }, { x: m.T, y: m.w }, { x: s2.T, y: s2.w }]];
  return { states, lines, ma: m.ma, items, notes };
}

function PsyPlot({ P, points, lines, onPick }: { P: number; points: { T: number; w: number; label: string }[]; lines: { x: number; y: number }[][]; onPick: (T: number, w: number) => void }) {
  const Ts = Array.from({ length: 101 }, (_, i) => i / 2);
  const series: Series[] = [];
  const ok = P > 25 && P < 1500;
  for (let phi = 10; phi <= 100; phi += 10) {
    series.push({ points: Ts.map((T) => (ok && Pg(T) < P * 0.99 ? { x: T, y: omega(T, phi / 100, P) } : { x: NaN, y: NaN })), color: phi === 100 ? 'var(--c1)' : 'var(--muted)', width: phi === 100 ? 2.4 : 1.1 });
  }
  for (const h of [20, 40, 60, 80, 100]) {
    const pts: { x: number; y: number }[] = [];
    for (let T = 0; T <= 50; T += 1) {
      const w = (h - 1.005 * T) / (2501.3 + 1.82 * T);
      if (w < 0 || !ok || Pg(T) >= P * 0.99 || w > omega(T, 1, P)) continue;
      pts.push({ x: T, y: w });
    }
    if (pts.length > 1) series.push({ points: pts, color: 'var(--c3)', width: 1, dash: true });
  }
  for (const l of lines) series.push({ points: l, color: 'var(--c2)', width: 2.6 });
  return (
    <Plot x={[0, 50]} y={[0, 0.03]} height={360} xLabel="dry-bulb T (°C) — click the chart to set state 1" yLabel="ω (kg/kg dry air)" series={series} dots={points.map((p) => ({ x: p.T, y: p.w, label: p.label }))} legend={false}>
      {(sx, sy) => (
        <rect
          x={sx(0)}
          y={sy(0.03)}
          width={sx(50) - sx(0)}
          height={sy(0) - sy(0.03)}
          fill="rgba(0,0,0,0)"
          style={{ cursor: 'crosshair' }}
          onClick={(e) => {
            const svg = e.currentTarget.ownerSVGElement;
            const m = svg?.getScreenCTM();
            if (!svg || !m) return;
            const q = svg.createSVGPoint();
            q.x = e.clientX;
            q.y = e.clientY;
            const r = q.matrixTransform(m.inverse());
            onPick(((r.x - sx(0)) / (sx(50) - sx(0))) * 50, ((r.y - sy(0)) / (sy(0.03) - sy(0))) * 0.03);
          }}
        />
      )}
    </Plot>
  );
}

export function PsychroCalc() {
  const [S, set, load] = useForm(PS_DEF);
  let res: PsyRes | null = null;
  let err: string | null = null;
  try {
    err = first(!(S.P >= 10 && S.P <= 2000) ? `${OOR}: P = ${f(S.P)} kPa; use 10–2000 kPa.` : null);
    if (!err) res = S.process === 'mix' ? mixProcess(S) : psyProcess(S);
  } catch (e) {
    err = e instanceof Error ? e.message : errMsg(e);
    res = null;
  }
  const pick = (T: number, w: number) => {
    try {
      const Tr = Math.round(Math.max(0.1, Math.min(50, T)) * 10) / 10;
      const wsat = omega(Tr, 1, S.P);
      if (w >= wsat) set({ T1: Tr, by1: 'phi', v1: 100 });
      else set({ T1: Tr, by1: 'w', v1: Math.max(0.0001, Math.round(w * 1e5) / 1e5) });
    } catch {
      /* ignore clicks that are outside the valid chart */
    }
  };
  const proc = S.process;
  const flowOpts: { v: 'ma' | 'V' | 'Q'; t: string }[] = [{ v: 'ma', t: 'Dry-air mass flow ṁₐ (kg/s)' }, { v: 'V', t: 'Inlet volume flow V̇₁ (m³/s)' }, ...(proc === 'cool' ? [{ v: 'Q' as const, t: 'Coil load Q (kW)' }] : [])];
  const flowBy = proc !== 'cool' && S.flowBy === 'Q' ? 'ma' : S.flowBy;
  const mixFlowLabel = flowBy === 'V' ? 'V̇ of stream B (m³/s)' : 'ṁₐ of stream B (kg/s)';
  const byValLabel = (by: By) => (by === 'phi' ? 'φ (%)' : by === 'w' ? 'ω (kg/kg)' : by === 'Twb' ? 'T_wb (°C)' : 'T_dp (°C)');
  return (
    <div>
      <PresetBar
        items={[
          ['14-102: mixing → 22.8 °C, φ 0.90', () => load({ P: 101.325, T1: 36, by1: 'Twb', v1: 30, process: 'mix', flowBy: 'ma', flow: 8, mT: 12, mBy: 'phi', mV: 100, mFlow: 10 })],
          ['2021 final P5: coil, T₂ = 10.5 °C', () => load({ P: 100, T1: 30, by1: 'phi', v1: 70, process: 'cool', flowBy: 'Q', flow: (11 * 211) / 60, exitBy: 'sat-room', Troom: 25, phiRoom: 40 })],
          ['2021 final P6: steam humidifier', () => load({ P: 95, T1: 10, by1: 'phi', v1: 70, process: 'humid', flowBy: 'V', flow: 70 / 60, hT2: 20, hPhi2: 60, hsBy: 'steam', hTs: 100 })],
        ]}
      />
      <Two
        left={
          <div>
            <Num label="Total pressure P (always check the problem: 100, 101.325, 95 kPa…)" unit="kPa" value={S.P} onChange={(v) => set({ P: v })} />
            <Group title="State 1 (inlet / stream A)">
              <Num label="Dry-bulb T₁" unit="°C" value={S.T1} onChange={(v) => set({ T1: v })} />
              <Sel label="plus one of" value={S.by1} onChange={(by1) => set({ by1, v1: by1 === 'phi' ? 50 : by1 === 'w' ? 0.01 : Math.max(0.5, S.T1 - 8) })} options={BY_OPTS} />
              <Num label={byValLabel(S.by1)} value={S.v1} onChange={(v) => set({ v1: v })} />
            </Group>
            <Sel label="Process" value={S.process} onChange={(v) => set({ process: v })} options={[{ v: 'heat', t: 'Sensible heating' }, { v: 'cool', t: 'Cooling with dehumidification (coil)' }, { v: 'humid', t: 'Humidification by steam or water' }, { v: 'mix', t: 'Adiabatic mixing of two streams' }, { v: 'evap', t: 'Evaporative cooling' }]} />
            <Sel label="Flow given as" value={flowBy} onChange={(v) => set({ flowBy: v })} options={flowOpts} />
            <Num label={flowBy === 'ma' ? 'ṁₐ (kg/s dry air)' : flowBy === 'V' ? 'V̇₁ (m³/s)' : 'Coil load (kW)'} value={S.flow} onChange={(v) => set({ flow: v })} />
            {proc === 'heat' && <Num label="Outlet T₂" unit="°C" value={S.T2h} onChange={(v) => set({ T2h: v })} />}
            {proc === 'cool' && (
              <Group title="Coil exit">
                <Sel label="Exit state" value={S.exitBy} onChange={(v) => set({ exitBy: v })} options={[{ v: 'T-phi', t: 'T₂ and φ₂' }, { v: 'sat-T', t: 'Saturated at T₂' }, { v: 'sat-room', t: 'Saturated, ω₂ = ω of a target room state (then reheated)' }, { v: 'sat-w', t: 'Saturated at the inlet ω (dew point)' }]} />
                {(S.exitBy === 'T-phi' || S.exitBy === 'sat-T') && <Num label="T₂" unit="°C" value={S.cT2} onChange={(v) => set({ cT2: v })} />}
                {S.exitBy === 'T-phi' && <Num label="φ₂ (%)" value={S.cPhi2} onChange={(v) => set({ cPhi2: v })} />}
                {S.exitBy === 'sat-room' && (
                  <>
                    <Num label="Room / final T" unit="°C" value={S.Troom} onChange={(v) => set({ Troom: v })} />
                    <Num label="Room / final φ (%)" value={S.phiRoom} onChange={(v) => set({ phiRoom: v })} />
                  </>
                )}
                {S.exitBy !== 'sat-room' && <Check label="Reheat after the coil" checked={S.reheat} onChange={(v) => set({ reheat: v })} />}
                {S.exitBy !== 'sat-room' && S.reheat && <Num label="Reheat to T₃" unit="°C" value={S.T3} onChange={(v) => set({ T3: v })} />}
              </Group>
            )}
            {proc === 'humid' && (
              <Group title="Humidifier">
                <Num label="Exit T₂" unit="°C" value={S.hT2} onChange={(v) => set({ hT2: v })} />
                <Num label="Exit φ₂ (%)" value={S.hPhi2} onChange={(v) => set({ hPhi2: v })} />
                <Sel label="Supplies" value={S.hsBy} onChange={(v) => set({ hsBy: v })} options={[{ v: 'steam', t: 'Saturated steam (h_g)' }, { v: 'water', t: 'Liquid water (h_f)' }]} />
                <Num label="Supply temperature" unit="°C" value={S.hTs} onChange={(v) => set({ hTs: v })} />
                <Note>The heating coil before the humidifier is sized so the exit state is met: Q = ṁₐ(h₂ − h₁) − ṁ_w h_supply.</Note>
              </Group>
            )}
            {proc === 'mix' && (
              <Group title="Stream B">
                <Num label="T_B" unit="°C" value={S.mT} onChange={(v) => set({ mT: v })} />
                <Sel label="plus one of" value={S.mBy} onChange={(mBy) => set({ mBy, mV: mBy === 'phi' ? 100 : mBy === 'w' ? 0.008 : Math.max(0.5, S.mT - 2) })} options={BY_OPTS} />
                <Num label={byValLabel(S.mBy)} value={S.mV} onChange={(v) => set({ mV: v })} />
                <Num label={mixFlowLabel} value={S.mFlow} onChange={(v) => set({ mFlow: v })} />
              </Group>
            )}
            {proc === 'evap' && <Num label="Saturation effectiveness (0–1)" value={S.eEff} onChange={(v) => set({ eEff: v })} step={0.05} />}
          </div>
        }
        right={
          <div>
            {err && <CalcAlert>{err}</CalcAlert>}
            <PsyPlot P={S.P} points={res ? res.states.map((s, i) => ({ T: s.st.T, w: s.st.w, label: String(s.label.split(' ')[0] || i + 1) })) : []} lines={res?.lines ?? []} onPick={pick} />
            {res && (
              <>
                <Readout items={res.items} />
                <Tbl head={['State', 'T (°C)', 'ω', 'φ (%)', 'h (kJ/kg)', 'v (m³/kg)', 'T_dp (°C)', 'T_wb (°C)']} rows={res.states.map((s) => statRow(s.label, s.st))} />
                {res.notes.map((n, i) => (
                  <Note key={i}>{n}</Note>
                ))}
              </>
            )}
            <Note>
              Chart at P = {f(S.P)} kPa: φ = 10…100 % (coloured = saturated), dashed red = constant h (20…100 kJ/kg). h = 1.005 T + ω(2501.3 + 1.82 T) per kg dry air; v per kg dry air.
            </Note>
          </div>
        }
      />
    </div>
  );
}

/* ====================================================================== 6. CombustionCalc */
const FUEL_KEYS = ['CH4', 'C2H6', 'C3H8', 'C3H8_l', 'C4H10', 'C4H10_l', 'C2H2', 'C2H4', 'C3H6', 'H2', 'CO', 'C', 'C6H6g', 'C8H18g', 'C8H18l', 'C10H22', 'C12H26g', 'CH3OHg', 'CH3OHl', 'C2H5OHg', 'C2H5OHl'];
const baseKey = (k: string) => (k.endsWith('_l') ? k.slice(0, -2) : k);
const fuelLabel = (k: string) => `${SPECIES[baseKey(k)].formula}${k.endsWith('_l') ? ' (liquid)' : ''} — ${SPECIES[baseKey(k)].name}`;
const FUEL_OPTS = FUEL_KEYS.map((k) => ({ v: k, t: fuelLabel(k) }));
const fmlOf = (k: string) => SPECIES[baseKey(k)].formula.replace(/\((g|l|s)\)/, '');

const CB_DEF = {
  rows: [{ key: 'C3H8', y: 1 }] as { key: string; y: number }[],
  theo: 100, co: 0, Tfuel: 298.15, Tair: 298.15, cpFuel: 0, Tprod: 400, atDew: false, Pdew: 101.325, Qloss: 0,
};

export function CombustionCalc() {
  const [S, set, load] = useForm(CB_DEF);
  let out: ReactNode = null;
  let err: string | null = null;
  try {
    const sum = S.rows.reduce((a, r) => a + r.y, 0);
    err = first(
      S.rows.length === 0 || !(sum > 0) || S.rows.some((r) => r.y < 0) ? 'Enter at least one fuel with a positive mole fraction.' : null,
      !(S.theo > 0) ? 'Percent theoretical air must be positive.' : null,
      !(S.co >= 0 && S.co <= 100) ? 'CO fraction of the carbon must be between 0 and 100 %.' : null,
      ...[['air', S.Tair], ['fuel', S.Tfuel]].map(([n, T]) => (!((T as number) >= 200 && (T as number) <= 6000) ? `${OOR}: ${n} temperature ${f(T as number)} K; the gas tables cover 200–6000 K.` : null)),
    );
    if (!err) {
      const fuel: [number, string][] = S.rows.filter((r) => r.y > 0).map((r) => [r.y / sum, r.key]);
      const b = burn({ fuel, theoAir: S.theo / 100, coFraction: S.co / 100 });
      const pr = b.products;
      if (pr.O2 < -1e-9) {
        err = `Fuel-rich: with ${f(S.theo)} % theoretical air and ${f(S.co)} % of the carbon to CO the O₂ balance gives ${f(pr.O2, 3)} kmol (negative). Raise the air or the CO fraction, or enter this case by hand with H₂ in the products.`;
      } else {
        const nameOf = (k: string) => fmlOf(k);
        const lhs = `${fuel.map(([y, k]) => `${Math.abs(y - 1) < 1e-9 ? '' : `${f(y, 4)} `}${nameOf(k)}`).join(' + ')} + ${f(b.a, 4)} (O₂ + 3.76 N₂)`;
        const rhs = ([['CO2', 'CO₂'], ['CO', 'CO'], ['H2O', 'H₂O'], ['O2', 'O₂'], ['N2', 'N₂']] as const).filter(([k]) => pr[k] > 1e-12).map(([k, n]) => `${f(pr[k], 4)} ${n}`).join(' + ');
        const dry = pr.CO2 + pr.CO + pr.O2 + pr.N2;
        const Mf = b.Mfuel;
        let dp = NaN;
        const Pv = (pr.H2O / b.Nprod) * S.Pdew;
        let dpMsg: string | null = null;
        if (!(S.Pdew > 0)) dpMsg = 'Pressure must be positive.';
        else if (pr.H2O <= 0) dpMsg = 'No water in the products.';
        else if (Pv < 0.6117 || Pv > 22000) dpMsg = `${OOR}: the water partial pressure ${f(Pv)} kPa is outside the steam tables (0.61–22 000 kPa).`;
        else dp = dewPoint(pr, S.Pdew);
        const Tprod = S.atDew && Number.isFinite(dp) ? dp + 273.15 : S.Tprod;
        let Q = NaN;
        let QMsg: string | null = null;
        if (!(Tprod >= 200 && Tprod <= 6000)) QMsg = `${OOR}: product temperature ${f(Tprod)} K; the gas tables cover 200–6000 K.`;
        else Q = steadyQ({ fuel, theoAir: S.theo / 100, coFraction: S.co / 100, Tfuel: S.Tfuel, Tair: S.Tair, Tprod, cpFuel: S.cpFuel });
        let Tad = NaN;
        let aftMsg: string | null = null;
        try {
          Tad = aft({ fuel, theoAir: S.theo / 100, Tfuel: S.Tfuel, Tair: S.Tair, Qloss: S.Qloss, coFraction: S.co / 100, cpFuel: S.cpFuel });
          if (!Number.isFinite(Tad) || Tad < 300.5 || Tad > 5799) {
            aftMsg = `${OOR}: the flame temperature falls outside 300–5800 K (the tables stop at 6000 K; with the heat loss given there is no solution).`;
            Tad = NaN;
          }
        } catch {
          aftMsg = `${OOR}: flame temperature not found.`;
        }
        // heating values (products at 25 C): HHV with liquid water, LHV with vapour
        let hcH = 0;
        let hcL = 0;
        for (const [y, k] of fuel) {
          const s = SPECIES[baseKey(k)];
          const Cn = s.C ?? 0;
          const Hn = s.H ?? 0;
          hcH += y * (Cn * SPECIES.CO2.hf + (Hn / 2) * SPECIES.H2Ol.hf - fuelHf(k));
          hcL += y * (Cn * SPECIES.CO2.hf + (Hn / 2) * SPECIES.H2Og.hf - fuelHf(k));
        }
        out = (
          <>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', margin: '8px 0', overflowX: 'auto', fontSize: '.95rem' }}>
              <b>Balanced equation (per kmol of fuel mixture)</b>
              <div style={{ fontFamily: 'ui-monospace, monospace', marginTop: 4 }}>
                {lhs} → {rhs}
              </div>
            </div>
            <Readout
              items={[
                ['Air–fuel ratio AF', `${f(b.AF, 5)} kg air/kg fuel`],
                ['Fuel–air ratio FA', f(b.FA, 5)],
                ['Air per fuel', `${f(b.nAir, 5)} kmol/kmol`],
                ['Equivalence ratio Φ', f(100 / S.theo, 4)],
                ['Fuel molar mass', `${f(Mf, 5)} kg/kmol`],
                ['Products total', `${f(b.Nprod, 5)} kmol/kmol fuel`],
                ['Dew point of products', Number.isFinite(dp) ? `${f(dp, 4)} °C at ${f(S.Pdew)} kPa` : (dpMsg ?? '—')],
                ['HHV / LHV', `${f(hcH / -Mf, 5)} / ${f(hcL / -Mf, 5)} kJ/kg`],
                ['Q (open system, out)', Number.isFinite(Q) ? `${f(Q, 5)} kJ/kmol fuel` : (QMsg ?? '—')],
                ['Q per kg fuel', Number.isFinite(Q) ? `${f(Q / Mf, 5)} kJ/kg` : '—'],
                ['Adiabatic flame T', Number.isFinite(Tad) ? `${f(Tad, 5)} K` : (aftMsg ?? '—')],
                ['Products leave at', `${f(Tprod, 5)} K`],
              ]}
            />
            {pr.CO > 0 && <Chips items={[['Incomplete combustion', `${f(pr.CO, 3)} kmol CO per kmol fuel`, 'warn']]} />}
            <Tbl
              head={['Product', 'kmol / kmol fuel', 'mole fraction (wet) %', 'dry basis %']}
              rows={(['CO2', 'CO', 'H2O', 'O2', 'N2'] as const).map((k) => [{ CO2: 'CO₂', CO: 'CO', H2O: 'H₂O', O2: 'O₂', N2: 'N₂' }[k], f(pr[k], 5), f((100 * pr[k]) / b.Nprod, 4), k === 'H2O' ? '—' : f((100 * pr[k]) / dry, 4)])}
            />
            <Note>
              Complete combustion to CO₂, CO, H₂O(g), O₂, N₂ without dissociation, so the flame temperature is the textbook value (an upper bound). Liquid fuels enter with h̄<sub>f</sub> reduced by M·h<sub>fg</sub>. The open-system Q is the heat released to the surroundings (positive = out) with water as vapor in the products.
            </Note>
          </>
        );
      }
    }
  } catch (e) {
    err = errMsg(e);
    out = null;
  }
  const upd = (i: number, p: Partial<{ key: string; y: number }>) => set({ rows: S.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  return (
    <div>
      <PresetBar
        items={[
          ['15-59: propane 159.9 %, T_dp 46.0 °C', () => load({ rows: [{ key: 'C3H8', y: 1 }], theo: 159.9, co: 0, Tfuel: 298.15, Tair: 298.15, atDew: true, Pdew: 101.325, Qloss: 0 })],
          ['15-79: acetylene 130 %, loss 75 000 → 2302 K', () => load({ rows: [{ key: 'C2H2', y: 1 }], theo: 130, co: 0, Tfuel: 298.15, Tair: 300.15, atDew: false, Tprod: 1500, Qloss: 75000 })],
          ['15-67: 40 % C₃H₈ + 60 % CH₄', () => load({ rows: [{ key: 'C3H8', y: 0.4 }, { key: 'CH4', y: 0.6 }], theo: 100, co: 0, Tfuel: 298.15, Tair: 298.15, atDew: false, Tprod: 398.15, Qloss: 0 })],
          ['Liquid octane, 120 %, 10 % CO', () => load({ rows: [{ key: 'C8H18l', y: 1 }], theo: 120, co: 10, Tfuel: 298.15, Tair: 298.15, atDew: false, Tprod: 1200, Qloss: 0 })],
        ]}
      />
      <Two
        left={
          <div>
            <Group title="Fuel (mole fractions; add rows for a mixture)">
              {S.rows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 6, alignItems: 'end' }}>
                  <Sel label={i === 0 ? 'species' : undefined} value={r.key} onChange={(key) => upd(i, { key })} options={FUEL_OPTS} />
                  <Num label={i === 0 ? 'mole frac.' : ''} value={r.y} onChange={(y) => upd(i, { y })} step={0.05} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => set({ rows: [...S.rows, { key: 'CH4', y: 0 }] })}>
                  + fuel
                </button>
                {S.rows.length > 1 && (
                  <button className="btn" onClick={() => set({ rows: S.rows.slice(0, -1) })}>
                    − fuel
                  </button>
                )}
              </div>
              <Note>Fractions are normalised to sum to 1.</Note>
            </Group>
            <Num label="Theoretical air (100 = stoichiometric)" unit="%" value={S.theo} onChange={(v) => set({ theo: v })} />
            <Num label="Carbon burned to CO instead of CO₂" unit="%" value={S.co} onChange={(v) => set({ co: v })} />
            <Num label="Fuel enters at" unit="K" value={S.Tfuel} onChange={(v) => set({ Tfuel: v })} />
            <Num label="Air enters at" unit="K" value={S.Tair} onChange={(v) => set({ Tair: v })} />
            {Math.abs(S.Tfuel - 298.15) > 0.5 && <Num label="Fuel c̄_p (for T ≠ 298 K)" unit="kJ/kmol·K" value={S.cpFuel} onChange={(v) => set({ cpFuel: v })} />}
            <Check label="Products leave at their dew point" checked={S.atDew} onChange={(v) => set({ atDew: v })} />
            {!S.atDew && <Num label="Products leave at" unit="K" value={S.Tprod} onChange={(v) => set({ Tprod: v })} />}
            <Num label="Pressure (dew point)" unit="kPa" value={S.Pdew} onChange={(v) => set({ Pdew: v })} />
            <Num label="Heat loss in the flame-T calculation" unit="kJ/kmol fuel" value={S.Qloss} onChange={(v) => set({ Qloss: v })} />
          </div>
        }
        right={
          <div>
            {err && <CalcAlert>{err}</CalcAlert>}
            {out}
          </div>
        }
      />
    </div>
  );
}

/* ====================================================================== 7. EquilibriumCalc */
const SPN: Record<string, string> = { H2: 'H₂', H: 'H', O2: 'O₂', O: 'O', N2: 'N₂', N: 'N', H2O: 'H₂O', OH: 'OH', CO2: 'CO₂', CO: 'CO', NO: 'NO' };
const RX_DEFAULT_INIT = (i: number) => {
  const r = A28[i];
  const o: Record<string, number> = {};
  for (const [, sp] of r.prod) o[sp] = 0;
  if (r.reac.length === 1) o[r.reac[0][1]] = 1;
  else for (const [n, sp] of r.reac) o[sp] = n * 2;
  return o;
};
const EQ_DEF = { rx: 5, T: 3000, P: 1, init: RX_DEFAULT_INIT(5), inert: 0, lnSrc: 'calc' as 'calc' | 'manual', lnMan: -3.931, vT1: 2000, vL1: -6.635, vT2: 2400, vL2: -3.86 };
const rxSpecies = (i: number) => Array.from(new Set([...A28[i].reac, ...A28[i].prod].map(([, sp]) => sp as string)));

export function EquilibriumCalc() {
  const [S, set, load] = useForm(EQ_DEF);
  const rx = A28[S.rx];
  const spc = rxSpecies(S.rx);
  let comp: ReactNode = null;
  let err: string | null = null;
  let lnK = NaN;
  try {
    err = first(
      !(S.T >= 200 && S.T <= 6000) ? `${OOR}: T = ${f(S.T)} K; the molar gas tables behind ln K_p cover 200–6000 K.` : null,
      !(S.P > 0) ? 'Pressure must be positive.' : null,
      spc.some((sp) => !(S.init[sp] >= 0)) || !(S.inert >= 0) ? 'Initial amounts must be ≥ 0.' : null,
    );
    if (!err) {
      lnK = S.lnSrc === 'manual' ? S.lnMan : lnKp(rx, S.T);
      if (!Number.isFinite(lnK)) err = `${OOR}: ln K_p not available.`;
    }
    if (!err) {
      const reacSp = rx.reac.map(([, s]) => s as string);
      if (reacSp.every((s) => !(S.init[s] > 0)) && rx.prod.every(([, s]) => !(S.init[s as string] > 0))) err = 'Put some moles of the reactants (or products) in the initial mixture.';
    }
    if (!err) {
      const initial: Record<string, number> = {};
      for (const sp of spc) initial[sp] = S.init[sp] ?? 0;
      const eq = equilibrium({ lnK, reac: rx.reac as [number, string][], prod: rx.prod as [number, string][], initial, inert: S.inert > 0 ? { inert: S.inert } : undefined, P: S.P });
      const vals = Object.values(eq);
      if (!vals.every((v) => Number.isFinite(v))) err = 'No equilibrium composition exists for these amounts (check that something can react).';
      else {
        const N = vals.reduce((a, b) => a + b, 0);
        const rr = rx.reac.map(([, s]) => s as string)[0];
        const nu = Object.fromEntries(spc.map((sp) => [sp, (rx.prod.find(([, s]) => s === sp)?.[0] ?? 0) - (rx.reac.find(([, s]) => s === sp)?.[0] ?? 0)]));
        const dnu = Object.values(nu).reduce((a, b) => a + b, 0);
        const ext = (eq[spc[0]] - (initial[spc[0]] ?? 0)) / (nu[spc[0]] || 1);
        const diss = (initial[rr] ?? 0) > 0 ? 1 - eq[rr] / initial[rr] : NaN;
        comp = (
          <>
            <Readout
              items={[
                ['ln K_p(T)', f(lnK, 5)],
                ['K_p', f(Math.exp(lnK), 5)],
                ['Δν (gas moles)', f(dnu, 3)],
                ['h̄_R(T) (tables)', `${f(hR(rx, S.T), 6)} kJ/kmol`],
                ['Extent ξ', `${f(ext, 5)} kmol`],
                ['Converted fraction of ' + SPN[rr], Number.isFinite(diss) ? f(diss, 4) : '—'],
                ['Total moles', `${f(N, 5)} kmol`],
              ]}
            />
            <Tbl head={['Species', 'initial kmol', 'equilibrium kmol', 'mole fraction']} rows={[...spc.map((sp) => [SPN[sp], f(initial[sp], 4), f(eq[sp], 5), f(eq[sp] / N, 5)]), ...(S.inert > 0 ? [['inert', f(S.inert, 4), f(S.inert, 4), f(S.inert / N, 5)]] : [])]} />
            <Note>
              Solved from K_p = Π (y<sub>i</sub>P/P°)<sup>ν<sub>i</sub></sup> with P° = 1 atm. {Math.abs(dnu) < 1e-9 ? 'Δν = 0: the composition does not depend on P or on inert gas.' : dnu > 0 ? 'Δν > 0: more pressure or less inert gas pushes toward the reactants.' : 'Δν < 0: more pressure favours the products.'}
            </Note>
          </>
        );
      }
    }
  } catch (e) {
    err = errMsg(e);
    comp = null;
  }
  // ln Kp(T) curve
  const curve = Array.from({ length: 61 }, (_, i) => 298.15 + ((6000 - 298.15) * i) / 60).map((T) => ({ x: T, y: lnKp(rx, T) })).filter((p) => Number.isFinite(p.y));
  const ys = curve.map((p) => p.y);
  const ylo = Math.floor(Math.min(...ys) / 5) * 5;
  const yhi = Math.ceil(Math.max(...ys) / 5) * 5;
  // van 't Hoff
  let vh: ReactNode = null;
  if (!(S.vT1 > 0 && S.vT2 > 0 && S.vT1 !== S.vT2)) vh = <CalcAlert>Enter two different positive temperatures.</CalcAlert>;
  else {
    const h = vantHoff(S.vL1, S.vT1, S.vL2, S.vT2);
    const Tm = (S.vT1 + S.vT2) / 2;
    vh = (
      <Readout
        items={[
          ['h̄_R from van ’t Hoff', Number.isFinite(h) ? `${f(h, 6)} kJ/kmol` : '—'],
          [`h̄_R from enthalpy data at ${f(Tm)} K`, S.vT1 >= 200 && S.vT2 <= 6000 ? `${f(hR(rx, Tm), 6)} kJ/kmol (selected reaction)` : OOR],
        ]}
      />
    );
  }
  const rxOpts = A28.map((r, i) => ({ v: String(i), t: r.label }));
  return (
    <div>
      <PresetBar
        items={[
          ['16-31: N₂ + O₂ → NO from air at 2 atm (ln K_p = −3.931), 0.0376', () => load({ rx: 6, T: 2000, P: 2, init: { N2: 3.76, O2: 1, NO: 0 }, inert: 0, lnSrc: 'manual', lnMan: -3.931, vT1: 2000, vL1: -6.635, vT2: 2400, vL2: -3.86 })],
          ['16-56: van ’t Hoff, CO₂ ⇌ CO + ½O₂ → 276 856', () => load({ rx: 5, T: 2200, P: 1, init: { CO2: 1, CO: 0, O2: 0 }, vT1: 2000, vL1: -6.635, vT2: 2400, vL2: -3.86 })],
        ]}
      />
      <Two
        left={
          <div>
            <Sel label="Reaction (Table A-28)" value={String(S.rx)} onChange={(v) => set({ rx: Number(v), init: RX_DEFAULT_INIT(Number(v)) })} options={rxOpts} />
            <Group title="Composition solver">
              <Num label="Temperature T" unit="K" value={S.T} onChange={(v) => set({ T: v })} />
              <Num label="Pressure P" unit="atm" value={S.P} onChange={(v) => set({ P: v })} />
              {spc.map((sp) => (
                <Num key={sp} label={`Initial ${SPN[sp]}`} unit="kmol" value={S.init[sp] ?? 0} onChange={(v) => set({ init: { ...S.init, [sp]: v } })} />
              ))}
              <Num label="Inert gas (e.g. extra N₂, Ar)" unit="kmol" value={S.inert} onChange={(v) => set({ inert: v })} />
              <Sel label="ln K_p from" value={S.lnSrc} onChange={(v) => set({ lnSrc: v })} options={[{ v: 'calc', t: 'Gibbs data at T (matches Table A-28)' }, { v: 'manual', t: 'Typed value (e.g. read from the table)' }]} />
              {S.lnSrc === 'manual' && <Num label="ln K_p" value={S.lnMan} onChange={(v) => set({ lnMan: v })} />}
            </Group>
          </div>
        }
        right={
          <div>
            {err && <CalcAlert>{err}</CalcAlert>}
            {comp}
            <Plot x={[298.15, 6000]} y={[ylo, yhi]} height={260} xLabel="T (K)" yLabel={`ln K_p  (${rx.label})`} series={[{ points: curve, color: 'var(--c1)' }]} vlines={Number.isFinite(S.T) && S.T >= 298.15 && S.T <= 6000 ? [{ x: S.T, color: 'var(--c2)', label: `${f(S.T)} K` }] : []} hlines={[{ y: 0, color: 'var(--muted)' }]} legend={false} />
            <Group title="van ’t Hoff: h̄_R from two K_p values">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Num label="T₁ (K)" value={S.vT1} onChange={(v) => set({ vT1: v })} />
                <Num label="ln K_p at T₁" value={S.vL1} onChange={(v) => set({ vL1: v })} />
                <Num label="T₂ (K)" value={S.vT2} onChange={(v) => set({ vT2: v })} />
                <Num label="ln K_p at T₂" value={S.vL2} onChange={(v) => set({ vL2: v })} />
              </div>
              <button className="btn" onClick={() => S.vT1 >= 200 && S.vT2 <= 6000 && set({ vL1: Math.round(lnKp(rx, S.vT1) * 1e3) / 1e3, vL2: Math.round(lnKp(rx, S.vT2) * 1e3) / 1e3 })}>
                fill ln K_p from the selected reaction
              </button>
              {vh}
              <Note>ln(K₂/K₁) = −(h̄_R/R_u)(1/T₂ − 1/T₁) with R_u = 8.314 kJ/kmol·K.</Note>
            </Group>
          </div>
        }
      />
    </div>
  );
}

/* ====================================================================== 8. NozzleCalc */
type NMode = 'Ma' | 'V' | 'T' | 'P' | 'Asub' | 'Asup';
const NZ_DEF = {
  k: 1.4, R: 0.287, mode: 'Ma' as NMode, val: 0.5,
  refBy: 'stag' as 'stag' | 'static', Tref: 500, Pref: 800, A: 0,
  sec2: false, T2: 400, AeAs: 2,
};
const GASES: [string, number, number][] = [['Air', 1.4, 0.287], ['CO₂', 1.289, 0.1889], ['Helium', 1.667, 2.0769], ['Steam', 1.3, 0.4615], ['Methane', 1.3, 0.5182], ['Argon', 1.667, 0.2081]];
const machOfTau = (tau: number, k: number) => Math.sqrt((2 / (k - 1)) * (1 / tau - 1));

export function NozzleCalc() {
  const [S, set, load] = useForm(NZ_DEF);
  const k = S.k;
  const R = S.R;
  let err: string | null = null;
  let res: ReactNode = null;
  let Ma = NaN;
  try {
    err = first(!(k > 1) ? 'k must exceed 1.' : null, !(R > 0) ? 'R must be positive.' : null, !(S.Tref > 0) || !(S.Pref > 0) ? 'Reference T and P must be positive.' : null);
    if (!err) {
      const v = S.val;
      if (S.mode === 'Ma') {
        if (!(v >= 0)) err = 'Mach number must be ≥ 0.';
        Ma = v;
      } else if (S.mode === 'V') {
        if (!(v >= 0)) err = 'Velocity must be ≥ 0.';
        else if (S.refBy === 'static') Ma = v / Math.sqrt(k * R * 1000 * S.Tref);
        else {
          const tau = 1 - (v * v * (k - 1)) / (2000 * k * R * S.Tref);
          if (!(tau > 0)) err = `${OOR}: V exceeds the maximum speed √(2 c_p T₀) = ${f(Math.sqrt((2000 * k * R * S.Tref) / (k - 1)))} m/s for this T₀.`;
          else Ma = machOfTau(tau, k);
        }
      } else if (S.mode === 'T') {
        if (!(v > 0 && v <= 1)) err = 'T/T₀ must be in (0, 1].';
        else Ma = machOfTau(v, k);
      } else if (S.mode === 'P') {
        if (!(v > 0 && v <= 1)) err = 'P/P₀ must be in (0, 1].';
        else Ma = machOfTau(Math.pow(v, (k - 1) / k), k);
      } else {
        if (!(v >= 1)) err = 'A/A* must be at least 1.';
        else {
          const sub = machFromAreaRatio(v, k, 'sub');
          const sup = machFromAreaRatio(v, k, 'sup');
          if (!Number.isFinite(sub) || !Number.isFinite(sup)) err = `${OOR}: A/A* = ${f(v)} is beyond the solver range (Ma ≤ 60).`;
          else {
            Ma = S.mode === 'Asub' ? sub : sup;
          }
        }
      }
      if (!err && !Number.isFinite(Ma)) err = 'No solution for that input.';
    }
    if (!err) {
      const tauR = 1 / T0_T(Ma, k); // T/T0
      const pR = 1 / P0_P(Ma, k);
      const rR = 1 / rho0_rho(Ma, k);
      const AR = Ma > 0 ? areaRatio(Ma, k) : Infinity;
      const c = critical(k);
      const br: [number, number] | null = Number.isFinite(AR) && AR > 1 + 1e-9 ? [machFromAreaRatio(AR, k, 'sub'), machFromAreaRatio(AR, k, 'sup')] : null;
      const T0 = S.refBy === 'stag' ? S.Tref : S.Tref / tauR;
      const P0 = S.refBy === 'stag' ? S.Pref : S.Pref / pR;
      const T = T0 * tauR;
      const P = P0 * pR;
      const rho = P / (R * T);
      const a = Math.sqrt(k * R * 1000 * T);
      const V = Ma * a;
      const Ts = T0 * c.T;
      const Ps = P0 * c.P;
      const rhos = Ps / (R * Ts);
      const as = Math.sqrt(k * R * 1000 * Ts);
      const Aareas = S.A > 0 ? S.A / 1e4 : NaN;
      const Astar = Aareas / AR;
      const mdot = rho * V * Aareas;
      const flux = rhos * as; // kg/s/m2 at the throat
      // second section
      let sec: ReactNode = null;
      if (S.sec2) {
        if (!(S.T2 > 0 && S.T2 <= T0)) sec = <CalcAlert>Second-section T must be positive and not exceed T₀ = {f(T0)} K.</CalcAlert>;
        else {
          const Ma2 = machOfTau(S.T2 / T0, k);
          const V2 = Ma2 * Math.sqrt(k * R * 1000 * S.T2);
          sec = (
            <Readout
              items={[
                ['Second section: Ma₂', f(Ma2, 4)],
                ['V₂', `${f(V2)} m/s`],
                ['P₂', `${f(P0 * Math.pow(S.T2 / T0, k / (k - 1)))} kPa`],
                ['A₂/A*', f(areaRatio(Ma2, k), 4)],
              ]}
            />
          );
        }
      }
      // converging-diverging design values
      let cd: ReactNode = null;
      if (S.AeAs >= 1) {
        const sub = machFromAreaRatio(S.AeAs, k, 'sub');
        const sup = machFromAreaRatio(S.AeAs, k, 'sup');
        if (Number.isFinite(sub) && Number.isFinite(sup)) {
          const pSub = 1 / P0_P(sub, k);
          const pSup = 1 / P0_P(sup, k);
          const pShock = pSup * (1 + ((2 * k) / (k + 1)) * (sup * sup - 1));
          cd = (
            <Tbl
              head={[`C–D nozzle, A_e/A* = ${f(S.AeAs)}`, 'Ma_e', 'P_b/P₀']}
              rows={[
                ['1st critical: isentropic, subsonic diffuser, M = 1 at throat', f(sub, 4), f(pSub, 4)],
                ['3rd critical: normal shock at the exit plane', f(sup, 4) + ' → shock', f(pShock, 4)],
                ['Design: isentropic supersonic exit (no shocks)', f(sup, 4), f(pSup, 4)],
              ]}
            />
          );
        }
      }
      res = (
        <>
          <Readout
            items={[
              ['Mach number', f(Ma, 5)],
              ['T/T₀', f(tauR, 5)],
              ['P/P₀', f(pR, 5)],
              ['ρ/ρ₀', f(rR, 5)],
              ['A/A*', Number.isFinite(AR) ? f(AR, 5) : '∞ (stagnant)'],
              ['A*/A', Number.isFinite(AR) ? f(1 / AR, 5) : '0'],
              ['Same A/A*: both Mach numbers', br && br.every(Number.isFinite) ? `sub ${f(br[0], 4)}, sup ${f(br[1], 4)}` : Ma === 1 ? 'both 1 (throat)' : '—'],
            ]}
          />
          <Readout
            items={[
              ['T₀', `${f(T0)} K`],
              ['P₀', `${f(P0)} kPa`],
              ['T', `${f(T)} K`],
              ['P', `${f(P)} kPa`],
              ['ρ', `${f(rho)} kg/m³`],
              ['Speed of sound a', `${f(a)} m/s`],
              ['Velocity V', `${f(V)} m/s`],
              ['T* (Ma = 1)', `${f(Ts)} K`],
              ['P*', `${f(Ps)} kPa`],
              ['ρ*', `${f(rhos)} kg/m³`],
              ['V* = a*', `${f(as)} m/s`],
              ['Choked mass flux ρ*V*', `${f(flux)} kg/s·m²`],
              ...(Number.isFinite(Aareas) ? ([['A* (throat for this flow)', `${f(Astar * 1e4)} cm²`], ['ṁ = ρVA (= choked ṁ)', `${f(mdot)} kg/s`], ['Choked ṁ_max = ρ*V*A*', `${f(flux * Astar)} kg/s`]] as [string, string][]) : []),
            ]}
          />
          {sec}
          {cd}
        </>
      );
    }
  } catch (e) {
    err = errMsg(e);
    res = null;
  }
  const Mas = Array.from({ length: 121 }, (_, i) => 0.02 + (i * 2.98) / 120);
  const curves: Series[] = [
    { label: 'T/T₀', points: Mas.map((m) => ({ x: m, y: 1 / T0_T(m, k) })), color: 'var(--c1)' },
    { label: 'P/P₀', points: Mas.map((m) => ({ x: m, y: 1 / P0_P(m, k) })), color: 'var(--c2)' },
    { label: 'ρ/ρ₀', points: Mas.map((m) => ({ x: m, y: 1 / rho0_rho(m, k) })), color: 'var(--c3)', dash: true },
    { label: 'A/A*', points: Mas.map((m) => ({ x: m, y: areaRatio(m, k) })), color: 'var(--c4)' },
  ];
  const modeOpts: { v: NMode; t: string }[] = [
    { v: 'Ma', t: 'Mach number' },
    { v: 'V', t: 'Velocity V (m/s)' },
    { v: 'T', t: 'T/T₀' },
    { v: 'P', t: 'P/P₀' },
    { v: 'Asub', t: 'A/A* — subsonic branch' },
    { v: 'Asup', t: 'A/A* — supersonic branch' },
  ];
  const valLabel = { Ma: 'Mach number', V: 'Velocity (m/s)', T: 'T/T₀', P: 'P/P₀', Asub: 'A/A* (≥ 1)', Asup: 'A/A* (≥ 1)' }[S.mode];
  return (
    <div>
      <PresetBar
        items={[
          ['17-62: air, 420 K, 500 kPa, 110 m/s → T* 355 K, A*/A 0.443', () => load({ k: 1.4, R: 0.287, mode: 'V', val: 110, refBy: 'static', Tref: 420, Pref: 500, A: 0, sec2: false })],
          ['17-18: CO₂ 800 K, 50 m/s → Ma₂ = 2.64 at 400 K', () => load({ k: 1.289, R: 0.1889, mode: 'V', val: 50, refBy: 'static', Tref: 800, Pref: 1000, A: 0, sec2: true, T2: 400 })],
        ]}
      />
      <Two
        left={
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0' }}>
              {GASES.map(([n, kk, RR]) => (
                <button key={n} className="btn" onClick={() => set({ k: kk, R: RR })}>
                  {n}
                </button>
              ))}
            </div>
            <Num label="Specific-heat ratio k" value={S.k} onChange={(v) => set({ k: v })} step={0.01} />
            <Num label="Gas constant R" unit="kJ/kg·K" value={S.R} onChange={(v) => set({ R: v })} />
            <Group title="Enter any one">
              <Sel value={S.mode} onChange={(mode) => set({ mode, val: mode === 'Ma' ? 0.5 : mode === 'V' ? 100 : mode === 'T' || mode === 'P' ? 0.9 : 2 })} options={modeOpts} />
              <Num label={valLabel} value={S.val} onChange={(v) => set({ val: v })} />
            </Group>
            <Group title="Reference state">
              <Sel value={S.refBy} onChange={(v) => set({ refBy: v })} options={[{ v: 'stag', t: 'Stagnation T₀, P₀ known' }, { v: 'static', t: 'Static T, P known at this section' }]} />
              <Num label={S.refBy === 'stag' ? 'T₀' : 'T (static)'} unit="K" value={S.Tref} onChange={(v) => set({ Tref: v })} />
              <Num label={S.refBy === 'stag' ? 'P₀' : 'P (static)'} unit="kPa" value={S.Pref} onChange={(v) => set({ Pref: v })} />
              <Num label="Area at this section (0 = skip)" unit="cm²" value={S.A} onChange={(v) => set({ A: v })} />
            </Group>
            <Check label="Second section at a known static T" checked={S.sec2} onChange={(v) => set({ sec2: v })} />
            {S.sec2 && <Num label="Static T₂" unit="K" value={S.T2} onChange={(v) => set({ T2: v })} />}
            <Num label="C–D nozzle: A_e/A*" value={S.AeAs} onChange={(v) => set({ AeAs: v })} />
          </div>
        }
        right={
          <div>
            {err && <CalcAlert>{err}</CalcAlert>}
            {res}
            <Plot x={[0, 3]} y={[0, 3]} height={290} xLabel="Mach number" yLabel="isentropic ratios (A/A* clipped at 3)" series={curves} vlines={Number.isFinite(Ma) && Ma <= 3 ? [{ x: Ma, label: `Ma ${f(Ma, 3)}`, color: 'var(--text)' }] : []} legend />
          </div>
        }
      />
    </div>
  );
}
