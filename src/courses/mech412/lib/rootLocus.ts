/**
 * Root locus of the characteristic equation 1 + K N(s)/D(s) = 0, K >= 0 (or K <= 0 for the complementary locus).
 * Provides the sketching rules (asymptotes, centroid, breakaway points, jw crossings, departure/arrival angles),
 * tracked branches obtained by sweeping K, and the gain at a chosen damping ratio.
 */
import { C, abs, arg, conj, dist, mul as cmul, neg, sub as csub, toDeg } from './complex';
import { Poly, add, derivative, evalC, mul, roots, scale, sub, trim } from './poly';

/** Characteristic polynomial D(s) + K N(s). */
export const charPoly = (num: Poly, den: Poly, K: number): Poly => add(den, scale(num, K));

/** Closed-loop poles for gain K. */
export const closedLoopPoles = (num: Poly, den: Poly, K: number): C[] => roots(charPoly(num, den, K));

/** K = -D(s)/N(s) evaluated at a complex point (real and positive exactly when s is on the K >= 0 locus). */
export function gainAt(num: Poly, den: Poly, s: C): C {
  const d = evalC(den, s);
  const n = evalC(num, s);
  const nn = n.re * n.re + n.im * n.im;
  const t = cmul(neg(d), conj(n));
  return { re: t.re / nn, im: t.im / nn };
}

export interface Asymptotes {
  /** number of asymptotes n - m */
  count: number;
  /** angles in degrees, e.g. [60, 180, 300] for three asymptotes with K >= 0 */
  anglesDeg: number[];
  /** real-axis intersection (sum of poles - sum of zeros) / (n - m) */
  centroid: number;
}

/** Asymptote angles (2k+1) 180/(n-m) for K >= 0 (or 2k 180/(n-m) for K <= 0) and the centroid. */
export function asymptotes(num: Poly, den: Poly, negativeK = false): Asymptotes {
  const nu = trim(num);
  const de = trim(den);
  const n = de.length - 1;
  const m = nu.length - 1;
  const count = n - m;
  if (count <= 0) return { count: 0, anglesDeg: [], centroid: NaN };
  // sum of roots = -a1/a0 for each polynomial
  const sumP = n >= 1 ? -de[1] / de[0] : 0;
  const sumZ = m >= 1 ? -nu[1] / nu[0] : 0;
  const anglesDeg = Array.from({ length: count }, (_, k) => ((negativeK ? 2 * k : 2 * k + 1) * 180) / count).map((a) => (a > 180 ? a - 360 : a));
  return { count, anglesDeg, centroid: (sumP - sumZ) / count };
}

export interface Breakaway {
  s: C;
  /** gain K = -D/N there (real part) */
  K: number;
  /** real s */
  real: boolean;
  /** real s on the K >= 0 locus (a genuine breakaway / break-in point) */
  onLocus: boolean;
}

/** Candidate breakaway / break-in points: roots of D' N - D N' = 0 (dK/ds = 0), with their gains. */
export function breakawayPoints(num: Poly, den: Poly): Breakaway[] {
  const p = sub(mul(derivative(den), num), mul(den, derivative(num)));
  if (trim(p).length < 2) return [];
  return roots(p).map((s) => {
    const k = gainAt(num, den, s);
    const real = Math.abs(s.im) < 1e-7;
    return { s, K: k.re, real, onLocus: real && k.re > 1e-9 && Math.abs(k.im) < 1e-6 * (1 + Math.abs(k.re)) };
  });
}

export interface JwCrossing {
  w: number;
  K: number;
}

function bisectSign(f: (x: number) => number, a: number, b: number): number {
  let fa = f(a);
  for (let i = 0; i < 200; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
    if (Math.abs(b - a) < 1e-14 * (1 + Math.abs(a))) break;
  }
  return 0.5 * (a + b);
}

/** Scale of the problem: max(1, largest pole or zero magnitude). */
function magScale(num: Poly, den: Poly): number {
  const all = [...(trim(den).length > 1 ? roots(den) : []), ...(trim(num).length > 1 ? roots(num) : [])];
  return Math.max(1, ...all.map(abs));
}

/**
 * Crossings of the imaginary axis for K > 0: values of w > 0 where Im(-D(jw) conj(N(jw))) changes sign
 * (this is the condition that K = -D/N is real), with K = Re(-D conj N)/|N|^2 > 0 kept.
 */
export function jwCrossings(num: Poly, den: Poly): JwCrossing[] {
  const sc = magScale(num, den);
  const h = (w: number) => {
    const s = { re: 0, im: w };
    const t = cmul(neg(evalC(den, s)), conj(evalC(num, s)));
    return t.im;
  };
  const kOf = (w: number) => gainAt(num, den, { re: 0, im: w }).re;
  const out: JwCrossing[] = [];
  const N = 20000;
  const lo = 1e-5 * sc;
  const hi = 1e3 * sc;
  let prevW = lo;
  let prevH = h(lo);
  for (let i = 1; i <= N; i++) {
    const w = lo * Math.pow(hi / lo, i / N);
    const hv = h(w);
    if (prevH !== 0 && Math.sign(hv) !== Math.sign(prevH)) {
      const wc = bisectSign(h, prevW, w);
      const K = kOf(wc);
      if (Number.isFinite(K) && K > 1e-9) out.push({ w: wc, K });
    }
    prevW = w;
    prevH = hv;
  }
  return out;
}

