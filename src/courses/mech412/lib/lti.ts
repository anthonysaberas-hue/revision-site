/**
 * Linear time-invariant systems: transfer functions, controllable-canonical state space, and an RK4 simulator.
 * All polynomials are highest power first. Time is in seconds, nothing is symbolic.
 */
import { Poly, roots, trim } from './poly';

/** Transfer function num(s)/den(s) * e^{-delay s}. */
export interface TF {
  num: Poly;
  den: Poly;
  /** Pure time delay L in e^{-L s} (seconds). */
  delay?: number;
}

/** State space x' = A x + B u, y = C x + D u (matrices as arrays of rows). */
export interface SS {
  A: number[][];
  B: number[][];
  C: number[][];
  D: number[][];
}

export interface Response {
  t: number[];
  y: number[];
  /** state history, x[k] is the state at t[k] */
  x: number[][];
}

/** Build a TF. */
export const tf = (num: Poly, den: Poly, delay = 0): TF => ({ num, den, delay });

/** Series connection of two transfer functions (delays add). */
export function series(a: TF, b: TF): TF {
  const mul = (p: Poly, q: Poly) => {
    const out = new Array<number>(p.length + q.length - 1).fill(0);
    for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) out[i + j] += p[i] * q[j];
    return out;
  };
  return { num: mul(a.num, b.num), den: mul(a.den, b.den), delay: (a.delay ?? 0) + (b.delay ?? 0) };
}

/** DC gain (value at s = 0); Infinity when there is a pole at the origin. */
export function dcGain(g: TF): number {
  const n = g.num[g.num.length - 1];
  const d = g.den[g.den.length - 1];
  return d === 0 ? (n === 0 ? NaN : Infinity) : n / d;
}

/**
 * Controllable canonical form ("Method 2" of handout 1):
 * A = companion matrix with last row [-a_n ... -a_1], B = [0 ... 0 1]^T,
 * C = [b_n - a_n b_0, ..., b_1 - a_1 b_0], D = b_0, where num/den are normalised so the leading denominator coefficient is 1.
 * The delay is not part of the state space (use `simulate` with `delay`).
 */
export function tf2ss(g: TF): SS {
  const den = trim(g.den);
  const a0 = den[0];
  const n = den.length - 1;
  let num = trim(g.num);
  if (num.length > den.length) throw new RangeError('tf2ss: improper transfer function (numerator degree exceeds denominator degree)');
  const a = den.map((x) => x / a0); // a[0] = 1
  const bFull = new Array<number>(n + 1 - num.length).fill(0).concat(num.map((x) => x / a0)); // b[0..n]
  const b0 = bFull[0];
  if (n === 0) return { A: [], B: [], C: [], D: [[b0]] };
  const A: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n - 1; i++) A[i][i + 1] = 1;
  for (let j = 0; j < n; j++) A[n - 1][j] = -a[n - j];
  const B = Array.from({ length: n }, (_, i) => [i === n - 1 ? 1 : 0]);
  const Crow = new Array<number>(n);
  for (let j = 0; j < n; j++) Crow[j] = bFull[n - j] - a[n - j] * b0;
  return { A, B, C: [Crow], D: [[b0]] };
}

/** Poles of a transfer function. */
export const tfPoles = (g: TF) => roots(g.den);
/** Zeros of a transfer function. */
export const tfZeros = (g: TF) => (trim(g.num).length > 1 ? roots(g.num) : []);

/** Largest pole magnitude, used to choose a stable RK4 step. */
function fastestRate(den: Poly): number {
  const r = roots(den);
  return Math.max(1e-3, ...r.map((z) => Math.hypot(z.re, z.im)));
}

/** A time step that keeps RK4 accurate (h*lambda <= 0.05) with at least 500 and at most 200 000 steps. */
export function autoDt(den: Poly, tEnd: number, delay = 0): number {
  let dt = Math.min(0.05 / fastestRate(den), tEnd / 500);
  if (delay > 0) dt = Math.min(dt, delay / 20);
  return Math.max(dt, tEnd / 200000);
}

/** Circular-free delay line: store (t, v) samples as they are produced, read back v(t - L) by interpolation (0 before t = 0). */
export class DelayBuffer {
  private ts: number[] = [];
  private vs: number[] = [];
  constructor(public readonly delay: number, private readonly initial = 0) {}
  push(t: number, v: number) {
    this.ts.push(t);
    this.vs.push(v);
  }
  /** Value of the stored signal at time t - delay. */
  get(t: number): number {
    const tau = t - this.delay;
    const n = this.ts.length;
    if (n === 0 || tau < this.ts[0]) return this.initial;
    if (tau >= this.ts[n - 1]) return this.vs[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.ts[m] <= tau) lo = m;
      else hi = m;
    }
    const f = (tau - this.ts[lo]) / (this.ts[hi] - this.ts[lo]);
    return this.vs[lo] + f * (this.vs[hi] - this.vs[lo]);
  }
}

