import { describe, expect, it } from 'vitest';
import * as ise from './isentropic';
import * as ns from './normalShock';
import * as ob from './obliqueShock';
import * as pm from './prandtlMeyer';
import * as fa from './fanno';
import * as ra from './rayleigh';
import * as un from './unsteady';
import { criticalPressures, solveNozzle } from './nozzle';
import { solveNozzlePipe } from './nozzlePipe';
import * as inlet from './inlet';
import { exitVelocity, infiniteNozzleVe, optimumAreaRatio } from './rocket';
import { gasR } from './gas';

/** relative closeness */
const near = (actual: number, expected: number, rel = 0.005) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(rel);

describe('isentropic (Table A2)', () => {
  it('sonic ratios', () => {
    near(ise.pstar_p0(), 0.5283, 1e-3);
    near(ise.Tstar_T0(), 0.8333, 1e-3);
    near(ise.rhostar_rho0(), 0.6339, 1e-3);
  });
  it('M = 2 row', () => {
    near(ise.p_p0(2), 0.1278, 1e-3);
    near(ise.A_Astar(2), 1.6875, 1e-3);
  });
  it('area-Mach inverse, both branches (notes §5.5: A/A* = 1.5/0.746)', () => {
    const r = 1.5 / 0.746;
    near(ise.M_from_A_Astar(r, 'sub'), 0.304, 5e-3);
    near(ise.M_from_A_Astar(r, 'sup'), 2.202, 5e-3);
  });
  it('Fliegner: ṁ/A* = 0.0404 p0/√T0 for air', () => {
    near(ise.massFlux(1, 1, 1, 287), 0.0404, 3e-3);
  });
});

describe('normal shock (Table A3)', () => {
  it('Mx = 3', () => {
    near(ns.My(3), 0.4752, 1e-3);
    near(ns.py_px(3), 10.33, 1e-3);
    near(ns.Ty_Tx(3), 2.679, 1e-3);
    near(ns.p0y_p0x(3), 0.3283, 1e-3);
  });
  it('inverses', () => {
    near(ns.Mx_from_p0y_p0x(0.3283), 3, 1e-3);
    near(ns.Mx_from_My(0.4752), 3, 1e-3);
    near(ns.Mx_from_py_px(10.333), 3, 1e-3);
  });
  it('strong-shock density limit → 6', () => near(ns.rhoy_rhox(1000), 6, 1e-3));
});

describe('oblique shock', () => {
  it('M = 3, δ = 10° → σ = 27.4°, M2 = 2.50, p2/p1 = 2.055', () => {
    const r = ob.obliqueShock(3, 10);
    near(r.sigma, 27.38, 3e-3);
    near(r.M2, 2.505, 5e-3);
    near(r.p2_p1, 2.055, 5e-3);
  });
  it('δmax(M=3) = 34.07° at σ = 65.24°, closed form matches numeric', () => {
    near(ob.deltaMax(3), 34.07, 2e-3);
    near(ob.sigmaAtDeltaMax(3), 65.24, 2e-3);
    near(ob.deltaMaxNumeric(3).delta, ob.deltaMax(3), 1e-6);
  });
  it('detached when δ > δmax', () => expect(ob.obliqueShock(2, 25).detached).toBe(true));
});

describe('Prandtl–Meyer (Table A6)', () => {
  it('ν(2) = 26.38°, ν(3) = 49.76°, νmax = 130.45°', () => {
    near(pm.nu(2), 26.38, 1e-3);
    near(pm.nu(3), 49.76, 1e-3);
    near(pm.nuMax(), 130.45, 1e-3);
  });
  it('M = 2 turned 10° → M2 = 2.385, p2/p1 = 0.5477', () => {
    const r = pm.expansion(2, 10);
    near(r.M2, 2.385, 2e-3);
    near(r.p2_p1, 0.5477, 3e-3);
  });
});

describe('Fanno (Table A4)', () => {
  it('supersonic limit 0.8215', () => near(fa.fLmaxInfinity(), 0.8215, 1e-3));
  it('notes §10.2: M = 0.5, D = 5 cm, f = 0.005 → L* = 2.67 m; L = 1.5 m → M2 = 0.61', () => {
    const Lstar = (fa.fLmax(0.5) * 0.05) / (4 * 0.005);
    near(Lstar, 2.67, 3e-3);
    near(fa.fannoDuct(0.5, (4 * 0.005 * 1.5) / 0.05).M2, 0.61, 1e-2);
  });
  it('F2023 Q2 P2: tank-fed duct with 4fL/D = 20 → M_in ≈ 0.17', () => {
    near(fa.M_from_fLmax(20, 'sub'), 0.17, 0.05);
  });
  it('Final B P2: 4fL/D = 200 → M1 ≈ 0.06', () => near(fa.M_from_fLmax(200, 'sub'), 0.06, 0.05));
});

