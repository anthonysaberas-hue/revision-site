/** Thermal radiation: blackbody laws, view factors, grey-diffuse network solutions. Temperatures in K unless noted. */
import { SIGMA } from './props';
import { solveLinear } from './special';

export const C1 = 3.7418e8; // W.um^4/m2
export const C2 = 14388; // um.K
export const WIEN = 2897.8; // um.K

export const Eb = (TK: number) => SIGMA * TK ** 4;
export const planck = (lambdaUm: number, TK: number) => C1 / (lambdaUm ** 5 * (Math.exp(C2 / (lambdaUm * TK)) - 1));
export const lambdaMax = (TK: number) => WIEN / TK;

/** Fraction of blackbody emission below wavelength*T (um.K): numerical integration of Planck's law. */
export function bandFraction(lambdaT: number): number {
  if (lambdaT <= 0) return 0;
  // integrate in x = C2/(lambda T): f = (15/pi^4) * int_x^inf x^3/(e^x - 1) dx
  const x0 = C2 / lambdaT;
  let sum = 0;
  const n = 4000;
  const xMax = Math.max(x0 + 60, 80);
  const h = (xMax - x0) / n;
  const g = (x: number) => (x < 1e-12 ? 0 : (x * x * x) / (Math.exp(x) - 1));
  for (let i = 0; i <= n; i++) {
    const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    sum += w * g(x0 + i * h);
  }
  return ((15 / Math.PI ** 4) * sum * h) / 3;
}
export const bandBetween = (l1: number, l2: number, TK: number) => bandFraction(l2 * TK) - bandFraction(l1 * TK);

/** Net radiation from a small grey surface to large surroundings. */
export const qSurr = (eps: number, A: number, Ts: number, Tsurr: number) => eps * A * SIGMA * (Ts ** 4 - Tsurr ** 4);

// ---- two-surface enclosures ---------------------------------------------------------------
/** General two-surface enclosure: Q12 = sigma (T1^4 - T2^4) / ( (1-e1)/(A1 e1) + 1/(A1 F12) + (1-e2)/(A2 e2) ). */
export function twoSurface(T1: number, T2: number, e1: number, e2: number, A1: number, A2: number, F12: number): number {
  const R = (1 - e1) / (A1 * e1) + 1 / (A1 * F12) + (1 - e2) / (A2 * e2);
  return (SIGMA * (T1 ** 4 - T2 ** 4)) / R;
}
export const parallelPlates = (T1: number, T2: number, e1: number, e2: number, A: number) => (A * SIGMA * (T1 ** 4 - T2 ** 4)) / (1 / e1 + 1 / e2 - 1);
export const concentricCyl = (T1: number, T2: number, e1: number, e2: number, A1: number, A2: number) => (A1 * SIGMA * (T1 ** 4 - T2 ** 4)) / (1 / e1 + ((1 - e2) / e2) * (A1 / A2));
/** N radiation shields with emissivity eShield on both sides between parallel plates. */
export const withShields = (T1: number, T2: number, e1: number, e2: number, eS: number, N: number, A = 1) => (A * SIGMA * (T1 ** 4 - T2 ** 4)) / (1 / e1 + 1 / e2 - 1 + N * (2 / eS - 1));
/** Temperature of a single shield between two parallel plates (equal-emissivity result is the mean of T^4). */
export const shieldTemp = (T1: number, T2: number) => Math.pow((T1 ** 4 + T2 ** 4) / 2, 0.25);

// ---- view factors -------------------------------------------------------------------------
export const reciprocity = (A1: number, F12: number, A2: number) => (A1 * F12) / A2;
/** Aligned parallel rectangles a x b separated by c. */
export function F_parallelRect(a: number, b: number, c: number): number {
  const X = a / c;
  const Y = b / c;
  const s1 = Math.sqrt(1 + Y * Y);
  const s2 = Math.sqrt(1 + X * X);
  return (
    (2 / (Math.PI * X * Y)) *
    (Math.log(Math.sqrt(((1 + X * X) * (1 + Y * Y)) / (1 + X * X + Y * Y))) + X * s1 * Math.atan(X / s1) + Y * s2 * Math.atan(Y / s2) - X * Math.atan(X) - Y * Math.atan(Y))
  );
}
/** Perpendicular rectangles sharing a common edge of length x; surface 1 is y wide, surface 2 is z wide (F12). */
export function F_perpRect(x: number, y: number, z: number): number {
  const H = z / x;
  const W = y / x;
  const a = (1 + W * W) * (1 + H * H) / (1 + W * W + H * H);
  const b = Math.pow((W * W * (1 + W * W + H * H)) / ((1 + W * W) * (W * W + H * H)), W * W);
  const c = Math.pow((H * H * (1 + H * H + W * W)) / ((1 + H * H) * (H * H + W * W)), H * H);
  const r = Math.sqrt(H * H + W * W);
  return (1 / (Math.PI * W)) * (W * Math.atan(1 / W) + H * Math.atan(1 / H) - r * Math.atan(1 / r) + 0.25 * Math.log(a * b * c));
}
/** Coaxial parallel disks of radii r1, r2 separated by L: F12. */
export function F_disks(r1: number, r2: number, L: number): number {
  const R1 = r1 / L;
  const R2 = r2 / L;
  const S = 1 + (1 + R2 * R2) / (R1 * R1);
  return 0.5 * (S - Math.sqrt(S * S - 4 * (R2 / R1) ** 2));
}

// ---- N-surface grey-diffuse enclosure -----------------------------------------------------
export interface Surface {
  A: number;
  eps: number;
  /** temperature in K (if prescribed) */
  T?: number;
  /** net heat rate in W leaving the surface (if prescribed; 0 for a reradiating surface) */
  Q?: number;
}
export interface EnclosureResult {
  J: number[];
  Q: number[]; // net radiation leaving each surface, W
  T: number[]; // surface temperatures K
}
/** Solve for radiosities J_i given F[i][j]. Surfaces specify T or Q. */
export function enclosure(S: Surface[], F: number[][]): EnclosureResult {
  const n = S.length;
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const s = S[i];
    // Q_i = A_i sum_j F_ij (J_i - J_j)
    if (s.T !== undefined) {
      // black: J = Eb; grey: J_i = eps Eb + (1-eps) sum F_ij J_j
      A[i][i] += 1;
      for (let j = 0; j < n; j++) A[i][j] -= (1 - s.eps) * F[i][j];
      b[i] = s.eps * Eb(s.T);
    } else {
      // prescribed Q: Q/A = J_i - sum F_ij J_j
      A[i][i] += 1;
      for (let j = 0; j < n; j++) A[i][j] -= F[i][j];
      b[i] = (s.Q ?? 0) / s.A;
    }
  }
  const J = solveLinear(A, b);
  const Q = S.map((s, i) => s.A * (J[i] - F[i].reduce((a, f, j) => a + f * J[j], 0)));
  const T = S.map((s, i) => (s.T !== undefined ? s.T : Math.pow((J[i] + ((1 - s.eps) / s.eps) * (Q[i] / s.A)) / SIGMA, 0.25)));
  return { J, Q, T };
}
