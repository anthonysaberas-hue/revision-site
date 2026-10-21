import { describe, expect, it } from 'vitest';
import { water, r134a } from './props';
import { Ru, hbar, hR, A28, vantHoff, atmosphere, HFG_WATER_25, SPECIES } from './gas';
import { turbojet, rankine } from './cycles';
import { vcr, flashTwoStage } from './refrig';
import { psyState, omega, Tdp, hAir } from './psychro';
import { mixtureFromMass, GASES } from './mixtures';
import { burn, dewPoint, steadyQ, aft, Hprod, Hreact } from './combustion';
import { equilibrium, lnKpAt } from './equilibrium';
import { T0_T, P0_P, areaRatio, machFromAreaRatio, soundSpeed, critical, stagnationT } from './compressible';
import { leeKesler, kay, CRIT } from './realgas';

/** |a - b| <= rel * max(1, |b|) */
const near = (a: number, b: number, rel = 1e-3) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

const LN_CO2 = 'CO₂ ⇌ CO + ½O₂';
const LN_NO = '½N₂ + ½O₂ ⇌ NO';

/* ===================================================================== helpers for the mocks (lib has no turboprop / turbofan / shock) */
/** single-spool-gas-generator turboprop: HP turbine drives the compressor, free power turbine drives the propeller, convergent nozzle */
function turboprop(i: { Ta: number; Pa: number; V: number; mdot: number; rc: number; T04: number; f: number; etaC: number; etaT1: number; etaT2: number; P06: number; etaProp: number }) {
  const cpa = 1.005, ka = 1.4, cpg = 1.147, kg = 1.333;
  const T01 = i.Ta + (i.V * i.V) / (2000 * cpa);
  const P01 = i.Pa * Math.pow(T01 / i.Ta, ka / (ka - 1));
  const T03s = T01 * Math.pow(i.rc, (ka - 1) / ka);
  const T03 = T01 + (T03s - T01) / i.etaC;
  const wc = cpa * (T03 - T01);
  const Wc = i.mdot * wc;
  const P04 = i.rc * P01;
  const T05 = i.T04 - Wc / (i.mdot * cpg);
  const T05s = i.T04 - (i.T04 - T05) / i.etaT1;
  const P05 = P04 * Math.pow(T05s / i.T04, kg / (kg - 1));
  const T06s = T05 * Math.pow(i.P06 / P05, (kg - 1) / kg);
  const T06 = T05 - i.etaT2 * (T05 - T06s);
  const wpt = cpg * (T05 - T06);
  const Wpt = i.mdot * wpt;
  const Pcrit = i.P06 * Math.pow(2 / (kg + 1), kg / (kg - 1));
  const Tes = T06 * Math.pow(i.Pa / i.P06, (kg - 1) / kg);
  const Ve = Math.sqrt(2000 * cpg * (T06 - Tes));
  const Fj = i.mdot * (1 + i.f) * Ve - i.mdot * i.V;
  const ESHP = Wpt + (Fj * i.V) / (1000 * i.etaProp);
  const ESFC = (i.mdot * i.f * 3600) / ESHP;
  return { a: Math.sqrt(ka * 0.287 * 1000 * i.Ta), T01, P01, T03, wc, Wc, P04, T05, T05s, P05, T06s, T06, wpt, Wpt, Pcrit, Tes, Ve, Fj, ESHP, ESFC };
}

/** unmixed two-stream turbofan: one turbine drives the fan (all the air) and the core compressor; both nozzles expand fully to ambient */
function turbofan(i: { Ta: number; Pa: number; V: number; mc: number; beta: number; rf: number; etaF: number; rcc: number; etaC: number; T04: number; etaT: number; f: number }) {
  const cpa = 1.005, ka = 1.4, cpg = 1.147, kg = 1.333;
  const T01 = i.Ta + (i.V * i.V) / (2000 * cpa);
  const P01 = i.Pa * Math.pow(T01 / i.Ta, ka / (ka - 1));
  const Tfs = T01 * Math.pow(i.rf, (ka - 1) / ka);
  const T013 = T01 + (Tfs - T01) / i.etaF;
  const wf = cpa * (T013 - T01);
  const P013 = i.rf * P01;
  const mb = i.mc * i.beta;
  const mt = i.mc + mb;
  const Tcs = T013 * Math.pow(i.rcc, (ka - 1) / ka);
  const T03 = T013 + (Tcs - T013) / i.etaC;
  const wcc = cpa * (T03 - T013);
  const P03 = i.rcc * P013;
  const Wneed = mt * wf + i.mc * wcc;
  const T05 = i.T04 - Wneed / (i.mc * cpg);
  const T05s = i.T04 - (i.T04 - T05) / i.etaT;
  const P05 = P03 * Math.pow(T05s / i.T04, kg / (kg - 1));
  const Tes = T05 * Math.pow(i.Pa / P05, (kg - 1) / kg);
  const Vc = Math.sqrt(2000 * cpg * (T05 - Tes));
  const Tbs = T013 * Math.pow(i.Pa / P013, (ka - 1) / ka);
  const Vb = Math.sqrt(2000 * cpa * (T013 - Tbs));
  const Fc = i.mc * (1 + i.f) * Vc - i.mc * i.V;
  const Fb = mb * Vb - mb * i.V;
  const F = Fc + Fb;
  return { a: Math.sqrt(ka * 0.287 * 1000 * i.Ta), T01, P01, T013, wf, P013, T03, wcc, P03, Wneed, T05, T05s, P05, Vc, Vb, Fc, Fb, F, TSFC: (i.mc * i.f) / F, mb, mt };
}

/** normal-shock static-pressure ratio P2/P1 */
const shockP = (M1: number, k: number) => 1 + ((2 * k) / (k + 1)) * (M1 * M1 - 1);
/** Mach after a normal shock */
const shockM2 = (M1: number, k: number) => Math.sqrt((1 + ((k - 1) / 2) * M1 * M1) / (k * M1 * M1 - (k - 1) / 2));

