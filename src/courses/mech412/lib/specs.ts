/**
 * Second-order time-domain specifications, G(s) = wn^2 / (s^2 + 2 zeta wn s + wn^2), 0 < zeta < 1,
 * in both directions, plus measurement of the same quantities from a simulated step response.
 */
import { C, c, toDeg } from './complex';

/** Percent overshoot from the damping ratio: OS = 100 exp(-pi zeta / sqrt(1 - zeta^2)). */
export const osFromZeta = (zeta: number): number => (zeta >= 1 ? 0 : 100 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)));

/** Damping ratio from percent overshoot (0 < OS < 100): zeta = -ln(OS/100) / sqrt(pi^2 + ln^2(OS/100)). */
export function zetaFromOS(osPercent: number): number {
  const l = Math.log(osPercent / 100);
  return -l / Math.sqrt(Math.PI * Math.PI + l * l);
}

/** Damped natural frequency wd = wn sqrt(1 - zeta^2). */
export const wd = (wn: number, zeta: number): number => wn * Math.sqrt(1 - zeta * zeta);
/** Pole angle beta measured from the NEGATIVE real axis, in degrees: beta = acos(zeta). */
export const poleAngleDeg = (zeta: number): number => toDeg(Math.acos(zeta));
/** Damping ratio from the pole angle beta (degrees from the negative real axis). */
export const zetaFromAngleDeg = (beta: number): number => Math.cos((beta * Math.PI) / 180);

/** Rise time 0 -> 100 % (underdamped): tr = (pi - beta) / wd, with beta = acos(zeta) in radians. */
export const riseTime = (wn: number, zeta: number): number => (Math.PI - Math.acos(zeta)) / wd(wn, zeta);
/** Peak time tp = pi / wd. */
export const peakTime = (wn: number, zeta: number): number => Math.PI / wd(wn, zeta);
/** Settling time to within 2 %: ts = 4 / (zeta wn). */
export const settling2 = (wn: number, zeta: number): number => 4 / (zeta * wn);
/** Settling time to within 5 %: ts = 3 / (zeta wn). */
export const settling5 = (wn: number, zeta: number): number => 3 / (zeta * wn);

export interface SecondOrderSpecs {
  wn: number;
  zeta: number;
  wd: number;
  /** percent overshoot */
  os: number;
  tr: number;
  tp: number;
  ts2: number;
  ts5: number;
  /** poles -zeta wn +/- j wd */
  poles: [C, C];
  betaDeg: number;
}

/** All the standard specs from (wn, zeta). */
export function specsFromWnZeta(wn: number, zeta: number): SecondOrderSpecs {
  const w = wd(wn, zeta);
  return {
    wn,
    zeta,
    wd: w,
    os: osFromZeta(zeta),
    tr: riseTime(wn, zeta),
    tp: peakTime(wn, zeta),
    ts2: settling2(wn, zeta),
    ts5: settling5(wn, zeta),
    poles: [c(-zeta * wn, w), c(-zeta * wn, -w)],
    betaDeg: poleAngleDeg(zeta),
  };
}

/** (wn, zeta, DC gain) read off K / (s^2 + a1 s + a0): wn = sqrt(a0), zeta = a1 / (2 wn), gain K / a0. */
export function secondOrderFromDen(a1: number, a0: number, K = a0): { wn: number; zeta: number; gain: number } {
  const wn = Math.sqrt(a0);
  return { wn, zeta: a1 / (2 * wn), gain: K / a0 };
}

/** Design direction: the dominant-pole requirements OS <= osMax and ts <= tsMax give zeta >= zMin and wn >= ... */
export function designFromSpecs(osMax: number, tsMax: number, settlingPercent: 2 | 5 = 2): { zeta: number; sigma: number; wnMin: number; betaDeg: number } {
  const zeta = zetaFromOS(osMax);
  const sigma = (settlingPercent === 2 ? 4 : 3) / tsMax; // zeta*wn
  return { zeta, sigma, wnMin: sigma / zeta, betaDeg: poleAngleDeg(zeta) };
}

export interface StepInfo {
  finalValue: number;
  peak: number;
  peakTime: number;
  /** percent overshoot relative to the final value */
  overshoot: number;
  /** 10-90 % rise time */
  rise1090: number;
  /** first time the response reaches 100 % of the final value */
  rise0100: number;
  settling2: number;
  settling5: number;
}

/** First crossing time of `level` by linear interpolation, or NaN. */
function firstCrossing(t: number[], y: number[], level: number): number {
  for (let k = 1; k < t.length; k++) {
    if ((y[k - 1] - level) * (y[k] - level) <= 0 && y[k] !== y[k - 1]) {
      return t[k - 1] + ((level - y[k - 1]) / (y[k] - y[k - 1])) * (t[k] - t[k - 1]);
    }
  }
  return NaN;
}

/**
 * Measure a unit-step response. `finalValue` defaults to the last sample (so simulate long enough).
 * Settling time = last time the response is outside the +/- band around the final value.
 */
export function stepInfo(t: number[], y: number[], finalValue = y[y.length - 1]): StepInfo {
  let ip = 0;
  for (let k = 1; k < y.length; k++) if (y[k] > y[ip]) ip = k;
  const overshoot = Math.max(0, ((y[ip] - finalValue) / Math.abs(finalValue)) * 100);
  const settle = (band: number) => {
    for (let k = y.length - 1; k >= 0; k--) {
      if (Math.abs(y[k] - finalValue) > band * Math.abs(finalValue)) return k === y.length - 1 ? NaN : t[k + 1];
    }
    return t[0];
  };
  const t10 = firstCrossing(t, y, 0.1 * finalValue);
  const t90 = firstCrossing(t, y, 0.9 * finalValue);
  return {
    finalValue,
    peak: y[ip],
    peakTime: t[ip],
    overshoot,
    rise1090: t90 - t10,
    rise0100: firstCrossing(t, y, finalValue),
    settling2: settle(0.02),
    settling5: settle(0.05),
  };
}
