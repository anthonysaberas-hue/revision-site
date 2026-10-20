/**
 * Psychrometrics of moist air (ideal-gas mixture of dry air and water vapour). T °C, P kPa (always explicit),
 * ω kg/kg dry air, h kJ/kg dry air, v m³/kg dry air. Saturation data from the steam tables in props.ts.
 */
import { water, solve } from './props';

const Ra = 0.287; // kJ/kg·K
const KT = 273.15;
const EPS = 0.622;

/** saturation pressure of water at T */
export const Pg = (T: number) => water.Psat(T);
/** humidity ratio from relative humidity (0..1) */
export function omega(T: number, phi: number, P: number) {
  const Pv = phi * Pg(T);
  return (EPS * Pv) / (P - Pv);
}
/** vapour pressure from ω */
export const Pv = (w: number, P: number) => (w * P) / (EPS + w);
/** relative humidity (0..1) from T and ω */
export const phiOf = (T: number, w: number, P: number) => Pv(w, P) / Pg(T);
/** enthalpy per kg dry air */
export const hAir = (T: number, w: number) => 1.005 * T + w * (2501.3 + 1.82 * T);
/** specific volume per kg dry air */
export const vAir = (T: number, w: number, P: number) => (Ra * (T + KT)) / (P - Pv(w, P));
/** dew-point temperature */
export const Tdp = (w: number, P: number) => water.Tsat(Pv(w, P));
/** ω from dry-bulb and wet-bulb temperatures (adiabatic saturation, Çengel eq. 14-14) */
export function omegaFromWetBulb(T: number, Twb: number, P: number) {
  const s2 = water.satT(Twb);
  const w2 = (EPS * s2.P) / (P - s2.P);
  const hg1 = water.satT(T).hg;
  return (1.005 * (Twb - T) + w2 * s2.hfg) / (hg1 - s2.hf);
}
/** wet-bulb temperature from T and ω (solved from the adiabatic-saturation relation) */
export function wetBulb(T: number, w: number, P: number) {
  const f = (t: number) => omegaFromWetBulb(T, t, P) - w;
  const lo = Math.max(0.01, Tdp(w, P) - 10);
  return solve(f, lo, T, 1e-10);
}

export interface PsyState {
  T: number;
  P: number;
  w: number;
  phi: number;
  h: number;
  v: number;
  Tdp: number;
  Twb: number;
}
/** full moist-air state from T, P and one of phi, w, Twb, Tdp */
export function psyState(i: { T: number; P: number; phi?: number; w?: number; Twb?: number; Tdp?: number }): PsyState {
  const { T, P } = i;
  let w: number;
  if (i.w !== undefined) w = i.w;
  else if (i.phi !== undefined) w = omega(T, i.phi, P);
  else if (i.Twb !== undefined) w = omegaFromWetBulb(T, i.Twb, P);
  else if (i.Tdp !== undefined) w = (EPS * Pg(i.Tdp)) / (P - Pg(i.Tdp));
  else throw new Error('psyState needs one of phi, w, Twb, Tdp');
  return { T, P, w, phi: phiOf(T, w, P), h: hAir(T, w), v: vAir(T, w, P), Tdp: Tdp(w, P), Twb: wetBulb(T, w, P) };
}

/** adiabatic mixing of two moist-air streams (mass of dry air, ω, h) at pressure P */
export function mixStreams(a: { ma: number; w: number; h: number }, b: { ma: number; w: number; h: number }, P: number) {
  const ma = a.ma + b.ma;
  const w = (a.ma * a.w + b.ma * b.w) / ma;
  const h = (a.ma * a.h + b.ma * b.h) / ma;
  const T = (h - w * 2501.3) / (1.005 + 1.82 * w);
  return { ma, w, h, T, phi: phiOf(T, w, P) };
}
