import { describe, expect, it } from 'vitest';
import { water, r134a } from './props';
import { airTable, dh, s0, Ru } from './gas';
import { braytonVariable } from './cycles';
import { vcr, flashTwoStage, gasRefrigeration } from './refrig';
import { leeKesler, CRIT } from './realgas';

/** |a - b| <= rel * max(1, |b|) */
const near = (a: number, b: number, rel = 1e-3) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

/* ===================================================================== Assignment 1 */
describe('assignment 1 (Thermo 1 review and Brayton / jet engines)', () => {
  it('4-9: P·v interpolation gives 213.8 kJ, the linear-v interpolation of the notebook gives 350.3 kJ', () => {
    const v1 = water.Px(150, 1).v;
    const a = water.PT(100, 200).v;
    const b = water.PT(200, 200).v;
    const vPv = ((100 * a + 200 * b) / 2) / 150;
    const vLin = (a + b) / 2;
    near(vPv, 1.4445, 1e-3);
    near(vLin, 1.6265, 1e-3);
    near(5 * 150 * (vPv - v1), 213.8, 3e-3);
    near(5 * 150 * (vLin - v1), 350.3, 3e-3);
    near(vLin / vPv, 1.126, 3e-3); // 12.6 % too large
  });
  it('4-15 polytropic n = 1.5; 6-22 plant efficiency; 7-26 entropy generation', () => {
    const P2 = 350 * Math.pow(0.03 / 0.2, 1.5);
    near(P2, 20.33, 1e-3);
    near((P2 * 0.2 - 350 * 0.03) / (1 - 1.5), 12.87, 2e-3);
    near(150000 / ((60000 / 3600) * 30000), 0.3, 1e-9);
    near(200 / 303.15, 0.660, 2e-3);
  });
  it('9-97: HP turbine drives the compressor only', () => {
    const k = 1.4;
    const cp = 1.005;
    const T2 = 273 * Math.pow(8, (k - 1) / k);
    const T4 = 1500 - (T2 - 273);
    const P4 = 800 * Math.pow(T4 / 1500, k / (k - 1));
    const T5 = T4 * Math.pow(100 / P4, (k - 1) / k);
    near(T2, 494.5, 1e-3);
    near(T4, 1278.5, 1e-3);
    near(P4, 457.3, 2e-3);
    near(T5, 828.1, 1e-3);
    near(200000 / (cp * (T4 - T5)), 441.8, 2e-3);
  });
  it('9-109: his linear method reproduces eta_T 0.838, eta_C 0.947 and 44.1 % with the regenerator', () => {
    const h1 = 303.21;
    const h2s = 652.4;
    const h3 = 1710;
    const h4s = 825.2;
    const w = 159000 / (1536000 / 3600);
    near(w, 372.66, 1e-3);
    const q = w / 0.359;
    const h2a = h3 - q;
    const h4a = h1 + (q - w);
    near((h3 - h4a) / (h3 - h4s), 0.838, 3e-3);
    near((h2s - h1) / (h2a - h1), 0.947, 3e-3);
    near(w / (q - 0.65 * (h4a - h2a)), 0.441, 3e-3);
    // the lib's smooth air table with T1 = 303.15 K and efficiencies 0.952 / 0.837 gives the same cycle
    const r = braytonVariable({ T1: 303.15, rp: 14.7, T3: 1561.15, etaC: 0.952, etaT: 0.837 });
    near(r.eta, 0.359, 1e-2);
    near(r.wnet, 372.66, 1e-2);
    near(braytonVariable({ T1: 303.15, rp: 14.7, T3: 1561.15, etaC: 0.952, etaT: 0.837, regen: 0.65 }).eta, 0.441, 1e-2);
  });
  it('9-126: two-stage compression and expansion with ηC 0.86, ηT 0.90 (variable cp)', () => {
    const run = (reg: number) => {
      const h1 = airTable.h(300);
      const h2s = airTable.h(airTable.T_Pr(airTable.Pr(300) * 3));
      const h2 = h1 + (h2s - h1) / 0.86;
      const h5 = airTable.h(1200);
      const h6s = airTable.h(airTable.T_Pr(airTable.Pr(1200) / 3));
      const h6 = h5 - 0.9 * (h5 - h6s);
      const wC = 2 * (h2 - h1);
      const wT = 2 * (h5 - h6);
      const qin = h5 - h2 + (h5 - h6) - reg * (h6 - h2);
      return { rbw: wC / wT, eta: (wT - wC) / qin, wC, wT };
    };
    const a = run(0);
    near(a.wC, 258.3, 1e-2);
    near(a.wT, 596.6, 1e-2);
    near(a.rbw, 0.433, 5e-3);
    near(a.eta, 0.295, 1e-2);
    near(run(0.75).eta, 0.461, 1e-2);
  });
});

