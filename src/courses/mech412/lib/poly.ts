/**
 * Polynomials with real coefficients, stored highest power first (MATLAB convention):
 * `[1, 3, 2]` is s^2 + 3 s + 2. Complex-coefficient helpers are suffixed with `C`.
 */
import { C, ZERO, abs, add as cadd, c, dist, div as cdiv, mul as cmul, sub as csub } from './complex';

export type Poly = number[];
export type CPoly = C[];

/** Remove leading (near-)zero coefficients; the zero polynomial becomes `[0]`. */
export function trim(p: Poly, tol = 0): Poly {
  let i = 0;
  while (i < p.length - 1 && Math.abs(p[i]) <= tol) i++;
  return p.slice(i);
}
export const degree = (p: Poly): number => trim(p).length - 1;

export function add(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < a.length; i++) out[n - a.length + i] += a[i];
  for (let i = 0; i < b.length; i++) out[n - b.length + i] += b[i];
  return trim(out);
}
export const scale = (a: Poly, k: number): Poly => a.map((x) => x * k);
export const sub = (a: Poly, b: Poly): Poly => add(a, scale(b, -1));

export function mul(a: Poly, b: Poly): Poly {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return out;
}
/** Product of several polynomials. */
export const mulAll = (...ps: Poly[]): Poly => ps.reduce((acc, p) => mul(acc, p), [1]);

/** Real evaluation by Horner's rule. */
export function evalReal(p: Poly, x: number): number {
  let y = 0;
  for (const a of p) y = y * x + a;
  return y;
}
/** Evaluation at a complex s by Horner's rule. */
export function evalC(p: Poly, s: C): C {
  let y: C = ZERO;
  for (const a of p) y = cadd(cmul(y, s), c(a));
  return y;
}
/** Evaluation of a complex-coefficient polynomial at complex s. */
export function evalCC(p: CPoly, s: C): C {
  let y: C = ZERO;
  for (const a of p) y = cadd(cmul(y, s), a);
  return y;
}

export function derivative(p: Poly): Poly {
  const n = p.length - 1;
  if (n < 1) return [0];
  return p.slice(0, n).map((a, i) => a * (n - i));
}

/** Polynomial long division: a = q b + r. */
export function divmod(a: Poly, b: Poly): { q: Poly; r: Poly } {
  const bt = trim(b);
  let r = trim(a).slice();
  if (bt.length === 1 && bt[0] === 0) throw new RangeError('divmod: division by zero polynomial');
  if (r.length < bt.length) return { q: [0], r };
  const q: number[] = [];
  while (r.length >= bt.length) {
    const k = r[0] / bt[0];
    q.push(k);
    for (let i = 0; i < bt.length; i++) r[i] -= k * bt[i];
    r = r.slice(1);
  }
  return { q: q.length ? q : [0], r: r.length ? trim(r, 1e-12 * Math.max(1, ...a.map(Math.abs))) : [0] };
}

/** Polynomial with the given (complex-conjugate-closed) roots, scaled by `lead`. */
export function fromRoots(roots: C[], lead = 1): Poly {
  let p: CPoly = [c(lead)];
  for (const r of roots) {
    const q: CPoly = new Array(p.length + 1).fill(ZERO);
    for (let i = 0; i < p.length; i++) {
      q[i] = cadd(q[i], p[i]);
      q[i + 1] = csub(q[i + 1], cmul(p[i], r));
    }
    p = q;
  }
  return p.map((z) => z.re);
}

/* Complex polynomial helpers ---------------------------------------------------------------- */
export const mulC = (a: CPoly, b: CPoly): CPoly => {
  const out: CPoly = new Array(a.length + b.length - 1).fill(ZERO);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = cadd(out[i + j], cmul(a[i], b[j]));
  return out;
};
export const toC = (p: Poly): CPoly => p.map((a) => c(a));
/**
 * Taylor coefficients about s = p, ascending: [f(p), f'(p), f''(p)/2!, ...] (length = degree + 1).
 * Computed by repeated synthetic division by (s - p).
 */
export function taylorAbout(poly: CPoly, p: C): CPoly {
  const out: CPoly = [];
  let cur = poly.slice();
  while (cur.length > 0) {
    const b: CPoly = [cur[0]];
    for (let i = 1; i < cur.length; i++) b.push(cadd(cur[i], cmul(b[i - 1], p)));
    out.push(b[b.length - 1]); // remainder
    cur = b.slice(0, b.length - 1);
  }
  return out;
}

