/** Convection correlations (Çengel & Ghajar 6th ed. forms): external flow, internal flow, natural convection. SI units. */
import { G } from './props';

export const Re = (V: number, L: number, nu: number) => (V * L) / nu;
export const hFromNu = (Nu: number, k: number, L: number) => (Nu * k) / L;

// ===== external forced convection =========================================================
export const RE_CR_PLATE = 5e5;

export const cfLaminarLocal = (Rex: number) => 0.664 / Math.sqrt(Rex);
export const cfTurbulentLocal = (Rex: number) => 0.059 / Math.pow(Rex, 0.2);
export const cfAvgLaminar = (ReL: number) => 1.33 / Math.sqrt(ReL);
export const cfAvgTurbulent = (ReL: number) => 0.074 / Math.pow(ReL, 0.2);
export const cfAvgMixed = (ReL: number, Recr = RE_CR_PLATE) => 0.074 / Math.pow(ReL, 0.2) - (0.074 * Math.pow(Recr, 0.8) - 1.328 * Math.sqrt(Recr)) / ReL;
export const boundaryThickness = (x: number, Rex: number) => (Rex < RE_CR_PLATE ? (4.91 * x) / Math.sqrt(Rex) : (0.38 * x) / Math.pow(Rex, 0.2));

/** Local Nusselt number, isothermal plate. */
export const NuxLaminar = (Rex: number, Pr: number) => 0.332 * Math.sqrt(Rex) * Math.cbrt(Pr);
export const NuxTurbulent = (Rex: number, Pr: number) => 0.0296 * Math.pow(Rex, 0.8) * Math.cbrt(Pr);
export const NuxLocal = (Rex: number, Pr: number, Recr = RE_CR_PLATE) => (Rex <= Recr ? NuxLaminar(Rex, Pr) : NuxTurbulent(Rex, Pr));
/** Churchill–Ozoe laminar, all Pr (Pex >= 100). */
export const NuxChurchillOzoe = (Rex: number, Pr: number) => (0.3387 * Math.cbrt(Pr) * Math.sqrt(Rex)) / Math.pow(1 + Math.pow(0.0468 / Pr, 2 / 3), 0.25);

/** Average Nusselt number over a plate of length L (isothermal): laminar, turbulent or mixed (default Recr = 5e5). */
export function NuPlate(ReL: number, Pr: number, Recr = RE_CR_PLATE): { Nu: number; regime: 'laminar' | 'mixed' | 'turbulent' } {
  const p = Math.cbrt(Pr);
  if (ReL <= Recr) return { Nu: 0.664 * Math.sqrt(ReL) * p, regime: 'laminar' };
  const Nu = (0.037 * Math.pow(ReL, 0.8) - 0.037 * Math.pow(Recr, 0.8) + 0.664 * Math.sqrt(Recr)) * p;
  return { Nu, regime: 'mixed' };
}
/** Fully turbulent from the leading edge. */
export const NuPlateTurbulent = (ReL: number, Pr: number) => 0.037 * Math.pow(ReL, 0.8) * Math.cbrt(Pr);

/** Unheated starting length xi: local Nu correction factors. */
export const NuxUnheatedLaminar = (Rex: number, Pr: number, xi: number, x: number) => NuxLaminar(Rex, Pr) / Math.pow(1 - Math.pow(xi / x, 0.75), 1 / 3);
export const NuxUnheatedTurbulent = (Rex: number, Pr: number, xi: number, x: number) => NuxTurbulent(Rex, Pr) / Math.pow(1 - Math.pow(xi / x, 0.9), 1 / 9);
/** Uniform heat flux local Nu. */
export const NuxFluxLaminar = (Rex: number, Pr: number) => 0.453 * Math.sqrt(Rex) * Math.cbrt(Pr);
export const NuxFluxTurbulent = (Rex: number, Pr: number) => 0.0308 * Math.pow(Rex, 0.8) * Math.cbrt(Pr);

