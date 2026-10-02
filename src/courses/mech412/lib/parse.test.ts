import { describe, expect, it } from 'vitest';
import { parsePoly } from './parse';

describe('parsePoly', () => {
  it('handles forms people type', () => {
    expect(parsePoly('s^2+3s+2')).toEqual([1, 3, 2]);
    expect(parsePoly('(s+1)(s+2)')).toEqual([1, 3, 2]);
    expect(parsePoly('s(s+2)')).toEqual([1, 2, 0]);
    expect(parsePoly('0.5s+1')).toEqual([0.5, 1]);
    expect(parsePoly('2(s+1)^2')).toEqual([2, 4, 2]);
    expect(parsePoly('1 3 2')).toEqual([1, 3, 2]);
    expect(parsePoly('s^3 - 2s + 5')).toEqual([1, 0, -2, 5]);
    expect(parsePoly('40')).toEqual([40]);
    expect(parsePoly('(0.5s+1)(s+1)')).toEqual([0.5, 1.5, 1]);
  });
  it('rejects garbage', () => {
    expect(() => parsePoly('s+')).toThrow();
    expect(() => parsePoly('x^2')).toThrow();
  });
});
