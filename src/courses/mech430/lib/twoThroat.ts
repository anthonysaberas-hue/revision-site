/** Two-throat channel / blocked supersonic wind tunnel (Quiz 2 F2023 P1; notes Ch. 9). */
import { A_Astar, M_from_A_Astar, p_p0, T_T0 } from './isentropic';
import { Mx_from_p0y_p0x, p0y_p0x } from './normalShock';
import { bisect } from './solve';

/**
 * Solve the F2023 two-throat channel. Areas in any unit; pb as a fraction of p0.
 * blocked: shock 1 after throat 1 with A*_y = A_t2; shock 2 after throat 2, placed so that p_exit = p_b.
 * started: supersonic through both throats; one shock after throat 2, placed so that p_exit = p_b.
 * stateAt(A, seg, x, xs): seg 0 = before t1, 1 = diverging after t1, 2 = converging to t2, 3 = after t2;
 * xs are the shock positions in the caller's own x coordinate.
 */
export function twoThroatSolution(At1: number, At2: number, Ach: number, pb: number) {
  const Mx1 = Mx_from_p0y_p0x(At1 / At2);
  const As1 = A_Astar(Mx1) * At1;
  const p0y = At1 / At2;
  const exitP = (As: number, Astar: number, p0up: number) => {
    const Mx = M_from_A_Astar(As / Astar, 'sup');
    const r = p0y_p0x(Mx);
    const Me = M_from_A_Astar(Math.max(1, Ach / (Astar / r)), 'sub');
    return p0up * r * p_p0(Me);
  };
  const As2 = bisect((A) => exitP(A, At2, p0y) - pb, At2 * 1.0001, Ach * 0.9999);
  const r2 = p0y_p0x(M_from_A_Astar(As2 / At2, 'sup'));
  const As3 = bisect((A) => exitP(A, At1, 1) - pb, At2 * 1.0001, Ach * 0.9999);
  const r3 = p0y_p0x(M_from_A_Astar(As3 / At1, 'sup'));
  const st = (A: number, Astar: number, b: 'sub' | 'sup', p0l: number) => {
    const M = M_from_A_Astar(Math.max(1, A / Astar), b);
    return { M, p: p0l * p_p0(M), T: T_T0(M) };
  };
  const blockedAt = (A: number, seg: number, x: number, xs: number[]) => {
    if (seg === 0) return st(A, At1, 'sub', 1);
    if (seg === 1) return x < xs[0] ? st(A, At1, 'sup', 1) : st(A, At2, 'sub', p0y);
    if (seg === 2) return st(A, At2, 'sub', p0y);
    return x < xs[1] ? st(A, At2, 'sup', p0y) : st(A, At2 / r2, 'sub', p0y * r2);
  };
  const startedAt = (A: number, seg: number, x: number, xs: number[]) => {
    if (seg === 0) return st(A, At1, 'sub', 1);
    if (seg < 3) return st(A, At1, 'sup', 1);
    return x < xs[0] ? st(A, At1, 'sup', 1) : st(A, At1 / r3, 'sub', r3);
  };
  const Minter = M_from_A_Astar(Ach / At2, 'sub');
  return {
    Mx1,
    p0y,
    blocked: {
      shockAreas: [As1, As2],
      Minter,
      pInter: p0y * p_p0(Minter),
      Mx2: M_from_A_Astar(As2 / At2, 'sup'),
      stateAt: blockedAt,
      machAt: (A: number, seg: number, xs: number[], x: number) => blockedAt(A, seg, x, xs).M,
    },
    started: {
      shockAreas: [As3],
      Minter: M_from_A_Astar(Ach / At1, 'sup'),
      Mt2: M_from_A_Astar(At2 / At1, 'sup'),
      stateAt: startedAt,
      machAt: (A: number, seg: number, xs: number[], x: number) => startedAt(A, seg, x, xs).M,
    },
  };
}

