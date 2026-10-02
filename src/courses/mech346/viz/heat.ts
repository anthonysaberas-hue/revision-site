import * as THREE from 'three';

/** Scientific "thermal camera" colour map: t in [0,1] (cold→hot): deep blue, cyan, green, yellow, orange, red, white. */
const STOPS: [number, number, number][] = [
  [0.05, 0.1, 0.45],
  [0.0, 0.6, 0.95],
  [0.1, 0.8, 0.35],
  [0.98, 0.9, 0.15],
  [0.98, 0.5, 0.05],
  [0.85, 0.1, 0.05],
  [1, 0.95, 0.85],
];
export function heatColor(t: number, out = new THREE.Color()): THREE.Color {
  const x = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const u = x - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return out.setRGB(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
}

/** Approximate colour of an incandescent surface at temperature T (K): dull red at 800 K up to white-yellow at 3000 K. */
export function glowColor(T: number, out = new THREE.Color()): THREE.Color {
  const t = Math.min(1, Math.max(0, (T - 650) / 1800));
  const r = Math.min(1, 0.2 + 1.6 * t);
  const g = Math.min(1, Math.max(0, (t - 0.12) * 1.5));
  const b = Math.min(1, Math.max(0, (t - 0.45) * 1.9));
  return out.setRGB(r * (0.4 + 0.6 * t), g * (0.25 + 0.75 * t), b * (0.2 + 0.8 * t) * t);
}

/**
 * Implicit (backward-Euler) 1-D radial conduction in a plane wall (half thickness), long cylinder or sphere,
 * with convection at r = R and symmetry at r = 0. n nodes, returns node temperatures (index 0 = centre).
 */
export class RadialSolver {
  T: Float64Array;
  r: Float64Array;
  constructor(public geom: 'wall' | 'cylinder' | 'sphere', public n: number, public R: number, public alpha: number, public k: number, public h: number, public Ti: number, public Tinf: number) {
    this.T = new Float64Array(n).fill(Ti);
    this.r = new Float64Array(n);
    for (let i = 0; i < n; i++) this.r[i] = (R * i) / (n - 1);
  }
  step(dt: number) {
    const { n, R, alpha, k, h, Tinf, geom } = this;
    const dr = R / (n - 1);
    const a = new Float64Array(n);
    const b = new Float64Array(n);
    const c = new Float64Array(n);
    const d = new Float64Array(n);
    const p = geom === 'wall' ? 0 : geom === 'cylinder' ? 1 : 2;
    const lam = (alpha * dt) / (dr * dr);
    // centre node (symmetry): d2T/dr2 * (1 + p) form
    b[0] = 1 + 2 * (1 + p) * lam;
    c[0] = -2 * (1 + p) * lam;
    d[0] = this.T[0];
    for (let i = 1; i < n - 1; i++) {
      const ri = this.r[i];
      const adv = (p * dr) / (2 * ri);
      a[i] = -lam * (1 - adv);
      b[i] = 1 + 2 * lam;
      c[i] = -lam * (1 + adv);
      d[i] = this.T[i];
    }
    // surface node with convection: ghost node T_{n} = T_{n-2} - 2 dr h/k (T_s - Tinf)
    const i = n - 1;
    const adv = p === 0 ? 0 : (p * dr) / (2 * R);
    const beta = (2 * dr * h) / k;
    a[i] = -lam * (1 - adv) - lam * (1 + adv);
    b[i] = 1 + 2 * lam + lam * (1 + adv) * beta;
    d[i] = this.T[i] + lam * (1 + adv) * beta * Tinf;
    // Thomas algorithm
    for (let j = 1; j < n; j++) {
      const w = a[j] / b[j - 1];
      b[j] -= w * c[j - 1];
      d[j] -= w * d[j - 1];
    }
    this.T[n - 1] = d[n - 1] / b[n - 1];
    for (let j = n - 2; j >= 0; j--) this.T[j] = (d[j] - c[j] * this.T[j + 1]) / b[j];
  }
  advance(dt: number, maxStep = 0.5) {
    let left = dt;
    while (left > 1e-9) {
      const s = Math.min(left, maxStep);
      this.step(s);
      left -= s;
    }
  }
  /** mass-weighted mean temperature (for the energy released) */
  mean(): number {
    const p = this.geom === 'wall' ? 0 : this.geom === 'cylinder' ? 1 : 2;
    let num = 0;
    let den = 0;
    for (let i = 0; i < this.n; i++) {
      const w = i === 0 ? 0 : Math.pow(this.r[i], p) * (i === this.n - 1 ? 0.5 : 1);
      num += w * this.T[i];
      den += w;
    }
    return den > 0 ? num / den : this.T[0];
  }
}
