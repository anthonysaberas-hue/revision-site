/**
 * Partial-fraction expansion and inverse Laplace transform of rational functions N(s)/D(s).
 * Polynomials are real, highest power first. Handles distinct, repeated and complex-conjugate poles and
 * improper fractions (the polynomial part becomes impulse terms).
 */
import { C, ZERO, abs, c, div as cdiv, dist, mul as cmul, scale as cscale, sub as csub } from './complex';
import { Poly, derivative, divmod, evalC, mulC, roots, taylorAbout, toC, trim } from './poly';

/** One term residue / (s - pole)^order. */
export interface PFETerm {
  pole: C;
  order: number;
  residue: C;
}

export interface PFE {
  /** Polynomial part of an improper fraction, highest power first ([0] when proper). s^k stands for the k-th derivative of the impulse. */
  direct: Poly;
  terms: PFETerm[];
}

/** Group the roots of `den` into distinct poles with multiplicities. */
export function groupPoles(den: Poly, tol = 2e-4): { pole: C; mult: number }[] {
  // Roots of a repeated pole split by about eps^(1/m); cluster them and use the cluster mean (the splits cancel).
  const groups: { sum: C; mult: number }[] = [];
  for (const r of roots(den)) {
    const hit = groups.find((g) => dist({ re: g.sum.re / g.mult, im: g.sum.im / g.mult }, r) < tol * (1 + abs(r)));
    if (hit) {
      hit.sum = { re: hit.sum.re + r.re, im: hit.sum.im + r.im };
      hit.mult++;
    } else groups.push({ sum: { re: r.re, im: r.im }, mult: 1 });
  }
  return groups.map((g) => {
    const p = { re: g.sum.re / g.mult, im: g.sum.im / g.mult };
    if (g.mult > 1) {
      // A root of multiplicity m is a SIMPLE root of the (m-1)th derivative: Newton-polish there for full accuracy.
      let d = trim(den);
      for (let k = 0; k < g.mult - 1; k++) d = derivative(d);
      const d1 = derivative(d);
      let z: C = p;
      for (let it = 0; it < 30; it++) {
        const f = evalC(d, z);
        const fp = evalC(d1, z);
        if (abs(fp) < 1e-300) break;
        const step = cdiv(f, fp);
        z = csub(z, step);
        if (abs(step) < 1e-15 * (1 + abs(z))) break;
      }
      if (abs(csub(z, p)) < 1e-3 * (1 + abs(p))) {
        p.re = z.re;
        p.im = z.im;
      }
    }
    if (Math.abs(p.im) < 1e-9 * (1 + Math.abs(p.re))) p.im = 0;
    return { pole: p, mult: g.mult };
  });
}

/**
 * Partial-fraction expansion of num/den.
 * For a pole p of multiplicity m the coefficient of 1/(s-p)^(m-j) is (1/j!) d^j/ds^j [(s-p)^m F(s)] at s = p,
 * obtained here from Taylor-series division of N(s) by Q(s) = D(s)/(s-p)^m about p.
 */
export function pfe(num: Poly, den: Poly): PFE {
  const dt = trim(den);
  const { q, r } = divmod(num, dt);
  const direct = q;
  const rem = toC(r);
  const a0 = dt[0];
  const poles = groupPoles(dt);
  const terms: PFETerm[] = [];
  for (const { pole: p, mult: m } of poles) {
    const self = poles.find((g) => g.pole === p);
    let Q = [c(a0)];
    for (const o of poles) if (o !== self) for (let i = 0; i < o.mult; i++) Q = mulC(Q, [c(1), cscale(o.pole, -1)]);
    const nT = taylorAbout(rem, p);
    const qT = taylorAbout(Q, p);
    const co: C[] = [];
    for (let j = 0; j < m; j++) {
      let acc: C = nT[j] ?? ZERO;
      for (let i = 0; i < j; i++) acc = csub(acc, cmul(co[i], qT[j - i] ?? ZERO));
      co.push(cdiv(acc, qT[0]));
    }
    for (let j = 0; j < m; j++) terms.push({ pole: p, order: m - j, residue: co[j] });
  }
  return { direct, terms };
}

/** One real term of the time response: coef * t^power * e^{sigma t} * (1 | cos(omega t) | sin(omega t)). */
export interface TimeTerm {
  coef: number;
  power: number;
  sigma: number;
  omega: number;
  trig: 'none' | 'cos' | 'sin';
}

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));

