/**
 * Ideal gases: air table (Çengel A-17 conventions), molar tables for combustion gases (A-18…A-25 form),
 * formation data (A-26), heating values (A-27, computed), equilibrium constants (A-28, computed from ḡ).
 * Molar data: NASA 9-coefficient polynomials (JANAF-consistent), 200–6000 K.
 */
import { GAS, AIRT, AIR_M } from './data/gases';
import { solve } from './props';

export const Ru = 8.314; // kJ/kmol·K
export const Rair = 0.287; // kJ/kg·K (exam value)
export const cpAir = 1.005;
export const kAir = 1.4;
export const MAIR = AIR_M;

function interp(xs: number[], ys: number[], x: number) {
  let i = 0;
  if (x <= xs[0]) i = 0;
  else if (x >= xs[xs.length - 1]) i = xs.length - 2;
  else {
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (xs[m] <= x) lo = m;
      else hi = m;
    }
    i = lo;
  }
  return ys[i] + ((ys[i + 1] - ys[i]) * (x - xs[i])) / (xs[i + 1] - xs[i]);
}

/* ------------------------------------------------------------------ air (per kg) */
export const airTable = {
  h: (T: number) => interp(AIRT.T, AIRT.h, T),
  u: (T: number) => interp(AIRT.T, AIRT.u, T),
  s0: (T: number) => interp(AIRT.T, AIRT.s0, T),
  /** relative pressure: interpolate ln Pr (it is exponential in s°) */
  Pr: (T: number) => Math.exp(interp(AIRT.T, AIRT.Pr.map(Math.log), T)),
  vr: (T: number) => Math.exp(interp(AIRT.T, AIRT.vr.map(Math.log), T)),
  T_h: (h: number) => interp(AIRT.h, AIRT.T, h),
  T_u: (u: number) => interp(AIRT.u, AIRT.T, u),
  T_Pr: (Pr: number) => interp(AIRT.Pr.map(Math.log), AIRT.T, Math.log(Pr)),
};
/** isentropic exit temperature with variable specific heats: Pr2 = Pr1 · (P2/P1) */
export const airIsentropicT = (T1: number, Pratio: number) => airTable.T_Pr(airTable.Pr(T1) * Pratio);

/* ------------------------------------------------------------------ molar ideal gases */
export type Sp = 'N2' | 'O2' | 'CO2' | 'CO' | 'H2O' | 'H2' | 'O' | 'OH' | 'NO' | 'N' | 'H' | 'Ar';
type GasRec = { h298: number; dh: number[]; s0: number[] };
const G = GAS as unknown as { T: number[] } & Record<Sp, GasRec>;

/** Çengel prints h̄ referenced so that h̄(298 K) = these values (A-18…A-25). Used only to show "table" numbers. */
export const H298_TABLE: Partial<Record<Sp, number>> = { N2: 8669, O2: 8682, CO2: 9364, CO: 8669, H2O: 9904, H2: 8468, O: 6852, OH: 9188, NO: 9192, N: 6197 };
/** Δh̄ = h̄(T) − h̄(298 K), kJ/kmol (sensible enthalpy) */
export const dh = (sp: Sp, T: number) => interp(G.T, G[sp].dh, T);
/** h̄ as printed in the textbook tables: Δh̄ + h̄(298) */
export const hTable = (sp: Sp, T: number) => dh(sp, T) + (H298_TABLE[sp] ?? 0);
/** absolute entropy at 1 atm, kJ/kmol·K */
export const s0 = (sp: Sp, T: number) => interp(G.T, G[sp].s0, T);

