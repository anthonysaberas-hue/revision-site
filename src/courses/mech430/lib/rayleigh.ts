/** Rayleigh flow: frictionless constant-area flow with heat addition (notes Ch. 11; Table A5). */
import { bisect } from './solve';
import type { Branch } from './isentropic';

export const p_pstar = (M: number, g = 1.4) => (1 + g) / (1 + g * M * M);
export const T_Tstar = (M: number, g = 1.4) => ((1 + g) ** 2 * M * M) / (1 + g * M * M) ** 2;
export const V_Vstar = (M: number, g = 1.4) => ((g + 1) * M * M) / (1 + g * M * M);
export const rho_rhostar = (M: number, g = 1.4) => 1 / V_Vstar(M, g);
export const T0_T0star = (M: number, g = 1.4) =>
  (2 * (g + 1) * M * M * (1 + ((g - 1) / 2) * M * M)) / (1 + g * M * M) ** 2;
export const p0_p0star = (M: number, g = 1.4) =>
  ((g + 1) / (1 + g * M * M)) * Math.pow((2 * (1 + ((g - 1) / 2) * M * M)) / (g + 1), g / (g - 1));

/** Mach number of maximum static temperature: 1/√γ. */
export const M_Tmax = (g = 1.4) => 1 / Math.sqrt(g);

/** Invert T0/T0* (≤ 1) on a branch. */
export function M_from_T0_T0star(r: number, branch: Branch, g = 1.4): number {
  if (r >= 1) return 1;
  const f = (M: number) => T0_T0star(M, g) - r;
  if (branch === 'sub') return bisect(f, 1e-9, 1);
  const lim = (g * g - 1) / (g * g); // T0/T0* as M → ∞
  if (r <= lim) return NaN;
  return bisect(f, 1, 1e4);
}
export const M_from_p_pstar = (r: number, g = 1.4) => Math.sqrt(((1 + g) / r - 1) / g);
export function M_from_T_Tstar(r: number, branch: 'sub-low' | 'sub-high' | 'sup', g = 1.4): number {
  const f = (M: number) => T_Tstar(M, g) - r;
  const mT = M_Tmax(g);
  if (branch === 'sub-low') return bisect(f, 1e-9, mT);
  if (branch === 'sub-high') return bisect(f, mT, 1);
  return bisect(f, 1, 1e4);
}
export function M_from_p0_p0star(r: number, branch: Branch, g = 1.4): number {
  const f = (M: number) => p0_p0star(M, g) - r;
  return branch === 'sub' ? bisect(f, 1e-9, 1) : bisect(f, 1, 1e3);
}

export function rayleighState(M: number, g = 1.4) {
  return {
    M,
    T0_T0star: T0_T0star(M, g),
    T_Tstar: T_Tstar(M, g),
    p_pstar: p_pstar(M, g),
    p0_p0star: p0_p0star(M, g),
    V_Vstar: V_Vstar(M, g),
  };
}

/**
 * Heat addition q [J/kg] to a duct at M1, T01. Returns exit state or thermal choking info.
 * qStar = cp (T0* − T01) is the maximum heat that can be added before M = 1.
 */
export function rayleighHeat(M1: number, T01: number, q: number, cpVal: number, g = 1.4) {
  const T0star = T01 / T0_T0star(M1, g);
  const qStar = cpVal * (T0star - T01);
  const T02 = T01 + q / cpVal;
  const choked = T02 > T0star * (1 + 1e-12);
  const branch: Branch = M1 < 1 ? 'sub' : 'sup';
  const M2 = choked ? 1 : M_from_T0_T0star(T02 / T0star, branch, g);
  return {
    T0star,
    qStar,
    T02,
    choked,
    M2,
    p2_p1: p_pstar(M2, g) / p_pstar(M1, g),
    T2_T1: T_Tstar(M2, g) / T_Tstar(M1, g),
    p02_p01: p0_p0star(M2, g) / p0_p0star(M1, g),
  };
}