/** Cylinder in crossflow, Churchill–Bernstein (Re Pr > 0.2). */
export function NuCylinderCB(ReD: number, Pr: number): number {
  return 0.3 + (0.62 * Math.sqrt(ReD) * Math.cbrt(Pr)) / Math.pow(1 + Math.pow(0.4 / Pr, 2 / 3), 0.25) * Math.pow(1 + Math.pow(ReD / 282000, 5 / 8), 4 / 5);
}
/** Hilpert / Zukauskas constants for Nu = C Re^m Pr^(1/3) on a circular cylinder. */
export function NuCylinderHilpert(ReD: number, Pr: number): { Nu: number; C: number; m: number } {
  const T: [number, number, number, number][] = [
    [0.4, 4, 0.989, 0.33],
    [4, 40, 0.911, 0.385],
    [40, 4000, 0.683, 0.466],
    [4000, 40000, 0.193, 0.618],
    [40000, 400000, 0.027, 0.805],
  ];
  const row = T.find((r) => ReD >= r[0] && ReD < r[1]) ?? T[T.length - 1];
  return { Nu: row[2] * Math.pow(ReD, row[3]) * Math.cbrt(Pr), C: row[2], m: row[3] };
}
/** Sphere (Whitaker); viscosity ratio mu_inf/mu_s defaults to 1. */
export const NuSphere = (ReD: number, Pr: number, muRatio = 1) => 2 + (0.4 * Math.sqrt(ReD) + 0.06 * Math.pow(ReD, 2 / 3)) * Math.pow(Pr, 0.4) * Math.pow(muRatio, 0.25);

/** Tube bank: maximum velocity (aligned or staggered). ST transverse pitch, SL longitudinal pitch, D diameter. */
export function bankVmax(V: number, ST: number, SL: number, D: number, arrangement: 'aligned' | 'staggered'): number {
  if (arrangement === 'aligned') return (ST / (ST - D)) * V;
  const SD = Math.sqrt(SL * SL + (ST / 2) ** 2);
  return 2 * (SD - D) < ST - D ? (ST / (2 * (SD - D))) * V : (ST / (ST - D)) * V;
}
/** Zukauskas: Nu = C Re_max^m Pr^0.36 (Pr/Prs)^0.25 for 1000 <= Re <= 2e5 (and 2e5-2e6 constants). N >= 16 unless corrected. */
export function NuBank(ReMax: number, Pr: number, PrS: number, arrangement: 'aligned' | 'staggered', ST: number, SL: number, NL = 16): number {
  let C: number;
  let m: number;
  if (ReMax <= 2e5) {
    if (arrangement === 'aligned') {
      C = 0.27;
      m = 0.63;
    } else {
      C = ST / SL < 2 ? 0.35 * Math.pow(ST / SL, 0.2) : 0.4;
      m = 0.6;
    }
  } else {
    C = arrangement === 'aligned' ? 0.021 : 0.022;
    m = 0.84;
  }
  const Nu = C * Math.pow(ReMax, m) * Math.pow(Pr, 0.36) * Math.pow(Pr / PrS, 0.25);
  return Nu * bankCorrection(arrangement, NL);
}
/** Correction factor for fewer than 16 rows (approximate Table 7-3 values). */
export function bankCorrection(arrangement: 'aligned' | 'staggered', NL: number): number {
  const rows = [1, 2, 3, 4, 5, 7, 10, 13, 16];
  const al = [0.7, 0.8, 0.86, 0.9, 0.92, 0.95, 0.97, 0.98, 0.99];
  const st = [0.64, 0.76, 0.84, 0.89, 0.92, 0.95, 0.97, 0.98, 0.99];
  const v = arrangement === 'aligned' ? al : st;
  if (NL >= 16) return 1;
  for (let i = 0; i < rows.length - 1; i++) if (NL <= rows[i + 1]) return v[i] + ((v[i + 1] - v[i]) * (NL - rows[i])) / (rows[i + 1] - rows[i]);
  return 1;
}

// ===== internal forced convection =========================================================
export const reynoldsDh = (V: number, Dh: number, nu: number) => (V * Dh) / nu;
export const flowRegime = (Re: number): 'laminar' | 'transitional' | 'turbulent' => (Re < 2300 ? 'laminar' : Re <= 10000 ? 'transitional' : 'turbulent');
export const hydraulicDiameter = (Ac: number, P: number) => (4 * Ac) / P;
export const entryLengthLaminarHydro = (Re: number, D: number) => 0.05 * Re * D;
export const entryLengthLaminarThermal = (Re: number, Pr: number, D: number) => 0.05 * Re * Pr * D;
export const entryLengthTurbulent = (D: number) => 10 * D;

export const NuLaminarFD = (bc: 'Ts' | 'qs') => (bc === 'Ts' ? 3.66 : 4.36);
/** Hausen: thermal entry region, constant surface temperature (circular tube). */
export function NuHausen(Re: number, Pr: number, D: number, L: number): number {
  const g = (D / L) * Re * Pr;
  return 3.66 + (0.065 * g) / (1 + 0.04 * Math.pow(g, 2 / 3));
}
/** Sieder–Tate combined entry (laminar, liquids). */
export const NuSiederTate = (Re: number, Pr: number, D: number, L: number, muRatio = 1) => 1.86 * Math.cbrt(Re * Pr * (D / L)) * Math.pow(muRatio, 0.14);

