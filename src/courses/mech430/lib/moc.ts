/**
 * 2-D steady, planar, irrotational, isentropic Method of Characteristics (notes Ch. 15).
 *
 * Course convention (Higgins; PS10, Final A/B):
 *   C_I  = ν + θ  is constant along RIGHT-running characteristics (C⁻, slope dy/dx = tan(θ − μ), descending)
 *   C_II = ν − θ  is constant along LEFT-running  characteristics (C⁺, slope dy/dx = tan(θ + μ), ascending)
 *   interior point: θ = (C_I − C_II)/2, ν = (C_I + C_II)/2
 *   upper-wall point (reached by a left-running line, carrying C_II): ν = C_II + θ_wall
 *   lower-wall point (reached by a right-running line, carrying C_I):  ν = C_I − θ_wall
 * Angles in degrees throughout.
 */
import { M_from_nu, nu as pmNu } from './prandtlMeyer';
import { p_p0 } from './isentropic';
import { toDeg, toRad } from './solve';

export interface MOCState {
  CI: number;
  CII: number;
  theta: number;
  nu: number;
  M: number;
  /** Mach angle μ (the notes write α) */
  mu: number;
  p_p0: number;
  /** False when ν ≤ 0: the flow would be sonic/subsonic and MOC no longer applies. */
  valid: boolean;
}

export type PointKind = 'initial' | 'interior' | 'upper' | 'lower';

export interface MOCPoint extends MOCState {
  id: number;
  kind: PointKind;
  stage: number;
  /** p / p(inlet) — isentropic, so p0 is the same everywhere */
  p_pin: number;
  x: number;
  y: number;
  /** id of the point whose right-running characteristic (carrying C_I) arrives here */
  fromI?: number;
  /** id of the point whose left-running characteristic (carrying C_II) arrives here */
  fromII?: number;
}

/** Full state from (ν, θ). */
export function stateFromNuTheta(nuDeg: number, thetaDeg: number, g = 1.4): MOCState {
  const valid = nuDeg > 1e-9;
  const M = valid ? M_from_nu(nuDeg, g) : 1;
  return {
    CI: nuDeg + thetaDeg,
    CII: nuDeg - thetaDeg,
    theta: thetaDeg,
    nu: nuDeg,
    M,
    mu: toDeg(Math.asin(1 / M)),
    p_p0: p_p0(M, g),
    valid,
  };
}

/** Full state from (M, θ) — used for the initial data line. */
export const stateFromMTheta = (M: number, thetaDeg: number, g = 1.4): MOCState => stateFromNuTheta(pmNu(M, g), thetaDeg, g);

/**
 * Interior point: `a` sends its right-running characteristic (C_I) down to the new point,
 * `b` sends its left-running characteristic (C_II) up to it.
 */
export function interiorPoint(a: { CI: number }, b: { CII: number }, g = 1.4): MOCState {
  return stateFromNuTheta((a.CI + b.CII) / 2, (a.CI - b.CII) / 2, g);
}

/** Wall point: θ is imposed by the wall; one invariant arrives from the interior point `from`. */
export function wallPoint(from: { CI: number; CII: number }, thetaWall: number, side: 'upper' | 'lower', g = 1.4): MOCState {
  const nuW = side === 'upper' ? from.CII + thetaWall : from.CI - thetaWall;
  return stateFromNuTheta(nuW, thetaWall, g);
}

/* ---------------- geometry helpers ---------------- */

/** Intersect the line through P with direction angle a (deg) and the line through Q with direction angle b. */
export function intersectLines(P: { x: number; y: number }, a: number, Q: { x: number; y: number }, b: number) {
  const ca = Math.cos(toRad(a));
  const sa = Math.sin(toRad(a));
  const cb = Math.cos(toRad(b));
  const sb = Math.sin(toRad(b));
  const det = ca * -sb - sa * -cb;
  if (Math.abs(det) < 1e-12) return { x: NaN, y: NaN };
  const dx = Q.x - P.x;
  const dy = Q.y - P.y;
  const s = (dx * -sb - dy * -cb) / det;
  return { x: P.x + s * ca, y: P.y + s * sa };
}

/** Right-running direction θ − μ averaged between two states (the notes' improved construction). */
const avg = (a: number, b: number) => (a + b) / 2;
const rightDir = (a: MOCState, b: MOCState) => avg(a.theta - a.mu, b.theta - b.mu);
const leftDir = (a: MOCState, b: MOCState) => avg(a.theta + a.mu, b.theta + b.mu);

/* ---------------- channel net ---------------- */

