import { describe, expect, it } from 'vitest';
import { water, r134a } from './props';
import { Ru, hbar, dh, heatingValues, SPECIES, A28, lnKp, hR } from './gas';
import { Pg, Pv, omega, omegaFromWetBulb, phiOf, hAir, vAir, Tdp, psyState, mixStreams } from './psychro';
import { mixtureFromMoles, mixtureFromMass, GASES } from './mixtures';
import { burn, dewPoint, steadyQ, closedQMoles, Hprod } from './combustion';
import { equilibrium } from './equilibrium';
import { stagnationT, T0_T, P0_P, areaRatio, soundSpeed, critical } from './compressible';
import { leeKesler, kay, CRIT } from './realgas';

/** |a - b| <= rel * max(1, |b|) */
const near = (a: number, b: number, rel = 1e-3) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

/* ===================================================================== Assignment 6 (chapter 13) */
describe('assignment 6 (gas mixtures)', () => {
  it('13-35: 0.5 kmol Ar + 2 kmol N2 at 250 kPa, 280 K, heated to 400 K', () => {
    const V = (2.5 * Ru * 280) / 250;
    near(V, 23.3, 2e-3);
    near(250 * (400 / 280), 357.1, 1e-3);
  });
  it('13-41: methane-air mixture into a four-stroke engine, 6.65 kg/min', () => {
    const M = 0.15 * GASES.CH4.M + 0.85 * GASES.air.M;
    const rho = 80 / ((Ru / M) * 293.15);
    near(rho * 0.005 * (3000 / 2), 6.654, 3e-3);
  });
  it('13-63: products M 28.62, cp(600 K) 31.6 kJ/kmol K and Pv 13 kPa', () => {
    const y = { CO2: 0.0489, H2O: 0.065, O2: 0.122, N2: 0.7641 };
    const M = 44.01 * y.CO2 + 18.015 * y.H2O + 31.999 * y.O2 + 28.013 * y.N2;
    near(M, 28.63, 1e-3);
    near(0.065 * 200, 13, 1e-9);
    // cp-bar of each gas at 600 K from the sensible-enthalpy table: (h(650) - h(550)) / 100
    const cpbar = (sp: 'CO2' | 'H2O' | 'O2' | 'N2') => (hbar(sp, 650) - hbar(sp, 550)) / 100;
    const cp = y.CO2 * cpbar('CO2') + y.H2O * cpbar('H2O') + y.O2 * cpbar('O2') + y.N2 * cpbar('N2');
    near(cp, 31.6, 1.5e-2);
  });
  it('13-42: N2 and O2 tanks, V1 0.322, V2 2.07, P 204 kPa', () => {
    const V1 = (2 / 28.013) * Ru * 298.15 / 550;
    const V2 = (4 / 31.999) * Ru * 298.15 / 150;
    near(V1, 0.322, 3e-3);
    near(V2, 2.07, 3e-3);
    near(((2 / 28.013 + 4 / 31.999) * Ru * 298.15) / (V1 + V2), 204, 5e-3);
  });
  it('13-52: heating 30 % O2, 40 % N2, 10 % CO2, 20 % CH4 from 20 to 200 C, about 199 kJ/kg', () => {
    const m = mixtureFromMoles({ O2: 0.3, N2: 0.4, CO2: 0.1, CH4: 0.2 });
    near(m.cp * 180, 199, 2e-2);
    expect(m.cp).toBeGreaterThan(1.08);
    expect(m.cp).toBeLessThan(1.13);
  });
  it('13-59: isothermal compression of 60/25/15 % (mass) CH4, C3H8, C4H10: about 232 kJ/kg', () => {
    const R = 0.6 * (Ru / 16.043) + 0.25 * (Ru / 44.097) + 0.15 * (Ru / 58.123);
    near(R * 293.15 * Math.log(8), 231.4, 1e-2);
    near(R, 0.3795, 1e-2);
  });
  it('13-72: H2-N2 at 160 K, 5 MPa heated to 200 K: 4273 kJ ideal, 4745 kJ chart readings, about 4672 kJ with Lee-Kesler', () => {
    near(3 * (5669.2 - 4535.4) + 0.75 * (5810 - 4648), 4273, 1e-3);
    near(6 * 14.307 * 40 + 21 * 1.039 * 40, 4306, 1e-3); // constant cp
    near(3 * 1133.8 + 0.75 * (1162 + Ru * 126.2 * (1.3 - 0.7)), 4745, 1e-3);
    const N2 = CRIT.N2;
    const a = leeKesler(160 / N2.Tcr, 5 / N2.Pcr);
    const b = leeKesler(200 / N2.Tcr, 5 / N2.Pcr);
    near(a.Zh, 1.18, 2e-2);
    near(b.Zh, 0.67, 3e-2);
    near(3 * 1133.8 + 0.75 * (1162 + Ru * N2.Tcr * (a.Zh - b.Zh)), 4672, 5e-3);
    // hydrogen at Tr = 4.8 has a negligible departure
    near(leeKesler(160 / CRIT.H2.Tcr, 5 / CRIT.H2.Pcr).Zh, 0, 1);
  });
});

