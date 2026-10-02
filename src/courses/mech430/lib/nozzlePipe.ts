/**
 * C-D nozzle feeding a constant-area Fanno pipe, exhausting to back pressure pb.
 * The most-examined MECH 430 problem (Quiz 2 in 2019, 2023, 2024, and finals).
 *
 * Non-dimensional: pressures / p0 (reservoir), areas / At (throat).
 * AR = A_pipe / A_throat (nozzle exit = pipe area), fL = 4fL/D of the whole pipe.
 *
 * Shock position is described by a single coordinate s ∈ [0, 2]:
 *   s ∈ [0, 1] → shock in the diverging nozzle at A/At = 1 + (AR − 1)·s
 *   s ∈ [1, 2] → shock in the pipe at x/L = s − 1
 */
import { A_Astar, M_from_A_Astar, p_p0 } from './isentropic';
import { My as shockMy, p0y_p0x, py_px } from './normalShock';
import { fLmax, M_from_fLmax, p_pstar } from './fanno';
import { bisect } from './solve';

export type PipeRegime =
  | 'subsonic'
  | 'friction-choked'
  | 'shock-in-nozzle'
  | 'shock-in-pipe'
  | 'shock-limited-choked-exit'
  | 'supersonic-exit';

export const PIPE_REGIME_LABEL: Record<PipeRegime, string> = {
  subsonic: 'Subsonic everywhere — not choked; p_exit = p_b',
  'friction-choked': 'Friction-choked: M = 1 at the pipe exit, throat NOT sonic (pipe too long for this nozzle)',
  'shock-in-nozzle': 'Throat choked, normal shock in the diverging nozzle, subsonic Fanno flow in the pipe',
  'shock-in-pipe': 'Throat choked, supersonic into the pipe, normal shock inside the pipe',
  'shock-limited-choked-exit':
    'Exit choked (M = 1) — shock cannot move further downstream; p_exit > p_b and lowering p_b changes nothing inside',
  'supersonic-exit': 'Supersonic all the way to the exit — any adjustment to p_b happens outside (oblique shocks / expansion fans)',
};

interface Pos {
  valid: boolean;
  pe: number;
  Mx: number;
  My: number;
  /** Mach at pipe inlet (after the shock if the shock is in the nozzle) */
  M1: number;
  M2: number;
}

const INVALID: Pos = { valid: false, pe: NaN, Mx: NaN, My: NaN, M1: NaN, M2: NaN };

/** Exit state for a shock at coordinate s. */
export function shockAt(s: number, AR: number, fL: number, g = 1.4): Pos {
  if (s <= 1) {
    const As = 1 + (AR - 1) * s;
    const Mx = As <= 1 ? 1 : M_from_A_Astar(As, 'sup', g);
    const r = p0y_p0x(Mx, g);
    const M1 = M_from_A_Astar(Math.max(1, AR * r), 'sub', g);
    const avail = fLmax(M1, g);
    if (avail < fL - 1e-12) return INVALID;
    const M2 = M_from_fLmax(avail - fL, 'sub', g);
    const pe = r * p_p0(M1, g) * (p_pstar(M2, g) / p_pstar(M1, g));
    return { valid: true, pe, Mx, My: shockMy(Mx, g), M1, M2 };
  }
  const M1 = M_from_A_Astar(AR, 'sup', g);
  const fLs = (s - 1) * fL;
  const availSup = fLmax(M1, g);
  if (availSup < fLs - 1e-12) return INVALID;
  const Mx = M_from_fLmax(Math.max(0, availSup - fLs), 'sup', g);
  const px = p_p0(M1, g) * (p_pstar(Mx, g) / p_pstar(M1, g));
  const My = shockMy(Mx, g);
  const py = px * py_px(Mx, g);
  const rem = fL - fLs;
  const availSub = fLmax(My, g);
  if (availSub < rem - 1e-12) return INVALID;
  const M2 = M_from_fLmax(Math.max(0, availSub - rem), 'sub', g);
  return { valid: true, pe: py * (p_pstar(M2, g) / p_pstar(My, g)), Mx, My, M1, M2 };
}

