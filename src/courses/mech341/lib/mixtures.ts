/**
 * Ideal-gas mixtures. Gas data after Çengel Tables A-1 (M, Tcr, Pcr) and A-2 (cp, cv at 300 K).
 * Units: M kg/kmol, cp/cv/R kJ/kg·K, Tcr K, Pcr MPa. R = Ru/M.
 */
import { Ru } from './gas';

type G = { M: number; cp: number; cv: number; R: number; Tcr: number; Pcr: number };
const mk = (M: number, cp: number, cv: number, Tcr: number, Pcr: number): G => ({ M, cp, cv, R: Ru / M, Tcr, Pcr });
export const GASES: Record<string, G> = {
  air: mk(28.97, 1.005, 0.718, 132.5, 3.77),
  He: mk(4.003, 5.1926, 3.1156, 5.3, 0.23),
  Ne: mk(20.183, 1.0299, 0.6179, 44.5, 2.73),
  Ar: mk(39.948, 0.5203, 0.3122, 151, 4.86),
  H2: mk(2.016, 14.307, 10.183, 33.3, 1.3),
  N2: mk(28.013, 1.039, 0.743, 126.2, 3.39),
  O2: mk(31.999, 0.918, 0.658, 154.8, 5.08),
  CO: mk(28.011, 1.04, 0.744, 133, 3.5),
  CO2: mk(44.01, 0.846, 0.657, 304.2, 7.39),
  H2O: mk(18.015, 1.8723, 1.4108, 647.1, 22.06),
  CH4: mk(16.043, 2.2537, 1.7354, 191.1, 4.64),
  C2H6: mk(30.07, 1.7662, 1.4897, 305.5, 4.48),
  C3H8: mk(44.097, 1.6794, 1.4909, 370, 4.26),
};

export interface Mixture {
  y: Record<string, number>; // mole fractions
  mf: Record<string, number>; // mass fractions
  M: number;
  R: number;
  cp: number;
  cv: number;
  k: number;
}
function finish(y: Record<string, number>, mf: Record<string, number>): Mixture {
  let M = 0;
  let cp = 0;
  let cv = 0;
  for (const [s, f] of Object.entries(y)) M += f * GASES[s].M;
  for (const [s, f] of Object.entries(mf)) {
    cp += f * GASES[s].cp;
    cv += f * GASES[s].cv;
  }
  return { y, mf, M, R: Ru / M, cp, cv, k: cp / cv };
}
/** mixture from mole amounts (kmol or any proportional unit) */
export function mixtureFromMoles(n: Record<string, number>): Mixture {
  const N = Object.values(n).reduce((a, b) => a + b, 0);
  const y: Record<string, number> = {};
  let m = 0;
  for (const [s, v] of Object.entries(n)) {
    y[s] = v / N;
    m += v * GASES[s].M;
  }
  const mf: Record<string, number> = {};
  for (const [s, v] of Object.entries(n)) mf[s] = (v * GASES[s].M) / m;
  return finish(y, mf);
}
/** mixture from mass amounts (kg or any proportional unit) */
export function mixtureFromMass(m: Record<string, number>): Mixture {
  const mt = Object.values(m).reduce((a, b) => a + b, 0);
  const mf: Record<string, number> = {};
  const n: Record<string, number> = {};
  let N = 0;
  for (const [s, v] of Object.entries(m)) {
    mf[s] = v / mt;
    n[s] = v / GASES[s].M;
    N += n[s];
  }
  const y: Record<string, number> = {};
  for (const s of Object.keys(n)) y[s] = n[s] / N;
  return finish(y, mf);
}
