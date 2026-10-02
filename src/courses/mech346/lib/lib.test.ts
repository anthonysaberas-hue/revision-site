import { describe, expect, it } from 'vitest';
import { air, water } from './props';
import { J0, J1, erf, erfc } from './special';
import { Rcyl, Rsph, Rwall, Rconv, series, parallel, genCylinder, genSphere, genPlane, slabFromFaces, rCritCyl } from './conduction';
import { finAnalysis, rectFin, pinFin, etaAnnular } from './fins';
import { lambda1, A1, oneTerm, spatial, QoverQmax, lumpedB, lumpedTime, semiInfiniteTs, contactTemp, wallSeries } from './transient';
import * as cv from './convection';
import { effectiveness, ntuFromEffectiveness, rateHX, lmtdCounter, lmtdParallel, Fshell1 } from './hx';
import { bandFraction, enclosure, F_parallelRect, F_perpRect, F_disks, parallelPlates, withShields, Eb } from './radiation';

const near = (a: number, b: number, rel = 1e-3) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe('special functions', () => {
  it('Bessel and erf', () => {
    near(J0(1), 0.7651976866, 1e-6);
    near(J1(1), 0.4400505857, 1e-6);
    near(J0(2.4048), 0, 1e-3);
    near(erf(0.5), 0.5204998778, 1e-9);
    near(erfc(3), 2.209049699858544e-5, 1e-6);
  });
});

describe('properties', () => {
  it('air at 25 C is close to the textbook', () => {
    const a = air(25);
    near(a.rho, 1.184, 5e-3);
    near(a.Pr, 0.707, 1e-2);
    near(a.nu, 1.558e-5, 1e-2);
  });
  it('water at 20 C', () => {
    const w = water(20);
    near(w.k, 0.598, 5e-3);
    near(w.Pr, 7.0, 2e-2);
  });
});

describe('steady conduction (Chapter 3 assignment results)', () => {
  it('3-25 double-pane window: 154 W', () => {
    const A = 3.6;
    const R = series(Rconv(10, A), Rwall(0.003, 0.78, A), Rwall(0.012, 0.026, A), Rwall(0.003, 0.78, A), Rconv(25, A));
    near(R, 0.16924, 1e-3);
    near(26 / R, 154, 5e-3);
  });
  it('3-67 jacket: 113 W', () => {
    const A = 1.25;
    const R = 5 * Rwall(0.00015, 0.13, A) + 4 * Rwall(0.0015, 0.026, A) + Rconv(25, A);
    near(25 / R, 113, 5e-3);
  });
  it('3-75 composite wall: 572 W and 263 C', () => {
    const A = 0.12;
    const R1 = Rwall(0.01, 2, A);
    const Rmid1 = parallel(Rwall(0.05, 20, 0.04), Rwall(0.05, 8, 0.04), Rwall(0.05, 20, 0.04));
    const Rmid2 = parallel(Rwall(0.1, 15, 0.06), Rwall(0.1, 35, 0.06));
    const Rtot = R1 + Rmid1 + Rmid2 + Rwall(0.06, 2, A);
    const Q = 200 / Rtot;
    near(Q, 572, 1e-2); // textbook rounds the resistances (0.06 for 0.0625 K/W)
    near(300 - Q * (R1 + Rmid1), 263, 1e-2);
  });
  it('3-81 steam pipe: 83.4 W/m', () => {
    const Ri = 1 / (80 * Math.PI * 0.05);
    const R1 = Rcyl(0.025, 0.0275, 15, 1);
    const R2 = Rcyl(0.0275, 0.0575, 0.038, 1);
    const Ro = 1 / (22 * Math.PI * 0.115);
    near(275 / (Ri + R1 + R2 + Ro), 83.4, 3e-3);
  });
  it('sphere resistance and critical radius', () => {
    near(Rsph(0.1, 0.2, 1) * 4 * Math.PI, 5, 1e-9);
    near(rCritCyl(0.05, 10), 0.005, 1e-12);
  });
  it('generation formulas', () => {
    const c = genCylinder(1e6, 0.02, 20, 500, 25);
    near(c.Ts, 25 + (1e6 * 0.02) / (2 * 500), 1e-12);
    near(c.T0 - c.Ts, (1e6 * 0.02 ** 2) / (4 * 20), 1e-12);
    near(genSphere(3e7, 0.04, 15, 4000, 25).T0, 25 + (3e7 * 0.04) / (3 * 4000) + (3e7 * 0.04 ** 2) / (6 * 15), 1e-12);
    near(genPlane(1e5, 0.01, 10, 100, 20).T0, 20 + 1e5 * 0.01 / 100 + (1e5 * 0.01 ** 2) / 20, 1e-12);
  });
  it('MT1 Feb 2024 Q3: composite wall with generation in B', () => {
    const qL = (261 - 25) / (1 / 1000 + 0.03 / 25);
    const qR = 1000 * (158 - 25);
    near(25 + qL / 1000, 132.27, 1e-3);
    near(158 + (qR * 0.02) / 50, 211.2, 1e-3);
    const s = slabFromFaces(261, 211.2, 0.06, qL, qR);
    near(s.e, 4.0045e6, 1e-3);
    near(s.k, 15.5, 1e-2);
    near(s.xMax, 0.02679, 2e-3);
  });
});

