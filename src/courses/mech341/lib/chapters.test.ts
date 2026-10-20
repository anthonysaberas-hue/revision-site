import { describe, expect, it } from 'vitest';
import { water, r134a } from './props';
import { brayton, braytonVariable, turbojet, rankine } from './cycles';
import { vcr, flashTwoStage } from './refrig';
import { leeKesler, CRIT } from './realgas';
import { dh, s0, Ru } from './gas';

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
