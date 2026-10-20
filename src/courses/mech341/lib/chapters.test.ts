import { describe, expect, it } from 'vitest';
import { water, r134a } from './props';
import { brayton, braytonVariable, turbojet, rankine } from './cycles';
import { vcr, flashTwoStage } from './refrig';
import { leeKesler, CRIT } from './realgas';
import { dh, s0, Ru, hR, vantHoff, A28, lnKp } from './gas';
import { mixtureFromMoles, mixtureFromMass, GASES } from './mixtures';
import { psyState, mixStreams, omega, hAir, omegaFromWetBulb, Tdp } from './psychro';
import { burn, dewPoint, steadyQ, aft } from './combustion';
import { equilibrium } from './equilibrium';
import { kay } from './realgas';
import { stagnationT, P0_P, areaRatio, machFromAreaRatio, critical } from './compressible';

/** |a - b| <= rel * max(1, |b|) */
const near = (a: number, b: number, rel = 1e-3) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe('chapter 8 (review)', () => {
  it('4-9 boundary work and 4-11 saturated expansion', () => {
    const v1 = water.Px(150, 1).v;
    const v2 = water.PT(150, 200).v;
    near(v2, 1.4445, 1e-3);
    near(5 * 150 * (v2 - v1), 213.8, 2e-3);
    const s = water.satT(200);
    const m = 1 / s.vf;
    near(m, 864.7, 2e-3);
    near(m * (s.vf + 0.8 * s.vfg), 88.2, 2e-3);
  });
  it('adiabatic turbine, eta 0.85: entropy generation and exergy destruction', () => {
    const T0 = 298.15;
    const a = water.PT(4000, 400);
    const s2s = water.Ps(10, a.s);
    const h2 = a.h - 0.85 * (a.h - s2s.h);
    const b = water.Ph(10, h2);
    near(b.x as number, 0.8834, 2e-3);
    near(b.s - a.s, 0.5032, 3e-3);
    near(T0 * (b.s - a.s), 150.0, 3e-3);
    const wrev = a.h - b.h - T0 * (a.s - b.s);
    near((a.h - b.h) / wrev, 0.8584, 2e-3);
  });
});

describe('chapter 9 (gas cycles)', () => {
  it('Ex. 9-5: variable cp versus cold air', () => {
    const v = braytonVariable({ T1: 300, rp: 8, T3: 1300 });
    near(v.wnet, 362.2, 3e-3);
    near(v.eta, 0.4255, 3e-3);
    const c = brayton({ T1: 300, rp: 8, T3: 1300 });
    near(c.eta, 0.448, 2e-3);
    near(c.wnet, 340.6, 2e-3);
  });
  it('9-109 (7FA): the notebook efficiencies reproduce 36 % and 44 % with a 65 % regenerator', () => {
    const T3 = 1288 + 273.15;
    const a = braytonVariable({ T1: 300, rp: 14.7, T3, etaC: 0.948, etaT: 0.838 });
    near(a.eta, 0.36, 1e-2);
    near(a.wnet, 375.4, 5e-3);
    near(braytonVariable({ T1: 300, rp: 14.7, T3, etaC: 0.948, etaT: 0.838, regen: 0.65 }).eta, 0.443, 1e-2);
  });
  it('class turbojet: rp 12, 288 K, T04 1400 K, etaC 0.87, etaT 0.9, converging and CD nozzles', () => {
    const base = { Ta: 288, Pa: 100, V: 0, mdot: 1, rc: 12, T04: 1400, etaC: 0.87, etaT: 0.9, cpg: 1.147, kg: 1.333 };
    const c = turbojet({ ...base, nozzle: 'C' });
    near(c.T03, 630.3, 1e-3);
    near(c.T05, 1100.1, 1e-3);
    near(c.P05, 404.2, 2e-3);
    expect(c.choked).toBe(true);
    near(c.Ve, 600.2, 2e-3);
    near(c.F, 844.5, 2e-3);
    const d = turbojet({ ...base, nozzle: 'CD' });
    near(d.Ve, 862.2, 2e-3);
    near(d.F, 862.2, 2e-3);
  });
  it('9-136 thrust and fuel flow', () => {
    const a = turbojet({ Ta: 241.15, Pa: 32, V: 280, mdot: 50, rc: 12, T04: 1100 });
    near(a.F, 27625, 2e-3);
    near(a.T03, 569.8, 1e-3);
    near((50 * 1.005 * (1100 - a.T03)) / 42700, 0.624, 3e-3);
  });
});

