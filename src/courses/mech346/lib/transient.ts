/** Transient conduction: lumped systems, one-term solutions (plane wall, long cylinder, sphere), product solutions, semi-infinite solids. */
import { J0, J1, bisect, erfc } from './special';

// ---- lumped system ------------------------------------------------------------------------
export const Lc = (V: number, As: number) => V / As;
export const biot = (h: number, L: number, k: number) => (h * L) / k;
export const lumpedOK = (Bi: number) => Bi <= 0.1;
/** b = h As / (rho V cp)  [1/s]; time constant = 1/b. */
export const lumpedB = (h: number, As: number, rho: number, V: number, cp: number) => (h * As) / (rho * V * cp);
export const lumpedT = (t: number, Ti: number, Tinf: number, b: number) => Tinf + (Ti - Tinf) * Math.exp(-b * t);
export const lumpedTime = (T: number, Ti: number, Tinf: number, b: number) => -Math.log((T - Tinf) / (Ti - Tinf)) / b;
export const lumpedQ = (t: number, Ti: number, Tinf: number, b: number, rho: number, V: number, cp: number) => rho * V * cp * (lumpedT(t, Ti, Tinf, b) - Ti);

// ---- one-term solutions -------------------------------------------------------------------
export type Geom = 'wall' | 'cylinder' | 'sphere';

/** Smallest root lambda1 of the characteristic equation: wall: l tan l = Bi; cylinder: l J1(l)/J0(l) = Bi; sphere: 1 - l cot l = Bi. */
export function lambda1(geom: Geom, Bi: number): number {
  if (Bi <= 0) return 0;
  if (geom === 'wall') {
    return bisect((l) => l * Math.tan(l) - Bi, 1e-9, Math.PI / 2 - 1e-9);
  }
  if (geom === 'cylinder') {
    // l J1/J0 increases from 0 to infinity on (0, 2.4048)
    return bisect((l) => (l * J1(l)) / J0(l) - Bi, 1e-9, 2.404825557695773 - 1e-9);
  }
  // sphere: 1 - l/tan(l) increases from 0 to infinity on (0, pi)
  return bisect((l) => 1 - l / Math.tan(l) - Bi, 1e-9, Math.PI - 1e-9);
}

export function A1(geom: Geom, l: number): number {
  if (geom === 'wall') return (4 * Math.sin(l)) / (2 * l + Math.sin(2 * l));
  if (geom === 'cylinder') return (2 * J1(l)) / (l * (J0(l) * J0(l) + J1(l) * J1(l)));
  return (4 * (Math.sin(l) - l * Math.cos(l))) / (2 * l - Math.sin(2 * l));
}

export interface OneTerm {
  Bi: number;
  lambda: number;
  A1: number;
  tau: number;
  theta0: number; // centre dimensionless temperature A1 exp(-l^2 tau)
}

/** Fo = alpha t / L^2 (L = half thickness or radius). */
export const fourier = (alpha: number, t: number, L: number) => (alpha * t) / (L * L);

export function oneTerm(geom: Geom, Bi: number, tau: number): OneTerm {
  const l = lambda1(geom, Bi);
  const a = A1(geom, l);
  return { Bi, lambda: l, A1: a, tau, theta0: a * Math.exp(-l * l * tau) };
}

/** Spatial factor at relative position xi = x/L (wall) or r/r0 (cyl, sph): theta/theta0. */
export function spatial(geom: Geom, l: number, xi: number): number {
  if (geom === 'wall') return Math.cos(l * xi);
  if (geom === 'cylinder') return J0(l * xi);
  const z = l * xi;
  return z < 1e-9 ? 1 : Math.sin(z) / z;
}

/** Dimensionless temperature theta at relative position xi. */
export const thetaAt = (geom: Geom, o: OneTerm, xi: number) => o.theta0 * spatial(geom, o.lambda, xi);

/** Q/Qmax for one-term solution. */
export function QoverQmax(geom: Geom, o: OneTerm): number {
  const l = o.lambda;
  if (geom === 'wall') return 1 - (o.theta0 * Math.sin(l)) / l;
  if (geom === 'cylinder') return 1 - (2 * o.theta0 * J1(l)) / l;
  return 1 - (3 * o.theta0 * (Math.sin(l) - l * Math.cos(l))) / (l * l * l);
}

/** Product solution for multidimensional bodies: dimensionless temperatures multiply. */
export const productTheta = (...thetas: number[]) => thetas.reduce((a, b) => a * b, 1);
/** Q/Qmax of two combined 1D solutions: 1 + 2 combined. */
export const QproductTwo = (q1: number, q2: number) => q1 + q2 * (1 - q1);
export const QproductThree = (q1: number, q2: number, q3: number) => q1 + q2 * (1 - q1) + q3 * (1 - q1) * (1 - q2);

/** Exact (series) solution for the plane wall with n terms, for checking the one-term error. */
export function wallSeries(Bi: number, tau: number, xi: number, nTerms = 8): number {
  let sum = 0;
  for (let n = 0; n < nTerms; n++) {
    const lo = n * Math.PI + 1e-9;
    const hi = n * Math.PI + Math.PI / 2 - 1e-9;
    const l = bisect((x) => x * Math.tan(x) - Bi, lo, hi);
    const A = (4 * Math.sin(l)) / (2 * l + Math.sin(2 * l));
    sum += A * Math.exp(-l * l * tau) * Math.cos(l * xi);
  }
  return sum;
}

// ---- semi-infinite solid ------------------------------------------------------------------
/** Constant surface temperature Ts: (T - Ts)/(Ti - Ts) = erf(x / 2 sqrt(alpha t)). */
export function semiInfiniteTs(x: number, t: number, alpha: number, Ti: number, Ts: number): number {
  const eta = x / (2 * Math.sqrt(alpha * t));
  return Ts + (Ti - Ts) * (1 - erfc(eta));
}
/** Constant surface flux q0 (W/m2). */
export function semiInfiniteQ(x: number, t: number, alpha: number, k: number, Ti: number, q0: number): number {
  const s = 2 * Math.sqrt(alpha * t);
  return Ti + ((2 * q0 * Math.sqrt(alpha * t / Math.PI)) / k) * Math.exp(-(x * x) / (4 * alpha * t)) - ((q0 * x) / k) * erfc(x / s);
}
/** Convection to a fluid (Tinf, h): (T - Ti)/(Tinf - Ti) = erfc(eta) - exp(h x/k + h^2 alpha t/k^2) erfc(eta + h sqrt(alpha t)/k). */
export function semiInfiniteConv(x: number, t: number, alpha: number, k: number, h: number, Ti: number, Tinf: number): number {
  const eta = x / (2 * Math.sqrt(alpha * t));
  const hb = (h * Math.sqrt(alpha * t)) / k;
  const e = erfc(eta) - Math.exp((h * x) / k + hb * hb) * erfc(eta + hb);
  return Ti + (Tinf - Ti) * e;
}
/** Contact temperature of two semi-infinite solids initially at TA and TB. */
export function contactTemp(TA: number, kA: number, rhoA: number, cA: number, TB: number, kB: number, rhoB: number, cB: number): number {
  const eA = Math.sqrt(kA * rhoA * cA);
  const eB = Math.sqrt(kB * rhoB * cB);
  return (eA * TA + eB * TB) / (eA + eB);
}
/** Penetration depth estimate 2 sqrt(alpha t). */
export const penetration = (alpha: number, t: number) => 2 * Math.sqrt(alpha * t);
