/** Group F: every final answer of the four Quiz 2 walkthroughs, reproduced with the lib. */
import { describe, expect, it } from 'vitest';
import * as ise from './isentropic';
import * as ns from './normalShock';
import * as fa from './fanno';
import * as ra from './rayleigh';
import * as inlet from './inlet';
import { shockAt, solveNozzlePipe } from './nozzlePipe';
import { exitVelocity, infiniteNozzleVe } from './rocket';
import { gasR } from './gas';
import { twoThroatSolution } from './twoThroat';

const near = (actual: number, expected: number, rel = 0.01) => expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(rel);

describe('Q2 W2019', () => {
  it('P1 diffuser: A/A* = 1.1762, My = 0.61, Mx = 1.83, throat +7.55 %', () => {
    near(ise.A_Astar(1.5), 1.1762, 1e-3);
    near(ise.M_from_A_Astar(1.1762, 'sub'), 0.61, 0.005);
    near(inlet.startingMach(ise.A_Astar(1.5)), 1.83, 0.005);
    near(inlet.throatOpeningFactor(1.5), 1.0755, 1e-3);
  });
  it('P2 rocket: Me 2.149, Te 1039.7 K, Ve 1420 m/s, ratios 0.866 and 0.693', () => {
    const p0 = 1000e3, pa = 101.3e3, T0 = 2000, R = 300;
    const Me = ise.M_from_p_p0(pa / p0);
    near(Me, 2.149, 2e-3);
    const Te = T0 * ise.T_T0(Me);
    near(Te, 1039.7, 1e-3);
    const Ve = exitVelocity(pa / p0, T0, R, 1.4);
    near(Ve, 1420.1, 1e-3);
    near((pa / (R * Te)) * Ve, 461.2, 2e-3); // ṁ/A_e
    near((R * Te) / Ve, 219.65, 2e-3);
    near(Ve / (Ve + (R * Te) / Ve), 0.866, 2e-3);
    near(Ve / infiniteNozzleVe(T0, R, 1.4), 0.693, 2e-3);
  });
  it('P3 nozzle + Fanno: 4fL/D = 1.2, L* < L, entrance shock gives 1.57 bar, exit choked at p* = 1.057 bar', () => {
    near((4 * 0.02 * 1.5) / 0.1, 1.2, 1e-9);
    const M1 = ise.M_from_A_Astar(5, 'sup');
    expect(fa.fLmax(M1)).toBeLessThan(1.2);
    near(fa.fLmax(3.0), 0.522, 2e-3); // the table row the official used
    // subsonic branch: p_exit ≈ 9.8 bar ≫ 1 bar
    const s = solveNozzlePipe(5, 1.2, 0.1);
    near(s.thresholds.pbChoke! * 10, 9.79, 0.01);
    near(s.thresholds.pbShockAtPipeEntrance! * 10, 1.57, 0.015);
    expect(s.regime).toBe('shock-limited-choked-exit');
    near(s.pe * 10, 1.057, 2e-3);
    // p* of the Fanno line = 0.5283 p0 · A_t/A_pipe, independent of the shock position
    near(s.pe, ise.pstar_p0() / 5, 1e-3);
    near(s.pe * 10, 1.02, 0.045); // official answer
    // exact shock position 4f·x/D ≈ 0.068 (x ≈ 0.085 m); table-row working gives 0.02–0.05
    near(s.shockLoc! * 1.2, 0.0677, 0.02);
    // official table iterations: 0.522 − guess → Mx → My → L*y vs remaining
    for (const [g, ok] of [[0.2, false], [0.1, false], [0.05, false], [0.02, true]] as const) {
      const My = ns.My(fa.M_from_fLmax(0.522 - g, 'sup'));
      expect(fa.fLmax(My) > 1.2 - g).toBe(ok);
    }
    // the M_exit slip: 4fL*/D = 0.2509 is M ≈ 0.68, not 0.2497
    near(fa.M_from_fLmax(0.2509, 'sub'), 0.68, 0.005);
  });
});

describe('Q2 W2023', () => {
  it('P1 inlet: start at M ≈ 1.4, unstarted/started ṁ = 0.979', () => {
    near(ise.A_Astar(1.3), 1.0663, 1e-3);
    near(inlet.startingMach(ise.A_Astar(1.3)), 1.4, 0.01);
    near(inlet.unstartMassFlowRatio(1.3), 0.979, 1e-3);
  });
  it('P2: 153 / 177.6 / 483 kPa; ṁ = 75.08 kg/s with MW 28 (76.14 with the slipped 28.8)', () => {
    const s = solveNozzlePipe(3, 0.2, 0.5);
    near(s.thresholds.pbShockAtExit! * 500, 153, 0.01);
    near(s.thresholds.pbShockAtPipeEntrance! * 500, 177.55, 0.005);
    near(s.thresholds.pbChoke! * 500, 483.2, 0.005);
    const At = (Math.PI * 0.5 ** 2) / 4 / 3;
    near(ise.chokedMassFlow(At, 500e3, 300, gasR(28)), 75.08, 1e-3);
    near(ise.chokedMassFlow(At, 500e3, 300, gasR(28.8)), 76.14, 1e-3);
  });
});

