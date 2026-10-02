/**
 * Time-domain plant models used by the 3D labs (real-time, nonlinear where the physics is nonlinear).
 * Every model is a pure function of its state, so tests can compare it against the linear TF results.
 */

export type Vec = number[];
export type Deriv = (x: Vec, t: number) => Vec;

/** One classical RK4 step */
export function rk4(f: Deriv, x: Vec, t: number, dt: number): Vec {
  const k1 = f(x, t);
  const x2 = x.map((v, i) => v + 0.5 * dt * k1[i]);
  const k2 = f(x2, t + 0.5 * dt);
  const x3 = x.map((v, i) => v + 0.5 * dt * k2[i]);
  const k3 = f(x3, t + 0.5 * dt);
  const x4 = x.map((v, i) => v + dt * k3[i]);
  const k4 = f(x4, t + dt);
  return x.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/** Advance `x` by `T` seconds using sub-steps of at most `hMax` */
export function advance(f: Deriv, x: Vec, t: number, T: number, hMax = 1e-3): Vec {
  const n = Math.max(1, Math.ceil(T / hMax));
  const h = T / n;
  let s = x;
  for (let i = 0; i < n; i++) s = rk4(f, s, t + i * h, h);
  return s;
}

/* ------------------------------------------------------------------ mass–spring–damper */
export interface MSDParams {
  m: number;
  b: number;
  k: number;
}
/** state [x, v]; input force F(t) */
export const msdDeriv = (p: MSDParams, F: (t: number) => number): Deriv => (s, t) => [s[1], (F(t) - p.b * s[1] - p.k * s[0]) / p.m];
export const msdWn = (p: MSDParams) => Math.sqrt(p.k / p.m);
export const msdZeta = (p: MSDParams) => p.b / (2 * Math.sqrt(p.k * p.m));

/* ------------------------------------------------------------------ DC motor (armature controlled) */
export interface MotorParams {
  Ra: number;
  La: number;
  J: number;
  B: number;
  Kt: number; // torque constant = back-emf constant (SI)
}
/** state [i, w, theta]; inputs: armature voltage v, load torque TL */
export const motorDeriv = (p: MotorParams, v: (t: number, s: Vec) => number, TL: (t: number) => number): Deriv => (s, t) => {
  const [i, w] = s;
  const va = v(t, s);
  return [(va - p.Ra * i - p.Kt * w) / p.La, (p.Kt * i - p.B * w - TL(t)) / p.J, w];
};
/** Closed-form DC gain speed per volt (no load) */
export const motorDcGain = (p: MotorParams) => p.Kt / (p.Ra * p.B + p.Kt * p.Kt);

/* ------------------------------------------------------------------ two interacting tanks */
export interface TankParams {
  A1: number;
  A2: number;
  Rb: number; // between tanks, Δh = Rb * q1
  Rc: number; // outlet, h2 = Rc * qout
}
/** state [h1, h2]; inputs qin(t) and disturbance qd(t) into tank 2 */
export const tanksDeriv = (p: TankParams, qin: (t: number, s: Vec) => number, qd: (t: number) => number): Deriv => (s, t) => {
  const q1 = (s[0] - s[1]) / p.Rb;
  const qout = s[1] / p.Rc;
  return [(qin(t, s) - q1) / p.A1, (q1 + qd(t) - qout) / p.A2];
};
/** Denominator coefficients of Qout/Qin = 1/(RbC1RcC2 s² + (RbC1+RcC2+RcC1)s + 1) */
export const tanksPoly = (p: TankParams) => [p.Rb * p.A1 * p.Rc * p.A2, p.Rb * p.A1 + p.Rc * p.A2 + p.Rc * p.A1, 1];

/* ------------------------------------------------------------------ hydraulic servo with lever + dashpot-spring feedback */
export interface ServoParams {
  K: number; // y' = K x
  a1: number;
  a2: number;
  b: number; // dashpot
  k: number; // spring
}
/** state [y, z]; input e(t). x = a2/(a1+a2) e − a1/(a1+a2) z ; z' = y' − (k/b) z */
export const servoDeriv = (p: ServoParams, e: (t: number) => number): Deriv => (s, t) => {
  const x = (p.a2 / (p.a1 + p.a2)) * e(t) - (p.a1 / (p.a1 + p.a2)) * s[1];
  const yd = p.K * x;
  return [yd, yd - (p.k / p.b) * s[1]];
};

/* ------------------------------------------------------------------ cart + pendulum (nonlinear) */
export interface CartPoleParams {
  M: number;
  m: number;
  L: number; // pivot to bob (point mass)
  g: number;
  c: number; // cart viscous friction
}
/** state [x, xd, th, thd], th measured from upright; input force u on the cart */
export const cartPoleDeriv = (p: CartPoleParams, u: (t: number, s: Vec) => number): Deriv => (s, t) => {
  const [, xd, th, thd] = s;
  const F = u(t, s);
  const sn = Math.sin(th);
  const cs = Math.cos(th);
  const den = p.M + p.m * sn * sn;
  const xdd = (F - p.c * xd + p.m * p.L * thd * thd * sn - p.m * p.g * sn * cs) / den;
  const thdd = (p.g * sn - xdd * cs) / p.L;
  return [xd, xdd, thd, thdd];
};
/** Linearised upright model: M L θ'' = (M+m) g θ − u (u = force on the cart, +x tilts the bob back); same form as the rocket-attitude problem F2010 P4 */
export const uprightPole = (p: CartPoleParams) => Math.sqrt(((p.M + p.m) * p.g) / (p.M * p.L));

/* ------------------------------------------------------------------ car on a hill (cruise control) */
export interface CarParams {
  m: number;
  b: number; // drag coefficient: F_drag = b v
  g: number;
}
/** state [v, integral]; throttle force from `force(t, s)`; road grade angle (rad) from grade(t) */
export const carDeriv = (p: CarParams, force: (t: number, s: Vec) => number, grade: (t: number) => number): Deriv => (s, t) => [
  (force(t, s) - p.b * s[0] - p.m * p.g * Math.sin(grade(t))) / p.m,
  0,
];

/* ------------------------------------------------------------------ PID helper */
export interface PIDState {
  integ: number;
  prevErr: number;
  dFilt: number;
}
export function pidStep(st: PIDState, err: number, dt: number, Kp: number, Ki: number, Kd: number, N = 20, limit = Infinity): number {
  st.integ += err * dt;
  const raw = (err - st.prevErr) / Math.max(dt, 1e-9);
  st.dFilt += (raw - st.dFilt) * Math.min(1, N * dt); // first-order filtered derivative
  st.prevErr = err;
  const u = Kp * err + Ki * st.integ + Kd * st.dFilt;
  if (Math.abs(u) > limit) st.integ -= err * dt; // crude anti-windup
  return Math.max(-limit, Math.min(limit, u));
}
export const newPID = (): PIDState => ({ integ: 0, prevErr: 0, dFilt: 0 });