/* ===================================================================== Assignment 7 (chapter 14) */
describe('assignment 7 (psychrometrics)', () => {
  const P = 101.325;
  it('14-84: air conditioner inlet 27 C 50 %: Tdp 15.7, Twb 19.5, 5 air changes per minute', () => {
    const s1 = psyState({ T: 27, P, phi: 0.5 });
    near(s1.Tdp, 15.7, 5e-3);
    near(s1.Twb, 19.5, 1e-2);
    const s2 = psyState({ T: 10, P, phi: 0.9 });
    const ma = 10 / vAir(27, s1.w, P) / 60; // 5 x 2 m3/min
    near(ma * 60, 11.5, 3e-2);
    const Q = ma * (s1.h - s2.h - (s1.w - s2.w) * 41.99);
    near(Q, 5.40, 2e-2);
    near(ma * 60 * (s1.w - s2.w), 0.0495, 6e-2);
  });
  it('14-108: wet cooling tower, 90 kg/s from 40 to 25 C, air 23 C 60 % in, 32 C saturated out', () => {
    const s1 = psyState({ T: 23, P, phi: 0.6 });
    const s2 = psyState({ T: 32, P, phi: 1 });
    const hw = (T: number) => water.satT(T).hf; // saturated-liquid enthalpy
    const ma = (90 * (hw(40) - hw(25))) / (s2.h - s1.h - (s2.w - s1.w) * hw(25));
    near(ma, 96.3, 1e-2);
    near(ma * vAir(23, s1.w, P), 82.1, 1e-2);
    near(ma * (s2.w - s1.w), 1.94, 3e-2);
  });
  it('14-132: coil 30 C 70 % to 20 C 20 %, 4 m3/min: 3.73 kW, 0.072 kg/min, 1.44 kg/min R-134a', () => {
    const s1 = psyState({ T: 30, P, phi: 0.7 });
    const s2 = psyState({ T: 20, P, phi: 0.2 });
    const ma = 4 / vAir(30, s1.w, P);
    const mw = ma * (s1.w - s2.w);
    near(mw, 0.0720, 1.5e-2);
    const Q = (ma * (s1.h - s2.h - (s1.w - s2.w) * water.satT(20).hf)) / 60;
    near(Q, 3.73, 1e-2);
    const hin = r134a.Px(350, 0.2).h;
    const hout = r134a.Px(350, 1).h;
    near((Q * 60) / (hout - hin), 1.44, 1.5e-2);
  });
  it('14-14: 15 kg dry air + 0.17 kg vapor at 30 C, 100 kPa', () => {
    const w = 0.17 / 15;
    near(w, 0.0113, 5e-3);
    const Pvap = (w * 100) / (0.622 + w);
    near(Pvap / Pg(30), 0.421, 5e-3);
    near((15 * 0.287 * 303.15) / (100 - Pvap), 13.3, 5e-3);
  });
  it('14-16: saturated air at 30 C, 105 kPa in 8 m3', () => {
    const w = omega(30, 1, 105);
    near(w, 0.0262, 5e-3);
    const Pa = 105 - Pg(30);
    near((Pa * 8) / (0.287 * 303.15), 9.26, 5e-3);
    near(hAir(30, w), 97.1, 3e-3);
  });
  it('14-43: 28 C with a 20 C dew point at 1 atm', () => {
    const Pvap = water.Psat(20);
    near(Pvap, 2.339, 1e-3);
    near(Pvap / Pg(28), 0.62, 1e-2);
    const w = (0.622 * Pvap) / (P - Pvap);
    near(w, 0.0147, 5e-3);
    near(hAir(28, w), 65.7, 3e-3);
    near(psyState({ T: 28, P, w }).Twb, 22.4, 1e-2);
  });
  it('14-65: humid air at 150 kPa, 40 C, 70 % cooled to the dew point: 6.8 kJ/kg dry air', () => {
    const s = psyState({ T: 40, P: 150, phi: 0.7 });
    const q = s.h - hAir(s.Tdp, s.w);
    near(q, 6.82, 1e-2);
    near(s.Tdp, 33.5, 5e-3);
  });
  it('Example 14-1: room 5 x 5 x 3 m, 25 C, 75 %, 100 kPa; Example 14-2 fogging at 15.4 C', () => {
    const s = psyState({ T: 25, P: 100, phi: 0.75 });
    near(s.w, 0.0152, 5e-3);
    near(s.h, 63.7, 3e-3);
    near(Pv(s.w, 100), 2.38, 5e-3);
    const ma = ((100 - Pv(s.w, 100)) * 75) / (0.287 * 298.15);
    near(ma, 85.6, 3e-3);
    near(ma * s.w, 1.30, 1e-2);
    near(psyState({ T: 20, P: 100, phi: 0.75 }).Tdp, 15.4, 5e-3);
  });
  it('14-32 at 95 kPa: omega 0.0096, phi 45.7 %, h 49.7', () => {
    const w = omegaFromWetBulb(25, 17, 95);
    near(w, 0.0096, 1e-2);
    near(phiOf(25, w, 95), 0.457, 1e-2);
    near(hAir(25, w), 49.7, 1e-2);
  });
  it('14-102: mixing two streams (also pinned in lib.test.ts)', () => {
    const w1 = omegaFromWetBulb(36, 30, P);
    const w2 = omega(12, 1, P);
    const m = mixStreams({ ma: 8, w: w1, h: hAir(36, w1) }, { ma: 10, w: w2, h: hAir(12, w2) }, P);
    near(m.w, 0.01579, 5e-3);
  });
});