export interface ChannelSpec {
  /** Inlet Mach number (uniform along the initial data line) */
  M0: number;
  g?: number;
  /** Number of points on the initial data line (≥ 2), top → bottom */
  nInitial?: number;
  /** Wall angle θ at successive upper-wall points; [0] is the top initial point. The last value repeats. */
  upperWall: number[];
  /** Same for the lower wall (default straight, θ = 0). */
  lowerWall?: number[];
  /** Optional explicit θ for the initial points (top → bottom). Default: linear between the two wall angles. */
  initialTheta?: number[];
  /** Height of the initial data line (lower wall starts at y = 0). */
  height?: number;
  /** Number of stages after the initial line (PS10: 4 → points 1–8). */
  stages: number;
  /** How ids are assigned inside a stage: top → bottom (PS10, notes, Final B) or bottom → top (Final A). */
  numbering?: 'topDown' | 'bottomUp';
  /** Inlet static pressure, for convenience in tables (any unit). */
  pIn?: number;
}

export interface Crossing {
  x: number;
  y: number;
  family: 'I' | 'II';
  /** 'actual' = inside the computed net; 'projected' = on the straight extensions beyond the last points */
  kind: 'actual' | 'projected';
  lines: [number, number];
}

export interface CharLine {
  family: 'I' | 'II';
  ids: number[];
  /** Straight extension beyond the last point (null if the line ends on a wall, where it reflects) */
  ext: { x: number; y: number } | null;
}

export interface MOCNet {
  spec: ChannelSpec;
  points: MOCPoint[];
  /** Point ids per stage, top → bottom */
  stages: number[][];
  /** Construction order (ids ascending) */
  order: number[];
  lines: CharLine[];
  crossings: Crossing[];
  upperWallPts: { x: number; y: number }[];
  lowerWallPts: { x: number; y: number }[];
  breakdown: null | { reason: 'subsonic' | 'crossing'; id?: number; x?: number };
}

const wallAngle = (sched: number[], k: number) => sched[Math.min(k, sched.length - 1)];

export function buildChannelNet(spec: ChannelSpec): MOCNet {
  const g = spec.g ?? 1.4;
  const N = Math.max(2, spec.nInitial ?? 2);
  const H = spec.height ?? 1;
  const lower = spec.lowerWall ?? [0];
  const upper = spec.upperWall;
  const topDown = (spec.numbering ?? 'topDown') === 'topDown';
  const pinRef = p_p0(spec.M0, g);

  const pts: MOCPoint[] = [];
  const stages: number[][] = [];
  let nextId = 1;
  let breakdown: MOCNet['breakdown'] = null;

  const push = (list: Omit<MOCPoint, 'id'>[], stage: number) => {
    const ordered = topDown ? list : [...list].reverse();
    const ids: number[] = [];
    const withIds = ordered.map((p) => ({ ...p, id: nextId++ }) as MOCPoint);
    const back = topDown ? withIds : [...withIds].reverse();
    back.forEach((p) => {
      pts.push(p);
      ids.push(p.id);
    });
    stages[stage] = ids;
    return back;
  };

  // Stage 0: initial data line (vertical at x = 0), top → bottom
  const th0 = spec.initialTheta ?? Array.from({ length: N }, (_, i) => wallAngle(upper, 0) + ((wallAngle(lower, 0) - wallAngle(upper, 0)) * i) / (N - 1));
  const init = th0.map((th, i) => {
    const s = stateFromMTheta(spec.M0, th, g);
    return { ...s, kind: 'initial' as PointKind, stage: 0, p_pin: s.p_p0 / pinRef, x: 0, y: H * (1 - i / (N - 1)) };
  });
  let prev = push(init, 0);
  let lastUpper = prev[0];
  let lastLower = prev[prev.length - 1];
  const upperWallPts = [{ x: prev[0].x, y: prev[0].y }];
  const lowerWallPts = [{ x: prev[N - 1].x, y: prev[N - 1].y }];

  for (let s = 1; s <= spec.stages && !breakdown; s++) {
    const full = prev.length === N; // previous stage includes both wall points
    const list: Omit<MOCPoint, 'id'>[] = [];
    if (!full) {
      // upper-wall point from the top interior point's left-running characteristic
      const k = s / 2;
      const thU = wallAngle(upper, k);
      const src = prev[0];
      const st = wallPoint(src, thU, 'upper', g);
      const wallDir = avg(lastUpper.theta, thU);
      const loc = st.valid ? intersectLines(lastUpper, wallDir, src, leftDir(src, st)) : { x: NaN, y: NaN };
      list.push({ ...st, kind: 'upper', stage: s, p_pin: st.p_p0 / pinRef, ...loc, fromII: src.id });
    }
    for (let i = 0; i + 1 < prev.length; i++) {
      const a = prev[i];
      const b = prev[i + 1];
      const st = interiorPoint(a, b, g);
      const loc = st.valid ? intersectLines(a, rightDir(a, st), b, leftDir(b, st)) : { x: NaN, y: NaN };
      list.push({ ...st, kind: 'interior', stage: s, p_pin: st.p_p0 / pinRef, ...loc, fromI: a.id, fromII: b.id });
    }
    if (!full) {
      const k = s / 2;
      const thL = wallAngle(lower, k);
      const src = prev[prev.length - 1];
      const st = wallPoint(src, thL, 'lower', g);
      const wallDir = avg(lastLower.theta, thL);
      const loc = st.valid ? intersectLines(lastLower, wallDir, src, rightDir(src, st)) : { x: NaN, y: NaN };
      list.push({ ...st, kind: 'lower', stage: s, p_pin: st.p_p0 / pinRef, ...loc, fromI: src.id });
    }
    prev = push(list, s);
    if (!full) {
      lastUpper = prev[0];
      lastLower = prev[prev.length - 1];
      if (lastUpper.valid) upperWallPts.push({ x: lastUpper.x, y: lastUpper.y });
      if (lastLower.valid) lowerWallPts.push({ x: lastLower.x, y: lastLower.y });
    }
    const bad = prev.find((p) => !p.valid);
    if (bad) breakdown = { reason: 'subsonic', id: bad.id };
  }

  const order = pts.map((p) => p.id).sort((a, b) => a - b);
  const lines = characteristicLines(pts);
  const crossings = findCrossings(pts, lines, upperWallPts, lowerWallPts);
  const firstActual = crossings.filter((c) => c.kind === 'actual').sort((a, b) => a.x - b.x)[0];
  if (!breakdown && firstActual) breakdown = { reason: 'crossing', x: firstActual.x };
  return { spec, points: pts, stages, order, lines, crossings, upperWallPts, lowerWallPts, breakdown };
}

