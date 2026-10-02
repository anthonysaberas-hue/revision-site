/**
 * Physics behind the 3D rocket-engine explorer. Everything the plume does is computed
 * from the same MECH 430 relations used in the notes (Ch. 6, 12, 13) — nothing is hand-tuned
 * except the visual scale factors at the bottom.
 *
 * Generic methane/oxygen engine (combustion products: γ ≈ 1.2, MW ≈ 21.5).
 */
import { A_Astar, massFlux, M_from_p_p0, p_p0 } from '../lib/isentropic';
import { nu, nuMax } from '../lib/prandtlMeyer';
import { obliqueFromSigma, sigmaFromPressureRatio } from '../lib/obliqueShock';
import { exitVelocity } from '../lib/rocket';
import { gasR } from '../lib/gas';

export const ENGINE = {
  name: 'Generic full-flow methalox engine',
  gamma: 1.2,
  MW: 21.5,
  T0: 3600, // K, chamber stagnation temperature
  p0max: 250e5, // Pa, chamber pressure at 100% throttle
  peDesign: 0.94e5, // Pa, exit pressure at 100% (slightly below sea-level ambient)
  mdotMax: 700, // kg/s at 100%
  g0: 9.80665,
};

export type AltitudeKey = 'sea' | 'mid' | 'vac';
export const ALTITUDES: Record<AltitudeKey, { label: string; pa: number; km: number }> = {
  sea: { label: 'Sea level', pa: 101325, km: 0 },
  mid: { label: '14 km', pa: 14170, km: 14 },
  vac: { label: 'Vacuum', pa: 0, km: Infinity },
};

const g = ENGINE.gamma;
const R = gasR(ENGINE.MW);
/** Fixed geometry, sized so that at 100% throttle p_e = peDesign and ṁ = mdotMax */
export const GEOM = (() => {
  const Me = M_from_p_p0(ENGINE.peDesign / ENGINE.p0max, g);
  const AR = A_Astar(Me, g);
  const At = ENGINE.mdotMax / massFlux(1, ENGINE.p0max, ENGINE.T0, R, g);
  const Ae = AR * At;
  return { Me, AR, At, Ae, Rt: Math.sqrt(At / Math.PI), Re: Math.sqrt(Ae / Math.PI), De: 2 * Math.sqrt(Ae / Math.PI) };
})();

export type Regime = 'off' | 'separated' | 'over' | 'ideal' | 'under' | 'vacuum';

export interface EngineState {
  throttle: number;
  p0: number;
  mdot: number;
  pe: number;
  pa: number;
  Ve: number;
  thrust: number;
  momentumThrust: number;
  pressureThrust: number;
  Isp: number;
  /** p_e / p_a */
  ratio: number;
  regime: Regime;
  /** Fully-expanded jet Mach (the Mach the jet reaches once its pressure matches ambient) */
  Mj: number;
  /** Flow turning at the nozzle lip, degrees. + = outward (expansion fan), − = inward (oblique shock) */
  lipAngle: number;
  /** Shock-cell (diamond) spacing / exit diameter (Pack's formula ≈ 1.31 √(Mj² − 1)) */
  cellSpacing_De: number;
}

