/**
 * Supersonic inlets / diffusers and wind tunnels (notes Ch. 9).
 * Area ratios are A_inlet / A_throat unless stated.
 */
import { A_Astar, M_from_A_Astar } from './isentropic';
import { My, Mx_from_My, p0y_p0x } from './normalShock';

/** Isentropic design: inlet/throat area ratio that decelerates M_design to exactly M = 1 at the throat. */
export const designAreaRatio = (Mdesign: number, g = 1.4) => A_Astar(Mdesign, g);

/**
 * Kantrowitz starting condition for a fixed geometry A_in/A_t.
 * With the normal shock standing at the inlet lip, the flow behind it (My) must pass through
 * the throat: A_in/A_t = (A/A*)(My). The flight Mach that achieves this is the starting Mach.
 */
export function startingMach(Ain_At: number, g = 1.4): number {
  const MyReq = M_from_A_Astar(Ain_At, 'sub', g);
  return Mx_from_My(MyReq, g);
}

/** Throat area (as a fraction of the inlet) needed to start at flight Mach M: A_t/A_in = (A* / A) at My. */
export function startingThroatRatio(M: number, g = 1.4): number {
  return 1 / A_Astar(My(M, g), g);
}

/** Throat must open by A*y/A*x = p0x/p0y relative to the design throat to swallow the shock at M. */
export const throatOpeningFactor = (M: number, g = 1.4) => 1 / p0y_p0x(M, g);

/** Unstarted/started mass-flow ratio: spillage behind the bow shock. */
export const unstartMassFlowRatio = (M: number, g = 1.4) => p0y_p0x(M, g);

/** Supersonic wind tunnel: minimum second-throat / first-throat area to start at test Mach M. */
export const secondThroatRatio = (Mtest: number, g = 1.4) => 1 / p0y_p0x(Mtest, g);

/** Curves for the start/unstart hysteresis diagram (A_t/A_in vs M). */
export function inletCurves(Mmax = 4, n = 200, g = 1.4) {
  const out: { M: number; design: number; kantrowitz: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const M = 1 + ((Mmax - 1) * i) / n;
    out.push({ M, design: 1 / A_Astar(M, g), kantrowitz: startingThroatRatio(M, g) });
  }
  return out;
}
