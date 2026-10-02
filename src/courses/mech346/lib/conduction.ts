/** Steady conduction: thermal resistances, composite walls, cylinders/spheres, heat generation, critical radius. SI units. */
import { SIGMA } from './props';

// ---- single resistances (K/W) -------------------------------------------------------------
export const Rwall = (L: number, k: number, A: number) => L / (k * A);
export const Rcyl = (r1: number, r2: number, k: number, L: number) => Math.log(r2 / r1) / (2 * Math.PI * k * L);
export const Rsph = (r1: number, r2: number, k: number) => (1 / r1 - 1 / r2) / (4 * Math.PI * k);
export const Rconv = (h: number, A: number) => 1 / (h * A);
export const Rcontact = (hc: number, A: number) => 1 / (hc * A);

/** Linearised radiation coefficient h_rad = eps*sigma*(Ts+Tsurr)(Ts^2+Tsurr^2), temperatures in K. */
export const hRad = (eps: number, TsK: number, TsurrK: number) => eps * SIGMA * (TsK + TsurrK) * (TsK * TsK + TsurrK * TsurrK);

export const series = (...R: number[]) => R.reduce((a, b) => a + b, 0);
export const parallel = (...R: number[]) => 1 / R.reduce((a, b) => a + 1 / b, 0);

/** Heat rate through a resistance network between two temperatures. */
export const heatRate = (T1: number, T2: number, Rtot: number) => (T1 - T2) / Rtot;

/** Temperatures at the nodes of a series chain starting at T1: returns [T1, T after R1, ...]. */
export function chainTemps(T1: number, Q: number, R: number[]): number[] {
  const out = [T1];
  for (const r of R) out.push(out[out.length - 1] - Q * r);
  return out;
}

// ---- overall coefficient and insulation ---------------------------------------------------
export const Ucoef = (Rtot: number, A: number) => 1 / (Rtot * A);

/** Critical radius of insulation: cylinder k/h, sphere 2k/h. */
export const rCritCyl = (k: number, h: number) => k / h;
export const rCritSph = (k: number, h: number) => (2 * k) / h;

/** Heat loss per unit length of an insulated pipe (inner wall at Ti already at pipe outer radius r1). */
export function insulatedPipeQ(Ts: number, Tinf: number, r1: number, r2: number, kIns: number, h: number, L = 1): number {
  const R = Rcyl(r1, r2, kIns, L) + Rconv(h, 2 * Math.PI * r2 * L);
  return (Ts - Tinf) / R;
}

// ---- heat generation (uniform e W/m3) -----------------------------------------------------
export interface GenResult {
  Ts: number;
  T0: number;
}
/** Plane wall of thickness 2L, both faces convecting (symmetric). */
export function genPlane(e: number, L: number, k: number, h: number, Tinf: number): GenResult {
  const Ts = Tinf + (e * L) / h;
  return { Ts, T0: Ts + (e * L * L) / (2 * k) };
}
/** Long solid cylinder radius r0. */
export function genCylinder(e: number, r0: number, k: number, h: number, Tinf: number): GenResult {
  const Ts = Tinf + (e * r0) / (2 * h);
  return { Ts, T0: Ts + (e * r0 * r0) / (4 * k) };
}
/** Solid sphere radius r0. */
export function genSphere(e: number, r0: number, k: number, h: number, Tinf: number): GenResult {
  const Ts = Tinf + (e * r0) / (3 * h);
  return { Ts, T0: Ts + (e * r0 * r0) / (6 * k) };
}
/** Radial profiles T(r) for the three geometries: T(r) = Ts + e (r0^2 - r^2)/(2 n k) with n = 1,2,3 in plane/cyl/sph (r->x for plane). */
export function genProfile(kind: 'plane' | 'cyl' | 'sph', e: number, r0: number, k: number, Ts: number, r: number): number {
  const n = kind === 'plane' ? 1 : kind === 'cyl' ? 2 : 3;
  return Ts + (e * (r0 * r0 - r * r)) / (2 * n * k);
}

/** Slab with uniform generation whose faces are at T2 (x=0) and T3 (x=Lg) and with heat flux leaving the faces q0 (left, to -x) and qL (right, to +x). Returns k and e. */
export function slabFromFaces(T2: number, T3: number, Lg: number, qLeft: number, qRight: number): { e: number; k: number; xMax: number; Tmax: number } {
  const e = (qLeft + qRight) / Lg; // energy balance on the slab
  // T(x) = -e x^2/(2k) + c1 x + T2 with k c1 = qLeft  (flux leaving left face: -k dT/dx(0) = -qLeft)
  // T(Lg) = T3 -> k = (e Lg^2/2 - qLeft Lg) / (T2 - T3)
  const k = ((e * Lg * Lg) / 2 - qLeft * Lg) / (T2 - T3);
  const c1 = qLeft / k;
  const xMax = (c1 * k) / e;
  const Tmax = -(e * xMax * xMax) / (2 * k) + c1 * xMax + T2;
  return { e, k, xMax, Tmax };
}

/** Variable conductivity k(T) = k0 (1 + beta (T - T0)): the average k to use with the constant-k formulas is k(Tavg) for a linear law. */
export const kLinear = (k0: number, beta: number, T: number, T0 = 0) => k0 * (1 + beta * (T - T0));