/* ===================================================================== final 2021 */
describe('final 2021', () => {
  const fin = { Ta: 223.26, Pa: 26.5, V: 270, mdot: 0.5, rc: 15, T04: 1400, etaC: 0.85, etaT: 0.9, cpg: 1.147, kg: 1.333, f: 0.020636 };
  it('P1 turbojet: table a-h', () => {
    expect(atmosphere(10000).P).toBeGreaterThan(26.3);
    expect(atmosphere(10000).P).toBeLessThan(26.6);
    const r = turbojet(fin);
    near(r.Ma, 0.9015, 1e-3);
    near(r.P01 / 100, 0.4488, 2e-3); // bar
    near(r.ramRatio, 1.694, 1e-3);
    near(r.P01 - fin.Pa, 18.38, 2e-3); // kPa ram rise
    near(r.P02 / r.P01, 1, 1e-12); // diffuser recovery
    near(r.Wc, 179.18, 1e-3);
    near(r.T03, 616.1, 1e-3);
    near(r.T05, 1087.6, 1e-3);
    near(r.P05 / 100, 2.1515, 1e-3);
    near(r.Pe / 100, 0.265, 1e-12);
    near(r.Ve, 1008.1, 1e-3);
    near(r.Fpres, 0, 1e-9);
    near(r.Fmom, 379.5, 1e-3);
    // student copy: 2.158 bar, 1009.08 m/s, 379.95 N are within 0.3 %, 0.1 %, 0.13 %
    near(2.158, r.P05 / 100, 4e-3);
    near(1009.08, r.Ve, 1.5e-3);
    near(379.95, r.Fmom, 1.5e-3);
    // his T0 = 259.36 K (T = 273 - 49.9 + 273): 259.52 vs 259.36 changes Wc by 0.06 %
    near(179.05, r.Wc, 1e-3);
    // fuel mass in the turbine: the alternative convention
    near(turbojet({ ...fin, fuelMassInTurbine: true }).Ve, 1015.9, 2e-3);
    near(turbojet({ ...fin, fuelMassInTurbine: true }).Fmom, 383.4, 2e-3);
    near(0.5 * (r.Ve - 270), 369.1, 1e-3); // per kg of air only
    near(r.T01, 259.53, 1e-4);
    // without ram the compressor exit would be 530 K
    const T03s0 = 223.26 * Math.pow(15, 0.4 / 1.4);
    near(223.26 + (1.005 * (T03s0 - 223.26)) / 0.85 / 1.005, 530.1, 2e-3);
    near((2 * 270) / (270 + r.Ve), 0.4225, 1e-3);
    near(r.Pcrit, 116.1, 1e-3);
  });
  it('P2 decane AFT: 1364 K; student two-trial slips', () => {
    const o = { fuel: [[1, 'C10H22']] as [number, string][], theoAir: 49.849 / 15.5, Tfuel: 298.15, Tair: 616.1 };
    const b = burn(o);
    near(b.a, 49.849, 1e-4);
    near(b.products.O2, 34.35, 1e-3);
    near(b.products.N2, 187.4, 1e-3);
    near(aft(o), 1364.8, 1e-3);
    near(Hprod(b.products, 1364.8), Hreact(o), 1e-4);
    // the exam's trial-and-interpolate in table form (his table entries)
    const HR = -300000 + 49.85 * (18572 - 8682) + 187.4 * (18166 - 8669);
    const hf = 10 * -393520 + 11 * -241820;
    const h0 = 11 * 9904 + 10 * 9364 + 34.35 * 8682 + 187.4 * 8669;
    const target = HR - hf + h0;
    const sum = (h: number[]) => 11 * h[0] + 10 * h[1] + 34.35 * h[2] + 187.4 * h[3];
    const s1 = sum([51521, 62963, 44198, 42227]); // ~1360 K
    const s2 = sum([53351, 65271, 45648, 43605]); // 1400 K
    near(target, 1.0693e7, 1e-3);
    near(s1, 1.0628e7, 1e-3);
    near(s2, 1.0979e7, 1e-3);
    const Tint = 1360 + (40 * (target - s1)) / (s2 - s1);
    near(Tint, 1367.5, 1e-3);
    // the copy's 22 in place of 11 inflates the trial sums by 11 h_H2O
    near(s2 + 11 * 53351, 1.1566e7, 1e-3);
  });
  it('P3 (a) Kp at 4000 K, (b) h_f of liquid water', () => {
    near(lnKpAt(LN_CO2, 4000), 1.608, 2e-3); // table A-28: 1.599
    near(lnKpAt(LN_NO, 4000), -1.2075, 2e-3); // table A-28: -1.216
    near(Math.exp(1.599), 4.95, 3e-3);
    near(Math.exp(-1.216) ** 2, 0.0876, 3e-3); // student: 0.296^2 = 0.0876 (correct)
    near(Math.exp(2 * lnKpAt(LN_NO, 4000)), 0.0894, 5e-3);
    const hfl = -241820 - SPECIES.H2Og.M * HFG_WATER_25;
    near(hfl, -285807, 1e-5);
    near(hfl, -285830, 1e-4); // table A-26
    near(SPECIES.H2Ol.hf, -285830, 1e-9);
    // zero crossing of ln Kp of CO2 dissociation and the extents at 4000 K, 1 atm
    expect(lnKpAt(LN_CO2, 3300)).toBeLessThan(0);
    expect(lnKpAt(LN_CO2, 3500)).toBeGreaterThan(0);
    const c4 = equilibrium({ lnK: lnKpAt(LN_CO2, 4000), reac: [[1, 'CO2']], prod: [[1, 'CO'], [0.5, 'O2']], initial: { CO2: 1 }, P: 1 });
    near(c4.CO, 0.8996, 1e-3);
    const n4 = equilibrium({ lnK: 2 * lnKpAt(LN_NO, 4000), reac: [[1, 'N2'], [1, 'O2']], prod: [[2, 'NO']], initial: { N2: 1, O2: 1 }, P: 1 });
    near(n4.NO, 0.2601, 2e-3);
    near(HFG_WATER_25 * SPECIES.H2Og.M, 43987, 1e-4);
    near((285830 - 241820) / 18.015, 2443, 1e-3);
    near(41523 / 18.015, 2305, 1e-3);
  });
  it('P4 steam cogeneration', () => {
    const s1 = water.PT(1600, 300);
    const s2 = water.Ps(200, s1.s);
    const s3 = water.Ps(10, s1.s);
    const f4 = water.Px(10, 0);
    const wP = f4.v * (1600 - 10);
    const h5 = f4.h + wP;
    near(s2.x as number, 0.957, 2e-3);
    near(s3.x as number, 0.8317, 2e-3);
    const h6 = 251.22;
    const Qin = s1.h - h5;
    const WT = s1.h - s2.h + 0.85 * (s2.h - s3.h);
    const Wnet = WT - wP;
    const Qload = 0.15 * (s2.h - h6);
    const Qcond = 0.85 * (s3.h - f4.h) + 0.15 * (h6 - f4.h);
    near(wP, 1.606, 2e-3);
    near(Qin, 2842.0, 1e-3);
    near(Wnet, 788.1, 1e-3);
    near(Qload, 354.1, 1e-3);
    near(Qcond, 1699.9, 1e-3);
    // first law: Qin = Wnet + Qload + Qcond
    near(Qin, Wnet + Qload + Qcond, 2e-3);
    // student copy (table values): 2842.01, 787.33, 354.06, 1700.58
    near(2842.01, Qin, 1e-3);
    near(787.33, Wnet, 2e-3);
    near(1700.58, Qcond, 1e-3);
  });
  it('P5 dehumidifier (100 kPa): T2 10.5, 48.6 kg/min, 43.6 m3/min, 0.539, 12.0 kW; copy and notebook', () => {
    const a = psyState({ T: 30, P: 100, phi: 0.7 });
    const w3 = omega(25, 0.4, 100);
    const T2 = Tdp(w3, 100);
    const b = psyState({ T: T2, P: 100, phi: 1 });
    const c = psyState({ T: 25, P: 100, w: w3 });
    const hf2 = water.satT(T2).hf;
    const ma = (11 * 211) / (a.h - b.h - (a.w - b.w) * hf2);
    near(T2, 10.48, 3e-3);
    near(ma, 48.6, 3e-3);
    near(ma * a.v, 43.6, 3e-3);
    near(ma * (a.w - b.w), 0.539, 5e-3);
    near((ma * (c.h - b.h)) / 60, 12.0, 5e-3);
    // a.h, v
    near(a.h, 78.86, 2e-3);
    near(a.v, 0.8967, 2e-3);
    // student copy: h1 = 71, h2 = 30.5, w1 = 16.25 g/kg, 1 ton = 3.5 kW, no condensate term
    near((11 * 3.5) / (71 - 30.5), 0.95, 1e-2);
    near(57 * 0.875, 49.875, 1e-6);
    near(57 * (0.01625 - 0.008), 0.4703, 1e-3);
    near(0.95 * (45.5 - 30.5), 14.25, 1e-6);
    // his notebook: P = 101.3 kPa; T2 by linear interpolation between the 1.0 and 1.5 kPa rows of A-5; no condensate term
    const a2 = psyState({ T: 30, P: 101.3, phi: 0.7 });
    near(a2.w, 0.01880, 3e-3);
    const w32 = omega(25, 0.4, 101.3);
    near(w32, 7.883e-3, 3e-3);
    const Pv2 = (w32 * 101.3) / (0.622 + w32);
    near(Pv2, 1.267, 2e-3);
    // A-4 rows 10 and 11 C: 1.2281 and 1.3129 kPa give 10.47 C
    near(10 + (Pv2 - 1.2281) / (1.3129 - 1.2281), 10.47, 2e-3);
    near(water.Psat(10), 1.2281, 1e-3);
    near(water.Psat(11), 1.3129, 1e-3);
    const Tlin = 6.97 + ((Pv2 - 1.0) / 0.5) * (12.99 - 6.97);
    near(Tlin, 10.21, 3e-3);
    near(water.Tsat(Pv2), 10.48, 3e-3);
    near(2321 / (78.2 - 29.9), 48.05, 1e-3);
    near(hAir(30, a2.w), 78.2, 2e-3);
    const b2 = psyState({ T: 10.21, P: 101.3, w: w32 });
    near(2321 / (a2.h - b2.h), 48.27, 2e-3); // exact h2 at 10.21 C, still no condensate term
    near(2321 / (a2.h - b2.h - (a2.w - w32) * water.satT(10.21).hf), 48.74, 2e-3);
    near(1.005 * 10 + w32 * (2501.3 + 1.82 * 10), 29.9, 3e-3); // his h2 uses 10 C in the sensible term
  });
  it('P6 humidifier (reconstructed): 81.1 kg/min, 0.2958 kg/min steam, 19.5 C, 783 kJ/min', () => {
    const a = psyState({ T: 10, P: 95, phi: 0.7 });
    const s3 = psyState({ T: 20, P: 95, phi: 0.6 });
    const ma = 70 / a.v;
    const mw = ma * (s3.w - a.w);
    const hw = water.satT(100).hg;
    const h2 = (ma * s3.h - mw * hw) / ma;
    let lo = 10;
    let hi = 40;
    for (let k = 0; k < 80; k++) {
      const m = (lo + hi) / 2;
      if (hAir(m, a.w) < h2) lo = m;
      else hi = m;
    }
    near(a.w, 5.68e-3, 2e-3);
    near(a.v, 0.8632, 1e-3);
    near(ma, 81.1, 1e-3);
    near(s3.w, 9.327e-3, 1e-3);
    near(mw, 0.2958, 2e-3);
    near(hw, 2675.6, 1e-4);
    near(h2, 34.01, 1e-3);
    near(lo, 19.5, 1e-3);
    near(ma * (h2 - a.h), 782.6, 1e-3);
    // his own numbers: 81.13, 0.2958, 34.07, 19.51, 789.9 (0.9 % higher heat: a small difference of two enthalpies)
    near(789.9, ma * (h2 - a.h), 1e-2);
    near(psyState({ T: 20, P: 95, w: a.w }).phi, 0.367, 3e-3);
    near(a.h, 24.36, 1e-3);
    near(s3.h, 43.77, 1e-3);
    near(81.13, ma, 1e-3);
  });
});

