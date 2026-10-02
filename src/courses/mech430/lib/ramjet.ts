/**
 * Ideal ramjet (Final B P3, semester project RJ43-9):
 * started inlet (isentropic to a throat at M = 1) → normal shock in the diverging part →
 * isentropic subsonic diffuser → constant-area Rayleigh combustor → isentropic C-D nozzle.
 * Built only from the tested table functions. SI units (Pa, K, m², J/kg).
 */
import { A_Astar, M_from_A_Astar, M_from_p_p0, p_p0, T0_T, T_T0 } from './isentropic';
import { Mx_from_p0y_p0x, My, p0y_p0x } from './normalShock';
import { M_from_T0_T0star, p0_p0star, T0_T0star } from './rayleigh';

export interface Flight {
  M0: number;
  /** free-stream static T [K] and p [Pa] */
  T: number;
  p: number;
  R: number;
  cp: number;
  g?: number;
}

export interface RamjetDesignInput extends Flight {
  Ain: number;
  Ashock: number;
  Acomb: number;
  /** heat added per kg of air [J/kg] */
  q: number;
}

export interface RamjetState {
  status: 'started' | 'unstart' | 'shock-at-combustor';
  At1: number;
  Ashock: number;
  Mx: number;
  My: number;
  p0x: number;
  T01: number;
  p0y: number;
  Asy: number;
  Mc: number;
  T0star: number;
  qStar: number;
  T02: number;
  M2: number;
  p0star: number;
  p02: number;
  At2: number;
  Me: number;
  pe: number;
  Ae: number;
  Te: number;
  Ve: number;
  V0: number;
  mdot: number;
  F: number;
}

/** Design problem (Final B P3 a–b): shock position given, size the nozzle for p_e = p∞. */
export function ramjetDesign(inp: RamjetDesignInput): RamjetState {
  const g = inp.g ?? 1.4;
  const { M0, T, p, R, cp, Ain, Ashock, Acomb, q } = inp;
  const At1 = Ain / A_Astar(M0, g);
  const Mx = M_from_A_Astar(Ashock / At1, 'sup', g);
  const p0x = p / p_p0(M0, g);
  const T01 = T * T0_T(M0, g);
  const r = p0y_p0x(Mx, g);
  const p0y = p0x * r;
  const Asy = At1 / r;
  const Mc = M_from_A_Astar(Acomb / Asy, 'sub', g);
  const T0star = T01 / T0_T0star(Mc, g);
  const qStar = cp * (T0star - T01);
  const T02 = T01 + q / cp;
  const M2 = T02 >= T0star ? 1 : M_from_T0_T0star(T02 / T0star, 'sub', g);
  const p0star = p0y / p0_p0star(Mc, g);
  const p02 = p0star * p0_p0star(M2, g);
  const At2 = Acomb / A_Astar(M2, g);
  const Me = M_from_p_p0(p / p02, g);
  const Ae = At2 * A_Astar(Me, g);
  return finish({ ...inp, g }, 'started', { At1, Ashock, Mx, My: My(Mx, g), p0x, T01, p0y, Asy, Mc, T0star, qStar, T02, M2, p0star, p02, At2, Me, Ae });
}

function finish(
  inp: Flight & { Ain: number; g: number },
  status: RamjetState['status'],
  s: Omit<RamjetState, 'status' | 'pe' | 'Te' | 'Ve' | 'V0' | 'mdot' | 'F'>,
): RamjetState {
  const { g, R, T, p, M0, Ain } = inp;
  const V0 = M0 * Math.sqrt(g * R * T);
  const mdot = (p / (R * T)) * V0 * Ain;
  const pe = s.p02 * p_p0(s.Me, g);
  const Te = s.T02 * T_T0(s.Me, g);
  const Ve = s.Me * Math.sqrt(g * R * Te);
  const F = mdot * (Ve - V0) + (pe - p) * s.Ae;
  return { status, ...s, pe, Te, Ve, V0, mdot, F };
}

export interface RamjetGeometry {
  Ain: number;
  At1: number;
  Acomb: number;
  At2: number;
  Ae: number;
}

/**
 * Off-design: FIXED geometry, new heat addition q. The nozzle throat pins the combustor exit Mach
 * (M2 = subsonic root of A_comb/A_t2), so the heat sets T0* and thus the combustor-entry Mach;
 * mass conservation through the diffuser then fixes the shock strength (A*y = A_comb/(A/A*)(Mc),
 * p0y/p0x = A_t1/A*y). More heat → lower Mc → smaller A*y → weaker shock → the shock walks upstream.
 * When it reaches the inlet throat (Mx = 1) any extra heat expels it: UNSTART.
 */
export function ramjetOffDesign(flight: Flight, geom: RamjetGeometry, q: number): RamjetState & { qMax: number; qMin: number } {
  const g = flight.g ?? 1.4;
  const { cp, M0, T, p } = flight;
  const { Ain, At1, Acomb, At2, Ae } = geom;
  const p0x = p / p_p0(M0, g);
  const T01 = T * T0_T(M0, g);
  const M2 = M_from_A_Astar(Acomb / At2, 'sub', g);
  const Me = M_from_A_Astar(Ae / At2, 'sup', g);
  const lim = ramjetLimits(flight, geom);
  const T02 = T01 + q / cp;
  const T0star = T02 / T0_T0star(M2, g);
  const Mc = M_from_T0_T0star(T01 / T0star, 'sub', g);
  const Asy = Acomb / A_Astar(Mc, g);
  const r = At1 / Asy;
  const MxMax = M_from_A_Astar(Acomb / At1, 'sup', g);
  let status: RamjetState['status'] = 'started';
  let Mx: number;
  if (r > 1) {
    status = 'unstart';
    Mx = 1;
  } else if (r < p0y_p0x(MxMax, g)) {
    status = 'shock-at-combustor';
    Mx = MxMax;
  } else Mx = Mx_from_p0y_p0x(r, g);
  const p0y = p0x * Math.min(1, r);
  const p0star = p0y / p0_p0star(Mc, g);
  const p02 = p0star * p0_p0star(M2, g);
  const base = finish({ ...flight, g, Ain }, status, {
    At1,
    Ashock: At1 * A_Astar(Mx, g),
    Mx,
    My: My(Mx, g),
    p0x,
    T01,
    p0y,
    Asy,
    Mc,
    T0star,
    qStar: cp * (T0star - T01),
    T02,
    M2,
    p0star,
    p02,
    At2,
    Me,
    Ae,
  });
  return { ...base, qMax: lim.qMax, qMin: lim.qMin };
}

/** Heat window of a fixed ramjet: qMin puts the shock at the combustor face, qMax at the inlet throat. */
export function ramjetLimits(flight: Flight, geom: RamjetGeometry) {
  const g = flight.g ?? 1.4;
  const { cp, M0, T } = flight;
  const { At1, Acomb, At2 } = geom;
  const T01 = T * T0_T(M0, g);
  const M2 = M_from_A_Astar(Acomb / At2, 'sub', g);
  const qFor = (Asy: number) => {
    const Mc = M_from_A_Astar(Acomb / Asy, 'sub', g);
    const T0star = T01 / T0_T0star(Mc, g);
    return cp * (T0star * T0_T0star(M2, g) - T01);
  };
  const MxMax = M_from_A_Astar(Acomb / At1, 'sup', g);
  return { qMax: qFor(At1), qMin: qFor(At1 / p0y_p0x(MxMax, g)) };
}