/* ===================================================================== Assignment 2/3 */
describe('assignment 2/3 (vapor power cycles)', () => {
  it('10-28 binary geothermal plant (isobutane data from the statement)', () => {
    const eT = (761.54 - 689.74) / (761.54 - 670.4);
    near(eT, 0.788, 2e-3);
    const h2 = 273.01 + (0.001842 * (3250 - 410)) / 0.9;
    near(h2, 278.82, 1e-3);
    const Q = 555.9 * 4.258 * 70;
    near(Q, 165692, 1e-4);
    const m = Q / (761.54 - h2);
    near(m, 343.2, 1e-3);
    const W = m * (761.54 - 689.74 - (h2 - 273.01));
    near(W, 22650, 1e-3);
    near(W / Q, 0.137, 3e-3);
  });
  it('10-52: two open feedwater heaters, y 0.0717, z 0.1085, 28.8 MW, 42.2 %', () => {
    const s1 = water.Px(15, 0);
    const h3 = s1.h + s1.v * (200 - 15);
    const s4 = water.Px(200, 0);
    const h5 = s4.h + s4.v * (600 - 200);
    const s6 = water.Px(600, 0);
    const h7 = s6.h + s6.v * (8000 - 600);
    const t8 = water.PT(8000, 550);
    const h9 = water.Ps(600, t8.s).h;
    const h10 = water.Ps(200, t8.s).h;
    const hex = water.Ps(15, t8.s).h;
    const y = (s6.h - h5) / (h9 - h5);
    const z = ((1 - y) * (s4.h - h3)) / (h10 - h3);
    near(y, 0.0717, 5e-3);
    near(z, 0.1085, 5e-3);
    const qin = t8.h - h7;
    const qout = (1 - y - z) * (hex - s1.h);
    near(24 * (qin - qout), 28820, 3e-3);
    near(1 - qout / qin, 0.422, 3e-3);
  });
  it('10-55: feedwater leaves the closed heater at 764.8, not 1008 (hf at 3000 kPa)', () => {
    const sat = water.satP(1000);
    const h3 = sat.hf + sat.vf * (3000 - 1000);
    near(h3, 764.8, 1e-3);
    near(water.satP(3000).hf, 1008.3, 1e-3);
    near(water.PT(3000, sat.T).h, 764.8, 2e-3);
    const h4 = water.PT(3000, 350).h;
    near(h4 - h3, 2351.3, 1e-3);
    near(h4 - water.satP(3000).hf, 2107.8, 1e-3); // what the slip would give
  });
  it('10-61: closed heater, drain pumped forward: y 0.2020, 54.5 kg/s, 44.4 %; the s5 slip', () => {
    const t5 = water.PT(10000, 550);
    near(t5.s, 6.7585, 1e-3);
    const h6 = water.Ps(800, t5.s).h;
    near(h6, 2812.1, 1e-3);
    near(water.Ps(800, 6.785).h, 2824.4, 1e-3); // his s5 = 6.785
    const t7 = water.PT(800, 500);
    const h8 = water.Ps(10, t7.s).h;
    near(h8, 2494.7, 1e-3);
    const s1 = water.Px(10, 0);
    const h2 = s1.h + s1.v * (10000 - 10);
    const s3 = water.Px(800, 0);
    const h9 = s3.h + s3.v * (10000 - 800);
    near(h9, 731.1, 1e-3);
    const y = (h9 - h2) / (h6 - s3.h + h9 - h2);
    near(y, 0.202, 3e-3);
    const qin = t5.h - h9 + (1 - y) * (t7.h - h6);
    const qout = (1 - y) * (h8 - s1.h);
    near(80000 / (qin - qout), 54.5, 3e-3);
    near((qin - qout) / qin, 0.444, 3e-3);
  });
  it('10-110: reheat, closed heater at 0.6 MPa and open heater at 0.2 MPa: z 0.1165, 48.5 %, 72.4 MW', () => {
    const s1 = water.Px(5, 0);
    const h2 = s1.h + s1.v * (200 - 5);
    const s3 = water.Px(200, 0);
    const h4 = s3.h + s3.v * (15000 - 200);
    const h5 = water.PT(15000, water.Tsat(600)).h;
    near(h5, 686.2, 2e-3);
    const h6 = water.Px(600, 0).h;
    const t8 = water.PT(15000, 600);
    const h9 = water.Ps(1000, t8.s).h;
    const t10 = water.PT(1000, 500);
    const h11 = water.Ps(600, t10.s).h;
    const h12 = water.Ps(200, t10.s).h;
    const h13 = water.Ps(5, t10.s).h;
    const y = (h5 - h4) / (h11 - h6);
    const z = (s3.h - y * h6 - (1 - y) * h2) / (h12 - h2);
    near(y, 0.0629, 5e-3);
    near(z, 0.1165, 5e-3);
    const wT = t8.h - h9 + (t10.h - h11) + (1 - y) * (h11 - h12) + (1 - y - z) * (h12 - h13);
    const wP = (1 - y - z) * s1.v * (200 - 5) + s3.v * (15000 - 200);
    const qin = t8.h - h5 + (t10.h - h9);
    near((wT - wP) / qin, 0.485, 3e-3);
    near(42 * (wT - wP), 72450, 3e-3);
  });
});