/** Convert the expansion to real time-domain terms (conjugate pairs merged into cos/sin). */
export function toTimeTerms(p: PFE, tol = 1e-9): TimeTerm[] {
  const out: TimeTerm[] = [];
  for (const t of p.terms) {
    const k = t.order - 1;
    const f = fact(k);
    if (Math.abs(t.pole.im) <= 1e-9 * (1 + Math.abs(t.pole.re))) {
      if (Math.abs(t.residue.re) > tol) out.push({ coef: t.residue.re / f, power: k, sigma: t.pole.re, omega: 0, trig: 'none' });
    } else if (t.pole.im > 0) {
      if (Math.abs(t.residue.re) > tol) out.push({ coef: (2 * t.residue.re) / f, power: k, sigma: t.pole.re, omega: t.pole.im, trig: 'cos' });
      if (Math.abs(t.residue.im) > tol) out.push({ coef: (-2 * t.residue.im) / f, power: k, sigma: t.pole.re, omega: t.pole.im, trig: 'sin' });
    }
  }
  return out;
}

export const evalTimeTerm = (t: TimeTerm, time: number): number => {
  const env = t.coef * Math.pow(time, t.power) * Math.exp(t.sigma * time);
  return t.trig === 'cos' ? env * Math.cos(t.omega * time) : t.trig === 'sin' ? env * Math.sin(t.omega * time) : env;
};

const num4 = (x: number): string => String(Number(x.toPrecision(5)));
const MINUS = '−';
/** "2t", or just "t" when the multiplier is 1 */
const tTerm = (x: number): string => (Math.abs(x - 1) < 1e-12 ? 't' : `${num4(x)}t`);

/** Human-readable text, e.g. "2e^{−2t} + e^{−t}cos(2t) − 2.5e^{−t}sin(2t)". */
export function timeTermsToString(terms: TimeTerm[], impulses: Poly = [0]): string {
  const parts: { sign: 1 | -1; body: string }[] = [];
  const imp = trim(impulses);
  if (!(imp.length === 1 && Math.abs(imp[0]) < 1e-12)) {
    imp.forEach((a, i) => {
      const k = imp.length - 1 - i;
      if (Math.abs(a) < 1e-12) return;
      const d = k === 0 ? 'δ(t)' : k === 1 ? "δ'(t)" : `δ^{(${k})}(t)`;
      parts.push({ sign: a < 0 ? -1 : 1, body: `${Math.abs(a) === 1 ? '' : num4(Math.abs(a))}${d}` });
    });
  }
  for (const t of terms) {
    const mag = Math.abs(t.coef);
    const factors: string[] = [];
    if (t.power === 1) factors.push('t');
    else if (t.power > 1) factors.push(`t^${t.power}`);
    if (Math.abs(t.sigma) > 1e-12) factors.push(`e^{${t.sigma < 0 ? MINUS : ''}${tTerm(Math.abs(t.sigma))}}`);
    if (t.trig !== 'none') factors.push(`${t.trig}(${tTerm(t.omega)})`);
    const coefStr = Math.abs(mag - 1) < 1e-12 && factors.length ? '' : num4(mag);
    parts.push({ sign: t.coef < 0 ? -1 : 1, body: coefStr + factors.join('') });
  }
  if (!parts.length) return '0';
  return parts.map((p, i) => (i === 0 ? (p.sign < 0 ? MINUS : '') : p.sign < 0 ? ` ${MINUS} ` : ' + ') + p.body).join('');
}

export interface TimeExpr {
  /** f(t) for t >= 0 (impulse terms of improper fractions are not included). */
  f: (t: number) => number;
  text: string;
  terms: TimeTerm[];
  pfe: PFE;
}

/** Inverse Laplace transform of num/den as a function and a readable string. */
export function inverseLaplace(num: Poly, den: Poly): TimeExpr {
  const p = pfe(num, den);
  const terms = toTimeTerms(p);
  return {
    f: (t) => terms.reduce((s, tt) => s + evalTimeTerm(tt, t), 0),
    text: timeTermsToString(terms, p.direct),
    terms,
    pfe: p,
  };
}

/** Unit-step response: inverse Laplace of num / (den * s). */
export const stepExpr = (num: Poly, den: Poly): TimeExpr => inverseLaplace(num, [...den, 0]);
/** Unit-ramp response: inverse Laplace of num / (den * s^2). */
export const rampExpr = (num: Poly, den: Poly): TimeExpr => inverseLaplace(num, [...den, 0, 0]);
/** Impulse response: inverse Laplace of num / den. */
export const impulseExpr = (num: Poly, den: Poly): TimeExpr => inverseLaplace(num, den);
