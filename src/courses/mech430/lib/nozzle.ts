/**
 * Converging–diverging nozzle driven by back pressure (notes Ch. 6 & 8).
 * Everything is non-dimensional: pressures relative to reservoir p0, areas relative to throat At.
 */
import { A_Astar, M_from_A_Astar, M_from_p_p0, p_p0 } from './isentropic';
import { p0y_p0x, py_px } from './normalShock';
import { bisect } from './solve';

export type NozzleRegime =
  | 'no-flow'
  | 'subsonic'
  | 'choked-subsonic'
  | 'shock-in-nozzle'
  | 'overexpanded'
  | 'design'
  | 'underexpanded';

export const REGIME_LABEL: Record<NozzleRegime, string> = {
  'no-flow': 'No flow (p_b = p₀)',
  subsonic: 'Subsonic everywhere — not choked, ṁ depends on p_b',
  'choked-subsonic': 'Just choked — sonic throat, subsonic diverging section',
  'shock-in-nozzle': 'Normal shock inside the diverging section',
  overexpanded: 'Over-expanded — oblique shocks outside the exit',
  design: 'Design condition — p_e = p_b, shock-free',
  underexpanded: 'Under-expanded — Prandtl–Meyer fans outside the exit',
};

/** Critical back pressures for a nozzle with exit/throat area ratio AR. */
export function criticalPressures(AR: number, g = 1.4) {
  const Msub = M_from_A_Astar(AR, 'sub', g);
  const Msup = M_from_A_Astar(AR, 'sup', g);
  const p3 = p_p0(Msub, g); // choked, subsonic exit
  const pd = p_p0(Msup, g); // design (supersonic exit)
  const p4 = pd * py_px(Msup, g); // normal shock sitting at the exit plane
  return { Msub, Msup, p3, pd, p4 };
}

export interface NozzleSolution {
  regime: NozzleRegime;
  /** Exit Mach and pressure (inside the nozzle, at the exit plane) */
  Me: number;
  pe: number;
  /** Shock area ratio As/At (if a shock is inside) */
  As?: number;
  Mx?: number;
  p0e: number;
  /** Mass flow relative to the choked value */
  mdotRatio: number;
  crit: ReturnType<typeof criticalPressures>;
}

/** Solve the nozzle for back pressure pb/p0. */
export function solveNozzle(AR: number, pb: number, g = 1.4): NozzleSolution {
  const crit = criticalPressures(AR, g);
  const tol = 1e-9;
  if (pb >= 1 - tol) return { regime: 'no-flow', Me: 0, pe: 1, p0e: 1, mdotRatio: 0, crit };
  if (pb >= crit.p3 - tol) {
    const Me = M_from_p_p0(pb, g);
    // Not choked: ṁ scales with the effective sonic area A* = Ae/(A/A*)(Me), vs At when choked.
    const mdotRatio = AR / A_Astar(Me, g);
    return { regime: pb > crit.p3 + tol ? 'subsonic' : 'choked-subsonic', Me, pe: pb, p0e: 1, mdotRatio, crit };
  }
  if (pb > crit.p4 + tol) {
    const exitP = (As: number) => {
      const Mx = M_from_A_Astar(As, 'sup', g);
      const r = p0y_p0x(Mx, g);
      const Me = M_from_A_Astar(AR * r, 'sub', g); // A*y = At/r
      return r * p_p0(Me, g);
    };
    const As = bisect((a) => exitP(a) - pb, 1 + 1e-9, AR);
    const Mx = M_from_A_Astar(As, 'sup', g);
    const r = p0y_p0x(Mx, g);
    const Me = M_from_A_Astar(AR * r, 'sub', g);
    return { regime: 'shock-in-nozzle', Me, pe: pb, As, Mx, p0e: r, mdotRatio: 1, crit };
  }
  const base = { Me: crit.Msup, pe: crit.pd, p0e: 1, mdotRatio: 1, crit };
  if (Math.abs(pb - crit.pd) < 1e-3 * crit.pd) return { regime: 'design', ...base };
  return { regime: pb > crit.pd ? 'overexpanded' : 'underexpanded', ...base };
}

/** Default nozzle geometry used for plots: A(x)/At, throat at x = 0.35, exit at x = 1. */
export function nozzleArea(x: number, AR: number, inletAR = 2.5): number {
  const xt = 0.35;
  if (x <= xt) {
    const s = x / xt;
    return 1 + (inletAR - 1) * (0.5 * (1 + Math.cos(Math.PI * s)));
  }
  const s = (x - xt) / (1 - xt);
  return 1 + (AR - 1) * 0.5 * (1 - Math.cos(Math.PI * s));
}

/** Sample p/p0 and M along the nozzle for a solution. */
export function nozzleProfile(AR: number, sol: NozzleSolution, n = 240, g = 1.4) {
  const pts: { x: number; A: number; M: number; p: number }[] = [];
  const xt = 0.35;
  const choked = sol.regime !== 'subsonic' && sol.regime !== 'no-flow';
  // For un-choked flow, the effective A* is larger than At
  const AstarSub = sol.regime === 'subsonic' ? AR / A_Astar(sol.Me, g) : 1;
  let xs = Infinity;
  if (sol.regime === 'shock-in-nozzle' && sol.As) {
    xs = bisect((x) => nozzleArea(x, AR) - sol.As!, xt + 1e-9, 1);
  }
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const A = nozzleArea(x, AR);
    let M: number;
    let p: number;
    if (sol.regime === 'no-flow') {
      M = 0;
      p = 1;
    } else if (!choked) {
      M = M_from_A_Astar(Math.max(1, A / AstarSub), 'sub', g);
      p = p_p0(M, g);
    } else if (x <= xt) {
      M = M_from_A_Astar(Math.max(1, A), 'sub', g);
      p = p_p0(M, g);
    } else if (sol.regime === 'choked-subsonic') {
      M = M_from_A_Astar(Math.max(1, A), 'sub', g);
      p = p_p0(M, g);
    } else if (x < xs) {
      M = M_from_A_Astar(Math.max(1, A), 'sup', g);
      p = p_p0(M, g);
    } else {
      const r = sol.p0e;
      M = M_from_A_Astar(Math.max(1, A * r), 'sub', g);
      p = r * p_p0(M, g);
    }
    pts.push({ x, A, M, p });
  }
  return { pts, xs: isFinite(xs) ? xs : undefined, xt };
}