describe('fins', () => {
  it('Concordia 2021 / McGill 2023 Q2 fin', () => {
    const g = rectFin(0.25, 0.002, 0.15);
    const r = finAnalysis(g, 177, 50, 50, 20, 'adiabatic');
    near(r.m, 16.874, 2e-3);
    near(r.Q, 44.24, 2e-3);
    const c = finAnalysis(g, 177, 50, 50, 20, 'corrected');
    near(c.Q, 44.256, 2e-3);
    near(c.eta, 0.3877, 3e-3);
    near(c.eps, 59.0, 3e-3);
    near(finAnalysis(g, 177, 50, 50, 20, 'infinite').Q, 44.80, 2e-3);
    near(finAnalysis(g, 177, 50, 50, 20, 'convective').Q, 44.256, 2e-3);
  });
  it('3-138 flange (annular fin) efficiency 0.94 and 3-142 pin fins', () => {
    near(etaAnnular(25, 52, 0.02, 0.05, 0.1), 0.9465, 2e-3);
    const g = pinFin(0.0025, 0.03);
    near(finAnalysis(g, 237, 35, 100, 30, 'adiabatic').eta, 0.9347, 2e-3);
  });
  it('pin fin sanity', () => {
    const r = finAnalysis(pinFin(0.005, 0.05), 200, 25, 100, 20, 'adiabatic');
    expect(r.eta).toBeGreaterThan(0.5);
    expect(r.eta).toBeLessThanOrEqual(1);
  });
});

