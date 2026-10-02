/**
 * Frequency response: Bode magnitude/phase and straight-line asymptotes, gain and phase margins with crossover
 * frequencies, Nyquist points and the encirclement count of -1.
 * G(jw) = N(jw)/D(jw) * e^{-jwL}; angles in degrees, magnitudes in dB, frequencies in rad/s.
 */
import { C, abs, arg, c, conj, div as cdiv, exp as cexp, mul as cmul, toDeg } from './complex';
import { evalC, roots, trim } from './poly';
import { TF } from './lti';

const L = (g: TF) => g.delay ?? 0;

/** G(jw) as a complex number. */
export function freqResponse(g: TF, w: number): C {
  const s = { re: 0, im: w };
  const r = cdiv(evalC(g.num, s), evalC(g.den, s));
  return L(g) ? cmul(r, cexp({ re: 0, im: -w * L(g) })) : r;
}
/** G(s) at an arbitrary complex s (delay included). */
export function evalTF(g: TF, s: C): C {
  const r = cdiv(evalC(g.num, s), evalC(g.den, s));
  return L(g) ? cmul(r, cexp({ re: -s.re * L(g), im: -s.im * L(g) })) : r;
}

export const db = (x: number): number => 20 * Math.log10(x);
/** |G(jw)| in dB. */
export const magDb = (g: TF, w: number): number => db(abs(freqResponse(g, w)));
/** Principal phase of G(jw) in degrees, (-180, 180]. */
export const phaseDegPrincipal = (g: TF, w: number): number => toDeg(arg(freqResponse(g, w)));

/** Number of roots at the origin of a polynomial (trailing zero coefficients). */
function originRoots(p: number[]): number {
  const t = trim(p);
  let k = 0;
  for (let i = t.length - 1; i > 0 && t[i] === 0; i--) k++;
  return k;
}
/** Lowest-order nonzero coefficient of the polynomial. */
function lowCoef(p: number[]): number {
  const t = trim(p);
  for (let i = t.length - 1; i >= 0; i--) if (t[i] !== 0) return t[i];
  return 0;
}

/** Phase (degrees) as w -> 0: -90 q (+ -180 for a negative low-frequency gain), q = poles at origin - zeros at origin. */
export function lowFrequencyPhaseDeg(g: TF): number {
  const q = originRoots(g.den) - originRoots(g.num);
  const k0 = lowCoef(g.num) / lowCoef(g.den);
  return -90 * q + (k0 < 0 ? -180 : 0);
}

/** Sensible plotting/search range: [min nonzero corner / 1000, max corner * 1000]. */
export function freqRange(g: TF): [number, number] {
  const rs = [...(trim(g.den).length > 1 ? roots(g.den) : []), ...(trim(g.num).length > 1 ? roots(g.num) : [])].map(abs).filter((x) => x > 1e-9);
  const lo = rs.length ? Math.min(...rs, 1) : 1;
  let hi = rs.length ? Math.max(...rs, 1) : 1;
  if (L(g) > 0) hi = Math.max(hi, 10 / L(g));
  return [lo / 1000, hi * 1000];
}

export interface BodeData {
  w: number[];
  magDb: number[];
  /** continuous (unwrapped) phase in degrees, anchored to the analytic low-frequency phase */
  phaseDeg: number[];
}

/** Bode data on a log grid, with the phase unwrapped continuously. */
export function bode(g: TF, wmin?: number, wmax?: number, n = 600): BodeData {
  const [dlo, dhi] = freqRange(g);
  const lo = wmin ?? dlo;
  const hi = wmax ?? dhi;
  const w: number[] = [];
  const m: number[] = [];
  const ph: number[] = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const wi = lo * Math.pow(hi / lo, i / (n - 1));
    const z = freqResponse(g, wi);
    let p = toDeg(arg(z));
    if (i === 0) {
      const p0 = lowFrequencyPhaseDeg(g);
      p += 360 * Math.round((p0 - p) / 360);
    } else p += 360 * Math.round((prev - p) / 360);
    prev = p;
    w.push(wi);
    m.push(db(abs(z)));
    ph.push(p);
  }
  return { w, magDb: m, phaseDeg: ph };
}

