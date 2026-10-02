/**
 * 1-D unsteady wave diagrams built on lib/unsteady.ts (notes Ch. 16, PS11, Final A P5):
 * pistons pushed (shock) and pulled (centred rarefaction), full shock-tube x–t structure
 * with the reflected shock, and the PS11 P6 "design for T5" iteration.
 */
import { expansionState, Jminus, Jplus, Ms_from_up, movingShock, p4_p1_from_p2_p1, shockTube, uEscape } from './unsteady';
import { py_px, Ty_Tx } from './normalShock';
import { Gas, gasR, soundSpeed } from './gas';
import { bisect } from './solve';

/**
 * State inside a centred fan at similarity coordinate ξ = x/t.
 * dir = 'right': the fan's waves run right (u + c family), into still gas of sound speed c0 on the right
 *   (a piston pulled out to the left). J⁻ = u − 2c/(γ−1) = −2c0/(γ−1) is uniform.
 * dir = 'left': the fan's waves run left (u − c family), into still gas on the left (shock-tube driver,
 *   gas gun). J⁺ = u + 2c/(γ−1) = 2c0/(γ−1) is uniform.
 */
export function fanState(xi: number, c0: number, g: number, dir: 'right' | 'left') {
  const u = dir === 'right' ? (2 / (g + 1)) * (xi - c0) : (2 / (g + 1)) * (xi + c0);
  const e = expansionState(Math.abs(u), c0, g);
  return { u, c: c0 * e.c_c4, c_c0: e.c_c4, T_T0: e.T_T4, p_p0: e.p_p4, rho_rho0: e.rho_rho4 };
}

/* ---------------- piston ---------------- */

export interface PistonSolution {
  /** Piston velocity (+ = pushed into the gas, − = pulled out) */
  up: number;
  c1: number;
  g: number;
  mode: 'shock' | 'fan' | 'cavitation' | 'rest';
  // pushed
  Ms?: number;
  Vs?: number;
  p2_p1?: number;
  T2_T1?: number;
  /** Lab-frame Mach number of the gas behind the shock */
  M2lab?: number;
  // pulled
  /** Speed of the fan head (runs into the still gas at +c1) */
  head?: number;
  /** Speed of the fan tail (u + c at the piston face) */
  tail?: number;
  cp?: number;
  pp_p1?: number;
  Tp_T1?: number;
  /** Escape (cavitation) velocity 2c1/(γ−1) */
  uEsc: number;
}

/** Gas initially at rest in x > 0; piston at x = 0 moves at `up` from t = 0 (impulsive start). */
export function pistonSolution(up: number, c1: number, g = 1.4): PistonSolution {
  const uEsc = uEscape(c1, g);
  if (Math.abs(up) < 1e-9) return { up, c1, g, mode: 'rest', uEsc };
  if (up > 0) {
    const Ms = Ms_from_up(up / c1, g);
    const s = movingShock(Ms, c1, g);
    return { up, c1, g, mode: 'shock', Ms, Vs: s.Vs, p2_p1: s.p2_p1, T2_T1: s.T2_T1, M2lab: s.M2lab, uEsc };
  }
  const V = -up;
  if (V >= uEsc) {
    // Gas cannot follow: it expands to vacuum; the gas front moves at −2c1/(γ−1)
    return { up, c1, g, mode: 'cavitation', head: c1, tail: -uEsc, cp: 0, pp_p1: 0, Tp_T1: 0, uEsc };
  }
  const e = expansionState(V, c1, g);
  const cp = c1 * e.c_c4;
  return { up, c1, g, mode: 'fan', head: c1, tail: up + cp, cp, pp_p1: e.p_p4, Tp_T1: e.T_T4, uEsc };
}

export interface WaveSample {
  /** 'none' = outside the gas (behind the piston, or vacuum) */
  region: string;
  p_p1: number;
  u: number;
  T_T1: number;
}

/** p, u, T at (x, t) for the piston problem. */
export function pistonProfile(sol: PistonSolution, x: number, t: number): WaveSample {
  const still = { region: '1', p_p1: 1, u: 0, T_T1: 1 };
  if (t <= 0) return x >= 0 ? still : { region: 'none', p_p1: NaN, u: NaN, T_T1: NaN };
  const xp = sol.up * t;
  if (x < xp) return { region: 'none', p_p1: NaN, u: NaN, T_T1: NaN };
  if (sol.mode === 'rest') return still;
  if (sol.mode === 'shock') {
    return x < sol.Vs! * t ? { region: '2', p_p1: sol.p2_p1!, u: sol.up, T_T1: sol.T2_T1! } : still;
  }
  const xi = x / t;
  if (xi >= sol.head!) return still;
  if (xi <= sol.tail!) {
    if (sol.mode === 'cavitation') return { region: 'none', p_p1: NaN, u: NaN, T_T1: NaN };
    return { region: 'p', p_p1: sol.pp_p1!, u: sol.up, T_T1: sol.Tp_T1! };
  }
  const f = fanState(xi, sol.c1, sol.g, 'right');
  return { region: 'fan', p_p1: f.p_p0, u: f.u, T_T1: f.T_T0 };
}

/* ---------------- shock tube ---------------- */

export interface ShockTubeSetup {
  p4_p1: number;
  driver: Gas;
  driven: Gas;
  T4: number;
  T1: number;
  /** Length of the driven section (diaphragm → end wall), m */
  L1: number;
}