/* ===================================================================== midterm review */
describe('midterm review (Oct 2023)', () => {
  it('turbojet class example: T03 630.3, T05 1100, P05 404, nozzles', () => {
    const k = 1.333;
    const T03s = 288.15 * Math.pow(12, 0.4 / 1.4);
    const wC = (1.005 * (T03s - 288.15)) / 0.87;
    const T03 = 288.15 + wC / 1.005;
    near(T03, 630.6, 1e-3);
    const r = turbojet({ Ta: 288.15, Pa: 100, V: 0, mdot: 1, rc: 12, T04: 1400, etaC: 0.87, etaT: 0.9, cpg: 1.147, kg: k, nozzle: 'C', f: 0.02068 });
    near(r.T05, 1100, 1e-3);
    near(r.P05, 404, 2e-3);
    expect(r.choked).toBe(true);
    near(r.Ve, 600.1, 1e-3);
    near(r.Pe, 218.1, 1e-3);
    const cd = turbojet({ Ta: 288.15, Pa: 100, V: 0, mdot: 1, rc: 12, T04: 1400, etaC: 0.87, etaT: 0.9, cpg: 1.147, kg: k, nozzle: 'CD', f: 0.02068 });
    near(cd.Ve, 862, 1e-3);
    // thrust per kg/s of air, fuel mass neglected in the jet (class convention)
    const rho = r.Pe / (0.287 * r.Te);
    const A = 1 / (rho * r.Ve);
    near(r.Ve + (r.Pe - 100) * 1000 * A, 844, 1e-2);
    // choking rule of thumb: P05/Pa vs critical ratio 1.85
    near(1 / critical(k).P, 1.853, 2e-3);
  });
  it('Rankine 4 MPa / 400 C / 10 kPa: ideal, actual, reheat, OFWH', () => {
    const a = rankine({ Pb: 4000, Tb: 400, Pc: 10 });
    near(a.wP, 4.03, 3e-3);
    near(a.wT, 1070.0, 2e-3);
    near(a.qin, 3018.6, 1e-3);
    near(a.qout, 1952.7, 1e-3);
    near(a.x_exit, 0.8163, 1e-3);
    near(a.eta, 0.3531, 1e-3);
    const b = rankine({ Pb: 4000, Tb: 400, Pc: 10, etaT: 0.85, etaP: 0.85 });
    near(b.x_exit, 0.883, 2e-3);
    near(b.eta, 0.2998, 2e-3);
    const c = rankine({ Pb: 4000, Tb: 400, Pc: 10, reheat: { P: 400, T: 400 } });
    near(c.x_exit, 0.967, 1e-3);
    near(c.wnet, 1293.5, 1e-3);
    near(c.qin, 3606.2, 1e-3);
    near(c.eta, 0.3587, 1e-3);
    const d = rankine({ Pb: 4000, Tb: 400, Pc: 10, ofwh: { P: 400 } });
    near(d.y, 0.1654, 2e-3);
    near(d.wnet, 976.1, 1e-3);
    near(d.qin, 2605.9, 1e-3);
    near(d.eta, 0.3746, 1e-3);
    // reheat: the reheater adds heat at 521 K on average, the whole heat addition averages 497 K (493 K without reheat)
    const s3r = water.PT(4000, 400);
    const s5r = water.PT(400, 400);
    const s4r = water.Ps(400, s3r.s);
    const s2r = water.Ph(4000, 195.84);
    near((s5r.h - s4r.h) / (s5r.s - s4r.s), 520.6, 2e-3);
    near(c.qin / (s3r.s - s2r.s + s5r.s - s4r.s), 497.3, 2e-3);
    near(a.qin / (s3r.s - s2r.s), 493.1, 2e-3);
    // OFWH: boiler inlet is compressed liquid with h = 608.56
    near(d.qin / (s3r.s - water.Ph(4000, 608.56).s), 521.7, 3e-3);
    // Carnot reasoning: average heat-addition temperature rises with each modification
    near(a.qin / (water.PT(4000, 400).s - water.Px(10, 0).s), 3018.6 / (6.7714 - 0.6492), 3e-3);
  });
  it('12.5 MPa / 550 C, CFWH 0.8 MPa + OFWH 0.3 MPa, 250 MW', () => {
    const s8 = water.PT(12500, 550);
    const s9 = water.Ps(800, s8.s);
    const s10 = water.Ps(300, s8.s);
    const s11 = water.Ps(10, s8.s);
    const s1 = water.Px(10, 0);
    const h2 = s1.h + s1.v * (300 - 10);
    const s3 = water.Px(300, 0);
    const h4 = s3.h + s3.v * (12500 - 300);
    const s6 = water.Px(800, 0);
    const s5 = water.PT(12500, s6.T);
    const y = (s5.h - h4) / (s9.h - s6.h);
    const z = (s3.h - h2 - y * (s6.h - h2)) / (s10.h - h2);
    const wT = s8.h - s9.h + (1 - y) * (s9.h - s10.h) + (1 - y - z) * (s10.h - s11.h);
    const wP = (1 - y - z) * s1.v * (300 - 10) + s3.v * (12500 - 300);
    const wnet = wT - wP;
    const qin = s8.h - s5.h;
    near(s8.h, 3476.5, 1e-3);
    near(s9.h, 2754.9, 1e-3);
    near(s10.h, 2578.4, 1e-3);
    near(s11.h, 2099.9, 1e-3);
    near(s6.T, 170.4, 1e-3);
    near(s5.h, 733.9, 1e-3);
    near(y, 0.0784, 3e-3);
    near(z, 0.1374, 3e-3);
    near(wT, 1259.5, 1e-3);
    near(wnet, 1246.2, 1e-3);
    near(qin, 2742.5, 1e-3);
    near(250000 / wnet, 200.6, 1e-3);
    near(wnet / qin, 0.4544, 1e-3);
    near(rankine({ Pb: 12500, Tb: 550, Pc: 10 }).eta, 0.4168, 1e-3);
    // heat rejected check
    near(1 - ((1 - y - z) * (s11.h - s1.h)) / qin, wnet / qin, 3e-3);
  });
  it('cogeneration: 41.6 MW, 19.97 MW / 40.8 %, 26.2 + 10.97 MW / 86.5 %', () => {
    const b1 = water.PT(7000, 500);
    const x5 = water.Ps(500, b1.s);
    const x6 = water.Ps(5, b1.s);
    const f5 = water.Px(5, 0);
    const f500 = water.Px(500, 0);
    const p5 = f5.h + f5.v * (7000 - 5);
    const p500 = f500.h + f500.v * (7000 - 500);
    near(b1.h, 3411.4, 1e-3);
    near(x5.h, 2739.2, 1e-3);
    near(x6.h, 2072.9, 1e-3);
    near(15 * (b1.h - f500.h), 41570, 1e-3);
    const Wb = 15 * (b1.h - x6.h) - 15 * (p5 - f5.h);
    const Qb = 15 * (b1.h - p5);
    near(Wb, 19971, 1e-3);
    near(Wb / Qb, 0.408, 3e-3);
    const Qp = 10.5 * x5.h + 1.5 * b1.h - 12 * f500.h;
    const WT = 13.5 * (b1.h - x5.h) + 3 * (x5.h - x6.h);
    const WP = 3 * (p5 - f5.h) + 12 * (p500 - f500.h);
    const hmix = (3 * p5 + 12 * p500) / 15;
    const Qin = 15 * (b1.h - hmix);
    near(Qp, 26198, 1e-3);
    near(WT - WP, 10966, 1e-3);
    near(hmix, 546.7, 1e-3);
    near(Qin, 42970, 1e-3);
    near((WT - WP + Qp) / Qin, 0.865, 2e-3);
    // energy check: Qin = W + Qp + condenser heat
    const Qcond = 3 * (x6.h - f5.h);
    near(Qin, WT - WP + Qp + Qcond, 3e-3);
  });
  it('single versus two-stage R-134a (-25 C, 800 kPa, 0.6 kg/s)', () => {
    const PL = r134a.Psat(-25);
    near(PL, 106.4, 1e-3);
    const QL = 0.6 * (r134a.Px(PL, 1).h - r134a.Px(800, 0).h);
    const s = vcr({ PL, PH: 800, QL });
    near(s.mdot, 0.6, 1e-9);
    near(s.QL, 83.9, 1e-3);
    near(s.W, 25.1, 3e-3);
    near(s.COPR, 3.34, 2e-3);
    const Pi = Math.sqrt(PL * 800);
    near(Pi, 291.8, 1e-3);
    const L = vcr({ PL, PH: Pi, mdot: 0.6 });
    const H = vcr({ PL: Pi, PH: 800, QL: L.QH });
    near(L.QL, 110.2, 2e-3);
    near(H.mdot, 0.790, 2e-3);
    near(L.W + H.W, 28.7, 2e-3);
    near(L.QL / (L.W + H.W), 3.83, 2e-3);
    near(L.states[2].h, 255.6, 2e-3);
    near(L.states[3].h, 51.7, 3e-3);
    near(flashTwoStage({ PH: 800, Pm: Pi, PL, QL: L.QL }).COP, 3.83, 3e-3);
  });
});