describe('chapter 10 (vapor cycles)', () => {
  const base = { Pb: 4000, Tb: 400, Pc: 10 };
  it('class Rankine: ideal and actual', () => {
    const r = rankine(base);
    near(r.eta, 0.3531, 2e-3);
    near(r.x_exit, 0.8163, 2e-3);
    near(r.wP, 4.03, 5e-3);
    const a = rankine({ ...base, etaT: 0.85, etaP: 0.85 });
    near(a.eta, 0.2998, 3e-3);
    near(a.x_exit, 0.8834, 2e-3);
  });
  it('reheat at 400 kPa to 400 C and one open FWH at 400 kPa', () => {
    const r = rankine({ ...base, reheat: { P: 400, T: 400 } });
    near(r.eta, 0.3587, 2e-3);
    near(r.x_exit, 0.9669, 2e-3);
    near(r.states.turbineExit.h, 2504.6, 1e-3);
    const o = rankine({ ...base, ofwh: { P: 400 } });
    near(o.y, 0.1654, 3e-3);
    near(o.eta, 0.3746, 2e-3);
  });
  it('10-98 heater entropy generation, PWR steam, closed heater 10-55', () => {
    const r = rankine({ Pb: 10000, Tb: 500, Pc: 10, ofwh: { P: 500 }, etaT: 0.8, etaP: 0.95 });
    const S = r.states;
    near(S.fwhExit.s - r.y * S.bleed.s - (1 - r.y) * S.pump1Exit.s, 0.131, 1e-2);
    const p = rankine({ Pb: 7000, Tb: water.Tsat(7000) + 0.3, Pc: 7 });
    near(p.eta, 0.3696, 3e-3);
    near(p.x_exit, 0.6816, 3e-3);
    const c = rankine({ Pb: 3000, Tb: 350, Pc: 20, cfwh: { P: 1000, drain: 'back' } });
    near(c.y, 0.2442, 3e-3);
    near(c.states.turbineExit.x as number, 0.8357, 3e-3);
  });
  it('12.5 MPa 550 C with a closed heater at 0.8 MPa and an open heater at 0.3 MPa (hand assembly)', () => {
    const s8 = water.PT(12500, 550);
    const h9 = water.Ps(800, s8.s).h;
    const h10 = water.Ps(300, s8.s).h;
    const h11 = water.Ps(10, s8.s).h;
    const s1 = water.Px(10, 0);
    const h2 = s1.h + s1.v * (300 - 10);
    const s3 = water.Px(300, 0);
    const h4 = s3.h + s3.v * (12500 - 300);
    const s6 = water.Px(800, 0);
    const h5 = water.PT(12500, s6.T).h;
    const y = (h5 - h4) / (h9 - s6.h);
    const z = (s3.h - h2 - y * (s6.h - h2)) / (h10 - h2);
    const wT = s8.h - h9 + (1 - y) * (h9 - h10) + (1 - y - z) * (h10 - h11);
    const wP = (1 - y - z) * (h2 - s1.h) + (h4 - s3.h);
    near(y, 0.0784, 5e-3);
    near(z, 0.1374, 5e-3);
    near((wT - wP) / (s8.h - h5), 0.4544, 3e-3);
    near(250000 / (wT - wP), 200.6, 3e-3);
  });
  it('cogeneration: 15 kg/s, 7 MPa 500 C, process heater at 500 kPa', () => {
    const in1 = water.PT(7000, 500);
    const x5 = water.Ps(500, in1.s);
    const x6 = water.Ps(5, in1.s);
    const f1 = water.Px(5, 0);
    const hP1 = f1.h + f1.v * (7000 - 5);
    const f3 = water.Px(500, 0);
    const hP3 = f3.h + f3.v * (7000 - 500);
    const Qp = 10.5 * x5.h + 1.5 * in1.h - 12 * f3.h;
    const WT = 13.5 * (in1.h - x5.h) + 3 * (x5.h - x6.h);
    const Wp = 3 * (hP1 - f1.h) + 12 * (hP3 - f3.h);
    const hmix = (3 * hP1 + 12 * hP3) / 15;
    const Qin = 15 * (in1.h - hmix);
    near(Qp, 26198, 2e-3);
    near(WT - Wp, 10966, 3e-3);
    near((WT - Wp + Qp) / Qin, 0.865, 3e-3);
    near(15 * (in1.h - f3.h), 41569, 2e-3);
  });
});

