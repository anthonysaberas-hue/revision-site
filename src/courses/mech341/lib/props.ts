/**
 * Pure-substance properties for water (steam tables A-4…A-7) and R-134a (A-11…A-13).
 * Data: generated tables in ./data (IAPWS-95 / CoolProp; R-134a on Çengel's ASHRAE reference).
 * Units: T °C, P kPa, v m³/kg, u h kJ/kg, s kJ/kg·K. Compressed liquid uses the textbook approximation
 * h ≈ hf(T) + vf(T)(P − Psat(T)), s ≈ sf(T), v ≈ vf(T) (Çengel eq. 3-8), accurate to ~1 kJ/kg below 20 MPa.
 */
import { WSAT, WSUP, WSC, W_CRIT } from './data/water';
import { RSAT, RSUP, R_CRIT } from './data/r134a';

export type Phase = 'compressed liquid' | 'saturated mixture' | 'superheated vapor' | 'supercritical' | 'saturated liquid' | 'saturated vapor';
export interface State {
  T: number;
  P: number;
  v: number;
  u: number;
  h: number;
  s: number;
  x?: number; // quality (only inside the dome; 0/1 on the lines)
  phase: Phase;
  /** true when (P, T) lies outside the tabulated range (water T > 1300 C or P > 60 MPa, R-134a P > 4 MPa or T > 200 C) */
  outOfRange?: boolean;
}

interface SatTable {
  T: number[];
  P: number[];
  vf: number[];
  vg: number[];
  uf: number[];
  ug: number[];
  hf: number[];
  hg: number[];
  sf: number[];
  sg: number[];
}
interface SupTable {
  P: number[];
  Tsat: number[];
  dT: number[];
  h: number[][];
  s: number[][];
  v: number[][];
}
interface ScTable {
  P: number[];
  T: number[];
  h: number[][];
  s: number[][];
  v: number[][];
}

/** index i with a[i] <= x <= a[i+1] (clamped) in an increasing array */
function bracket(a: number[], x: number) {
  let lo = 0;
  let hi = a.length - 1;
  if (x <= a[0]) return 0;
  if (x >= a[hi]) return hi - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (a[m] <= x) lo = m;
    else hi = m;
  }
  return lo;
}
const lerp = (x0: number, x1: number, y0: number, y1: number, x: number) => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);

/** monotone cubic (Fritsch–Carlson) interpolation on (xs, ys) for x */
function pchip(xs: number[], ys: number[], x: number) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return lerp(xs[0], xs[1], ys[0], ys[1], x);
  const i = Math.min(bracket(xs.slice(0, n), x), n - 2);
  const d = (k: number) => (ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]);
  const slope = (k: number) => {
    if (k === 0) return d(0);
    if (k === n - 1) return d(n - 2);
    const a = d(k - 1);
    const b = d(k);
    if (a * b <= 0) return 0;
    const w1 = 2 * (xs[k + 1] - xs[k]) + (xs[k] - xs[k - 1]);
    const w2 = (xs[k + 1] - xs[k]) + 2 * (xs[k] - xs[k - 1]);
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const h = xs[i + 1] - xs[i];
  const t = (x - xs[i]) / h;
  const m0 = slope(i) * h;
  const m1 = slope(i + 1) * h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * m1;
}

/** bisection root of f on [a, b] (f(a), f(b) of opposite sign) */
export function solve(f: (x: number) => number, a: number, b: number, tol = 1e-9, it = 200) {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return NaN;
  for (let k = 0; k < it; k++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0 || b - a < tol * Math.max(1, Math.abs(m))) return m;
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return 0.5 * (a + b);
}

export class PureFluid {
  constructor(
    public name: string,
    private sat: SatTable,
    private sup: SupTable,
    public crit: { T: number; P: number },
    private sc?: ScTable,
  ) {}

  /** saturation properties at temperature T (°C) */
  satT(T: number) {
    const s = this.sat;
    const i = bracket(s.T, T);
    const f = (a: number[]) => lerp(s.T[i], s.T[i + 1], a[i], a[i + 1], T);
    // pressure: interpolate ln P (Clausius–Clapeyron makes ln P nearly linear in 1/T)
    const iT = (t: number) => 1 / (t + 273.15);
    const lnP = lerp(iT(s.T[i]), iT(s.T[i + 1]), Math.log(s.P[i]), Math.log(s.P[i + 1]), iT(T));
    const vf = f(s.vf), vg = f(s.vg), uf = f(s.uf), ug = f(s.ug), hf = f(s.hf), hg = f(s.hg), sf = f(s.sf), sg = f(s.sg);
    return { T, P: Math.exp(lnP), vf, vg, uf, ug, hf, hg, sf, sg, hfg: hg - hf, sfg: sg - sf, ufg: ug - uf, vfg: vg - vf };
  }
  /** saturation temperature at pressure P (kPa) */
  Tsat(P: number) {
    const s = this.sat;
    const lp = s.P.map(Math.log);
    const i = bracket(lp, Math.log(P));
    const iT = (t: number) => 1 / (t + 273.15);
    const inv = lerp(lp[i], lp[i + 1], iT(s.T[i]), iT(s.T[i + 1]), Math.log(P));
    return 1 / inv - 273.15;
  }
  satP(P: number) {
    return this.satT(this.Tsat(P));
  }
  Psat(T: number) {
    return this.satT(T).P;
  }