/* ===================================================================== tutorial 16 */
describe('tutorial chapter 16', () => {
  it('16-8C: NO yield is independent of P (delta nu = 0)', () => {
    const lnK = 2 * lnKpAt(LN_NO, 3000);
    const at = (P: number) => equilibrium({ lnK, reac: [[1, 'N2'], [1, 'O2']], prod: [[2, 'NO']], initial: { N2: 3.76, O2: 1 }, P });
    const a = at(1);
    const b = at(3);
    near(a.NO, 0.2199, 1e-3);
    near(b.NO, a.NO, 1e-9);
    near(a.NO / 4.76, 0.0462, 2e-3);
    near(lnK, -4.207, 1e-3);
    near(Math.exp(lnK), 0.0149, 1e-2);
    // Kp depends on T only: ln Kp(2000) < ln Kp(3000)
    expect(lnKpAt(LN_NO, 2000)).toBeLessThan(lnKpAt(LN_NO, 3000));
  });
  it('16-52C: CO2 is more complete at 2000 K than at 2500 K', () => {
    const at = (T: number) => equilibrium({ lnK: lnKpAt(LN_CO2, T), reac: [[1, 'CO2']], prod: [[1, 'CO'], [0.5, 'O2']], initial: { CO2: 1 }, P: 1 });
    near(lnKpAt(LN_CO2, 2000), -6.629, 2e-3);
    near(lnKpAt(LN_CO2, 2500), -3.301, 3e-3);
    near(at(2000).CO, 0.01505, 2e-3);
    near(at(2500).CO, 0.1298, 2e-3);
    // exothermic combustion: h_R of the formation of CO2 from CO + 1/2 O2 is negative, so Kp(formation) falls with T
    const rx = A28.find((r) => r.label === LN_CO2)!;
    expect(hR(rx, 2250)).toBeGreaterThan(0); // dissociation is endothermic
    near(hR(rx, 2250), 276600, 1e-3);
    near(vantHoff(lnKpAt(LN_CO2, 2000), 2000, lnKpAt(LN_CO2, 2500), 2500), 276700, 1e-3);
    near(at(2000).CO / 1, 0.0151, 5e-3);
  });
  it('16-40: heating O2 to 3000 K: 1986 kJ/min with dissociation, 1533 without; printed 1990', () => {
    const lnK = lnKpAt('O₂ ⇌ 2O', 3000);
    near(lnK, -4.358, 1e-3);
    const r = equilibrium({ lnK, reac: [[1, 'O2']], prod: [[2, 'O']], initial: { O2: 1 }, P: 1 });
    near(r.O2, 0.9435, 1e-3);
    near(r.O, 0.1130, 3e-3);
    // x from the quadratic of the printed solution: 0.01282 = (2-2x)^2/x (1/(2-x))
    const x = 0.9435;
    near(((2 - 2 * x) ** 2 / x) * (1 / (2 - x)), Math.exp(lnK), 1e-2);
    const Q = r.O2 * hbar('O2', 3000) + r.O * hbar('O', 3000) - hbar('O2', 298.15);
    near(Q, 127137, 1e-3);
    near(Q - (hbar('O2', 3000) - hbar('O2', 298.15)), 29300, 1.5e-2);
    near(127363 / 32, 3980, 1e-3);
    near(0.943 * (106780 - 8682) + 0.114 * (249190 + 63425 - 6852), 127363, 1e-3);
    near((Q * 0.5) / 31.999, 1986.6, 1e-3);
    near(((hbar('O2', 3000) - hbar('O2', 298.15)) * 0.5) / 31.999, 1533.5, 1e-3);
    // printed (table values, x = 0.943, 0.114 O)
    near((0.5 / 32) * (0.943 * (106780 - 8682) + 0.114 * (249190 + 63425 - 6852)), 1990, 1e-3);
  });
});