describe('transient conduction (Table 4-2)', () => {
  it('one-term coefficients', () => {
    const rows: [string, number, number, number][] = [
      ['wall', 0.01, 0.0998, 1.0017],
      ['wall', 1, 0.8603, 1.1191],
      ['wall', 5, 1.3138, 1.2402],
      ['wall', 10, 1.4289, 1.262],
      ['cylinder', 1, 1.2558, 1.2071],
      ['cylinder', 0.1, 0.4417, 1.0246],
      ['sphere', 1, 1.5708, 1.2732],
      ['sphere', 0.1, 0.5423, 1.0298],
      ['sphere', 5, 2.5704, 1.787],
    ];
    for (const [g, Bi, l, a] of rows) {
      const lam = lambda1(g as 'wall', Bi);
      near(lam, l, 1e-3);
      near(A1(g as 'wall', lam), a, 1e-3);
    }
  });
  it('MT2 2022 Q1 lumped cylinder: Bi 0.002, t = 179.6 s, Q = 1465 J', () => {
    const r = 0.004;
    const H = 0.01;
    const V = Math.PI * r * r * H;
    const As = 2 * Math.PI * r * r + 2 * Math.PI * r * H;
    const Lc = V / As;
    near(Lc, 0.00143, 5e-3);
    near((75 * Lc) / 54, 0.002, 5e-2);
    const b = lumpedB(75, As, 7833, V, 465);
    near(1 / b, 69.4, 3e-3);
    near(lumpedTime(100, 900, 35, b), 179.6, 3e-3);
    near(7833 * V * 465 * 800, 1464.7, 3e-3);
  });
  it('MT2 2022 Q2 brass cylinder: T = 42.5 C, Q = 42.5 kJ', () => {
    const al = 33.9e-6;
    const t = 900;
    const w = oneTerm('wall', (60 * 0.06) / 90, (al * t) / 0.06 ** 2);
    const c = oneTerm('cylinder', (60 * 0.03) / 90, (al * t) / 0.03 ** 2);
    const th = w.theta0 * spatial('wall', w.lambda, 1) * c.theta0;
    near(25 + 95 * th, 42.49, 1e-3);
    const qw = QoverQmax('wall', w);
    const qc = QoverQmax('cylinder', c);
    const Qmax = 8530 * (Math.PI * 0.03 ** 2 * 0.06) * 380 * 95;
    near((qw + qc * (1 - qw)) * Qmax, 42540, 5e-3);
  });
  it('one-term error vs exact series is small for tau > 0.2', () => {
    const ot = oneTerm('wall', 2, 0.3);
    near(ot.theta0, wallSeries(2, 0.3, 0), 1e-2);
  });
  it('semi-infinite', () => {
    near(semiInfiniteTs(0, 100, 1e-6, 20, 100), 100, 1e-9);
    near(semiInfiniteTs(0.02, 100, 1e-6, 20, 100), 100 - 80 * erf(0.02 / (2 * Math.sqrt(1e-4))), 1e-9);
    const Tc = contactTemp(100, 1, 1, 1, 20, 1, 1, 1);
    near(Tc, 60, 1e-12);
  });
});

describe('convection correlations', () => {
  it('MT2 2022 Q3 flat plate: h = 24.13 W/m2K', () => {
    const Re = (1.145 * 10 * 1.5) / 1.655e-5;
    const { Nu, regime } = cv.NuPlate(Re, 0.7268);
    expect(regime).toBe('mixed');
    near((Nu * 0.02625) / 1.5, 24.13, 1e-3);
    // thickness of insulation for outer surface 45 C
    const h = (Nu * 0.02625) / 1.5;
    const Lins = 0.06 * ((90 - 45) / (h * 15) - 0.005 / 237);
    near(Lins * 1000, 7.46, 5e-3);
  });
  it('tube bank 7-106: Nu = 53.6', () => {
    near(cv.NuBank(5297, 0.7375, 0.7408, 'aligned', 0.015, 0.015, 16), 53.63, 2e-3);
  });
  it('Churchill-Bernstein and Hilpert agree within 15 %', () => {
    const a = cv.NuCylinderCB(10000, 0.72);
    const b = cv.NuCylinderHilpert(10000, 0.72).Nu;
    expect(Math.abs(a - b) / a).toBeLessThan(0.15);
  });
  it('internal flow: laminar constants and Gnielinski vs Dittus-Boelter', () => {
    expect(cv.NuLaminarFD('Ts')).toBe(3.66);
    expect(cv.NuLaminarFD('qs')).toBe(4.36);
    const g = cv.NuGnielinski(50000, 5);
    const d = cv.NuDittusBoelter(50000, 5, true);
    expect(Math.abs(g - d) / g).toBeLessThan(0.15);
    near(cv.frictionPetukhov(1e5), 0.0180, 2e-2);
  });
  it('natural convection: vertical plate in air, Ra ~ 1e8 gives Nu ~ 50', () => {
    const Nu = cv.NuVerticalFull(1e8, 0.72);
    expect(Nu).toBeGreaterThan(40);
    expect(Nu).toBeLessThan(70);
  });
});