describe('chapter 11 (refrigeration)', () => {
  const PL = r134a.Psat(-25);
  const PH = 800;
  it('single stage at -25 C / 800 kPa, 0.6 kg/s, ideal and actual', () => {
    const id = vcr({ PL, PH, mdot: 0.6 });
    near(id.states[1].h, 235.3, 1e-3);
    near(id.states[2].h, 277.2, 1e-3);
    near(id.QL, 83.9, 2e-3);
    near(id.W, 25.15, 2e-3);
    near(id.COPR, 3.335, 2e-3);
    near(vcr({ PL, PH, etaC: 0.8, superheat: 5, subcool: 5 }).COPR, 2.81, 5e-3);
  });
  it('cascade with intermediate pressure sqrt(PL PH) agrees with the separator two-stage COP', () => {
    const Pi = Math.sqrt(PL * PH);
    const s1 = r134a.Px(PL, 1);
    const h2 = r134a.Ps(Pi, s1.s).h;
    const h3 = r134a.Px(Pi, 0).h;
    const g5 = r134a.Px(Pi, 1);
    const h6 = r134a.Ps(PH, g5.s).h;
    const h7 = r134a.Px(PH, 0).h;
    const mL = 0.6;
    const mH = (mL * (h2 - h3)) / (g5.h - h7);
    const W = mL * (h2 - s1.h) + mH * (h6 - g5.h);
    const QL = mL * (s1.h - h3);
    near(Pi, 291.75, 1e-3);
    near(mH, 0.7898, 3e-3);
    near(QL, 110.15, 2e-3);
    near(W, 28.73, 3e-3);
    near(QL / W, 3.834, 3e-3);
    near(flashTwoStage({ PH, Pm: Pi, PL, QL: 1 }).COP, QL / W, 2e-3);
  });
  it('11-46 heat pump COP and 11-60 single stage comparison', () => {
    const hp = vcr({ PL: 280, PH: 1000, T1: 0, T2actual: 60, T3: 30, QH: 60000 / 3600 });
    near(hp.COPHP, 4.69, 3e-3);
    near(hp.QL, 13.11, 3e-3);
    near(vcr({ PL: r134a.Psat(-40), PH: 800 }).COPR, 2.28, 5e-3);
  });
});