  /** two-phase state from P and quality x */
  Px(P: number, x: number): State {
    const s = this.satP(P);
    return {
      T: s.T,
      P,
      x,
      v: s.vf + x * s.vfg,
      u: s.uf + x * s.ufg,
      h: s.hf + x * s.hfg,
      s: s.sf + x * s.sfg,
      phase: x <= 0 ? 'saturated liquid' : x >= 1 ? 'saturated vapor' : 'saturated mixture',
    };
  }
  Tx(T: number, x: number): State {
    return this.Px(this.satT(T).P, x);
  }

  /** superheated vapour at (P, T) using the superheat coordinate dT = T − Tsat(P) */
  private vapor(P: number, T: number) {
    const sp = this.sup;
    const lp = sp.P.map(Math.log);
    const i = bracket(lp, Math.log(P));
    const row = (k: number) => {
      const dT = T - this.Tsat(P); // same superheat on both rows
      const n = sp.h[k].length;
      const xs = sp.dT.slice(0, n);
      return { h: pchip(xs, sp.h[k], dT), s: pchip(xs, sp.s[k], dT), lv: Math.log(pchip(xs, sp.v[k], dT) * sp.P[k]) };
    };
    const a = row(i);
    const b = row(i + 1);
    const t = (Math.log(P) - lp[i]) / (lp[i + 1] - lp[i]);
    const h = a.h + (b.h - a.h) * t;
    const s = a.s + (b.s - a.s) * t;
    // v·P is nearly constant for a gas: interpolate ln(vP) then divide by P
    const v = Math.exp(a.lv + (b.lv - a.lv) * t) / P;
    return { h, s, v };
  }
  private supercritical(P: number, T: number) {
    const sc = this.sc!;
    const lp = sc.P.map(Math.log);
    const i = bracket(lp, Math.log(P));
    const t = (Math.log(P) - lp[i]) / (lp[i + 1] - lp[i]);
    const at = (k: number) => ({ h: pchip(sc.T, sc.h[k], T), s: pchip(sc.T, sc.s[k], T), v: pchip(sc.T, sc.v[k], T) });
    const a = at(i);
    const b = at(i + 1);
    return { h: a.h + (b.h - a.h) * t, s: a.s + (b.s - a.s) * t, v: a.v + (b.v - a.v) * t };
  }

  /** state from pressure (kPa) and temperature (C); sets outOfRange when beyond the data */
  PT(P: number, T: number): State {
    const st = this.PT0(P, T);
    const isW = this.name === 'water';
    if (P > (isW ? 60000 : 4000) || T > (isW ? 1300 : 200)) st.outOfRange = true;
    return st;
  }
  private PT0(P: number, T: number): State {
    if (P >= this.crit.P && this.sc) {
      const r = this.supercritical(P, T);
      return { T, P, ...r, u: r.h - P * r.v, phase: T < this.crit.T ? 'compressed liquid' : 'supercritical' };
    }
    const Ts = this.Tsat(P);
    if (T < Ts - 1e-9) {
      const s = this.satT(T);
      const h = s.hf + s.vf * (P - s.P);
      return { T, P, v: s.vf, u: s.uf, h, s: s.sf, phase: 'compressed liquid' };
    }
    const r = this.vapor(P, T);
    return { T, P, ...r, u: r.h - P * r.v, phase: 'superheated vapor' };
  }

  /** state from pressure and entropy (isentropic processes) */
  Ps(P: number, s: number): State {
    if (P < this.crit.P) {
      const sat = this.satP(P);
      if (s >= sat.sf && s <= sat.sg) return this.Px(P, (s - sat.sf) / sat.sfg);
      if (s > sat.sg) {
        const T = solve((t) => this.PT(P, t).s - s, sat.T, this.maxT());
        return this.PT(P, T);
      }
      const T = solve((t) => this.PT(P, t).s - s, this.minT(), sat.T - 1e-6);
      return this.PT(P, T);
    }
    const T = solve((t) => this.PT(P, t).s - s, this.minT(), this.maxT());
    return this.PT(P, T);
  }
  /** state from pressure and enthalpy (throttling, mixing, energy balances) */
  Ph(P: number, h: number): State {
    if (P < this.crit.P) {
      const sat = this.satP(P);
      if (h >= sat.hf && h <= sat.hg) return this.Px(P, (h - sat.hf) / sat.hfg);
      if (h > sat.hg) {
        const T = solve((t) => this.PT(P, t).h - h, sat.T, this.maxT());
        return this.PT(P, T);
      }
      const T = solve((t) => this.PT(P, t).h - h, this.minT(), sat.T - 1e-6);
      return this.PT(P, T);
    }
    const T = solve((t) => this.PT(P, t).h - h, this.minT(), this.maxT());
    return this.PT(P, T);
  }
  minT() {
    return this.sat.T[0];
  }
  maxT() {
    const sp = this.sup;
    const last = sp.dT[sp.h[0].length - 1];
    return Math.min(sp.Tsat[0] + last, this.name === 'water' ? 1300 : 200);
  }
}

export const water = new PureFluid('water', WSAT as SatTable, WSUP as SupTable, W_CRIT, WSC as ScTable);
export const r134a = new PureFluid('R-134a', RSAT as SatTable, RSUP as SupTable, R_CRIT);

/** isentropic pump work for a liquid, w = v ΔP (kJ/kg with kPa) */
export const pumpWork = (v: number, P1: number, P2: number) => v * (P2 - P1);
