/**
 * Shock-expansion theory for a symmetric diamond (double-wedge) airfoil (notes Ch. 14, PS10 P2, Final A P3).
 * Angles in degrees. Chord c = 1 (results per unit chord and unit span, pressures relative to p∞).
 * Faces: 1 = upper front, 2 = upper rear, 3 = lower front, 4 = lower rear.
 * A front face turned INTO the flow gets an oblique shock; turned AWAY from it, a Prandtl–Meyer fan;
 * both shoulders are always a 2ε expansion.
 */
import { toRad } from './solve';
import { obliqueShock } from './obliqueShock';
import { expansion, nu } from './prandtlMeyer';
import { p_p0 } from './isentropic';

export type WaveKind = 'shock' | 'fan' | 'none';

export interface FaceState {
  /** wave that produced this face's state */
  wave: WaveKind;
  /** turning of the flow by that wave (deg, > 0) */
  turn: number;
  /** shock angle (only for a shock), measured from the upstream flow */
  sigma: number;
  M: number;
  /** p / p∞ */
  p: number;
  /** stagnation pressure / p0∞ */
  p0: number;
  /** flow direction on this face, degrees from the free stream (+ = up) */
  dir: number;
}

export interface DiamondResult {
  M: number;
  eps: number;
  alpha: number;
  faces: [FaceState, FaceState, FaceState, FaceState];
  /** face length (c/2)/cos ε, per unit chord */
  ell: number;
  /** lift and drag per unit span divided by p∞ c */
  L: number;
  D: number;
  cl: number;
  cd: number;
  /** a front face needs more deflection than δmax: shock detaches, theory fails */
  detached: boolean;
  /** Ackeret (linear) theory for comparison */
  clLinear: number;
  cdLinear: number;
}

/** Process one wave: flow at (M, p, p0) turned by `turn` degrees (> 0 compression, < 0 expansion). */
function wave(M: number, p: number, p0: number, turn: number, g: number): Omit<FaceState, 'dir'> & { detached: boolean } {
  if (Math.abs(turn) < 1e-9) return { wave: 'none', turn: 0, sigma: NaN, M, p, p0, detached: false };
  if (turn > 0) {
    const s = obliqueShock(M, turn, 'weak', g);
    if (s.detached) return { wave: 'shock', turn, sigma: NaN, M: NaN, p: NaN, p0: NaN, detached: true };
    return { wave: 'shock', turn, sigma: s.sigma, M: s.M2, p: p * s.p2_p1, p0: p0 * s.p02_p01, detached: false };
  }
  const e = expansion(M, -turn, g);
  return { wave: 'fan', turn: -turn, sigma: NaN, M: e.M2, p: p * e.p2_p1, p0, detached: false };
}

export function diamondAirfoil(M: number, eps: number, alpha: number, g = 1.4): DiamondResult {
  // upper surface: front face at (ε − α) to the stream; lower: (ε + α)
  const w1 = wave(M, 1, 1, eps - alpha, g);
  const w3 = wave(M, 1, 1, eps + alpha, g);
  const w2 = w1.detached ? w1 : wave(w1.M, w1.p, w1.p0, -2 * eps, g);
  const w4 = w3.detached ? w3 : wave(w3.M, w3.p, w3.p0, -2 * eps, g);
  const faces: DiamondResult['faces'] = [
    { ...w1, dir: eps - alpha },
    { ...w2, dir: -eps - alpha },
    { ...w3, dir: -eps - alpha },
    { ...w4, dir: eps - alpha },
  ];
  const ell = 0.5 / Math.cos(toRad(eps));
  // force = Σ (p − p∞) ℓ (inward normal). Face k makes angle φ with the stream.
  const a1 = toRad(eps - alpha); // upper front: inward normal (sin a1, −cos a1)
  const a2 = toRad(eps + alpha); // upper rear  slopes down at a2: inward normal (−sin a2, −cos a2)
  const a3 = toRad(eps + alpha); // lower front slopes down at a3: inward normal (sin a3, cos a3)
  const a4 = toRad(eps - alpha); // lower rear  slopes up at a4:   inward normal (−sin a4, cos a4)
  const [p1, p2, p3, p4] = faces.map((f) => f.p - 1);
  const D = ell * (p1 * Math.sin(a1) - p2 * Math.sin(a2) + p3 * Math.sin(a3) - p4 * Math.sin(a4));
  const L = ell * (-p1 * Math.cos(a1) - p2 * Math.cos(a2) + p3 * Math.cos(a3) + p4 * Math.cos(a4));
  const q = 0.5 * g * M * M; // q∞ / p∞
  const beta = Math.sqrt(M * M - 1);
  const ar = toRad(alpha);
  const er = toRad(eps);
  return {
    M,
    eps,
    alpha,
    faces,
    ell,
    L,
    D,
    cl: L / q,
    cd: D / q,
    detached: w1.detached || w3.detached,
    clLinear: (4 * ar) / beta,
    cdLinear: (4 * (ar * ar + er * er)) / beta,
  };
}

/** p/p∞ after a P-M turn, via the tables' route: (p/p0)_M2 / (p/p0)_M1 — exported for tests. */
export const pmPressureRatio = (M1: number, turn: number, g = 1.4) => {
  const e = expansion(M1, turn, g);
  return p_p0(e.M2, g) / p_p0(M1, g);
};

export { nu };