/* ===================================================================== Assignment 4 */
describe('assignment 4 (refrigeration)', () => {
  it('11-21 (b) ideal cycle between 200 and 1400 kPa: 2.93 kW, 1.016 kW, COP 2.885', () => {
    const r = vcr({ PL: 200, PH: 1400, mdot: 0.025 });
    near(r.QL, 2.93, 3e-3);
    near(r.W, 1.016, 5e-3);
    near(r.COPR, 2.885, 3e-3);
  });
  it('11-60: a single stage between -40 C and 800 kPa has COP 2.28 (two stages: 2.74)', () => {
    near(vcr({ TL: -40, PH: 800 }).COPR, 2.28, 5e-3);
    near(flashTwoStage({ PH: 800, Pm: r134a.Psat(-10.1), PL: r134a.Psat(-40), QL: 30 }).COP, 2.743, 3e-3);
  });
  it('11-62: two evaporators, one compressor: 6.57 kW, 4.51 kW, COP 3.23 (not 3.615 kW / 4.03)', () => {
    const P2 = r134a.satT(-26.4).P;
    const P1 = r134a.satT(0).P;
    const hf = r134a.Px(800, 0).h;
    const g7 = r134a.satT(-26.4).hg;
    const g5 = r134a.satT(0).hg;
    const m2 = 8 / (g7 - hf);
    const m1 = 0.1 - m2;
    near(m2, 0.0576, 5e-3);
    const Q1 = m1 * (g5 - hf);
    near(Q1, 6.57, 3e-3);
    const h1 = (m2 * g7 + m1 * g5) / 0.1;
    near(h1, 241.2, 2e-3);
    const s1 = r134a.Ph(P2, h1);
    const h2 = r134a.Ps(800, s1.s).h;
    near(h2, 286.3, 2e-3);
    const W = 0.1 * (h2 - h1);
    near(W, 4.51, 3e-3);
    near((8 + Q1) / W, 3.24, 1e-2);
    // the notebook's slip: interpolating in the 0.5 MPa table instead of 800 kPa
    near(r134a.Ps(500, s1.s).h, 276, 1e-2);
    expect(P1).toBeGreaterThan(P2);
  });
  it('11-79 (d): the same machine without a regenerator, 24.7 kW and COP 0.599; with it 21.4 kW and 0.478', () => {
    const c = Math.pow(5, 0.4 / 1.4);
    const T2 = 273.15 + (273.15 * c - 273.15) / 0.8;
    const T4 = 308.15 - 0.85 * (308.15 - 308.15 / c);
    near(T4, 211.6, 2e-3);
    const QL = 0.4 * 1.005 * (273.15 - T4);
    const W = 0.4 * 1.005 * (T2 - 273.15 - (308.15 - T4));
    near(QL, 24.7, 3e-3);
    near(QL / W, 0.599, 3e-3);
    const g = gasRefrigeration({ rp: 5, T1: 273.15, T3: 308.15, T5: 193.15, etaC: 0.8, etaT: 0.85, mdot: 0.4 });
    near(g.T6, 246.3, 1e-3);
    near(g.eps, 0.434, 3e-3);
    near(g.COP, 0.478, 3e-3);
  });
  it('flash chamber 1.4 / 0.5 / 0.14 MPa: x 0.290, COP 2.92 against 2.32 for one stage', () => {
    const f = flashTwoStage({ PH: 1400, Pm: 500, PL: 140, QL: 1, layout: 'flash' });
    near(f.x6, 0.29, 5e-3);
    near(f.h[3], 263.6, 2e-3);
    near(f.COP, 2.92, 5e-3);
    near(vcr({ PL: 140, PH: 1400 }).COPR, 2.32, 5e-3);
  });
});