export function engineState(throttle: number, pa: number): EngineState {
  const t = Math.max(0, Math.min(1, throttle));
  const p0 = t * ENGINE.p0max;
  if (t < 0.02) {
    return { throttle: t, p0, mdot: 0, pe: 0, pa, Ve: 0, thrust: 0, momentumThrust: 0, pressureThrust: 0, Isp: 0, ratio: 0, regime: 'off', Mj: 0, lipAngle: 0, cellSpacing_De: 0 };
  }
  const { Me, At, Ae } = GEOM;
  const mdot = At * massFlux(1, p0, ENGINE.T0, R, g); // choked throat: ṁ ∝ p0
  const pe = p0 * p_p0(Me, g); // shock-free nozzle: pe ∝ p0
  const Ve = exitVelocity(pe / p0, ENGINE.T0, R, g);
  const momentumThrust = mdot * Ve;
  const pressureThrust = Ae * (pe - pa);
  const thrust = momentumThrust + pressureThrust;
  const ratio = pa > 0 ? pe / pa : Infinity;
  let regime: Regime;
  if (pa === 0) regime = 'vacuum';
  else if (ratio < 0.4) regime = 'separated'; // Summerfield criterion ~ p_e < 0.4 p_a
  else if (ratio < 0.97) regime = 'over';
  else if (ratio <= 1.03) regime = 'ideal';
  else regime = 'under';

  const Mj = pa > 0 ? M_from_p_p0(Math.min(pa / p0, 0.999), g) : Infinity;
  let lipAngle = 0;
  if (regime === 'vacuum') lipAngle = nuMax(g) - nu(Me, g);
  else if (ratio > 1) lipAngle = nu(Mj, g) - nu(Me, g); // Prandtl–Meyer fan at the lip
  else if (ratio < 1) {
    // oblique shock at the lip raising p from pe to pa
    try {
      lipAngle = -obliqueFromSigma(Me, sigmaFromPressureRatio(Me, Math.min(pa / pe, 1 / 0.4), g), g).delta;
    } catch {
      lipAngle = -10;
    }
  }
  const MjFinite = isFinite(Mj) ? Mj : 8;
  const cellSpacing_De = 1.31 * Math.sqrt(Math.max(0, MjFinite * MjFinite - 1));
  return { throttle: t, p0, mdot, pe, pa, Ve, thrust, momentumThrust, pressureThrust, Isp: thrust / (mdot * ENGINE.g0), ratio, regime, Mj, lipAngle, cellSpacing_De };
}

export const REGIME_TEXT: Record<Regime, string> = {
  off: 'Engine off — no flow.',
  separated: 'Flow separation — exit pressure far below ambient; the jet peels off the nozzle wall inside the bell.',
  over: 'Over-expanded — the jet leaves below ambient pressure, so the air pinches it through oblique shocks at the lip.',
  ideal: 'Ideally expanded — exit pressure matches ambient, the jet leaves straight.',
  under: 'Under-expanded — the jet leaves above ambient pressure and fans outward through Prandtl–Meyer expansions.',
  vacuum: 'Vacuum — nothing to push back, the jet expands without limit; no shocks, no diamonds.',
};

/** Shock cells are drawn compressed along the axis so several fit on screen (real spacing ≈ 5 D_e). */
export const DIAMOND_DISPLAY_SCALE = 0.3;

/** Visual plume parameters derived from the state (scene units = metres). */
export function plumeVisual(s: EngineState) {
  const { De, Re } = GEOM;
  const on = s.regime === 'off' ? 0 : 1;
  const t = s.throttle;
  const spread = Math.max(-12, Math.min(34, s.lipAngle * (s.regime === 'vacuum' ? 0.45 : 0.55))); // deg, capped for display
  const baseLen = s.regime === 'vacuum' ? 12 : s.regime === 'under' ? 10 : 9;
  const length = on * De * baseLen * (0.45 + 0.55 * t);
  const spacing = Math.max(0.35, s.cellSpacing_De * De * DIAMOND_DISPLAY_SCALE);
  const maxD = s.regime === 'under' ? 3 : 6;
  const nDiamonds = s.pa > 0 && on ? Math.max(0, Math.min(maxD, Math.floor((length * 0.85) / spacing))) : 0;
  const mismatch = s.pa > 0 ? Math.abs(Math.log(Math.max(1e-3, s.ratio))) : 0;
  const diamondStrength = s.pa > 0 ? Math.min(1, 0.55 + 0.9 * mismatch) * (s.regime === 'under' ? 0.6 : 1) : 0;
  const pinch = s.regime === 'over' || s.regime === 'separated' ? Math.min(0.35, 0.08 + (1 - s.ratio) * 0.6) : 0;
  return {
    on,
    Re,
    length,
    spreadDeg: spread,
    spacing,
    nDiamonds,
    diamondStrength,
    pinch,
    intensity: on * (0.35 + 0.65 * t),
    vacuum: s.regime === 'vacuum' ? 1 : 0,
  };
}
