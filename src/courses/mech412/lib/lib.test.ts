import { describe, expect, it } from 'vitest';
import { abs, c, fromPolar } from './complex';
import * as P from './poly';
import { inverseLaplace, pfe, stepExpr } from './pfe';
import { simulate, stepResponse, tf2ss, impulseResponse, simulateLoop, DelayBuffer, TF, series, rampResponse } from './lti';
import * as spec from './specs';
import { isHurwitz, routhArray, stableKRange } from './routh';
import * as rl from './rootLocus';
import { bode, bodeAsymptotes, margins, nyquistEncirclements, freqResponse } from './freq';
import * as ss from './stateSpace';
import * as des from './design';
import { verify } from './verify';

/** relative closeness */
const near = (actual: number, expected: number, rel = 0.01) => expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(rel);

describe('poly / complex', () => {
  it('roots: distinct, complex, zero and repeated', () => {
    const r = P.roots([1, 3, 2, 0]);
    expect(r.map((z) => Number(z.re.toFixed(8)))).toEqual([0, -1, -2]);
    const q = P.roots(P.mul([1, 2, 5], [1, 2])); // (s^2+2s+5)(s+2)
    near(q[0].re, -1, 1e-8);
    near(Math.abs(q[0].im), 2, 1e-8);
    near(q[2].re, -2, 1e-8);
    const rep = P.roots(P.mulAll([1, 1], [1, 1], [1, 1])); // (s+1)^3
    rep.forEach((z) => near(z.re, -1, 1e-5)); // triple root: Durand-Kerner is only good to ~eps^(1/3)
  });
  it('evaluation, derivative, product, division', () => {
    expect(P.evalReal([1, 3, 2], 2)).toBe(12);
    const z = P.evalC([1, 0, 1], c(0, 1)); // s^2 + 1 at j
    expect(abs(z)).toBeLessThan(1e-12);
    expect(P.derivative([1, 3, 2])).toEqual([2, 3]);
    const { q, r } = P.divmod([1, 5, 6, 1], [1, 2]);
    expect(q).toEqual([1, 3, 0]);
    expect(r[0]).toBeCloseTo(1, 12);
    expect(P.fromRoots([c(-1), c(-2)])).toEqual([1, 3, 2]);
  });
  it('degree-8 polynomial round trip', () => {
    const want = [-0.5, -1, -2, -3, -4, -5, -6, -7].map((x) => c(x));
    const got = P.roots(P.fromRoots(want));
    got.forEach((z, i) => near(z.re, -[0.5, 1, 2, 3, 4, 5, 6, 7][i], 1e-6));
  });
});

describe('partial fractions', () => {
  it('(3s^2+2s+2)/[(s+2)(s^2+2s+5)] = 2e^-2t + e^-t cos2t - 2.5 e^-t sin2t', () => {
    const num = [3, 2, 2];
    const den = P.mul([1, 2], [1, 2, 5]);
    const e = inverseLaplace(num, den);
    for (const t of [0, 0.3, 1, 2.5]) {
      const want = 2 * Math.exp(-2 * t) + Math.exp(-t) * Math.cos(2 * t) - 2.5 * Math.exp(-t) * Math.sin(2 * t);
      expect(e.f(t)).toBeCloseTo(want, 9);
    }
    expect(e.text).toContain('2e^{−2t}');
    expect(e.text).toContain('e^{−t}cos(2t)');
    expect(e.text).toContain('2.5e^{−t}sin(2t)');
    const real = e.pfe.terms.find((t) => Math.abs(t.pole.im) < 1e-9)!;
    near(real.residue.re, 2, 1e-9);
  });
  it('repeated poles: 1/[s(s+1)^2] = 1 - e^-t - t e^-t', () => {
    const e = inverseLaplace([1], P.mul([1, 0], P.mul([1, 1], [1, 1])));
    for (const t of [0.2, 1, 3]) expect(e.f(t)).toBeCloseTo(1 - Math.exp(-t) - t * Math.exp(-t), 5);
    expect(e.text).toContain('t e^{−t}'.replace(' ', ''));
  });
  it('improper fraction: (s^2+3s+3)/(s+1) = s + 2 + 1/(s+1)', () => {
    const p = pfe([1, 3, 3], [1, 1]);
    expect(p.direct[0]).toBeCloseTo(1, 12);
    expect(p.direct[1]).toBeCloseTo(2, 12);
    expect(p.terms).toHaveLength(1);
    near(p.terms[0].residue.re, 1, 1e-9);
  });
  it('Ogata Ex 3-3: step of (2s+10)/(s^2+2s+10) = 1 - e^-t cos3t + (1/3) e^-t sin3t', () => {
    const e = stepExpr([2, 10], [1, 2, 10]);
    for (const t of [0, 0.5, 1, 2, 4]) {
      const want = 1 - Math.exp(-t) * Math.cos(3 * t) + (1 / 3) * Math.exp(-t) * Math.sin(3 * t);
      expect(e.f(t)).toBeCloseTo(want, 9);
    }
    // numerical simulation agrees with the closed form
    const r = stepResponse({ num: [2, 10], den: [1, 2, 10] }, 5);
    const k = r.t.findIndex((t) => t >= 1.5);
    const t = r.t[k];
    expect(r.y[k]).toBeCloseTo(1 - Math.exp(-t) * Math.cos(3 * t) + (1 / 3) * Math.exp(-t) * Math.sin(3 * t), 6);
  });
});