/* ===================================================================== Assignment 8 (chapter 15) */
describe('assignment 8 (combustion)', () => {
  it('15-33: methane burned with dry air; dry product analysis gives AF 34.5 and 200 % theoretical air', () => {
    // CH4 + a(O2 + 3.76 N2) -> 5.20 CO2 + 0.33 CO + 11.24 O2 + 83.23 N2 per 100 kmol dry products
    const a = 83.23 / 3.76;
    near(a, 22.13, 2e-3);
    const fuel = 5.2 + 0.33; // kmol CH4 per 100 kmol dry products (carbon balance)
    const AF = (a * 4.76 * 28.97) / (fuel * 16.043);
    near(AF, 34.4, 5e-3);
    near(a / fuel / 2, 2.0, 3e-2);
  });
  it('15-37: Colorado coal (ash-free) with 50 % excess air: FA 0.0576', () => {
    // per 100 kg coal: 79.61 C, 4.66 H2, 4.76 O2, 1.83 N2, 0.52 S, 8.62 ash
    const nC = 79.61 / 12.011, nH2 = 4.66 / 2.016, nS = 0.52 / 32.06, nO2 = 4.76 / 31.999;
    const aTh = nC + nH2 / 2 + nS - nO2;
    near(aTh / 0.9138, 8.39, 5e-3);
    const a = 1.5 * aTh;
    const AF = (a * 4.76 * 28.97) / 91.38;
    near(1 / AF, 0.0576, 1.5e-2);
  });
  it('15-46: enthalpy of combustion of methane with liquid water, -890 330 kJ/kmol', () => {
    const h = 1 * -393520 + 2 * (-285830) - (-74850);
    near(h, -890330, 1e-6);
    near(heatingValues(SPECIES.CH4).HHV, 55497, 6e-3);
  });
  it('15-24: ethane with 20 % excess air: AF 19.3 and dew point 52.4 C', () => {
    const b = burn({ fuel: [[1, 'C2H6']], theoAir: 1.2 });
    near(b.AF, 19.3, 5e-3);
    near(dewPoint(b.products, 100), 52.5, 5e-3);
  });
  it('15-26: butane in 200 % theoretical air; water sprayed so that the dew point is 60 C at 100 kPa: x = 9.8', () => {
    const b = burn({ fuel: [[1, 'C4H10']], theoAir: 2 });
    const Pvap = water.Psat(60);
    // (5 + x)/(Nprod + x) = Pvap/100
    const x = (Pvap * b.Nprod - 100 * 5) / (100 - Pvap);
    near(x, 9.8, 1e-2);
    near(b.Nprod, 64.38, 1e-3);
  });
  it('15-35 (course list: 15-36): octane, 60 % excess air, 15 % of C to CO: fractions and 44 C', () => {
    const b = burn({ fuel: [[1, 'C8H18g']], theoAir: 1.6, coFraction: 0.15 });
    const N = b.Nprod;
    near(N, 100.3, 1e-3);
    near(b.products.CO2 / N, 0.0678, 3e-3);
    near(b.products.CO / N, 0.012, 5e-3);
    near(b.products.H2O / N, 0.0897, 3e-3);
    near(b.products.O2 / N, 0.0808, 3e-3);
    near(b.products.N2 / N, 0.7498, 3e-3);
    near(dewPoint(b.products, 101.325), 44.0, 1e-2);
    near(b.AF, 24.1, 1e-2);
  });
  it('15-52: HHV 48 255 and LHV 44 787 kJ/kg of gaseous octane', () => {
    const h = heatingValues(SPECIES.C8H18g);
    near(h.HHV, 48255, 3e-3);
    near(h.LHV, 44787, 3e-3);
  });
  it('15-68: rigid tank 120 g CH4 + 600 g O2, final pressure 805 kPa', () => {
    const nCH4 = 0.12 / 16.043, nO2 = 0.6 / 31.999;
    near(nCH4, 0.00748, 5e-3);
    near(nO2, 0.01875, 1e-3);
    const Vt = ((nCH4 + nO2) * Ru * 298.15) / 200;
    near(((nCH4 + nO2) * Ru * 1200) / Vt, 805, 6e-3);
    // closed-system heat uses u = h - Ru T for each species
    const q = closedQMoles([[nCH4, 'CH4'], [nO2, 'O2']], 298.15, [[nCH4, 'CO2'], [2 * nCH4, 'H2O'], [nO2 - 2 * nCH4, 'O2']], 1200);
    near(q, 5251, 6e-3);
  });
  it('Hprod of the 15-67 products is consistent with the dew-point criterion', () => {
    const b = burn({ fuel: [[0.4, 'C3H8'], [0.6, 'CH4']], theoAir: 1 });
    near(b.products.H2O, 2.8, 1e-9);
    near(b.products.CO2, 1.8, 1e-9);
    near(b.products.N2, 12.032, 1e-9);
    expect(Hprod(b.products, 398.15)).toBeLessThan(0);
    near(dewPoint(b.products, 100), 56.4, 5e-3);
    near(b.AF * (2.12 / 60), 34.3 / 60 * 1, 1e-1);
  });
});

