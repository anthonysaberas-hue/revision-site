/**
 * Routh-Hurwitz stability test.
 * `routhArray` builds the array with the two special cases:
 *  - first element of a row is zero but the row is not: replaced by a small positive epsilon;
 *  - a whole row is zero: the auxiliary polynomial from the row above is differentiated and used instead.
 * `stableKRange` scans a parametric characteristic polynomial for the gain interval(s) where it is Hurwitz.
 */
import { Poly, trim } from './poly';

export interface RouthResult {
  /** powers[i] is the power of s labelling rows[i] (n, n-1, ..., 0) */
  powers: number[];
  rows: number[][];
  /** sign changes in the first column = number of right-half-plane roots */
  signChanges: number;
  /** same as signChanges (RHP roots, counted with multiplicity) */
  rhpRoots: number;
  /** roots on the j-omega axis implied by the auxiliary polynomial (outermost one); 0 if none */
  imagRoots: number;
  /** row indices where epsilon replaced a zero first element */
  epsilonRows: number[];
  /** row indices that were all zero and were replaced by the derivative of the auxiliary polynomial */
  zeroRows: number[];
  /** auxiliary polynomials (highest power first, full length with zero coefficients for missing powers) */
  auxiliaries: Poly[];
  /** the epsilon actually used */
  epsilon: number;
  /** true when the polynomial has a zero row or an epsilon (roots on the imaginary axis possible) */
  special: boolean;
  /** strictly Hurwitz: no sign change, no zero row, no zero first-column element */
  stable: boolean;
}

const isZeroRow = (r: number[], tol: number) => r.every((v) => Math.abs(v) <= tol);

export function routhArray(coeffs: Poly, epsilonRel = 1e-9): RouthResult {
  const p = trim(coeffs);
  const n = p.length - 1;
  const scale = Math.max(...p.map(Math.abs)) || 1;
  const tol = 1e-12 * scale;
  const eps = epsilonRel * scale;
  const cols = Math.ceil((n + 1) / 2) + 1;
  const mk = (src: number[]) => {
    const r = new Array<number>(cols).fill(0);
    src.forEach((v, j) => (r[j] = v));
    return r;
  };
  const rows: number[][] = [];
  const powers: number[] = [];
  const epsilonRows: number[] = [];
  const zeroRows: number[] = [];
  const auxiliaries: Poly[] = [];
  const auxRowIndex: number[] = [];

  const fix = (i: number) => {
    const r = rows[i];
    if (isZeroRow(r, tol)) {
      // auxiliary polynomial from the row above (row i-1, power p_prev); derivative coefficients replace row i
      if (i === 0) return;
      const pPrev = powers[i - 1];
      const prev = rows[i - 1];
      const aux: number[] = [];
      for (let j = 0; j * 2 <= pPrev; j++) {
        aux.push(prev[j]);
        if (2 * j + 2 <= pPrev) aux.push(0);
      }
      auxiliaries.push(aux);
      auxRowIndex.push(i - 1);
      zeroRows.push(i);
      rows[i] = mk(prev.map((v, j) => (2 * j <= pPrev ? v * (pPrev - 2 * j) : 0)));
    } else if (Math.abs(r[0]) <= tol) {
      rows[i][0] = eps;
      epsilonRows.push(i);
    }
  };

  rows.push(mk(p.filter((_, i) => i % 2 === 0)));
  powers.push(n);
  if (n >= 1) {
    rows.push(mk(p.filter((_, i) => i % 2 === 1)));
    powers.push(n - 1);
  }
  fix(0);
  if (n >= 1) fix(1);
  for (let i = 2; i <= n; i++) {
    const a = rows[i - 2];
    const b = rows[i - 1];
    const r = new Array<number>(cols).fill(0);
    for (let j = 0; j < cols - 1; j++) r[j] = (b[0] * a[j + 1] - a[0] * b[j + 1]) / b[0];
    rows.push(r);
    powers.push(n - i);
    fix(i);
  }

  const first = rows.map((r) => r[0]);
  const changesFrom = (from: number) => {
    let c = 0;
    for (let i = from + 1; i < first.length; i++) if (Math.sign(first[i]) * Math.sign(first[i - 1]) < 0) c++;
    return c;
  };
  const signChanges = changesFrom(0);
  let imagRoots = 0;
  if (auxiliaries.length) {
    const aux = auxiliaries[0];
    imagRoots = Math.max(0, aux.length - 1 - 2 * changesFrom(auxRowIndex[0]));
  }
  return {
    powers,
    rows: rows.map((r, i) => r.slice(0, Math.floor(powers[i] / 2) + 1)),
    signChanges,
    rhpRoots: signChanges,
    imagRoots,
    epsilonRows,
    zeroRows,
    auxiliaries,
    epsilon: eps,
    special: zeroRows.length > 0 || epsilonRows.length > 0,
    stable: signChanges === 0 && zeroRows.length === 0 && epsilonRows.length === 0 && first.every((v) => Math.abs(v) > tol),
  };
}

/** True when all roots are strictly in the left half plane (by the Routh criterion). */
export const isHurwitz = (coeffs: Poly): boolean => {
  const p = trim(coeffs);
  if (p.length === 1) return true;
  if (p.some((a) => a === 0) || !p.every((a) => Math.sign(a) === Math.sign(p[0]))) return false; // necessary condition
  return routhArray(p).stable;
};

export interface KRange {
  /** maximal intervals [lo, hi] of K for which the polynomial is Hurwitz (boundaries refined by bisection) */
  intervals: [number, number][];
}

/**
 * Stable-gain intervals of a parametric characteristic polynomial: scan K on [kMin, kMax], then bisect every
 * stable/unstable transition. Example: `stableKRange((K) => [1, 3, 2, K], -5, 20)` gives [[0, 6]].
 */
export function stableKRange(charPoly: (K: number) => Poly, kMin: number, kMax: number, samples = 4000, stableFn: (p: Poly) => boolean = isHurwitz): KRange {
  const ok = (K: number) => stableFn(charPoly(K));
  const ks = Array.from({ length: samples + 1 }, (_, i) => kMin + ((kMax - kMin) * i) / samples);
  const st = ks.map(ok);
  const refine = (a: number, b: number, stableAtA: boolean): number => {
    let lo = a;
    let hi = b;
    for (let i = 0; i < 100 && hi - lo > 1e-12 * (1 + Math.abs(lo)); i++) {
      const m = 0.5 * (lo + hi);
      if (ok(m) === stableAtA) lo = m;
      else hi = m;
    }
    return 0.5 * (lo + hi);
  };
  const intervals: [number, number][] = [];
  let start: number | null = st[0] ? kMin : null;
  for (let i = 1; i < ks.length; i++) {
    if (st[i] !== st[i - 1]) {
      const b = refine(ks[i - 1], ks[i], st[i - 1]);
      if (st[i]) start = b;
      else {
        intervals.push([start ?? kMin, b]);
        start = null;
      }
    }
  }
  if (start !== null) intervals.push([start, kMax]);
  return { intervals };
}