export function shockTubeWaves(s: ShockTubeSetup) {
  const g1 = s.driven.gamma;
  const g4 = s.driver.gamma;
  const c1 = soundSpeed(g1, gasR(s.driven.MW), s.T1);
  const c4 = soundSpeed(g4, gasR(s.driver.MW), s.T4);
  const st = shockTube({ p4_p1: s.p4_p1, g1, g4, c1, c4 });
  const refl = reflectedFromIncident(st.Ms, c1, g1);
  const T2 = s.T1 * st.T2_T1;
  const T3 = s.T4 * st.T3_T4;
  const p2_p1 = st.p2_p1;
  const tWall = s.L1 / st.Vs;
  // reflected shock (moving left at WR) meets the contact surface (moving right at u2)
  const tMeet = (s.L1 + refl.WR * tWall) / (st.u2 + refl.WR);
  // Acoustic impedances ρc = γp/c on the two sides of the contact (p equal): tailored if γ1/c2 = γ4/c3
  const Z2_Z3 = (g1 / st.c2) / (g4 / st.c3);
  return {
    ...st,
    c1,
    c4,
    g1,
    g4,
    T1: s.T1,
    T4: s.T4,
    T2,
    T3,
    p4_p1: s.p4_p1,
    p3_p1: p2_p1,
    L1: s.L1,
    MR: refl.MR,
    WR: refl.WR,
    p5_p2: refl.p5_p2,
    T5_T2: refl.T5_T2,
    p5_p1: refl.p5_p2 * p2_p1,
    T5: T2 * refl.T5_T2,
    tWall,
    tMeet,
    Z2_Z3,
    /** Riemann invariant carried across the fan from region 4 */
    Jplus4: Jplus(0, c4, g4),
  };
}
export type ShockTubeWaves = ReturnType<typeof shockTubeWaves>;

/** p/p1, u, T/T1 at (x, t); diaphragm at x = 0, end wall at x = L1. Valid for t ≤ tMeet. */
export function shockTubeProfile(w: ShockTubeWaves, x: number, t: number): WaveSample {
  const r1 = { region: '1', p_p1: 1, u: 0, T_T1: 1 };
  const r4 = { region: '4', p_p1: w.p4_p1, u: 0, T_T1: w.T4 / w.T1 };
  if (t <= 0) return x < 0 ? r4 : r1;
  const xi = x / t;
  if (xi <= w.headSpeed) return r4;
  if (xi < w.tailSpeed) {
    const f = fanState(xi, w.c4, w.g4, 'left');
    return { region: 'fan', p_p1: w.p4_p1 * f.p_p0, u: f.u, T_T1: (w.T4 * f.T_T0) / w.T1 };
  }
  if (xi < w.u2) return { region: '3', p_p1: w.p3_p1, u: w.u2, T_T1: w.T3 / w.T1 };
  if (t > w.tWall) {
    const xR = w.L1 - w.WR * (t - w.tWall);
    if (x >= xR) return { region: '5', p_p1: w.p5_p1, u: 0, T_T1: w.T5 / w.T1 };
    return { region: '2', p_p1: w.p2_p1, u: w.u2, T_T1: w.T2_T1 };
  }
  if (xi < w.Vs) return { region: '2', p_p1: w.p2_p1, u: w.u2, T_T1: w.T2_T1 };
  return r1;
}

/* ---------------- reflected shock (course method, PS11 P6) ---------------- */

/**
 * The end wall is a piston moving at u2 into gas 2 (seen from gas 2), so the reflected shock obeys the
 * same unsteady-shock formula with c_x = c2: u2/c2 = (2/(γ+1))(M_R² − 1)/M_R.
 */
export function reflectedFromIncident(Ms: number, c1: number, g = 1.4) {
  const s = movingShock(Ms, c1, g);
  const MR = Ms_from_up(s.up / s.c2, g);
  return {
    Ms,
    T2_T1: s.T2_T1,
    p2_p1: s.p2_p1,
    c2: s.c2,
    u2: s.up,
    MR,
    /** Lab-frame speed of the reflected shock (moving away from the wall) */
    WR: MR * s.c2 - s.up,
    T5_T2: Ty_Tx(MR, g),
    p5_p2: py_px(MR, g),
    T5_T1: s.T2_T1 * Ty_Tx(MR, g),
    p5_p1: s.p2_p1 * py_px(MR, g),
  };
}

/** Incident shock Mach number that gives a target T5 behind the reflected shock (PS11 P6). */
export function designForT5(T5: number, T1: number, c1: number, g = 1.4) {
  const Ms = bisect((M) => T1 * reflectedFromIncident(M, c1, g).T5_T1 - T5, 1 + 1e-9, 30);
  return reflectedFromIncident(Ms, c1, g);
}

/** Driver pressure ratio needed for a shock of strength p2/p1 (the shock-tube equation). */
export const driverRatio = (p2_p1: number, g1: number, g4: number, c1: number, c4: number) => p4_p1_from_p2_p1(p2_p1, g1, g4, c1 / c4);

/* ---------------- gas gun ---------------- */

/** Base pressure on a projectile moving at up, fed by a long column of gas at rest (p0, c0). */
export function projectileBase(up: number, c0: number, g = 1.4) {
  const V = Math.min(up, uEscape(c0, g));
  const e = expansionState(V, c0, g);
  return { pp_p0: e.p_p4, Tp_T0: e.T_T4, cp: c0 * e.c_c4, uMax: uEscape(c0, g), Jminus: Jminus(up, c0 * e.c_c4, g) };
}

/** Steady-flow maximum velocity for comparison: V_max = √(2/(γ−1))·c0. */
export const steadyVmax = (c0: number, g = 1.4) => Math.sqrt(2 / (g - 1)) * c0;