/** Polylines of each characteristic, following the fromI / fromII links. */
export function characteristicLines(pts: MOCPoint[]): CharLine[] {
  const byId = new Map(pts.map((p) => [p.id, p]));
  const out: CharLine[] = [];
  for (const fam of ['I', 'II'] as const) {
    const key = fam === 'I' ? 'fromI' : 'fromII';
    const child = new Map<number, number>();
    pts.forEach((p) => {
      const f = p[key];
      if (f !== undefined) child.set(f, p.id);
    });
    const starts = pts.filter((p) => p[key] === undefined && p.valid);
    for (const s of starts) {
      const ids = [s.id];
      let cur = s.id;
      while (child.has(cur)) {
        const nx = child.get(cur)!;
        if (!byId.get(nx)!.valid) break;
        ids.push(nx);
        cur = nx;
      }
      const last = byId.get(ids[ids.length - 1])!;
      const endsOnWall = (fam === 'I' && last.kind === 'lower') || (fam === 'II' && last.kind === 'upper');
      if (ids.length === 1 && endsOnWall) continue; // a wall point whose wave goes straight into the wall
      let ext: CharLine['ext'] = null;
      if (!endsOnWall) {
        const dir = fam === 'I' ? last.theta - last.mu : last.theta + last.mu;
        const L = 0.6;
        ext = { x: last.x + L * Math.cos(toRad(dir)), y: last.y + L * Math.sin(toRad(dir)) };
      }
      out.push({ family: fam, ids, ext });
    }
  }
  return out;
}

function segInter(p1: XY, p2: XY, p3: XY, p4: XY): XY | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-14) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  const eps = 1e-9;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}
type XY = { x: number; y: number };

