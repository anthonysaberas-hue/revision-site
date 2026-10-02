/**
 * Fanno flow: adiabatic, constant-area flow with friction (notes Ch. 10; Table A4).
 * Uses the course's Fanning-friction convention, 4fL/D.
 */
import { bisect } from './solve';
import type { Branch } from './isentropic';

/** 4fL* over D: the friction length needed to reach M = 1 from M. */
export function fLmax(M: number, g = 1.4): number {
  const M2 = M * M;
  return (1 - M2) / (g * M2) + ((g + 1) / (2 * g)) * Math.log(((g + 1) * M2) / (2 * (1 + ((g - 1) / 2) * M2)));
}

export const T_Tstar = (M: number, g = 1.4) => (g + 1) / (2 + (g - 1) * M * M);
export const p_pstar = (M: number, g = 1.4) => (1 / M) * Math.sqrt((g + 1) / (2 + (g - 1) * M * M));
export const rho_rhostar = (M: number, g = 1.4) => (1 / M) * Math.sqrt((2 + (g - 1) * M * M) / (g + 1));
export const V_Vstar = (M: number, g = 1.4) => 1 / rho_rhostar(M, g);
export const p0_p0star = (M: number, g = 1.4) =>
  (1 / M) * Math.pow((2 + (g - 1) * M * M) / (g + 1), (g + 1) / (2 * (g - 1)));

/** Supersonic limit of 4fL* over D as M → ∞ (0.8215 for γ = 1.4). */
export const fLmaxInfinity = (g = 1.4) => -1 / g + ((g + 1) / (2 * g)) * Math.log((g + 1) / (g - 1));

/** Invert 4fL* over D on a branch. Returns NaN if the value is impossible (supersonic branch capped at 0.8215). */
export function M_from_fLmax(val: number, branch: Branch, g = 1.4): number {
  if (val <= 0) return 1;
  const f = (M: number) => fLmax(M, g) - val;
  if (branch === 'sub') return bisect(f, 1e-6, 1);
  if (val >= fLmaxInfinity(g)) return NaN;
  return bisect(f, 1, 1e4);
}

export const M_from_T_Tstar = (r: number, g = 1.4) => Math.sqrt(((g + 1) / r - 2) / (g - 1));
export function M_from_p_pstar(r: number, g = 1.4): number {
  // p/p* is monotone decreasing in M
  return bisect((M) => p_pstar(M, g) - r, 1e-6, 1e4);
}
export function M_from_p0_p0star(r: number, branch: Branch, g = 1.4): number {
  if (r <= 1) return 1;
  const f = (M: number) => p0_p0star(M, g) - r;
  return branch === 'sub' ? bisect(f, 1e-6, 1) : bisect(f, 1, 1e3);
}

export function fannoState(M: number, g = 1.4) {
  return {
    M,
    fLmax: fLmax(M, g),
    T_Tstar: T_Tstar(M, g),
    p_pstar: p_pstar(M, g),
    rho_rhostar: rho_rhostar(M, g),
    V_Vstar: V_Vstar(M, g),
    p0_p0star: p0_p0star(M, g),
  };
}

/**
 * March a Fanno duct from inlet Mach M1 over friction length fL = 4fL/D.
 * Returns the exit Mach, or `choked: true` if the duct is longer than L* (the given M1 is impossible).
 */
export function fannoDuct(M1: number, fL: number, g = 1.4) {
  const branch: Branch = M1 < 1 ? 'sub' : 'sup';
  const rem = fLmax(M1, g) - fL;
  if (rem < -1e-12) return { M2: NaN, choked: true, p2_p1: NaN, T2_T1: NaN, p02_p01: NaN };
  const M2 = rem <= 0 ? 1 : M_from_fLmax(rem, branch, g);
  return {
    M2,
    choked: false,
    p2_p1: p_pstar(M2, g) / p_pstar(M1, g),
    T2_T1: T_Tstar(M2, g) / T_Tstar(M1, g),
    p02_p01: p0_p0star(M2, g) / p0_p0star(M1, g),
  };
}