/* ===================================================================== Assignment 5 */
describe('assignment 5 (property relations)', () => {
  it('12-11: total differential 0.0598 (average state) and 0.0574 (initial state); exact 0.0598', () => {
    const R = 0.287;
    near((R / 98) * 4 + ((R * 402) / 98 ** 2) * 4, 0.0598, 2e-3);
    near((R / 100) * 4 + ((R * 400) / 100 ** 2) * 4, 0.0574, 2e-3);
    near((R * 404) / 96 - (R * 400) / 100, 0.0598, 2e-3);
    near(R * 4.2 - R * 4, 0.0574, 2e-3); // the December rounding of 404/96 to 4.2
  });
  it('12-15: Maxwell relation with the closer table rows (600/800 kPa, 40/60 C)', () => {
    const dsdP = (r134a.PT(800, 50).s - r134a.PT(600, 50).s) / 200;
    const dvdT = (r134a.PT(700, 60).v - r134a.PT(700, 40).v) / 20;
    near(-dsdP, dvdT, 6e-3);
    near(dsdP, -1.595e-4, 1e-2);
  });
  it('12-26 Clapeyron h_fg of water at 300 kPa; 12-28 sublimation pressure at -30 C', () => {
    const a = water.satP(300);
    const slope = (water.satP(325).P - water.satP(275).P) / (water.satP(325).T - water.satP(275).T);
    near((a.T + 273.15) * a.vfg * slope, 2160, 3e-3);
    near(a.hfg, 2163.5, 1e-3);
    const R = Ru / 18.015;
    near(0.6117 * Math.exp((2834 / R) * (1 / 273.16 - 1 / 243.15)), 0.0381, 1.5e-2);
    near(0.6117 * Math.exp((2500.9 / R) * (1 / 273.16 - 1 / 243.15)), 0.0529, 1e-2); // wrong latent heat
  });
  it('12-34 / 12-35 P(v - a) = RT with a = 0.1: du = cv dT = 201, dh = 334.2 against 284.2', () => {
    near(0.718 * 280, 201, 2e-3);
    near(1.015 * 280 + 0.1 * 500, 334.2, 1e-3);
    near(1.015 * 280, 284.2, 1e-3);
  });
  it('12-40 R-134a beta and alpha at 200 kPa, 30 C', () => {
    const v = r134a.PT(200, 30).v;
    near(v, 0.11874, 1e-3);
    near((r134a.PT(200, 40).v - r134a.PT(200, 20).v) / 20 / v, 3.806e-3, 2e-3);
    near(-(r134a.PT(240, 30).v - r134a.PT(180, 30).v) / 60 / v, 4.82e-3, 5e-3);
    near(-(r134a.PT(210, 30).v - r134a.PT(190, 30).v) / 20 / v, 5.2e-3, 1e-2);
  });
  it('12-73 oxygen 220 K 5 MPa to 300 K 10 MPa: ideal 2338 kJ/kmol and 3.30; with departures about 2323 and 3.69', () => {
    const cr = CRIT.O2;
    const a = leeKesler(220 / cr.Tcr, 5 / cr.Pcr);
    const b = leeKesler(300 / cr.Tcr, 10 / cr.Pcr);
    const dhi = dh('O2', 300) - dh('O2', 220);
    const dsi = s0('O2', 300) - s0('O2', 220) - Ru * Math.log(2);
    near(dhi, 2338, 3e-3);
    near(dsi, 3.301, 3e-3);
    near(dhi - Ru * cr.Tcr * (b.Zh - a.Zh), 2323, 5e-3);
    near(dsi - Ru * (b.Zs - a.Zs), 3.692, 1e-2);
  });
  it('12-75 CO2 nozzle 384 m/s (the December 397.5 m/s is a rounding of -3272 to -3500)', () => {
    const cr = CRIT.CO2;
    const a = leeKesler(450 / cr.Tcr, 8 / cr.Pcr);
    const b = leeKesler(350 / cr.Tcr, 2 / cr.Pcr);
    const R = Ru / 44.01;
    const dhr = (dh('CO2', 350) - dh('CO2', 450)) / 44.01 + R * cr.Tcr * (a.Zh - b.Zh);
    near(dhr, -73.8, 1e-2);
    near(Math.sqrt(-2000 * dhr), 384, 3e-3);
    near(-4132 + Ru * 304.2 * 0.34, -3272, 2e-3);
    near(Math.sqrt(2000 * 79), 397.5, 1e-3);
  });
  it('12-97 propane: cubic cp gives 1121 kJ/kg and 1.587; departure charts 1113 and 1.584', () => {
    const [a, b, c, d] = [-4.04, 30.48e-2, -15.72e-5, 31.74e-9];
    const T1 = 373.15;
    const T2 = 773.15;
    const M = 44.097;
    const dhb = a * (T2 - T1) + (b / 2) * (T2 ** 2 - T1 ** 2) + (c / 3) * (T2 ** 3 - T1 ** 3) + (d / 4) * (T2 ** 4 - T1 ** 4);
    const dsb = a * Math.log(T2 / T1) + b * (T2 - T1) + (c / 2) * (T2 ** 2 - T1 ** 2) + (d / 3) * (T2 ** 3 - T1 ** 3) - Ru * Math.log(8);
    near(dhb / M, 1121, 2e-3);
    near(dsb / M, 1.587, 2e-3);
    const cr = CRIT.C3H8;
    const z1 = leeKesler(T1 / cr.Tcr, 0.5 / cr.Pcr);
    const z2 = leeKesler(T2 / cr.Tcr, 4 / cr.Pcr);
    const R = Ru / M;
    near(dhb / M - R * cr.Tcr * (z2.Zh - z1.Zh), 1113, 2e-3);
    near(dsb / M - R * (z2.Zs - z1.Zs), 1.5845, 2e-3);
  });
});
