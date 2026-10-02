/** Group D regression tests: Ch 12–14 worked examples, PS9, and the Ch 14 airfoil / plume examples. */
import { describe, expect, it } from 'vitest';
import * as ob from './obliqueShock';
import * as pm from './prandtlMeyer';
import * as ise from './isentropic';
import * as ns from './normalShock';
import * as rf from './shockReflection';
import { diamondAirfoil } from './diamondAirfoil';

const near = (actual: number, expected: number, rel = 0.01) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(rel);

describe('Ch 12 oblique shocks (notes examples)', () => {
  it('M = 3, δ = 10°: σ = 27.4°, M2 = 2.50, p2 = 2.055 atm', () => {
    const s = ob.obliqueShock(3, 10);
    near(s.sigma, 27.4, 0.005);
    near(s.Mn1, 1.38, 0.005);
    near(s.M2, 2.5, 0.005);
    near(s.p2_p1, 2.055, 0.005);
  });
  it('δmax(3) = 34.1° at σ = 65.2°, sonic point σ = 63.8°', () => {
    near(ob.deltaMax(3), 34.1, 0.003);
    near(ob.sigmaAtDeltaMax(3), 65.2, 0.003);
    near(ob.sigmaSonic(3), 63.8, 0.003);
  });
  it('regular reflection M = 3 / 10°: σ2 = 31.86°, M3 = 2.08, p3 = 3.83 atm', () => {
    const r = rf.regularReflection(3, 10)!;
    near(r.reflected.sigma, 31.86, 0.005);
    near(r.M3, 2.08, 0.01);
    near(r.p3_p1, 3.83, 0.005);
  });
  it('M = 3 / 30°: regular reflection impossible (M2 = 1.41, δmax ≈ 9.6°)', () => {
    const inc = ob.obliqueShock(3, 30);
    near(inc.sigma, 52, 0.005);
    near(inc.M2, 1.41, 0.005);
    expect(ob.deltaMax(inc.M2)).toBeLessThan(10);
    expect(rf.regularReflection(3, 30)).toBeNull();
  });
  it('Mach reflection M = 3 / 30°: δ3 = 21.4°, δ4 = 8.6°, p = 10.1 atm, σ stem 81.4°, σ refl 60.8°', () => {
    const m = rf.machReflection(3, 30)!;
    near(m.delta3, 21.4, 0.01);
    near(m.delta4, 8.6, 0.01);
    near(m.p_p1, 10.1, 0.01);
    near(m.stem.sigma, 81.4, 0.005);
    near(m.reflected.sigma, 60.8, 0.005);
    near(m.reflected.M2, 1.05, 0.01);
  });
  it('transition criteria at M = 3 (notes §12.6)', () => {
    near(rf.detachmentDelta(3), 21.5, 0.01);
    near(rf.sonicDelta(3), 21.3, 0.01);
    near(rf.vonNeumannDelta(3), 19.7, 0.01);
    near(ob.sigmaFromDelta(3, rf.vonNeumannDelta(3)), 37.4, 0.005);
  });
});

describe('PS9', () => {
  it('P1: δ → 0 gives σ → Mach angle', () => {
    near(ob.sigmaFromDelta(2, 1e-6), 30, 1e-4);
  });
  it('P2: M = 2, δ = 10°', () => {
    const s = ob.obliqueShock(2, 10);
    near(s.sigma, 39.31, 0.002);
    near(s.M2, 1.64, 0.005);
    near(70 * s.p2_p1, 119.4, 0.005);
    near(283 * s.T2_T1, 331.1, 0.005);
    near(70 * ise.p0_p(2), 547.7, 0.002);
    near(70 * ise.p0_p(2) * s.p02_p01, 539.3, 0.003);
    near(ob.sigmaAtDeltaMax(2), 64.67, 0.002);
    near(ob.deltaMax(2), 23.0, 0.005);
  });
  it('P3: M = 3, p2/p1 = 4 → σ = 39.05°, δ = 21.07°', () => {
    const s = ob.sigmaFromPressureRatio(3, 4);
    near(s, 39.05, 0.002);
    near(ob.deltaFromSigma(3, s), 21.07, 0.003);
    near(ns.Mx_from_py_px(4), 1.89, 0.003);
  });
  it('P4: M = 4 wedge 20° + reflection', () => {
    const r = rf.regularReflection(4, 20)!;
    near(r.incident.sigma, 32.5, 0.005);
    near(r.incident.p2_p1, 5.226, 0.01);
    near(r.incident.M2, 2.56, 0.01);
    near(r.reflected.sigma, 42, 0.005);
    near(r.M3, 1.696, 0.01);
    near(r.p3_p1, 17.17, 0.01);
    // Anthony's wrong route: normal-shock table at the full M2 = 2.6
    expect(ns.py_px(2.6)).toBeGreaterThan(7.6);
  });
});