/** Departure angle (degrees, in (-180, 180]) from the k-th pole: 180 + sum angle(p-z) - sum angle(p-other poles). */
export function departureAngleDeg(zeros: C[], poles: C[], k: number): number {
  const p = poles[k];
  let a = 180;
  for (const z of zeros) a += toDeg(arg(csub(p, z)));
  poles.forEach((q, j) => {
    if (j !== k) a -= toDeg(arg(csub(p, q)));
  });
  return wrap180(a);
}

/** Arrival angle (degrees) at the k-th zero: 180 - sum angle(z-other zeros) + sum angle(z-poles). */
export function arrivalAngleDeg(zeros: C[], poles: C[], k: number): number {
  const z = zeros[k];
  let a = 180;
  zeros.forEach((q, j) => {
    if (j !== k) a -= toDeg(arg(csub(z, q)));
  });
  for (const p of poles) a += toDeg(arg(csub(z, p)));
  return wrap180(a);
}

export const wrap180 = (a: number): number => {
  let x = ((a % 360) + 360) % 360;
  if (x > 180) x -= 360;
  return x;
};

export interface Branches {
  K: number[];
  /** paths[b][i] = position of branch b at gain K[i] (branch b starts at the b-th open-loop pole) */
  paths: C[][];
}

/** Minimum-total-distance assignment of the new roots to the previous ones (brute force up to 7 roots, greedy beyond). */
function matchRoots(prev: C[], next: C[]): C[] {
  const n = prev.length;
  if (n <= 7) {
    let best: C[] = next;
    let bestCost = Infinity;
    const used = new Array(n).fill(false);
    const cur: C[] = new Array(n);
    const rec = (i: number, cost: number) => {
      if (cost >= bestCost) return;
      if (i === n) {
        bestCost = cost;
        best = cur.slice();
        return;
      }
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        used[j] = true;
        cur[i] = next[j];
        rec(i + 1, cost + dist(prev[i], next[j]));
        used[j] = false;
      }
    };
    rec(0, 0);
    return best;
  }
  const out: C[] = new Array(n);
  const used = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    let bj = -1;
    let bd = Infinity;
    for (let j = 0; j < n; j++) if (!used[j] && dist(prev[i], next[j]) < bd) ((bd = dist(prev[i], next[j])), (bj = j));
    used[bj] = true;
    out[i] = next[bj];
  }
  return out;
}

/**
 * Sweep K from 0 to Kmax (or 0 to -|Kmax| when Kmax < 0) and track every root. The K grid is quadratic
 * (dense near 0) and is refined adaptively wherever a root moves farther than `maxStep` between samples.
 */
export function rootLocusBranches(num: Poly, den: Poly, Kmax: number, samples = 400, maxStep?: number): Branches {
  const sc = magScale(num, den);
  const step = maxStep ?? 0.05 * sc;
  const n = trim(den).length - 1;
  const Ks: number[] = [0];
  const pts: C[][] = [roots(den)];
  const at = (K: number, prev: C[]) => matchRoots(prev, roots(charPoly(num, den, K)));
  const refine = (Ka: number, ra: C[], Kb: number, depth: number) => {
    const rb = at(Kb, ra);
    const jump = Math.max(...ra.map((r, i) => dist(r, rb[i])));
    if (jump > step && depth < 14) {
      const Km = 0.5 * (Ka + Kb);
      refine(Ka, ra, Km, depth + 1);
      refine(Km, pts[pts.length - 1], Kb, depth + 1);
    } else {
      Ks.push(Kb);
      pts.push(rb);
    }
  };
  for (let i = 1; i <= samples; i++) {
    const Kb = Kmax * Math.pow(i / samples, 2);
    refine(Ks[Ks.length - 1], pts[pts.length - 1], Kb, 0);
  }
  const paths: C[][] = Array.from({ length: n }, (_, b) => pts.map((p) => p[b]));
  return { K: Ks, paths };
}

export interface ZetaPoint {
  s: C;
  K: number;
  wn: number;
}

/**
 * Points of the K >= 0 locus on the constant-damping ray s = wn(-zeta + j sqrt(1 - zeta^2)) and their gains,
 * sorted by K. (Use for "find K for zeta = 0.5"; pick the dominant one = the smallest K.)
 */
export function gainAtZeta(num: Poly, den: Poly, zeta: number): ZetaPoint[] {
  const sc = magScale(num, den);
  const dir = { re: -zeta, im: Math.sqrt(1 - zeta * zeta) };
  const at = (w: number): C => ({ re: dir.re * w, im: dir.im * w });
  const h = (w: number) => cmul(neg(evalC(den, at(w))), conj(evalC(num, at(w)))).im;
  const out: ZetaPoint[] = [];
  const N = 20000;
  const lo = 1e-5 * sc;
  const hi = 1e3 * sc;
  let pw = lo;
  let ph = h(lo);
  for (let i = 1; i <= N; i++) {
    const w = lo * Math.pow(hi / lo, i / N);
    const hv = h(w);
    if (ph !== 0 && Math.sign(hv) !== Math.sign(ph)) {
      const wc = bisectSign(h, pw, w);
      const K = gainAt(num, den, at(wc));
      const nv = evalC(num, at(wc));
      if (K.re > 1e-9 && abs(nv) > 1e-12) out.push({ s: at(wc), K: K.re, wn: wc });
    }
    pw = w;
    ph = hv;
  }
  return out.sort((a, b) => a.K - b.K);
}

/** Closed-loop DC / steady value helpers are in lti.ts; here: is the point s on the K >= 0 locus (angle criterion)? */
export function onLocus(num: Poly, den: Poly, s: C, tolDeg = 1e-3): boolean {
  const k = gainAt(num, den, s);
  return k.re > 0 && Math.abs(toDeg(Math.atan2(k.im, k.re))) < tolDeg;
}