export interface SimOptions {
  dt?: number;
  /** initial state (default zeros) */
  x0?: number[];
  /** output delay in seconds (pure e^{-Ls} in series with the system) */
  delay?: number;
}

const matVec = (M: number[][], v: number[]) => M.map((row) => row.reduce((s, m, j) => s + m * v[j], 0));

/**
 * RK4 simulation of a SISO state-space model driven by u(t) (u = 0 for t < 0).
 * A pure delay is applied to the output: y(t) = y_undelayed(t - delay), which for zero initial states is exactly
 * the response of G(s) e^{-Ls}. For feedback loops that contain a delay use `simulateLoop`.
 */
export function simulate(ss: SS, u: (t: number) => number, tEnd: number, opts: SimOptions = {}): Response {
  const n = ss.A.length;
  const delay = opts.delay ?? 0;
  const dt = opts.dt ?? tEnd / 2000;
  const steps = Math.max(1, Math.ceil(tEnd / dt - 1e-9));
  const h = tEnd / steps;
  let x = opts.x0 ? opts.x0.slice() : new Array<number>(n).fill(0);
  const Brow = ss.B.map((r) => r[0]);
  const f = (xx: number[], uu: number) => {
    const ax = matVec(ss.A, xx);
    return ax.map((v, i) => v + Brow[i] * uu);
  };
  const out = (xx: number[], uu: number) => (n ? ss.C[0].reduce((s, cj, j) => s + cj * xx[j], 0) : 0) + ss.D[0][0] * uu;
  const t: number[] = [];
  const y: number[] = [];
  const xs: number[][] = [];
  for (let k = 0; k <= steps; k++) {
    const tk = k * h;
    t.push(tk);
    xs.push(x.slice());
    y.push(out(x, u(tk)));
    if (k === steps) break;
    const u0 = u(tk);
    const um = u(tk + h / 2);
    const u1 = u(tk + h);
    const k1 = f(x, u0);
    const k2 = f(x.map((v, i) => v + (h / 2) * k1[i]), um);
    const k3 = f(x.map((v, i) => v + (h / 2) * k2[i]), um);
    const k4 = f(x.map((v, i) => v + h * k3[i]), u1);
    x = x.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  if (delay > 0) {
    const buf = new DelayBuffer(delay, 0);
    t.forEach((tk, k) => buf.push(tk, y[k]));
    const yd = t.map((tk) => (tk < delay ? 0 : buf.get(tk)));
    return { t, y: yd, x: xs };
  }
  return { t, y, x: xs };
}

const step = (a: number) => (t: number) => (t >= 0 ? a : 0);

/** Generic response of a TF to u(t). `x0` applies to the controllable-canonical states. */
export function lsim(g: TF, u: (t: number) => number, tEnd: number, opts: SimOptions = {}): Response {
  const dt = opts.dt ?? autoDt(g.den, tEnd, 0);
  return simulate(tf2ss(g), u, tEnd, { ...opts, dt, delay: opts.delay ?? g.delay ?? 0 });
}
/** Unit-step response (amplitude `a`). */
export const stepResponse = (g: TF, tEnd: number, a = 1, opts: SimOptions = {}) => lsim(g, step(a), tEnd, opts);
/** Unit-ramp response u = a t. */
export const rampResponse = (g: TF, tEnd: number, a = 1, opts: SimOptions = {}) => lsim(g, (t) => (t >= 0 ? a * t : 0), tEnd, opts);
/** Sinusoidal input u = a sin(w t). */
export const sineResponse = (g: TF, w: number, tEnd: number, a = 1, opts: SimOptions = {}) => lsim(g, (t) => (t >= 0 ? a * Math.sin(w * t) : 0), tEnd, opts);

/**
 * Unit-impulse response, simulated as the free response from x(0+) = B. For a biproper TF the direct-feedthrough
 * Dirac term b0 delta(t) is not included (it has no finite value on a grid).
 */
export function impulseResponse(g: TF, tEnd: number, area = 1, opts: SimOptions = {}): Response {
  const ss = tf2ss(g);
  const dt = opts.dt ?? autoDt(g.den, tEnd, 0);
  const x0 = ss.B.map((r) => r[0] * area);
  const r = simulate({ ...ss, D: [[0]] }, () => 0, tEnd, { ...opts, dt, x0, delay: opts.delay ?? g.delay ?? 0 });
  return r;
}
/** Free response from initial state x0 with zero input. */
export function initialResponse(g: TF, x0: number[], tEnd: number, opts: SimOptions = {}): Response {
  const dt = opts.dt ?? autoDt(g.den, tEnd, 0);
  return simulate(tf2ss(g), () => 0, tEnd, { ...opts, dt, x0, delay: opts.delay ?? g.delay ?? 0 });
}

export interface LoopResponse {
  t: number[];
  /** plant output after the delay (what is fed back) */
  y: number[];
  /** controller output (plant input) */
  u: number[];
  /** error r - y */
  e: number[];
}

/**
 * Unity-feedback loop r -> C(s) -> P(s) e^{-Ls} -> y with the delay realised by a delay buffer (RK4 states for C and P).
 * `ctrl` may be a bare gain (number) or a proper TF. Valid when the plant is strictly proper or L > 0.
 */
export function simulateLoop(plant: TF, ctrl: TF | number, r: (t: number) => number, tEnd: number, dtIn?: number): LoopResponse {
  const L = plant.delay ?? 0;
  const P = tf2ss(plant);
  const Cc = tf2ss(typeof ctrl === 'number' ? { num: [ctrl], den: [1] } : ctrl);
  const np = P.A.length;
  const nc = Cc.A.length;
  const dt = dtIn ?? Math.min(autoDt(plant.den, tEnd, L), typeof ctrl === 'number' ? Infinity : autoDt((ctrl as TF).den, tEnd, 0));
  const steps = Math.max(1, Math.ceil(tEnd / dt - 1e-9));
  const h = tEnd / steps;
  const Dp = P.D[0][0];
  const Dc = Cc.D[0][0];
  if (L === 0 && Dp !== 0 && Dc !== 0 && 1 + Dc * Dp === 0) throw new RangeError('simulateLoop: algebraic loop');
  const buf = new DelayBuffer(L, 0);
  const cx = (M: number[][], x: number[]) => (x.length ? M[0].reduce((s, m, j) => s + m * x[j], 0) : 0);
  // returns [u, yraw] given states, r and fed-back y
  const algebra = (xp: number[], xc: number[], rr: number, yfb: number | null): { u: number; yraw: number; e: number } => {
    if (yfb !== null) {
      const e = rr - yfb;
      const u = cx(Cc.C, xc) + Dc * e;
      return { u, yraw: cx(P.C, xp) + Dp * u, e };
    }
    const u = (cx(Cc.C, xc) + Dc * (rr - cx(P.C, xp))) / (1 + Dc * Dp);
    const yraw = cx(P.C, xp) + Dp * u;
    return { u, yraw, e: rr - yraw };
  };
  const deriv = (xp: number[], xc: number[], tt: number) => {
    const rr = r(tt);
    const { u, e } = algebra(xp, xc, rr, L > 0 ? buf.get(tt) : null);
    const dxp = matVec(P.A, xp).map((v, i) => v + P.B[i][0] * u);
    const dxc = matVec(Cc.A, xc).map((v, i) => v + Cc.B[i][0] * e);
    return { dxp, dxc };
  };
  let xp = new Array<number>(np).fill(0);
  let xc = new Array<number>(nc).fill(0);
  const t: number[] = [];
  const y: number[] = [];
  const uu: number[] = [];
  const ee: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const tk = k * h;
    const rr = r(tk);
    const a = algebra(xp, xc, rr, L > 0 ? buf.get(tk) : null);
    buf.push(tk, a.yraw);
    t.push(tk);
    y.push(L > 0 ? buf.get(tk) : a.yraw);
    uu.push(a.u);
    ee.push(a.e);
    if (k === steps) break;
    // RK4 over the augmented state; the delayed output is read from the buffer (history is complete up to tk)
    const add = (p: number[], q: number[], s: number) => p.map((v, i) => v + s * q[i]);
    const k1 = deriv(xp, xc, tk);
    const k2 = deriv(add(xp, k1.dxp, h / 2), add(xc, k1.dxc, h / 2), tk + h / 2);
    const k3 = deriv(add(xp, k2.dxp, h / 2), add(xc, k2.dxc, h / 2), tk + h / 2);
    const k4 = deriv(add(xp, k3.dxp, h), add(xc, k3.dxc, h), tk + h);
    xp = xp.map((v, i) => v + (h / 6) * (k1.dxp[i] + 2 * k2.dxp[i] + 2 * k3.dxp[i] + k4.dxp[i]));
    xc = xc.map((v, i) => v + (h / 6) * (k1.dxc[i] + 2 * k2.dxc[i] + 2 * k3.dxc[i] + k4.dxc[i]));
  }
  return { t, y, u: uu, e: ee };
}