/**
 * Roots of a real polynomial: Durand-Kerner iteration followed by Newton polishing on the original polynomial.
 * Exact zero roots (trailing zero coefficients) are removed first. Clusters closer than `clusterTol` (repeated roots,
 * which Durand-Kerner resolves only to ~eps^(1/m)) are replaced by their mean, and tiny imaginary parts are snapped to 0.
 * Result is sorted by real part (descending), then imaginary part (descending).
 */
export function roots(p: Poly, clusterTol = 1e-4): C[] {
  let q = trim(p, 0);
  const scaleMax = Math.max(...q.map(Math.abs));
  q = trim(q, 1e-14 * scaleMax);
  const out: C[] = [];
  while (q.length > 1 && q[q.length - 1] === 0) {
    out.push(ZERO);
    q = q.slice(0, -1);
  }
  const n = q.length - 1;
  if (n === 0) return out;
  if (n === 1) {
    out.push(c(-q[1] / q[0]));
    return sortRoots(out);
  }
  const monic = q.map((a) => a / q[0]);
  // Cauchy bound for the starting radius
  const R = 1 + Math.max(...monic.slice(1).map(Math.abs));
  const r0 = Math.min(R, 1 + Math.pow(Math.abs(monic[n]), 1 / n));
  let z: C[] = [];
  for (let k = 0; k < n; k++) z.push({ re: r0 * Math.cos((2 * Math.PI * k) / n + 0.4), im: r0 * Math.sin((2 * Math.PI * k) / n + 0.4) });
  for (let it = 0; it < 2000; it++) {
    let maxStep = 0;
    for (let i = 0; i < n; i++) {
      let den: C = c(1);
      for (let j = 0; j < n; j++) if (j !== i) den = cmul(den, csub(z[i], z[j]));
      const step = cdiv(evalC(monic, z[i]), den);
      z[i] = csub(z[i], step);
      maxStep = Math.max(maxStep, abs(step));
    }
    if (maxStep < 1e-15 * (1 + r0)) break;
  }
  // Newton polish (skipped when the derivative vanishes: multiple root)
  const dp = derivative(monic);
  z = z.map((zi) => {
    let x = zi;
    for (let k = 0; k < 4; k++) {
      const d = evalC(dp, x);
      if (abs(d) < 1e-12) break;
      const nx = csub(x, cdiv(evalC(monic, x), d));
      if (abs(evalC(monic, nx)) <= abs(evalC(monic, x))) x = nx;
      else break;
    }
    return x;
  });
  // cluster repeated roots
  const used = new Array(n).fill(false);
  const merged: C[] = [];
  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const group = [z[i]];
    used[i] = true;
    for (let j = i + 1; j < n; j++) {
      if (!used[j] && dist(z[i], z[j]) < clusterTol * (1 + abs(z[i]))) {
        group.push(z[j]);
        used[j] = true;
      }
    }
    const mean = { re: group.reduce((s, g) => s + g.re, 0) / group.length, im: group.reduce((s, g) => s + g.im, 0) / group.length };
    for (let k = 0; k < group.length; k++) merged.push(group.length > 1 ? mean : group[k]);
  }
  // snap near-real roots, enforce conjugate symmetry
  const snapped = merged.map((r) => (Math.abs(r.im) < 1e-9 * (1 + Math.abs(r.re)) ? c(r.re) : r));
  const done = new Array(snapped.length).fill(false);
  for (let i = 0; i < snapped.length; i++) {
    if (done[i] || snapped[i].im === 0) continue;
    let best = -1;
    let bd = Infinity;
    for (let j = 0; j < snapped.length; j++) {
      if (j === i || done[j]) continue;
      const d = dist(snapped[j], { re: snapped[i].re, im: -snapped[i].im });
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    if (best >= 0 && bd < 1e-5 * (1 + abs(snapped[i]))) {
      const re = 0.5 * (snapped[i].re + snapped[best].re);
      const im = 0.5 * (Math.abs(snapped[i].im) + Math.abs(snapped[best].im));
      const upper = snapped[i].im > 0 ? i : best;
      const lower = upper === i ? best : i;
      snapped[upper] = c(re, im);
      snapped[lower] = c(re, -im);
      done[i] = done[best] = true;
    }
  }
  return sortRoots([...out, ...snapped]);
}

export function sortRoots(r: C[]): C[] {
  return r.slice().sort((a, b) => b.re - a.re || b.im - a.im);
}

/** Largest real part among the roots (the stability margin of a characteristic polynomial). */
export const maxRealPart = (p: Poly): number => Math.max(...roots(p).map((r) => r.re));
/** Number of roots with positive real part. */
export const countRHP = (p: Poly, tol = 1e-9): number => roots(p).filter((r) => r.re > tol).length;
