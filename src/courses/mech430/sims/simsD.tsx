/* Group D simulations — oblique shocks, reflections, Prandtl–Meyer fans, diamond airfoils, plumes (Ch. 12–14).
 * Hardware is rendered with Three.js in the style of viz/FlowSection3D: PBR metal prisms, a Mach-coloured
 * flow plane (fieldColor), moving tracers, glowing shock sheets and faint fan lines. Charts stay 2-D. */
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Plot } from '../../../core/Plot';
import { Readout, SimFrame, Slider, Tex } from '../../../core/ui';
import * as ob from '../lib/obliqueShock';
import * as pm from '../lib/prandtlMeyer';
import * as ns from '../lib/normalShock';
import * as ise from '../lib/isentropic';
import * as rf from '../lib/shockReflection';
import { diamondAirfoil } from '../lib/diamondAirfoil';
import { colorLegend, fieldColor, FlowSection3D } from '../viz/FlowSection3D';
import { fmt } from './common';

/* ================================================================ geometry helpers (not exported) */
const R = Math.PI / 180;
const cosd = (a: number) => Math.cos(a * R);
const sind = (a: number) => Math.sin(a * R);
const tand = (a: number) => Math.tan(a * R);
const muOf = (M: number) => (M > 1 ? Math.asin(1 / M) / R : 90);
const deg = (v: number, n = 3) => (isFinite(v) ? `${fmt(v, n)}°` : '—');

type Pt = [number, number];
interface St {
  M: number;
  dir: number;
}
type Box = { x: [number, number]; y: [number, number] };

