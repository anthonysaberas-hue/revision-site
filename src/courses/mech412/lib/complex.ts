/**
 * Minimal complex-number arithmetic for the control library.
 * A complex number is a plain object `{ re, im }` so that results can be logged and compared in tests.
 */
export interface C {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): C => ({ re, im });
export const ZERO: C = { re: 0, im: 0 };
export const ONE: C = { re: 1, im: 0 };
/** The imaginary unit j. */
export const J: C = { re: 0, im: 1 };

export const add = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
export const sub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
export const neg = (a: C): C => ({ re: -a.re, im: -a.im });
export const mul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const scale = (a: C, k: number): C => ({ re: a.re * k, im: a.im * k });
export const conj = (a: C): C => ({ re: a.re, im: -a.im });
/** Modulus |a|. */
export const abs = (a: C): number => Math.hypot(a.re, a.im);
/** Principal argument in (-pi, pi], radians. */
export const arg = (a: C): number => Math.atan2(a.im, a.re);

/** a / b (Smith's algorithm, safe against overflow). */
export function div(a: C, b: C): C {
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re;
    const d = b.re + b.im * r;
    return { re: (a.re + a.im * r) / d, im: (a.im - a.re * r) / d };
  }
  const r = b.re / b.im;
  const d = b.re * r + b.im;
  return { re: (a.re * r + a.im) / d, im: (a.im * r - a.re) / d };
}

export const inv = (a: C): C => div(ONE, a);
/** r * e^{j theta}. */
export const fromPolar = (r: number, theta: number): C => ({ re: r * Math.cos(theta), im: r * Math.sin(theta) });
/** e^a. */
export const exp = (a: C): C => fromPolar(Math.exp(a.re), a.im);
/** Principal square root. */
export function sqrt(a: C): C {
  const r = abs(a);
  if (r === 0) return ZERO;
  const re = Math.sqrt((r + a.re) / 2);
  const im = Math.sqrt(Math.max(0, (r - a.re) / 2));
  return { re, im: a.im < 0 ? -im : im };
}
/** Integer power a^n (n may be negative). */
export function pow(a: C, n: number): C {
  if (n < 0) return inv(pow(a, -n));
  let out = ONE;
  let base = a;
  let k = n;
  while (k > 0) {
    if (k & 1) out = mul(out, base);
    base = mul(base, base);
    k >>= 1;
  }
  return out;
}

/** Distance |a - b|. */
export const dist = (a: C, b: C): number => abs(sub(a, b));
export const isReal = (a: C, tol = 1e-9): boolean => Math.abs(a.im) <= tol * (1 + Math.abs(a.re));
export const eq = (a: C, b: C, tol = 1e-9): boolean => dist(a, b) <= tol * (1 + abs(a) + abs(b));

/** Compact printable form, e.g. "-1+2j". */
export function fmt(a: C, digits = 4): string {
  const f = (x: number) => String(Number(x.toPrecision(digits)));
  if (Math.abs(a.im) < 1e-12) return f(a.re);
  const s = a.im < 0 ? '-' : '+';
  return `${f(a.re)}${s}${f(Math.abs(a.im))}j`;
}

export const DEG = Math.PI / 180;
/** Radians to degrees. */
export const toDeg = (r: number) => r / DEG;
/** Degrees to radians. */
export const toRad = (d: number) => d * DEG;
