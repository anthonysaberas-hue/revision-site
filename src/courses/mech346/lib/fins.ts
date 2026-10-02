/** Extended surfaces (fins): straight rectangular / pin fins with uniform cross-section. SI units. */

export interface FinGeom {
  P: number; // perimeter m
  Ac: number; // cross-section area m2
  L: number; // length m
}

export const rectFin = (w: number, t: number, L: number): FinGeom => ({ P: 2 * (w + t), Ac: w * t, L });
export const pinFin = (D: number, L: number): FinGeom => ({ P: Math.PI * D, Ac: (Math.PI * D * D) / 4, L });

export const finM = (h: number, k: number, g: FinGeom) => Math.sqrt((h * g.P) / (k * g.Ac));
/** Corrected length for a convecting tip. */
export const correctedLength = (g: FinGeom) => g.L + g.Ac / g.P;

export type TipBC = 'adiabatic' | 'convective' | 'infinite' | 'corrected';

export interface FinResult {
  m: number;
  Q: number; // W
  Qmax: number; // W
  eta: number;
  eps: number;
  tipTemp: number; // °C
}

/** Heat rate and metrics for a fin of base temperature Tb in fluid (Tinf, h). */
export function finAnalysis(g: FinGeom, k: number, h: number, Tb: number, Tinf: number, tip: TipBC): FinResult {
  const m = finM(h, k, g);
  const th = Tb - Tinf;
  const M = Math.sqrt(h * g.P * k * g.Ac) * th;
  let Q: number;
  let Lfin = g.L;
  let tipTheta: number;
  if (tip === 'infinite') {
    Q = M;
    tipTheta = 0;
  } else if (tip === 'adiabatic') {
    Q = M * Math.tanh(m * g.L);
    tipTheta = th / Math.cosh(m * g.L);
  } else if (tip === 'corrected') {
    Lfin = correctedLength(g);
    Q = M * Math.tanh(m * Lfin);
    tipTheta = th / Math.cosh(m * g.L); // approximate (adiabatic at corrected length)
  } else {
    const hmk = h / (m * k);
    const sh = Math.sinh(m * g.L);
    const ch = Math.cosh(m * g.L);
    Q = (M * (sh + hmk * ch)) / (ch + hmk * sh);
    tipTheta = th / (ch + hmk * sh);
  }
  const area = g.P * (tip === 'corrected' ? Lfin : g.L); // lateral surface area (corrected length includes the tip)
  const Qmax = h * area * th;
  return { m, Q, Qmax, eta: Q / Qmax, eps: Q / (h * g.Ac * th), tipTemp: Tinf + tipTheta };
}

/** Temperature along an adiabatic-tip fin. */
export function finProfileAdiabatic(g: FinGeom, k: number, h: number, Tb: number, Tinf: number, x: number): number {
  const m = finM(h, k, g);
  return Tinf + ((Tb - Tinf) * Math.cosh(m * (g.L - x))) / Math.cosh(m * g.L);
}

/** Efficiency of an adiabatic-tip fin from m L (or m Lc). */
export const etaAdiabatic = (mL: number) => (mL < 1e-9 ? 1 : Math.tanh(mL) / mL);

/** Array of N identical fins on a base: total heat rate and overall surface efficiency. */
export function finArray(opts: { N: number; Afin: number; Aunfin: number; etaFin: number; h: number; Tb: number; Tinf: number }) {
  const { N, Afin, Aunfin, etaFin, h, Tb, Tinf } = opts;
  const Atotal = Aunfin + N * Afin;
  const Q = h * (Aunfin + N * etaFin * Afin) * (Tb - Tinf);
  const etaOverall = 1 - ((N * Afin) / Atotal) * (1 - etaFin);
  return { Atotal, Q, etaOverall };
}

/** Efficiency of an annular (circular) fin of constant thickness t, inner radius r1, outer radius r2 (use r2 + t/2 for a convecting tip). */
import { I0, I1, K0, K1 } from './special';
export function etaAnnular(h: number, k: number, t: number, r1: number, r2c: number): number {
  const m = Math.sqrt((2 * h) / (k * t));
  const num = ((2 * r1) / (m * (r2c * r2c - r1 * r1))) * (K1(m * r1) * I1(m * r2c) - I1(m * r1) * K1(m * r2c));
  const den = I0(m * r1) * K1(m * r2c) + K0(m * r1) * I1(m * r2c);
  return num / den;
}