describe('LTI simulation', () => {
  it('canonical SS has the right TF (round trip through ss2tf)', () => {
    const g: TF = { num: [2, 10], den: [1, 2, 10] };
    const s = tf2ss(g);
    const back = ss.ss2tf(s);
    expect(back.den.map((x) => Number(x.toFixed(9)))).toEqual([1, 2, 10]);
    expect(back.num.map((x) => Number(x.toFixed(9)))).toEqual([2, 10]);
  });
  it('first-order step 1/(s+1): y(1) = 1 - 1/e; impulse and ramp', () => {
    const g: TF = { num: [1], den: [1, 1] };
    const st = stepResponse(g, 5);
    const k = st.t.findIndex((t) => t >= 1 - 1e-9);
    near(st.y[k], 1 - Math.exp(-1), 1e-6);
    const im = impulseResponse(g, 5);
    near(im.y[k], Math.exp(-1), 1e-6);
    const rp = rampResponse(g, 5);
    near(rp.y[k], 1 - 1 + Math.exp(-1), 1e-5); // t - 1 + e^-t at t=1
  });
  it('initial conditions and arbitrary input', () => {
    const s = tf2ss({ num: [1], den: [1, 3, 2] });
    const r = simulate(s, () => 0, 3, { x0: [1, 0], dt: 0.001 });
    // x1'' + 3x1' + 2x1 = 0, x1(0)=1, x1'(0)=0 -> 2e^-t - e^-2t
    const k = r.t.findIndex((t) => t >= 1 - 1e-9);
    near(r.x[k][0], 2 * Math.exp(-1) - Math.exp(-2), 1e-6);
  });
  it('pure delay: e^{-2s}/(s+1) step is zero until t = 2', () => {
    const g: TF = { num: [1], den: [1, 1], delay: 2 };
    const st = stepResponse(g, 8);
    const k1 = st.t.findIndex((t) => t >= 1.9);
    const k2 = st.t.findIndex((t) => t >= 3);
    expect(st.y[k1]).toBe(0);
    near(st.y[k2], 1 - Math.exp(-(st.t[k2] - 2)), 1e-3);
  });
  it('delay buffer and feedback loop with delay (closed loop of 1/(s+1) e^{-s}, K = 1 is stable, final value 0.5)', () => {
    const b = new DelayBuffer(1);
    for (let i = 0; i <= 10; i++) b.push(i * 0.5, i * 0.5);
    expect(b.get(3)).toBeCloseTo(2, 12);
    expect(b.get(0.5)).toBe(0);
    const r = simulateLoop({ num: [1], den: [1, 1], delay: 1 }, 1, () => 1, 40);
    near(r.y[r.y.length - 1], 0.5, 1e-3);
  });
  it('delay closed loop goes unstable above the ultimate gain (paper machine, K = 4 > 3.04)', () => {
    const g: TF = { num: [1], den: [3, 1], delay: 2 };
    const ok = simulateLoop(g, 2, () => 1, 120);
    near(ok.y[ok.y.length - 1], 2 / 3, 1e-2);
    const bad = simulateLoop(g, 4, () => 1, 120);
    expect(Math.abs(bad.y[bad.y.length - 1])).toBeGreaterThan(5);
  });
});

