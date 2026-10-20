/** Refrigeration cycles: vapour-compression (R-134a), two-stage with flash chamber, gas refrigeration. kW, kJ/kg. */
import { r134a, State } from './props';

export interface VcrIn {
  PL?: number;
  TL?: number; // °C, alternative to PL (saturation)
  PH?: number;
  TH?: number; // °C, alternative to PH
  superheat?: number; // K at the evaporator exit
  subcool?: number; // K at the condenser exit
  etaC?: number;
  mdot?: number;
  QL?: number; // kW
  QH?: number; // kW
  T1?: number; // °C, explicit compressor inlet temperature (at PL)
  T2actual?: number; // °C, explicit compressor exit temperature (at PH)
  T3?: number; // °C, explicit condenser exit temperature (at PH)
}
export function vcr(i: VcrIn) {
  const PL = i.PL ?? r134a.Psat(i.TL as number);
  const PH = i.PH ?? r134a.Psat(i.TH as number);
  const s1: State =
    i.T1 !== undefined ? r134a.PT(PL, i.T1) : i.superheat ? r134a.PT(PL, r134a.Tsat(PL) + i.superheat) : r134a.Px(PL, 1);
  const s2s = r134a.Ps(PH, s1.s);
  const s2: State =
    i.T2actual !== undefined ? r134a.PT(PH, i.T2actual) : r134a.Ph(PH, s1.h + (s2s.h - s1.h) / (i.etaC ?? 1));
  const s3: State =
    i.T3 !== undefined ? r134a.PT(PH, i.T3) : i.subcool ? r134a.PT(PH, r134a.Tsat(PH) - i.subcool) : r134a.Px(PH, 0);
  const s4 = r134a.Ph(PL, s3.h);
  const qL = s1.h - s4.h;
  const qH = s2.h - s3.h;
  const w = s2.h - s1.h;
  const mdot = i.mdot ?? (i.QL !== undefined ? i.QL / qL : i.QH !== undefined ? i.QH / qH : 1);
  return {
    states: { 1: s1, '2s': s2s, 2: s2, 3: s3, 4: s4 } as Record<'1' | '2s' | '2' | '3' | '4', State>,
    qL, qH, w, COPR: qL / w, COPHP: qH / w, mdot, QL: mdot * qL, W: mdot * w, QH: mdot * qH,
  };
}

/**
 * Two-stage compression, R-134a, isentropic compressors. State numbers: 1 sat. vapour at PL; 2 LP compressor exit (Pm);
 * 3 vapour to the HP compressor; 4 HP exit (PH); 5 sat. liquid at PH; 6 throttled to Pm; 7 sat. liquid at Pm; 8 throttled to PL; 9 sat. vapour at Pm.
 * layout 'separator' (default, Cengel Fig. P11-60): the LP discharge (2) is bubbled into an adiabatic separator that delivers
 * sat. vapour (3) to the HP compressor; energy balance mH h5 + mL h2 = mH h3 + mL h7.
 * layout 'flash' (Cengel Ex. 11-5 flash chamber): the flash vapour 9 mixes with the LP discharge before the HP compressor.
 */
export function flashTwoStage(i: { PH: number; Pm: number; PL: number; QL: number; layout?: 'separator' | 'flash' }) {
  const s1 = r134a.Px(i.PL, 1);
  const s2 = r134a.Ps(i.Pm, s1.s);
  const s5 = r134a.Px(i.PH, 0);
  const s7 = r134a.Px(i.Pm, 0);
  const s9 = r134a.Px(i.Pm, 1);
  const x6 = (s5.h - s7.h) / (s9.h - s7.h);
  const s8 = r134a.Ph(i.PL, s7.h);
  const mL = i.QL / (s1.h - s8.h);
  let mH: number;
  let s3: State;
  if ((i.layout ?? 'separator') === 'separator') {
    mH = (mL * (s2.h - s7.h)) / (s9.h - s5.h);
    s3 = s9;
  } else {
    mH = mL / (1 - x6);
    s3 = r134a.Ph(i.Pm, (1 - x6) * s2.h + x6 * s9.h);
  }
  const s4 = r134a.Ps(i.PH, s3.s);
  const W = mL * (s2.h - s1.h) + mH * (s4.h - s3.h);
  return {
    x6, mL, mH, W, COP: i.QL / W,
    h: { 1: s1.h, 2: s2.h, 3: s3.h, 4: s4.h, 5: s5.h, 6: s5.h, 7: s7.h, 8: s8.h, 9: s9.h } as Record<string, number>,
  };
}

/** Gas (reverse-Brayton) refrigeration with a regenerator: 1→2 compressor, 2→3 heat rejection, 3→4 regenerator (hot side), 4→5 turbine, 5→6 refrigerated space, 6→1 regenerator (cold side). K. */
export function gasRefrigeration(i: { rp: number; T1: number; T3: number; T5: number; etaC: number; etaT: number; mdot: number; cp?: number; k?: number }) {
  const cp = i.cp ?? 1.005;
  const k = i.k ?? 1.4;
  const c = Math.pow(i.rp, (k - 1) / k);
  const T2 = i.T1 + (i.T1 * c - i.T1) / i.etaC;
  const T4 = i.T5 / (1 - i.etaT * (1 - 1 / c)); // turbine: T5 = T4 − ηT (T4 − T4/c)
  const T6 = i.T1 - (i.T3 - T4); // regenerator energy balance
  const eps = (i.T3 - T4) / (i.T3 - T6);
  const QL = i.mdot * cp * (T6 - i.T5);
  const W = i.mdot * cp * ((T2 - i.T1) - (T4 - i.T5));
  return { T2, T4, T6, eps, QL, W, COP: QL / W };
}
