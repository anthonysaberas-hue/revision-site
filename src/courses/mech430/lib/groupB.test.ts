/** Group B regression: key answers of Ch. 7–9, PS5 and PS6 (tolerances match table reading). */
import { describe, expect, it } from 'vitest';
import * as ise from './isentropic';
import * as ns from './normalShock';
import * as un from './unsteady';
import * as inl from './inlet';
import { criticalPressures, solveNozzle } from './nozzle';

const near = (a: number, e: number, rel = 0.01) => expect(Math.abs(a - e) / Math.abs(e)).toBeLessThan(rel);

describe('Ch 7–8 notes examples', () => {
  it('§8.1.1: shock at A = 2 m² in a 1→3 m² nozzle', () => {
    const Mx = ise.M_from_A_Astar(2, 'sup');
    near(Mx, 2.2, 0.01);
    near(ns.My(Mx), 0.547, 0.01);
    const r = ns.p0y_p0x(Mx);
    near(r, 0.628, 0.01);
    near(1 / r, 1.59, 0.01);
    const Mc = ise.M_from_A_Astar(3 * r, 'sub');
    near(Mc, 0.33, 0.02);
    near(r * ise.p_p0(Mc), 0.58, 0.02);
  });
  it('§8.2.1: AR = 3, p_b = 0.7 atm → p3, p4, shock area ≈ 1.64 (notes interpolate 1.67)', () => {
    const c = criticalPressures(3);
    near(c.p3, 0.97, 0.01);
    near(c.pd, 0.047, 0.02);
    near(c.p4, 0.374, 0.01);
    const s = solveNozzle(3, 0.7);
    expect(s.regime).toBe('shock-in-nozzle');
    near(s.As!, 1.67, 0.03);
  });
  it('§8.4.1: Ms = 3 into 300 K air (c = 348 m/s)', () => {
    const m = un.movingShock(3, 348);
    near(m.up, 773.3, 0.002);
    near(m.p2_p1, 10.33, 0.002);
    near(300 * m.T2_T1, 804, 0.002);
    near(m.M2lab, 1.357, 0.002);
  });
  it('strong limits', () => {
    near(ns.My(1e4), 0.378, 0.002);
    near(ns.rhoy_rhox(1e4), 6, 0.002);
  });
});

describe('Ch 9 notes examples', () => {
  it('inlet designed for M 1.5: A_t/A_in = 0.850, starts at 1.83, opens to 0.914', () => {
    near(1 / inl.designAreaRatio(1.5), 0.85, 0.002);
    near(inl.startingMach(inl.designAreaRatio(1.5)), 1.83, 0.005);
    near(inl.startingThroatRatio(1.5), 0.914, 0.003);
    near(ns.p0y_p0x(1.45), 0.9448, 0.002);
  });
  it('Kantrowitz asymptote: A/A*(0.378) = 1.666 ↔ design M 1.98', () => {
    const a = ise.A_Astar(Math.sqrt(0.4 / 2.8));
    near(a, 1.666, 0.002);
    near(ise.M_from_A_Astar(a, 'sup'), 1.98, 0.005);
  });
  it('Shinkansen: 83.3 m/s → Ms 1.154, py/px 1.39; 3 psi → 45.8 m/s; tunnel 1.22 and 1.66 A_train', () => {
    const Ms = un.Ms_from_up(83.3 / 348);
    near(Ms, 1.154, 0.002);
    near(ns.py_px(Ms), 1.39, 0.005);
    const Ms2 = ns.Mx_from_py_px(17.7 / 14.7);
    near(Ms2, 1.082, 0.003);
    near(un.up_over_c1(Ms2) * 348, 45.8, 0.03);
    const AA = ise.A_Astar(0.105);
    near(AA / (AA - 1), 1.22, 0.01);
    near(ise.A_Astar(0.24), 2.5, 0.01);
  });
  it('exams: W2023 start 1.39, ṁ ratio 0.979; Final B 1.1149 → 1.58, 0.958', () => {
    near(inl.startingMach(ise.A_Astar(1.3)), 1.4, 0.01);
    near(inl.unstartMassFlowRatio(1.3), 0.979, 0.002);
    near(ise.A_Astar(1.4), 1.1149, 0.002);
    near(inl.startingMach(ise.A_Astar(1.4)), 1.59, 0.01);
    near(inl.unstartMassFlowRatio(1.4), 0.958, 0.002);
  });
});

describe('PS5', () => {
  it('P2: 1000 m/s shocks in Ar, F2, CO2', () => {
    const run = (MW: number, g: number) => {
      const Mx = 1000 / Math.sqrt(g * (8314 / MW) * 300);
      return { Mx, My: ns.My(Mx, g), Ty: 300 * ns.Ty_Tx(Mx, g), py: ns.py_px(Mx, g), r: ns.p0y_p0x(Mx, g) };
    };
    const ar = run(40, 1.67);
    near(ar.Mx, 3.099, 0.003);
    near(ar.Ty, 1160.7, 0.003);
    near(ar.r, 0.4035, 0.003);
    const f2 = run(38, 1.4);
    near(f2.My, 0.4596, 0.003);
    near(f2.py, 12.53, 0.003);
    near(f2.r, 0.2535, 0.003);
    const co2 = run(44, 1.28);
    near(co2.Ty, 858.7, 0.003);
    near(co2.py, 15.35, 0.003);
    near(co2.r, 0.1254, 0.003);
  });
  it('P3: Me = 3 nozzle — AR 4.2346, 36.73, shock at A/A* ≈ 2.49, Me ≈ 0.27, 3.57', () => {
    const AR = ise.A_Astar(3);
    near(AR, 4.2346, 0.001);
    near(ise.p0_p(3), 36.73, 0.001);
    const s = solveNozzle(AR, 0.5);
    near(s.As!, 2.49, 0.01);
    near(s.Me, 0.27, 0.02);
    near(1 / criticalPressures(AR).p4, 3.57, 0.01);
  });
  it('P4: px/p0y = 45/445 → M 2.70, V ≈ 864 m/s', () => {
    const M = ns.Mx_from_p0y_px(445 / 45);
    near(M, 2.7, 0.003);
    near(M * Math.sqrt(1.4 * (8314.5 / 28.8) * 253.15), 864, 0.005);
  });
});

describe('PS6', () => {
  it('P1: Mach 4 tunnel needs A_t2/A_t1 ≥ 7.20', () => {
    near(inl.secondThroatRatio(4), 7.2046, 0.002);
  });
  it('P2: SR-71 inlet at M 1.75 → A_in/A_t = 1.157, slows to 1.475', () => {
    const AinAt = 1 / inl.startingThroatRatio(1.75);
    near(AinAt, 1.157, 0.002);
    near(ise.M_from_A_Astar(AinAt, 'sup'), 1.475, 0.005);
  });
});
