import { describe, expect, it } from 'vitest';
import { water, r134a } from './props';
import ref from './propsRef.json';

describe('steam and R-134a interpolation vs CoolProp (random states)', () => {
  it('water superheated / supercritical: |dh| < 0.6 kJ/kg, |ds| < 1e-3, v within 0.3 %', () => {
    let worst = { dh: 0, ds: 0, dv: 0 };
    for (const [P, T, h, s, v] of ref.water as number[][]) {
      const st = water.PT(P, T);
      worst = { dh: Math.max(worst.dh, Math.abs(st.h - h)), ds: Math.max(worst.ds, Math.abs(st.s - s)), dv: Math.max(worst.dv, Math.abs(st.v / v - 1)) };
    }
    console.log('water worst', worst);
    expect(worst.dh).toBeLessThan(0.6);
    expect(worst.ds).toBeLessThan(1e-3);
    expect(worst.dv).toBeLessThan(3e-3);
  });
  it('R-134a superheated', () => {
    let worst = { dh: 0, ds: 0, dv: 0 };
    for (const [P, T, h, s, v] of ref.r134a as number[][]) {
      const st = r134a.PT(P, T);
      worst = { dh: Math.max(worst.dh, Math.abs(st.h - h)), ds: Math.max(worst.ds, Math.abs(st.s - s)), dv: Math.max(worst.dv, Math.abs(st.v / v - 1)) };
    }
    console.log('r134a worst', worst);
    expect(worst.dh).toBeLessThan(0.3);
    expect(worst.ds).toBeLessThan(1e-3);
    expect(worst.dv).toBeLessThan(3e-3);
  });
});