describe('chapter 12 (property relations)', () => {
  it('Clapeyron h_fg of R-134a at 20 C from a +-4 K central difference', () => {
    const slope = (r134a.Psat(24) - r134a.Psat(16)) / 8;
    near(slope, 17.69, 2e-3);
    const s = r134a.satT(20);
    near(293.15 * s.vfg * slope, 182.45, 2e-3);
    near(s.hfg, 182.28, 1e-3);
  });
  it('Maxwell relation (ds/dP)_T = -(dv/dT)_P for R-134a at 50 C, 0.7 MPa', () => {
    const dsdP = (r134a.PT(710, 50).s - r134a.PT(690, 50).s) / 20;
    const dvdT = (r134a.PT(700, 51).v - r134a.PT(700, 49).v) / 2;
    near(-dsdP, dvdT, 5e-3);
    near(dvdT, 1.585e-4, 2e-2);
  });
  it('12-62 throttled steam: 297.5 C and mu_JT 12.4 K/MPa', () => {
    const a = water.PT(1000, 300);
    const b = water.Ph(800, a.h);
    near(b.T, 297.5, 1e-3);
    near((b.T - a.T) / -200, 0.0124, 2e-2);
    const dvdT = (water.PT(1000, 310).v - water.PT(1000, 290).v) / 20;
    const cp = (water.PT(1000, 310).h - water.PT(1000, 290).h) / 20;
    near((573.15 * dvdT - a.v) / cp, 0.0124, 3e-2);
  });
  it('12-72 steam departure charts versus tables', () => {
    const Tcr = 647.1;
    const Pcr = 22.06;
    const l1 = leeKesler(573.15 / Tcr, 8.5879 / Pcr);
    const l2 = leeKesler(973.15 / Tcr, 8.5879 / Pcr);
    near(l1.Zh, 0.601, 1e-2);
    near(l2.Zh, 0.189, 2e-2);
    const M = 18.015;
    const dhId = (dh('H2O', 973.15) - dh('H2O', 573.15)) / M;
    near(dhId - ((Ru * Tcr) / M) * (l2.Zh - l1.Zh), 976, 5e-3);
    const dsId = (s0('H2O', 973.15) - s0('H2O', 573.15)) / M;
    near(dsId - (Ru / M) * (l2.Zs - l1.Zs), 1.3, 1e-2);
    const tab = water.PT(8587.9, 700).h - water.Tx(300, 1).h;
    near(tab, 1129, 2e-3);
  });
  it('CO2 at 40 C and 10 MPa and methane at 300 K, 7 MPa compressibility', () => {
    near(leeKesler(313.15 / CRIT.CO2.Tcr, 10 / CRIT.CO2.Pcr).Z, 0.2746, 1e-2);
    near(leeKesler(300 / CRIT.CH4.Tcr, 7 / CRIT.CH4.Pcr).Z, 0.891, 5e-3);
  });
});

describe('chapter 13 (mixtures)', () => {
  it('class example 1: H2/O2/CO by mass 0.10/0.48/0.42 -> y 0.625/0.1875/0.1875, M 12.5', () => {
    const m = mixtureFromMass({ H2: 0.1, O2: 0.48, CO: 0.42 });
    near(m.y.H2, 0.625, 5e-3);
    near(m.y.O2, 0.1875, 1e-2);
    near(m.M, 12.5, 1e-2);
  });
  it('class example 2: N2 added to 0.5 kg O2 tank, 3 bar to 4 bar -> 0.146 kg', () => {
    near((0.5 / GASES.O2.M / 3) * GASES.N2.M, 0.1459, 1e-3);
  });
  it('class example 3: Kay 2 N2 + 6 CO2 -> Tcr 259.7, Pcr 6.39, TR 1.155, PR 2.35, Z 0.47 (chart 0.49)', () => {
    const k = kay({ N2: 0.25, CO2: 0.75 });
    near(k.Tcr, 259.7, 1e-3);
    near(k.Pcr, 6.39, 1e-3);
    near(300 / k.Tcr, 1.155, 2e-3);
    near(15 / k.Pcr, 2.347, 2e-3);
    near(leeKesler(300 / k.Tcr, 15 / k.Pcr).Z, 0.49, 6e-2);
    near((8 * Ru * 300) / 15000, 1.33, 1e-3);
  });
  it('13-56 mixing O2 and N2: V 0.2496, m 10.43, P 444.6, Q 187.1, Sgen 0.962', () => {
    const T1o = 288.15, T1n = 323.15, T2 = 298.15;
    const MO = GASES.O2.M, MN = GASES.N2.M;
    const VO = (1 * (Ru / MO) * T1o) / 300;
    const mN = (500 * 2) / ((Ru / MN) * T1n);
    const nO = 1 / MO, nN = mN / MN, N = nO + nN, V = VO + 2;
    const P2 = (N * Ru * T2) / V;
    const Q = -(1 * GASES.O2.cv * (T2 - T1o) + mN * GASES.N2.cv * (T2 - T1n));
    const sO = 1 * (GASES.O2.cp * Math.log(T2 / T1o) - (Ru / MO) * Math.log(((nO / N) * P2) / 300));
    const sN = mN * (GASES.N2.cp * Math.log(T2 / T1n) - (Ru / MN) * Math.log(((nN / N) * P2) / 500));
    near(VO, 0.2496, 1e-3);
    near(mN, 10.43, 1e-3);
    near(P2, 444.6, 1e-3);
    near(Q, 187.1, 2e-3);
    near(sO + sN + Q / T2, 0.962, 3e-3);
  });
  it('13-62 He-Ar turbine work 781.9 kJ/kg (not 787.1) and EAN32 depth 34 m', () => {
    const m = mixtureFromMoles({ He: 0.5, Ar: 0.5 });
    const T2 = 1300 * Math.pow(200 / 2500, (m.k - 1) / m.k);
    near(T2, 473.4, 2e-3);
    near(m.cp * (1300 - T2), 781.9, 3e-3);
    near((1.4 / 0.32 - 1) * 10, 33.75, 1e-6);
  });
});

