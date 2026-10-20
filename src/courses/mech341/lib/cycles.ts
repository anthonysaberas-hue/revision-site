/**
 * Power cycles: Brayton (gas turbine), turbojet (stagnation-based, Habashi's exam layout), Rankine family.
 * Constant specific heats unless noted ("cold-air standard"); variable-cp air uses the A-17 table in gas.ts.
 */
import { airTable } from './gas';
import { water, State } from './props';

/* ======================================================================= Brayton */
export interface BraytonIn {
  T1: number; // K
  P1?: number; // kPa
  rp: number;
  T3: number; // K turbine inlet
  etaC?: number;
  etaT?: number;
  cp?: number;
  k?: number;
  regen?: number; // regenerator effectiveness 0..1 (0 = none)
}
export function brayton(i: BraytonIn) {
  const cp = i.cp ?? 1.005;
  const k = i.k ?? 1.4;
  const eC = i.etaC ?? 1;
  const eT = i.etaT ?? 1;
  const c = Math.pow(i.rp, (k - 1) / k);
  const T2s = i.T1 * c;
  const T2 = i.T1 + (T2s - i.T1) / eC;
  const T4s = i.T3 / c;
  const T4 = i.T3 - eT * (i.T3 - T4s);
  const wc = cp * (T2 - i.T1);
  const wt = cp * (i.T3 - T4);
  const eps = i.regen ?? 0;
  const T5 = T2 + eps * (T4 - T2); // air leaving the regenerator (cold side)
  const T6 = T4 - (T5 - T2); // gas leaving the regenerator (hot side)
  const qin = cp * (i.T3 - T5);
  const wnet = wt - wc;
  return { T2s, T2, T4s, T4, T5, T6, wc, wt, wnet, qin, qout: qin - wnet, eta: wnet / qin, rbw: wc / wt, etaIdeal: 1 - 1 / c };
}
/** Brayton with variable specific heats (air table, Pr method) */
export function braytonVariable(i: { T1: number; rp: number; T3: number; etaC?: number; etaT?: number; regen?: number }) {
  const h1 = airTable.h(i.T1);
  const h2s = airTable.h(airTable.T_Pr(airTable.Pr(i.T1) * i.rp));
  const h2 = h1 + (h2s - h1) / (i.etaC ?? 1);
  const h3 = airTable.h(i.T3);
  const h4s = airTable.h(airTable.T_Pr(airTable.Pr(i.T3) / i.rp));
  const h4 = h3 - (i.etaT ?? 1) * (h3 - h4s);
  const wc = h2 - h1;
  const wt = h3 - h4;
  const qreg = (i.regen ?? 0) * (h4 - h2);
  const qin = h3 - h2 - qreg;
  return { h1, h2s, h2, h3, h4s, h4, wc, wt, wnet: wt - wc, qin, eta: (wt - wc) / qin, rbw: wc / wt, T2: airTable.T_h(h2), T4: airTable.T_h(h4) };
}
/** optimum pressure ratio for maximum net work of the ideal cycle */
export const rpMaxWork = (T1: number, T3: number, k = 1.4) => Math.pow(T3 / T1, k / (2 * (k - 1)));