export interface NozzlePipeSolution {
  regime: PipeRegime;
  /** Shock coordinate (see header) */
  s?: number;
  shockWhere?: 'nozzle' | 'pipe';
  /** As/At if in nozzle, x/L if in pipe */
  shockLoc?: number;
  Mx?: number;
  My?: number;
  /** Mach entering the pipe */
  M1: number;
  /** Mach at pipe exit */
  M2: number;
  /** Static pressure at pipe exit (/p0) */
  pe: number;
  exitChoked: boolean;
  /** ṁ / ṁ(sonic throat) */
  mdotRatio: number;
  thresholds: {
    /** Highest pb for which the throat is sonic (subsonic after) */
    pbChoke?: number;
    /** pb that puts the shock exactly at the pipe entrance */
    pbShockAtPipeEntrance?: number;
    /** pb that puts the shock exactly at the pipe exit */
    pbShockAtExit?: number;
    /** Exit pressure of the fully supersonic solution */
    peSupersonic?: number;
    /** Friction-choked exit pressure (when the pipe is too long for the throat to choke) */
    peFrictionChoked?: number;
    /** Can the flow be supersonic through the whole pipe? (L ≤ L*) */
    supersonicPossible: boolean;
  };
}

function subsonicExitP(M1: number, fL: number, g: number) {
  const M2 = M_from_fLmax(Math.max(0, fLmax(M1, g) - fL), 'sub', g);
  return { M2, pe: p_p0(M1, g) * (p_pstar(M2, g) / p_pstar(M1, g)) };
}

export function solveNozzlePipe(AR: number, fL: number, pb: number, g = 1.4): NozzlePipeSolution {
  const M1tc = M_from_A_Astar(AR, 'sub', g);
  const M1sup = M_from_A_Astar(AR, 'sup', g);
  const supersonicPossible = fLmax(M1sup, g) >= fL;

  // ---- Case A: the pipe is so long that it chokes before the throat can go sonic
  if (fLmax(M1tc, g) < fL) {
    const M1max = M_from_fLmax(fL, 'sub', g);
    const { pe: peFC } = subsonicExitP(M1max, fL, g);
    const thresholds = { peFrictionChoked: peFC, supersonicPossible: false };
    if (pb >= peFC) {
      const M1 = bisect((m) => subsonicExitP(m, fL, g).pe - pb, 1e-6, M1max);
      const { M2 } = subsonicExitP(M1, fL, g);
      return { regime: 'subsonic', M1, M2, pe: pb, exitChoked: false, mdotRatio: AR / A_Astar(M1, g), thresholds };
    }
    return { regime: 'friction-choked', M1: M1max, M2: 1, pe: peFC, exitChoked: true, mdotRatio: AR / A_Astar(M1max, g), thresholds };
  }

  // ---- Case B: the throat can choke
  const { pe: pbChoke } = subsonicExitP(M1tc, fL, g);
  const at1 = shockAt(1, AR, fL, g);
  const thresholds: NozzlePipeSolution['thresholds'] = {
    pbChoke,
    pbShockAtPipeEntrance: at1.valid ? at1.pe : undefined,
    supersonicPossible,
  };
  if (supersonicPossible) {
    const M2s = M_from_fLmax(fLmax(M1sup, g) - fL, 'sup', g);
    const peSup = p_p0(M1sup, g) * (p_pstar(M2s, g) / p_pstar(M1sup, g));
    thresholds.peSupersonic = peSup;
    thresholds.pbShockAtExit = peSup * py_px(M2s, g);
  }

  if (pb >= pbChoke) {
    const M1 = bisect((m) => subsonicExitP(m, fL, g).pe - pb, 1e-6, M1tc);
    const { M2 } = subsonicExitP(M1, fL, g);
    return { regime: 'subsonic', M1, M2, pe: pb, exitChoked: M2 > 0.9999, mdotRatio: AR / A_Astar(M1, g), thresholds };
  }

  // Scan the shock coordinate to find the contiguous valid range starting at the throat
  const N = 800;
  let sMax = 2;
  let prevS = 0;
  for (let i = 1; i <= N; i++) {
    const s = (2 * i) / N;
    if (!shockAt(s, AR, fL, g).valid) {
      // shrink [valid, invalid] bracket and keep the valid end
      let lo = prevS;
      let hi = s;
      for (let k = 0; k < 60; k++) {
        const mid = 0.5 * (lo + hi);
        if (shockAt(mid, AR, fL, g).valid) lo = mid;
        else hi = mid;
      }
      sMax = lo;
      break;
    }
    prevS = s;
  }
  const atMax = shockAt(sMax, AR, fL, g);
  const pack = (s: number, regime: PipeRegime, p: Pos): NozzlePipeSolution => ({
    regime,
    s,
    shockWhere: s <= 1 ? 'nozzle' : 'pipe',
    shockLoc: s <= 1 ? 1 + (AR - 1) * s : s - 1,
    Mx: p.Mx,
    My: p.My,
    M1: p.M1,
    M2: p.M2,
    pe: p.pe,
    exitChoked: p.M2 > 0.9999,
    mdotRatio: 1,
    thresholds,
  });

  if (pb >= atMax.pe) {
    const s = bisect((x) => shockAt(x, AR, fL, g).pe - pb, 0, sMax);
    const p = shockAt(s, AR, fL, g);
    return pack(s, s <= 1 ? 'shock-in-nozzle' : 'shock-in-pipe', p);
  }
  if (sMax < 2 - 1e-9) {
    return pack(sMax, 'shock-limited-choked-exit', atMax);
  }
  // Fully supersonic pipe; shock (if any) sits outside
  const M2 = M_from_fLmax(fLmax(M1sup, g) - fL, 'sup', g);
  return {
    regime: 'supersonic-exit',
    M1: M1sup,
    M2,
    pe: thresholds.peSupersonic!,
    exitChoked: false,
    mdotRatio: 1,
    thresholds,
  };
}

