/** Single-reaction chemical equilibrium at fixed T and P (Kp form), extent solved by bisection. */
import { A28, lnKp, solve } from './gas';

export interface EqIn {
  lnK: number; // ln Kp of the reaction as written (reac → prod)
  reac: [number, string][];
  prod: [number, string][];
  initial: Record<string, number>; // kmol of reactants/products initially present
  inert?: Record<string, number>; // kmol of inert species (count in the total moles)
  P: number; // atm
  condensed?: string[]; // species that are pure solids/liquids (excluded from Kp and from total moles)
}
/** returns kmol of every species at equilibrium */
export function equilibrium(i: EqIn): Record<string, number> {
  const cond = new Set(i.condensed ?? []);
  const nu: Record<string, number> = {};
  for (const [v, s] of i.reac) nu[s] = (nu[s] ?? 0) - v;
  for (const [v, s] of i.prod) nu[s] = (nu[s] ?? 0) + v;
  const n0 = (s: string) => i.initial[s] ?? 0;
  // admissible extent range: no gaseous species may go negative
  let lo = -Infinity;
  let hi = Infinity;
  for (const [s, v] of Object.entries(nu)) {
    if (cond.has(s)) continue;
    if (v > 0) lo = Math.max(lo, -n0(s) / v);
    else hi = Math.min(hi, -n0(s) / v);
  }
  const amounts = (x: number) => {
    const out: Record<string, number> = { ...(i.inert ?? {}) };
    for (const s of Object.keys(i.initial)) out[s] = n0(s);
    for (const [s, v] of Object.entries(nu)) out[s] = n0(s) + v * x;
    return out;
  };
  const Ngas = (n: Record<string, number>) => Object.entries(n).reduce((a, [s, v]) => (cond.has(s) ? a : a + v), 0);
  const f = (x: number) => {
    const n = amounts(x);
    const N = Ngas(n);
    let sum = 0;
    for (const [s, v] of Object.entries(nu)) {
      if (cond.has(s)) continue;
      sum += v * Math.log((Math.max(n[s], 0) * i.P) / N);
    }
    return sum - i.lnK;
  };
  const x = solve(f, lo, hi, 1e-14, 400);
  return amounts(x);
}
/** ln Kp(T) for an A-28 reaction label, e.g. 'CO₂ ⇌ CO + ½O₂' */
export function lnKpAt(label: string, T: number) {
  const rx = A28.find((r) => r.label === label);
  if (!rx) throw new Error(`unknown reaction ${label}`);
  return lnKp(rx, T);
}
