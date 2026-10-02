/**
 * Controller design helpers: error constants, PID and Ziegler-Nichols tuning (both methods), ultimate gain of a
 * transfer function (delay included), lead and lag design by the Bode procedure, and sensitivity functions.
 */
import { C, abs, add as cadd, c, div as cdiv, mul as cmul, neg } from './complex';
import { Poly, trim } from './poly';
import { TF, series } from './lti';
import { bode, margins, Margins, freqResponse } from './freq';

/* ---------- steady-state error constants ---------- */
const trailingZeros = (p: Poly): number => {
  const t = trim(p);
  let k = 0;
  for (let i = t.length - 1; i > 0 && t[i] === 0; i--) k++;
  return k;
};
const lowCoef = (p: Poly): number => {
  const t = trim(p);
  for (let i = t.length - 1; i >= 0; i--) if (t[i] !== 0) return t[i];
  return 0;
};

export interface ErrorConstants {
  /** system type = number of free integrators in the loop (poles at the origin minus zeros there) */
  type: number;
  Kp: number;
  Kv: number;
  Ka: number;
}
/** Position, velocity and acceleration error constants of an open-loop transfer function (unity feedback). */
export function errorConstants(g: TF): ErrorConstants {
  const type = trailingZeros(g.den) - trailingZeros(g.num);
  const k0 = lowCoef(g.num) / lowCoef(g.den); // lim s^type G(s)
  return {
    type,
    Kp: type === 0 ? k0 : type > 0 ? Infinity : 0,
    Kv: type === 1 ? k0 : type > 1 ? Infinity : 0,
    Ka: type === 2 ? k0 : type > 2 ? Infinity : 0,
  };
}

/* ---------- PID ---------- */
export interface PIDGains {
  Kp: number;
  Ti: number;
  Td: number;
  Ki: number;
  Kd: number;
}
const mkPID = (Kp: number, Ti: number, Td: number): PIDGains => ({ Kp, Ti, Td, Ki: Kp / Ti, Kd: Kp * Td });

/** PID transfer function Kp (1 + 1/(Ti s) + Td s) = Kp (Ti Td s^2 + Ti s + 1) / (Ti s); Ti = Infinity drops the integral, Td = 0 the derivative. */
export function pidTF(Kp: number, Ti: number, Td: number): TF {
  if (!isFinite(Ti)) return { num: [Kp * Td, Kp], den: [1] };
  return { num: [Kp * Ti * Td, Kp * Ti, Kp], den: [Ti, 0] };
}

/** Ziegler-Nichols method 1 (reaction curve): gains from delay L, time constant T and plant gain K. */
export function zieglerNichols1(L: number, T: number, K = 1): { P: PIDGains; PI: PIDGains; PID: PIDGains } {
  const r = T / (K * L);
  return { P: mkPID(r, Infinity, 0), PI: mkPID(0.9 * r, L / 0.3, 0), PID: mkPID(1.2 * r, 2 * L, 0.5 * L) };
}

/**
 * Read (K, L, T) from an open-loop step response of amplitude `uStep`: tangent at the point of steepest slope;
 * L = where the tangent meets the time axis, T = time from there to the final value.
 */
export function fitFOPDT(t: number[], y: number[], uStep = 1): { K: number; L: number; T: number } {
  const yf = y[y.length - 1];
  let best = 1;
  let slope = -Infinity;
  for (let k = 1; k < t.length; k++) {
    const s = (y[k] - y[k - 1]) / (t[k] - t[k - 1]);
    if (s > slope) {
      slope = s;
      best = k;
    }
  }
  const tm = 0.5 * (t[best] + t[best - 1]);
  const ym = 0.5 * (y[best] + y[best - 1]);
  const t0 = tm - ym / slope;
  const t1 = tm + (yf - ym) / slope;
  return { K: yf / uStep, L: t0, T: t1 - t0 };
}