describe('second-order specifications', () => {
  it('13/(s^2+4s+17): zeta = 2/sqrt(17), OS, ts = 2 s', () => {
    const { wn, zeta } = spec.secondOrderFromDen(4, 17, 13);
    near(zeta, 2 / Math.sqrt(17), 1e-12);
    near(wn, Math.sqrt(17), 1e-12);
    const s = spec.specsFromWnZeta(wn, zeta);
    near(s.ts2, 2, 1e-12);
    near(s.os, 100 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)), 1e-12);
    near(s.os, 17.5, 0.01);
    near(s.tp, Math.PI / Math.sqrt(13), 1e-12); // wd = sqrt(17) sqrt(1 - 4/17) = sqrt(13)
    near(s.ts5, 1.5, 1e-12);
  });
  it('OS <-> zeta round trip and pole angle', () => {
    near(spec.zetaFromOS(16.3), 0.5, 0.005);
    near(spec.osFromZeta(spec.zetaFromOS(25)), 25, 1e-9);
    near(spec.poleAngleDeg(0.5), 60, 1e-9);
    const d = spec.designFromSpecs(10, 2);
    near(d.zeta, 0.5912, 0.001);
    near(d.sigma, 2, 1e-12);
  });
  it('measured step info matches the formulas', () => {
    const g: TF = { num: [13], den: [1, 4, 17] };
    const r = stepResponse(g, 6, 1, { dt: 0.0005 });
    const info = spec.stepInfo(r.t, r.y, 13 / 17);
    const s = spec.specsFromWnZeta(Math.sqrt(17), 2 / Math.sqrt(17));
    near(info.overshoot, s.os, 0.02);
    near(info.peakTime, s.tp, 0.01);
    near(info.rise0100, s.tr, 0.01);
    // 2 % settling measured is below the 4/(zeta wn) estimate but of the same order
    expect(info.settling2).toBeLessThan(s.ts2 * 1.05);
    expect(info.settling2).toBeGreaterThan(s.ts2 * 0.5);
    near(info.peak, (13 / 17) * (1 + s.os / 100), 0.01);
  });
});