export const frictionPetukhov = (Re: number) => Math.pow(0.79 * Math.log(Re) - 1.64, -2);
export const frictionLaminar = (Re: number) => 64 / Re;
export const NuDittusBoelter = (Re: number, Pr: number, heating = true) => 0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, heating ? 0.4 : 0.3);
export const NuColburn = (Re: number, Pr: number) => 0.125 * frictionPetukhov(Re) * Re * Math.cbrt(Pr);
export function NuGnielinski(Re: number, Pr: number, f = frictionPetukhov(Re)): number {
  return ((f / 8) * (Re - 1000) * Pr) / (1 + 12.7 * Math.sqrt(f / 8) * (Math.pow(Pr, 2 / 3) - 1));
}

/** Mean outlet temperature, isothermal wall Ts: Te = Ts - (Ts - Ti) exp(-h As / (mdot cp)). */
export const outletTempConstTs = (Ts: number, Ti: number, h: number, As: number, mdot: number, cp: number) => Ts - (Ts - Ti) * Math.exp(-(h * As) / (mdot * cp));
export const lmtdTube = (Ts: number, Ti: number, Te: number) => ((Ts - Te) - (Ts - Ti)) / Math.log((Ts - Te) / (Ts - Ti));
/** Constant surface heat flux: Te = Ti + qs As/(mdot cp). */
export const outletTempConstQ = (Ti: number, qs: number, As: number, mdot: number, cp: number) => Ti + (qs * As) / (mdot * cp);
export const pressureDrop = (f: number, L: number, D: number, rho: number, Vm: number) => f * (L / D) * (rho * Vm * Vm) / 2;
export const pumpPower = (dP: number, Vdot: number) => dP * Vdot;

// ===== natural convection ==================================================================
export const Rayleigh = (beta: number, dT: number, L: number, nu: number, alpha: number) => (G * beta * Math.abs(dT) * L * L * L) / (nu * alpha);
export const Grashof = (beta: number, dT: number, L: number, nu: number) => (G * beta * Math.abs(dT) * L * L * L) / (nu * nu);

export const NuVerticalFull = (Ra: number, Pr: number) => Math.pow(0.825 + (0.387 * Math.pow(Ra, 1 / 6)) / Math.pow(1 + Math.pow(0.492 / Pr, 9 / 16), 8 / 27), 2);
export const NuVerticalLaminar = (Ra: number, Pr: number) => 0.68 + (0.67 * Math.pow(Ra, 0.25)) / Math.pow(1 + Math.pow(0.492 / Pr, 9 / 16), 4 / 9);
/** Horizontal plate: surface hot facing up (or cold facing down) vs hot facing down (or cold up). Lc = As/p. */
export function NuHorizontalPlate(Ra: number, hotFacingUp: boolean): number {
  if (hotFacingUp) return Ra < 1e7 ? 0.54 * Math.pow(Ra, 0.25) : 0.15 * Math.cbrt(Ra);
  return 0.27 * Math.pow(Ra, 0.25);
}
export const NuHorizontalCylinder = (Ra: number, Pr: number) => Math.pow(0.6 + (0.387 * Math.pow(Ra, 1 / 6)) / Math.pow(1 + Math.pow(0.559 / Pr, 9 / 16), 8 / 27), 2);
export const NuSphereNatural = (Ra: number, Pr: number) => 2 + (0.589 * Math.pow(Ra, 0.25)) / Math.pow(1 + Math.pow(0.469 / Pr, 9 / 16), 4 / 9);
/** Enclosures: horizontal (heated from below) and vertical rectangular. */
export const NuEnclosureHorizontal = (Ra: number) => (Ra < 4e5 ? 0.195 * Math.pow(Ra, 0.25) : 0.068 * Math.cbrt(Ra));
export const NuEnclosureVertical = (Ra: number, Pr: number, H: number, L: number) => (Ra < 1e7 ? 0.42 * Math.pow(Ra, 0.25) * Math.pow(Pr, 0.012) * Math.pow(H / L, -0.3) : 0.046 * Math.cbrt(Ra));
/** Combined natural + forced: Nu^n = Nuf^n +/- Nun^n (n = 3; + for assisting/transverse, - for opposing). */
export const NuCombined = (Nuf: number, Nun: number, sign: 1 | -1 = 1, n = 3) => Math.pow(Math.pow(Nuf, n) + sign * Math.pow(Nun, n), 1 / n);
