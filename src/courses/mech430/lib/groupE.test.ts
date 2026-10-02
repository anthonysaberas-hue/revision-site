/** Group E regression tests: Ch. 15 MOC (PS10 P3–P4, Final A P4, Final B P5, notes examples) and Ch. 16 unsteady waves (PS11, Final A P5). */
import { describe, expect, it } from 'vitest';
import { buildChannelNet, concaveWall, interiorPoint, MOC_PRESETS, stateFromMTheta, wallPoint } from './moc';
import { designForT5, driverRatio, pistonSolution, pistonProfile, projectileBase, reflectedFromIncident, shockTubeProfile, shockTubeWaves, steadyVmax } from './waves1d';
import { Ms_from_up, movingShock, reflectedShock, shockTube } from './unsteady';
import { expansion } from './prandtlMeyer';
import { GASES, gasR, soundSpeed } from './gas';
import { bisect } from './solve';

const near = (actual: number, expected: number, rel = 0.01) =>
  expect(Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-9)).toBeLessThan(rel);
const nearAbs = (actual: number, expected: number, tol = 0.02) => expect(Math.abs(actual - expected)).toBeLessThan(tol);

describe('MOC point procedures (notes §15.3)', () => {
  const p1 = stateFromMTheta(2, 20);
  const p2 = stateFromMTheta(2.1, 5);
  it('invariants of the two known points', () => {
    nearAbs(p1.CI, 46.38);
    nearAbs(p1.CII, 6.38);
    nearAbs(p2.CII, 24.1, 0.05); // notes: 24.07 (table ν(2.1) = 29.07)
  });
  it('interior point 3: θ3 = 11.15°, ν3 = 35.22°, M3 = 2.34', () => {
    const p3 = interiorPoint(p1, p2);
    nearAbs(p3.theta, 11.15, 0.05);
    nearAbs(p3.nu, 35.22, 0.05);
    near(p3.M, 2.34, 0.01);
    nearAbs(p3.mu, 25.3, 0.1);
  });
  it('wall point 4 (θ_wall = 13°) from C_II = 6.38 → ν4 = 19.38°, M4 = 1.75', () => {
    const p4 = wallPoint(p1, 13, 'upper');
    nearAbs(p4.nu, 19.38);
    near(p4.M, 1.75, 0.01);
  });
});

const row = (net: ReturnType<typeof buildChannelNet>, id: number) => net.points.find((p) => p.id === id)!;

describe('notes §15.5.1: M = 3 converging 10° channel', () => {
  const net = buildChannelNet(MOC_PRESETS.notes.spec);
  it('initial points and interior 4, 5', () => {
    nearAbs(row(net, 1).CI, 39.757);
    nearAbs(row(net, 1).CII, 59.757);
    nearAbs(row(net, 4).theta, -5);
    near(row(net, 4).M, 2.753, 0.002);
    nearAbs(row(net, 5).theta, 5);
  });
  it('wall point 6 (C_I = 29.757, the notes print 27.755), interior 7, wall 8', () => {
    expect(row(net, 6).kind).toBe('upper');
    nearAbs(row(net, 6).CI, 29.757);
    near(row(net, 6).M, 2.527, 0.002);
    nearAbs(row(net, 7).theta, 0);
    nearAbs(row(net, 7).nu, 39.757);
    expect(row(net, 8).kind).toBe('lower');
    nearAbs(row(net, 8).theta, 10);
  });
});

describe('PS10 P3: diverging 10° channel at M = 2', () => {
  const net = buildChannelNet(MOC_PRESETS.ps10p3.spec);
  const table: [number, number, number, number, number, number][] = [
    // id, CI, CII, θ, M, p (atm, official)
    [1, 36.38, 16.38, 10, 2, 1],
    [2, 26.38, 26.38, 0, 2, 1],
    [3, 36.38, 26.38, 5, 2.19, 0.743],
    [4, 46.38, 26.38, 10, 2.38, 0.552],
    [5, 36.38, 36.38, 0, 2.38, 0.552],
    [6, 46.38, 36.38, 5, 2.6, 0.392],
    [7, 56.38, 36.38, 10, 2.83, 0.275],
    [8, 46.38, 46.38, 0, 2.83, 0.275],
  ];
  it('matches the official table (8 points)', () => {
    expect(net.points.length).toBe(8);
    for (const [id, CI, CII, th, M, p] of table) {
      const r = row(net, id);
      nearAbs(r.CI, CI);
      nearAbs(r.CII, CII);
      nearAbs(r.theta, th);
      near(r.M, M, 0.005);
      near(r.p_pin, p, 0.01);
    }
  });
  it('wall kinds and no breakdown', () => {
    expect(row(net, 4).kind).toBe('upper');
    expect(row(net, 5).kind).toBe('lower');
    expect(net.breakdown).toBeNull();
  });
  it('points 7/8 equal a single 20° P-M turn (PS10 P1)', () => {
    near(row(net, 8).M, expansion(2, 20).M2, 1e-6);
    near(expansion(2, 20).p2_p1, 0.275, 0.003);
  });
});