describe('Routh-Hurwitz', () => {
  it('s^3+3s^2+2s+K is stable for 0 < K < 6', () => {
    const k = stableKRange((K) => [1, 3, 2, K], -5, 20);
    expect(k.intervals).toHaveLength(1);
    expect(k.intervals[0][0]).toBeCloseTo(0, 6);
    expect(k.intervals[0][1]).toBeCloseTo(6, 6);
    const arr = routhArray([1, 3, 2, 6]);
    expect(arr.zeroRows).toEqual([2]); // K = 6: zero row, aux 3s^2 + 6
    expect(arr.auxiliaries[0]).toEqual([3, 0, 6]);
    expect(arr.imagRoots).toBe(2);
  });
  it('s^3+2s^2+s+2: zero first element in the s^1 row (epsilon case), no sign change, roots on the jw axis', () => {
    const r = routhArray([1, 2, 1, 2]);
    expect(r.signChanges).toBe(0);
    expect(r.special).toBe(true);
    expect(r.auxiliaries[0]).toEqual([2, 0, 2]); // 2s^2 + 2
    expect(r.imagRoots).toBe(2);
    expect(r.stable).toBe(false);
    const rts = P.roots([1, 2, 1, 2]);
    expect(rts.filter((z) => Math.abs(z.re) < 1e-9)).toHaveLength(2);
  });
  it('genuine epsilon case: s^4+s^3+2s^2+2s+3 has 2 RHP roots', () => {
    const r = routhArray([1, 1, 2, 2, 3]);
    expect(r.epsilonRows).toEqual([2]);
    expect(r.signChanges).toBe(2);
    expect(P.countRHP([1, 1, 2, 2, 3])).toBe(2);
    expect(r.rows[2][0]).toBeGreaterThan(0);
  });
  it('zero-row case: s^5+2s^4+24s^3+48s^2-25s-50, auxiliary 2s^4+48s^2-50, one RHP root', () => {
    const p = [1, 2, 24, 48, -25, -50];
    const r = routhArray(p);
    expect(r.zeroRows).toEqual([2]);
    expect(r.auxiliaries[0]).toEqual([2, 0, 48, 0, -50]);
    expect(r.rows[2]).toEqual([8, 96]); // derivative 8 s^3 + 96 s
    expect(r.signChanges).toBe(1);
    expect(r.rhpRoots).toBe(1);
    expect(r.imagRoots).toBe(2);
    expect(P.countRHP(p)).toBe(1);
    expect(isHurwitz(p)).toBe(false);
  });
  it('agrees with root finding on random-ish polynomials', () => {
    const cases = [[1, 4, 6, 4, 1], [1, 2, 3, 4, 5], [1, 6, 11, 6], [2, 3, 5, 7, 1, 4], [1, 1, 1, 1, 1, 1]];
    for (const p of cases) expect(routhArray(p).signChanges).toBe(P.countRHP(p));
  });
});

describe('root locus of K/[s(s+1)(s+2)]', () => {
  const num = [1];
  const den = [1, 3, 2, 0];
  it('asymptotes and centroid', () => {
    const a = rl.asymptotes(num, den);
    expect(a.count).toBe(3);
    expect(a.centroid).toBeCloseTo(-1, 12);
    expect(a.anglesDeg.map((x) => Math.round(x)).sort((x, y) => x - y)).toEqual([-60, 60, 180]);
  });
  it('breakaway at -0.4226 (K = 0.385); -1.577 is not on the locus', () => {
    const b = rl.breakawayPoints(num, den);
    const on = b.filter((x) => x.onLocus);
    expect(on).toHaveLength(1);
    near(on[0].s.re, -0.4226, 1e-3);
    near(on[0].K, 0.3849, 1e-3);
    expect(b.some((x) => Math.abs(x.s.re + 1.5774) < 1e-3 && !x.onLocus)).toBe(true);
  });
  it('jw crossing at K = 6, w = sqrt(2)', () => {
    const x = rl.jwCrossings(num, den);
    expect(x).toHaveLength(1);
    near(x[0].w, Math.SQRT2, 1e-6);
    near(x[0].K, 6, 1e-6);
  });
  it('tracked branches: closed loop poles match direct roots; the branch crosses into the RHP after K = 6', () => {
    const br = rl.rootLocusBranches(num, den, 12);
    expect(br.paths).toHaveLength(3);
    const idx = br.K.findIndex((k) => k >= 6.5);
    const poles = P.roots(rl.charPoly(num, den, br.K[idx]));
    const tracked = br.paths.map((p) => p[idx]);
    for (const tp of tracked) expect(Math.min(...poles.map((q) => abs({ re: q.re - tp.re, im: q.im - tp.im })))).toBeLessThan(1e-6);
    expect(tracked.some((z) => z.re > 0)).toBe(true);
    // branches start at the open-loop poles
    expect(br.paths.map((p) => Math.round(p[0].re)).sort((a, b) => a - b)).toEqual([-2, -1, 0]);
    // continuity: no jumps larger than the refinement threshold
    for (const p of br.paths) for (let i = 1; i < p.length; i++) expect(abs({ re: p[i].re - p[i - 1].re, im: p[i].im - p[i - 1].im })).toBeLessThan(0.2);
  });
  it('K at zeta = 0.5 is about 1.04 (Ogata)', () => {
    const pts = rl.gainAtZeta(num, den, 0.5);
    near(pts[0].K, 1.0383, 0.01);
    near(pts[0].s.re, -0.3337, 0.01);
    near(pts[0].s.im, 0.578, 0.01);
  });
  it('departure angle from -1+j of K/[s(s^2+2s+2)] is -45 degrees; arrival angle at a zero', () => {
    const poles = [c(0), c(-1, 1), c(-1, -1)];
    const k = rl.departureAngleDeg([], poles, 1);
    near(k, -45, 1e-9);
    // zero at -2 with poles at -1+j, -1-j (angles 135 + 225 -> arrival 180 - (-)...): check by symmetry on the real axis
    expect(rl.arrivalAngleDeg([c(-2)], [c(-1, 1), c(-1, -1)], 0)).toBeCloseTo(180, 9);
  });
});

