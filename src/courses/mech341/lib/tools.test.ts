/** The presets of the eight calculators (sims/toolsA.tsx, toolsB.tsx) reproduce the "check against" values on the tool pages. */
import { describe, expect, it } from 'vitest';
import { water, r134a } from './props';
import { A28, lnKp, hR, vantHoff } from './gas';
import { brayton, turbojet, rankine } from './cycles';
import { vcr, flashTwoStage, gasRefrigeration } from './refrig';
import { omegaFromWetBulb, omega, mixStreams, hAir, psyState, Tdp } from './psychro';
import { burn, dewPoint, steadyQ, aft } from './combustion';
import { equilibrium } from './equilibrium';
import { T0_T, P0_P, areaRatio, critical, machFromAreaRatio } from './compressible';

const near = (a: number, b: number, rel = 1e-3) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe('tool presets', () => {
  it('props: 2021 final P4 h1 3035.4 and state 4 (2181.2, x 0.8317); R-134a sat vapor at 200 kPa', () => {
    near(water.PT(1600, 300).h, 3035.4, 1e-3);
    const s4 = water.Ps(10, 6.8863);
    near(s4.h, 2181.2, 1e-3);
    near(s4.x as number, 0.8317, 1e-3);
    const g = r134a.Px(200, 1);
    near(g.h, 244.5, 2e-3);
    near(g.T, -10.1, 1e-2);
  });
  it('brayton: 9-95 6484 kW; 9-136 832.5 m/s, 27625 N, 7735 kW', () => {
    const r = brayton({ T1: 313.15, rp: 16, T3: 1681.98, etaC: 0.85, etaT: 0.88, cp: 1.108, k: 1.35 });
    near(r.wnet * 15.763, 6484, 2e-3);
    const j = turbojet({ Ta: 241.15, Pa: 32, V: 280, mdot: 50, rc: 12, T04: 1100, nozzle: 'CD' });
    near(j.Ve, 832.5, 2e-3);
    near(j.F, 27625, 2e-3);
    near(j.Wp, 7735, 2e-3);
  });
  it('rankine: 10-55 and 10-98', () => {
    const a = rankine({ Pb: 3000, Tb: 350, Pc: 20, cfwh: { P: 1000, drain: 'back' }, mdot: 1 });
    near(a.wT, 740.9, 2e-3);
    near(a.wP, 3.03, 2e-3);
    near(a.qin, 2352.5, 2e-3);
    const b = rankine({ Pb: 10000, Tb: 500, Pc: 10, ofwh: { P: 500 }, etaT: 0.8, etaP: 0.95, Wnet: 150000 });
    near(b.mdot, 159.67, 3e-3);
  });
  it('refrigeration: 11-21 COP 2.72; 11-60 0.160 / 0.230; 11-79 COP 0.478', () => {
    near(vcr({ PL: 200, PH: 1400, superheat: 10.1, subcool: 4.4, etaC: 0.88, mdot: 0.025 }).COPR, 2.725, 3e-3);
    const t = flashTwoStage({ PH: 800, Pm: r134a.Psat(-10.1), PL: r134a.Psat(-40), QL: 30, layout: 'separator' });
    near(t.mL, 0.1601, 3e-3);
    near(t.mH, 0.2303, 3e-3);
    near(gasRefrigeration({ rp: 5, T1: 273.15, T3: 308.15, T5: 193.15, etaC: 0.8, etaT: 0.85, mdot: 0.4 }).COP, 0.478, 3e-3);
  });
  it('psychro: 14-102 22.8 C; 2021 P5 T2 10.5 C and 12.0 kW; P6 at 95 kPa runs', () => {
    const w = omegaFromWetBulb(36, 30, 101.325);
    const w2 = omega(12, 1, 101.325);
    near(mixStreams({ ma: 8, w, h: hAir(36, w) }, { ma: 10, w: w2, h: hAir(12, w2) }, 101.325).T, 22.83, 3e-3);
    const w3 = omega(25, 0.4, 100);
    near(Tdp(w3, 100), 10.48, 3e-3);
    const s1 = psyState({ T: 30, P: 100, phi: 0.7 });
    const s2 = psyState({ T: Tdp(w3, 100), P: 100, phi: 1 });
    const ma = (11 * 211) / (s1.h - s2.h - (s1.w - s2.w) * water.satT(s2.T).hf);
    near(ma, 48.6, 3e-3);
    const hg = water.satT(100).hg;
    const a = psyState({ T: 10, P: 95, phi: 0.7 });
    const b = psyState({ T: 20, P: 95, phi: 0.6 });
    expect(b.h - a.h - (b.w - a.w) * hg).toBeGreaterThan(0);
  });
  it('combustion: 15-59 Tdp 46.0; 15-79 2302 K; mixture AF 16.18', () => {
    const b = burn({ fuel: [[1, 'C3H8']], theoAir: 1.599 });
    near(dewPoint(b.products, 101.325), 46.0, 5e-3);
    near(steadyQ({ fuel: [[1, 'C3H8']], theoAir: 1.599, Tfuel: 298.15, Tair: 298.15, Tprod: 319.15 }), 2.018e6, 6e-3);
    near(aft({ fuel: [[1, 'C2H2']], theoAir: 1.3, Tfuel: 298.15, Tair: 300.15, Qloss: 75000 }), 2302, 3e-3);
    near(burn({ fuel: [[0.4, 'C3H8'], [0.6, 'CH4']], theoAir: 1 }).AF, 16.18, 3e-3);
  });
  it('equilibrium: 16-31 NO 0.0376 with the computed ln Kp; 16-56 van t Hoff 276 856', () => {
    const rx = A28.find((r) => r.label === '½N₂ + ½O₂ ⇌ NO')!;
    const args = { reac: rx.reac as [number, string][], prod: rx.prod as [number, string][], initial: { N2: 3.76, O2: 1, NO: 0 }, P: 2 };
    near(equilibrium({ lnK: -3.931, ...args }).NO, 0.0376, 5e-3); // preset: table value typed in
    near(equilibrium({ lnK: lnKp(rx, 2000), ...args }).NO, 0.0382, 5e-3); // computed from the Gibbs data
    near(equilibrium({ lnK: lnKp(rx, 2000), ...args, P: 20 }).NO, equilibrium({ lnK: lnKp(rx, 2000), ...args }).NO, 1e-6);
    const co2 = A28.find((r) => r.label === 'CO₂ ⇌ CO + ½O₂')!;
    near(vantHoff(-6.635, 2000, -3.86, 2400), 276856, 2e-3);
    near(hR(co2, 2200), 276860, 1e-3);
  });
  it('nozzle: 17-62 T* 355, A*/A 0.443; 17-18 Ma2 2.64', () => {
    const k = 1.4;
    const Ma = 110 / Math.sqrt(k * 287 * 420);
    near((420 * T0_T(Ma, k)) * critical(k).T, 355.0, 2e-3);
    near((500 * P0_P(Ma, k)) * critical(k).P, 277.6, 2e-3);
    near(1 / areaRatio(Ma, k), 0.4434, 2e-3);
    const k2 = 1.289;
    const Ma1 = 50 / Math.sqrt(k2 * 188.9 * 800);
    const T0 = 800 * T0_T(Ma1, k2);
    near(Math.sqrt((2 / (k2 - 1)) * (T0 / 400 - 1)), 2.64, 2e-3);
    near(areaRatio(machFromAreaRatio(2, 1.4, 'sup'), 1.4), 2, 1e-9);
  });
});