describe('chapter 14 (psychrometrics)', () => {
  it('Example 14-1: Pa 97.62, w 0.0152, h 63.7, ma 85.6, mv 1.30', () => {
    const s = psyState({ T: 25, P: 100, phi: 0.75 });
    near(100 - 0.75 * 3.1699, 97.62, 1e-3);
    near(s.w, 0.0152, 1e-2);
    near(s.h, 63.8, 3e-3);
    const ma = (97.62 * 75) / (0.287 * 298.15);
    near(ma, 85.6, 2e-3);
    near(s.w * ma, 1.3, 1e-2);
  });
  it('Example 14-5: 668 kJ/min and 0.538 kg/min', () => {
    const a = psyState({ T: 10, P: 100, phi: 0.3 });
    const ma = 45 / a.v;
    near(ma, 55.2, 3e-3);
    near(ma * (hAir(22, a.w) - a.h), 668, 5e-3);
    near(ma * (omega(25, 0.6, 100) - a.w), 0.538, 5e-3);
  });
  it('cooling tower example: 97.5 kg/s, 82.1 m3/s, 1.80 kg/s', () => {
    const a = psyState({ T: 20, P: 101.325, phi: 0.6 });
    const b = psyState({ T: 30, P: 101.325, phi: 1 });
    const hf3 = water.satT(35).hf,
      hf4 = water.satT(22).hf;
    const ma = (100 * (hf3 - hf4)) / (b.h - a.h - (b.w - a.w) * hf4);
    near(ma, 97.5, 3e-3);
    near(ma * a.v, 82.1, 3e-3);
    near(ma * (b.w - a.w), 1.8, 1e-2);
  });
  it('14-102 mixing: T 22.8, phi 0.90', () => {
    const w1 = omegaFromWetBulb(36, 30, 101.325);
    const s2 = psyState({ T: 12, P: 101.325, phi: 1 });
    const m = mixStreams({ ma: 8, w: w1, h: hAir(36, w1) }, { ma: 10, w: s2.w, h: s2.h }, 101.325);
    near(m.T, 22.83, 3e-3);
    near(m.phi, 0.9, 5e-3);
  });
  it('2021 final P5 at 100 kPa: T2 10.5, ma 48.6, V1 43.6, condensate 0.539, heater 12.0 kW', () => {
    const a = psyState({ T: 30, P: 100, phi: 0.7 });
    const w3 = omega(25, 0.4, 100);
    const T2 = Tdp(w3, 100);
    const b = psyState({ T: T2, P: 100, phi: 1 });
    const c = psyState({ T: 25, P: 100, w: w3 });
    const ma = (11 * 211) / (a.h - b.h - (a.w - b.w) * water.satT(T2).hf);
    near(T2, 10.48, 3e-3);
    near(ma, 48.6, 3e-3);
    near(ma * a.v, 43.6, 3e-3);
    near(ma * (a.w - b.w), 0.539, 5e-3);
    near((ma * (c.h - b.h)) / 60, 12.0, 5e-3);
  });
});

