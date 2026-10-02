/**
 * Chapman–Jouguet detonation as "normal shock + Rayleigh heat addition to thermal choking"
 * (Final A P1). Perfect gas with one γ; the heat release enters only through Q = Δq/(cp T1).
 */
import { T0_T } from './isentropic';
import { My, py_px, Ty_Tx } from './normalShock';
import { M_from_T0_T0star, p_pstar, T0_T0star, T_Tstar } from './rayleigh';

/** Δq/(cp T1) for a CJ wave of Mach M: (M² − 1)² / (2(γ+1)M²). */
export const cjHeat = (M: number, g = 1.4) => (M * M - 1) ** 2 / (2 * (g + 1) * M * M);

/** CJ wave Mach from Q = Δq/(cp T1): supersonic root of (M² − 1)² = 2(γ+1)Q M². */
export function cjMach(Q: number, g = 1.4): number {
  const k = 2 * (g + 1) * Q;
  const M2 = (2 + k + Math.sqrt((2 + k) ** 2 - 4)) / 2;
  return Math.sqrt(M2);
}

/**
 * Wave at Mach M1 (≥ M_CJ) with heat release Q. Returns the von Neumann (post-shock) state and the
 * end state, all relative to the unburned gas 1. Returns choked=true if M1 < M_CJ (heat cannot be absorbed).
 */
export function detonation(M1: number, Q: number, g = 1.4) {
  const Mvn = My(M1, g);
  const T01_T1 = T0_T(M1, g);
  const T0star_T1 = T01_T1 / T0_T0star(M1, g); // same Rayleigh line before and after the shock
  const T02_T1 = T01_T1 + Q;
  const choked = T02_T1 > T0star_T1 * (1 + 1e-9);
  const Mend = choked ? 1 : M_from_T0_T0star(T02_T1 / T0star_T1, 'sub', g);
  // reference quantities of the (shared) Rayleigh line, relative to state 1
  const pstar = 1 / p_pstar(M1, g);
  const Tstar = 1 / T_Tstar(M1, g);
  return {
    M1,
    Mcj: cjMach(Q, g),
    choked,
    vn: { M: Mvn, p: py_px(M1, g), T: Ty_Tx(M1, g) },
    end: { M: Mend, p: pstar * p_pstar(Mend, g), T: Tstar * T_Tstar(Mend, g) },
    T0star_T1,
    /** state after a fraction λ of the heat is released (λ ∈ [0,1]) */
    at(lambda: number) {
      const r = Math.min(1, (T01_T1 + lambda * Q) / T0star_T1);
      const M = M_from_T0_T0star(r, 'sub', g);
      return { M, p: pstar * p_pstar(M, g), T: Tstar * T_Tstar(M, g), v: (Tstar * T_Tstar(M, g)) / (pstar * p_pstar(M, g)) };
    },
  };
}

/** Hugoniot p/p1 as a function of v/v1 with heat release Q = Δq/(cp T1) (Q = 0: shock Hugoniot). */
export function hugoniotP(v: number, Q: number, g = 1.4): number {
  const a = g / (g - 1);
  const q = Q * a; // Δq/(p1 v1) = Δq/(R T1) = Q·γ/(γ−1)
  return (a + q - (1 + v) / 2) / (a * v - (1 + v) / 2);
}

/** Rayleigh line through state 1: p/p1 = 1 + γM1²(1 − v/v1). */
export const rayleighLineP = (v: number, M1: number, g = 1.4) => 1 + g * M1 * M1 * (1 - v);