export interface BodeAsymptotes {
  /** corner frequencies with the change in magnitude slope (dB/decade) they cause */
  corners: { w: number; slopeChange: number }[];
  /** low-frequency gain K0 = lim s^q G(s) and the integrator count q */
  K0: number;
  q: number;
  /** straight-line magnitude (dB) */
  magDb: (w: number) => number;
  /** straight-line magnitude slope (dB/decade) at w */
  slope: (w: number) => number;
  /** piecewise-linear phase approximation (degrees): each real factor turns 90 degrees between w/10 and 10w, a pair 180 degrees */
  phaseDeg: (w: number) => number;
}

/** Bode asymptotes from the pole-zero list (delay adds -w L to the phase and nothing to the magnitude). */
export function bodeAsymptotes(g: TF): BodeAsymptotes {
  const q = originRoots(g.den) - originRoots(g.num);
  const K0 = lowCoef(g.num) / lowCoef(g.den);
  type Fac = { w: number; order: 1 | 2; sign: 1 | -1; rhp: boolean }; // sign +1 for a zero, -1 for a pole
  const facs: Fac[] = [];
  const collect = (p: number[], sign: 1 | -1) => {
    if (trim(p).length < 2) return;
    for (const r of roots(p)) {
      const mag = abs(r);
      if (mag < 1e-9) continue;
      if (Math.abs(r.im) < 1e-9 * (1 + mag)) facs.push({ w: mag, order: 1, sign, rhp: r.re > 0 });
      else if (r.im > 0) facs.push({ w: mag, order: 2, sign, rhp: r.re > 0 });
    }
  };
  collect(g.num, 1);
  collect(g.den, -1);
  const corners = facs.map((f) => ({ w: f.w, slopeChange: f.sign * 20 * f.order })).sort((a, b) => a.w - b.w);
  const slope = (w: number) => -20 * q + corners.filter((cn) => cn.w <= w).reduce((s, cn) => s + cn.slopeChange, 0);
  const magAsym = (w: number) => {
    let m = db(Math.abs(K0)) - 20 * q * Math.log10(w);
    for (const cn of corners) if (w > cn.w) m += (cn.slopeChange / 20) * 20 * Math.log10(w / cn.w);
    return m;
  };
  const ramp = (w: number, wc: number) => Math.min(1, Math.max(0, (Math.log10(w / wc) + 1) / 2));
  const phaseAsym = (w: number) => {
    let p = -90 * q + (K0 < 0 ? -180 : 0) - ((w * L(g)) * 180) / Math.PI;
    for (const f of facs) p += f.sign * (f.rhp ? -1 : 1) * 90 * f.order * ramp(w, f.w);
    return p;
  };
  return { corners, K0, q, magDb: magAsym, slope, phaseDeg: phaseAsym };
}

export interface Margins {
  /** gain margin in dB at the (critical) phase crossover: -|G| in dB; Infinity when the phase never reaches -180 */
  gm: number;
  /** phase margin in degrees at the (critical) gain crossover; Infinity when |G| never reaches 1 */
  pm: number;
  /** critical phase-crossover frequency (NaN if none) */
  wpc: number;
  /** critical gain-crossover frequency (NaN if none) */
  wgc: number;
  gainCrossovers: { w: number; pm: number }[];
  phaseCrossovers: { w: number; gm: number }[];
}

function bisect(f: (x: number) => number, a: number, b: number): number {
  let fa = f(a);
  for (let i = 0; i < 100; i++) {
    const m = Math.sqrt(a * b);
    const fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
    if (b / a - 1 < 1e-13) break;
  }
  return Math.sqrt(a * b);
}

/**
 * Gain and phase margins. Crossovers are found on a dense log grid and refined by bisection;
 * the reported margins are the smallest (most critical) ones.
 */
