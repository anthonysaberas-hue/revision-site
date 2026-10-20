import { describe, expect, it } from 'vitest';
import { water, r134a } from './props';
import { heatingValues, SPECIES, vantHoff } from './gas';
import { brayton, braytonVariable, turbojet, rankine } from './cycles';
import { vcr, flashTwoStage, gasRefrigeration } from './refrig';
import { omegaFromWetBulb, omega, phiOf, hAir, vAir, Tdp, mixStreams, psyState, wetBulb } from './psychro';
import { mixtureFromMoles } from './mixtures';
import { burn, dewPoint, steadyQ, closedQMoles, aft } from './combustion';
import { equilibrium, lnKpAt } from './equilibrium';
import { stagnationT, T0_T, P0_P, areaRatio, machFromAreaRatio, soundSpeed, critical } from './compressible';
import { leeKesler, kay } from './realgas';
import ref from './realgasRef.json';

/** |a - b| <= rel * max(1, |b|) */
const near = (a: number, b: number, rel = 1e-3) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe('cycles', () => {
  it('9-95 Brayton with efficiencies', () => {
    const r = brayton({ T1: 313.15, rp: 16, T3: 1681.98, etaC: 0.85, etaT: 0.88, cp: 1.108, k: 1.35 });
    near(r.T4, 923.15, 1e-3);
    near(r.wnet * 15.763, 6484, 2e-3);
    near(r.rbw, 0.511, 3e-3);
    near(r.eta, 0.378, 3e-3);
  });
  it('9-136 / 9-137 turbojet', () => {
    const a = turbojet({ Ta: 241.15, Pa: 32, V: 280, mdot: 50, rc: 12, T04: 1100 });
    near(a.Ve, 832.5, 2e-3);
    near(a.Wp, 7735, 2e-3);
    const b = turbojet({ Ta: 241.15, Pa: 32, V: 280, mdot: 50, rc: 12, T04: 1100, etaC: 0.8, etaT: 0.85 });
    near(b.Ve, 677.4, 2e-3);
    near(b.Wp, 5563, 2e-3);
  });
  const fin = { Ta: 223.26, Pa: 26.5, V: 270, mdot: 0.5, rc: 15, T04: 1400, etaC: 0.85, etaT: 0.9, cpg: 1.147, kg: 1.333, f: 0.020636 };
  it('2021 final P1 turbojet (CD nozzle, fuel mass ignored / included, converging nozzle)', () => {
    const r = turbojet(fin);
    near(r.Ma, 0.9015, 2e-3);
    near(r.ramRatio, 1.6936, 2e-3);
    near(r.T03, 616.1, 2e-3);
    near(r.Wc, 179.18, 2e-3);
    near(r.P05, 215.2, 2e-3);
    near(r.Ve, 1008.1, 2e-3);
    near(r.Fmom, 379.46, 2e-3);
    near(r.Fpres, 0, 2e-3);
    near(turbojet({ ...fin, fuelMassInTurbine: true }).Ve, 1015.9, 2e-3);
    const c = turbojet({ ...fin, nozzle: 'C' });
    expect(c.choked).toBe(true);
    near(c.Pe, c.Pcrit, 1e-9);
    expect(c.Pe).toBeGreaterThan(fin.Pa);
  });
  it('10-55 Rankine with a closed FWH (drain back)', () => {
    const r = rankine({ Pb: 3000, Tb: 350, Pc: 20, cfwh: { P: 1000, drain: 'back' } });
    near(r.y, 0.2437, 2e-3);
    near(r.wT, 740.9, 2e-3);
    near(r.wP, 3.03, 2e-3);
    near(r.qin, 2352.5, 2e-3);
  });
  it('10-98 Rankine with an open FWH and efficiencies', () => {
    const r = rankine({ Pb: 10000, Tb: 500, Pc: 10, ofwh: { P: 500 }, etaT: 0.8, etaP: 0.95, Wnet: 150000 });
    near(r.y, 0.1718, 3e-3);
    near(r.mdot, 159.67, 3e-3);
    near(r.eta, 0.3449, 3e-3);
  });
  it('Ex. 9-5 variable-cp Brayton', () => {
    const r = braytonVariable({ T1: 300, rp: 8, T3: 1300 });
    near(r.h2s, 544.35, 3e-3);
    near(r.h4s, 789.37, 3e-3);
  });
});

