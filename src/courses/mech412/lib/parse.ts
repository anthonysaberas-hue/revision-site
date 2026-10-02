/**
 * Parse a polynomial in s typed by a human: "s^2+3s+2", "2(s+1)(s+4)", "s(s+2)", "0.5s+1", or bare
 * coefficients "1 3 2" (highest power first). Returns coefficients highest power first.
 */
import { Poly, add, mul, scale, trim } from './poly';

export function parsePoly(input: string): Poly {
  const src = input.trim();
  if (!src) throw new Error('empty');
  if (/^[\d\s.,eE+\-\[\];]+$/.test(src) && !/[a-zA-Z]/.test(src.replace(/e[+-]?\d/gi, ''))) {
    const nums = src.replace(/[\[\];,]/g, ' ').trim().split(/\s+/).map(Number);
    if (nums.some((n) => !Number.isFinite(n))) throw new Error('bad number');
    return trim(nums);
  }
  let i = 0;
  const s = src.replace(/\s+/g, '').replace(/\*\*/g, '^');
  const peek = () => s[i];
  const num = (): Poly | null => {
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return [parseFloat(m[0])];
  };
  const atom = (): Poly => {
    if (peek() === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') throw new Error('missing )');
      i++;
      return v;
    }
    if (peek() === 's' || peek() === 'S') {
      i++;
      let p: Poly = [1, 0];
      if (peek() === '^') {
        i++;
        const n = num();
        if (!n) throw new Error('bad exponent');
        const e = Math.round(n[0]);
        p = [1, ...new Array(e).fill(0)];
      }
      return p;
    }
    const n = num();
    if (n) return n;
    throw new Error(`unexpected "${peek() ?? 'end'}"`);
  };
  const factor = (): Poly => {
    let p = atom();
    if (peek() === '^') {
      i++;
      const n = num();
      if (!n) throw new Error('bad exponent');
      let r: Poly = [1];
      for (let k = 0; k < Math.round(n[0]); k++) r = mul(r, p);
      p = r;
    }
    return p;
  };
  const term = (): Poly => {
    let sign = 1;
    while (peek() === '+' || peek() === '-') {
      if (peek() === '-') sign = -sign;
      i++;
    }
    let p = factor();
    while (i < s.length && peek() !== '+' && peek() !== '-' && peek() !== ')') {
      if (peek() === '*') i++;
      p = mul(p, factor());
    }
    return scale(p, sign);
  };
  const expr = (): Poly => {
    let p = term();
    while (peek() === '+' || peek() === '-') p = add(p, term());
    return p;
  };
  const out = expr();
  if (i < s.length) throw new Error(`unexpected "${s[i]}"`);
  return trim(out);
}

export const polyToString = (p: Poly, digits = 4): string => {
  const n = p.length - 1;
  const parts: string[] = [];
  p.forEach((c, k) => {
    if (Math.abs(c) < 1e-12) return;
    const e = n - k;
    const a = Math.abs(Number(c.toPrecision(digits)));
    const coef = e > 0 && a === 1 ? '' : String(a);
    const body = e === 0 ? String(a) : e === 1 ? `${coef}s` : `${coef}s^${e}`;
    parts.push((c < 0 ? '−' : parts.length ? '+' : '') + body);
  });
  return parts.length ? parts.join(' ').replace(/ ([+−])/g, ' $1 ') : '0';
};