/** Ziegler-Nichols method 2 (ultimate gain Ku and period Pu). */
export function zieglerNichols2(Ku: number, Pu: number): { P: PIDGains; PI: PIDGains; PID: PIDGains } {
  return { P: mkPID(0.5 * Ku, Infinity, 0), PI: mkPID(0.45 * Ku, Pu / 1.2, 0), PID: mkPID(0.6 * Ku, 0.5 * Pu, 0.125 * Pu) };
}

/**
 * Ultimate gain and period of unity-feedback proportional control of G(s) (e^{-Ls} included):
 * the lowest-frequency phase crossover w_u of -180 deg gives Ku = 1/|G(j w_u)| and Pu = 2 pi / w_u.
 */
export function ultimateGain(g: TF): { Ku: number; Pu: number; wu: number } {
  const m = margins(g);
  if (!isFinite(m.gm)) return { Ku: Infinity, Pu: NaN, wu: NaN };
  const first = m.phaseCrossovers.reduce((a, b) => (b.w < a.w ? b : a));
  return { Ku: Math.pow(10, first.gm / 20), Pu: (2 * Math.PI) / first.w, wu: first.w };
}

/* ---------- compensator design by the Bode procedure ---------- */
export interface LeadDesign {
  /** gain required for the steady-state specification, K = Kv_target / Kv_plant */
  K: number;
  pmUncompensated: number;
  wgcUncompensated: number;
  /** maximum phase lead used (degrees), including the safety allowance */
  phiMaxDeg: number;
  alpha: number;
  /** new gain crossover = frequency of maximum lead */
  wm: number;
  T: number;
  /** lead zero (-1/T) and pole (-1/(alpha T)) */
  zero: number;
  pole: number;
  /** Gc(s) = Kc (s + 1/T)/(s + 1/(alpha T)), Kc = K/alpha */
  Kc: number;
  Gc: TF;
  /** margins of Gc(s) G(s) */
  achieved: Margins;
}

/** First w (log scan) where f changes sign, refined by bisection. */
function firstCrossing(f: (w: number) => number, lo: number, hi: number, n = 4000): number {
  let pw = lo;
  let pf = f(lo);
  for (let i = 1; i <= n; i++) {
    const w = lo * Math.pow(hi / lo, i / n);
    const fw = f(w);
    if (pf * fw <= 0 && pf !== fw) {
      let a = pw;
      let b = w;
      for (let k = 0; k < 100; k++) {
        const m = Math.sqrt(a * b);
        if (f(m) * f(a) <= 0) b = m;
        else a = m;
      }
      return Math.sqrt(a * b);
    }
    pw = w;
    pf = fw;
  }
  return NaN;
}

/**
 * Lead compensator by the Bode procedure (Ogata ch. 7 / 11):
 * 1. K from the velocity-constant requirement; 2. PM of K G; 3. phi_m = PM_target - PM + safety, alpha = (1 - sin phi_m)/(1 + sin phi_m);
 * 4. new crossover where |K G| = sqrt(alpha) (i.e. -10 log10(1/alpha) dB); 5. T = 1/(w_m sqrt(alpha)).
 */
export function leadDesign(plant: TF, spec: { Kv: number; pmTarget: number; safetyDeg?: number }): LeadDesign {
  const safety = spec.safetyDeg ?? 5;
  const ec = errorConstants(plant);
  if (ec.type !== 1) throw new RangeError('leadDesign: a type-1 plant is expected (Kv specification)');
  const K = spec.Kv / ec.Kv;
  const KG: TF = series({ num: [K], den: [1] }, plant);
  const m0 = margins(KG);
  const phiMax = spec.pmTarget - m0.pm + safety;
  if (phiMax <= 0 || phiMax >= 70) throw new RangeError(`leadDesign: required lead ${phiMax.toFixed(1)} deg is outside 0..70 (use a double lead or lag-lead)`);
  const sinp = Math.sin((phiMax * Math.PI) / 180);
  const alpha = (1 - sinp) / (1 + sinp);
  const target = 10 * Math.log10(alpha);
  const bd = bode(KG);
  const wm = firstCrossing((w) => 20 * Math.log10(abs(freqResponse(KG, w))) - target, bd.w[0], bd.w[bd.w.length - 1]);
  const T = 1 / (wm * Math.sqrt(alpha));
  const Kc = K / alpha;
  const Gc: TF = { num: [Kc, Kc / T], den: [1, 1 / (alpha * T)] };
  return {
    K,
    pmUncompensated: m0.pm,
    wgcUncompensated: m0.wgc,
    phiMaxDeg: phiMax,
    alpha,
    wm,
    T,
    zero: -1 / T,
    pole: -1 / (alpha * T),
    Kc,
    Gc,
    achieved: margins(series(Gc, plant)),
  };
}