describe('chapter 15 (combustion)', () => {
  it('butane AF 20: 129 % theoretical, Tdp 49 C; propane Example 15-7: AF 23.5, 414 kJ/min', () => {
    const th = 20 / burn({ fuel: [[1, 'C4H10']], theoAir: 1 }).AF;
    near(th, 1.293, 5e-3);
    const b = burn({ fuel: [[1, 'C4H10']], theoAir: th });
    near(dewPoint(b.products, 101), 49.2, 5e-3);
    const o = { fuel: [[1, 'C3H8_l']] as [number, string][], theoAir: 1.5, coFraction: 0.1, Tfuel: 298.15, Tair: 280.15 };
    const b2 = burn(o);
    near(b2.AF, 23.5, 5e-3);
    near(b2.products.O2, 2.65, 1e-6);
    const q = steadyQ({ ...o, Tprod: 1500 });
    near(q, 363800, 1e-2);
    near((q / 44.097) * 0.05, 413, 1e-2);
  });
  it('15-79 acetylene with loss 75000: 2302 K; decane final 2021: 1364 K', () => {
    near(aft({ fuel: [[1, 'C2H2']], theoAir: 1.3, Tfuel: 298.15, Tair: 300.15, Qloss: 75000 }), 2302, 1e-3);
    near(aft({ fuel: [[1, 'C10H22']], theoAir: 49.849 / 15.5, Tfuel: 298.15, Tair: 616.1 }), 1364, 5e-3);
  });
  it('15-59 propane AF 25: Tdp 46.0, q = 2.018e6 (not 2.297e6); 15-67 mixture q 1.247e6', () => {
    const b = burn({ fuel: [[1, 'C3H8']], theoAir: 1.599 });
    const T = dewPoint(b.products, 101.325);
    near(T, 46.0, 5e-3);
    near(steadyQ({ fuel: [[1, 'C3H8']], theoAir: 1.599, Tfuel: 298.15, Tair: 298.15, Tprod: T + 273.15 }), 2.018e6, 5e-3);
    near(steadyQ({ fuel: [[0.4, 'C3H8'], [0.6, 'CH4']], theoAir: 1, Tfuel: 298.15, Tair: 298.15, Tprod: 398.15 }), 1.2473e6, 5e-3);
  });
  it('methane stoichiometric AF 17.19', () => {
    near(burn({ fuel: [[1, 'CH4']], theoAir: 1 }).AF, 17.19, 2e-3);
  });
});