/* ===================================================================== tutorial 17 */
describe('tutorial chapter 17', () => {
  it('17-62: T* 355.0 K, P* 277.6 kPa, A*/A1 0.4434; printed 0.428 matches no Mach number', () => {
    const k = 1.4;
    const c1 = soundSpeed(420, 0.287, k);
    const Ma1 = 110 / c1;
    near(c1, 410.8, 1e-3);
    near(Ma1, 0.2678, 1e-3);
    const T0 = stagnationT(420, 110, 1.005);
    const P0 = 500 * Math.pow(T0 / 420, 3.5);
    near(T0, 426.02, 1e-4);
    near(P0, 525.5, 1e-3);
    near(P0, 500 * P0_P(Ma1, k), 1e-3);
    near(T0 / T0_T(1, k), 355.0, 1e-3);
    near(P0 * critical(k).P, 277.6, 1e-3);
    near(1 / areaRatio(Ma1, k), 0.4434, 1e-3);
    // continuity check
    const rho1 = 500 / (0.287 * 420);
    const Ts = T0 / 1.2;
    const rhos = (P0 * critical(k).P) / (0.287 * Ts);
    near((rho1 * 110) / (rhos * soundSpeed(Ts, 0.287, k)), 0.4434, 1e-3);
    // the printed solution reads A/A* = 2.3343; that value belongs to Ma 0.258, and 150 m/s gives Ma 0.3651
    near(machFromAreaRatio(2.3343, k, 'sub'), 0.258, 3e-3);
    near(150 / c1, 0.3651, 1e-3);
    near(areaRatio(150 / c1, k), 1.715, 2e-3);
    near(1 / 2.3343, 0.4284, 1e-3);
  });
  it('17-48C: choked converging nozzle (air, P0 500 kPa, T0 300 K, A = 10 cm2)', () => {
    const k = 1.4;
    const A = 0.001;
    const P0 = 500;
    const T0 = 300;
    const row = (pb: number) => {
      const Pc = P0 * critical(k).P;
      const Pe = Math.max(pb, Pc);
      const Te = T0 * Math.pow(Pe / P0, (k - 1) / k);
      const Ve = Math.sqrt(2000 * 1.005 * (T0 - Te));
      return { Pe, Te, Ve, m: ((Pe / (0.287 * Te)) * Ve * A) };
    };
    const mstar = A * P0 * 1000 * Math.sqrt(k / (0.287 * 1000 * T0)) * Math.pow(2 / (k + 1), (k + 1) / (2 * (k - 1)));
    near(mstar, 1.1668, 1e-3);
    near(row(450).m, 0.7203, 2e-3);
    near(row(300).m, 1.1537, 2e-3);
    near(row(200).m, mstar, 2e-3);
    near(row(50).m, mstar, 2e-3);
    near(row(200).Pe, 264.1, 1e-3);
    near(row(50).Ve, 317.0, 1e-3);
    near(row(50).Ve, soundSpeed(row(50).Te, 0.287, k), 1e-3);
    near(P0 * critical(k).P, 264.1, 1e-3);
  });
});

