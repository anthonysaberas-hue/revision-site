/**
 * Oblique-shock reflection from a straight wall (notes §12.3–12.6): regular reflection,
 * Mach reflection (triple point from the shock polars) and the transition criteria.
 * Angles in degrees. Region numbering follows the notes:
 *   1 = free stream, 2 = behind the incident shock,
 *   regular reflection: 3 = behind the reflected shock (parallel to the wall again);
 *   Mach reflection:    3 = behind the Mach stem, 4 = behind the reflected shock.
 */
import { bisect } from './solve';
import { py_px } from './normalShock';
import { deltaFromSigma, deltaMax, obliqueFromSigma, obliqueShock, ObliqueResult, sigmaAtDeltaMax, sigmaFromDelta } from './obliqueShock';

const muDeg = (M: number) => (Math.asin(1 / M) * 180) / Math.PI;

export interface PolarPoint {
  sigma: number;
  delta: number;
  /** pressure ratio across this shock alone */
  pr: number;
}

/** Shock polar (p_y/p_x vs δ) of one shock with upstream Mach M, traced by σ from μ to 90°. */
export function shockPolar(M: number, n = 160, g = 1.4): PolarPoint[] {
  const mu = muDeg(M);
  const out: PolarPoint[] = [];
  for (let i = 0; i <= n; i++) {
    // cluster points near both ends of the curve
    const t = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
    const s = mu + (90 - mu) * t;
    out.push({ sigma: s, delta: Math.max(0, deltaFromSigma(M, s, g)), pr: py_px(M * Math.sin((s * Math.PI) / 180), g) });
  }
  return out;
}

export interface RegularReflection {
  incident: ObliqueResult;
  reflected: ObliqueResult;
  /** p3/p1 = (p3/p2)(p2/p1) */
  p3_p1: number;
  M3: number;
}

/** Regular reflection: the reflected shock must turn region-2 flow back by δ1 (weak branch). Null if impossible. */
export function regularReflection(M1: number, delta1: number, g = 1.4): RegularReflection | null {
  const incident = obliqueShock(M1, delta1, 'weak', g);
  if (incident.detached || incident.M2 <= 1) return null;
  const reflected = obliqueShock(incident.M2, delta1, 'weak', g);
  if (reflected.detached) return null;
  return { incident, reflected, p3_p1: incident.p2_p1 * reflected.p2_p1, M3: reflected.M2 };
}

export interface MachReflection {
  incident: ObliqueResult;
  /** Mach stem: strong-branch shock in the free stream */
  stem: ObliqueResult;
  /** reflected shock in region-2 flow */
  reflected: ObliqueResult;
  /** net flow deflection behind the triple point (δ3 = δ2 − δ4), measured from the free-stream direction */
  delta3: number;
  /** turning by the reflected shock, δ4 */
  delta4: number;
  /** common pressure p3 = p4, divided by p1 */
  p_p1: number;
}

/**
 * Mach reflection at the triple point: pressure and flow direction must match across the slip line,
 * i.e. the reflected polar (centred on state 2) meets the strong branch of the incident / Mach-stem polar.
 * Returns null when the polars do not intersect (von Neumann paradox region) or the incident shock is detached.
 */
export function machReflection(M1: number, delta1: number, g = 1.4): MachReflection | null {
  const incident = obliqueShock(M1, delta1, 'weak', g);
  if (incident.detached || incident.M2 <= 1) return null;
  const M2 = incident.M2;
  const dmax1 = deltaMax(M1, g);
  const sStar1 = sigmaAtDeltaMax(M1, g);
  // pressure on the strong branch of the free-stream polar for a net deflection |d|
  const stemP = (d: number) => {
    if (d < -1e-6) return NaN; // stem must deflect the flow toward the wall side (δ3 ≥ 0)
    const a = Math.max(0, d);
    if (a > dmax1) return NaN;
    const s = a < 1e-9 ? 90 : bisect((x) => deltaFromSigma(M1, x, g) - a, sStar1, 90 - 1e-10);
    return py_px(M1 * Math.sin((s * Math.PI) / 180), g);
  };
  const mu2 = muDeg(M2);
  const f = (sr: number) => {
    const dr = Math.max(0, deltaFromSigma(M2, sr, g));
    const net = delta1 - dr;
    const P = incident.p2_p1 * py_px(M2 * Math.sin((sr * Math.PI) / 180), g);
    return P - stemP(net);
  };
  const N = 400;
  let prev = f(mu2 + 1e-6);
  let prevS = mu2 + 1e-6;
  for (let i = 1; i <= N; i++) {
    const s = mu2 + ((90 - mu2) * i) / N - (i === N ? 1e-9 : 0);
    const v = f(s);
    if (isFinite(prev) && isFinite(v) && Math.sign(v) !== Math.sign(prev)) {
      const sr = bisect(f, prevS, s);
      const reflected = obliqueFromSigma(M2, sr, g);
      const delta4 = reflected.delta;
      const delta3 = delta1 - delta4;
      const sStem = Math.abs(delta3) < 1e-9 ? 90 : bisect((x) => deltaFromSigma(M1, x, g) - Math.abs(delta3), sStar1, 90 - 1e-10);
      const stem = obliqueFromSigma(M1, sStem, g);
      return { incident, stem, reflected, delta3, delta4, p_p1: incident.p2_p1 * reflected.p2_p1 };
    }
    prev = v;
    prevS = s;
  }
  return null;
}

/** Detachment criterion: largest δ1 for which the reflected shock can still turn the flow back (δ1 = δmax(M2)). */
export function detachmentDelta(M1: number, g = 1.4): number {
  const f = (d: number) => {
    const inc = obliqueShock(M1, d, 'weak', g);
    if (!(inc.M2 > 1)) return -d;
    return deltaMax(inc.M2, g) - d;
  };
  return bisect(f, 0.01, deltaMax(M1, g) - 1e-6);
}

/** Sonic criterion: δ1 at which the flow behind the (weak) reflected shock is exactly sonic. */
export function sonicDelta(M1: number, g = 1.4): number {
  const dDet = detachmentDelta(M1, g);
  const f = (d: number) => {
    const r = regularReflection(M1, d, g);
    return r ? r.M3 - 1 : -1;
  };
  return bisect(f, 0.01, dDet - 1e-7);
}

/** Mechanical-equilibrium (von Neumann) criterion: regular-reflection pressure equals the normal-shock pressure. */
export function vonNeumannDelta(M1: number, g = 1.4): number {
  const pNormal = py_px(M1, g);
  const dDet = detachmentDelta(M1, g);
  const f = (d: number) => {
    const r = regularReflection(M1, d, g);
    return r ? r.p3_p1 - pNormal : 1;
  };
  if (f(dDet - 1e-6) < 0) return NaN; // criterion does not exist (weak shocks, M below ≈ 2.2)
  return bisect(f, 0.01, dDet - 1e-6);
}

/** Incident shock angle for a deflection (weak branch) — convenience for the criteria readouts. */
export const incidentSigma = (M1: number, delta1: number, g = 1.4) => sigmaFromDelta(M1, delta1, 'weak', g);