describe('properties (2021 final P4, range flags)', () => {
  it('steam states', () => {
    const a = water.PT(1600, 300);
    near(a.h, 3035.4, 1e-3);
    near(a.s, 6.8863, 1e-3);
    near(water.Ps(200, 6.8863).h, 2611.6, 1e-3);
    const c = water.Ps(10, 6.8863);
    near(c.h, 2181.2, 1e-3);
    near(c.x as number, 0.8317, 1e-3);
  });
  it('out-of-range flag', () => {
    expect(water.PT(100, 1400).outOfRange).toBe(true);
    expect(water.PT(70000, 500).outOfRange).toBe(true);
    expect(r134a.PT(5000, 100).outOfRange).toBe(true);
    expect(water.PT(100, 300).outOfRange).toBeUndefined();
  });
});

describe('refrigeration', () => {
  it('11-21 vapour compression with superheat, subcooling, etaC', () => {
    const r = vcr({ PL: 200, PH: 1400, superheat: 10.1, subcool: 4.4, etaC: 0.88, mdot: 0.025 });
    near(r.QL, 3.318, 3e-3);
    near(r.W, 1.217, 3e-3);
    near(r.COPR, 2.725, 3e-3);
  });
  it('11-46 explicit states', () => {
    const r = vcr({ PL: 280, PH: 1000, T1: 0, T2actual: 60, T3: 30, QH: 60000 / 3600 });
    near(r.mdot, 0.08341, 3e-3);
    near(r.W, 3.549, 3e-3);
    near(r.QL, 13.117, 3e-3);
  });
  it('11-60 two-stage with flash chamber', () => {
    const r = flashTwoStage({ PH: 800, Pm: r134a.Psat(-10.1), PL: r134a.Psat(-40), QL: 30 });
    near(r.mL, 0.1601, 3e-3);
    near(r.mH, 0.2303, 3e-3);
    near(r.W, 10.94, 3e-3);
    near(r.COP, 2.743, 3e-3);
  });
  it('flash-chamber layout still runs', () => {
    const r = flashTwoStage({ PH: 800, Pm: r134a.Psat(-10.1), PL: r134a.Psat(-40), QL: 30, layout: 'flash' });
    expect(r.COP).toBeGreaterThan(0);
    near(r.mH, r.mL / (1 - r.x6), 1e-12);
  });
  it('11-79 gas refrigeration with regenerator', () => {
    const r = gasRefrigeration({ rp: 5, T1: 273.15, T3: 308.15, T5: 193.15, etaC: 0.8, etaT: 0.85, mdot: 0.4 });
    near(r.T2, 472.5, 3e-3);
    near(r.T4, 281.3, 3e-3);
    near(r.eps, 0.434, 3e-3);
    near(r.QL, 21.36, 3e-3);
    near(r.COP, 0.478, 3e-3);
  });
});

describe('psychrometrics', () => {
  const P = 101.325;
  it('14-102 wet-bulb and adiabatic mixing', () => {
    const w = omegaFromWetBulb(36, 30, P);
    near(w, 0.02462, 3e-3);
    near(hAir(36, 0.02462), 99.38, 3e-3);
    const w2 = omega(12, 1, P);
    const m = mixStreams({ ma: 8, w, h: hAir(36, w) }, { ma: 10, w: w2, h: hAir(12, w2) }, P);
    near(m.T, 22.83, 3e-3);
    near(m.phi, 0.902, 3e-3);
  });
  it('2021 final P5 at 100 kPa', () => {
    near(omega(30, 0.7, 100), 0.019058, 3e-3);
    near(omega(25, 0.4, 100), 0.007988, 3e-3);
    near(Tdp(0.007988, 100), 10.48, 3e-3);
  });
  it('14-32 at 95 kPa (non-atmospheric pressure)', () => {
    const w = omegaFromWetBulb(25, 17, 95);
    // brief range was 0.0092-0.0096; Eq. 14-14 gives 0.00963 and CoolProp HAPropsSI gives 0.00967 (phi 0.457)
    expect(w).toBeGreaterThan(0.0092);
    expect(w).toBeLessThan(0.0098);
    near(w, 0.009674, 5e-3); // CoolProp humid air
    const phi = phiOf(25, w, 95);
    expect(phi).toBeGreaterThan(0.44);
    expect(phi).toBeLessThan(0.48);
  });
  it('14-132 volume flow', () => {
    near(4 / vAir(30, omega(30, 0.7, P), P), 4.522, 3e-3);
  });
  it('wetBulb inverts omegaFromWetBulb; psyState is self-consistent', () => {
    near(wetBulb(36, omegaFromWetBulb(36, 30, P), P), 30, 1e-6);
    const s = psyState({ T: 25, P: 95, phi: 0.5 });
    near(s.Twb, wetBulb(25, s.w, 95), 1e-9);
    near(s.Tdp, Tdp(s.w, 95), 1e-9);
  });
});