describe('heat exchangers', () => {
  it('limits and inverse', () => {
    near(effectiveness('counter', 1, 1), 0.5, 1e-12);
    near(effectiveness('parallel', 100, 0.5), 1 / 1.5, 1e-6);
    near(effectiveness('counter', 2, 0), 1 - Math.exp(-2), 1e-12);
    for (const t of ['parallel', 'counter', 'shell1', 'cross-cmax-mixed', 'cross-cmin-mixed', 'cross-unmixed'] as const) {
      const e = effectiveness(t, 1.3, 0.6);
      near(ntuFromEffectiveness(t, e, 0.6), 1.3, 1e-6);
    }
  });
  it('LMTD and NTU methods agree for a counter-flow exchanger', () => {
    const Ch = 2000;
    const Cc = 4000;
    const UA = 3000;
    const r = rateHX('counter', UA, Ch, Cc, 100, 20);
    const lm = lmtdCounter(100, r.Tho, 20, r.Tco);
    near(UA * lm, r.Q, 1e-6);
    const rp = rateHX('parallel', UA, Ch, Cc, 100, 20);
    near(UA * lmtdParallel(100, rp.Tho, 20, rp.Tco), rp.Q, 1e-6);
    expect(r.Q).toBeGreaterThan(rp.Q);
  });
  it('F factor is 1 when R -> 0', () => {
    near(Fshell1(0.3, 1e-6), 1, 1e-3);
    expect(Fshell1(0.4, 1.5)).toBeLessThan(1);
  });
});

describe('radiation', () => {
  it('band fractions', () => {
    near(bandFraction(2897.8), 0.2501, 2e-3);
    near(bandFraction(5000), 0.6337, 3e-3);
    near(bandFraction(1000000), 1, 1e-4);
  });
  it('view factors', () => {
    near(F_parallelRect(1, 1, 1), 0.1998, 1e-3);
    near(F_perpRect(1, 1, 1), 0.2000, 1e-3);
    near(F_disks(1, 1, 1), 0.3820, 1e-3);
  });
  it('plates and shields', () => {
    const Q = parallelPlates(500, 300, 0.8, 0.8, 1);
    near(Q, (5.67e-8 * (500 ** 4 - 300 ** 4)) / (1 / 0.8 + 1 / 0.8 - 1), 2e-3);
    near(withShields(500, 300, 0.8, 0.8, 0.8, 1, 1), Q * (1.5 / (1.5 + 1.5)), 1e-2);
  });
  it('Example 13-9 triangular duct (reradiating wall)', () => {
    const res = enclosure(
      [
        { A: 1, eps: 0.7, T: 600 },
        { A: 1, eps: 1, T: 1000 },
        { A: 1, eps: 1, Q: 0 },
      ],
      [
        [0, 0.5, 0.5],
        [0.5, 0, 0.5],
        [0.5, 0.5, 0],
      ]
    );
    near(res.Q[0] + res.Q[1], 0, 1e-6);
    near(res.Q[2], 0, 1e-6);
    expect(res.T[2]).toBeGreaterThan(600);
    expect(res.T[2]).toBeLessThan(1000);
  });
  it('Example 13-8 cylindrical furnace (3 surfaces)', () => {
    // top (1) e=0.8 700 K, base (2) e=0.4 500 K, side (3) black 400 K; r0 = H = 1 m
    const r0 = 1;
    const A1 = Math.PI * r0 * r0;
    const A3 = 2 * Math.PI * r0 * 1;
    const F12 = F_disks(1, 1, 1);
    const F13 = 1 - F12;
    const F31 = (A1 * F13) / A3;
    const F33 = 1 - 2 * F31;
    const F = [
      [0, F12, F13],
      [F12, 0, F13],
      [F31, F31, F33],
    ];
    const res = enclosure(
      [
        { A: A1, eps: 0.8, T: 700 },
        { A: A1, eps: 0.4, T: 500 },
        { A: A3, eps: 1, T: 400 },
      ],
      F
    );
    // textbook (Example 13-8): Q1 = 27.6 kW, Q2 = -2.13 kW, Q3 = -25.5 kW
    near(res.Q[0] + res.Q[1] + res.Q[2], 0, 1e-6);
    near(res.Q[0] / 1000, 27.6, 1e-2);
    near(res.Q[1] / 1000, -2.13, 3e-2);
    near(res.Q[2] / 1000, -25.5, 1e-2);
    near(Eb(700), 5.67e-8 * 700 ** 4, 1e-3);
  });
});

