/**
 * Generalized compressibility / departure charts: Lee–Kesler simple-fluid correlation (Z0, enthalpy and entropy
 * departures), Kay's rule for mixtures, and critical constants (Çengel A-1; Tcr K, Pcr MPa).
 */
import { GASES } from './mixtures';

const b1 = 0.1181193, b2 = 0.265728, b3 = 0.15479, b4 = 0.030323;
const c1 = 0.0236744, c2 = 0.0186984, c3 = 0, c4 = 0.042724;
const d1 = 0.155488e-4, d2 = 0.623689e-4, beta = 0.65392, gamma = 0.060167;

/** reduced-volume equation residual: Pr·Vr/Tr − Z(Tr, Vr) */
function resid(Tr: number, Pr: number, Vr: number) {
  return (Pr * Vr) / Tr - zOf(Tr, Vr);
}
function zOf(Tr: number, Vr: number) {
  const B = b1 - b2 / Tr - b3 / (Tr * Tr) - b4 / Tr ** 3;
  const C = c1 - c2 / Tr + c3 / Tr ** 3;
  const D = d1 + d2 / Tr;
  const g = gamma / (Vr * Vr);
  return 1 + B / Vr + C / (Vr * Vr) + D / Vr ** 5 + (c4 / (Tr ** 3 * Vr * Vr)) * (beta + g) * Math.exp(-g);
}

/** Lee–Kesler simple fluid at (Tr, Pr): Z, Zh = (h̄*−h̄)/(Ru Tcr), Zs = (s̄*−s̄)/Ru (ideal-gas state at same T, P). Vapour/supercritical root. */
export function leeKesler(Tr: number, Pr: number) {
  // vapour root = largest Vr: start at 20× the ideal-gas volume and walk downward to the first sign change
  let hi = (20 * Tr) / Pr;
  let lo = hi;
  let fhi = resid(Tr, Pr, hi);
  let found = false;
  for (let k = 0; k < 4000; k++) {
    lo = hi * 0.99;
    const flo = resid(Tr, Pr, lo);
    if (fhi * flo <= 0) {
      found = true;
      break;
    }
    hi = lo;
    fhi = flo;
  }
  if (!found) return { Z: NaN, Zh: NaN, Zs: NaN };
  let a = lo;
  let b = hi;
  for (let k = 0; k < 200; k++) {
    const m = 0.5 * (a + b);
    if (resid(Tr, Pr, a) * resid(Tr, Pr, m) <= 0) b = m;
    else a = m;
  }
  const Vr = 0.5 * (a + b);
  const Z = (Pr * Vr) / Tr;
  const E = (c4 / (2 * Tr ** 3 * gamma)) * (beta + 1 - (beta + 1 + gamma / (Vr * Vr)) * Math.exp(-gamma / (Vr * Vr)));
  // (h − h*)/(R Tc)
  const hDep =
    Tr * (Z - 1 - (b2 + (2 * b3) / Tr + (3 * b4) / (Tr * Tr)) / (Tr * Vr) - (c2 - (3 * c3) / (Tr * Tr)) / (2 * Tr * Vr * Vr) + d2 / (5 * Tr * Vr ** 5) + 3 * E);
  // (s − s*)/R
  const sDep = Math.log(Z) - (b1 + b3 / (Tr * Tr) + (2 * b4) / Tr ** 3) / Vr - (c1 - (2 * c3) / Tr ** 3) / (2 * Vr * Vr) - d1 / (5 * Vr ** 5) + 2 * E;
  return { Z, Zh: -hDep, Zs: -sDep };
}

/** Kay's rule pseudo-critical constants from mole fractions (keys of CRIT). Tcr K, Pcr MPa. */
export function kay(y: Record<string, number>) {
  let Tcr = 0;
  let Pcr = 0;
  for (const [s, f] of Object.entries(y)) {
    Tcr += f * CRIT[s].Tcr;
    Pcr += f * CRIT[s].Pcr;
  }
  return { Tcr, Pcr };
}

/** critical constants and molar masses (Çengel A-1): Tcr K, Pcr MPa, M kg/kmol */
export const CRIT: Record<string, { Tcr: number; Pcr: number; M: number }> = Object.fromEntries(
  Object.entries(GASES).map(([k, g]) => [k, { Tcr: g.Tcr, Pcr: g.Pcr, M: g.M }]),
);
CRIT.NH3 = { Tcr: 405.5, Pcr: 11.28, M: 17.03 };
CRIT.C2H4 = { Tcr: 282.4, Pcr: 5.12, M: 28.054 };
CRIT.C4H10 = { Tcr: 425.2, Pcr: 3.8, M: 58.124 };
CRIT.R134a = { Tcr: 374.2, Pcr: 4.059, M: 102.03 };
