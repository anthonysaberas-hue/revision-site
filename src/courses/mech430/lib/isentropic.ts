/** 1-D isentropic flow of a perfect gas (notes Ch. 5; Table A2). */
import { bisect, toDeg } from './solve';

export type Branch = 'sub' | 'sup';

/** T0/T = 1 + (γ−1)/2 M² */
export const T0_T = (M: number, g = 1.4) => 1 + ((g - 1) / 2) * M * M;
/** p0/p = (T0/T)^(γ/(γ−1)) */
export const p0_p = (M: number, g = 1.4) => Math.pow(T0_T(M, g), g / (g - 1));
/** ρ0/ρ = (T0/T)^(1/(γ−1)) */
export const rho0_rho = (M: number, g = 1.4) => Math.pow(T0_T(M, g), 1 / (g - 1));

export const T_T0 = (M: number, g = 1.4) => 1 / T0_T(M, g);
export const p_p0 = (M: number, g = 1.4) => 1 / p0_p(M, g);
export const rho_rho0 = (M: number, g = 1.4) => 1 / rho0_rho(M, g);

/** Area–Mach relation A/A* */
export function A_Astar(M: number, g = 1.4): number {
  const e = (g + 1) / (2 * (g - 1));
  return (1 / M) * Math.pow((2 / (g + 1)) * T0_T(M, g), e);
}

/** Mach angle μ = asin(1/M) in degrees (M ≥ 1). */
export const machAngle = (M: number) => toDeg(Math.asin(1 / M));

/** Sonic ratios. */
export const Tstar_T0 = (g = 1.4) => 2 / (g + 1);
export const pstar_p0 = (g = 1.4) => Math.pow(2 / (g + 1), g / (g - 1));
export const rhostar_rho0 = (g = 1.4) => Math.pow(2 / (g + 1), 1 / (g - 1));

/** Invert A/A* on the chosen branch. */
export function M_from_A_Astar(ratio: number, branch: Branch, g = 1.4): number {
  if (ratio < 1) throw new RangeError('A/A* must be ≥ 1');
  if (ratio === 1) return 1;
  const f = (M: number) => A_Astar(M, g) - ratio;
  return branch === 'sub' ? bisect(f, 1e-9, 1) : bisect(f, 1, 200);
}

/** Invert p/p0 (closed form). */
export const M_from_p_p0 = (pr: number, g = 1.4) => Math.sqrt((2 / (g - 1)) * (Math.pow(1 / pr, (g - 1) / g) - 1));
/** Invert T/T0 (closed form). */
export const M_from_T_T0 = (tr: number, g = 1.4) => Math.sqrt((2 / (g - 1)) * (1 / tr - 1));
/** Invert ρ/ρ0 (closed form). */
export const M_from_rho_rho0 = (rr: number, g = 1.4) => Math.sqrt((2 / (g - 1)) * (Math.pow(1 / rr, g - 1) - 1));

/**
 * Mass flux ṁ/A = (p0/√T0)·√(γ/R)·M·(1+(γ−1)/2 M²)^(−(γ+1)/(2(γ−1)))   [kg/(s·m²)]
 */
export function massFlux(M: number, p0: number, T0: number, R: number, g = 1.4): number {
  return (p0 / Math.sqrt(T0)) * Math.sqrt(g / R) * M * Math.pow(T0_T(M, g), -(g + 1) / (2 * (g - 1)));
}

/** Choked mass flow through a throat of area Astar. */
export const chokedMassFlow = (Astar: number, p0: number, T0: number, R: number, g = 1.4) =>
  Astar * massFlux(1, p0, T0, R, g);

/** All Table-A2 columns at once. */
export function isentropicState(M: number, g = 1.4) {
  return {
    M,
    p_p0: p_p0(M, g),
    T_T0: T_T0(M, g),
    rho_rho0: rho_rho0(M, g),
    A_Astar: A_Astar(M, g),
    mu: M >= 1 ? machAngle(M) : NaN,
  };
}

/** V_max = √(2 cp T0): expansion into vacuum. */
export const Vmax = (cpVal: number, T0: number) => Math.sqrt(2 * cpVal * T0);