/**
 * Sample M and p/p0 along nozzle (x ∈ [0,1], throat at 0.35) and pipe (x ∈ [1, 2]).
 */
export function nozzlePipeProfile(AR: number, fL: number, sol: NozzlePipeSolution, n = 200, g = 1.4) {
  const xt = 0.35;
  const area = (x: number) => {
    if (x <= xt) return 1 + 1.5 * 0.5 * (1 + Math.cos((Math.PI * x) / xt));
    return 1 + (AR - 1) * 0.5 * (1 - Math.cos((Math.PI * (x - xt)) / (1 - xt)));
  };
  // shock x-position on the plot
  let xShock: number | undefined;
  if (sol.shockWhere === 'nozzle' && sol.shockLoc) {
    xShock = bisect((x) => area(x) - sol.shockLoc!, xt, 1);
  } else if (sol.shockWhere === 'pipe' && sol.shockLoc !== undefined) {
    xShock = 1 + sol.shockLoc;
  }
  const choked = sol.regime !== 'subsonic' && sol.regime !== 'friction-choked';
  const AstarEff = choked ? 1 : AR / A_Astar(sol.M1, g);
  const pts: { x: number; M: number; p: number; A: number }[] = [];
  const r = sol.shockWhere === 'nozzle' && sol.Mx ? p0y_p0x(sol.Mx, g) : 1;
  for (let i = 0; i <= 2 * n; i++) {
    const x = i / n;
    let M: number;
    let p: number;
    if (x <= 1) {
      const A = area(x);
      const supersonicHere = choked && x > xt && (xShock === undefined || x < xShock);
      if (!choked) {
        M = M_from_A_Astar(Math.max(1, A / AstarEff), 'sub', g);
        p = p_p0(M, g);
      } else if (x <= xt || supersonicHere) {
        M = M_from_A_Astar(Math.max(1, A), x <= xt ? 'sub' : 'sup', g);
        p = p_p0(M, g);
      } else if (sol.shockWhere === 'nozzle') {
        M = M_from_A_Astar(Math.max(1, A * r), 'sub', g);
        p = r * p_p0(M, g);
      } else {
        // choked but no shock in nozzle and not supersonic → the subsonic choked branch
        M = M_from_A_Astar(Math.max(1, A), 'sub', g);
        p = p_p0(M, g);
      }
      pts.push({ x, M, p, A });
    } else {
      const frac = x - 1;
      const M1 = sol.M1;
      const p1 = sol.shockWhere === 'nozzle' ? r * p_p0(M1, g) : p_p0(M1, g);
      if (sol.shockWhere === 'pipe' && xShock !== undefined && x >= xShock) {
        // downstream of a pipe shock
        const fLs = (xShock - 1) * fL;
        const Mx = sol.Mx!;
        const px = p1 * (p_pstar(Mx, g) / p_pstar(M1, g));
        const py = px * py_px(Mx, g);
        const My = sol.My!;
        const used = (frac - (xShock - 1)) * fL;
        M = M_from_fLmax(Math.max(0, fLmax(My, g) - used), 'sub', g);
        p = py * (p_pstar(M, g) / p_pstar(My, g));
        void fLs;
      } else {
        const branch = M1 < 1 ? 'sub' : 'sup';
        M = M_from_fLmax(Math.max(0, fLmax(M1, g) - frac * fL), branch, g);
        p = p1 * (p_pstar(M, g) / p_pstar(M1, g));
      }
      pts.push({ x, M, p, A: AR });
    }
  }
  return { pts, xShock, xt };
}