describe('chapter 16 (equilibrium)', () => {
  it('16-56: h_R(2200 K) 276 860 from the enthalpy data and 276 856 from van t Hoff', () => {
    const rx = A28.find((r) => r.label === 'CO₂ ⇌ CO + ½O₂')!;
    near(hR(rx, 2200), 276860, 1e-3);
    near(vantHoff(-6.635, 2000, -3.86, 2400), 276856, 2e-3);
    near(lnKp(rx, 2000), -6.635, 2e-3);
    near(lnKp(rx, 2400), -3.86, 2e-3);
  });
  it('16-31 NO 0.0376 and P-independence (delta nu = 0)', () => {
    const a = equilibrium({ lnK: -3.931, reac: [[0.5, 'N2'], [0.5, 'O2']], prod: [[1, 'NO']], initial: { N2: 3.76, O2: 1 }, P: 2 });
    const b = equilibrium({ lnK: -3.931, reac: [[0.5, 'N2'], [0.5, 'O2']], prod: [[1, 'NO']], initial: { N2: 3.76, O2: 1 }, P: 20 });
    near(a.NO, 0.0376, 1e-2);
    near(a.NO, b.NO, 1e-6);
  });
  it('16-33 recomputed: y CH4 0.360, H2 0.187, N2 0.453 and Kp check', () => {
    const e = equilibrium({ lnK: 2.328, reac: [[1, 'C'], [2, 'H2']], prod: [[1, 'CH4']], initial: { CH4: 1 }, inert: { N2: 1 }, condensed: ['C'], P: 1 });
    const N = e.CH4 + e.H2 + e.N2;
    near(e.CH4 / N, 0.36, 3e-3);
    near(e.H2 / N, 0.187, 3e-3);
    near(e.N2 / N, 0.453, 3e-3);
    near(e.CH4 / N / Math.pow(e.H2 / N, 2), Math.exp(2.328), 1e-3);
  });
  it('inert gas shifts CO2 dissociation like lower pressure', () => {
    const rx = A28.find((r) => r.label === 'CO₂ ⇌ CO + ½O₂')!;
    const a = (inert: number, P: number) => equilibrium({ lnK: lnKp(rx, 3000), reac: rx.reac, prod: rx.prod, initial: { CO2: 1 }, inert: inert ? { N2: inert } : undefined, P }).CO;
    expect(a(2, 1)).toBeGreaterThan(a(0, 1));
    expect(a(0, 0.1)).toBeGreaterThan(a(0, 1));
    expect(a(0, 10)).toBeLessThan(a(0, 1));
  });
});

describe('chapter 17 (compressible flow)', () => {
  it('Example 17-1: T0 286.8, P0 80.77, Ma 0.78', () => {
    const T0 = stagnationT(255.7, 250, 1.005);
    near(T0, 286.8, 1e-3);
    near(54.05 * Math.pow(T0 / 255.7, 3.5), 80.77, 1e-3);
    near(250 / Math.sqrt(1.4 * 287 * 255.7), 0.78, 3e-3);
  });
  it('17-62: T0 426.0, T* 355.0, P* 277.6, A*/A1 0.4434 by two methods (not 0.428)', () => {
    const T0 = stagnationT(420, 110, 1.005);
    const Ma1 = 110 / Math.sqrt(1.4 * 287 * 420);
    const P0 = 500 * P0_P(Ma1, 1.4);
    const Ts = T0 * critical(1.4).T;
    const Ps = P0 * critical(1.4).P;
    near(T0, 426.0, 1e-3);
    near(Ts, 355.0, 1e-3);
    near(Ps, 277.6, 1e-3);
    near(1 / areaRatio(Ma1, 1.4), 0.4434, 2e-3);
    const rho1 = 500 / (0.287 * 420),
      rhos = Ps / (0.287 * Ts);
    near((rho1 * 110) / (rhos * Math.sqrt(1.4 * 287 * Ts)), 0.4434, 2e-3);
  });
  it('17-18 CO2: Ma1 0.113, V2 824, Ma2 2.64; 17-26 Ma 0.897; 17-40 T0 293.3; throat pressure 634 kPa', () => {
    const k = 1.289,
      R = 0.1889,
      cp = 0.846;
    near(50 / Math.sqrt(k * R * 1000 * 800), 0.1133, 2e-3);
    const V2 = Math.sqrt(2000 * cp * 400 + 50 * 50);
    near(V2, 824.2, 2e-3);
    near(V2 / Math.sqrt(k * R * 1000 * 400), 2.64, 2e-3);
    near(945 / 3.6 / Math.sqrt(1.4 * 287 * 213.15), 0.897, 2e-3);
    near(236.15 * (1 + 0.2 * 1.21), 293.3, 1e-3);
    near(0.5283 * 1200, 634, 1e-3);
  });
  it('nozzle critical pressure ratios for A/A* = 2: 0.094 design and 0.937 first critical', () => {
    near(1 / P0_P(machFromAreaRatio(2, 1.4, 'sup'), 1.4), 0.0939, 5e-3);
    near(1 / P0_P(machFromAreaRatio(2, 1.4, 'sub'), 1.4), 0.9374, 5e-3);
  });
});
