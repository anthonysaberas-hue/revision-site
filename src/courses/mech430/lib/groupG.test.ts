import { describe, expect, it } from 'vitest';
import * as ise from './isentropic';
import * as ns from './normalShock';
import * as ob from './obliqueShock';
import * as pm from './prandtlMeyer';
import * as fa from './fanno';
import * as ra from './rayleigh';
import * as un from './unsteady';
import * as inl from './inlet';
import { exitVelocity, optimumAreaRatio } from './rocket';
import { ramjetDesign, ramjetOffDesign } from './ramjet';
import { cjMach, detonation, hugoniotP, rayleighLineP } from './detonation';
import { bisect } from './solve';

const near = (a: number, e: number, rel = 0.01) => expect(Math.abs(a - e) / Math.abs(e)).toBeLessThan(rel);

describe('Final A', () => {
  it('P1 detonation: M = 4.83, T0* = 3031 K, same Rayleigh line across the shock', () => {
    const Q = 4000 / (3 * 300);
    const M = cjMach(Q);
    near(M, 4.826, 2e-3);
    near(300 * ise.T0_T(M), 1697.4, 2e-3);
    near((300 * ise.T0_T(M)) / ra.T0_T0star(M), 3031, 2e-3);
    near(ra.T0_T0star(ns.My(M)), ra.T0_T0star(M), 1e-6);
    const d = detonation(M, Q);
    near(d.end.M, 1, 1e-4);
    near(d.end.p, 14.0, 5e-3);
    // CJ point lies on the burned Hugoniot and on the Rayleigh line
    const v = d.end.T / d.end.p;
    near(hugoniotP(v, Q), d.end.p, 1e-4);
    near(rayleighLineP(v, M), d.end.p, 1e-4);
  });
  it('P2 Merlin vs Raptor', () => {
    const R = 8314 / 17;
    const m = optimumAreaRatio(10e6, 70e3);
    const r = optimumAreaRatio(30e6, 70e3);
    near(m.AR, 10.29, 3e-3);
    near(r.AR, 21.64, 3e-3);
    const ratio = exitVelocity(70e3 / 30e6, 3500, R, 1.4) / exitVelocity(70e3 / 10e6, 3500, R, 1.4);
    near(ratio, 1.0422, 1e-3);
    const sig = ob.sigmaFromPressureRatio(r.Me, 100 / 70);
    near(sig, 14.04, 5e-3);
    near(ob.deltaFromSigma(r.Me, sig), 3.06, 1e-2);
    near(pm.nuMax() - pm.nu(r.Me), 55.25, 3e-3);
  });
  it('P3 diamond airfoil: σ = 34.3°, L ≈ 60 kN, D ≈ 26 kN', () => {
    const r1 = ob.obliqueShock(2, 5);
    const r3 = ob.obliqueShock(2, 15);
    near(r1.sigma, 34.3, 3e-3);
    const p1 = 100 * r1.p2_p1;
    const p3 = 100 * r3.p2_p1;
    const p2 = p1 * pm.expansion(r1.M2, 20).p2_p1;
    const p4 = p3 * pm.expansion(r3.M2, 20).p2_p1;
    const d = Math.PI / 180;
    const A = 0.5 / Math.cos(10 * d);
    const D = A * (Math.sin(5 * d) * (p1 - p4) + Math.sin(15 * d) * (p3 - p2));
    const L = A * (Math.cos(5 * d) * (p4 - p1) + Math.cos(15 * d) * (p3 - p2));
    near(p1, 131.5, 3e-3);
    near(p2, 39.3, 5e-3);
    near(p3, 219.5, 3e-3);
    near(p4, 75.9, 5e-3);
    near(D, 26.1, 1e-2);
    near(L, 60.2, 1e-2);
  });
  it('P4 MOC pressures', () => {
    const n = pm.nu(2);
    const p = (v: number) => (100 * ise.p_p0(pm.M_from_nu(v))) / ise.p_p0(2);
    near(p(n + 7.5), 64.2, 5e-3);
    near(p(n + 15), 39.3, 5e-3);
    near(p(n + 5), 74.7, 5e-3);
    near(p(n + 12.5), 46.5, 5e-3);
    near(p(n + 10), 54.8, 5e-3);
  });
  it('P5 piston pushed and pulled', () => {
    const c1 = Math.sqrt(1.4 * (8314 / 28.9) * 300);
    const Ms = un.Ms_from_up(200 / c1);
    near(Ms, 1.403, 3e-3);
    near(300 * ns.Ty_Tx(Ms), 377, 3e-3);
    near(ns.py_px(Ms), 2.13, 5e-3);
    const ex = un.expansionState(200, c1);
    near(300 * ex.T_T4, 234.9, 2e-3);
    near(ex.p_p4, 0.425, 3e-3);
  });
});

