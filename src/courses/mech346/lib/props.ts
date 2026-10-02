/** Thermophysical properties by interpolation of CoolProp-generated tables (see propsData.ts). SI units, T in °C. */
import { AIR_TABLE, WATER_TABLE } from './propsData';

export interface Fluid {
  T: number;
  rho: number; // kg/m3
  cp: number; // J/kg.K
  k: number; // W/m.K
  mu: number; // kg/m.s
  nu: number; // m2/s
  alpha: number; // m2/s
  Pr: number;
  beta: number; // 1/K
}

function interp(table: number[][], T: number): number[] {
  const n = table.length;
  if (T <= table[0][0]) return table[0];
  if (T >= table[n - 1][0]) return table[n - 1];
  let i = 0;
  while (table[i + 1][0] < T) i++;
  const a = table[i];
  const b = table[i + 1];
  const f = (T - a[0]) / (b[0] - a[0]);
  return a.map((v, j) => v + f * (b[j] - v));
}

function make(T: number, rho: number, cp: number, k: number, muMicro: number, beta: number): Fluid {
  const mu = muMicro * 1e-6;
  return { T, rho, cp, k, mu, nu: mu / rho, alpha: k / (rho * cp), Pr: (mu * cp) / k, beta };
}

/** Air at 1 atm. Ideal-gas beta = 1/T (K). */
export function air(T: number): Fluid {
  const r = interp(AIR_TABLE, T);
  return make(T, r[1], r[2], r[3], r[4], 1 / (T + 273.15));
}

/** Saturated liquid water. */
export function water(T: number): Fluid {
  const r = interp(WATER_TABLE, T);
  return make(T, r[1], r[2], r[3], r[4], r[5] * 1e-6);
}

/** Film temperature (Ts + Tinf)/2. */
export const filmT = (Ts: number, Tinf: number) => (Ts + Tinf) / 2;

/** Solid properties used in the course examples (k W/m.K, rho kg/m3, cp J/kg.K). */
export const SOLIDS = {
  copper: { k: 401, rho: 8933, cp: 385 },
  aluminum: { k: 237, rho: 2702, cp: 903 },
  carbonSteel: { k: 54, rho: 7833, cp: 465 },
  stainless304: { k: 14.9, rho: 7900, cp: 477 },
  brass: { k: 110, rho: 8530, cp: 380 },
  glass: { k: 0.78, rho: 2700, cp: 840 },
  brick: { k: 0.72, rho: 1920, cp: 835 },
  concrete: { k: 1.4, rho: 2300, cp: 880 },
  fiberglass: { k: 0.043, rho: 12, cp: 840 },
} as const;

export const SIGMA = 5.670e-8; // W/m2.K4
export const G = 9.81;
