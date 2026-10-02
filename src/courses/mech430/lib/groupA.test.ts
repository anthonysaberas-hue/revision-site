/** Group A regression tests: key answers of Ch 4–6 worked examples and PS1–PS4. */
import { describe, expect, it } from 'vitest';
import * as ise from './isentropic';
import { exitVelocity, infiniteNozzleVe, optimumAreaRatio, rocket } from './rocket';
import { gasR, soundSpeed } from './gas';

const near = (actual: number, expected: number, rel = 0.01) => expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(rel);

describe('Ch 4 / PS1: speed of sound', () => {
  it('PS1 P6 gases at 293 K', () => {
    near(soundSpeed(1.67, gasR(4), 293), 1008);
    near(soundSpeed(1.67, gasR(40), 293), 319);
    near(soundSpeed(1.4, gasR(28), 293), 349);
    near(soundSpeed(1.28, gasR(44), 293), 266);
    near(soundSpeed(1.09, gasR(146), 293), 135);
  });
  it('PS1 P7 Yeager vs Green', () => {
    near(soundSpeed(1.4, 287, 216), 295);
    near(soundSpeed(1.4, 287, 303), 349);
  });
  it('Mach angle at M = 2 is 30°', () => near(ise.machAngle(2), 30, 1e-6));
});

describe('Ch 5: worked examples', () => {
  it('notes §5.2.1: 500 K, 5 atm, M 0.75 and 2', () => {
    near(500 * ise.T_T0(0.75), 449);
    near(5 * ise.p_p0(0.75), 3.44);
    near(500 * ise.T_T0(2), 278);
    near(5 * ise.p_p0(2), 0.639);
  });
  it('notes §5.5.1: p0 = 1 atm, A* = 0.746, A2 = 0.774, station 3 both roots', () => {
    const As = 1 / ise.A_Astar(0.5);
    near(0.843 * ise.p0_p(0.5), 1.0);
    near(As, 0.746);
    near(As * ise.A_Astar(0.8), 0.774);
    near(ise.M_from_A_Astar(1.5 / As, 'sub'), 0.304);
    near(ise.M_from_A_Astar(1.5 / As, 'sup'), 2.202);
  });
  it('Jan 27: A2 = 2.48 m² (corrected), T2 = 194 K, p2 = 0.218 bar', () => {
    const M1 = 700 / soundSpeed(1.4, gasR(28.9), 300);
    near(M1, 2.014);
    const As = 1 / ise.A_Astar(M1);
    near(As * ise.A_Astar(3), 2.48);
    near(300 * ise.T0_T(M1) * ise.T_T0(3), 194);
    near(ise.p0_p(M1) * ise.p_p0(3), 0.218);
  });
  it('Fliegner constants: air 0.0404, N2 0.0397', () => {
    near(ise.massFlux(1, 1, 1, 287), 0.0404, 3e-3);
    near(ise.massFlux(1, 1, 1, gasR(28)), 0.0397, 3e-3);
  });
});

describe('Ch 6: nozzles and rockets', () => {
  it('Feb 5 window: M = 0.347, A* = 0.558, supersonic root 2.07, p = 0.1146', () => {
    const M = ise.M_from_p_p0(0.92);
    near(M, 0.347);
    near(1 / ise.A_Astar(M), 0.558);
    const Ms = ise.M_from_A_Astar(ise.A_Astar(M), 'sup');
    near(Ms, 2.07);
    near(ise.p_p0(Ms), 0.1146);
  });
  it('NERVA: Isp 7366, 8009, 9343, AR 3.74; AR 500 → 9178', () => {
    const atm = 101325;
    const R = gasR(2);
    near(exitVelocity(1 / 30, 3000, R, 1.4), 7366);
    near(optimumAreaRatio(30 * atm, atm).AR, 3.74);
    const sp = rocket({ p0: 30 * atm, T0: 3000, R, g: 1.4, At: 1, AR: optimumAreaRatio(30 * atm, atm).AR, pa: 0 });
    near(sp.Isp, 8009);
    near(infiniteNozzleVe(3000, R, 1.4), 9343);
    near(rocket({ p0: 30 * atm, T0: 3000, R, g: 1.4, At: 1, AR: 500, pa: 0 }).Isp, 9178);
  });
});