/* ===================================================================== mock A */
describe('mock A', () => {
  const at6 = atmosphere(6000);
  it('P1 turboprop: ESHP and ESFC', () => {
    near(at6.T, 249.15, 1e-4);
    near(at6.P, 47.18, 1e-3);
    const r = turboprop({ Ta: at6.T, Pa: at6.P, V: 150, mdot: 3, rc: 11, T04: 1250, f: 0.0175, etaC: 0.85, etaT1: 0.9, etaT2: 0.9, P06: 62, etaProp: 0.82 });
    near(r.a, 316.4, 1e-3);
    near(150 / r.a, 0.4741, 1e-3);
    near(r.T01, 260.34, 1e-3);
    near(r.P01, 55.03, 1e-3);
    near(r.P01 / at6.P, 1.1663, 2e-3);
    near(r.T03, 561.7, 1e-3);
    near(r.Wc, 908.7, 1e-3);
    near(r.T05, 985.9, 1e-3);
    near(r.T05s, 956.6, 1e-3);
    near(r.P05, 207.4, 2e-3);
    expect(62 / at6.P).toBeLessThan(1 / critical(1.333).P);
    expect(r.Pcrit).toBeLessThan(at6.P);
    near(r.T06s, 729.2, 1e-3);
    near(r.T06, 754.8, 1e-3);
    near(r.wpt, 265.06, 1e-3);
    near(r.Wpt, 795.2, 1e-3);
    near(r.Tes, 705.0, 1e-3);
    near(r.Ve, 338.0, 1e-3);
    near(r.Fj, 581.6, 2e-3);
    near((r.Fj * 150) / 1000, 87.24, 2e-3);
    near(r.ESHP, 901.6, 1e-3);
    near(r.ESFC, 0.2096, 2e-3);
    expect(r.Fj).toBeGreaterThan(0);
    expect(r.ESHP).toBeGreaterThan(r.Wpt);
  });
  it('P2 propane at 300 % theoretical air, air at 600 K: AFT and dew point', () => {
    const o = { fuel: [[1, 'C3H8']] as [number, string][], theoAir: 3, Tfuel: 298.15, Tair: 600 };
    const b = burn(o);
    near(b.products.O2, 10, 1e-9);
    near(b.products.N2, 56.4, 1e-9);
    near(b.AF, 46.9, 1e-3);
    near(dewPoint(b.products, 101.325), 34.65, 2e-3);
    near(aft(o), 1401.7, 1e-3);
    near(aft({ ...o, Tair: 298.15 }), 1157.6, 1e-3);
    near(Hprod(b.products, 1401.7), Hreact(o), 1e-3);
  });
  it('P3 CO2 dissociation in a flame: 3000 K and 2500 K, 1 and 10 atm', () => {
    const at = (T: number, P: number) => equilibrium({ lnK: lnKpAt(LN_CO2, T), reac: [[1, 'CO2']], prod: [[1, 'CO'], [0.5, 'O2']], initial: { CO2: 1 }, P });
    near(lnKpAt(LN_CO2, 3000), -1.1036, 2e-3);
    near(at(3000, 1).CO, 0.4388, 1e-3);
    near(at(3000, 10).CO, 0.2420, 1e-3);
    near(at(2500, 1).CO, 0.1298, 1e-3);
    near(at(2500, 10).CO, 0.0627, 2e-3);
    // check: Kp from the amounts, N_total = 1 + x/2
    const r = at(3000, 1);
    const Nt = r.CO2 + r.CO + r.O2;
    near((r.CO * Math.sqrt(r.O2)) / r.CO2 * Math.sqrt(1 / Nt), Math.exp(lnKpAt(LN_CO2, 3000)), 1e-6);
    // N2 added at constant P and T: more dissociation
    const withN2 = equilibrium({ lnK: lnKpAt(LN_CO2, 3000), reac: [[1, 'CO2']], prod: [[1, 'CO'], [0.5, 'O2']], initial: { CO2: 1 }, inert: { N2: 3.76 }, P: 1 });
    expect(withN2.CO).toBeGreaterThan(r.CO);
    near(withN2.CO, 0.5865, 2e-2);
  });
  it('P4 reheat Rankine: 10 MPa / 500 C, reheat to 2 MPa / 500 C, 10 kPa, eta 0.88 / 0.90, 100 MW', () => {
    const a = rankine({ Pb: 10000, Tb: 500, Pc: 10, reheat: { P: 2000, T: 500 }, etaT: 0.88, etaP: 0.9, Wnet: 100000 });
    near(a.states.turbineIn.h, 3375.1, 1e-3);
    near(a.states.reheatIn.h, 2984.1, 1e-3);
    near(a.states.reheatOut.h, 3468.2, 1e-3);
    near(a.states.turbineExit.h, 2489.3, 1e-3);
    near(a.x_exit, 0.9605, 1e-3);
    near(a.wT, 1370.0, 1e-3);
    near(a.wP, 11.2, 5e-3);
    near(a.qin, 3656.3, 1e-3);
    near(a.eta, 0.3716, 1e-3);
    near(a.mdot, 73.59, 1e-3);
    const n = rankine({ Pb: 10000, Tb: 500, Pc: 10, etaT: 0.88, etaP: 0.9, Wnet: 100000 });
    near(n.x_exit, 0.858, 1e-3);
    near(n.eta, 0.3531, 1e-3);
    near(n.mdot, 89.29, 1e-3);
  });
  it('P5 cooling tower: 46.9 kg/s of air, 0.97 kg/s makeup', () => {
    const s1 = psyState({ T: 25, P: 101.325, phi: 0.5 });
    const s2 = psyState({ T: 32, P: 101.325, phi: 1 });
    const hf = (T: number) => water.satT(T).hf;
    const dw = s2.w - s1.w;
    const ma = (50 * (hf(40) - hf(27))) / (s2.h - s1.h - dw * hf(27));
    near(s1.w, 0.009884, 2e-3);
    near(s1.h, 50.30, 1e-3);
    near(s1.v, 0.8579, 1e-3);
    near(s2.w, 0.030658, 2e-3);
    near(s2.h, 110.63, 1e-3);
    near(hf(40), 167.53, 1e-4);
    near(hf(27), 113.19, 1e-3);
    near(ma, 46.86, 1e-3);
    near(ma * s1.v, 40.20, 1e-3);
    near(ma * dw, 0.9735, 1e-3);
    near(((ma * dw) / 50) * 100, 1.947, 2e-3);
    near(50 * (hf(40) - hf(27)), 2717, 1e-3);
  });
  it("P6 Kay's rule: 40 % CH4 + 60 % C2H6, 330 K, 8 MPa, 0.1 m3", () => {
    const k = kay({ CH4: 0.4, C2H6: 0.6 });
    near(k.Tcr, 259.74, 1e-4);
    near(k.Pcr, 4.544, 1e-4);
    near(330 / k.Tcr, 1.2705, 1e-3);
    near(8 / k.Pcr, 1.7606, 1e-3);
    const z = leeKesler(330 / k.Tcr, 8 / k.Pcr);
    near(z.Z, 0.693, 3e-3);
    const M = 0.4 * CRIT.CH4.M + 0.6 * CRIT.C2H6.M;
    near(M, 24.459, 1e-4);
    const N = (8000 * 0.1) / (z.Z * Ru * 330);
    near(N, 0.4207, 3e-3);
    near(N * M, 10.29, 3e-3);
    const Nid = (8000 * 0.1) / (Ru * 330);
    near(Nid * M, 7.13, 2e-3);
    near((N * Ru * 330) / 0.1, 8000 / z.Z, 1e-9);
    near((N * Ru * 330) / 0.1, 11543, 3e-3);
    near(leeKesler(330 / k.Tcr, 4 / k.Pcr).Z, 0.851, 3e-3);
  });
});

