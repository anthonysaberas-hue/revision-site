/** Prandtl–Meyer expansion (notes Ch. 13; Table A6). Angles in degrees. */
import { bisect, toDeg } from './solve';
import { p_p0, T_T0 } from './isentropic';

/** ν(M) = √((γ+1)/(γ−1)) atan √((γ−1)/(γ+1)(M²−1)) − atan √(M²−1) */
export function nu(M: number, g = 1.4): number {
  if (M <= 1) return 0;
  const k = Math.sqrt((g + 1) / (g - 1));
  const m = Math.sqrt(M * M - 1);
  return toDeg(k * Math.atan(m / k) - Math.atan(m));
}

/** Maximum turning from sonic flow: (π/2)(√((γ+1)/(γ−1)) − 1). */
export const nuMax = (g = 1.4) => toDeg((Math.PI / 2) * (Math.sqrt((g + 1) / (g - 1)) - 1));

export function M_from_nu(nuDeg: number, g = 1.4): number {
  if (nuDeg <= 0) return 1;
  if (nuDeg >= nuMax(g)) return Infinity;
  return bisect((M) => nu(M, g) - nuDeg, 1, 1e4, 1e-13);
}

export interface PMResult {
  M1: number;
  nu1: number;
  theta: number;
  nu2: number;
  M2: number;
  p2_p1: number;
  T2_T1: number;
  mu1: number;
  mu2: number;
}

/** Expand flow at M1 around a corner of θ degrees (θ > 0 expands). */
export function expansion(M1: number, thetaDeg: number, g = 1.4): PMResult {
  const nu1 = nu(M1, g);
  const nu2 = nu1 + thetaDeg;
  const M2 = M_from_nu(nu2, g);
  return {
    M1,
    nu1,
    theta: thetaDeg,
    nu2,
    M2,
    p2_p1: p_p0(M2, g) / p_p0(M1, g),
    T2_T1: T_T0(M2, g) / T_T0(M1, g),
    mu1: toDeg(Math.asin(1 / M1)),
    mu2: isFinite(M2) ? toDeg(Math.asin(1 / M2)) : 0,
  };
}
