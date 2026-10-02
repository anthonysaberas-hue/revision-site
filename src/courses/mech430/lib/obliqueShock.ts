/** Oblique shocks (notes Ch. 12). σ = shock angle, δ = deflection angle (degrees in the API). */
import { argmax, bisect, toDeg, toRad } from './solve';
import { My, p0y_p0x, py_px, rhoy_rhox, Ty_Tx } from './normalShock';

/** θ-β-M relation: tan δ = 2 cot σ (M² sin²σ − 1) / (M²(γ + cos 2σ) + 2). Returns δ in degrees. */
export function deltaFromSigma(M: number, sigmaDeg: number, g = 1.4): number {
  const s = toRad(sigmaDeg);
  const num = 2 * (1 / Math.tan(s)) * (M * M * Math.sin(s) ** 2 - 1);
  const den = M * M * (g + Math.cos(2 * s)) + 2;
  return toDeg(Math.atan(num / den));
}

/** Shock angle at maximum deflection (closed form from the notes). */
export function sigmaAtDeltaMax(M: number, g = 1.4): number {
  const M2 = M * M;
  const inner = (g + 1) * (1 + ((g - 1) / 2) * M2 + ((g + 1) / 16) * M2 * M2);
  const s2 = (1 / (g * M2)) * (((g + 1) / 4) * M2 - 1 + Math.sqrt(inner));
  return toDeg(Math.asin(Math.sqrt(s2)));
}

/** Maximum deflection angle for an attached shock. */
export const deltaMax = (M: number, g = 1.4) => deltaFromSigma(M, sigmaAtDeltaMax(M, g), g);

/** Sonic point on the σ–δ curve (downstream M = 1), weak branch side. */
export function sigmaSonic(M: number, g = 1.4): number {
  const sMax = sigmaAtDeltaMax(M, g);
  const mu = toDeg(Math.asin(1 / M));
  const f = (s: number) => downstreamMach(M, s, g) - 1;
  return f(sMax) > 0 ? sMax : bisect(f, mu + 1e-9, sMax);
}

/** Shock angle for a given deflection. Returns NaN if δ > δmax (detached shock). */
export function sigmaFromDelta(M: number, deltaDeg: number, branch: 'weak' | 'strong' = 'weak', g = 1.4): number {
  const mu = toDeg(Math.asin(1 / M));
  if (deltaDeg <= 0) return branch === 'weak' ? mu : 90;
  const sMax = sigmaAtDeltaMax(M, g);
  const dMax = deltaFromSigma(M, sMax, g);
  if (deltaDeg > dMax) return NaN;
  const f = (s: number) => deltaFromSigma(M, s, g) - deltaDeg;
  return branch === 'weak' ? bisect(f, mu + 1e-10, sMax) : bisect(f, sMax, 90 - 1e-10);
}

/** Downstream Mach number M2 = Mn2 / sin(σ − δ). */
export function downstreamMach(M: number, sigmaDeg: number, g = 1.4): number {
  const d = deltaFromSigma(M, sigmaDeg, g);
  const Mn1 = M * Math.sin(toRad(sigmaDeg));
  return My(Mn1, g) / Math.sin(toRad(sigmaDeg - d));
}

export interface ObliqueResult {
  M1: number;
  delta: number;
  sigma: number;
  Mn1: number;
  Mn2: number;
  M2: number;
  p2_p1: number;
  T2_T1: number;
  rho2_rho1: number;
  p02_p01: number;
  detached: boolean;
}

export function obliqueShock(M1: number, deltaDeg: number, branch: 'weak' | 'strong' = 'weak', g = 1.4): ObliqueResult {
  const sigma = sigmaFromDelta(M1, deltaDeg, branch, g);
  if (!isFinite(sigma)) {
    return { M1, delta: deltaDeg, sigma: NaN, Mn1: NaN, Mn2: NaN, M2: NaN, p2_p1: NaN, T2_T1: NaN, rho2_rho1: NaN, p02_p01: NaN, detached: true };
  }
  return obliqueFromSigma(M1, sigma, g);
}

export function obliqueFromSigma(M1: number, sigmaDeg: number, g = 1.4): ObliqueResult {
  const delta = deltaFromSigma(M1, sigmaDeg, g);
  const Mn1 = M1 * Math.sin(toRad(sigmaDeg));
  const Mn2 = My(Mn1, g);
  return {
    M1,
    delta,
    sigma: sigmaDeg,
    Mn1,
    Mn2,
    M2: Mn2 / Math.sin(toRad(sigmaDeg - delta)),
    p2_p1: py_px(Mn1, g),
    T2_T1: Ty_Tx(Mn1, g),
    rho2_rho1: rhoy_rhox(Mn1, g),
    p02_p01: p0y_p0x(Mn1, g),
    detached: false,
  };
}

/** Shock angle from a required pressure ratio (weak side automatically since p ratio fixes Mn1). */
export function sigmaFromPressureRatio(M1: number, pr: number, g = 1.4): number {
  const Mn1 = Math.sqrt((pr * (g + 1) + (g - 1)) / (2 * g));
  return toDeg(Math.asin(Mn1 / M1));
}

/** Samples of the σ–δ curve for plotting the θ-β-M chart. */
export function sigmaDeltaCurve(M: number, n = 120, g = 1.4): { sigma: number; delta: number }[] {
  const mu = toDeg(Math.asin(1 / M));
  const out: { sigma: number; delta: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const s = mu + ((90 - mu) * i) / n;
    out.push({ sigma: s, delta: Math.max(0, deltaFromSigma(M, s, g)) });
  }
  return out;
}

/** Numerical check helper for δmax (used by tests). */
export const deltaMaxNumeric = (M: number, g = 1.4) => {
  const mu = toDeg(Math.asin(1 / M));
  const s = argmax((x) => deltaFromSigma(M, x, g), mu, 90);
  return { sigma: s, delta: deltaFromSigma(M, s, g) };
};