describe('Q2 F2023', () => {
  it('P1 two throats: ṁ = 0.237 kg/s, Mx = 2.11, p_inter ≈ 6.5 bar', () => {
    near(ise.chokedMassFlow(1e-4, 10e5, 300, gasR(30)), 0.237, 3e-3);
    expect(0.5).toBeLessThan(ise.pstar_p0());
    const t = twoThroatSolution(1, 1.5, 5, 0.5);
    near(t.Mx1, 2.11, 0.01);
    expect(ise.A_Astar(t.Mx1)).toBeLessThan(5); // shock lies inside the first diverging part
    near(t.blocked.Minter, 0.18, 0.03);
    near(10 * t.blocked.pInter, 6.5, 0.01);
    near(10 * (2 / 3) * ise.p_p0(0.2), 6.48, 0.005); // official, with the M = 0.2 row
    near(10 * ise.p_p0(ise.M_from_A_Astar(5, 'sub')), 9.9, 0.01); // subsonic test
    near(10 * ise.p_p0(ise.M_from_A_Astar(5, 'sup')), 0.21, 0.05); // supersonic test
    expect(t.blocked.shockAreas[1]).toBeGreaterThan(1.5);
    expect(t.blocked.shockAreas[1]).toBeLessThan(5);
  });
  it('P2 tank duct: 4fL/D = 20 → M1 = 0.17, p* ≈ 1.53 bar > 1 bar, M2 = 1, ṁ ≈ 0.07 kg/s', () => {
    const M1 = fa.M_from_fLmax(20, 'sub');
    near(M1, 0.17, 0.03);
    near((10 * ise.p_p0(0.17)) / fa.p_pstar(0.17), 1.525, 2e-3);
    expect((10 * ise.p_p0(M1)) / fa.p_pstar(M1)).toBeGreaterThan(1);
    near(1e-4 * ise.massFlux(0.17, 10e5, 300, gasR(30)), 0.0686, 3e-3);
    near(1e-4 * ise.massFlux(M1, 10e5, 300, gasR(30)), 0.07, 0.01);
    // optional check: M1 = 0.15 gives a subsonic exit at 5.65 bar ≠ 1 bar
    near(10 * ise.p_p0(0.15) * fa.fannoDuct(0.15, 20).p2_p1, 5.65, 0.015);
  });
});

describe('Q2 W2024', () => {
  it('P1: ṁ = 0.145 kg/s; shock at x ≈ 0.1 m (exact 0.114); exit 200 kPa, ≈ 455 K, M ≈ 0.7', () => {
    near(ise.chokedMassFlow((Math.PI * 0.01 ** 2) / 4, 1e6, 500, gasR(30)), 0.145, 0.005);
    // subsonic test: ≈ 984 kPa ≫ 200
    near(solveNozzlePipe(4, 0.75, 0.2).thresholds.pbChoke! * 1000, 974, 0.012);
    near(fa.fLmax(ise.M_from_A_Astar(4, 'sup')), 0.5129, 1e-3);
    near(shockAt(1, 4, 0.75).pe * 1000, 233.5, 0.01);
    near(shockAt(1 + 0.2 / 0.75, 4, 0.75).pe * 1000, 168, 0.015);
    const s = solveNozzlePipe(4, 0.75, 0.2);
    near(s.shockLoc! * 0.75, 0.114, 0.02);
    near(s.Mx!, 2.35, 0.01);
    near(s.M2, 0.7, 0.02);
    near((500 / 1.2) * fa.T_Tstar(s.M2), 454.5, 0.01);
  });
  it('P2 Rayleigh: q* = 21.3 kJ/kg; 15 kJ/kg → M2 ≈ 0.86, p2 ≈ 88 kPa, T2 ≈ 304 K; 50 kJ/kg → M_in ≈ 0.65', () => {
    const T01 = 300 * ise.T0_T(0.75);
    near(T01, 333.7, 1e-3);
    const a = ra.rayleighHeat(0.75, T01, 15e3, 1000);
    near(a.qStar, 21.26e3, 3e-3);
    near(a.M2, 0.86, 0.01);
    near(100 * a.p2_p1, 87.82, 0.01);
    near(300 * a.T2_T1, 304.3, 3e-3);
    expect(ra.rayleighHeat(0.75, T01, 50e3, 1000).choked).toBe(true);
    near(ra.M_from_T0_T0star(T01 / (T01 + 50), 'sub'), 0.65, 0.005);
  });
});