/* ===================================================================== mock B */
describe('mock B', () => {
  const at9 = atmosphere(9000);
  it('P1 turbofan: bypass ratio 3.5', () => {
    near(at9.T, 229.65, 1e-4);
    near(at9.P, 30.74, 1e-3);
    const r = turbofan({ Ta: at9.T, Pa: at9.P, V: 230, mc: 8, beta: 3.5, rf: 1.6, etaF: 0.88, rcc: 9, etaC: 0.86, T04: 1400, etaT: 0.9, f: 0.021 });
    near(230 / r.a, 0.7572, 1e-3);
    near(r.T01, 255.97, 1e-3);
    near(r.P01, 44.94, 1e-3);
    near(r.T013, 297.8, 1e-3);
    near(r.wf, 42.01, 2e-3);
    near(r.P013, 71.91, 1e-3);
    near(r.T03, 600.2, 1e-3);
    near(r.wcc, 303.9, 1e-3);
    near(r.P03, 647.2, 1e-3);
    near(r.Wneed, 3944, 1e-3);
    near(r.T05, 970.2, 1e-3);
    near(r.T05s, 922.4, 1e-3);
    near(r.P05, 121.8, 2e-3);
    near(r.Vc, 804.8, 1e-3);
    near(r.Vb, 359.2, 1e-3);
    near(r.Fc, 4733.7, 1e-3);
    near(r.Fb, 3617.3, 1e-3);
    near(r.F, 8351, 1e-3);
    near(r.TSFC * 1e6, 20.12, 2e-3);
    // propulsive efficiency: thrust power / rate of kinetic-energy increase
    const dke = 0.5 * (8 * 1.021 * r.Vc ** 2 + r.mb * r.Vb ** 2 - r.mt * 230 ** 2);
    expect((r.F * 230) / dke).toBeGreaterThan(0.5);
    expect((r.F * 230) / dke).toBeLessThan(0.8);
  });
  it('P2 liquid ethanol, 130 % theoretical air: AF, dew point, heat, AFT', () => {
    const o = { fuel: [[1, 'C2H5OHl']] as [number, string][], theoAir: 1.3, Tfuel: 298.15, Tair: 298.15 };
    const b = burn(o);
    near(b.a, 3.9, 1e-9);
    near(b.products.O2, 0.9, 1e-9);
    near(b.products.N2, 14.664, 1e-6);
    near(b.AF, 11.67, 1e-3);
    near(dewPoint(b.products, 101.325), 53.67, 2e-3);
    near(steadyQ({ ...o, Tprod: 800 }), 900312, 1e-3);
    near(steadyQ({ ...o, Tprod: 298.15 }), 1234810, 1e-3);
    near(aft(o), 1948.8, 1e-3);
    near(aft({ ...o, Tair: 600 }), 2146.9, 1e-3);
  });
  it('P3 NO in air: independent of P; van t Hoff', () => {
    const lnK3000 = lnKpAt(LN_NO, 3000);
    const lnK2500 = lnKpAt(LN_NO, 2500);
    near(lnK3000, -2.1035, 2e-3);
    near(lnK2500, -2.8262, 2e-3);
    const at = (P: number) => equilibrium({ lnK: 2 * lnK3000, reac: [[1, 'N2'], [1, 'O2']], prod: [[2, 'NO']], initial: { N2: 3.76, O2: 1 }, P });
    near(at(1).NO, 0.2199, 1e-3);
    near(at(5).NO, at(1).NO, 1e-9);
    near(at(1).N2, 3.650, 1e-3);
    near(at(1).O2, 0.8900, 1e-3);
    near(at(1).NO / 4.76, 0.0462, 2e-3);
    const hvh = vantHoff(lnK2500, 2500, lnK3000, 3000); // per mole of NO formed (half-form)
    near(hvh, 90135, 1e-3);
    near(hR(A28.find((r) => r.label === LN_NO)!, 2750), 90133, 2e-3);
    near(hvh, SPECIES.NO.hf, 5e-3); // close to the formation enthalpy, 90 290
  });
  it('P4 cascade R-134a: -30 C evaporator, 400 kPa intermediate, 1200 kPa condenser, 40 kW', () => {
    const PL = r134a.Psat(-30);
    near(PL, 84.38, 1e-3);
    const L = vcr({ PL, PH: 400, QL: 40 });
    const H = vcr({ PL: 400, PH: 1200, QL: L.QH });
    near(L.mdot, 0.2378, 1e-3);
    near(L.states[1].h, 232.2, 1e-3);
    near(L.states[2].h, 263.8, 1e-3);
    near(L.states[3].h, 64.0, 2e-3);
    near(L.QH, 47.53, 1e-3);
    near(L.W, 7.532, 3e-3);
    near(H.mdot, 0.3450, 1e-3);
    near(H.states[1].h, 255.6, 1e-3);
    near(H.states[2].h, 278.4, 1e-3);
    near(H.states[3].h, 117.8, 1e-3);
    near(H.W, 7.858, 3e-3);
    near(L.W + H.W, 15.39, 2e-3);
    near(40 / (L.W + H.W), 2.60, 2e-3);
    near(H.QH, 55.39, 1e-3);
    near(L.QH, H.QL, 1e-6);
    const S = vcr({ PL, PH: 1200, QL: 40 });
    near(S.W, 19.46, 1e-3);
    near(S.COPR, 2.056, 1e-3);
    near(S.states[2].T, 58.35, 1e-3);
    near(flashTwoStage({ PH: 1200, Pm: 400, PL, QL: 40 }).COP, 2.60, 2e-3);
  });
  it('P5 mixing 0.6 kg/s N2 at 500 K with 0.4 kg/s CO2 at 300 K, then isentropic compression', () => {
    const N2 = GASES.N2;
    const CO2 = GASES.CO2;
    const mix = mixtureFromMass({ N2: 0.6, CO2: 0.4 });
    near(mix.y.N2, 0.7021, 1e-3);
    near(mix.M, 32.78, 1e-3);
    near(mix.R, 0.2536, 1e-3);
    near(mix.cp, 0.9618, 1e-3);
    near(mix.k, 1.3573, 1e-3);
    const Tm = (0.6 * N2.cp * 500 + 0.4 * CO2.cp * 300) / (0.6 * N2.cp + 0.4 * CO2.cp);
    near(Tm, 429.63, 1e-3);
    const sT = 0.6 * N2.cp * Math.log(Tm / 500) + 0.4 * CO2.cp * Math.log(Tm / 300);
    const sM = -(0.6 * N2.R * Math.log(mix.y.N2) + 0.4 * CO2.R * Math.log(mix.y.CO2));
    near(sT, 0.02698, 2e-3);
    near(sM, 0.15449, 2e-3);
    near(sT + sM, 0.1815, 2e-3);
    const T2 = Tm * Math.pow(5, (mix.k - 1) / mix.k);
    near(T2, 656.3, 1e-3);
    near(1 * mix.cp * (T2 - Tm), 218.0, 2e-3);
  });
  it('P6 C-D nozzle: A/At = 2, P0 800 kPa, T0 400 K, throat 5 cm2', () => {
    const k = 1.4;
    const Mex = machFromAreaRatio(2, k, 'sup');
    const Msub = machFromAreaRatio(2, k, 'sub');
    near(Mex, 2.197, 1e-3);
    near(Msub, 0.3059, 1e-3);
    const Pdes = 800 / P0_P(Mex, k);
    const Pcrit1 = 800 / P0_P(Msub, k);
    near(Pdes, 75.15, 1e-3);
    near(Pcrit1, 749.7, 1e-3);
    const sh = shockP(Mex, k);
    near(sh, 5.466, 1e-3);
    near(Pdes * sh, 410.7, 1e-3);
    near(shockM2(Mex, k), 0.5469, 2e-3);
    const mdot = 5e-4 * 800 * 1000 * Math.sqrt(k / (0.287 * 1000 * 400)) * Math.pow(2 / (k + 1), (k + 1) / (2 * (k - 1)));
    near(mdot, 0.8084, 1e-3);
    const Te = 400 / T0_T(Mex, k);
    near(Te, 203.5, 1e-3);
    near(Mex * soundSpeed(Te, 0.287, k), 628.3, 1e-3);
    // choked mass flow is the same for every back pressure below the first critical value
    near(areaRatio(Mex, k), 2, 1e-9);
    near(areaRatio(Msub, k), 2, 1e-9);
    // throat: T* and P*
    near(400 * critical(k).T, 333.3, 1e-3);
    near(800 * critical(k).P, 422.6, 1e-3);
  });
});