/** y of a wall polyline at x (straight extension past its ends). */
export function wallY(wall: XY[], x: number): number {
  if (wall.length === 1) return wall[0].y;
  let i = 0;
  while (i < wall.length - 2 && x > wall[i + 1].x) i++;
  const a = wall[i];
  const b = wall[i + 1];
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/** Crossings of characteristics of the SAME family (where the net would fold over: a shock forms). */
export function findCrossings(pts: MOCPoint[], lines: CharLine[], upper: XY[], lower: XY[]): Crossing[] {
  const byId = new Map(pts.map((p) => [p.id, p]));
  const segs = lines.map((l, li) => {
    const xy = l.ids.map((id) => byId.get(id)!);
    const s: { a: XY; b: XY; ext: boolean; line: number }[] = [];
    for (let i = 0; i + 1 < xy.length; i++) s.push({ a: xy[i], b: xy[i + 1], ext: false, line: li });
    if (l.ext) s.push({ a: xy[xy.length - 1], b: l.ext, ext: true, line: li });
    return s;
  });
  const out: Crossing[] = [];
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i].family !== lines[j].family) continue;
      for (const s1 of segs[i])
        for (const s2 of segs[j]) {
          const X = segInter(s1.a, s1.b, s2.a, s2.b);
          if (!X) continue;
          const inside = X.y <= wallY(upper, X.x) + 1e-9 && X.y >= wallY(lower, X.x) - 1e-9;
          if (!inside) continue;
          out.push({ ...X, family: lines[i].family, kind: s1.ext || s2.ext ? 'projected' : 'actual', lines: [i, j] });
        }
    }
  return out.sort((a, b) => a.x - b.x);
}

/* ---------------- simple-wave wall (concave compression ramp) ---------------- */

export interface SimpleWaveResult {
  /** Wall points: the left-running wave leaving each carries a constant state along a straight line. */
  wall: (MOCState & { id: number; x: number; y: number; p_pin: number })[];
  /** First crossing of two neighbouring left-running (same-family) waves = where the shock starts. */
  shock: { x: number; y: number; between: [number, number] } | null;
  /** All pairwise crossings of consecutive waves */
  crossings: { x: number; y: number; between: [number, number] }[];
}

/**
 * Uniform flow M0 over a LOWER wall that bends up (compression) by `turns` degrees at successive
 * points spaced `ds` apart along the wall. Upstream flow is uniform, so C_I = ν0 is the same on every
 * right-running line (a simple wave): at each wall point ν = ν0 − θ_wall. The left-running waves are
 * straight lines at θ + μ; because θ + μ grows downstream, neighbours converge and cross → a shock.
 */
export function concaveWall(M0: number, wallAngles: number[], ds = 0.25, g = 1.4): SimpleWaveResult {
  const s0 = stateFromMTheta(M0, 0, g);
  const pin = s0.p_p0;
  const wall: SimpleWaveResult['wall'] = [];
  let x = 0;
  let y = 0;
  wallAngles.forEach((th, i) => {
    if (i > 0) {
      const dir = avg(wallAngles[i - 1], th);
      x += ds * Math.cos(toRad(dir));
      y += ds * Math.sin(toRad(dir));
    }
    const st = wallPoint(s0, th, 'lower', g);
    wall.push({ ...st, id: i + 1, x, y, p_pin: st.p_p0 / pin });
  });
  const crossings: SimpleWaveResult['crossings'] = [];
  for (let i = 0; i + 1 < wall.length; i++) {
    const a = wall[i];
    const b = wall[i + 1];
    if (!a.valid || !b.valid) continue;
    const X = intersectLines(a, a.theta + a.mu, b, b.theta + b.mu);
    if (isFinite(X.x) && X.x > b.x) crossings.push({ ...X, between: [a.id, b.id] });
  }
  const shock = crossings.length ? [...crossings].sort((p, q) => p.x - q.x)[0] : null;
  return { wall, shock, crossings };
}

/* ---------------- presets used by the site ---------------- */

export const MOC_PRESETS: Record<string, { label: string; spec: ChannelSpec }> = {
  notes: {
    label: 'Notes §15.5.1: M = 3, walls converging at 10° (3 initial points)',
    spec: { M0: 3, nInitial: 3, upperWall: [-10], lowerWall: [10], stages: 2, height: 2, pIn: 100 },
  },
  ps10p3: {
    label: 'PS10 P3: M = 2, upper wall diverging at 10°',
    spec: { M0: 2, upperWall: [10], stages: 4, pIn: 1 },
  },
  ps10p4: {
    label: 'PS10 P4: M = 2, upper wall converging at 10°',
    spec: { M0: 2, upperWall: [-10], stages: 4, pIn: 1 },
  },
  ps10p4ext: {
    label: 'PS10 P4 extended until MOC breaks down',
    spec: { M0: 2, upperWall: [-10], stages: 6, pIn: 1 },
  },
  finalA: {
    label: 'Final A P4: M = 2, curved upper wall 15° → 5° → 0° → −5°',
    spec: { M0: 2, upperWall: [15, 5, 0, -5], stages: 7, numbering: 'bottomUp', pIn: 100 },
  },
  finalB: {
    label: 'Final B P5: M = 3, upper wall 0° → −5° → −10° → −15°',
    spec: { M0: 3, upperWall: [0, -5, -10, -15], stages: 6, pIn: 100 },
  },
};