/* ------------------------------------------------------------------ formation data (A-26), kJ/kmol */
export interface Species {
  name: string;
  formula: string;
  M: number;
  hf: number;
  gf?: number;
  s0?: number;
  C?: number;
  H?: number;
  O?: number;
  N?: number;
  S?: number;
  hfg?: number; // kJ/kg at 25 °C for liquids
}
export const SPECIES: Record<string, Species> = {
  C: { name: 'Carbon', formula: 'C(s)', M: 12.011, hf: 0, gf: 0, s0: 5.74, C: 1 },
  H2: { name: 'Hydrogen', formula: 'H₂', M: 2.016, hf: 0, gf: 0, s0: 130.68, H: 2 },
  N2: { name: 'Nitrogen', formula: 'N₂', M: 28.013, hf: 0, gf: 0, s0: 191.61, N: 2 },
  O2: { name: 'Oxygen', formula: 'O₂', M: 31.999, hf: 0, gf: 0, s0: 205.04, O: 2 },
  CO: { name: 'Carbon monoxide', formula: 'CO', M: 28.011, hf: -110530, gf: -137150, s0: 197.65, C: 1, O: 1 },
  CO2: { name: 'Carbon dioxide', formula: 'CO₂', M: 44.01, hf: -393520, gf: -394360, s0: 213.8, C: 1, O: 2 },
  H2Og: { name: 'Water vapor', formula: 'H₂O(g)', M: 18.015, hf: -241820, gf: -228590, s0: 188.83, H: 2, O: 1 },
  H2Ol: { name: 'Water (liquid)', formula: 'H₂O(l)', M: 18.015, hf: -285830, gf: -237180, s0: 69.92, H: 2, O: 1 },
  CH4: { name: 'Methane', formula: 'CH₄', M: 16.043, hf: -74850, gf: -50790, s0: 186.16, C: 1, H: 4 },
  C2H2: { name: 'Acetylene', formula: 'C₂H₂', M: 26.038, hf: 226730, gf: 209170, s0: 200.85, C: 2, H: 2 },
  C2H4: { name: 'Ethylene', formula: 'C₂H₄', M: 28.054, hf: 52280, gf: 68120, s0: 219.83, C: 2, H: 4 },
  C2H6: { name: 'Ethane', formula: 'C₂H₆', M: 30.07, hf: -84680, gf: -32890, s0: 229.49, C: 2, H: 6 },
  C3H6: { name: 'Propylene', formula: 'C₃H₆', M: 42.081, hf: 20410, gf: 62720, s0: 266.94, C: 3, H: 6 },
  C3H8: { name: 'Propane', formula: 'C₃H₈', M: 44.097, hf: -103850, gf: -23490, s0: 269.91, C: 3, H: 8, hfg: 335 },
  C4H10: { name: 'n-Butane', formula: 'C₄H₁₀', M: 58.123, hf: -126150, gf: -15710, s0: 310.12, C: 4, H: 10, hfg: 362 },
  C8H18g: { name: 'n-Octane (gas)', formula: 'C₈H₁₈(g)', M: 114.231, hf: -208450, gf: 16530, s0: 466.73, C: 8, H: 18 },
  C8H18l: { name: 'n-Octane (liquid)', formula: 'C₈H₁₈(l)', M: 114.231, hf: -249950, gf: 6610, s0: 360.79, C: 8, H: 18, hfg: 363 },
  C12H26g: { name: 'n-Dodecane (gas)', formula: 'C₁₂H₂₆(g)', M: 170.338, hf: -291010, gf: 50150, s0: 622.83, C: 12, H: 26 },
  C6H6g: { name: 'Benzene (gas)', formula: 'C₆H₆(g)', M: 78.114, hf: 82930, gf: 129660, s0: 269.2, C: 6, H: 6 },
  CH3OHg: { name: 'Methyl alcohol (gas)', formula: 'CH₃OH(g)', M: 32.042, hf: -200670, gf: -162000, s0: 239.7, C: 1, H: 4, O: 1 },
  CH3OHl: { name: 'Methyl alcohol (liquid)', formula: 'CH₃OH(l)', M: 32.042, hf: -238660, gf: -166360, s0: 126.8, C: 1, H: 4, O: 1, hfg: 1168 },
  C2H5OHg: { name: 'Ethyl alcohol (gas)', formula: 'C₂H₅OH(g)', M: 46.069, hf: -235310, gf: -168570, s0: 282.59, C: 2, H: 6, O: 1 },
  C2H5OHl: { name: 'Ethyl alcohol (liquid)', formula: 'C₂H₅OH(l)', M: 46.069, hf: -277690, gf: -174890, s0: 160.7, C: 2, H: 6, O: 1, hfg: 919 },
  C10H22: { name: 'Decane (jet fuel, exam value)', formula: 'C₁₀H₂₂', M: 142.29, hf: -300000, C: 10, H: 22 },
  O: { name: 'Oxygen atom', formula: 'O', M: 16, hf: 249190, gf: 231770, s0: 161.06, O: 1 },
  H: { name: 'Hydrogen atom', formula: 'H', M: 1.008, hf: 218000, gf: 203290, s0: 114.72, H: 1 },
  N: { name: 'Nitrogen atom', formula: 'N', M: 14.007, hf: 472650, gf: 455510, s0: 153.3, N: 1 },
  OH: { name: 'Hydroxyl', formula: 'OH', M: 17.007, hf: 39460, gf: 34280, s0: 183.7, O: 1, H: 1 },
  NO: { name: 'Nitric oxide', formula: 'NO', M: 30.006, hf: 90290, gf: 86600, s0: 210.76, N: 1, O: 1 },
};
export const HF: Record<Sp, number> = { N2: 0, O2: 0, CO2: -393520, CO: -110530, H2O: -241820, H2: 0, O: 249190, OH: 39460, NO: 90290, N: 472650, H: 218000, Ar: 0 };