describe('Ch 13 Prandtl–Meyer', () => {
  it('ν_max = 130.45°', () => near(pm.nuMax(), 130.45, 1e-4));
  it('M = 2, θ = 10°: M2 = 2.385, p2/p1 = 0.5477', () => {
    const e = pm.expansion(2, 10);
    near(e.nu1, 26.38, 0.001);
    near(e.M2, 2.385, 0.002);
    near(e.p2_p1, 0.5477, 0.005);
  });
  it('PS10 P1: M = 2, θ = 20°: M2 = 2.83, p2/p1 = 0.275, δmax = 104.07°', () => {
    const e = pm.expansion(2, 20);
    near(e.M2, 2.83, 0.003);
    near(e.p2_p1, 0.275, 0.005);
    near(pm.nuMax() - e.nu1, 104.07, 0.001);
  });
});

describe('Ch 14 plumes and diamond airfoils', () => {
  it('Final A P2(c): over-expanded Raptor lip shock σ = 14.04°, δ = 3.06°', () => {
    const Me = ise.M_from_p_p0(70 / 30000);
    near(Me, 4.8215, 0.001);
    const s = ob.sigmaFromPressureRatio(Me, 100 / 70);
    near(s, 14.04, 0.003);
    near(ob.deltaFromSigma(Me, s), 3.06, 0.01);
  });
  it('Final A P2(d): under-expanded to vacuum turns 55.25°', () => {
    near(pm.nuMax() - pm.nu(4.8215), 55.25, 0.002);
  });
  it('PS10 P2(a): α = 0 → D = 19.2 kN/m, CD = 0.0846', () => {
    const r = diamondAirfoil(1.8, 10, 0);
    near(r.faces[0].p * 100, 166.1, 0.005);
    near(r.faces[1].p * 100, 57.36, 0.005);
    near(r.D * 100, 19.18, 0.005);
    near(r.cd, 0.0846, 0.005);
    expect(Math.abs(r.L)).toBeLessThan(1e-9);
  });
  it('PS10 P2(b): α = 5° → D = 24.9, L = 57.8 kN/m', () => {
    const r = diamondAirfoil(1.8, 10, 5);
    near(r.faces[1].M, 2.3565, 0.002);
    near(r.faces[1].p * 100, 42.0, 0.005);
    near(r.D * 100, 24.89, 0.005);
    near(r.L * 100, 57.84, 0.005);
    near(r.cl, 0.255, 0.005);
    near(r.cd, 0.1097, 0.005);
  });
  it('Final A P3: M = 2, ε = 10°, α = 5° → σ = 34.3°, L ≈ 60.2 kN, D ≈ 26.1 kN', () => {
    const r = diamondAirfoil(2, 10, 5);
    near(r.faces[0].sigma, 34.3, 0.003);
    near(r.faces[0].p * 100, 131.5, 0.005);
    near(r.faces[2].p * 100, 219.5, 0.005);
    near(r.faces[3].p * 100, 75.9, 0.005);
    near(r.L * 100, 60.2, 0.005);
    near(r.D * 100, 26.1, 0.005);
  });
  it('α > ε: upper front face gets an expansion, not a shock', () => {
    const r = diamondAirfoil(3, 5, 8);
    expect(r.faces[0].wave).toBe('fan');
    expect(r.faces[0].p).toBeLessThan(1);
    expect(r.L).toBeGreaterThan(0);
  });
  it('Ackeret check: linear theory within ~10% at PS10 P2(b)', () => {
    const r = diamondAirfoil(1.8, 10, 5);
    near(r.clLinear, r.cl, 0.1);
    near(r.cdLinear, r.cd, 0.1);
  });
});