describe('Final B', () => {
  it('P1 inlet', () => {
    near(inl.designAreaRatio(1.4), 1.1149, 1e-3);
    near(inl.startingMach(inl.designAreaRatio(1.4)), 1.583, 3e-3);
    near(inl.unstartMassFlowRatio(1.4), 0.958, 1e-3);
  });
  it('P2 capillary to vacuum (table chain): 0.189 g/s and 2.27 m', () => {
    const A = (Math.PI * 1e-6) / 4;
    near(fa.M_from_fLmax(200, 'sub'), 0.06, 2e-2);
    near(A * ise.massFlux(0.06, 1e6, 300, 8314 / 28.9) * 1e3, 0.189, 3e-3);
    const f = (m: number) => m / Math.pow(1 + 0.2 * m * m, 3);
    near(bisect((m) => f(m) - 2 * f(0.06), 0.01, 0.5), 0.1208, 3e-3);
    near(fa.fLmax(0.12), 45.408, 1e-3);
    near((fa.fLmax(0.12) * 1e-3) / 0.02, 2.2704, 1e-3);
  });
  it('P3 ramjet: A_t 0.46, A_e 1.52 m², F ≈ 33 kN; A-5 not A-2', () => {
    near(ra.p0_p0star(0.34), 1.1822, 1e-3);
    near(ise.A_Astar(0.34), 1.8229, 1e-3);
    const fl = { M0: 3, T: 250, p: 10e3, R: 8314 / 28.9, cp: 1000 };
    const d = ramjetDesign({ ...fl, Ain: 1, Ashock: 0.4, Acomb: 0.6, q: 500e3 });
    near(d.At1, 0.2361, 2e-3);
    near(d.Mx, 2.0, 5e-3);
    near(d.Mc, 0.34, 1e-2);
    near(d.M2, 0.52, 1e-2);
    near(d.At2, 0.46, 1e-2);
    near(d.Ae, 1.52, 1e-2);
    near(d.F, 33e3, 2e-2);
    near(d.qStar, 964e3, 1e-2);
    const geom = { Ain: 1, At1: d.At1, Acomb: 0.6, At2: d.At2, Ae: d.Ae };
    // off-design at the design Δq reproduces the design; 1000 kJ/kg moves the shock forward
    near(ramjetOffDesign(fl, geom, 500e3).F, d.F, 1e-6);
    const o = ramjetOffDesign(fl, geom, 1000e3);
    expect(o.status).toBe('started');
    expect(o.Ashock).toBeLessThan(0.4);
    near(o.qMax, 1472e3, 1e-2);
    expect(ramjetOffDesign(fl, geom, 1600e3).status).toBe('unstart');
  });
  it('P4 wedge airfoil pressures', () => {
    const rA = ob.obliqueShock(2, 15);
    const pA = 100 * rA.p2_p1;
    near(pA, 219.5, 3e-3);
    near(pA * pm.expansion(rA.M2, 40).p2_p1, 19.4, 1e-2);
    near(100 * ob.obliqueShock(2, 5).p2_p1, 131.5, 3e-3);
    near((215.3 * 0.02445) / 0.28449, 18.5, 2e-3);
  });
  it('P5 MOC converging channel pressures', () => {
    const n = pm.nu(3);
    const p = (v: number) => (100 * ise.p_p0(pm.M_from_nu(v))) / ise.p_p0(3);
    near(p(n - 5), 145.4, 5e-3);
    near(p(n - 10), 206.1, 5e-3);
    near(p(n - 15), 285.2, 5e-3);
    near(p(n - 25), 514.0, 5e-3);
    near(p(n - 20), 386.4, 5e-3);
  });
});