describe('mixtures', () => {
  it('13-62 equimolar He-Ar', () => {
    const m = mixtureFromMoles({ He: 1, Ar: 1 });
    near(m.M, 21.98, 2e-3);
    near(m.cp, 0.9458, 2e-3);
    near(m.k, 1.6666, 2e-3);
  });
  it('13-34 air (79/21) plus 0.05 kmol O2 per kmol air', () => {
    near(mixtureFromMoles({ N2: 0.79, O2: 0.26 }).M, 28.99, 1e-3);
  });
});

describe('combustion', () => {
  it('15-59 propane with 159.9 % theoretical air', () => {
    const b = burn({ fuel: [[1, 'C3H8']], theoAir: 1.599 });
    near(b.products.N2, 3.76 * 1.599 * 5, 1e-9);
    // brief says 'N 51.1'; N2 is 30.06 and total products 40.06 kmol (the 46.0 C dew point only fits 40.06)
    near(b.Nprod, 40.06, 1e-3);
    near(dewPoint(b.products, 101.325), 46.0, 5e-3);
    near(steadyQ({ fuel: [[1, 'C3H8']], theoAir: 1.599, Tfuel: 298.15, Tair: 298.15, Tprod: 46.0 + 273.15 }), 2.018e6, 5e-3);
  });
  it('15-67 fuel mixture (40 % propane, 60 % methane), stoichiometric', () => {
    const fuel: [number, string][] = [[0.4, 'C3H8'], [0.6, 'CH4']];
    const b = burn({ fuel, theoAir: 1 });
    near(dewPoint(b.products, 101.325), 56.7, 5e-3);
    near(b.AF, 16.18, 3e-3);
    near(steadyQ({ fuel, theoAir: 1, Tfuel: 298.15, Tair: 298.15, Tprod: 398.15 }), 1.2473e6, 5e-3);
  });
  it('15-79 adiabatic flame temperature with heat loss', () => {
    near(aft({ fuel: [[1, 'C2H2']], theoAir: 1.3, Tfuel: 298.15, Tair: 300.15, Qloss: 75000 }), 2302, 3e-3);
  });
  it('15-68 constant-volume tank, CH4 + O2 to 1200 K', () => {
    const q = closedQMoles([[0.0075, 'CH4'], [0.01875, 'O2']], 298.15, [[0.0075, 'CO2'], [0.015, 'H2O'], [0.00375, 'O2']], 1200);
    near(q, 5251, 5e-3);
  });
  it('2021 final P2 flame temperature of decane with preheated air', () => {
    near(aft({ fuel: [[1, 'C10H22']], theoAir: 49.849 / 15.5, Tfuel: 298.15, Tair: 616.1 }), 1364, 5e-3);
  });
  it('heating values of methane', () => {
    const h = heatingValues(SPECIES.CH4);
    near(h.HHV, 55530, 5e-3);
    near(h.LHV, 50050, 5e-3);
  });
  it('liquid fuel enthalpy uses hf(liquid); CO fraction moves carbon', () => {
    const g = steadyQ({ fuel: [[1, 'C3H8']], theoAir: 1, Tfuel: 298.15, Tair: 298.15, Tprod: 298.15 });
    const l = steadyQ({ fuel: [[1, 'C3H8_l']], theoAir: 1, Tfuel: 298.15, Tair: 298.15, Tprod: 298.15 });
    near(g - l, SPECIES.C3H8.M * (SPECIES.C3H8.hfg as number), 1e-6);
    const b = burn({ fuel: [[1, 'CH4']], theoAir: 1.2, coFraction: 0.1 });
    near(b.products.CO, 0.1, 1e-12);
    near(b.products.CO2, 0.9, 1e-12);
  });
});

