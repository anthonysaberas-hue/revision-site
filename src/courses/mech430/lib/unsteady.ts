/**
 * Unsteady 1-D waves: moving shocks, centered expansions, shock tubes
 * (notes §8.4, unsteady-flow lectures, Anderson §7.6–7.9).
 * Lab-frame velocities are primed in the notes (V_p', V_s'); here: up = piston/particle velocity, Ms = shock Mach.
 */
import { bisect } from './solve';
import { py_px, Ty_Tx } from './normalShock';

/** Piston (induced particle) velocity over sound speed ahead: V_p'/c_x = (2/(γ+1))(Ms² − 1)/Ms. */
export const up_over_c1 = (Ms: number, g = 1.4) => (2 / (g + 1)) * ((Ms * Ms - 1) / Ms);

/** Shock Mach from piston velocity (closed-form quadratic root). */
export function Ms_from_up(up_c1: number, g = 1.4): number {
  const k = ((g + 1) / 2) * up_c1;
  return 0.5 * (k + Math.sqrt(k * k + 4));
}

/** Full state behind a moving shock of Mach Ms into still gas (state 1 → state 2). */
export function movingShock(Ms: number, c1: number, g = 1.4) {
  const up = up_over_c1(Ms, g) * c1;
  const T2_T1 = Ty_Tx(Ms, g);
  const c2 = c1 * Math.sqrt(T2_T1);
  return {
    Ms,
    Vs: Ms * c1,
    up,
    p2_p1: py_px(Ms, g),
    T2_T1,
    c2,
    /** Lab-frame Mach number of the gas behind the shock. */
    M2lab: up / c2,
  };
}

/** Centered expansion: state at particle velocity u (moving away from the gas, u ≥ 0) from rest state 4. */
export function expansionState(u: number, c4: number, g = 1.4) {
  const r = 1 - ((g - 1) / 2) * (u / c4);
  return {
    c_c4: r,
    T_T4: r * r,
    p_p4: Math.pow(r, (2 * g) / (g - 1)),
    rho_rho4: Math.pow(r, 2 / (g - 1)),
  };
}

/** Escape (maximum) velocity of an unsteady expansion into vacuum: 2c0/(γ−1). */
export const uEscape = (c0: number, g = 1.4) => (2 * c0) / (g - 1);

/** Riemann invariants J± = u ± 2c/(γ−1). */
export const Jplus = (u: number, c: number, g = 1.4) => u + (2 * c) / (g - 1);
export const Jminus = (u: number, c: number, g = 1.4) => u - (2 * c) / (g - 1);

/**
 * Shock-tube equation (Anderson 7.94):
 * p4/p1 = (p2/p1) · {1 − (γ4−1)(c1/c4)(p2/p1 − 1) / √[2γ1(2γ1 + (γ1+1)(p2/p1 − 1))]}^(−2γ4/(γ4−1))
 */
export function p4_p1_from_p2_p1(p21: number, g1: number, g4: number, c1_c4: number): number {
  const inner = 1 - ((g4 - 1) * c1_c4 * (p21 - 1)) / Math.sqrt(2 * g1 * (2 * g1 + (g1 + 1) * (p21 - 1)));
  if (inner <= 0) return Infinity;
  return p21 * Math.pow(inner, (-2 * g4) / (g4 - 1));
}

export interface ShockTubeInput {
  p4_p1: number;
  g1: number;
  g4: number;
  /** Sound speeds of driven (1) and driver (4) gases, m/s */
  c1: number;
  c4: number;
}

export function shockTube({ p4_p1, g1, g4, c1, c4 }: ShockTubeInput) {
  const c1_c4 = c1 / c4;
  // p2/p1 lies between 1 and the value where the driver would expand to vacuum
  const upper = bisect((p) => (isFinite(p4_p1_from_p2_p1(p, g1, g4, c1_c4)) ? -1 : 1), 1.000001, 1e6);
  const p2_p1 = bisect((p) => p4_p1_from_p2_p1(p, g1, g4, c1_c4) - p4_p1, 1 + 1e-12, upper * (1 - 1e-12));
  const Ms = Math.sqrt(((g1 + 1) / (2 * g1)) * (p2_p1 - 1) + 1);
  const shock = movingShock(Ms, c1, g1);
  const u3 = shock.up; // contact surface velocity
  const exp = expansionState(u3, c4, g4);
  const c3 = c4 * exp.c_c4;
  return {
    p2_p1,
    Ms,
    Vs: Ms * c1,
    u2: u3,
    T2_T1: shock.T2_T1,
    c2: shock.c2,
    p3_p4: exp.p_p4,
    T3_T4: exp.T_T4,
    c3,
    /** Head of the expansion fan moves left at −c4; tail at u3 − c3. */
    headSpeed: -c4,
    tailSpeed: u3 - c3,
  };
}

/** Reflected shock off the end wall: solve MR from Ms (Anderson 7.23). */
export function reflectedShock(Ms: number, g = 1.4) {
  const rhs = (Ms / (Ms * Ms - 1)) * Math.sqrt(1 + ((2 * (g - 1)) / ((g + 1) ** 2)) * (Ms * Ms - 1) * (g + 1 / (Ms * Ms)));
  const MR = bisect((M) => M / (M * M - 1) - rhs, 1 + 1e-9, 100);
  return { MR };
}
