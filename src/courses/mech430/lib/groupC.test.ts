/** Group C regression tests: Fanno (Ch 10, PS7) and Rayleigh (Ch 11, PS8) worked answers. */
import { describe, expect, it } from 'vitest';
import * as fa from './fanno';
import * as ra from './rayleigh';
import * as is from './isentropic';
import * as ns from './normalShock';
import { solveNozzlePipe } from './nozzlePipe';

const near = (a: number, b: number, rel = 0.02) => expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(rel);

describe('Ch 10 Fanno: notes examples', () => {
  it('supersonic limit 0.8215', () => near(fa.fLmaxInfinity(), 0.8215, 1e-3));
  it('§10.2.1: M1 = 0.5 → L* = 2.67 m, L = 1.5 m → M2 = 0.61', () => {
    near((fa.fLmax(0.5) * 0.05) / 0.02, 2.67, 0.01);
    near(fa.fannoDuct(0.5, (4 * 0.005 * 1.5) / 0.05).M2, 0.61, 0.01);
  });
  it('§10.4.1 ladder 700 / 408 / 331 / 177 kPa and p_b = 350 → M_exit 0.738', () => {
    const p0 = 101.3 / is.p_p0(2);
    const s = solveNozzlePipe(is.A_Astar(2), (4 * 0.005 * 3.5) / 0.3, 350 / p0);
    near(s.thresholds.pbChoke! * p0, 700, 0.01);
    near(s.thresholds.pbShockAtPipeEntrance! * p0, 408, 0.01);
    near(s.thresholds.pbShockAtExit! * p0, 331, 0.01);
    near(s.thresholds.peSupersonic! * p0, 177, 0.01);
    expect(s.regime).toBe('shock-in-pipe');
    near(s.M2, 0.738, 0.01);
  });
});

describe('PS7', () => {
  it('P2: f = 0.00385', () => {
    const M = 200 / Math.sqrt(1.4 * (8314 / 28.8) * 303.15);
    near((fa.fLmax(M) * 0.02) / (4 * 0.8), 0.00385, 0.01);
  });
  it('P3: L = 3.62 m', () => near(((fa.fLmax(3) - fa.fLmax(1.5)) * 0.075) / 0.008, 3.62, 0.01));
  it('P4: p_b = 2.72 atm for a shock at the duct exit', () => {
    const M1 = is.M_from_A_Astar(3, 'sup');
    const d = fa.fannoDuct(M1, 0.3);
    near(d.M2, 1.57, 0.01);
    near(10 * is.p_p0(M1) * d.p2_p1 * ns.py_px(d.M2), 2.717, 0.01);
  });
  it('P5: M_exit = 0.775 from p*, shock between 28D and 30D', () => {
    const pStar = (300 * is.p_p0(3)) / fa.p_pstar(3);
    near(pStar, 37.42, 0.005);
    near(fa.M_from_p_pstar(50 / pStar), 0.775, 0.01);
    const s = solveNozzlePipe(is.A_Astar(3), 0.6, 50 / 300);
    const xD = s.shockLoc! * 60;
    expect(xD).toBeGreaterThan(28);
    expect(xD).toBeLessThan(30);
    near(s.M2, 0.775, 0.01);
  });
  it('P6: 68.7 kPa matched, 176 kPa shock at exit', () => {
    const d = fa.fannoDuct(2.25, 0.225);
    near(40 * d.p2_p1, 68.7, 0.01);
    near(40 * d.p2_p1 * ns.py_px(d.M2), 176.3, 0.01);
  });
});

describe('Ch 11 Rayleigh', () => {
  it('T max at 1/√γ, T/T* = 1.0286', () => {
    near(ra.M_Tmax(), 0.845, 0.001);
    near(ra.T_Tstar(ra.M_Tmax()), 1.0286, 0.001);
  });
  it('§11.2.1: M1 = 0.7 → q* = 33.3 kJ/kg', () => {
    const T01 = 300 * is.T0_T(0.7);
    near(ra.rayleighHeat(0.7, T01, 0, 1003.5).qStar / 1000, 33.3, 0.01);
  });
  it('Quiz 2 W2024 P2: M2 = 0.86, then M_in = 0.65', () => {
    const T01 = 300 * is.T0_T(0.75);
    near(ra.rayleighHeat(0.75, T01, 15000, 1000).M2, 0.86, 0.01);
    near(ra.M_from_T0_T0star(T01 / (T01 + 50), 'sub'), 0.65, 0.01);
  });
});

describe('PS8', () => {
  it('P1: q_max formula agrees with T0*', () => {
    const M = 2;
    const formula = (M * M - 1) ** 2 / (2 * M * M * 2.4);
    near(formula, is.T0_T(M) * (1 / ra.T0_T0star(M) - 1), 1e-9);
    near(1 / ra.T0_T0star(1e4) - 1, 1 / (1.4 * 1.4 - 1), 1e-3);
  });
  it('P2: M2 = 0.166, T2 = 352 K, p2 = 198.7 kPa', () => {
    const T01 = 293 * is.T0_T(0.15);
    const r = ra.rayleighHeat(0.15, T01, 60000, 1005);
    near(r.M2, 0.166, 0.01);
    near(293 * r.T2_T1, 352.2, 0.005);
    near(200 * r.p2_p1, 198.7, 0.005);
  });
  it('P3: q* = 235 kJ/kg, identical with a shock at the entrance (812 K is table rounding)', () => {
    const a = ra.rayleighHeat(2.5, 573, 0, 1005);
    near(a.T0star, 807, 0.005);
    near(12 / ra.p0_p0star(2.5), 5.40, 0.005);
    near(a.qStar / 1000, 235.2, 0.01);
    const b = ra.rayleighHeat(ns.My(2.5), 573, 0, 1005);
    near(b.T0star, a.T0star, 1e-6);
    near(b.T0star, 811.8, 0.01); // table answer within table-reading tolerance
  });
  it('P4: M_y = 0.686, q = 163.5 kJ/kg', () => {
    const M1 = is.M_from_A_Astar(4, 'sup');
    const Ts = (450 * is.T_T0(M1)) / ra.T_Tstar(M1);
    const T0s = 450 / ra.T0_T0star(M1);
    const My = ra.M_from_T_Tstar(560 / Ts, 'sub-low');
    near(My, 0.686, 0.01);
    const Mx = ns.My(My);
    near(Mx, 1.544, 0.01);
    near(1.005 * (T0s * ra.T0_T0star(Mx) - 450), 163.5, 0.01);
  });
});