describe('equilibrium', () => {
  it('16-31 NO from air at 2 atm', () => {
    const r = equilibrium({ lnK: -3.931, reac: [[0.5, 'N2'], [0.5, 'O2']], prod: [[1, 'NO']], initial: { N2: 3.76, O2: 1 }, P: 2 });
    near(r.NO, 0.0376, 1e-2);
  });
  it('16-40 O2 dissociation', () => {
    const r = equilibrium({ lnK: -4.357, reac: [[1, 'O2']], prod: [[2, 'O']], initial: { O2: 1 }, P: 1 });
    near(r.O, 0.113, 1e-2);
  });
  it('16-33 methane decomposition with a condensed species', () => {
    const r = equilibrium({ lnK: 2.328, reac: [[1, 'C'], [2, 'H2']], prod: [[1, 'CH4']], initial: { CH4: 1 }, inert: { N2: 1 }, condensed: ['C'], P: 1 });
    near(r.CH4, 0.7934, 3e-3);
  });
  it('Kp from the A-28 data and van t Hoff', () => {
    expect(Math.abs(lnKpAt('CO₂ ⇌ CO + ½O₂', 4000) - 1.6)).toBeLessThan(0.05);
    expect(Math.abs(lnKpAt('½N₂ + ½O₂ ⇌ NO', 2000) + 3.93)).toBeLessThan(0.05);
    near(vantHoff(-6.635, 2000, -3.86, 2400), 276850, 2e-3);
  });
});

describe('compressible flow', () => {
  it('17-62 air at 420 K, 500 kPa, 110 m/s: stagnation and critical conditions', () => {
    // inputs reconstructed from the brief outputs (T0 426.0, T* 355.0, P* 277.6, A*/A1 0.4434)
    const k = 1.4;
    const T0 = stagnationT(420, 110, 1.005);
    near(T0, 426.0, 2e-3);
    near(T0 * critical(k).T, 355.0, 2e-3);
    const Ma = 110 / soundSpeed(420, 0.287, k);
    const P0 = 500 * P0_P(Ma, k);
    near(P0 * critical(k).P, 277.6, 2e-3);
    near(1 / areaRatio(Ma, k), 0.4434, 2e-3);
    near(T0_T(Ma, k) * 420, T0, 2e-3);
  });
  it('17-18 CO2 nozzle: Ma1, V2, Ma2', () => {
    const k = 1.289, R = 0.1889, cp = 0.846;
    near(50 / soundSpeed(800, R, k), 0.1133, 2e-3);
    const T0 = stagnationT(800, 50, cp);
    const V2 = Math.sqrt(2000 * cp * (T0 - 400));
    near(V2, 824.2, 2e-3);
    near(V2 / soundSpeed(400, R, k), 2.641, 2e-3);
  });
  it('area-Mach inversion', () => {
    near(machFromAreaRatio(2.2553, 1.4, 'sub'), 0.2678, 2e-3);
    near(areaRatio(machFromAreaRatio(2.2553, 1.4, 'sup'), 1.4), 2.2553, 1e-9);
    near(P0_P(1, 1.4), 1.8929, 1e-3);
  });
});

describe('real gas (Lee-Kesler)', () => {
  it('critical point and low-pressure limit', () => {
    expect(Math.abs(leeKesler(1, 1).Z - 0.29)).toBeLessThan(0.01);
    for (const Tr of [0.9, 1.5, 3]) {
      const r = leeKesler(Tr, 1e-4);
      expect(Math.abs(r.Z - 1)).toBeLessThan(1e-3);
      expect(Math.abs(r.Zh)).toBeLessThan(1e-3);
    }
  });
  it('agrees with CoolProp argon (vapour / supercritical)', () => {
    let wz = 0, wh = 0, ws = 0;
    for (const p of ref as { Tr: number; Pr: number; Z: number; Zh: number; Zs: number }[]) {
      const r = leeKesler(p.Tr, p.Pr);
      wz = Math.max(wz, Math.abs(r.Z - p.Z));
      wh = Math.max(wh, Math.abs(r.Zh - p.Zh));
      ws = Math.max(ws, Math.abs(r.Zs - p.Zs));
    }
    console.log('leeKesler vs argon worst', { wz, wh, ws });
    expect(wz).toBeLessThan(0.02);
    expect(wh).toBeLessThan(0.08);
  });
  it('Kay rule', () => {
    const r = kay({ N2: 0.5, CO2: 0.5 });
    near(r.Tcr, 0.5 * 126.2 + 0.5 * 304.2, 1e-9);
  });
});