describe('frequency response', () => {
  const G: TF = { num: [4], den: [1, 2, 0] };
  it('Bode magnitude/phase and asymptotes of 10/(s(s+1)) type factors', () => {
    const g: TF = { num: [10], den: [1, 1, 0] };
    const a = bodeAsymptotes(g);
    expect(a.q).toBe(1);
    near(a.K0, 10, 1e-12);
    // below the corner the slope is -20 dB/dec, above -40
    expect(a.slope(0.1)).toBe(-20);
    expect(a.slope(10)).toBe(-40);
    near(a.magDb(0.1), 40, 1e-9); // 20 log 10 - 20 log 0.1 = 20 + 20
    expect(a.magDb(10)).toBeCloseTo(-20, 9); // 20 - 20 (integrator) - 20 (pole at 1)
    expect(a.phaseDeg(0.001)).toBeCloseTo(-90, 0);
    expect(a.phaseDeg(1000)).toBeCloseTo(-180, 0);
  });
  it('phase unwrapping starts at -90 for an integrator and passes -180 once', () => {
    const b = bode(G, 0.01, 100, 400);
    expect(b.phaseDeg[0]).toBeGreaterThan(-95);
    expect(b.phaseDeg[0]).toBeLessThan(-85);
    expect(b.phaseDeg[b.phaseDeg.length - 1]).toBeGreaterThan(-180);
  });
  it('margins of K/[s(s+1)(s+2)], K=3: GM = 20 log 2 = 6.02 dB at sqrt(2)', () => {
    const m = margins({ num: [3], den: [1, 3, 2, 0] });
    near(m.gm, 6.0206, 1e-4);
    near(m.wpc, Math.SQRT2, 1e-6);
    expect(m.pm).toBeGreaterThan(0);
  });
  it('Nyquist encirclements: K=3 stable (N=0), K=10 unstable (Z=2)', () => {
    const s = nyquistEncirclements({ num: [3], den: [1, 3, 2, 0] });
    expect(s).toMatchObject({ N: 0, P: 0, Z: 0, stable: true });
    const u = nyquistEncirclements({ num: [10], den: [1, 3, 2, 0] });
    expect(u).toMatchObject({ N: 2, P: 0, Z: 2, stable: false });
    const g2 = nyquistEncirclements({ num: [1], den: [1, 3, 2] }); // type 0 stable
    expect(g2.Z).toBe(0);
  });
  it('margins of 10(1+0.4s)/[s(1+2s)(1+0.24s+0.04s^2)] agree with a brute-force frequency sweep', () => {
    const num = P.mul([10], [0.4, 1]);
    const den = P.mulAll([1, 0], [2, 1], [0.04, 0.24, 1]);
    const m = margins({ num, den });
    // independent sweep: factor-by-factor magnitude and summed arctangents (no unwrapping needed)
    const mag = (w: number) => (10 * Math.sqrt(1 + (0.4 * w) ** 2)) / (w * Math.sqrt(1 + (2 * w) ** 2) * Math.hypot(1 - 0.04 * w * w, 0.24 * w));
    const ph = (w: number) => (Math.atan(0.4 * w) - Math.PI / 2 - Math.atan(2 * w) - Math.atan2(0.24 * w, 1 - 0.04 * w * w)) * (180 / Math.PI);
    let wgc = NaN;
    let wpc = NaN;
    const N = 2_000_000;
    const lo = Math.log(1e-3);
    const hi = Math.log(1e3);
    let pw = 1e-3;
    for (let i = 1; i <= N; i++) {
      const w = Math.exp(lo + ((hi - lo) * i) / N);
      if (Number.isNaN(wgc) && (mag(pw) - 1) * (mag(w) - 1) <= 0) wgc = (pw + w) / 2;
      // phase on (-360, 0): crossing of -180 is where ph (principal, atan2-based, continuous here) passes -180
      if (Number.isNaN(wpc) && (ph(pw) + 180) * (ph(w) + 180) <= 0) wpc = (pw + w) / 2;
      pw = w;
    }
    expect(Number.isNaN(wgc)).toBe(false);
    near(m.wgc, wgc, 1e-3);
    near(m.pm, 180 + ph(wgc), 0.01);
    if (!Number.isNaN(wpc)) {
      near(m.wpc, wpc, 1e-3);
      near(m.gm, -20 * Math.log10(mag(wpc)), 0.01);
    }
    // eslint-disable-next-line no-console
    console.log(`margins(10(1+0.4s)/[s(1+2s)(1+0.24s+0.04s^2)]): GM = ${m.gm.toFixed(2)} dB @ ${m.wpc?.toFixed(3)}, PM = ${m.pm.toFixed(2)} deg @ ${m.wgc.toFixed(3)}`);
  });
});