describe('PS2', () => {
  it('P3: M1 1.795, p0 399 kPa, M2 2.34, V2 693', () => {
    const M1 = 600 / soundSpeed(1.4, 287.058, 278);
    near(M1, 1.795);
    const p0 = 70 * ise.p0_p(M1);
    near(p0, 399);
    const M2 = ise.M_from_p_p0(30 / p0);
    near(M2, 2.34);
    near(M2 * soundSpeed(1.4, 287.058, 278 * ise.T0_T(M1) * ise.T_T0(M2)), 693);
  });
  it('P4: CO2 γ = 1.3, M2 = 1.67, T2 = 244.6 K', () => {
    const g = 1.3;
    const M1 = 200 / soundSpeed(g, gasR(44), 323);
    const M2 = ise.M_from_p_p0(15 / (50 * ise.p0_p(M1, g)), g);
    near(M2, 1.674);
    near(323 * ise.T0_T(M1, g) * ise.T_T0(M2, g), 244.6);
  });
  it('P5: ṁ 0.817, ṁ_max 0.854, V_max 395', () => {
    const R = gasR(28);
    const M = ise.M_from_p_p0(1 / 1.5);
    const T = 450 * ise.T_T0(M);
    near(M * soundSpeed(1.4, R, T), 320);
    near((101325 / (R * T)) * M * soundSpeed(1.4, R, T) * 0.003, 0.817);
    near(ise.chokedMassFlow(0.003, 1.5 * 101325, 450, R), 0.854);
    near(soundSpeed(1.4, R, 375), 394.8);
  });
  it('P6 area ratio 0.492; P7 D2 = 18.4 cm; P8 A/A* 10.72; P9 A2 3.70 cm²; P10 A* 18 cm²', () => {
    near(ise.A_Astar(0.95) / ise.A_Astar(0.3), 0.492);
    const R = gasR(28.9);
    const M1 = 240 / soundSpeed(1.4, R, 333.15);
    const M2 = ise.M_from_p_p0(85 / (70 * ise.p0_p(M1)));
    near(15 * Math.sqrt(ise.A_Astar(M2) / ise.A_Astar(M1)), 18.4);
    near(ise.A_Astar(4), 10.72);
    near(0.005 / ise.A_Astar(4.298) * ise.A_Astar(1.2) * 1e4, 3.7);
    near(0.05 / ise.A_Astar(12 / soundSpeed(1.4, gasR(28), 800)), 0.0018);
  });
});

describe('PS3 & PS4', () => {
  it('PS3 P2: M_e 3.36, V_e 1420, A_t 18.8 cm², A_e 112 cm²', () => {
    const R = gasR(28);
    const Me = ise.M_from_p_p0(40 / 2500);
    near(Me, 3.36);
    near(exitVelocity(40 / 2500, 1400, R, 1.4), 1420);
    const At = 5 / ise.massFlux(1, 2.5e6, 1400, R);
    near(At, 0.00188);
    near(At * ise.A_Astar(Me), 0.0112);
  });
  it('PS3 P3: airliner p0 0.421 atm, valve p* 0.137 atm', () => {
    near(0.26 * ise.p0_p(0.86), 0.421);
    near(0.26 * ise.pstar_p0(), 0.137);
  });
  it('PS3 P4: p0 1.0096 / 47.6 atm, ṁ 238 / 11 230 kg/s', () => {
    const Ms = ise.M_from_A_Astar(5, 'sub');
    const Mp = ise.M_from_A_Astar(5, 'sup');
    near(ise.p0_p(Ms), 1.0096, 2e-3);
    near(ise.p0_p(Mp), 47.6);
    near(ise.chokedMassFlow(1, ise.p0_p(Ms) * 101325, 300, 288.7), 238);
    near(ise.chokedMassFlow(1, ise.p0_p(Mp) * 101325, 300, 288.7), 11230);
  });
  it('PS3 P5: H2 V_max 9343 m/s', () => near(infiniteNozzleVe(3000, gasR(2), 1.4), 9343));
  it('PS4 P3: ratios 0.904 and 0.838', () => {
    const AR = optimumAreaRatio(2e6, 1e5).AR;
    const sl = rocket({ p0: 2e6, T0: 1500, R: 300, g: 1.4, At: 1, AR, pa: 1e5 });
    const sp = rocket({ p0: 2e6, T0: 1500, R: 300, g: 1.4, At: 1, AR, pa: 0 });
    near(sl.F / sp.F, 0.904, 3e-3);
    near(sp.Isp / infiniteNozzleVe(1500, 300, 1.4), 0.838, 3e-3);
  });
});