describe('PS10 P4: converging channel and breakdown', () => {
  const net = buildChannelNet(MOC_PRESETS.ps10p4.spec);
  const table: [number, number, number, number, number, number][] = [
    [1, 16.38, 36.38, -10, 2, 1],
    [3, 16.38, 26.38, -5, 1.82, 1.321],
    [4, 6.38, 26.38, -10, 1.65, 1.709],
    [5, 16.38, 16.38, 0, 1.65, 1.709],
    [6, 6.38, 16.38, -5, 1.48, 2.194],
    [7, -3.62, 16.38, -10, 1.31, 2.786],
    [8, 6.38, 6.38, 0, 1.31, 2.786],
  ];
  it('matches the official table', () => {
    for (const [id, CI, CII, th, M, p] of table) {
      const r = row(net, id);
      nearAbs(r.CI, CI);
      nearAbs(r.CII, CII);
      nearAbs(r.theta, th);
      near(r.M, M, 0.006);
      near(r.p_pin, p, 0.01);
    }
  });
  it('extension: point 9 at M ≈ 1.10, then ν < 0 at the wall → MOC fails', () => {
    const ext = buildChannelNet(MOC_PRESETS.ps10p4ext.spec);
    const p9 = row(ext, 9);
    nearAbs(p9.nu, 1.38);
    near(p9.M, 1.1, 0.01);
    near(p9.p_pin, 3.65, 0.01);
    expect(row(ext, 10).valid).toBe(false);
    expect(ext.breakdown?.reason).toBe('subsonic');
  });
});

describe('Final A P4 (curved upper wall) and Final B P5 (converging, M = 3)', () => {
  it('Final A table, bottom-up numbering', () => {
    const net = buildChannelNet(MOC_PRESETS.finalA.spec);
    expect(net.points.length).toBe(12);
    const M = [2, 2, 2.284, 2.598, 2.186, 2.49, 2.385, 2.598, 2.49, 2.598, 2.186, 2.284];
    const p = [100, 100, 64.2, 39.3, 74.7, 46.5, 54.8, 39.3, 46.5, 39.3, 74.7, 64.2];
    M.forEach((m, i) => near(row(net, i + 1).M, m, 0.002));
    p.forEach((v, i) => near(row(net, i + 1).p_pin * 100, v, 0.005));
    expect(row(net, 1).kind).toBe('initial');
    expect(row(net, 4).kind).toBe('lower');
    expect(row(net, 5).kind).toBe('upper');
    nearAbs(row(net, 6).theta, -2.5);
  });
  it('Final B table', () => {
    const net = buildChannelNet(MOC_PRESETS.finalB.spec);
    expect(net.points.length).toBe(11);
    const M: [number, number][] = [[4, 2.753], [6, 2.753], [7, 2.527], [8, 2.527], [9, 2.319], [10, 1.942], [11, 2.125]];
    const p: [number, number][] = [[4, 145.4], [7, 206.1], [9, 285.2], [10, 514.0], [11, 386.4]];
    M.forEach(([id, m]) => near(row(net, id).M, m, 0.002));
    p.forEach(([id, v]) => near(row(net, id).p_pin * 100, v, 0.005));
    nearAbs(row(net, 10).CI, 9.757);
  });
});

describe('concave compression wall: same-family waves cross → shock', () => {
  it('finds a crossing downstream of the wall', () => {
    const r = concaveWall(2, [0, 3, 6, 9, 12]);
    expect(r.shock).not.toBeNull();
    expect(r.wall[4].M).toBeLessThan(2);
  });
  it('an expansion wall has no crossing', () => {
    expect(concaveWall(2, [0, -3, -6, -9]).shock).toBeNull();
  });
});