/* ===================================================================== Assignment 9 (chapter 16) */
describe('assignment 9 (chemical equilibrium)', () => {
  it('16-33: the notebook equation counts solid carbon as a gas (N_T = 4 - 2x, exponent 2) and its root is 0.5194', () => {
    const KpDec = Math.exp(-2.328);
    const lhs = (x: number) => {
      const y = 1 - x; // kmol C(s) formed, counted as gas by the notebook
      return (y * (2 * y) ** 2) / x / (4 - 2 * x) ** 2;
    };
    near(lhs(0.5194), KpDec, 2e-3);
    // the correct bookkeeping leaves 0.7934 kmol CH4
    const e = equilibrium({ lnK: 2.328, reac: [[1, 'C'], [2, 'H2']], prod: [[1, 'CH4']], initial: { CH4: 1 }, inert: { N2: 1 }, condensed: ['C'], P: 1 });
    near(e.CH4, 0.7934, 2e-3);
    near(e.H2, 0.4132, 3e-3);
  });
  it('16-31 with atoms: O and N are negligible at 2000 K (lnKp of O2 <-> 2O and N2 <-> 2N)', () => {
    const o = A28.find((r) => r.label.includes('O₂ ⇌ 2O'))!;
    const n = A28.find((r) => r.label.includes('N₂ ⇌ 2N'))!;
    expect(lnKp(o, 2000)).toBeLessThan(-13);
    expect(lnKp(n, 2000)).toBeLessThan(-40);
  });
  it('16-38: liquid propane, 150 % excess air: Q 190 300 kJ/kmol = 5180 kJ/min, complete combustion at 1200 K', () => {
    const lnK = lnKp(A28.find((r) => r.label === 'CO₂ ⇌ CO + ½O₂')!, 1200);
    expect(lnK).toBeLessThan(-17);
    const e = equilibrium({ lnK, reac: [[1, 'CO2']], prod: [[1, 'CO'], [0.5, 'O2']], initial: { CO2: 3, O2: 7.5 }, inert: { H2O: 4, N2: 47 }, P: 2 });
    near(e.CO2, 3, 1e-3);
    expect(e.CO).toBeLessThan(1e-3);
    const q = steadyQ({ fuel: [[1, 'C3H8_l']], theoAir: 2.5, Tfuel: 298.15, Tair: 285.15, Tprod: 1200 });
    near(q, 190300, 8e-3);
    near(q * (1.2 / 44.097), 5180, 1e-2);
  });
  it('16-40: oxygen heated to 3000 K at 1 atm: 1986 kJ/min with dissociation, 1533 without', () => {
    const e = equilibrium({ lnK: -4.357, reac: [[1, 'O2']], prod: [[2, 'O']], initial: { O2: 1 }, P: 1 });
    near(e.O, 0.113, 1e-2); // the notebook's x: kmol of O atoms per kmol of O2 fed
    near(e.O2, 1 - 0.113 / 2, 1e-3);
    // heat per kmol of O2 fed = sum N h-bar(3000 K) of the equilibrium mixture - h-bar(O2, 298 K)
    const Qm = e.O2 * hbar('O2', 3000) + e.O * hbar('O', 3000) - hbar('O2', 298.15);
    near(Qm, 127107, 5e-3);
    near(Qm * (0.5 / 31.999), 1986, 8e-3);
    near((hbar('O2', 3000) - hbar('O2', 298.15)) * (0.5 / 31.999), 1533, 5e-3);
  });
  it('16-56: van t Hoff with the table lnKp gives 276 856; the enthalpy data give 276 830 to 276 875', () => {
    const rx = A28.find((r) => r.label === 'CO₂ ⇌ CO + ½O₂')!;
    near(hR(rx, 2200), 276860, 1e-3);
  });
});

