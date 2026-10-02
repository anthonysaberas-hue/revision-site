import { describe, expect, it } from 'vitest';
import { advance, motorDcGain, motorDeriv, msdDeriv, msdWn, msdZeta, servoDeriv, tanksDeriv, tanksPoly, cartPoleDeriv, uprightPole } from './plants';
import { roots } from './poly';

describe('plants vs exam answers', () => {
  it('mass-spring-damper step settles to F/k with the textbook overshoot', () => {
    const p = { m: 1, b: 2, k: 25 };
    expect(msdZeta(p)).toBeCloseTo(0.2, 6);
    expect(msdWn(p)).toBeCloseTo(5, 6);
    let s = [0, 0];
    let peak = 0;
    for (let t = 0; t < 3; t += 0.01) {
      s = advance(msdDeriv(p, () => 25), s, t, 0.01);
      peak = Math.max(peak, s[0]);
    }
    expect(peak - 1).toBeCloseTo(Math.exp((-Math.PI * 0.2) / Math.sqrt(1 - 0.04)), 2);
  });

  it('MT2 W2010 Q3 tape-drive motor: unloaded roots -150 ± j132.3, DC gain 25 rad/s per 1 V... ', () => {
    const p = { Ra: 0.6, La: 2e-3, J: 2e-5, B: 0, Kt: 0.04 };
    const r = roots([p.La * p.J, p.Ra * p.J, p.Kt * p.Kt]);
    expect(r[0].re).toBeCloseTo(-150, 0);
    expect(Math.abs(r[0].im)).toBeCloseTo(132.29, 1);
    expect(motorDcGain(p)).toBeCloseTo(1 / 0.04, 6);
    // loaded: J = 6e-5, B = 7e-5 -> 233 rpm per volt (24.4 rad/s)
    const q = { ...p, J: 6e-5, B: 7e-5 };
    let s = [0, 0, 0];
    for (let t = 0; t < 0.6; t += 0.001) s = advance(motorDeriv(q, () => 1, () => 0), s, t, 0.001, 2e-5);
    expect((s[1] * 60) / (2 * Math.PI)).toBeCloseTo(233, -1);
  });

  it('MT2 W2012 Q2 tanks: 1/(4s²+6s+1)', () => {
    const p = { A1: 2, A2: 2, Rb: 1, Rc: 1 };
    expect(tanksPoly(p)).toEqual([4, 6, 1]);
    let s = [0, 0];
    for (let t = 0; t < 60; t += 0.01) s = advance(tanksDeriv(p, () => 1, () => 0), s, t, 0.01);
    expect(s[1] / p.Rc).toBeCloseTo(1, 3); // qout -> qin
  });

  it('MT2 W2019 Q2 governor servo: output tracks (a2/a1)(1 + k/(bs)) e for large K', () => {
    // constant error e = 1 held: y' ≈ (a2/a1) k/b * z-lag... check DC: z -> (b/k) y' and y' -> 0 requires x -> 0
    const p = { K: 200, a1: 1, a2: 2, b: 1, k: 1 };
    let s = [0, 0];
    for (let t = 0; t < 40; t += 0.01) s = advance(servoDeriv(p, () => 1), s, t, 0.01, 1e-3);
    expect(s[1]).toBeCloseTo(p.a2 / p.a1, 1); // z -> a2/a1 e
  });

  it('F2010 P4 rocket: open-loop pole sqrt((M+m)g/(ML)) = 1.39', () => {
    expect(uprightPole({ M: 40, m: 8, L: 20, g: 32.2, c: 0 })).toBeCloseTo(1.39, 2);
    // upright cart-pole falls when released
    const p = { M: 1, m: 0.2, L: 0.5, g: 9.81, c: 0 };
    let s = [0, 0, 0.05, 0];
    for (let t = 0; t < 1.5; t += 0.001) s = advance(cartPoleDeriv(p, () => 0), s, t, 0.001);
    expect(Math.abs(s[2])).toBeGreaterThan(0.5);
  });

  it('PD on the angle balances the cart-pole iff Kp > (M+m) g (F2010 P4 logic)', () => {
    const p = { M: 1, m: 0.3, L: 0.8, g: 9.81, c: 0 };
    const run = (Kp: number, Kd: number) => {
      let s = [0, 0, 0.1, 0];
      for (let t = 0; t < 4; t += 0.002) s = advance(cartPoleDeriv(p, (_t, x) => Kp * x[2] + Kd * x[3]), s, t, 0.002);
      return Math.abs(s[2]);
    };
    expect(run(40, 8)).toBeLessThan(1e-3); // (M+m) g = 12.8 < 40
    expect(run(10, 8)).toBeGreaterThan(0.3); // below the toppling term: falls
  });
});