export interface LagDesign {
  K: number;
  pmUncompensated: number;
  /** frequency where the phase of K G equals -180 + PM_target + safety */
  wc: number;
  /** required attenuation |K G(j wc)| (beta > 1) */
  beta: number;
  T: number;
  zero: number;
  pole: number;
  /** Gc(s) = K (T s + 1)/(beta T s + 1) */
  Gc: TF;
  achieved: Margins;
}

/**
 * Lag compensator by the Bode procedure: K from Kv; choose the new crossover wc where the phase of K G is
 * -180 + PM_target + safety; beta = |K G(j wc)|; zero at wc/10 (T = 10/wc), pole at 1/(beta T).
 * Gc = K (T s + 1)/(beta T s + 1) (so the compensated loop keeps Kv).
 */
export function lagDesign(plant: TF, spec: { Kv: number; pmTarget: number; safetyDeg?: number; zeroDecade?: number }): LagDesign {
  const safety = spec.safetyDeg ?? 5;
  const dec = spec.zeroDecade ?? 10;
  const ec = errorConstants(plant);
  if (ec.type !== 1) throw new RangeError('lagDesign: a type-1 plant is expected (Kv specification)');
  const K = spec.Kv / ec.Kv;
  const KG: TF = series({ num: [K], den: [1] }, plant);
  const m0 = margins(KG);
  const bd = bode(KG);
  const level = -180 + spec.pmTarget + safety;
  const phaseAt = (w: number) => {
    // continuous phase by interpolation on the unwrapped grid
    const i = bd.w.findIndex((x) => x >= w);
    if (i <= 0) return bd.phaseDeg[0];
    const f = Math.log(w / bd.w[i - 1]) / Math.log(bd.w[i] / bd.w[i - 1]);
    return bd.phaseDeg[i - 1] + f * (bd.phaseDeg[i] - bd.phaseDeg[i - 1]);
  };
  const wc = firstCrossing((w) => phaseAt(w) - level, bd.w[0], bd.w[bd.w.length - 1]);
  const beta = abs(freqResponse(KG, wc));
  const T = dec / wc;
  const Gc: TF = { num: [K * T, K], den: [beta * T, 1] };
  return { K, pmUncompensated: m0.pm, wc, beta, T, zero: -1 / T, pole: -1 / (beta * T), Gc, achieved: margins(series(Gc, plant)) };
}

/* ---------- sensitivity ---------- */
/** Closed-loop sensitivity S = 1/(1 + G H) and its value at one complex number GH. */
export const sensitivityOfLoop = (GH: C): C => cdiv(c(1), cadd(c(1), GH));
/** S^T_G = 1/(1 + G H) for T = G/(1 + G H), evaluated with G, H given at the same complex frequency. */
export const sensitivityTG = (G: C, H: C): C => sensitivityOfLoop(cmul(G, H));
/** S^T_H = -G H/(1 + G H). */
export const sensitivityTH = (G: C, H: C): C => neg(cmul(cmul(G, H), sensitivityOfLoop(cmul(G, H))));
/** Numerical sensitivity S^T_p = (dT/dp)(p/T) = d ln T / d ln p of any scalar function T(p) at p0. */
export function sensitivityNumeric(T: (p: number) => number, p0: number, rel = 1e-6): number {
  const h = rel * Math.abs(p0);
  return ((T(p0 + h) - T(p0 - h)) / (2 * h)) * (p0 / T(p0));
}