describe('Rayleigh (Table A5)', () => {
  it('M = 0.7 row and Tmax at 1/√γ', () => {
    near(ra.T0_T0star(0.7), 0.9085, 2e-3);
    near(ra.M_Tmax(), 0.845, 1e-3);
  });
  it('W2024 Q2 P2: M1 = 0.75, 300 K, cp = 1 kJ/kgK, q = 15 kJ/kg → M2 ≈ 0.86', () => {
    const T01 = 300 * ise.T0_T(0.75);
    const r = ra.rayleighHeat(0.75, T01, 15e3, 1000);
    expect(r.choked).toBe(false);
    near(r.M2, 0.86, 0.01);
    // q = 50 kJ/kg exceeds q* → thermal choking
    expect(ra.rayleighHeat(0.75, T01, 50e3, 1000).choked).toBe(true);
  });
});

describe('unsteady', () => {
  const c1 = Math.sqrt(1.4 * 287 * 300);
  it('notes §8.4: Ms = 3 into 300 K air → Vp = 773 m/s, p2/p1 = 10.33, T2 = 804 K, M2lab = 1.357', () => {
    const s = un.movingShock(3, c1);
    near(s.up, 773.3, 3e-3);
    near(s.p2_p1, 10.33, 1e-3);
    near(300 * s.T2_T1, 804, 3e-3);
    near(s.M2lab, 1.357, 3e-3);
  });
  it('inverse: Ms from piston velocity', () => near(un.Ms_from_up(773.3 / c1), 3, 2e-3));
  it('PS11 P1: lab-frame supersonic behind shock at Ms = 2.068', () => near(un.movingShock(2.068, c1).M2lab, 1, 5e-3));
  it('escape velocity 5c0 for γ = 1.4', () => near(un.uEscape(1), 5, 1e-9));
  it('shock tube round trip', () => {
    const st = un.shockTube({ p4_p1: 10, g1: 1.4, g4: 1.4, c1, c4: c1 });
    near(un.p4_p1_from_p2_p1(st.p2_p1, 1.4, 1.4, 1), 10, 1e-6);
    near(st.p3_p4 * 10, st.p2_p1, 1e-6);
  });
});

describe('C-D nozzle (notes §8.2.1, AR = 3)', () => {
  it('critical pressures p3 = 0.97, pd = 0.047, p4 = 0.374', () => {
    const c = criticalPressures(3);
    near(c.p3, 0.97, 5e-3);
    near(c.pd, 0.0471, 1e-2);
    near(c.p4, 0.374, 1e-2);
  });
  it('pb = 0.7 → shock at A ≈ 1.67 At', () => {
    const s = solveNozzle(3, 0.7);
    expect(s.regime).toBe('shock-in-nozzle');
    near(s.As!, 1.67, 0.025); // notes iterate with table rows
  });
  it('notes §8.1: shock at A = 2 (AR 3) → exit M = 0.33, pe = 0.58', () => {
    const Mx = ise.M_from_A_Astar(2, 'sup');
    const r = ns.p0y_p0x(Mx);
    const Me = ise.M_from_A_Astar(3 * r, 'sub');
    near(Me, 0.33, 0.02);
    near(r * ise.p_p0(Me), 0.58, 0.02);
  });
});