/** total enthalpy of a gas species, h̄f° + (h̄ − h̄°), kJ/kmol */
export const hbar = (sp: Sp, T: number) => HF[sp] + dh(sp, T);

/** enthalpy of vaporization of water at 25 °C (kJ/kg); LHV/HHV differ by N_H2O·M·hfg */
export const HFG_WATER_25 = 2441.7;

/** heating values of a CxHy(Oz) fuel per kg (computed from formation enthalpies, products at 25 °C) */
export function heatingValues(fuel: Species) {
  const C = fuel.C ?? 0;
  const H = fuel.H ?? 0;
  const hc = (waterLiquid: boolean) => C * SPECIES.CO2.hf + (H / 2) * (waterLiquid ? SPECIES.H2Ol.hf : SPECIES.H2Og.hf) - fuel.hf;
  return { HHV: -hc(true) / fuel.M, LHV: -hc(false) / fuel.M, hcHHVmolar: hc(true), hcLHVmolar: hc(false) };
}

/* ------------------------------------------------------------------ equilibrium constants */
/** ḡ(T) of a species at 1 atm from the polynomial data (absolute, consistent with HF) */
const gbar = (sp: Sp, T: number) => hbar(sp, T) - T * s0(sp, T);
export type Reaction = { label: string; reac: [number, Sp][]; prod: [number, Sp][] };
/** the eight reactions of Çengel Table A-28 */
export const A28: Reaction[] = [
  { label: 'H₂ ⇌ 2H', reac: [[1, 'H2']], prod: [[2, 'H']] },
  { label: 'O₂ ⇌ 2O', reac: [[1, 'O2']], prod: [[2, 'O']] },
  { label: 'N₂ ⇌ 2N', reac: [[1, 'N2']], prod: [[2, 'N']] },
  { label: 'H₂O ⇌ H₂ + ½O₂', reac: [[1, 'H2O']], prod: [[1, 'H2'], [0.5, 'O2']] },
  { label: 'H₂O ⇌ ½H₂ + OH', reac: [[1, 'H2O']], prod: [[0.5, 'H2'], [1, 'OH']] },
  { label: 'CO₂ ⇌ CO + ½O₂', reac: [[1, 'CO2']], prod: [[1, 'CO'], [0.5, 'O2']] },
  { label: '½N₂ + ½O₂ ⇌ NO', reac: [[0.5, 'N2'], [0.5, 'O2']], prod: [[1, 'NO']] },
];
/** ln Kp(T) = −ΔG°(T)/(Ru T) for a reaction (P0 = 1 atm) */
export function lnKp(rx: Reaction, T: number) {
  const dG = rx.prod.reduce((a, [n, sp]) => a + n * gbar(sp, T), 0) - rx.reac.reduce((a, [n, sp]) => a + n * gbar(sp, T), 0);
  return -dG / (Ru * T);
}
/** enthalpy of reaction h̄R(T) from the tables */
export function hR(rx: Reaction, T: number) {
  return rx.prod.reduce((a, [n, sp]) => a + n * hbar(sp, T), 0) - rx.reac.reduce((a, [n, sp]) => a + n * hbar(sp, T), 0);
}
/** van 't Hoff: h̄R from Kp at two temperatures */
export const vantHoff = (lnK1: number, T1: number, lnK2: number, T2: number) => (Ru * (lnK2 - lnK1)) / (1 / T1 - 1 / T2);

export { solve };

/* ------------------------------------------------------------------ standard atmosphere (A-16) */
/** ISA troposphere/lower stratosphere: z in m → T (K), P (kPa) */
export function atmosphere(z: number) {
  if (z <= 11000) {
    const T = 288.15 - 0.0065 * z;
    return { T, P: 101.325 * Math.pow(T / 288.15, 5.2559) };
  }
  const P11 = 101.325 * Math.pow(216.65 / 288.15, 5.2559);
  return { T: 216.65, P: P11 * Math.exp((-9.80665 * (z - 11000)) / (287.05 * 216.65)) };
}