function inPoly(p: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** Ray from o at angle `ang`, clipped to the box. */
function clipRay(o: Pt, ang: number, b: Box): Pt[] {
  const dx = cosd(ang);
  const dy = sind(ang);
  let t = 1e9;
  if (dx > 1e-9) t = Math.min(t, (b.x[1] - o[0]) / dx);
  if (dx < -1e-9) t = Math.min(t, (b.x[0] - o[0]) / dx);
  if (dy > 1e-9) t = Math.min(t, (b.y[1] - o[1]) / dy);
  if (dy < -1e-9) t = Math.min(t, (b.y[0] - o[1]) / dy);
  return [o, [o[0] + t * dx, o[1] + t * dy]];
}
/** Is P on the downstream side (ds = −1: clockwise, +1: counter-clockwise) of the ray (o, ang)? */
const down = (P: Pt, o: Pt, ang: number, ds: number) => Math.sign(cosd(ang) * (P[1] - o[1]) - sind(ang) * (P[0] - o[0])) === ds;

type Wave = { kind: 'shock'; o: Pt; ang: number; after: St; ds: number } | { kind: 'fan'; o: Pt; tab: { ang: number; s: St }[]; ds: number };

/** Centred P-M fan: flow (M, dir) turned by `turn`; upper surfaces turn clockwise, lower counter-clockwise. */
function fanWave(o: Pt, M: number, dir: number, turn: number, upper: boolean, n = 36): Wave {
  const tab: { ang: number; s: St }[] = [];
  for (let k = 0; k <= n; k++) {
    const t = (turn * k) / n;
    const e = pm.expansion(M, t);
    const d = upper ? dir - t : dir + t;
    tab.push({ ang: upper ? d + e.mu2 : d - e.mu2, s: { M: e.M2, dir: d } });
  }
  return { kind: 'fan', o, tab, ds: upper ? -1 : 1 };
}
/** State after crossing, in order, every wave whose downstream side contains P (stop at the first one it is upstream of). */
function chainState(P: Pt, s0: St, waves: Wave[]): St {
  let s = s0;
  for (const w of waves) {
    if (w.kind === 'shock') {
      if (!down(P, w.o, w.ang, w.ds)) return s;
      s = w.after;
    } else {
      const tab = w.tab;
      if (!down(P, w.o, tab[0].ang, w.ds)) return s;
      if (down(P, w.o, tab[tab.length - 1].ang, w.ds)) {
        s = tab[tab.length - 1].s;
        continue;
      }
      const phi = Math.atan2(P[1] - w.o[1], P[0] - w.o[0]) / R;
      for (let i = 1; i < tab.length; i++) {
        const a = tab[i - 1];
        const b = tab[i];
        if ((phi - a.ang) * (phi - b.ang) <= 0) {
          const t = b.ang === a.ang ? 0 : (phi - a.ang) / (b.ang - a.ang);
          return { M: a.s.M + t * (b.s.M - a.s.M), dir: a.s.dir + t * (b.s.dir - a.s.dir) };
        }
      }
      return tab[tab.length - 1].s;
    }
  }
  return s;
}
/** A few rays of a fan wave, clipped to the box, for drawing. */
function fanLines(w: Wave, b: Box, every = 6): Pt[][] {
  if (w.kind !== 'fan') return [];
  return w.tab.filter((_, i) => i % every === 0 || i === w.tab.length - 1).map((r) => clipRay(w.o, r.ang, b));
}
function bezier(a: Pt, c: Pt, b: Pt, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/* ================================================================ the 3-D planar-flow scene */
interface PlanarSpec {
  box: Box;
  /** state at a point, or null inside a body */
  field: (x: number, y: number) => St | null;
  bodies: { poly: Pt[]; edgeColors?: (string | null)[] }[];
  shocks: Pt[][];
  fans: Pt[][];
  slips?: Pt[][];
  seeds: Pt[];
  arrows?: { from: Pt; to: Pt; color: string }[];
  labels: { at: Pt; text: string }[];
  /** camera elevation (rad) */
  elev?: number;
  warning?: string;
}

const glowTex = () => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
function ribbonGeo(pts: Pt[], w: number, z: number, dash = 0) {
  const pos: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const L = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / L) * (w / 2);
    const ny = ((x1 - x0) / L) * (w / 2);
    const segs = dash > 0 ? Math.max(1, Math.round(L / dash)) : 1;
    for (let k = 0; k < segs; k++) {
      if (dash > 0 && k % 2 === 1) continue;
      const a = k / segs;
      const b = (k + 1) / segs;
      const ax = x0 + (x1 - x0) * a;
      const ay = y0 + (y1 - y0) * a;
      const bx = x0 + (x1 - x0) * b;
      const by = y0 + (y1 - y0) * b;
      pos.push(ax + nx, ay + ny, z, ax - nx, ay - ny, z, bx + nx, by + ny, z, bx + nx, by + ny, z, ax - nx, ay - ny, z, bx - nx, by - ny, z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return g;
}
function sheetGeo(pts: Pt[], z0: number, z1: number) {
  const pos: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    pos.push(x0, y0, z0, x1, y1, z0, x1, y1, z1, x0, y0, z0, x1, y1, z1, x0, y0, z1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return g;
}

class PlanarScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 2, 0.01, 200);
  controls: OrbitControls;
  content = new THREE.Group();
  particles: THREE.Points;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  spec?: PlanarSpec;
  span = 1;
  host: HTMLElement;
  raf = 0;
  visible = true;
  clock = new THREE.Clock();
  glow = glowTex();
  io: IntersectionObserver;
  ro: ResizeObserver;
  labelsCb?: (l: { text: string; x: number; y: number }[]) => void;
  lastLabels = '';
  lastBoxKey = '';

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#070a12');
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    this.scene.add(new THREE.HemisphereLight('#4a6cc0', '#05070d', 0.5));
    const key = new THREE.DirectionalLight('#fff4e6', 2.2);
    key.position.set(-2, 4, 5);
    const rim = new THREE.DirectionalLight('#3d7bff', 1.8);
    rim.position.set(2, 2, -5);
    this.scene.add(key, rim, this.content);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.minAzimuthAngle = -0.9;
    this.controls.maxAzimuthAngle = 0.9;
    this.controls.minPolarAngle = 0.7;
    this.controls.maxPolarAngle = 2.2;
    const N = 420;
    this.px = new Float32Array(N);
    this.py = new Float32Array(N);
    this.pz = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.05, map: this.glow, color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting));
    this.io.observe(host);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frame();
  }

  frame() {
    const s = this.spec;
    if (!s) return;
    const key = `${s.box.x}|${s.box.y}|${s.elev}|${this.camera.aspect.toFixed(3)}`;
    if (key === this.lastBoxKey) return;
    this.lastBoxKey = key;
    const W = s.box.x[1] - s.box.x[0];
    const H = s.box.y[1] - s.box.y[0];
    const cx = (s.box.x[0] + s.box.x[1]) / 2;
    const cy = (s.box.y[0] + s.box.y[1]) / 2;
    const fov = (this.camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect);
    const d = Math.max((W * 0.53) / Math.tan(fovH / 2), (H * 0.56) / Math.tan(fov / 2)) + this.span;
    const el = s.elev ?? 0.14;
    const az = -0.22;
    this.controls.target.set(cx, cy, this.span * 0.35);
    this.camera.position.set(cx + d * Math.sin(az) * Math.cos(el), cy + d * Math.sin(el), this.span * 0.35 + d * Math.cos(az) * Math.cos(el));
    this.controls.update();
  }

  set(s: PlanarSpec) {
    this.spec = s;
    const W = s.box.x[1] - s.box.x[0];
    const H = s.box.y[1] - s.box.y[0];
    this.span = W * 0.22;
    const span = this.span;
    this.content.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.content.clear();
    // ---- flow plane coloured by Mach
    const nx = 220;
    const ny = Math.max(20, Math.round((nx * H) / W));
    const pos = new Float32Array((nx + 1) * (ny + 1) * 3);
    const col = new Float32Array(pos.length);
    const idx: number[] = [];
    const c = new THREE.Color();
    const fp = { M: 0, p: 0, T: 0 };
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= ny; j++) {
        const x = s.box.x[0] + (W * i) / nx;
        const y = s.box.y[0] + (H * j) / ny;
        const k = i * (ny + 1) + j;
        pos[k * 3] = x;
        pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = 0;
        const st = s.field(x, y);
        if (st) {
          fp.M = st.M;
          fieldColor(fp, 'M', c);
          c.multiplyScalar(0.8);
        } else c.set('#1a1e26');
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
        if (i < nx && j < ny) {
          const b = k + ny + 1;
          idx.push(k, b, k + 1, b, b + 1, k + 1);
        }
      }
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    pg.setIndex(idx);
    this.content.add(new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false })));
    // ---- streamlines on the plane
    const step = W / 320;
    const lw = W * 0.0022;
    const streamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
    for (const sd of s.seeds) {
      const pts: Pt[] = [];
      let [x, y] = sd;
      for (let k = 0; k < 1200; k++) {
        const st = s.field(x, y);
        if (!st || x > s.box.x[1] || y > s.box.y[1] || y < s.box.y[0]) break;
        if (k % 3 === 0) pts.push([x, y]);
        x += step * cosd(st.dir);
        y += step * sind(st.dir);
      }
      if (pts.length > 1) this.content.add(new THREE.Mesh(ribbonGeo(pts, lw, 0.002), streamMat));
    }
    // ---- bodies: PBR steel prisms extruded toward the viewer, machined front face
    const steel = new THREE.MeshStandardMaterial({ color: '#aeb6c2', metalness: 0.95, roughness: 0.28, side: THREE.DoubleSide });
    const face = new THREE.MeshStandardMaterial({ color: '#cfd5dd', metalness: 0.55, roughness: 0.45, side: THREE.DoubleSide });
    for (const b of s.bodies) {
      const shape = new THREE.Shape(b.poly.map(([x, y]) => new THREE.Vector2(x, y)));
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), face);
      cap.position.z = span;
      this.content.add(cap);
      for (let i = 0; i < b.poly.length; i++) {
        const a = b.poly[i];
        const e = b.poly[(i + 1) % b.poly.length];
        const g = sheetGeo([a, e], 0, span);
        g.computeVertexNormals();
        const ec = b.edgeColors?.[i];
        const m = ec ? new THREE.MeshStandardMaterial({ color: ec, emissive: ec, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide }) : steel;
        this.content.add(new THREE.Mesh(g, m));
        if (ec) this.content.add(new THREE.Mesh(ribbonGeo([a, e], W * 0.008, span + 0.002), new THREE.MeshBasicMaterial({ color: ec, toneMapped: false })));
      }
    }
    // ---- shocks: glowing sheets + bright core on the plane
    const sheetMat = new THREE.MeshBasicMaterial({ color: '#ffd9a8', transparent: true, opacity: 0.32, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: '#fff6e8', toneMapped: false, side: THREE.DoubleSide });
    for (const sh of s.shocks) {
      this.content.add(new THREE.Mesh(sheetGeo(sh, 0, span), sheetMat));
      this.content.add(new THREE.Mesh(ribbonGeo(sh, W * 0.006, 0.004), coreMat));
      this.content.add(new THREE.Mesh(ribbonGeo(sh, W * 0.004, span), coreMat));
    }
    const fanMat = new THREE.MeshBasicMaterial({ color: '#a9c8ff', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    const fanSheet = new THREE.MeshBasicMaterial({ color: '#6f9cff', transparent: true, opacity: 0.06, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const f of s.fans) {
      this.content.add(new THREE.Mesh(ribbonGeo(f, W * 0.0025, 0.004), fanMat));
      this.content.add(new THREE.Mesh(sheetGeo(f, 0, span), fanSheet));
    }
    const slipMat = new THREE.MeshBasicMaterial({ color: '#e8f0ff', transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    for (const sl of s.slips ?? []) this.content.add(new THREE.Mesh(ribbonGeo(sl, W * 0.003, 0.004, W * 0.012), slipMat));
    for (const a of s.arrows ?? []) {
      const m = new THREE.MeshBasicMaterial({ color: a.color, toneMapped: false, side: THREE.DoubleSide });
      const L = Math.hypot(a.to[0] - a.from[0], a.to[1] - a.from[1]);
      if (L < 1e-6) continue;
      const ux = (a.to[0] - a.from[0]) / L;
      const uy = (a.to[1] - a.from[1]) / L;
      const hl = Math.min(L * 0.4, W * 0.03);
      const base: Pt = [a.to[0] - ux * hl, a.to[1] - uy * hl];
      this.content.add(new THREE.Mesh(ribbonGeo([a.from, base], W * 0.007, span + 0.01), m));
      const tri = new THREE.BufferGeometry();
      const hw = hl * 0.55;
      tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([a.to[0], a.to[1], span + 0.01, base[0] - uy * hw, base[1] + ux * hw, span + 0.01, base[0] + uy * hw, base[1] - ux * hw, span + 0.01]), 3));
      this.content.add(new THREE.Mesh(tri, m));
    }
    (this.particles.material as THREE.PointsMaterial).size = W * 0.011;
    for (let i = 0; i < this.px.length; i++) this.respawn(i, true);
    this.lastBoxKey = '';
    this.frame();
  }

  respawn(i: number, anywhere = false) {
    const s = this.spec!;
    const W = s.box.x[1] - s.box.x[0];
    for (let k = 0; k < 20; k++) {
      const x = s.box.x[0] + Math.random() * (anywhere ? W : 0.02 * W);
      const y = s.box.y[0] + Math.random() * (s.box.y[1] - s.box.y[0]);
      if (s.field(x, y)) {
        this.px[i] = x;
        this.py[i] = y;
        this.pz[i] = 0.01 + Math.random() * this.span;
        return;
      }
    }
    this.px[i] = s.box.x[1] + 1;
  }

  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.visible || !this.spec) return;
    const s = this.spec;
    const W = s.box.x[1] - s.box.x[0];
    const arr = this.particles.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < this.px.length; i++) {
      const st = s.field(this.px[i], this.py[i]);
      if (!st || this.px[i] > s.box.x[1] || this.py[i] > s.box.y[1] || this.py[i] < s.box.y[0]) {
        this.respawn(i);
        continue;
      }
      const v = (st.M / Math.sqrt(1 + 0.2 * st.M * st.M)) * W * 0.09;
      this.px[i] += dt * v * cosd(st.dir);
      this.py[i] += dt * v * sind(st.dir);
      arr[i * 3] = this.px[i];
      arr[i * 3 + 1] = this.py[i];
      arr[i * 3 + 2] = this.pz[i];
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.labelsCb) {
      const w = this.host.clientWidth;
      const h = this.host.clientHeight;
      const l = s.labels.map((q) => {
        const v = new THREE.Vector3(q.at[0], q.at[1], 0).project(this.camera);
        return { text: q.text, x: Math.round((v.x * 0.5 + 0.5) * w), y: Math.round((-v.y * 0.5 + 0.5) * h) };
      });
      const key = JSON.stringify(l);
      if (key !== this.lastLabels) {
        this.lastLabels = key;
        this.labelsCb(l);
      }
    }
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.io.disconnect();
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Three.js rendering of a planar supersonic flow over a 2-D body (used by all the Group D sims). */
export function PlanarFlow3D({ spec, height = 320 }: { spec: PlanarSpec; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const sc = useRef<PlanarScene | null>(null);
  const [labels, setLabels] = useState<{ text: string; x: number; y: number }[]>([]);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    try {
      sc.current = new PlanarScene(host.current);
      sc.current.labelsCb = setLabels;
    } catch {
      setErr(true);
    }
    return () => {
      sc.current?.dispose();
      sc.current = null;
    };
  }, []);
  useEffect(() => {
    sc.current?.set(spec);
  }, [spec]);
  const legend = colorLegend('M');
  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#070a12' }}>
      <div ref={host} style={{ width: '100%', height, cursor: 'grab' }} />
      {err && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#ff8a80' }}>WebGL unavailable</div>}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {labels.map((l, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: l.x,
              top: l.y,
              transform: 'translate(-50%, -50%)',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#eef2fb',
              background: 'rgba(12,16,28,0.72)',
              border: '1px solid rgba(143,179,255,0.35)',
              borderRadius: 999,
              padding: '2px 9px',
              whiteSpace: 'nowrap',
            }}
          >
            {l.text}
          </div>
        ))}
        {spec.warning && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(120,20,30,0.85)', color: '#ffe0e0', borderRadius: 8, padding: '4px 10px', fontSize: 12, maxWidth: '90%', textAlign: 'center' }}>
            {spec.warning}
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 10, bottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#9fb0d6', pointerEvents: 'none' }}>
        <span>{legend.label}</span>
        <div style={{ width: 140, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${legend.stops.map((q, i) => `${q.c} ${(100 * i) / (legend.stops.length - 1)}%`).join(', ')})` }} />
        <span>
          {legend.stops[0].v} → {legend.stops[legend.stops.length - 1].v}
        </span>
      </div>
      <div style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 10.5, color: '#6f7b99', pointerEvents: 'none' }}>drag to rotate · mid-span section</div>
    </div>
  );
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {options.map(([k, name]) => (
        <button key={k} className={`btn ${value === k ? 'primary' : ''}`} onClick={() => onChange(k)}>
          {name}
        </button>
      ))}
    </div>
  );
}
const note = { fontSize: '0.88rem', color: 'var(--muted)' } as const;

/* ================================================================ 1. Oblique shock on a wedge */
export function ObliqueShockSim({ initialM = 3, initialDelta = 10 }: { initialM?: number; initialDelta?: number }) {
  const [M, setM] = useState(initialM);
  const [delta, setDelta] = useState(initialDelta);
  const [branch, setBranch] = useState<'weak' | 'strong'>('weak');
  const s = ob.obliqueShock(M, delta, branch);
  const dmax = ob.deltaMax(M);
  const sMax = ob.sigmaAtDeltaMax(M);
  const detached = s.detached;
  const mu = muOf(M);

  const spec = useMemo<PlanarSpec>(() => {
    const box: Box = { x: [-1.6, 3.2], y: [-0.3, 2.3] };
    const top = box.y[1];
    const tD = tand(delta);
    const yr = Math.min(box.x[1] * tD, top + 0.2);
    const xr = yr / Math.max(1e-6, tD);
    const bodyPoly: Pt[] =
      delta > 0.01
        ? [[box.x[0], box.y[0]], [box.x[0], 0], [0, 0], [Math.min(xr, box.x[1]), yr], ...(xr < box.x[1] ? ([[box.x[1], yr]] as Pt[]) : []), [box.x[1], box.y[0]]]
        : [[box.x[0], box.y[0]], [box.x[0], 0], [box.x[1], 0], [box.x[1], box.y[0]]];
    const inBody = (x: number, y: number) => y < 0 || (x > 0 && y < x * tD);
    const seeds: Pt[] = [0.15, 0.4, 0.7, 1.0, 1.3, 1.6, 1.9, 2.2].map((y) => [box.x[0], y]);
    const free: St = { M, dir: 0 };
    if (!detached) {
      const w: Wave = { kind: 'shock', o: [0, 0], ang: s.sigma, after: { M: s.M2, dir: delta }, ds: -1 };
      return {
        box,
        field: (x, y) => (inBody(x, y) ? null : chainState([x, y], free, [w])),
        bodies: [{ poly: bodyPoly }],
        shocks: [clipRay([0, 0], s.sigma, box)],
        fans: [clipRay([0, 0], mu, box)],
        seeds,
        labels: [
          { at: [-1.1, 1.9], text: `① M₁ = ${fmt(M, 3)}` },
          { at: [2.5, Math.min(2.05, 2.5 * tD + 0.3)], text: `② M₂ = ${fmt(s.M2, 3)}` },
          { at: [Math.min(2.4, 1.5 / tand(s.sigma)) - 0.2, 1.5], text: `shock σ = ${fmt(s.sigma, 3)}°` },
        ],
      };
    }
    // detached bow shock: normal at the wall, relaxing toward the Mach angle far away
    const x0 = -0.3 - 0.012 * (delta - dmax);
    const b = 0.45;
    const ta = tand(Math.min(80, mu + 6));
    const xb = (y: number) => x0 + (Math.sqrt(b * b + y * y) - b) / ta;
    const beta = (y: number) => (y < 1e-6 ? 90 : Math.atan((Math.sqrt(b * b + y * y) * ta) / y) / R);
    const bow: Pt[] = [];
    for (let y = 0; y <= top + 0.05; y += 0.05) bow.push([xb(y), y]);
    return {
      box,
      field: (x, y) => {
        if (inBody(x, y)) return null;
        if (x < xb(y)) return free;
        const loc = ob.obliqueFromSigma(M, beta(y));
        const w = x > 0 ? Math.exp(-(y - x * tD) / 0.35) : 0;
        const accel = Math.max(0, Math.min(1, (x - xb(y)) / 2.5));
        return { M: loc.M2 + accel * Math.max(0, M * 0.8 - loc.M2) * 0.6, dir: loc.delta * (1 - w) + delta * w };
      },
      bodies: [{ poly: bodyPoly }],
      shocks: [bow],
      fans: [],
      seeds,
      labels: [
        { at: [-1.2, 1.9], text: `① M₁ = ${fmt(M, 3)}` },
        { at: [0.5, 0.25], text: 'subsonic pocket' },
        { at: [xb(1.6) + 0.35, 1.6], text: 'detached bow shock' },
      ],
      warning: `δ = ${fmt(delta, 3)}° > δmax = ${fmt(dmax, 3)}°: no attached oblique shock exists`,
    };
  }, [M, delta, detached, s.sigma, s.M2, dmax, mu]);

  const chart = useMemo(() => {
    const Ms = [1.5, 2, 3, 5, 10];
    const curves = Ms.map((m) => ({ points: ob.sigmaDeltaCurve(m, 160).map((q) => ({ x: q.delta, y: q.sigma })), color: 'var(--muted)', width: 1.2 }));
    const locMax: { x: number; y: number }[] = [];
    const locSonic: { x: number; y: number }[] = [];
    for (let m = 1.03; m < 30; m *= 1.04) {
      locMax.push({ x: ob.deltaMax(m), y: ob.sigmaAtDeltaMax(m) });
      const ss = ob.sigmaSonic(m);
      locSonic.push({ x: ob.deltaFromSigma(m, ss), y: ss });
    }
    const tags = Ms.map((m) => {
      const pts = ob.sigmaDeltaCurve(m, 80);
      const t = pts.reduce((a, q) => (q.delta > a.delta ? q : a), pts[0]);
      return { m, x: t.delta, y: t.sigma };
    });
    return { curves, locMax, locSonic, tags };
  }, []);
  const current = useMemo(() => ob.sigmaDeltaCurve(M, 200).map((q) => ({ x: q.delta, y: q.sigma })), [M]);

  return (
    <SimFrame title="Oblique shock on a wedge" subtitle="pick M and δ → the θ-β-M relation gives σ (two roots, or none)">
      <div className="controls">
        <Slider label="Upstream Mach M₁" value={M} min={1.2} max={8} step={0.01} onChange={setM} />
        <Slider label="Wedge / deflection angle δ" value={delta} min={0} max={45} step={0.1} unit="°" onChange={setDelta} />
        <Toggle
          value={branch}
          onChange={setBranch}
          options={[
            ['weak', 'Weak branch'],
            ['strong', 'Strong branch'],
          ]}
        />
      </div>
      <PlanarFlow3D spec={spec} height={330} />
      <Plot
        x={[0, 50]}
        y={[0, 90]}
        height={300}
        xLabel="deflection δ (°)"
        yLabel="shock angle σ (°)"
        legend={false}
        series={[...chart.curves, { points: chart.locMax, color: 'var(--c5)', dash: true, width: 1.6 }, { points: chart.locSonic, color: 'var(--c3)', dash: true, width: 1.2 }, { points: current, color: 'var(--accent)', width: 3 }]}
        vlines={detached ? [{ x: Math.min(delta, 50), color: 'var(--c5)', label: 'δ > δmax: detached' }] : []}
        dots={[...(detached ? [] : [{ x: delta, y: s.sigma, color: 'var(--c2)', label: `σ = ${fmt(s.sigma, 3)}°` }]), { x: dmax, y: sMax, color: 'var(--c5)', r: 3.5 }]}
      >
        {(sx, sy) => (
          <g>
            {chart.tags.map((t) => (
              <text key={t.m} x={sx(t.x) + 4} y={sy(t.y) + 4} style={{ fontSize: 10, fill: 'var(--muted)' }}>
                M={t.m}
              </text>
            ))}
            <text x={sx(40)} y={sy(76)} style={{ fontSize: 10, fill: 'var(--c5)' }}>
              δmax locus
            </text>
            <text x={sx(40)} y={sy(58)} style={{ fontSize: 10, fill: 'var(--c3)' }}>
              M₂ = 1 locus
            </text>
            <text x={sx(2)} y={sy(85)} style={{ fontSize: 10, fill: 'var(--muted)' }}>
              strong branch (M₂ &lt; 1)
            </text>
            <text x={sx(2)} y={sy(6)} style={{ fontSize: 10, fill: 'var(--muted)' }}>
              weak branch starts at σ = μ when δ = 0
            </text>
          </g>
        )}
      </Plot>
      <Readout
        items={[
          ['shock angle σ', deg(s.sigma)],
          ['Mach angle μ', deg(mu)],
          ['δmax (σ there)', `${fmt(dmax, 3)}° (${fmt(sMax, 3)}°)`],
          ['Mn₁ = M₁ sin σ', fmt(s.Mn1)],
          ['Mn₂ (Table A3)', fmt(s.Mn2)],
          ['M₂ = Mn₂ / sin(σ−δ)', fmt(s.M2)],
          ['p₂/p₁', fmt(s.p2_p1)],
          ['T₂/T₁', fmt(s.T2_T1)],
          ['p₀₂/p₀₁', fmt(s.p02_p01)],
        ]}
      />
      <p style={note}>
        {detached ? (
          <>No straight attached shock can turn the flow by more than δmax = {fmt(dmax, 3)}°. The shock stands off the nose as a curved bow shock: normal (strong) at the wall, fading to a Mach wave far away, with a subsonic pocket behind it.</>
        ) : branch === 'strong' ? (
          <>Strong root: same δ, much steeper shock, subsonic flow behind it and a far larger p₀ loss. It needs a high downstream pressure to hold it; the course always takes the weak root unless told otherwise.</>
        ) : (
          <>
            The tangential velocity is untouched; only the normal component <Tex>{'M_1\\sin\\sigma'}</Tex> sees a normal shock. Tracers turn parallel to the wedge as they cross the glowing sheet. The faint line is the Mach line at μ, the δ → 0 limit.
          </>
        )}
      </p>
    </SimFrame>
  );
}

/* ================================================================ 2. Shock reflection off a wall */
export function ShockReflectionSim({ initialM = 3, initialDelta = 10 }: { initialM?: number; initialDelta?: number }) {
  const [M1, setM1] = useState(initialM);
  const [dIn, setDelta] = useState(initialDelta);
  const dmax1 = ob.deltaMax(M1);
  const d1 = Math.min(dIn, dmax1 - 0.3);
  const inc = ob.obliqueShock(M1, d1);
  const reg = useMemo(() => rf.regularReflection(M1, d1), [M1, d1]);
  const mach = useMemo(() => (reg ? null : rf.machReflection(M1, d1)), [M1, d1, reg]);
  const crit = useMemo(() => {
    const safe = (f: () => number) => {
      try {
        return f();
      } catch {
        return NaN;
      }
    };
    return { det: safe(() => rf.detachmentDelta(M1)), vn: safe(() => rf.vonNeumannDelta(M1)), son: safe(() => rf.sonicDelta(M1)) };
  }, [M1]);

  const spec = useMemo<PlanarSpec>(() => {
    const tI = tand(inc.sigma);
    const tD = tand(d1);
    const xClose = 0.97 / tD;
    const xmin = -0.5;
    let xmax = 2.4;
    const regions: { poly: Pt[]; s: St }[] = [];
    const shocks: Pt[][] = [];
    const slips: Pt[][] = [];
    const labels: { at: Pt; text: string }[] = [];
    if (reg) {
      const xh = 1 / tI;
      const tP = tand(reg.reflected.sigma - d1);
      const xr = (1 + xh * tP) / (tD + tP);
      const yr = xr * tD;
      xmax = Math.min(Math.max(xr + 0.5 * (xr - xh) + 0.3, xh + 0.8), xClose);
      regions.push({ poly: [[xh, 1], [xmax + 1, 1], [xmax + 1, (xmax + 1) * tD], [xr, yr]], s: { M: reg.M3, dir: 0 } });
      regions.push({ poly: [[0, 0], [xh, 1], [xr, yr]], s: { M: inc.M2, dir: d1 } });
      shocks.push([[0, 0], [xh, 1]], [[xh, 1], [xr, yr]]);
      labels.push({ at: [xmin + 0.3, 0.5], text: `① M₁ = ${fmt(M1, 3)}` }, { at: [xh * 0.7, 0.4], text: `② ${fmt(inc.M2, 3)}` }, { at: [Math.min(xmax - 0.3, xh + 0.45), 0.8], text: `③ ${fmt(reg.M3, 3)}` });
    } else if (mach) {
      const yT = 0.6;
      const xT = yT / tI;
      const Q: Pt = [xT + (0.5 * (1 - yT)) / tand(mach.stem.sigma), yT + 0.5 * (1 - yT)];
      const stem = bezier([xT, yT], Q, [Q[0], 1]);
      const tR = tand(d1 - mach.reflected.sigma);
      const xr = (yT - xT * tR) / (tD - tR);
      const yr = xr * tD;
      xmax = Math.min(xT + 1.5, xClose);
      const slipC: Pt = [xT + 0.3 * cosd(mach.delta3), yT + 0.3 * sind(mach.delta3)];
      const slip = bezier([xT, yT], slipC, [xmax + 1, Math.min(0.95, slipC[1] + 0.03)]);
      regions.push({ poly: [...stem, [xmax + 1, 1], ...slip.slice().reverse()], s: { M: mach.stem.M2, dir: mach.delta3 * 0.5 } });
      regions.push({ poly: [...slip, [xmax + 1, (xmax + 1) * tD], [xr, yr]], s: { M: mach.reflected.M2, dir: mach.delta3 } });
      regions.push({ poly: [[0, 0], [xT, yT], [xr, yr]], s: { M: inc.M2, dir: d1 } });
      shocks.push([[0, 0], [xT, yT]], stem, [[xT, yT], [xr, yr]]);
      slips.push(slip);
      labels.push(
        { at: [xmin + 0.3, 0.5], text: `① M₁ = ${fmt(M1, 3)}` },
        { at: [xT - 0.3, yT], text: 'triple point' },
        { at: [Q[0] - 0.2, 0.9], text: 'Mach stem' },
        { at: [Math.min(xmax - 0.25, xT + 0.7), Math.min(0.9, slipC[1] + 0.12)], text: 'slip line' },
        { at: [xT * 0.6, 0.25], text: '②' },
      );
    }
    const body: Pt[] = [[xmin, -0.15], [xmin, 0], [0, 0], [xmax, xmax * tD], [xmax, -0.15]];
    const box: Box = { x: [xmin, xmax], y: [-0.15, 1.15] };
    const free: St = { M: M1, dir: 0 };
    return {
      box,
      field: (x, y) => {
        if (y < 0 || y > 1 || (x > 0 && y < x * tD)) return null;
        for (const r of regions) if (inPoly([x, y], r.poly)) return r.s;
        return free;
      },
      bodies: [{ poly: body }, { poly: [[xmin, 1], [xmax, 1], [xmax, 1.15], [xmin, 1.15]] }],
      shocks,
      fans: [],
      slips,
      seeds: [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((y) => [xmin, y] as Pt),
      labels,
      elev: 0.03,
      warning: reg || mach ? undefined : 'no regular or Mach-reflection solution here (weak-shock "von Neumann paradox" region)',
    };
  }, [M1, d1, inc.sigma, inc.M2, reg, mach]);

  const polars = useMemo(() => ({ incP: rf.shockPolar(M1), refP: inc.M2 > 1 ? rf.shockPolar(inc.M2) : [] }), [M1, inc.M2]);
  const p2 = inc.p2_p1;
  const dmax2 = inc.M2 > 1 ? ob.deltaMax(inc.M2) : 0;
  const xLo = Math.min(-5, Math.floor(d1 - dmax2 - 3));
  const xHi = Math.max(dmax1 + 4, d1 + dmax2 + 2);
  const yHi = Math.max(ns.py_px(M1), p2 * (inc.M2 > 1 ? ns.py_px(inc.M2) : 1)) * 1.06;
  const sol = reg ? { x: 0, y: reg.p3_p1, label: `regular: p₃/p₁ = ${fmt(reg.p3_p1, 3)}` } : mach ? { x: mach.delta3, y: mach.p_p1, label: `Mach: δ₃ = ${fmt(mach.delta3, 3)}°, p/p₁ = ${fmt(mach.p_p1, 3)}` } : null;
  const regime = reg ? (isFinite(crit.vn) && d1 > crit.vn ? 'Regular reflection (dual-solution zone: past von Neumann, before detachment)' : 'Regular reflection') : mach ? 'Mach reflection: the reflected shock cannot turn region ② back by δ₁' : 'No solution';
  const extra: [ReactNode, ReactNode][] = reg
    ? [
        ['reflected σ₂ (from ② flow)', deg(reg.reflected.sigma)],
        ['angle to wall σ₂ − δ₁', deg(reg.reflected.sigma - d1)],
        ['M₃', fmt(reg.M3)],
        ['p₃/p₁', fmt(reg.p3_p1)],
      ]
    : mach
      ? [
          ['Mach stem σ, M behind', `${deg(mach.stem.sigma)}, ${fmt(mach.stem.M2, 3)}`],
          ['reflected σ, δ₄', `${deg(mach.reflected.sigma)}, ${deg(mach.delta4)}`],
          ['slip-line angle δ₃', deg(mach.delta3)],
          ['p₃ = p₄ (÷p₁)', fmt(mach.p_p1)],
        ]
      : [];

  return (
    <SimFrame title="Shock reflection off a wall" subtitle="regular reflection while the reflected polar reaches δ = 0; otherwise a Mach stem">
      <div className="controls">
        <Slider label="Free-stream Mach M₁" value={M1} min={1.6} max={5} step={0.01} onChange={setM1} />
        <Slider label="Wedge angle δ₁" value={d1} min={1} max={Math.min(40, dmax1 - 0.3)} step={0.1} unit="°" onChange={setDelta} />
      </div>
      <div className="regime">{regime}</div>
      <PlanarFlow3D spec={spec} height={300} />
      {mach && <p style={note}>Schematic geometry: the polars fix the angles and states at the triple point, but not how far it sits from the wall.</p>}
      <Plot
        x={[xLo, xHi]}
        y={[1, yHi]}
        height={300}
        xLabel="flow deflection from the free-stream direction δ (°)"
        yLabel="p / p₁"
        series={[
          { points: polars.incP.map((q) => ({ x: q.delta, y: q.pr })), color: 'var(--c1)', width: 2.4, label: `incident / Mach-stem polar (M₁ = ${fmt(M1, 3)})` },
          { points: polars.incP.map((q) => ({ x: -q.delta, y: q.pr })), color: 'var(--c1)', width: 2.4 },
          { points: polars.refP.map((q) => ({ x: d1 - q.delta, y: p2 * q.pr })), color: 'var(--c5)', width: 2.4, label: `reflected polar (M₂ = ${fmt(inc.M2, 3)}, drawn from state ②)` },
          { points: polars.refP.map((q) => ({ x: d1 + q.delta, y: p2 * q.pr })), color: 'var(--c5)', width: 1.2, dash: true },
        ]}
        vlines={[{ x: 0, color: 'var(--text)', label: 'δ = 0: parallel to the wall' }]}
        dots={[{ x: d1, y: p2, color: 'var(--c1)', label: '②' }, ...(sol ? [{ ...sol, color: 'var(--c2)' }] : [])]}
      />
      <Readout
        items={[
          ['incident σ₁', deg(inc.sigma)],
          ['M₂, p₂/p₁', `${fmt(inc.M2, 3)}, ${fmt(p2, 4)}`],
          ['δmax(M₂)', deg(dmax2)],
          ...extra,
          ['δ₁ von Neumann', deg(crit.vn)],
          ['δ₁ sonic', deg(crit.son)],
          ['δ₁ detachment', deg(crit.det)],
        ]}
      />
    </SimFrame>
  );
}

/* ================================================================ 3. Prandtl–Meyer expansion fan */
export function ExpansionFanSim({ initialM = 2, initialTheta = 10 }: { initialM?: number; initialTheta?: number }) {
  const [M1, setM1] = useState(initialM);
  const [thIn, setTheta] = useState(initialTheta);
  const nu1 = pm.nu(M1);
  const thMax = Math.min(90, pm.nuMax() - nu1 - 0.5);
  const th = Math.min(thIn, thMax);
  const e = pm.expansion(M1, th);

  const spec = useMemo<PlanarSpec>(() => {
    const box: Box = { x: [-2, 2.8], y: [-1.6, 2] };
    const fan = fanWave([0, 0], Math.max(M1, 1.0001), 0, th, true, 48);
    const end = clipRay([0, 0], -th, box)[1];
    const body: Pt[] = end[0] >= box.x[1] - 1e-6 ? [[box.x[0], box.y[0]], [box.x[0], 0], [0, 0], end, [box.x[1], box.y[0]]] : [[box.x[0], box.y[0]], [box.x[0], 0], [0, 0], end];
    const free: St = { M: M1, dir: 0 };
    return {
      box,
      field: (x, y) => {
        if (y < 0 && (x < 0 || Math.atan2(y, x) / R < -th)) return null;
        return th < 0.01 ? free : chainState([x, y], free, [fan]);
      },
      bodies: [{ poly: body }],
      shocks: [],
      fans: fanLines(fan, box, 8),
      seeds: [0.15, 0.45, 0.8, 1.15, 1.5, 1.85].map((y) => [box.x[0], y] as Pt),
      labels: [
        { at: [-1.3, 1.75], text: `① M₁ = ${fmt(M1, 3)} · ν₁ = ${fmt(nu1, 4)}°` },
        { at: [1.4 * cosd(e.mu1), Math.min(1.8, 1.4 * sind(e.mu1))], text: `head: μ₁ = ${fmt(e.mu1, 3)}°` },
        { at: [2.0 * cosd(-th + e.mu2 * 0.4), 2.0 * sind(-th + e.mu2 * 0.4)], text: `② M₂ = ${fmt(e.M2, 4)}` },
        { at: [1.6 * cosd(-th + e.mu2), Math.max(-1.4, 1.6 * sind(-th + e.mu2)) + 0.15], text: `tail: μ₂ = ${fmt(e.mu2, 3)}°` },
      ],
    };
  }, [M1, th, nu1, e.mu1, e.mu2, e.M2]);

  return (
    <SimFrame title="Prandtl–Meyer expansion fan" subtitle="a convex corner: a fan of Mach waves, isentropic, p₀ constant">
      <div className="controls">
        <Slider label="Upstream Mach M₁" value={M1} min={1.01} max={5} step={0.01} onChange={setM1} />
        <Slider label="Turning angle θ" value={th} min={0} max={Math.max(1, thMax)} step={0.1} unit="°" onChange={setTheta} />
      </div>
      <PlanarFlow3D spec={spec} height={330} />
      <Readout
        items={[
          ['ν₁ = ν(M₁)', deg(nu1, 4)],
          ['ν₂ = ν₁ + θ', deg(e.nu2, 4)],
          ['M₂ (Table A6)', fmt(e.M2)],
          ['μ₁ (head, to ① flow)', deg(e.mu1)],
          ['μ₂ (tail, to ② flow)', deg(e.mu2)],
          ['p₂/p₁ = (p/p₀)₂ ÷ (p/p₀)₁', fmt(e.p2_p1)],
          ['T₂/T₁', fmt(e.T2_T1)],
          ['p₀₂/p₀₁', '1 (isentropic)'],
          ['turning left before vacuum', deg(pm.nuMax() - e.nu2)],
        ]}
      />
      <p style={note}>
        Every ray of the fan is a Mach line of the local flow, so the head sits at μ₁ to the incoming flow and the tail at μ₂ to the turned flow. The waves diverge (μ falls as M rises), so they can never pile up into a shock: the
        expansion is isentropic and <Tex>{'p_0'}</Tex> is unchanged.
      </p>
    </SimFrame>
  );
}

/* ================================================================ 4. Diamond airfoil */
export function DiamondAirfoilSim({
  initialM = 1.8,
  initialEps = 10,
  initialAlpha = 5,
  pInf = 100,
  chord = 1,
}: {
  initialM?: number;
  initialEps?: number;
  initialAlpha?: number;
  /** free-stream static pressure in kPa (scales the dimensional readouts only) */
  pInf?: number;
  /** chord in m */
  chord?: number;
}) {
  const [M, setM] = useState(initialM);
  const [eps, setEps] = useState(initialEps);
  const [alpha, setAlpha] = useState(initialAlpha);
  const r = useMemo(() => diamondAirfoil(M, eps, alpha), [M, eps, alpha]);
  const [f1, f2, f3, f4] = r.faces;

  const spec = useMemo<PlanarSpec>(() => {
    const box: Box = { x: [-0.7, 2.1], y: [-1.0, 1.0] };
    const LE: Pt = [0, 0];
    const TE: Pt = [cosd(alpha), -sind(alpha)];
    const mid: Pt = [TE[0] / 2, TE[1] / 2];
    const h = 0.5 * tand(eps);
    const TOP: Pt = [mid[0] + h * sind(alpha), mid[1] + h * cosd(alpha)];
    const BOT: Pt = [mid[0] - h * sind(alpha), mid[1] - h * cosd(alpha)];
    const dia: Pt[] = [LE, TOP, TE, BOT];
    const free: St = { M, dir: 0 };
    const pc = (p: number) => {
      const t = Math.max(-1, Math.min(1, Math.log(p) / Math.log(2.5)));
      const base = new THREE.Color('#f2f2f2');
      return (t >= 0 ? base.lerp(new THREE.Color('#ff3b2f'), t) : base.lerp(new THREE.Color('#2f7bff'), -t)).getStyle();
    };
    if (r.detached) {
      return {
        box,
        field: (x, y) => (inPoly([x, y], dia) ? null : free),
        bodies: [{ poly: dia }],
        shocks: [],
        fans: [],
        seeds: [-0.8, -0.5, -0.2, 0.1, 0.4, 0.7].map((y) => [box.x[0], y] as Pt),
        labels: [],
        warning: `front-face deflection ${fmt(Math.max(eps - alpha, eps + alpha), 3)}° > δmax = ${fmt(ob.deltaMax(M), 3)}°: the nose shock detaches, shock-expansion theory fails`,
      };
    }
    const up: Wave[] = [];
    const lo: Wave[] = [];
    if (f1.wave === 'shock') up.push({ kind: 'shock', o: LE, ang: f1.sigma, after: { M: f1.M, dir: f1.dir }, ds: -1 });
    else if (f1.wave === 'fan') up.push(fanWave(LE, M, 0, f1.turn, true));
    if (f3.wave === 'shock') lo.push({ kind: 'shock', o: LE, ang: -f3.sigma, after: { M: f3.M, dir: f3.dir }, ds: 1 });
    else if (f3.wave === 'fan') lo.push(fanWave(LE, M, 0, f3.turn, false));
    up.push(fanWave(TOP, f1.M, f1.dir, 2 * eps, true));
    lo.push(fanWave(BOT, f3.M, f3.dir, 2 * eps, false));
    // trailing edge (schematic: both streams turned back to the free-stream direction)
    const tu = -f2.dir;
    if (tu > 0.05) {
      const s = ob.obliqueShock(f2.M, tu);
      if (!s.detached) up.push({ kind: 'shock', o: TE, ang: f2.dir + s.sigma, after: { M: s.M2, dir: 0 }, ds: -1 });
    } else if (tu < -0.05) up.push(fanWave(TE, f2.M, f2.dir, -tu, true));
    const tl = f4.dir;
    if (tl > 0.05) {
      const s = ob.obliqueShock(f4.M, tl);
      if (!s.detached) lo.push({ kind: 'shock', o: TE, ang: f4.dir - s.sigma, after: { M: s.M2, dir: 0 }, ds: 1 });
    } else if (tl < -0.05) lo.push(fanWave(TE, f4.M, f4.dir, -tl, false));
    const isUpper = (x: number, y: number) => (x <= 0 ? y >= 0 : x >= TE[0] ? y >= TE[1] : y >= -x * tand(alpha));
    const shocks: Pt[][] = [];
    const fans: Pt[][] = [];
    for (const w of [...up, ...lo]) {
      if (w.kind === 'shock') shocks.push(clipRay(w.o, w.ang, box));
      else fans.push(...fanLines(w, box, 9));
    }
    const k = 0.6;
    const ax: Pt = [mid[0] + k * r.D, mid[1] + k * r.L];
    return {
      box,
      field: (x, y) => {
        if (inPoly([x, y], dia)) return null;
        return isUpper(x, y) ? chainState([x, y], free, up) : chainState([x, y], free, lo);
      },
      bodies: [{ poly: dia, edgeColors: [pc(f1.p), pc(f2.p), pc(f4.p), pc(f3.p)] }],
      shocks,
      fans,
      slips: [[TE, [box.x[1], TE[1]]]],
      seeds: [-0.85, -0.6, -0.35, -0.12, -0.04, 0.04, 0.12, 0.35, 0.6, 0.85].map((y) => [box.x[0], y] as Pt),
      arrows: [
        { from: mid, to: ax, color: '#5dffa8' },
        { from: mid, to: [mid[0], ax[1]], color: '#2fbf7a' },
        { from: mid, to: [ax[0], mid[1]], color: '#2fbf7a' },
      ],
      labels: [
        { at: [(LE[0] + TOP[0]) / 2 - 0.05, (LE[1] + TOP[1]) / 2 + 0.13], text: `① ${fmt(f1.p * pInf, 4)} kPa` },
        { at: [(TOP[0] + TE[0]) / 2 + 0.08, (TOP[1] + TE[1]) / 2 + 0.13], text: `② ${fmt(f2.p * pInf, 4)} kPa` },
        { at: [(LE[0] + BOT[0]) / 2 - 0.05, (LE[1] + BOT[1]) / 2 - 0.13], text: `③ ${fmt(f3.p * pInf, 4)} kPa` },
        { at: [(BOT[0] + TE[0]) / 2 + 0.08, (BOT[1] + TE[1]) / 2 - 0.13], text: `④ ${fmt(f4.p * pInf, 4)} kPa` },
        { at: [Math.min(1.85, ax[0] + 0.2), Math.max(-0.9, Math.min(0.9, ax[1] + 0.08))], text: 'resultant: L ↑ D →' },
        { at: [-0.45, 0.85], text: `M∞ = ${fmt(M, 3)}` },
      ],
    };
  }, [M, eps, alpha, r, f1, f2, f3, f4, pInf]);

  const kN = (x: number) => (isFinite(x) ? `${fmt(x * pInf * chord, 4)} kN/m` : '—');
  const waveTxt = (f: typeof f1) => (f.wave === 'shock' ? `shock δ = ${fmt(f.turn, 3)}°, σ = ${fmt(f.sigma, 4)}°` : f.wave === 'fan' ? `expansion fan θ = ${fmt(f.turn, 3)}°` : 'no wave (face parallel to the stream)');
  return (
    <SimFrame title="Diamond airfoil: shock-expansion theory" subtitle="shock or fan at the nose, 2ε fans at the shoulders, integrate p over the four faces">
      <div className="controls">
        <Slider label="Free-stream Mach M∞" value={M} min={1.2} max={5} step={0.01} onChange={setM} />
        <Slider label="Half-angle ε" value={eps} min={1} max={20} step={0.5} unit="°" onChange={setEps} />
        <Slider label="Angle of attack α" value={alpha} min={-15} max={15} step={0.5} unit="°" onChange={setAlpha} />
      </div>
      <PlanarFlow3D spec={spec} height={340} />
      <p style={note}>Faces are painted by pressure (red above p∞, blue below; trailing waves are schematic). The green arrow is the resultant force per unit span, split into L and D.</p>
      <Readout
        items={[
          ['① upper front', waveTxt(f1)],
          ['③ lower front', waveTxt(f3)],
          ['M₁ M₂ M₃ M₄', r.detached ? '—' : [f1, f2, f3, f4].map((f) => fmt(f.M, 3)).join(' · ')],
          ['p₁ p₂ p₃ p₄ (kPa)', r.detached ? '—' : [f1, f2, f3, f4].map((f) => fmt(f.p * pInf, 4)).join(' · ')],
          ['Lift L′ (⊥ to stream)', kN(r.L)],
          ['Drag D′ (∥ to stream)', kN(r.D)],
          ['C_L, C_D', r.detached ? '—' : `${fmt(r.cl, 3)}, ${fmt(r.cd, 3)}`],
          ['L/D', r.detached || Math.abs(r.D) < 1e-12 ? '—' : fmt(r.L / r.D, 3)],
          ['Ackeret C_L, C_D', `${fmt(r.clLinear, 3)}, ${fmt(r.cdLinear, 3)}`],
        ]}
      />
      <p style={note}>
        Face length <Tex>{'\\ell = (c/2)/\\cos\\varepsilon'}</Tex>, <Tex>{'q_\\infty = \\tfrac12\\gamma p_\\infty M_\\infty^2'}</Tex>, chord {fmt(chord, 3)} m, p∞ = {fmt(pInf, 4)} kPa. Push α past ε and the upper-front face turns{' '}
        <em>away</em> from the flow: its shock becomes an expansion fan.
      </p>
    </SimFrame>
  );
}

/* ================================================================ 5. Nozzle plume: over- vs under-expanded */
export function PlumeRegimeSim({ initialMe = 3, initialRatio = 1.6 }: { initialMe?: number; initialRatio?: number }) {
  const [Me, setMe] = useState(initialMe);
  const [ratio, setRatio] = useState(initialRatio); // p_b / p_e
  const AR = ise.A_Astar(Me);
  const rt = 0.12;
  const re = rt * Math.sqrt(AR);
  const profile = useMemo(() => (x: number) => (x < 0.5 ? rt + 0.9 * (0.5 - x) ** 2 : rt + (re - rt) * Math.min(1, (x - 0.5) / 1.5) ** 0.85), [re]);
  const field = useMemo(
    () => (x: number) => {
      const r = profile(x);
      const M = ise.M_from_A_Astar(Math.max(1, (r / rt) ** 2), x < 0.5 ? 'sub' : 'sup');
      return { M, p: ise.p_p0(M), T: ise.T_T0(M) };
    },
    [profile],
  );
  const pnMax = ns.py_px(Me);
  let info: [ReactNode, ReactNode][];
  let kind: 'over' | 'under' | 'ideal';
  if (ratio > 1.0001) {
    kind = 'over';
    if (ratio >= pnMax) info = [['regime', 'p_b/p_e above the normal-shock ratio: the shock moves into the nozzle']];
    else {
      const sg = ob.sigmaFromPressureRatio(Me, ratio);
      info = [
        ['regime', 'over-expanded: oblique shock at the lip'],
        ['Mn from p_b/p_e (A3)', fmt(ns.Mx_from_py_px(ratio))],
        ['lip shock σ', deg(sg)],
        ['flow turned inward δ', deg(ob.deltaFromSigma(Me, sg))],
      ];
    }
  } else if (ratio < 0.9999) {
    kind = 'under';
    const Mb = ise.M_from_p_p0(ise.p_p0(Me) * ratio);
    info = [
      ['regime', 'under-expanded: P-M fan at the lip'],
      ['M after the fan', fmt(Mb)],
      ['flow turned outward θ = ν(M) − ν(Mₑ)', deg(pm.nu(Mb) - pm.nu(Me))],
    ];
  } else {
    kind = 'ideal';
    info = [['regime', 'perfectly expanded: p_e = p_b, no waves']];
  }
  return (
    <SimFrame title="Nozzle plume: over- vs under-expanded" subtitle="the lip makes a shock (p_b > p_e) or a fan (p_b < p_e) so the jet boundary matches p_b">
      <div className="controls">
        <Slider label="Exit Mach Mₑ" value={Me} min={1.5} max={5} step={0.01} onChange={setMe} />
        <Slider label="p_b / p_e" value={ratio} min={0.05} max={Math.min(5, pnMax * 1.05)} step={0.01} onChange={setRatio} />
      </div>
      <FlowSection3D
        wall="engine"
        x0={0}
        x1={2}
        profile={profile}
        field={field}
        plume={{ kind, strength: Math.min(1.5, Math.abs(Math.log(ratio)) * 1.2 + 0.3) }}
        labels={[
          { x: 0.5, text: 'throat' },
          { x: 2, text: `exit · Mₑ = ${fmt(Me, 3)}` },
        ]}
        height={300}
      />
      <Readout items={[['A_e/A*', fmt(AR)], ...info]} />
      <p style={note}>
        Shock diamonds: the lip shocks cross on the axis, reflect off the jet boundary as expansions, which reflect back as compressions, and the pattern repeats. Open the full <a href="#/mech430/lab/engine">3-D rocket engine lab</a>.
      </p>
    </SimFrame>
  );
}