/* ===================================================================== Assignment 10 (chapter 17) */
describe('assignment 10 (compressible flow)', () => {
  it('17-18 with Table A-2 cp(T): the constant-cp Ma2 of 2.64 becomes about 2.8', () => {
    const R = 0.1889;
    const c1 = Math.sqrt(1.193 * R * 1000 * 800);
    near(c1, 424.6, 1e-3);
    near(50 / c1, 0.1178, 5e-3);
    const c2 = Math.sqrt(1.252 * R * 1000 * 400);
    near(c2, 307.6, 1e-3);
    const V2 = Math.sqrt(2 * 1000 * 0.939 * 400 + 50 * 50);
    near(V2, 868, 3e-3);
    near(V2 / c2, 2.82, 5e-3);
  });
  it('17-18 with the enthalpy table: mean cp 1.07, V2 926 m/s and Ma2 3.0 (the constant-cp 2.64 is 12 % low)', () => {
    const dhKg = (dh('CO2', 800) - dh('CO2', 400)) / 44.01;
    near(dhKg, 427.4, 2e-3);
    const V2 = Math.sqrt(2000 * dhKg + 50 * 50);
    near(V2, 926, 2e-3);
    near(V2 / soundSpeed(400, 0.1889, 1.252), 3.01, 5e-3);
    expect(2.64 / 3.01).toBeLessThan(0.9);
  });
  it('Examples 17-1 and 17-2: T01 286.8, P01 80.77, c 349, Ma 0.573; 17-26 c 292.6', () => {
    near(stagnationT(255.7, 250, 1.005), 286.8, 1e-3);
    near(54.05 * Math.pow(286.8 / 255.7, 3.5), 80.77, 1e-3);
    near(soundSpeed(303.15, 0.287, 1.4), 349, 2e-3);
    near(200 / soundSpeed(303.15, 0.287, 1.4), 0.573, 2e-3);
    near(soundSpeed(213.15, 0.287, 1.4), 292.6, 1e-3);
  });
  it('17-40: Ma 1.1 at 236.15 K: c 308, V 338.8, T0 293.3 K', () => {
    const c = soundSpeed(236.15, 0.287, 1.4);
    near(c, 308.0, 2e-3);
    near(1.1 * c, 338.8, 2e-3);
    near(236.15 * T0_T(1.1, 1.4), 293.3, 5e-4);
    near(stagnationT(236.15, 1.1 * c, 1.005), 293.3, 2e-3);
  });
  it('17-39 and 17-33C/17-48C: lowest throat pressure 634 kPa; sonic exit unchanged when the area is reduced', () => {
    near(1200 * critical(1.4).P, 633.9, 1e-3);
    near(1 / P0_P(1, 1.4), 0.5283, 1e-3);
  });
  it('17-62: A/A* at the inlet Mach number is 2.255 and the area ratio is 0.443, not 0.428', () => {
    const Ma1 = 110 / soundSpeed(420, 0.287, 1.4);
    near(areaRatio(Ma1, 1.4), 2.2553, 1e-3);
    near(1 / areaRatio(Ma1, 1.4), 0.4434, 1e-3);
    expect(Math.abs(1 / areaRatio(Ma1, 1.4) - 0.428)).toBeGreaterThan(0.01);
  });
});

/* keep unused imports honest */
void [mixtureFromMass, kay, Pg, water];