/* ======================================================================= Turbojet */
export interface TurbojetIn {
  Ta: number; // ambient static T, K
  Pa: number; // ambient static P, kPa
  V: number; // flight speed m/s
  mdot: number; // air kg/s
  rc: number; // compressor stagnation pressure ratio
  T04: number; // turbine inlet stagnation T, K
  etaD?: number; // diffuser (isentropic) efficiency
  etaC?: number;
  etaT?: number;
  etaN?: number;
  f?: number; // fuel/air ratio (if given); otherwise computed from QHV when provided
  QHV?: number; // kJ/kg
  cpa?: number;
  ka?: number;
  cpg?: number;
  kg?: number;
  nozzle?: 'CD' | 'C'; // CD: expands to Pa; C: converging (chokes if possible)
  /** include the fuel mass in the turbine/nozzle flow (default: no — per kg air, as on the exams) */
  fuelMassInTurbine?: boolean;
}
export function turbojet(i: TurbojetIn) {
  const cpa = i.cpa ?? 1.005;
  const ka = i.ka ?? 1.4;
  const cpg = i.cpg ?? cpa;
  const kg = i.kg ?? ka;
  const R = 0.287;
  const a = Math.sqrt(ka * R * 1000 * i.Ta);
  const Ma = i.V / a;
  // 1 → 2 intake/diffuser: total temperature conserved
  const T01 = i.Ta + (i.V * i.V) / (2000 * cpa);
  const P01 = i.Pa * Math.pow(T01 / i.Ta, ka / (ka - 1));
  const T02 = T01;
  const T02s = i.Ta + (i.etaD ?? 1) * (T01 - i.Ta);
  const P02 = i.Pa * Math.pow(T02s / i.Ta, ka / (ka - 1));
  // 2 → 3 compressor
  const P03 = i.rc * P02;
  const T03s = T02 * Math.pow(i.rc, (ka - 1) / ka);
  const T03 = T02 + (T03s - T02) / (i.etaC ?? 1);
  const wc = cpa * (T03 - T02);
  // 3 → 4 burner (constant stagnation pressure)
  const f = i.f ?? (i.QHV ? (cpg * i.T04 - cpa * T03) / (i.QHV - cpg * i.T04) : 0);
  const P04 = P03;
  const mg = i.fuelMassInTurbine ? i.mdot * (1 + f) : i.mdot;
  // 4 → 5 turbine drives the compressor
  const T05 = i.T04 - (i.mdot * wc) / (mg * cpg);
  const T05s = i.T04 - (i.T04 - T05) / (i.etaT ?? 1);
  const P05 = P04 * Math.pow(T05s / i.T04, kg / (kg - 1));
  // 5 → 6 nozzle
  let Pe = i.Pa;
  let choked = false;
  const Pcrit = P05 * Math.pow(2 / (kg + 1), kg / (kg - 1));
  if (i.nozzle === 'C' && Pcrit > i.Pa) {
    Pe = Pcrit;
    choked = true;
  }
  const Tes = T05 * Math.pow(Pe / P05, (kg - 1) / kg);
  const Te = T05 - (i.etaN ?? 1) * (T05 - Tes);
  const Ve = Math.sqrt(2000 * cpg * (T05 - Te));
  const mExit = i.mdot * (1 + f);
  const rhoE = Pe / (0.287 * Te);
  const Ae = mExit / (rhoE * Ve);
  const Fmom = mExit * Ve - i.mdot * i.V; // N
  const Fpres = (Pe - i.Pa) * 1000 * Ae;
  const F = Fmom + Fpres;
  const Wp = F * i.V / 1000; // propulsive power kW
  const Qin = i.mdot * f * (i.QHV ?? 0);
  return {
    a, Ma, T01, P01, ramRatio: P01 / i.Pa, T02, P02, T03s, T03, P03, wc, Wc: i.mdot * wc, f, P04, T05, T05s, P05,
    Pcrit, Pe, choked, Te, Ve, Ae, Fmom, Fpres, F, Wp, Qin, etaP: Qin > 0 ? Wp / Qin : NaN, TSFC: (i.mdot * f) / F,
  };
}

