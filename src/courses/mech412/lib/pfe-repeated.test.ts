import { describe, expect, it } from 'vitest';
import { inverseLaplace } from './pfe';

describe('repeated poles away from the origin (L02 poll 4, F2007 Q1)', () => {
  it('(s²+2s+3)/(s+1)³ = (1+t²)e^{-t}', () => {
    const f = inverseLaplace([1, 2, 3], [1, 3, 3, 1]);
    expect(f.text).toBe('t^2e^{−t} + e^{−t}');
    expect(f.f(2)).toBeCloseTo(5 * Math.exp(-2), 8);
  });
  it('1/(s+1)⁴ = t³e^{-t}/6', () => {
    expect(inverseLaplace([1], [1, 4, 6, 4, 1]).f(1.3)).toBeCloseTo((1.3 ** 3 / 6) * Math.exp(-1.3), 8);
  });
  it('1/(s³(s+1)) = t²/2 − t + 1 − e^{-t} (MT1 F2007 Q1)', () => {
    expect(inverseLaplace([1], [1, 1, 0, 0, 0]).f(0.7)).toBeCloseTo(0.7 ** 2 / 2 - 0.7 + 1 - Math.exp(-0.7), 10);
  });
});
