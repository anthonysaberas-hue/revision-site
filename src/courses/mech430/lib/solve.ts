/** Numerical helpers shared by the gas-dynamics modules. */

export const DEG = Math.PI / 180;
export const toRad = (d: number) => d * DEG;
export const toDeg = (r: number) => r / DEG;

/**
 * Bisection root finder. f(a) and f(b) must bracket a root.
 * Robust rather than fast; all our functions are cheap and monotone on the bracket.
 */
export function bisect(f: (x: number) => number, a: number, b: number, tol = 1e-12, maxIter = 200): number {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Math.sign(fa) === Math.sign(fb)) {
    throw new RangeError(`bisect: root not bracketed on [${a}, ${b}] (f=${fa}, ${fb})`);
  }
  for (let i = 0; i < maxIter; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0 || Math.abs(b - a) < tol * Math.max(1, Math.abs(m))) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else {
      b = m;
    }
  }
  return 0.5 * (a + b);
}

/** Golden-section search for the maximum of a unimodal function on [a, b]. */
export function argmax(f: (x: number) => number, a: number, b: number, tol = 1e-10): number {
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a);
  let d = a + r * (b - a);
  while (Math.abs(b - a) > tol) {
    if (f(c) > f(d)) b = d;
    else a = c;
    c = b - r * (b - a);
    d = a + r * (b - a);
  }
  return 0.5 * (a + b);
}

/** Evenly spaced samples, inclusive of both ends. */
export function linspace(a: number, b: number, n: number): number[] {
  if (n < 2) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

/** Round to a number of significant figures (for display). */
export function sig(x: number, n = 4): string {
  if (!isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—';
  if (x === 0) return '0';
  const p = Math.floor(Math.log10(Math.abs(x)));
  if (p >= 6 || p <= -4) return x.toExponential(n - 1);
  return x.toFixed(Math.max(0, n - 1 - p));
}
