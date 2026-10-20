/** Ideal-gas compressible-flow relations (isentropic). T in K, V in m/s, cp in kJ/kg·K. */
import { solve } from './props';

/** stagnation temperature T0 = T + V²/(2cp) */
export const stagnationT = (T: number, V: number, cp: number) => T + (V * V) / (2000 * cp);
export const T0_T = (Ma: number, k: number) => 1 + ((k - 1) / 2) * Ma * Ma;
export const P0_P = (Ma: number, k: number) => Math.pow(T0_T(Ma, k), k / (k - 1));
export const rho0_rho = (Ma: number, k: number) => Math.pow(T0_T(Ma, k), 1 / (k - 1));
/** A/A* for isentropic flow at Mach Ma */
export const areaRatio = (Ma: number, k: number) =>
  (1 / Ma) * Math.pow(((2 / (k + 1)) * T0_T(Ma, k)), (k + 1) / (2 * (k - 1)));
/** Mach number for a given A/A* on the subsonic or supersonic branch */
export function machFromAreaRatio(AR: number, k: number, branch: 'sub' | 'sup') {
  if (AR < 1) return NaN;
  const f = (M: number) => areaRatio(M, k) - AR;
  return branch === 'sub' ? solve(f, 1e-6, 1, 1e-12) : solve(f, 1, 60, 1e-12);
}
/** speed of sound, R in kJ/kg·K, T in K → m/s */
export const soundSpeed = (T: number, R: number, k: number) => Math.sqrt(k * R * 1000 * T);
/** critical (Ma = 1) ratios T-star over T0, P-star over P0, rho-star over rho0 */
export const critical = (k: number) => ({
  T: 2 / (k + 1),
  P: Math.pow(2 / (k + 1), k / (k - 1)),
  rho: Math.pow(2 / (k + 1), 1 / (k - 1)),
});