describe('Exams — nozzle + Fanno pipe', () => {
  it('Quiz 2 W2023 P2: AR 3, 4fL/D = 0.2, p0 = 500 kPa → 153 / 177.6 / 483 kPa', () => {
    const s = solveNozzlePipe(3, 0.2, 0.5);
    near(s.thresholds.pbShockAtExit! * 500, 153, 0.015);
    near(s.thresholds.pbShockAtPipeEntrance! * 500, 177.6, 0.015);
    near(s.thresholds.pbChoke! * 500, 483, 0.01);
    // ṁ = 76 kg/s (D = 0.5 m, At = A/3, T0 = 300 K)
    near(ise.chokedMassFlow((Math.PI * 0.25 ** 2) / 3, 500e3, 300, 287), 76, 0.01);
  });
  it('Quiz 2 W2024 P1: AR 4, 4fL/D = 0.75, pb = 200/1000 → shock in pipe x ≈ 0.10 m, Mx ≈ 2.5, M_exit ≈ 0.7', () => {
    const s = solveNozzlePipe(4, 0.75, 0.2);
    expect(s.thresholds.supersonicPossible).toBe(false);
    expect(s.regime).toBe('shock-in-pipe');
    near(s.shockLoc! * 0.75, 0.1, 0.25);
    near(s.Mx!, 2.5, 0.06); // official iterates on coarse table rows
    near(s.M2, 0.7, 0.05);
    near(ise.chokedMassFlow((Math.PI * 0.01 ** 2) / 4, 1e6, 500, gasR(30)), 0.145, 0.01);
  });
  it('Quiz 2 W2019 P3: AR 5, 4fL/D = 1.2, pb = 1/10 → exit choked, shock just inside pipe, pe ≈ 1.02 bar', () => {
    const s = solveNozzlePipe(5, 1.2, 0.1);
    expect(s.regime).toBe('shock-limited-choked-exit');
    expect(s.shockWhere).toBe('pipe');
    near(s.pe * 10, 1.02, 0.045); // exact: p_e = p*_supersonic = 1.059 bar (p* is unchanged across a Fanno shock)
    near(s.pe * 10, 1.059, 0.005);
  });
});

describe('Exams — inlets and wind tunnels', () => {
  it('Quiz 2 W2019 P1: M = 1.5 diffuser starts at Mx = 1.83; throat +7.55%', () => {
    near(inlet.startingMach(inlet.designAreaRatio(1.5)), 1.83, 0.01);
    near(inlet.throatOpeningFactor(1.5) - 1, 0.0755, 0.02);
  });
  it('Quiz 2 W2023 P1: M = 1.3 inlet starts at 1.4; spill ratio 0.979', () => {
    near(inlet.startingMach(inlet.designAreaRatio(1.3)), 1.4, 0.02);
    near(inlet.unstartMassFlowRatio(1.3), 0.979, 2e-3);
  });
  it('Final B P1: M = 1.4 design → A/At = 1.115, start at 1.59, spill 0.958', () => {
    near(inlet.designAreaRatio(1.4), 1.115, 3e-3);
    near(inlet.startingMach(inlet.designAreaRatio(1.4)), 1.59, 0.01);
    near(inlet.unstartMassFlowRatio(1.4), 0.958, 2e-3);
  });
  it('notes §9.2: fixed inlet cannot start by overspeed beyond M ≈ 1.98', () => {
    // at M_design = 1.98 the starting Mach runs away
    expect(inlet.startingMach(inlet.designAreaRatio(1.9))).toBeGreaterThan(3);
  });
  it('Quiz 2 F2023 P1: two-throat channel, A*y = 1.5 A*x → p0y/p0x = 0.667 → Mx = 2.11; ṁ = 0.237 kg/s', () => {
    near(ns.Mx_from_p0y_p0x(1 / 1.5), 2.11, 0.02);
    near(ise.chokedMassFlow(1e-4, 10e5, 300, 287), 0.237, 0.02);
  });
});

describe('Rockets', () => {
  it('NERVA (notes §6.3.4): H2, T0 3000 K, p0 30 atm → AR 3.74, Isp 7366 / 8009 / 9343 m/s', () => {
    const R = gasR(2);
    const opt = optimumAreaRatio(30, 1, 1.4);
    near(opt.Me, 2.87, 5e-3);
    near(opt.AR, 3.74, 5e-3);
    const Ve = exitVelocity(1 / 30, 3000, R, 1.4);
    near(Ve, 7366, 3e-3);
    // in space: + Ae·pe/ṁ;  ṁ/At = massFlux*, Ae = AR·At
    const pe = 1 * 101325;
    const mdotPerAt = ise.massFlux(1, 30 * 101325, 3000, R);
    near(Ve + (opt.AR * pe) / mdotPerAt, 8009, 3e-3);
    near(infiniteNozzleVe(3000, R, 1.4), 9343, 3e-3);
  });
  it('Quiz 2 W2019 P2: sea-level/vacuum thrust 0.866 (fixed nozzle) and 0.693 (infinite nozzle)', () => {
    const p0 = 1000e3, T0 = 2000, R = 300, g = 1.4, pa = 101.325e3;
    const opt = optimumAreaRatio(p0, pa, g);
    const mdotPerAt = ise.massFlux(1, p0, T0, R, g);
    const Ve = exitVelocity(pa / p0, T0, R, g);
    const Fsl = mdotPerAt * Ve;
    const Fvac = Fsl + opt.AR * pa;
    near(Fsl / Fvac, 0.866, 0.01);
    near(Fsl / (mdotPerAt * infiniteNozzleVe(T0, R, g)), 0.693, 0.01);
  });
});