describe('design', () => {
  it('paper machine e^{-2s}/(3s+1): Ku = 3.044', () => {
    const u = des.ultimateGain({ num: [1], den: [3, 1], delay: 2 });
    near(u.Ku, 3.044, 0.02);
    near(u.Pu, (2 * Math.PI) / u.wu, 1e-12);
    // check the defining phase condition
    const z = freqResponse({ num: [1], den: [3, 1], delay: 2 }, u.wu);
    near(Math.atan2(z.im, z.re), -Math.PI, 1e-6);
    // Z-N method 2 PID from (Ku, Pu)
    const t = des.zieglerNichols2(u.Ku, u.Pu);
    near(t.PID.Kp, 0.6 * u.Ku, 1e-12);
    near(t.PID.Ti, 0.5 * u.Pu, 1e-12);
  });
  it('Z-N method 1 table and FOPDT fit of K e^{-Ls}/(Ts+1)', () => {
    const t = des.zieglerNichols1(2, 10);
    near(t.PID.Kp, 6, 1e-12);
    near(t.PID.Ti, 4, 1e-12);
    near(t.PID.Td, 1, 1e-12);
    near(t.PI.Ti, 2 / 0.3, 1e-12);
    const r = stepResponse({ num: [2], den: [10, 1], delay: 3 }, 80, 1, { dt: 0.01 });
    const f = des.fitFOPDT(r.t, r.y);
    near(f.K, 2, 0.01);
    near(f.L, 3, 0.01);
    near(f.T, 10, 0.01);
  });
  it('error constants', () => {
    const e = des.errorConstants({ num: [20], den: [1, 3, 2, 0] });
    expect(e.type).toBe(1);
    near(e.Kv, 10, 1e-12);
    expect(e.Kp).toBe(Infinity);
    expect(e.Ka).toBe(0);
  });
  it('lead on 4/[s(s+2)], Kv = 20, PM 50: alpha = 0.24, Gc = 41.7 (s+4.41)/(s+18.4)', () => {
    const d = des.leadDesign({ num: [4], den: [1, 2, 0] }, { Kv: 20, pmTarget: 50, safetyDeg: 6 });
    near(d.K, 10, 1e-12);
    near(d.pmUncompensated, 18, 0.02);
    near(d.alpha, 0.24, 0.02);
    near(d.Kc, 41.7, 0.02);
    near(-d.zero, 4.41, 0.02);
    near(-d.pole, 18.4, 0.02);
    expect(d.achieved.pm).toBeGreaterThan(48);
    // velocity constant unchanged
    near(des.errorConstants(series(d.Gc, { num: [4], den: [1, 2, 0] })).Kv, 20, 1e-9);
  });
  it('Ogata Ex 11-7 lag on 1/[s(s+1)(0.5s+1)], Kv = 5', () => {
    const plant: TF = { num: [1], den: P.mulAll([1, 0], [1, 1], [0.5, 1]) };
    const unc = margins(series({ num: [5], den: [1] }, plant));
    expect(unc.pm).toBeLessThan(0); // about -13 deg exactly (slides quote about -20)
    const Gc: TF = { num: [50, 5], den: [100, 1] }; // 5 (10 s + 1)/(100 s + 1)
    const m = margins(series(Gc, plant));
    // Ogata quotes PM = 40 deg and GM = 11 dB (read from a plot); exact evaluation gives PM = 41.6 deg and GM = 14.2 dB
    // (hand check: phase = -180 at w = 1.31, |L| = 0.194).
    near(m.pm, 40, 0.06);
    near(m.wpc, 1.31, 0.01);
    near(m.gm, 14.2, 0.02);
    expect(m.gm).toBeGreaterThan(10); // the GM >= 10 dB specification is met
    // automatic design reaches the target PM
    const d = des.lagDesign(plant, { Kv: 5, pmTarget: 40, safetyDeg: 5 });
    expect(d.achieved.pm).toBeGreaterThan(37);
    expect(d.beta).toBeGreaterThan(1);
    near(des.errorConstants(series(d.Gc, plant)).Kv, 5, 1e-9);
  });
  it('sensitivity S^T_G = 1/(1+GH), S^T_H = -GH/(1+GH) and the numeric derivative agree', () => {
    const T = (g: number) => g / (1 + g * 2);
    near(des.sensitivityNumeric(T, 3), 1 / (1 + 3 * 2), 1e-6);
    const s = des.sensitivityTG(c(3), c(2));
    near(s.re, 1 / 7, 1e-12);
    near(des.sensitivityTH(c(3), c(2)).re, -6 / 7, 1e-12);
    const Th = (h: number) => 3 / (1 + 3 * h);
    near(des.sensitivityNumeric(Th, 2), -6 / 7, 1e-6);
  });
  it('PID TF', () => {
    expect(des.pidTF(2, 1, 0.5)).toEqual({ num: [1, 2, 2], den: [1, 0] });
  });
});