describe('pages written after the first test batch (numbers quoted in chapters, practice sets and mock exams)', () => {
  it('MT2 Nov 2023 Q3: oil Hausen Nu and h, exit temperature and heat', () => {
    const Re = (2 * 0.3) / 9.429e-4;
    const Nu = cv.NuHausen(Re, 10863, 0.3, 20);
    near(Nu, 79.15, 2e-3);
    const h = (Nu * 5) / 0.3;
    near(h, 1319, 3e-3);
    const mdot = 888.1 * 2 * (Math.PI * 0.15 ** 2);
    const Te = cv.outletTempConstTs(100, 25, h, Math.PI * 0.3 * 20, mdot, 1880);
    near(Te, 32.5, 3e-3);
    near(mdot * 1880 * (Te - 25), 1.77e6, 3e-3);
    near(cv.NuCylinderCB(105485, 0.7202), 224.5, 3e-3);
  });
  it('MT2 Nov 2023 Q1: lumped sphere', () => {
    const b = 75 / (7833 * 465 * 0.05);
    near(lumpedTime(100, 900, 35, b), 6285, 2e-3);
  });
  it('internal flow example 1 (water, 2 cm tube): Gnielinski and Dittus-Boelter agree within 3 %', () => {
    const Re = 8413;
    const Pr = 3.99;
    const gn = cv.NuGnielinski(Re, Pr);
    const db = cv.NuDittusBoelter(Re, Pr, true);
    near(gn, 54.6, 1e-2);
    near(db, 55.2, 1e-2);
  });
  it('natural convection: vertical wall 2 m (Ra 1.4e10) and pipe', () => {
    const Ra = cv.Rayleigh(1 / 303.15, 20, 2, 1.605e-5, 2.27e-5);
    near(Ra / 1.42e10, 1, 1e-2);
    near(cv.NuVerticalFull(Ra, 0.707), 281.8, 1e-2);
    const Ra2 = cv.Rayleigh(1 / 333.15, 80, 0.1, 1.897e-5, 2.697e-5);
    near(cv.NuHorizontalCylinder(Ra2, 0.703), 22.5, 1e-2);
  });
  it('heat exchangers: oil cooler, rating and the 1-shell limit', () => {
    const r = rateHX('counter', 1200, 4180, 2090, 90, 20);
    near(r.eps, 0.399, 2e-3);
    near(r.Tco, 47.96, 2e-3);
    near(effectiveness('shell1', 1e6, 0.5), 0.7639, 1e-3);
    near(Fshell1(0.375, 4 / 3), 0.8906, 2e-3);
    near(effectiveness('cross-unmixed', 1.458, 0.4513), 0.665, 3e-3);
  });
  it('radiation: Wien band fractions, reradiating duct and shields', () => {
    near(bandFraction(2312) , 0.122, 3e-2);
    near(bandFraction(4046) - bandFraction(2312), 0.367, 1e-2);
    const F12 = F_parallelRect(1, 1, 1);
    const F = [
      [0, F12, 1 - F12],
      [F12, 0, 1 - F12],
      [(1 - F12) / 4, (1 - F12) / 4, 1 - (2 * (1 - F12)) / 4],
    ];
    const r = enclosure([{ A: 1, eps: 0.9, T: 900 }, { A: 1, eps: 0.7, T: 400 }, { A: 4, eps: 1, Q: 0 }], F);
    near(r.Q[0] / 1000, 16.2, 5e-3);
    near(r.T[2], 788, 3e-3);
    near(withShields(600, 300, 0.8, 0.8, 0.1, 1, 1), 336, 5e-3);
  });
});
