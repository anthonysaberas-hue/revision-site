/** Rocket nozzles (notes §6.3). SI units. */
import { A_Astar, chokedMassFlow, M_from_A_Astar, M_from_p_p0, p_p0 } from './isentropic';

export interface RocketInput {
  p0: number;
  T0: number;
  R: number;
  g: number;
  /** Throat area m² */
  At: number;
  /** Exit/throat area ratio */
  AR: number;
  /** Ambient pressure */
  pa: number;
}

/** Exit velocity from the general rocket nozzle equation. */
export const exitVelocity = (pe_p0: number, T0: number, R: number, g: number) =>
  Math.sqrt(((2 * g) / (g - 1)) * R * T0 * (1 - Math.pow(pe_p0, (g - 1) / g)));

export function rocket({ p0, T0, R, g, At, AR, pa }: RocketInput) {
  // assume shock-free supersonic nozzle flow (valid when pa is not too high)
  const Me = M_from_A_Astar(AR, 'sup', g);
  const pe = p0 * p_p0(Me, g);
  const mdot = chokedMassFlow(At, p0, T0, R, g);
  const Ve = exitVelocity(pe / p0, T0, R, g);
  const Ae = AR * At;
  const momentum = mdot * Ve;
  const pressure = Ae * (pe - pa);
  const F = momentum + pressure;
  return { Me, pe, mdot, Ve, Ae, momentum, pressure, F, Isp: F / mdot };
}

/** Area ratio for optimum (matched) expansion to ambient pa. */
export function optimumAreaRatio(p0: number, pa: number, g = 1.4) {
  const Me = M_from_p_p0(pa / p0, g);
  return { Me, AR: A_Astar(Me, g) };
}

/** Vacuum thrust of an infinite area-ratio nozzle: F = ṁ·V_max. */
export const infiniteNozzleVe = (T0: number, R: number, g: number) => Math.sqrt(((2 * g) / (g - 1)) * R * T0);