describe('state space', () => {
  const A = [[0, 1], [-2, -3]];
  it('linearisation i = e^3/4 at e = 2 has slope 3, so R = 1/3', () => {
    near(ss.derivative1((e) => (e ** 3) / 4, 2), 3, 1e-8);
    near(ss.linearizedResistance((e) => (e ** 3) / 4, 2), 1 / 3, 1e-8);
    const J = ss.jacobian((x) => [x[0] * x[1], x[0] + x[1] ** 2], [2, 3]);
    near(J[0][0], 3, 1e-8);
    near(J[0][1], 2, 1e-8);
    near(J[1][1], 6, 1e-8);
  });
  it('Phi(t) for A = [0 1; -2 -3]', () => {
    for (const t of [0, 0.4, 1, 2.5]) {
      const e1 = Math.exp(-t);
      const e2 = Math.exp(-2 * t);
      const want = [[2 * e1 - e2, e1 - e2], [-2 * e1 + 2 * e2, -e1 + 2 * e2]];
      const num = ss.phi(A, t);
      const modes = ss.phiFromModes(ss.phiModes(A), t);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        expect(num[i][j]).toBeCloseTo(want[i][j], 10);
        expect(modes[i][j]).toBeCloseTo(want[i][j], 10);
      }
    }
    const txt = ss.phiTimeTerms(A).text;
    expect(txt[0][0]).toContain('2e^{−t}');
  });
  it('eigenvalues, char poly, determinant, inverse', () => {
    const ev = ss.eigenvalues(A);
    near(ev[0].re, -1, 1e-9);
    near(ev[1].re, -2, 1e-9);
    expect(ss.charPolyOf(A).map((x) => Math.round(x))).toEqual([1, 3, 2]);
    expect(ss.det(A)).toBeCloseTo(2, 12);
    const I = ss.matMul(A, ss.inverse(A));
    expect(I[0][0]).toBeCloseTo(1, 12);
    expect(I[0][1]).toBeCloseTo(0, 12);
  });
  it('expm of a rotation generator', () => {
    const R = ss.expm([[0, -1], [1, 0]], Math.PI / 2);
    expect(R[0][0]).toBeCloseTo(0, 10);
    expect(R[1][0]).toBeCloseTo(1, 10);
    const big = ss.expm([[-50, 0], [0, -1]], 3); // needs scaling and squaring
    expect(big[1][1]).toBeCloseTo(Math.exp(-3), 10);
  });
  it('Method 1 beta for (2s+10)/(s^2+2s+10): beta = [0, 2, 6]', () => {
    const m = ss.method1([2, 10], [1, 2, 10]);
    expect(m.beta).toEqual([0, 2, 6]);
    expect(m.ss.B).toEqual([[2], [6]]);
    expect(m.ss.C).toEqual([[1, 0]]);
    const back = ss.ss2tf(m.ss);
    expect(back.num.map((x) => Number(x.toFixed(9)))).toEqual([2, 10]);
  });
  it('Method 1 with input derivatives of order n: (s^2+3s+5)/(s^2+2s+10)', () => {
    const m = ss.method1([1, 3, 5], [1, 2, 10]);
    expect(m.beta).toEqual([1, 1, -7]); // b1 - a1 b0 = 1, b2 - a1 beta1 - a2 beta0 = 5 - 2 - 10
    const back = ss.ss2tf(m.ss);
    expect(back.num.map((x) => Number(x.toFixed(9)))).toEqual([1, 3, 5]);
  });
  it('Method 2 companion form and Vandermonde diagonalisation', () => {
    const m = ss.method2([2, 10], [1, 2, 10]);
    expect(m.A).toEqual([[0, 1], [-10, -2]]);
    expect(m.C).toEqual([[10, 2]]);
    const d = ss.diagonalizeCompanion(ss.method2([1], [1, 3, 2]));
    // Ad is diagonal with the eigenvalues
    expect(abs(d.Ad[0][1])).toBeLessThan(1e-10);
    expect(abs(d.Ad[1][0])).toBeLessThan(1e-10);
    near(d.Ad[0][0].re, -1, 1e-9);
    near(d.Ad[1][1].re, -2, 1e-9);
  });
  it('SS -> TF for a two-input system and a D term', () => {
    const sys = { A: [[0, 1], [-2, -3]], B: [[0, 0], [1, 1]], C: [[1, 0]], D: [[0, 1]] };
    const t = ss.transferMatrix(sys);
    expect(t.num[0][0].map((x) => Number(x.toFixed(9)))).toEqual([1]); // 1/(s^2+3s+2)
    expect(t.num[0][1].map((x) => Number(x.toFixed(9)))).toEqual([1, 3, 3]); // 1 + 1/(...) -> (s^2+3s+3)
  });
  it('simulation of a Vandermonde-diagonalised complex pair is real', () => {
    const d = ss.diagonalizeCompanion(ss.method2([1], [1, 2, 5]));
    near(d.lambdas[0].im, 2, 1e-9);
    // P^-1 P = I check via product of Ad structure: off-diagonals vanish
    expect(abs(d.Ad[0][1])).toBeLessThan(1e-9);
  });
});

describe('verify helper', () => {
  it('returns ok or a message', () => {
    expect(verify(100, 100.5, 0.01)).toBe('ok');
    expect(verify(100, 103, 0.01)).toMatch(/mismatch/);
    expect(verify([1, 2], [1, 2.001], 0.01)).toBe('ok');
    expect(verify([1, 2], [1, 2.5], 0.01)).toMatch(/^\[1\]/);
    expect(verify(0, 0.001, 0.01)).toBe('ok');
  });
});

// keep fromPolar imported for future tests
void fromPolar;