export function margins(g: TF, wmin?: number, wmax?: number, n = 6000): Margins {
  const bd = bode(g, wmin, wmax, n);
  const gc: { w: number; pm: number }[] = [];
  const pc: { w: number; gm: number }[] = [];
  const unwrappedAt = (w: number, k: number) => {
    // unwrapped phase at w in [bd.w[k], bd.w[k+1]]
    const f = Math.log(w / bd.w[k]) / Math.log(bd.w[k + 1] / bd.w[k]);
    const interp = bd.phaseDeg[k] + f * (bd.phaseDeg[k + 1] - bd.phaseDeg[k]);
    const prin = phaseDegPrincipal(g, w);
    return prin + 360 * Math.round((interp - prin) / 360);
  };
  const norm = (a: number) => {
    let x = ((a % 360) + 360) % 360;
    if (x > 180) x -= 360;
    return x;
  };
  for (let k = 0; k < bd.w.length - 1; k++) {
    // gain crossover
    if (bd.magDb[k] * bd.magDb[k + 1] < 0) {
      const w = bisect((x) => magDb(g, x), bd.w[k], bd.w[k + 1]);
      gc.push({ w, pm: norm(unwrappedAt(w, k) + 180) });
    }
    // phase crossover: unwrapped phase crosses an odd multiple of 180
    const a = Math.floor((bd.phaseDeg[k] + 180) / 360);
    const b = Math.floor((bd.phaseDeg[k + 1] + 180) / 360);
    if (a !== b) {
      const w = bisect((x) => freqResponse(g, x).im, bd.w[k], bd.w[k + 1]);
      if (freqResponse(g, w).re < 0) pc.push({ w, gm: -magDb(g, w) });
    }
  }
  const gcBest = gc.length ? gc.reduce((m, x) => (x.pm < m.pm ? x : m)) : null;
  const pcBest = pc.length ? pc.reduce((m, x) => (x.gm < m.gm ? x : m)) : null;
  return {
    gm: pcBest ? pcBest.gm : Infinity,
    pm: gcBest ? gcBest.pm : Infinity,
    wpc: pcBest ? pcBest.w : NaN,
    wgc: gcBest ? gcBest.w : NaN,
    gainCrossovers: gc,
    phaseCrossovers: pc,
  };
}

/** Nyquist points for w in [wmin, wmax] (log grid), positive frequencies. */
export function nyquistPoints(g: TF, wmin?: number, wmax?: number, n = 800): { w: number; re: number; im: number }[] {
  const [dlo, dhi] = freqRange(g);
  const lo = wmin ?? dlo;
  const hi = wmax ?? dhi;
  return Array.from({ length: n }, (_, i) => {
    const w = lo * Math.pow(hi / lo, i / (n - 1));
    const z = freqResponse(g, w);
    return { w, re: z.re, im: z.im };
  });
}

export interface NyquistResult {
  /** net clockwise encirclements of -1 by the full Nyquist plot (indented around origin poles) */
  N: number;
  /** open-loop poles in the right half plane */
  P: number;
  /** closed-loop RHP poles Z = N + P */
  Z: number;
  stable: boolean;
}

/**
 * Nyquist criterion for L(s) = N/D e^{-sL} (open loop, feedback gain already included):
 * counts the clockwise encirclements of -1 as w runs over the whole contour, including the large semicircle
 * from the indentation around poles at the origin. Poles on the imaginary axis other than the origin are not handled.
 */
export function nyquistEncirclements(g: TF, n = 20000): NyquistResult {
  const [dlo, dhi] = freqRange(g);
  const lo = dlo;
  const hi = dhi;
  const pos: C[] = [];
  for (let i = 0; i < n; i++) pos.push(freqResponse(g, lo * Math.pow(hi / lo, i / (n - 1))));
  const neg = pos.map(conj).reverse(); // w from -hi to -lo
  const q = originRoots(g.den) - originRoots(g.num);
  const arc: C[] = [];
  if (q > 0) {
    const eps = lo;
    for (let i = 0; i <= 720; i++) {
      const th = (-Math.PI / 2) + (Math.PI * i) / 720;
      arc.push(evalTF(g, { re: eps * Math.cos(th), im: eps * Math.sin(th) }));
    }
  }
  const path = [...neg, ...arc, ...pos];
  let total = 0;
  let prev = arg(c(path[0].re + 1, path[0].im));
  for (let i = 1; i < path.length; i++) {
    const a = arg(c(path[i].re + 1, path[i].im));
    let d = a - prev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d <= -Math.PI) d += 2 * Math.PI;
    total += d;
    prev = a;
  }
  const N = Math.round(-total / (2 * Math.PI)) + 0; // + 0 turns -0 into 0
  const P = (trim(g.den).length > 1 ? roots(g.den) : []).filter((r) => r.re > 1e-9).length;
  return { N, P, Z: N + P, stable: N + P === 0 };
}