describe('PS11 unsteady waves', () => {
  const cAir = (T: number) => soundSpeed(1.4, gasR(28.9), T);
  it('P1: lab-frame flow behind the shock is sonic at Ms = 2.068', () => {
    const Ms = bisect((M) => movingShock(M, 1).M2lab - 1, 1.01, 5);
    near(Ms, 2.068, 0.001);
    const closed = Math.sqrt((7 - 1.4 + Math.sqrt(1.4 ** 2 + 2 * 1.4 + 17)) / (4 * (2 - 1.4)));
    near(closed, Ms, 1e-6);
  });
  it('notes example: Ms = 3 into 300 K air → Vp = 773 m/s, M behind = 1.357', () => {
    const s = movingShock(3, 348);
    near(s.up, 773.3, 0.002);
    near(s.M2lab, 1.357, 0.002);
  });
  it('P2 water hammer: Ms = 1.090, p = 122 kPa', () => {
    const c = cAir(298);
    near(c, 346.4, 0.002);
    const s = movingShock(Ms_from_up(50 / c), c);
    near(s.Ms, 1.0903, 0.001);
    near(100 * s.p2_p1, 122.0, 0.002);
  });
  it('P6: T5 = 1200 K needs Ms = 2.705, MR = 2.019; corrected p1 and p4', () => {
    const c1 = cAir(300);
    const d = designForT5(1200, 300, c1);
    near(d.Ms, 2.705, 0.001);
    near(d.MR, 2.019, 0.001);
    near(d.p5_p2, 4.59, 0.002);
    near(reflectedShock(d.Ms).MR, d.MR, 1e-4); // Anderson's closed form agrees with the piston method
    const p1 = 5 / d.p5_p1;
    near(p1, 0.1301, 0.003);
    const cN2 = soundSpeed(1.4, gasR(28), 300);
    const cHe = soundSpeed(5 / 3, gasR(4), 300);
    near(driverRatio(d.p2_p1, 1.4, 1.4, c1, cN2), 246, 0.02);
    near(driverRatio(d.p2_p1, 1.4, 5 / 3, c1, cHe), 29.2, 0.03);
    near(p1 * driverRatio(d.p2_p1, 1.4, 1.4, c1, cN2), 32.0, 0.02);
    near(p1 * driverRatio(d.p2_p1, 1.4, 5 / 3, c1, cHe), 3.8, 0.03);
  });
  it('P4/P5 consistency: shock tube driven by its own p4/p1 recovers p2/p1', () => {
    const c1 = cAir(300);
    const cHe = soundSpeed(5 / 3, gasR(4), 300);
    const p41 = driverRatio(8.37, 1.4, 5 / 3, c1, cHe);
    const st = shockTube({ p4_p1: p41, g1: 1.4, g4: 5 / 3, c1, c4: cHe });
    near(st.p2_p1, 8.37, 1e-4);
    near(st.p3_p4 * p41, st.p2_p1, 1e-6);
  });
});

describe('Final A P5: piston pushed and pulled at 200 m/s', () => {
  const c1 = soundSpeed(1.4, 287, 300);
  it('pushed: Ms = 1.404, T = 377 K, p = 2.13 atm', () => {
    const s = pistonSolution(200, c1);
    near(s.Ms!, 1.4037, 0.001);
    near(300 * s.T2_T1!, 377.1, 0.002);
    near(s.p2_p1!, 2.132, 0.002);
    expect(pistonProfile(s, 0.5 * s.Vs!, 1).region).toBe('2');
  });
  it('pulled: c = 307 m/s, T = 235 K, p = 0.4245 atm; fan head +c1, tail +107 m/s', () => {
    const s = pistonSolution(-200, c1);
    near(s.cp!, 307.2, 0.002);
    near(300 * s.Tp_T1!, 234.9, 0.002);
    near(s.pp_p1!, 0.4245, 0.003);
    near(s.tail!, 107.2, 0.01);
    const mid = pistonProfile(s, 0.5 * (s.tail! + s.head!), 1);
    expect(mid.region).toBe('fan');
    expect(mid.p_p1).toBeGreaterThan(s.pp_p1!);
  });
  it('escape velocity 2c1/(γ−1) = 5c1 → cavitation', () => {
    const s = pistonSolution(-6 * c1, c1);
    expect(s.mode).toBe('cavitation');
    near(s.uEsc, 5 * c1, 1e-9);
  });
});

describe('gas gun and shock-tube x–t', () => {
  it('u_max = 5c0 (unsteady) vs √5·c0 (steady)', () => {
    const b = projectileBase(1000, 400);
    near(b.uMax, 2000, 1e-9);
    near(steadyVmax(400), Math.sqrt(5) * 400, 1e-9);
    near(b.pp_p0, (1 - 0.2 * 2.5) ** 7, 1e-9);
  });
  it('shock-tube profile regions and reflected-shock state', () => {
    const w = shockTubeWaves({ p4_p1: 10, driver: GASES.air, driven: GASES.air, T4: 300, T1: 300, L1: 4 });
    expect(shockTubeProfile(w, -0.99 * w.c4 * 1e-3, 1e-3).region).toBe('fan');
    expect(shockTubeProfile(w, 0.5 * (w.u2 + w.Vs) * 1e-3, 1e-3).region).toBe('2');
    const t = 0.5 * (w.tWall + w.tMeet);
    expect(shockTubeProfile(w, w.L1 - 1e-6, t).region).toBe('5');
    near(w.MR, reflectedFromIncident(w.Ms, w.c1).MR, 1e-9);
    expect(w.p5_p1).toBeGreaterThan(w.p2_p1);
  });
});
