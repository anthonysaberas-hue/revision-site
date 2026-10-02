/** Heat exchangers: LMTD and effectiveness–NTU methods. SI units. */

export type HXType = 'parallel' | 'counter' | 'shell1' | 'cross-unmixed' | 'cross-cmax-mixed' | 'cross-cmin-mixed';

export const capRate = (mdot: number, cp: number) => mdot * cp;

/** Log-mean temperature difference from the two end differences (works for parallel and counter flow). */
export function lmtd(dT1: number, dT2: number): number {
  if (Math.abs(dT1 - dT2) < 1e-9 * Math.max(Math.abs(dT1), 1)) return dT1;
  return (dT1 - dT2) / Math.log(dT1 / dT2);
}
export const lmtdParallel = (Thi: number, Tho: number, Tci: number, Tco: number) => lmtd(Thi - Tci, Tho - Tco);
export const lmtdCounter = (Thi: number, Tho: number, Tci: number, Tco: number) => lmtd(Thi - Tco, Tho - Tci);

/** Correction factor F for one shell pass and 2, 4, ... tube passes. P = (t2-t1)/(T1-t1), R = (T1-T2)/(t2-t1). */
export function Fshell1(P: number, R: number): number {
  const S = Math.sqrt(R * R + 1);
  if (Math.abs(R - 1) < 1e-9) {
    const num = (Math.SQRT2 * P) / (1 - P);
    const den = Math.log((2 / P - 2 + Math.SQRT2) / (2 / P - 2 - Math.SQRT2));
    return num / den;
  }
  const num = (S / (R - 1)) * Math.log((1 - P) / (1 - P * R));
  const den = Math.log((2 / P - 1 - R + S) / (2 / P - 1 - R - S));
  return num / den;
}

export function effectiveness(type: HXType, NTU: number, Cr: number): number {
  if (Cr < 1e-9) return 1 - Math.exp(-NTU);
  switch (type) {
    case 'parallel':
      return (1 - Math.exp(-NTU * (1 + Cr))) / (1 + Cr);
    case 'counter':
      return Math.abs(Cr - 1) < 1e-9 ? NTU / (1 + NTU) : (1 - Math.exp(-NTU * (1 - Cr))) / (1 - Cr * Math.exp(-NTU * (1 - Cr)));
    case 'shell1': {
      const s = Math.sqrt(1 + Cr * Cr);
      const e = Math.exp(-NTU * s);
      return 2 / (1 + Cr + (s * (1 + e)) / (1 - e));
    }
    case 'cross-unmixed':
      return 1 - Math.exp((Math.pow(NTU, 0.22) / Cr) * (Math.exp(-Cr * Math.pow(NTU, 0.78)) - 1));
    case 'cross-cmax-mixed':
      return (1 / Cr) * (1 - Math.exp(-Cr * (1 - Math.exp(-NTU))));
    case 'cross-cmin-mixed':
      return 1 - Math.exp(-(1 / Cr) * (1 - Math.exp(-Cr * NTU)));
  }
}

/** NTU from effectiveness (closed forms where they exist). */
export function ntuFromEffectiveness(type: HXType, eps: number, Cr: number): number {
  if (Cr < 1e-9) return -Math.log(1 - eps);
  switch (type) {
    case 'parallel':
      return -Math.log(1 - eps * (1 + Cr)) / (1 + Cr);
    case 'counter':
      return Math.abs(Cr - 1) < 1e-9 ? eps / (1 - eps) : Math.log((eps - 1) / (eps * Cr - 1)) / (Cr - 1);
    case 'shell1': {
      const s = Math.sqrt(1 + Cr * Cr);
      const E = (2 / eps - (1 + Cr)) / s;
      return -(1 / s) * Math.log((E - 1) / (E + 1));
    }
    case 'cross-cmax-mixed':
      return -Math.log(1 + Math.log(1 - eps * Cr) / Cr);
    case 'cross-cmin-mixed':
      return -(1 / Cr) * Math.log(1 + Cr * Math.log(1 - eps));
    case 'cross-unmixed': {
      let lo = 1e-6;
      let hi = 50;
      for (let i = 0; i < 200; i++) {
        const m = 0.5 * (lo + hi);
        if (effectiveness(type, m, Cr) < eps) lo = m;
        else hi = m;
      }
      return 0.5 * (lo + hi);
    }
  }
}

export interface HXRating {
  Cmin: number;
  Cmax: number;
  Cr: number;
  NTU: number;
  eps: number;
  Qmax: number;
  Q: number;
  Tho: number;
  Tco: number;
}
/** Rating problem: given UA and inlet temperatures, find Q and outlets. */
export function rateHX(type: HXType, UA: number, Ch: number, Cc: number, Thi: number, Tci: number): HXRating {
  const Cmin = Math.min(Ch, Cc);
  const Cmax = Math.max(Ch, Cc);
  const Cr = Cmin / Cmax;
  const NTU = UA / Cmin;
  const eps = effectiveness(type, NTU, Cr);
  const Qmax = Cmin * (Thi - Tci);
  const Q = eps * Qmax;
  return { Cmin, Cmax, Cr, NTU, eps, Qmax, Q, Tho: Thi - Q / Ch, Tco: Tci + Q / Cc };
}
/** Overall UA from resistances: 1/UA = 1/(hi Ai) + Rwall + Rfoul + 1/(ho Ao). */
export const UAfrom = (hi: number, Ai: number, ho: number, Ao: number, Rwall = 0, Rfoul = 0) => 1 / (1 / (hi * Ai) + Rwall + Rfoul + 1 / (ho * Ao));
/** Temperature profiles along a double-pipe exchanger (n+1 points) by marching with the local UA' = UA/n. */
export function hxProfile(type: 'parallel' | 'counter', UA: number, Ch: number, Cc: number, Thi: number, Tci: number, n = 60) {
  const x: number[] = [];
  const Th: number[] = [];
  const Tc: number[] = [];
  const dUA = UA / n;
  if (type === 'parallel') {
    let th = Thi;
    let tc = Tci;
    for (let i = 0; i <= n; i++) {
      x.push(i / n);
      Th.push(th);
      Tc.push(tc);
      const dq = dUA * (th - tc);
      th -= dq / Ch;
      tc += dq / Cc;
    }
  } else {
    // counter flow: solve analytically for the cold outlet then integrate from x = 0 (hot inlet end)
    const r = rateHX('counter', UA, Ch, Cc, Thi, Tci);
    let th = Thi;
    let tc = r.Tco; // cold fluid leaves at the hot-inlet end
    for (let i = 0; i <= n; i++) {
      x.push(i / n);
      Th.push(th);
      Tc.push(tc);
      const dq = dUA * (th - tc);
      th -= dq / Ch;
      tc -= dq / Cc;
    }
  }
  return { x, Th, Tc };
}