/* ======================================================================= Rankine family */
export interface RankineIn {
  Pb: number; // boiler pressure kPa
  Tb: number; // turbine inlet T °C
  Pc: number; // condenser pressure kPa
  etaT?: number;
  etaP?: number;
  reheat?: { P: number; T: number };
  ofwh?: { P: number }; // one open feedwater heater
  cfwh?: { P: number; drain: 'back' | 'forward' }; // one closed FWH: drain throttled back to the condenser, or pumped forward
  mdot?: number;
  Wnet?: number; // kW, alternative to mdot
}
export interface RankineOut {
  states: Record<string, State & { label: string }>;
  y: number; // bled fraction (OFWH or CFWH)
  wT: number;
  wP: number;
  qin: number;
  qout: number;
  wnet: number;
  eta: number;
  mdot: number;
  x_exit: number;
  bwr: number;
}
/** expansion through a turbine stage with efficiency */
function expand(s1: State, P2: number, eta: number) {
  const s2s = water.Ps(P2, s1.s);
  const h2 = s1.h - eta * (s1.h - s2s.h);
  return water.Ph(P2, h2);
}
function pump(s1: State, P2: number, eta: number) {
  const w = (s1.v * (P2 - s1.P)) / eta;
  return { st: water.Ph(P2, s1.h + w), w };
}
export function rankine(i: RankineIn): RankineOut {
  const eT = i.etaT ?? 1;
  const eP = i.etaP ?? 1;
  const L = (st: State, label: string) => ({ ...st, label });
  const S: Record<string, State & { label: string }> = {};
  const inlet = water.PT(i.Pb, i.Tb);
  S.turbineIn = L(inlet, 'turbine inlet');
  // high-pressure expansion (to reheat P or straight)
  let wT = 0;
  let qin = 0;
  let y = 0;
  const bleedP = i.ofwh?.P ?? i.cfwh?.P;
  // build the expansion line: inlet -> (bleed) -> (reheat) -> condenser; reheat is assumed above the bleed if both
  const line: { P: number; st: State }[] = [];
  let cur = inlet;
  const stops = [i.reheat?.P, bleedP].filter((p): p is number => p !== undefined).sort((a, b) => b - a);
  let fracAfter = 1;
  const bleedAt: Record<number, State> = {};
  for (const P of stops) {
    const out = expand(cur, P, eT);
    line.push({ P, st: out });
    cur = out;
    if (i.reheat && P === i.reheat.P) {
      S.reheatIn = L(out, 'to reheater');
      const rh = water.PT(P, i.reheat.T);
      S.reheatOut = L(rh, 'reheater exit');
      cur = rh;
    }
    if (P === bleedP) bleedAt[P] = out;
  }
  const exit = expand(cur, i.Pc, eT);
  S.turbineExit = L(exit, 'turbine exit');
  const s1 = water.Px(i.Pc, 0);
  S.condExit = L(s1, 'condenser exit (sat. liquid)');
  let wP = 0;
  let boilerIn: State;
  if (i.ofwh) {
    const p1 = pump(s1, i.ofwh.P, eP);
    S.pump1Exit = L(p1.st, 'pump I exit');
    const s3 = water.Px(i.ofwh.P, 0);
    S.fwhExit = L(s3, 'OFWH exit (sat. liquid)');
    const sb = bleedAt[i.ofwh.P];
    S.bleed = L(sb, 'bled steam');
    y = (s3.h - p1.st.h) / (sb.h - p1.st.h);
    const p2 = pump(s3, i.Pb, eP);
    S.pump2Exit = L(p2.st, 'pump II exit');
    wP = (1 - y) * p1.w + p2.w;
    boilerIn = p2.st;
  } else if (i.cfwh) {
    const p1 = pump(s1, i.Pb, eP);
    S.pump1Exit = L(p1.st, 'main pump exit');
    const sb = bleedAt[i.cfwh.P];
    S.bleed = L(sb, 'bled steam');
    const drain = water.Px(i.cfwh.P, 0);
    S.drain = L(drain, 'CFWH drain (sat. liquid at bleed P)');
    // feedwater leaves at the drain temperature (ideal CFWH)
    const fw = water.PT(i.Pb, drain.T);
    S.fwhExit = L(fw, 'feedwater leaving CFWH (T = Tsat of bleed)');
    if (i.cfwh.drain === 'back') {
      y = (fw.h - p1.st.h) / (sb.h - drain.h);
      wP = p1.w;
      boilerIn = fw;
    } else {
      // drain pumped forward into the feedwater line and mixed
      const pd = pump(drain, i.Pb, eP);
      S.drainPump = L(pd.st, 'drain pump exit');
      y = (fw.h - p1.st.h) / (sb.h - drain.h + fw.h - p1.st.h);
      // energy balance on the heater: (1-y)(fw - p1) = y (sb - drain)
      const hmix = (1 - y) * fw.h + y * pd.st.h;
      boilerIn = water.Ph(i.Pb, hmix);
      S.mix = L(boilerIn, 'mixing chamber exit');
      wP = (1 - y) * p1.w + y * pd.w;
    }
  } else {
    const p1 = pump(s1, i.Pb, eP);
    S.pump1Exit = L(p1.st, 'pump exit');
    wP = p1.w;
    boilerIn = p1.st;
  }
  // turbine work: full flow down to the bleed, (1-y) after
  {
    let h = inlet.h;
    let frac = 1;
    let reheated = false;
    for (const { P, st } of line) {
      wT += frac * (h - st.h);
      if (i.reheat && P === i.reheat.P && !reheated) {
        h = water.PT(P, i.reheat.T).h;
        qin += frac * (h - st.h);
        reheated = true;
      } else h = st.h;
      if (P === bleedP) frac = 1 - y;
    }
    wT += frac * (h - exit.h);
    fracAfter = frac;
  }
  qin += inlet.h - boilerIn.h;
  const qout = i.cfwh?.drain === 'back' ? fracAfter * (exit.h - s1.h) + y * (S.drain.h - s1.h) : fracAfter * (exit.h - s1.h);
  const wnet = wT - wP;
  const mdot = i.mdot ?? (i.Wnet ? i.Wnet / wnet : 1);
  return { states: S, y, wT, wP, qin, qout, wnet, eta: wnet / qin, mdot, x_exit: exit.x ?? NaN, bwr: wP / wT };
}
