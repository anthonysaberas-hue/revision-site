/**
 * MECH 341 3D labs A: TurbofanLab, PowerPlantLab, HeatPumpLab.
 * Every number comes from the tested lib (cycles, refrig, gas, compressible); the scenes are built once and read the sliders
 * from refs, so dragging a slider never rebuilds the WebGL renderer. The shared Three.js helpers at the top are also used by labsB.
 */
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import { Plot } from '../../../core/Plot';
import { Studio3D, StudioCtx, box, cyl, glass, metal, paint } from '../../mech412/viz/Studio3D';
import { LabGrid, useLatest } from '../../mech412/viz/LabKit';
import { f } from '../viz/Kit';
import { TsDiagramView, TsPoint } from '../viz/Diagrams';
import { atmosphere } from '../lib/gas';
import { P0_P, soundSpeed, stagnationT, T0_T } from '../lib/compressible';
import { rankine } from '../lib/cycles';
import { vcr } from '../lib/refrig';

/* ====================================================================== shared 3D helpers */
const HOT_STOPS: [number, THREE.Color][] = (
  [
    [0, '#1f4fd8'],
    [0.2, '#2aa8e8'],
    [0.4, '#43d49a'],
    [0.58, '#f3d23c'],
    [0.78, '#f2801f'],
    [0.92, '#d9272d'],
    [1, '#ffe9d0'],
  ] as [number, string][]
).map(([v, h]) => [v, new THREE.Color(h)]);
/** temperature colour ramp: 0 = cold blue … 1 = white-hot */
export function heat(t: number, out = new THREE.Color()) {
  const v = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  for (let i = 1; i < HOT_STOPS.length; i++) {
    if (v <= HOT_STOPS[i][0]) {
      const [a, ca] = HOT_STOPS[i - 1];
      const [b, cb] = HOT_STOPS[i];
      return out.copy(ca).lerp(cb, (v - a) / (b - a));
    }
  }
  return out.copy(HOT_STOPS[HOT_STOPS.length - 1][1]);
}

/** soft round sprite for particles and glows */
export function dotTex(hard = 0.35) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(hard, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** metal material that renders a solid colour on the cut face (back faces) when a clipping plane slices the closed solid */
export function cutMat(params: THREE.MeshStandardMaterialParameters, cut: string, planes: THREE.Plane[]) {
  const m = new THREE.MeshStandardMaterial({ ...params, side: THREE.DoubleSide, clippingPlanes: planes });
  const cc = new THREE.Color(cut);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = { value: cc };
    sh.fragmentShader =
      'uniform vec3 uCut;\n' +
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (!gl_FrontFacing) { gl_FragColor = vec4(uCut, 1.0); return; }');
  };
  m.customProgramCacheKey = () => `cm-${cut}`;
  return m;
}

/** closed solid of revolution about +x: wall of thickness t around the inner profile [[x, r], …] (r = 0 allowed for a solid nose) */
export function revolveSolid(inner: [number, number][], t: number, seg = 72) {
  const pts: THREE.Vector2[] = [];
  for (const [x, r] of inner) pts.push(new THREE.Vector2(Math.max(0.0005, r), x));
  for (let i = inner.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(inner[i][1] + t, inner[i][0]));
  pts.push(pts[0].clone());
  pts.reverse();
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** open surface of revolution about +x (single sheet), for glows and gas volumes */
export function revolveSheet(prof: [number, number][], seg = 48) {
  const g = new THREE.LatheGeometry(prof.map(([x, r]) => new THREE.Vector2(Math.max(0.0005, r), x)), seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** smooth piecewise-linear lookup */
export function lerpTable(tab: [number, number][], x: number) {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (x <= tab[i][0]) {
      const [a, ya] = tab[i - 1];
      const [b, yb] = tab[i];
      return ya + ((yb - ya) * (x - a)) / (b - a);
    }
  }
  return tab[tab.length - 1][1];
}

/** a cloud of additive point sprites that travel along a route. place() maps the route parameter u in [0,1) and two fixed random
 *  numbers a, b in [0,1) to a position; tint() colours the particle; speed is in route-fractions per second. */
export interface Cloud {
  object: THREE.Points;
  update: (dt: number, speed: number | ((u: number) => number)) => void;
  setVisible: (v: boolean) => void;
}
export function makeCloud(
  n: number,
  size: number,
  place: (u: number, a: number, b: number, out: THREE.Vector3) => void,
  tint: ((u: number, out: THREE.Color) => void) | THREE.ColorRepresentation,
  opts: { planes?: THREE.Plane[]; tex?: THREE.Texture; opacity?: number; additive?: boolean } = {},
): Cloud {
  const u = new Float32Array(n);
  const ra = new Float32Array(n);
  const rb = new Float32Array(n);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    u[i] = Math.random();
    ra[i] = Math.random();
    rb[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size,
    map: opts.tex ?? dotTex(),
    vertexColors: true,
    transparent: true,
    opacity: opts.opacity ?? 0.95,
    depthWrite: false,
    blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    sizeAttenuation: true,
    clippingPlanes: opts.planes,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  const fixed = typeof tint === 'function' ? null : new THREE.Color(tint);
  const write = () => {
    for (let i = 0; i < n; i++) {
      place(u[i], ra[i], rb[i], v);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
      if (fixed) c.copy(fixed);
      else (tint as (u: number, o: THREE.Color) => void)(u[i], c);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  write();
  return {
    object: pts,
    update(dt, speed) {
      for (let i = 0; i < n; i++) {
        const s = typeof speed === 'number' ? speed : speed(u[i]);
        u[i] += dt * s;
        if (u[i] >= 1) u[i] -= Math.floor(u[i]);
        else if (u[i] < 0) u[i] += 1;
      }
      write();
    },
    setVisible(vis) {
      pts.visible = vis;
    },
  };
}

/** piping path through waypoints with rounded elbows */
export function roundedPath(pts: [number, number, number][], rad = 0.12) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const P = pts.map((p) => new THREE.Vector3(...p));
  let cur = P[0].clone();
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1];
    const b = P[i];
    const c = P[i + 1];
    const r = Math.min(rad, a.distanceTo(b) / 2.2, b.distanceTo(c) / 2.2);
    const p1 = b.clone().add(a.clone().sub(b).normalize().multiplyScalar(r));
    const p2 = b.clone().add(c.clone().sub(b).normalize().multiplyScalar(r));
    if (cur.distanceTo(p1) > 1e-6) path.add(new THREE.LineCurve3(cur.clone(), p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    cur = p2;
  }
  path.add(new THREE.LineCurve3(cur.clone(), P[P.length - 1]));
  return path;
}
/** a coloured pipe with flanges at both ends; call .setColor() each frame */
export function makePipe(pts: [number, number, number][], r: number, rad = 0.14) {
  const path = roundedPath(pts, rad);
  const mat = new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.55, roughness: 0.32, emissive: '#000', emissiveIntensity: 0.35 });
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(24, pts.length * 18), r, 14, false), mat);
  tube.castShadow = true;
  g.add(tube);
  const flangeMat = metal('#7d8794', 0.35);
  for (const k of [0, 1]) {
    const p = path.getPointAt(k);
    const tan = path.getTangentAt(k);
    const fl = cyl(r * 1.55, r * 1.55, r * 0.5, flangeMat, 20);
    fl.position.copy(p);
    fl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    g.add(fl);
  }
  return {
    object: g,
    path,
    setColor(c: THREE.Color) {
      mat.color.copy(c);
      mat.emissive.copy(c);
    },
  };
}
/** particles that follow a pipe path */
export function pipeCloud(path: THREE.Curve<THREE.Vector3>, n: number, size: number, rJit: number) {
  const tmp = new THREE.Vector3();
  const cl = makeCloud(
    n,
    size,
    (u, a, b, out) => {
      path.getPointAt(u, out);
      const ang = a * Math.PI * 2;
      out.x += Math.cos(ang) * rJit * b;
      out.y += Math.sin(ang) * rJit * b;
      out.z += Math.cos(ang * 1.7) * rJit * b * 0.6;
      void tmp;
    },
    '#ffffff',
  );
  return cl;
}

/** sprite label whose text can change */
export function liveLabel(scale = 0.5, color = '#dbe8ff') {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(scale * 4, scale, 1);
  sp.renderOrder = 20;
  let last = '';
  return {
    sprite: sp,
    set(text: string) {
      if (text === last) return;
      last = text;
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = 'rgba(8,12,22,.78)';
      ctx.beginPath();
      ctx.roundRect(4, 18, 504, 92, 18);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = '600 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 64);
      tex.needsUpdate = true;
    },
  };
}

/** rotated InstancedMesh row of blades around +x: n blades of size (t, span, chord) at radius r0..r1, pitch angle in rad */
export function bladeRow(n: number, x: number, r0: number, r1: number, t: number, chord: number, pitch: number, mat: THREE.Material) {
  const span = r1 - r0;
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(t, span, chord), mat, n);
  m.castShadow = true;
  const M = new THREE.Matrix4();
  const R = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    M.makeRotationX(th);
    M.multiply(R.makeTranslation(x, (r0 + r1) / 2, 0));
    M.multiply(R.makeRotationY(pitch));
    m.setMatrixAt(i, M);
  }
  m.instanceMatrix.needsUpdate = true;
  return m;
}

const nz = (v: number) => (Number.isFinite(v) ? v : 0);
const LabFoot = ({ children }: { children: React.ReactNode }) => <p style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{children}</p>;
const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem', margin: '6px 0' }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);
export { LabFoot as LabNote, Check as LabCheck };

/* ====================================================================== TurbofanLab */
export interface TfIn {
  z: number; // altitude m
  Ma: number;
  rc: number; // core compressor pressure ratio (after the fan)
  T04: number; // K
  B: number; // bypass ratio
  fpr: number; // fan pressure ratio
}
const TF = { ka: 1.4, kg: 1.333, cpa: 1.005, cpg: 1.147, QHV: 43000, etaD: 0.97, etaF: 0.88, etaC: 0.88, etaT: 0.9, etaN: 0.98 };
/** ideal-gas two-stream turbofan, per kg/s of core air. Same station logic and component efficiencies as lib turbojet (B = 0 and fpr = 1 gives the turbojet). */
export function turbofanCycle(i: TfIn) {
  const { ka, kg, cpa, cpg, QHV, etaD, etaF, etaC, etaT, etaN } = TF;
  const { T: Ta, P: Pa } = atmosphere(i.z);
  const V = i.Ma * soundSpeed(Ta, 0.287, ka);
  const T02 = stagnationT(Ta, V, cpa);
  const P02 = Pa * Math.pow(1 + etaD * (T02 / Ta - 1), ka / (ka - 1));
  const P013 = i.fpr * P02;
  const T013 = T02 * (1 + (Math.pow(i.fpr, (ka - 1) / ka) - 1) / etaF);
  const wF = cpa * (T013 - T02);
  const P03 = i.rc * P013;
  const T03 = T013 * (1 + (Math.pow(i.rc, (ka - 1) / ka) - 1) / etaC);
  const wC = cpa * (T03 - T013);
  const fuel = (cpg * i.T04 - cpa * T03) / (QHV - cpg * i.T04);
  const dT = (wC + i.B * wF) / cpg;
  const T05 = i.T04 - dT;
  const pr = 1 - dT / (etaT * i.T04);
  const P05 = pr > 0 ? P03 * Math.pow(pr, kg / (kg - 1)) : 0;
  const feasible = pr > 0 && P05 > Pa * 1.001 && fuel > 0 && T05 > 300;
  const T6s = feasible ? T05 * Math.pow(Pa / P05, (kg - 1) / kg) : T05;
  const Vc = feasible ? Math.sqrt(2000 * cpg * etaN * (T05 - T6s)) : 0;
  const T6bs = T013 * Math.pow(Pa / P013, (ka - 1) / ka);
  const Vb = P013 > Pa ? Math.sqrt(2000 * cpa * etaN * (T013 - T6bs)) : 0;
  const F = feasible ? (1 + fuel) * Vc + i.B * Vb - (1 + i.B) * V : 0; // N per kg/s of core air
  const KE = 0.5 * ((1 + fuel) * Vc * Vc + i.B * Vb * Vb - (1 + i.B) * V * V);
  const mCore = 55 * (Pa / 101.325) * Math.sqrt(288.15 / Ta);
  return {
    Ta, Pa, V, T02, P02, T013, P013, T03, P03, T05, P05, wF, wC, fuel, feasible, Vc, Vb, F, Fs: F / (1 + i.B), KE,
    TSFC: feasible && F > 0 ? (fuel / F) * 1e6 : NaN, // mg/(N s)
    etaPc: (2 * V) / (V + Vc), etaPb: (2 * V) / (V + Vb), etaP: KE > 0 ? (F * V) / KE : NaN, etaTh: (KE / (fuel * QHV * 1000)) || 0,
    mCore, Ftot: (F * mCore) / 1000, // kN
    Fcore: (feasible ? (1 + fuel) * Vc - V : 0) * mCore / 1000, Fbyp: i.B * (Vb - V) * mCore / 1000,
  };
}

export function TurbofanLab() {
  const [z, setZ] = useState(10668);
  const [Ma, setMa] = useState(0.78);
  const [rc, setRc] = useState(20);
  const [T04, setT04] = useState(1500);
  const [B, setB] = useState(5);
  const [fpr, setFpr] = useState(1.6);
  const inp: TfIn = { z, Ma, rc, T04, B, fpr };
  const r = turbofanCycle(inp);
  const P = useLatest({ ...inp, r });

  const trend = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    const eff: { x: number; y: number }[] = [];
    for (let b = 0; b <= 14; b += 0.25) {
      const c = turbofanCycle({ z, Ma, rc, T04, B: b, fpr });
      if (c.feasible && Number.isFinite(c.TSFC) && c.TSFC < 80) {
        out.push({ x: b, y: c.TSFC });
        eff.push({ x: b, y: c.etaP * 100 });
      }
    }
    return { tsfc: out, eta: eff };
  }, [z, Ma, rc, T04, fpr]);
  const bMax = trend.tsfc.length ? trend.tsfc[trend.tsfc.length - 1].x : 0;

  const setup = (ctx: StudioCtx) => {
    const { scene, renderer } = ctx;
    renderer.localClippingEnabled = true;
    const planes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    const root = new THREE.Group();
    scene.add(root);
    const nacelleMat = cutMat({ color: '#d7dde6', metalness: 0.9, roughness: 0.22 }, '#6d7683', planes);
    const coreMat = cutMat({ color: '#9aa5b3', metalness: 1, roughness: 0.3 }, '#5a636f', planes);
    const linerMat = cutMat({ color: '#6d5a48', metalness: 0.7, roughness: 0.5 }, '#3d3027', planes);
    const tiMat = new THREE.MeshStandardMaterial({ color: '#c9d1da', metalness: 1, roughness: 0.2, clippingPlanes: planes, side: THREE.DoubleSide });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#59616d', metalness: 1, roughness: 0.38, clippingPlanes: planes, side: THREE.DoubleSide });

    /* nacelle (outer cowl) with inlet lip, bypass nozzle at the rear */
    const rn: [number, number][] = [[-3.5, 0.86], [-3.38, 0.92], [-3.1, 0.95], [-2.0, 0.97], [-0.5, 0.95], [1.0, 0.8], [1.7, 0.7]];
    const nacelle = new THREE.Mesh(revolveSolid(rn, 0.07, 96), nacelleMat);
    nacelle.castShadow = true;
    root.add(nacelle);
    /* core structure: outer radius of the core cowl (inner wall of the bypass duct) */
    const rCore: [number, number][] = [[-2.6, 0.2], [-2.45, 0.4], [-1.6, 0.44], [-0.5, 0.48], [0.4, 0.46], [1.2, 0.42], [1.7, 0.36]];
    const coreCowl = new THREE.Mesh(revolveSolid(rCore, 0.04, 96), coreMat);
    root.add(coreCowl);
    /* inner flowpath wall (casing inside the core cowl) is drawn by the cowl thickness; shaft/hub drum below */
    const drum = new THREE.Mesh(revolveSolid([[-2.5, 0], [-2.3, 0.12], [-0.7, 0.19], [-0.45, 0.12], [0.2, 0.12], [1.15, 0.14], [1.7, 0.1], [2.3, 0]].map(([x, r]) => [x, r] as [number, number]), 0.0, 48), darkMat);
    root.add(drum);
    /* spinner + fan disc */
    const spinner = new THREE.Mesh(revolveSolid([[-3.25, 0], [-3.1, 0.12], [-2.9, 0.2], [-2.65, 0.24]], 0.02, 64), cutMat({ color: '#e9edf2', metalness: 0.85, roughness: 0.18 }, '#6d7683', planes));
    const fanGroup = new THREE.Group();
    fanGroup.add(bladeRow(20, -2.78, 0.2, 0.94, 0.022, 0.21, 0.62, tiMat));
    const fanDisc = new THREE.Mesh(revolveSolid([[-2.9, 0.1], [-2.78, 0.22], [-2.62, 0.22]], 0.0, 48), darkMat);
    root.add(spinner, fanDisc, fanGroup);
    /* outlet guide vanes in the bypass duct */
    const ogv = bladeRow(28, -2.2, 0.44, 0.94, 0.018, 0.16, -0.5, darkMat);
    root.add(ogv);
    /* low/high-pressure compressor: 8 rotor rows (hub drum radius grows, casing tapers) + stators */
    const compRot: THREE.InstancedMesh[] = [];
    const compMat: THREE.MeshStandardMaterial[] = [];
    for (let k = 0; k < 8; k++) {
      const x = -2.32 + k * 0.2;
      const casing = 0.4 - k * 0.022;
      const hub = 0.14 + k * 0.007;
      const m = new THREE.MeshStandardMaterial({ color: '#b9c3cf', metalness: 1, roughness: 0.28, clippingPlanes: planes, side: THREE.DoubleSide });
      const row = bladeRow(26 + k * 2, x, hub, casing - 0.012, 0.012, 0.075 - k * 0.003, 0.7, m);
      const stator = bladeRow(30 + k * 2, x + 0.1, hub, casing - 0.006, 0.01, 0.06 - k * 0.002, -0.6, darkMat);
      root.add(row, stator);
      compRot.push(row);
      compMat.push(m);
    }
    /* annular combustor: ceramic-coated liner, fuel nozzles and a glowing flame volume */
    const liner = new THREE.Mesh(revolveSolid([[-0.68, 0.3], [-0.45, 0.33], [0.1, 0.33], [0.25, 0.28]], 0.025, 64), linerMat);
    const linerIn = new THREE.Mesh(revolveSheet([[-0.65, 0.17], [-0.4, 0.19], [0.1, 0.2], [0.25, 0.2]], 48), new THREE.MeshStandardMaterial({ color: '#7a6652', metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide, clippingPlanes: planes }));
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ff8a1c', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: planes });
    const flame = new THREE.Mesh(revolveSheet([[-0.6, 0.22], [-0.5, 0.26], [-0.2, 0.28], [0.05, 0.26], [0.22, 0.23]], 48), flameMat);
    const flame2 = new THREE.Mesh(revolveSheet([[-0.55, 0.2], [-0.3, 0.24], [0, 0.23], [0.2, 0.21]], 40), new THREE.MeshBasicMaterial({ color: '#fff0b0', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: planes }));
    root.add(liner, linerIn, flame, flame2);
    const inj = new THREE.InstancedMesh(new THREE.ConeGeometry(0.018, 0.09, 10), metal('#cfa56a', 0.3), 18);
    const Mx = new THREE.Matrix4();
    const Rx = new THREE.Matrix4();
    for (let i = 0; i < 18; i++) {
      Mx.makeRotationX((i / 18) * Math.PI * 2);
      Mx.multiply(Rx.makeTranslation(-0.66, 0.25, 0));
      Mx.multiply(Rx.makeRotationZ(-Math.PI / 2));
      inj.setMatrixAt(i, Mx);
    }
    root.add(inj);
    const burnLight = new THREE.PointLight('#ff8a2a', 3, 3.5, 1.6);
    burnLight.position.set(-0.2, 0.25, 0.1);
    root.add(burnLight);
    /* turbine: 4 rows, hot-tinted */
    const turbRot: THREE.InstancedMesh[] = [];
    const turbMat: THREE.MeshStandardMaterial[] = [];
    [0.32, 0.72, 0.9, 1.06].forEach((x, k) => {
      const m = new THREE.MeshStandardMaterial({ color: '#8d8f93', metalness: 1, roughness: 0.35, emissive: '#000', clippingPlanes: planes, side: THREE.DoubleSide });
      const casing = 0.3 + k * 0.022;
      const row = bladeRow(34 + k * 4, x, 0.12 + k * 0.01, casing - 0.01, 0.014, 0.08 + k * 0.01, 0.8, m);
      const stat = bladeRow(34 + k * 4, x - 0.1, 0.12, casing - 0.01, 0.012, 0.06, -0.7, darkMat);
      root.add(row, stat);
      turbRot.push(row);
      turbMat.push(m);
    });
    /* core nozzle plug */
    const plug = new THREE.Mesh(revolveSolid([[1.15, 0.12], [1.55, 0.1], [2.0, 0.05], [2.3, 0.0]], 0.02, 48), cutMat({ color: '#6d6f73', metalness: 1, roughness: 0.4 }, '#444', planes));
    root.add(plug);
    /* pylon-less engine shown with a floor-mounted stand */
    const stand = box(0.14, 0.9, 0.14, metal('#3b4350', 0.5), [-0.4, -1.4, 0]);
    const stand2 = box(0.14, 0.9, 0.14, metal('#3b4350', 0.5), [1.1, -1.4, 0]);
    const rail = box(4.4, 0.08, 0.3, metal('#3b4350', 0.5), [0.4, -0.93, 0]);
    root.add(stand, stand2, rail);
    root.position.set(-0.3, 1.9, 0);
    // lift the stand floor reference
    stand.position.y = -0.46 - 0.45;
    stand2.position.y = -0.46 - 0.45;

    /* particles: the free stream into the intake, the bypass stream, the core stream (coloured by T0 along the path) */
    const norm = (T: number) => (T - 200) / 1750;
    const T0core = (x: number, p: typeof P.current) =>
      lerpTable(
        [
          [-6, p.r.T02], [-3.0, p.r.T02], [-2.7, p.r.T013], [-2.35, p.r.T013], [-0.7, p.r.T03], [-0.5, p.r.T03], [0.1, p.T04], [0.3, p.T04],
          [1.15, Math.max(p.r.T05, 300)], [4.6, Math.max(p.r.T05, 300)],
        ],
        x,
      );
    const rIn = (x: number) => lerpTable([[-3.5, 0.84], [-3.1, 0.94], [-2.0, 0.96], [-0.5, 0.94], [1.0, 0.79], [1.7, 0.69]], x);
    const rOut = (x: number) => lerpTable([[-2.6, 0.2], [-2.45, 0.4], [-1.6, 0.44], [-0.5, 0.48], [0.4, 0.46], [1.2, 0.42], [1.7, 0.36]], x);
    const tmpc = new THREE.Color();
    const xRange = (u: number) => -6 + u * 10.6; // route -6 … 4.6
    const cs = { v: 1 };
    const intake = makeCloud(
      260,
      0.05,
      (u, a, b, out) => {
        const x = -6 + u * 2.7; // -6 … -3.3
        const rr = (0.1 + 0.9 * Math.sqrt(a)) * (0.96 - 0.1 * u);
        const th = b * Math.PI * 2;
        out.set(x, rr * Math.cos(th), rr * Math.sin(th));
      },
      (u, c) => c.copy(heat(norm(P.current.r.Ta + 20 * u))).multiplyScalar(0.9),
      { planes },
    );
    const bypass = makeCloud(
      520,
      0.045,
      (u, a, b, out) => {
        const x = -3.3 + u * 7.9; // -3.3 … 4.6
        const lo = x < -2.5 ? 0.12 : rOut(x) + 0.05;
        const hi = x < 1.7 ? rIn(x) - 0.08 : Math.min(rIn(1.7) - 0.08, 0.62 - (x - 1.7) * 0.07);
        const rr = x < -2.5 ? lo + (hi - lo) * a * 0.85 + 0.35 * a : lo + (hi - lo) * a;
        const th = b * Math.PI * 2;
        out.set(x, rr * Math.cos(th), rr * Math.sin(th));
      },
      (u, c) => {
        const x = -3.3 + u * 7.9;
        const T = lerpTable([[-3.3, P.current.r.T02], [-2.9, P.current.r.T02], [-2.6, P.current.r.T013], [4.6, P.current.r.T013]], x);
        const fade = x > 1.7 ? Math.max(0.15, 1 - (x - 1.7) / 3.2) : 1;
        c.copy(heat(norm(T))).multiplyScalar(fade);
      },
      { planes },
    );
    const core = makeCloud(
      620,
      0.05,
      (u, a, b, out) => {
        const x = -2.7 + u * 7.3; // -2.7 … 4.6
        const hub = lerpTable([[-2.7, 0.12], [-2.3, 0.15], [-0.7, 0.19], [-0.5, 0.17], [0.2, 0.15], [1.15, 0.13], [1.7, 0.1], [2.3, 0.02], [4.6, 0.0]], x);
        const cas = x < 1.7 ? rOut(x) - 0.06 : Math.max(0.12, 0.3 - (x - 1.7) * 0.03 + (x - 1.7) * 0.015);
        const th = b * Math.PI * 2;
        const rr = hub + (cas - hub) * (0.1 + 0.85 * a);
        out.set(x, rr * Math.cos(th), rr * Math.sin(th));
      },
      (u, c) => {
        const x = -2.7 + u * 7.3;
        const T = T0core(x, P.current);
        const fade = x > 1.8 ? Math.max(0.12, 1 - (x - 1.8) / 3.2) : 1;
        c.copy(heat(norm(T))).multiplyScalar(fade);
      },
      { planes },
    );
    void xRange;
    root.add(intake.object, bypass.object, core.object);

    /* station tags */
    const mkTag = (x: number, y: number) => {
      const L = liveLabel(0.28);
      L.sprite.position.set(x, y, 0.25);
      root.add(L.sprite);
      return L;
    };
    const tags = { fan: mkTag(-2.8, 1.25), comp: mkTag(-1.4, 0.82), comb: mkTag(-0.2, 0.7), turb: mkTag(0.75, 0.72), noz: mkTag(2.0, 0.55) };

    /* exhaust glow */
    const glowTex = dotTex();
    const jet = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff9a3a', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    jet.position.set(2.1, 0, 0.0);
    root.add(jet);

    let tAcc = 0;
    return {
      update: (dt: number) => {
        const p = P.current;
        tAcc += dt;
        const wFan = 3 + 5 * (p.fpr - 1);
        const wHP = 1.5 + 0.22 * p.rc;
        fanGroup.rotation.x += dt * wFan;
        compRot.forEach((m, k) => {
          m.rotation.x += dt * wHP * (0.9 + 0.02 * k);
          // blade tint: steel warms toward the compressor exit temperature
          const Tloc = p.r.T013 + ((p.r.T03 - p.r.T013) * (k + 1)) / 8;
          compMat[k].color.copy(heat(norm(Tloc))).lerp(new THREE.Color('#c4ccd6'), 0.62);
        });
        turbRot.forEach((m, k) => {
          m.rotation.x += dt * wHP * 0.9;
          const Tloc = p.T04 - ((p.T04 - p.r.T05) * (k + 0.5)) / 4;
          const c = heat(norm(Tloc));
          turbMat[k].color.copy(c).lerp(new THREE.Color('#8d8f93'), 0.4);
          turbMat[k].emissive.copy(c).multiplyScalar(Math.max(0, norm(Tloc) - 0.4) * 0.5);
        });
        const flick = 0.85 + 0.15 * Math.sin(tAcc * 19) * Math.sin(tAcc * 7.3);
        const k4 = Math.min(1, Math.max(0, (p.T04 - 900) / 1100));
        flameMat.opacity = (0.25 + 0.5 * k4) * flick;
        flameMat.color.copy(heat(0.62 + 0.3 * k4));
        burnLight.intensity = (1.5 + 5 * k4) * flick;
        const vScale = Math.sqrt(Math.max(p.r.V, 20) / 240);
        cs.v = vScale;
        intake.update(dt, 0.6 * vScale + 0.15);
        bypass.update(dt, (u) => (0.05 + 0.1 * Math.sqrt(Math.max(p.r.Vb, 50) / 300) * (u > 0.52 ? 1.45 : 0.9)) * (1 + p.B * 0.03));
        core.update(dt, (u) => (u < 0.62 ? 0.04 + 0.01 * p.rc * 0.06 : 0.05 + 0.2 * Math.sqrt(Math.max(p.r.Vc, 50) / 600) * (u > 0.62 ? 1 : 0)));
        jet.scale.setScalar(0.9 + 1.6 * Math.sqrt(Math.max(p.r.Vc, 0) / 600));
        (jet.material as THREE.SpriteMaterial).opacity = p.r.feasible ? 0.55 : 0;
        const rd = (T: number) => `${Math.round(T / 5) * 5} K`;
        tags.fan.set(`fan out  T₀ ${rd(p.r.T013)}`);
        tags.comp.set(`compressor  T₀ ${rd(p.r.T03)}`);
        tags.comb.set(`combustor  T₀ ${rd(p.T04)}`);
        tags.turb.set(`turbine out  T₀ ${rd(p.r.T05)}`);
        tags.noz.set(p.r.feasible ? `core jet ${Math.round(p.r.Vc)} m/s` : 'turbine cannot drive the fan');
      },
    };
  };

  const stations = [
    { x: 0, y: r.Ta },
    { x: 1, y: r.T02 },
    { x: 2, y: r.T013 },
    { x: 3, y: r.T03 },
    { x: 4, y: T04 },
    { x: 5, y: nz(r.T05) },
  ];
  const stationBy = [
    { x: 0, y: r.Ta },
    { x: 1, y: r.T02 },
    { x: 2, y: r.T013 },
    { x: 5, y: r.T013 },
  ];
  const bar = (c: string) => ({ color: c });
  void bar;
  return (
    <SimFrame title="Turbofan cutaway lab" subtitle={<span>core + bypass: F = (1+f)V<sub>c</sub> + B·V<sub>b</sub> − (1+B)V per kg of core air</span>}>
      <LabGrid
        left={
          <>
            <Studio3D
              setup={setup}
              height={400}
              camera={[0.5, 3.0, 10.8]}
              target={[-0.3, 1.9, 0]}
              fov={36}
              caption="Half-section of a two-spool turbofan. Particles carry the stagnation temperature T₀ (blue = cold, red/white = hot); the fan and compressor rings spin faster with pressure ratio. Drag to orbit."
            />
            <Plot
              x={[0, 5]}
              y={[150, Math.max(T04, 600) * 1.08]}
              height={220}
              xLabel="station (0 ambient, 1 inlet, 2 fan exit, 3 compressor exit, 4 turbine inlet, 5 turbine exit)"
              yLabel="T₀ (K)"
              series={[
                { points: stations, color: 'var(--c3)', width: 2.4, label: 'core stream' },
                { points: stationBy, color: 'var(--c1)', width: 2.4, label: 'bypass stream' },
              ]}
              dots={stations.map((p) => ({ ...p, color: 'var(--c3)' }))}
              legend
            />
            <Plot
              x={[0, 14]}
              y={[0, Math.max(30, ...trend.tsfc.map((p) => p.y)) * 1.05]}
              height={220}
              xLabel="bypass ratio B (other sliders fixed)"
              yLabel="TSFC (mg/(N·s))"
              series={[{ points: trend.tsfc, color: 'var(--c2)', width: 2.6, label: 'TSFC vs bypass ratio' }]}
              dots={r.feasible && Number.isFinite(r.TSFC) ? [{ x: B, y: r.TSFC, color: 'var(--c3)' }] : []}
              vlines={bMax < 14 ? [{ x: bMax, dash: true, label: 'turbine runs out of work' }] : []}
              legend
            />
          </>
        }
        right={
          <>
            <Slider label="altitude" value={z} min={0} max={13000} step={100} onChange={setZ} format={(v) => (v / 1000).toFixed(1)} unit=" km" />
            <Slider label="flight Mach number" value={Ma} min={0} max={0.9} step={0.01} onChange={setMa} format={(v) => v.toFixed(2)} />
            <Slider label="core compressor ratio r_c" value={rc} min={6} max={40} step={0.5} onChange={setRc} format={(v) => v.toFixed(1)} />
            <Slider label="turbine inlet T₀₄" value={T04} min={1100} max={1900} step={10} onChange={setT04} unit=" K" />
            <Slider label="bypass ratio B" value={B} min={0} max={14} step={0.1} onChange={setB} format={(v) => v.toFixed(1)} />
            <Slider label="fan pressure ratio" value={fpr} min={1.1} max={2.2} step={0.02} onChange={setFpr} format={(v) => v.toFixed(2)} />
            {r.feasible ? (
              <Readout
                items={[
                  ['total thrust', `${f(r.Ftot, 4)} kN`],
                  ['core / bypass share', `${f(r.Fcore, 3)} / ${f(r.Fbyp, 3)} kN`],
                  ['TSFC', `${f(r.TSFC, 3)} mg/(N·s)`],
                  ['jet speeds core / bypass', `${f(r.Vc, 4)} / ${f(r.Vb, 4)} m/s`],
                  ['η_p core / bypass', `${f(r.etaPc, 3)} / ${f(r.etaPb, 3)}`],
                  ['η_p overall', f(r.etaP, 3)],
                  ['η_thermal', f(r.etaTh, 3)],
                  ['flight speed', `${f(r.V, 4)} m/s`],
                ]}
              />
            ) : (
              <div role="alert" style={{ border: '1px solid var(--c3,#d33)', borderRadius: 8, padding: '8px 12px', margin: '8px 0', fontSize: '.9rem' }}>
                <b style={{ color: 'var(--c3,#d33)' }}>The turbine cannot supply the fan and compressor work at this setting</b> (its expansion would drop below ambient pressure). Lower the bypass ratio or fan pressure ratio, or raise T₀₄.
              </div>
            )}
            <LabFoot>
              Core air flow is scaled as a typical ≈ 55 kg/s at sea level (corrected-flow scaling with altitude); thrust is the fully expanded value for both nozzles, with the lib’s component efficiencies (η_C 0.88, η_T 0.90, η_N 0.98, η_fan 0.88). Same station logic as <code>turbojet</code>: B = 0 and fan ratio 1.1 reproduces the turbojet.
            </LabFoot>
          </>
        }
      />
    </SimFrame>
  );
}

/* ====================================================================== PowerPlantLab */
const TMAX_PLANT = 650;
const tN = (T: number) => (T - 20) / (TMAX_PLANT - 20);
interface PlantCfg {
  Pb: number; // kPa
  Tb: number;
  Pc: number;
  etaT: number;
  reheat: boolean;
  heater: 'none' | 'ofwh' | 'cfwh';
  MW: number;
}
function plantCycle(c: PlantCfg) {
  const Prh = 0.2 * c.Pb;
  const Pbleed = Math.sqrt(c.Pc * (c.reheat ? Prh : c.Pb));
  const res = rankine({
    Pb: c.Pb,
    Tb: c.Tb,
    Pc: c.Pc,
    etaT: c.etaT,
    etaP: 0.9,
    reheat: c.reheat ? { P: Prh, T: c.Tb } : undefined,
    ofwh: c.heater === 'ofwh' ? { P: Pbleed } : undefined,
    cfwh: c.heater === 'cfwh' ? { P: Pbleed, drain: 'back' } : undefined,
    Wnet: c.MW * 1000,
  });
  return { res, Prh, Pbleed };
}
function plantTs(c: PlantCfg, res: ReturnType<typeof rankine>, Prh: number, Pbleed: number) {
  const S = res.states;
  const pts: TsPoint[] = [];
  const path: number[] = [];
  const add = (st: { s: number; T: number }, P: number, label: string) => {
    pts.push({ s: st.s, T: st.T, P, label });
    path.push(pts.length - 1);
  };
  add(S.condExit, c.Pc, '1');
  if (c.heater === 'ofwh') {
    add(S.pump1Exit, Pbleed, '2');
    add(S.fwhExit, Pbleed, '3');
    add(S.pump2Exit, c.Pb, '4');
  } else if (c.heater === 'cfwh') {
    add(S.pump1Exit, c.Pb, '2');
    add(S.fwhExit, c.Pb, '3');
  } else add(S.pump1Exit, c.Pb, '2');
  add(S.turbineIn, c.Pb, 'B');
  if (c.reheat) {
    add(S.reheatIn, Prh, 'R1');
    add(S.reheatOut, Prh, 'R2');
  }
  if (c.heater !== 'none') add(S.bleed, Pbleed, 'bleed');
  add(S.turbineExit, c.Pc, 'T');
  path.push(0);
  return { pts, path };
}

type PlantCalc = { res: ReturnType<typeof rankine>; Prh: number; Pbleed: number };

export function PowerPlantLab() {
  const [Pb, setPb] = useState(12000);
  const [Tb, setTb] = useState(550);
  const [Pc, setPc] = useState(10);
  const [etaT, setEtaT] = useState(0.9);
  const [MW, setMW] = useState(300);
  const [reheat, setReheat] = useState(true);
  const [heater, setHeater] = useState<'none' | 'ofwh' | 'cfwh'>('ofwh');
  const cfg: PlantCfg = { Pb, Tb, Pc, etaT, reheat, heater, MW };
  const calc = useMemo(() => {
    try {
      return { ok: true as const, ...plantCycle({ Pb, Tb, Pc, etaT, reheat, heater, MW }) };
    } catch (e) {
      return { ok: false as const, msg: String((e as Error).message) };
    }
  }, [Pb, Tb, Pc, etaT, MW, reheat, heater]);
  const keep = useMemo(() => ({ cur: null as null | PlantCalc }), []);
  if (calc.ok) keep.cur = calc;
  const good = keep.cur;
  const P = useLatest({ cfg, good });

  const setup = (ctx: StudioCtx) => {
    const { scene, renderer, controls } = ctx;
    renderer.localClippingEnabled = true;
    controls.maxDistance = 30;
    scene.fog = new THREE.Fog('#070a12', 26, 60);
    const planes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    const root = new THREE.Group();
    scene.add(root);
    const steel = metal('#aeb7c3', 0.3);
    const dark = metal('#4a5360', 0.42);
    const AX = 2.4; // turbine axis height
    const tmpC = new THREE.Color();
    const M4 = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationZ(Math.PI / 2);

    /* ---------- steel trestle (turbine table) ---------- */
    const trestle = new THREE.Group();
    for (const x of [-1.65, -0.35, 0.15, 2.35, 3.0, 4.55]) for (const z of [-0.75, 0.75]) trestle.add(box(0.14, 1.55, 0.14, dark, [x, 0.78, z]));
    for (const z of [-0.75, 0.75]) trestle.add(box(6.3, 0.14, 0.2, metal('#59626f', 0.4), [1.45, 1.57, z]));
    for (const x of [-1.65, 0.15, 2.35, 3.0, 4.55]) trestle.add(box(0.16, 0.12, 1.6, dark, [x, 1.57, 0]));
    root.add(trestle);

    /* ---------- HP + LP turbines, half-section with rotating blade rows ---------- */
    const bodyMat = cutMat({ color: '#9aa5b3', metalness: 1, roughness: 0.3 }, '#59626f', planes);
    const rotorMat = new THREE.MeshStandardMaterial({ color: '#7d8590', metalness: 1, roughness: 0.35, side: THREE.DoubleSide, clippingPlanes: planes });
    const hpProf: [number, number][] = [[-1.62, 0.3], [-1.45, 0.3], [-0.95, 0.36], [-0.55, 0.42], [-0.4, 0.4]];
    const lpProf: [number, number][] = [[0.08, 0.42], [0.35, 0.55], [0.7, 0.7], [1.0, 0.76], [1.2, 0.78], [1.4, 0.76], [1.7, 0.7], [2.05, 0.55], [2.32, 0.42]];
    const hpCase = new THREE.Mesh(revolveSolid(hpProf, 0.06, 72), bodyMat);
    const lpCase = new THREE.Mesh(revolveSolid(lpProf, 0.07, 96), bodyMat);
    const rotor = new THREE.Mesh(revolveSolid([[-1.7, 0.02], [-1.62, 0.1], [-0.4, 0.2], [-0.3, 0.1], [0.0, 0.1], [0.1, 0.2], [2.3, 0.2], [2.4, 0.1], [2.95, 0.1]], 0.0, 48), rotorMat);
    const gRoot = new THREE.Group();
    gRoot.position.y = AX;
    gRoot.add(hpCase, lpCase, rotor);
    root.add(gRoot);
    const rows: { m: THREE.InstancedMesh; mat: THREE.MeshStandardMaterial; kind: 'hp' | 'lp'; k: number }[] = [];
    for (let k = 0; k < 7; k++) {
      const x = -1.5 + k * 0.15;
      const rout = lerpTable(hpProf, x) - 0.02;
      const mat = new THREE.MeshStandardMaterial({ color: '#8d949d', metalness: 1, roughness: 0.3, emissive: '#000', side: THREE.DoubleSide, clippingPlanes: planes });
      const row = bladeRow(30, x, 0.2, rout, 0.014, 0.085, 0.7, mat);
      const st = bladeRow(30, x + 0.07, 0.2, rout, 0.012, 0.06, -0.6, dark);
      gRoot.add(row, st);
      rows.push({ m: row, mat, kind: 'hp', k });
    }
    for (const side of [-1, 1])
      for (let k = 0; k < 6; k++) {
        const x = 1.2 + side * (0.2 + k * 0.17);
        const rout = lerpTable(lpProf, x) - 0.025;
        const mat = new THREE.MeshStandardMaterial({ color: '#8d949d', metalness: 1, roughness: 0.3, emissive: '#000', side: THREE.DoubleSide, clippingPlanes: planes });
        const row = bladeRow(34 + k * 3, x, 0.2, rout, 0.014, 0.1 + 0.015 * k, 0.7, mat);
        gRoot.add(row);
        rows.push({ m: row, mat, kind: 'lp', k });
      }
    /* shaft couplings (orange guards) + bearing pedestals */
    const guard = paint('#e0701c', 0.45, 0.4);
    for (const x of [-0.35, 0.02, 2.35, 2.85]) {
      const g = cyl(0.19, 0.19, 0.22, guard, 32);
      g.rotation.z = Math.PI / 2;
      g.position.set(x, AX, 0);
      root.add(g);
    }
    for (const x of [-1.55, -0.45, 0.15, 2.4]) root.add(box(0.2, 0.28, 0.5, metal('#39414d', 0.5), [x, AX - 0.5, 0]));
    /* generator: painted stator housing with cooling-fin rings, end bells, exciter */
    const genBody = cyl(0.62, 0.62, 1.75, paint('#2b5c8f', 0.4, 0.5), 64);
    genBody.rotation.z = Math.PI / 2;
    genBody.position.set(3.85, AX, 0);
    root.add(genBody);
    for (let i = 0; i < 9; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 64), metal('#c8d0da', 0.3));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(3.1 + i * 0.185, AX, 0);
      root.add(ring);
    }
    for (const x of [2.98, 4.72]) {
      const bell = cyl(0.55, 0.64, 0.12, metal('#cfd6df', 0.28), 48);
      bell.rotation.z = Math.PI / 2;
      bell.position.set(x, AX, 0);
      root.add(bell);
    }
    const exc = cyl(0.26, 0.26, 0.5, paint('#3a4452', 0.5, 0.5), 32);
    exc.rotation.z = Math.PI / 2;
    exc.position.set(5.05, AX, 0);
    root.add(exc);
    root.add(box(0.3, 0.12, 0.3, paint('#d3a21b', 0.5, 0.2), [3.85, AX + 0.69, 0]));
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.05, 24), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    stripe.rotation.z = Math.PI / 2;
    stripe.position.set(2.35, AX, 0.0);
    root.add(stripe);

    /* ---------- condenser: cut shell with tube bundle, water boxes, hotwell ---------- */
    const COND = { x0: 0.25, x1: 2.15, y: 0.78, r: 0.62 };
    const shell = new THREE.Mesh(revolveSolid([[COND.x0, COND.r], [COND.x1, COND.r]], 0.04, 64), cutMat({ color: '#8e98a6', metalness: 0.9, roughness: 0.4 }, '#4a525e', planes));
    shell.position.y = COND.y;
    root.add(shell);
    const nT = 118;
    const tubes = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.017, 0.017, COND.x1 - COND.x0 - 0.12, 8),
      new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.85, roughness: 0.28, clippingPlanes: planes }),
      nT,
    );
    let ti = 0;
    for (let iy = -6; iy <= 6; iy++)
      for (let iz = -6; iz <= 6; iz++) {
        const yy = iy * 0.072;
        const zz = iz * 0.072;
        if (ti >= nT || yy * yy + zz * zz > 0.45 * 0.45 || yy < -0.3) continue;
        M4.makeTranslation((COND.x0 + COND.x1) / 2, COND.y + yy, zz).multiply(rot);
        tubes.setMatrixAt(ti, M4);
        tubes.setColorAt(ti, new THREE.Color().copy(heat(0.12 + 0.2 * ((yy + 0.35) / 0.8))).lerp(new THREE.Color('#bcd0e0'), 0.35));
        ti++;
      }
    tubes.count = ti;
    root.add(tubes);
    for (const x of [COND.x0, COND.x1]) {
      const sheet = cyl(COND.r, COND.r, 0.05, metal('#c9d0d9', 0.3), 64);
      sheet.rotation.z = Math.PI / 2;
      sheet.position.set(x, COND.y, 0);
      root.add(sheet);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(COND.r, 40, 20), cutMat({ color: '#3b6f9c', metalness: 0.5, roughness: 0.4 }, '#27415a', planes));
      dome.scale.x = 0.3;
      dome.position.set(x + (x === COND.x0 ? -0.05 : 0.05), COND.y, 0);
      root.add(dome);
    }
    root.add(box(1.9, 0.12, 0.5, metal('#6b7684', 0.4), [1.2, 0.07, 0]));
    /* LP exhaust neck */
    const neckMat = new THREE.MeshStandardMaterial({ color: '#cfe2ff', transparent: true, opacity: 0.4, roughness: 0.2, metalness: 0.2, side: THREE.DoubleSide });
    const neck = cyl(0.48, 0.42, 0.52, neckMat, 40);
    neck.position.set(1.2, 1.41, 0);
    root.add(neck);
    /* condensing droplets */
    const drips = makeCloud(
      90,
      0.05,
      (u, a, b, out) => out.set(COND.x0 + 0.1 + b * (COND.x1 - COND.x0 - 0.2), COND.y + 0.36 - u * 0.55, (a - 0.5) * 0.7),
      '#a8d4ff',
      { planes },
    );
    root.add(drips.object);

    /* ---------- pumps ---------- */
    const pumpAt = (x: number, y: number, z: number, r = 0.2) => {
      const g = new THREE.Group();
      const motor = cyl(r * 0.85, r * 0.85, 0.5, paint('#235a7a', 0.4, 0.5), 32);
      motor.rotation.z = Math.PI / 2;
      motor.position.set(0.36, 0, 0);
      const fan = cyl(r * 0.9, r * 0.9, 0.06, metal('#c8d0da', 0.3), 24);
      fan.rotation.z = Math.PI / 2;
      fan.position.set(0.64, 0, 0);
      const volute = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 32, 20), metal('#7e8a98', 0.35));
      volute.scale.set(0.6, 1, 1);
      volute.castShadow = true;
      const skid = box(1.0, 0.07, 0.4, dark, [0.3, -r - 0.05, 0]);
      g.add(motor, fan, volute, skid);
      g.position.set(x, y, z);
      g.scale.x = -1;
      root.add(g);
    };
    pumpAt(-0.15, 0.32, 0, 0.18);
    pumpAt(-2.9, 0.34, 0, 0.2);

    /* ---------- feedwater heater (OFWH tank / CFWH shell), cut ---------- */
    const FW = { x0: -2.2, x1: -0.6, y: 1.0, r: 0.36 };
    const fwhGroup = new THREE.Group();
    const fwhCut = cutMat({ color: '#2e6a9d', metalness: 0.7, roughness: 0.35 }, '#22364a', planes);
    const fwhShell = new THREE.Mesh(revolveSolid([[FW.x0, FW.r], [FW.x1, FW.r]], 0.035, 56), fwhCut);
    fwhShell.position.y = FW.y;
    fwhGroup.add(fwhShell);
    for (const x of [FW.x0, FW.x1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(FW.r, 32, 16), fwhCut);
      cap.scale.x = 0.25;
      cap.position.set(x + (x === FW.x0 ? 0.02 : -0.02), FW.y, 0);
      fwhGroup.add(cap);
    }
    const ofwhBits = new THREE.Group();
    for (let i = 0; i < 3; i++) ofwhBits.add(box(1.2, 0.015, 0.4, metal('#d6dbe2', 0.3), [-1.4, FW.y + 0.1 - i * 0.07, 0]));
    const vent = cyl(0.045, 0.045, 0.4, steel, 14);
    vent.position.set(-1.0, FW.y + FW.r + 0.2, 0);
    const level = cyl(0.03, 0.03, 0.4, glass('#9fd0ff', 0.5), 12);
    level.rotation.z = Math.PI / 2;
    level.position.set(-1.4, FW.y, FW.r + 0.04);
    ofwhBits.add(vent, level);
    const cfwhBits = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const tubeU = cyl(0.012, 0.012, 1.3, metal('#c58b4a', 0.3), 8);
      tubeU.rotation.z = Math.PI / 2;
      tubeU.position.set(-1.4, FW.y - 0.16 + i * 0.04, 0.0);
      cfwhBits.add(tubeU);
    }
    const head = cyl(0.3, 0.3, 0.16, paint('#8aa0b8', 0.4, 0.6), 32);
    head.rotation.z = Math.PI / 2;
    head.position.set(FW.x1 + 0.06, FW.y, 0);
    cfwhBits.add(head);
    fwhGroup.add(ofwhBits, cfwhBits);
    root.add(fwhGroup);
    for (const x of [-2.0, -0.8]) root.add(box(0.14, 0.62, 0.5, dark, [x, 0.31, 0]));

    /* ---------- boiler: steel frame, cladding, glass window onto a glowing furnace, drum, stack ---------- */
    const BX = -5.5;
    const boiler = new THREE.Group();
    root.add(boiler);
    const clad = paint('#3c4552', 0.55, 0.55);
    for (const x of [-1.3, 1.3]) for (const z of [-1.1, 1.1]) boiler.add(box(0.2, 4.7, 0.2, metal('#7f8998', 0.4), [x, 2.35, z]));
    for (const y of [0.15, 1.4, 2.7, 4.0, 4.65]) {
      for (const z of [-1.1, 1.1]) boiler.add(box(2.7, 0.12, 0.16, metal('#6c7685', 0.4), [0, y, z]));
      for (const x of [-1.3, 1.3]) boiler.add(box(0.16, 0.12, 2.3, metal('#6c7685', 0.4), [x, y, 0]));
    }
    boiler.add(box(2.5, 4.4, 0.08, clad, [0, 2.35, -1.05]));
    boiler.add(box(0.08, 4.4, 2.1, clad, [-1.25, 2.35, 0]));
    boiler.add(box(0.08, 4.4, 2.1, clad, [1.25, 2.35, 0]));
    boiler.add(box(2.6, 0.1, 2.3, clad, [0, 4.62, 0]));
    boiler.add(box(2.7, 0.3, 2.4, metal('#2a313b', 0.6), [0, 0.0, 0]));
    for (let i = 0; i < 6; i++) boiler.add(box(2.5, 0.05, 0.05, metal('#5c6676', 0.4), [0, 0.6 + i * 0.75, -1.0]));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.0), new THREE.MeshPhysicalMaterial({ color: '#b6d4ff', roughness: 0.04, transparent: true, opacity: 0.1, side: THREE.DoubleSide }));
    win.position.set(0, 2.3, 1.1);
    boiler.add(win);
    const fireMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const glowWall = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.2), fireMat);
    glowWall.position.set(0, 1.9, -0.98);
    boiler.add(glowWall);
    const wallTubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 3.5, 10), new THREE.MeshStandardMaterial({ color: '#9a3d1c', metalness: 0.6, roughness: 0.45, emissive: '#7a2008', emissiveIntensity: 0.6 }), 26);
    for (let i = 0; i < 26; i++) wallTubes.setMatrixAt(i, M4.makeTranslation(-1.1 + i * 0.088, 2.3, -0.94));
    boiler.add(wallTubes);
    const flameSprites: THREE.Sprite[] = [];
    const gtex = dotTex(0.2);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, color: '#ff8c2a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.set(-0.8 + i * 0.53, 0.95, 0.2);
      s.scale.set(0.8, 1.3, 1);
      boiler.add(s);
      flameSprites.push(s);
      const burner = cyl(0.1, 0.14, 0.2, metal('#c0773a', 0.4), 20);
      burner.rotation.x = Math.PI / 2;
      burner.position.set(-0.8 + i * 0.53, 0.55, 0.5);
      boiler.add(burner);
    }
    const furnaceLight = new THREE.PointLight('#ff7a22', 4, 5, 1.5);
    furnaceLight.position.set(0, 1.6, 0.4);
    boiler.add(furnaceLight);
    const platen = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 1.0, 1.5), new THREE.MeshStandardMaterial({ color: '#d36a2a', emissive: '#a43a10', emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.4 }), 12);
    for (let i = 0; i < 12; i++) platen.setMatrixAt(i, M4.makeTranslation(-1.0 + i * 0.18, 3.55, -0.1));
    boiler.add(platen);
    const rhMat = new THREE.MeshStandardMaterial({ color: '#d84a22', emissive: '#c0300c', emissiveIntensity: 1.0, metalness: 0.5, roughness: 0.4 });
    const reheater = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 8), rhMat, 18);
    for (let i = 0; i < 18; i++) {
      M4.makeTranslation(0, 2.75 + (i % 6) * 0.1, -0.55 + Math.floor(i / 6) * 0.45).multiply(rot);
      reheater.setMatrixAt(i, M4);
    }
    boiler.add(reheater);
    const drum = cyl(0.3, 0.3, 2.2, metal('#c8d0da', 0.22), 40);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, 5.0, -0.2);
    boiler.add(drum);
    for (const x of [-0.7, 0.7]) {
      const dc = cyl(0.06, 0.06, 0.8, steel, 14);
      dc.position.set(x, 4.75, -0.2);
      boiler.add(dc);
    }
    boiler.position.set(BX, 0, 0);
    const stack = cyl(0.24, 0.34, 6.4, paint('#8d949d', 0.6, 0.3), 32);
    stack.position.set(BX - 2.1, 3.2, -0.2);
    root.add(stack);
    for (const y of [5.5, 5.9]) {
      const band = cyl(0.245, 0.245, 0.22, paint('#c0392b', 0.5, 0.2), 32);
      band.position.set(BX - 2.1, y, -0.2);
      root.add(band);
    }
    const smoke = makeCloud(
      90,
      0.55,
      (u, a, b, out) => out.set(BX - 2.1 + u * 1.8 + (a - 0.5) * 0.3 * u, 6.4 + u * 2.2, -0.2 + (b - 0.5) * 0.4 * u),
      (u, c) => c.setScalar(0.28 * (1 - u)),
      { tex: dotTex(0.1) },
    );
    root.add(smoke.object);

    /* ---------- piping, coloured by temperature, with particles whose speed follows mass flow ---------- */
    type PipeRec = { object: THREE.Group; path: THREE.CurvePath<THREE.Vector3>; setColor: (c: THREE.Color) => void; cloud: Cloud; len: number };
    const pipes: Record<string, PipeRec> = {};
    const mk = (name: string, pts: [number, number, number][], r = 0.055) => {
      const p = makePipe(pts, r);
      const len = p.path.getLength();
      const cloud = pipeCloud(p.path, Math.min(48, Math.max(12, Math.round(len * 9))), 0.075, r * 0.6);
      root.add(p.object, cloud.object);
      pipes[name] = { ...p, cloud, len };
    };
    mk('main', [[BX + 1.3, 5.0, 0.15], [-1.5, 5.0, 0.15], [-1.5, AX + 0.45, 0.15]], 0.07);
    mk('cross', [[-0.5, AX + 0.4, -0.25], [-0.5, 3.55, -0.25], [1.2, 3.55, -0.25], [1.2, AX + 0.8, -0.25]], 0.075);
    mk('cold', [[-0.5, AX + 0.4, -0.25], [-0.5, 4.3, -0.25], [BX + 1.3, 4.3, -0.25]], 0.07);
    mk('hot', [[BX + 1.3, 3.7, -0.5], [1.2, 3.7, -0.5], [1.2, AX + 0.8, -0.5]], 0.075);
    mk('cond', [[COND.x0, 0.3, 0], [-0.15, 0.3, 0]], 0.05);
    mk('c2', [[-0.15, 0.6, 0], [-0.15, 1.0, 0], [FW.x1, 1.0, 0]], 0.05);
    mk('c2n', [[-0.15, 0.55, 0], [-2.65, 0.55, 0]], 0.05);
    mk('c3', [[FW.x0, 1.0, 0], [-2.45, 1.0, 0], [-2.45, 0.55, 0], [-2.65, 0.55, 0]], 0.05);
    mk('feed', [[-3.15, 0.58, 0], [-3.5, 0.58, 0], [BX + 1.3, 0.58, 0]], 0.055);
    mk('bleed', [[0.55, 2.02, 0.4], [0.55, 1.75, 0.4], [-1.4, 1.75, 0.4], [-1.4, FW.y + FW.r, 0]], 0.045);
    mk('drain', [[-1.4, FW.y - FW.r, 0.15], [-1.4, 0.18, 0.45], [0.2, 0.18, 0.45], [0.2, 0.3, 0.1]], 0.04);
    const cwIn = makePipe([[COND.x0 - 0.05, 0.45, 0], [-0.6, 0.45, 0.15], [-0.6, 0.45, 2.4]], 0.07);
    const cwOut = makePipe([[COND.x1 + 0.05, 1.1, 0], [2.7, 1.1, 0.15], [2.7, 1.1, 2.4]], 0.07);
    cwIn.setColor(new THREE.Color('#2f7fd0'));
    cwOut.setColor(new THREE.Color('#4fc3e8'));
    const cwA = pipeCloud(cwIn.path, 18, 0.07, 0.04);
    const cwB = pipeCloud(cwOut.path, 18, 0.07, 0.04);
    (cwA.object.material as THREE.PointsMaterial).color.set('#7bb8ff');
    (cwB.object.material as THREE.PointsMaterial).color.set('#8ee6ee');
    root.add(cwIn.object, cwOut.object, cwA.object, cwB.object);
    const lab = (txt: string, x: number, y: number, z = 0) => {
      const L = liveLabel(0.34);
      L.sprite.position.set(x, y, z);
      L.set(txt);
      root.add(L.sprite);
      return L;
    };
    lab('boiler', BX, 5.9);
    lab('HP turbine', -0.9, 3.15, 0.5);
    lab('LP turbine', 1.2, 3.25, 0.5);
    lab('generator', 3.85, 3.35);
    lab('condenser', 1.2, -0.15, 0.8);
    lab('cooling water in', -0.6, 0.0, 2.4);
    const fwhLabel = lab('feedwater heater', -1.4, 1.95, 0.1);
    const lblStat = liveLabel(0.34);
    lblStat.sprite.position.set(-1.0, 5.6, 0);
    root.add(lblStat.sprite);

    let tAcc = 0;
    return {
      update: (dt: number) => {
        const { cfg: c, good: g } = P.current;
        if (!g) return;
        tAcc += dt;
        const S = g.res.states;
        const y = g.res.y;
        const heater = c.heater;
        const mdot = g.res.mdot;
        const base = 0.7 + 2.2 * Math.min(1, mdot / 700);
        const T = (st?: { T: number }) => (st ? st.T : 25);
        pipes.cross.object.visible = pipes.cross.cloud.object.visible = !c.reheat;
        for (const n of ['cold', 'hot']) pipes[n].object.visible = pipes[n].cloud.object.visible = c.reheat;
        rhMat.emissiveIntensity = c.reheat ? 1.1 : 0.05;
        rhMat.color.set(c.reheat ? '#d84a22' : '#4c4a48');
        const hasH = heater !== 'none';
        fwhGroup.visible = hasH;
        fwhLabel.sprite.visible = hasH;
        fwhLabel.set(heater === 'ofwh' ? 'open feedwater heater' : 'closed feedwater heater');
        ofwhBits.visible = heater === 'ofwh';
        cfwhBits.visible = heater === 'cfwh';
        for (const n of ['c2', 'c3', 'bleed']) pipes[n].object.visible = pipes[n].cloud.object.visible = hasH;
        pipes.c2n.object.visible = pipes.c2n.cloud.object.visible = !hasH;
        pipes.drain.object.visible = pipes.drain.cloud.object.visible = heater === 'cfwh';
        const setP = (n: string, Tc: number, frac: number) => {
          const col = heat(tN(Tc), tmpC);
          pipes[n].setColor(col);
          (pipes[n].cloud.object.material as THREE.PointsMaterial).color.copy(col).lerp(new THREE.Color('#ffffff'), 0.45);
          pipes[n].cloud.update(dt, (base * frac) / pipes[n].len);
        };
        const Tsat = T(S.condExit);
        setP('main', c.Tb, 1);
        setP('cross', T(S.turbineExit), 1);
        setP('cold', T(S.reheatIn), 1);
        setP('hot', T(S.reheatOut), 1);
        setP('cond', Tsat, 1);
        setP('c2', T(S.pump1Exit), heater === 'ofwh' ? 1 - y : 1);
        setP('c2n', T(S.pump1Exit), 1);
        setP('c3', T(S.fwhExit), 1);
        setP('feed', T(S.pump2Exit ?? S.fwhExit ?? S.pump1Exit), 1);
        setP('bleed', T(S.bleed), y);
        setP('drain', T(S.drain), y);
        const Thp0 = c.Tb;
        const ThpEx = c.reheat ? T(S.reheatIn) : T(S.turbineExit) + 80;
        const Tlp0 = c.reheat ? c.Tb : ThpEx;
        const TlpEx = T(S.turbineExit);
        rows.forEach(({ m, mat, kind, k }) => {
          m.rotation.x += dt * 2.2;
          const Tloc = kind === 'hp' ? Thp0 + (ThpEx - Thp0) * (k / 6) : Tlp0 + (TlpEx - Tlp0) * (k / 5);
          const col = heat(tN(Tloc), tmpC);
          mat.color.copy(col).lerp(new THREE.Color('#9097a0'), 0.55);
          mat.emissive.copy(col).multiplyScalar(0.12 * tN(Tloc));
        });
        stripe.rotation.x += dt * 2.2;
        const qs = Math.min(1.3, (mdot * g.res.qin) / 700000);
        const fl = 0.85 + 0.15 * Math.sin(tAcc * 17) * Math.sin(tAcc * 5.1);
        fireMat.opacity = (0.25 + 0.35 * qs) * fl;
        furnaceLight.intensity = (2 + 4 * qs) * fl;
        flameSprites.forEach((s, i) => {
          const k = 0.85 + 0.15 * Math.sin(tAcc * (13 + i * 3) + i);
          s.scale.set(0.7 * (0.7 + 0.5 * qs) * k, 1.2 * (0.7 + 0.6 * qs) * k, 1);
        });
        smoke.update(dt, 0.12 + 0.1 * qs);
        drips.update(dt, 0.5 + 0.8 * Math.min(1, (mdot * (1 - (heater === 'ofwh' ? y : 0))) / 700));
        cwA.update(dt, 0.05 + 0.1 * Math.min(1, mdot / 700));
        cwB.update(dt, 0.05 + 0.1 * Math.min(1, mdot / 700));
        neckMat.color.copy(heat(tN(Tsat) * 0.6, tmpC)).lerp(new THREE.Color('#e6f0ff'), 0.6);
        lblStat.set(`η ${(g.res.eta * 100).toFixed(1)} %   exit ${Number.isFinite(g.res.x_exit) ? 'x = ' + g.res.x_exit.toFixed(3) : 'superheated'}`);
      },
    };
  };

  const ts = good ? plantTs(cfg, good.res, good.Prh, good.Pbleed) : null;
  const R = good?.res;
  return (
    <SimFrame title="Steam power-plant lab" subtitle={<span>boiler → HP/LP turbine → condenser → pumps, with optional reheat and feedwater heating</span>}>
      <LabGrid
        left={
          <>
            <Studio3D
              setup={setup}
              height={430}
              camera={[-1.4, 4.8, 19]}
              target={[-1.3, 2.4, 0]}
              fov={38}
              caption="Pipes are coloured by steam/water temperature (blue 20 °C … red 650 °C); moving particles speed up with mass flow, and the bleed line appears when a heater is on. The turbines, condenser and heater are half-sections."
            />
            {ts && <TsDiagramView fluid="water" points={ts.pts} path={ts.path} height={330} isobars={[Pb, Pc]} />}
          </>
        }
        right={
          <>
            <Slider label="boiler pressure" value={Pb} min={3000} max={25000} step={500} onChange={setPb} format={(v) => (v / 1000).toFixed(1)} unit=" MPa" />
            <Slider label="turbine inlet T" value={Tb} min={400} max={650} step={5} onChange={setTb} unit=" °C" />
            <Slider label="condenser pressure" value={Pc} min={5} max={50} step={1} onChange={setPc} unit=" kPa" />
            <Slider label="turbine η_T" value={etaT} min={0.7} max={1} step={0.01} onChange={setEtaT} format={(v) => v.toFixed(2)} />
            <Slider label="net output" value={MW} min={50} max={600} step={10} onChange={setMW} unit=" MW" />
            <Check label="reheat (back to the inlet T at 20 % of boiler pressure)" checked={reheat} onChange={setReheat} />
            <Check label="open feedwater heater (OFWH)" checked={heater === 'ofwh'} onChange={(v) => setHeater(v ? 'ofwh' : 'none')} />
            <Check label="closed feedwater heater (CFWH, drain cascaded back)" checked={heater === 'cfwh'} onChange={(v) => setHeater(v ? 'cfwh' : 'none')} />
            {!calc.ok && (
              <div role="alert" style={{ border: '1px solid var(--c3,#d33)', borderRadius: 8, padding: '8px 12px', margin: '8px 0', fontSize: '.9rem' }}>
                <b style={{ color: 'var(--c3,#d33)' }}>These inputs fall outside the property tables ({calc.msg}); showing the last valid cycle.</b>
              </div>
            )}
            {R && good && (
              <Readout
                items={[
                  ['thermal efficiency η', `${f(R.eta * 100, 4)} %`],
                  ['net work w_net', `${f(R.wnet, 4)} kJ/kg`],
                  ['bled fraction y', heater === 'none' ? '—' : f(R.y, 4)],
                  ['exit quality x', Number.isFinite(R.x_exit) ? f(R.x_exit, 4) : 'superheated'],
                  ['heat in q_in', `${f(R.qin, 4)} kJ/kg`],
                  ['mass flow', `${f(R.mdot, 4)} kg/s`],
                  ['back-work ratio', `${f(R.bwr * 100, 3)} %`],
                  ['bleed pressure', heater === 'none' ? '—' : `${f(good.Pbleed, 3)} kPa`],
                ]}
              />
            )}
            <LabFoot>Bleed pressure is the geometric mean of the two pressures it sits between; pump η = 0.90. Watch the exit quality: below about 0.88 the last blades erode, which is why high boiler pressure needs reheat.</LabFoot>
          </>
        }
      />
    </SimFrame>
  );
}

/* ====================================================================== HeatPumpLab */
const T_IN = 21; // indoor set point, °C
const T_COND = 45; // condenser (saturation) temperature, °C
const T_APP = 8; // evaporator sits this far below the outdoor air
function hpAt(Tout: number) {
  const c = vcr({ TL: Tout - T_APP, TH: T_COND, etaC: 0.8 });
  const TLk = Tout - T_APP + 273.15;
  const THk = T_COND + 273.15;
  return { c, cop: c.COPHP, carnot: THk / (THk - TLk) };
}

export function HeatPumpLab() {
  const [Tout, setTout] = useState(-10);
  const [UA, setUA] = useState(250); // W/K
  const hp = hpAt(Tout);
  const Q = (UA / 1000) * (T_IN - Tout); // kW of heat the house needs
  const W = Q / hp.cop;
  const mdot = Q / hp.c.qH;
  const frost = Math.min(1, Math.max(0, (2 - Tout) / 8));
  const P = useLatest({ Tout, Q, mdot, frost, hp });

  const curve = useMemo(() => {
    const a: { x: number; y: number }[] = [];
    const b: { x: number; y: number }[] = [];
    for (let T = -25; T <= 15; T += 1) {
      const h = hpAt(T);
      a.push({ x: T, y: h.cop });
      b.push({ x: T, y: h.carnot });
    }
    return { a, b, res: [{ x: -25, y: 1 }, { x: 15, y: 1 }] };
  }, []);
  const st = hp.c.states;
  const ts: TsPoint[] = [
    { s: st['1'].s, T: st['1'].T, P: st['1'].P, label: '1' },
    { s: st['2'].s, T: st['2'].T, P: st['2'].P, label: '2' },
    { s: st['3'].s, T: st['3'].T, P: st['3'].P, label: '3' },
    { s: st['4'].s, T: st['4'].T, P: st['4'].P, label: '4' },
  ];

  const setup = (ctx: StudioCtx) => {
    const { scene, controls, renderer } = ctx;
    controls.maxDistance = 24;
    renderer.localClippingEnabled = true;
    scene.fog = new THREE.Fog('#070a12', 24, 60);
    const root = new THREE.Group();
    scene.add(root);
    const M4 = new THREE.Matrix4();
    const steel = metal('#b4bdc9', 0.3);
    const tmp = new THREE.Color();
    const cold = (T: number) => heat((T + 35) / 115, tmp);

    /* ---------- the house (cut section) ---------- */
    const house = new THREE.Group();
    root.add(house);
    const plaster = new THREE.MeshStandardMaterial({ color: '#e4d8c2', roughness: 0.9, metalness: 0 });
    house.add(box(5.6, 0.25, 3.5, new THREE.MeshStandardMaterial({ color: '#5d6168', roughness: 0.95 }), [-2.5, 0.12, 0]));
    house.add(box(5.0, 0.07, 3.0, new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.6 }), [-2.5, 0.28, 0]));
    house.add(box(5.0, 2.65, 0.14, plaster, [-2.5, 1.62, -1.5]));
    house.add(box(0.14, 2.65, 3.0, plaster, [-5.0, 1.62, 0]));
    house.add(box(0.14, 2.65, 3.0, plaster, [0.0, 1.62, 0]));
    for (const sgn of [-1, 1]) {
      const slab = box(2.85, 0.14, 3.4, new THREE.MeshStandardMaterial({ color: '#3d3a44', roughness: 0.8, metalness: 0.1 }), [-2.5 + sgn * 1.28, 3.5, 0]);
      slab.rotation.z = -sgn * 0.37;
      house.add(slab);
      const ins = box(2.8, 0.1, 3.3, new THREE.MeshStandardMaterial({ color: '#e8c15a', roughness: 1 }), [-2.5 + sgn * 1.28, 3.38, 0]);
      ins.rotation.z = -sgn * 0.37;
      house.add(ins);
    }
    // gable back
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-5, 2.95), new THREE.Vector2(0, 2.95), new THREE.Vector2(-2.5, 4.1)])), plaster);
    gable.position.z = -1.5;
    house.add(gable);
    // window with a pane that reflects the studio
    house.add(box(1.2, 1.0, 0.06, metal('#e9edf2', 0.3), [-3.6, 1.85, -1.4]));
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.85), new THREE.MeshPhysicalMaterial({ color: '#9fc2ee', roughness: 0.05, metalness: 0.2, transmission: 0.4, transparent: true, opacity: 0.6 }));
    pane.position.set(-3.6, 1.85, -1.36);
    house.add(pane);
    // furniture: sofa + lamp
    house.add(box(1.5, 0.35, 0.6, paint('#4b5f7a', 0.9, 0), [-3.6, 0.5, -1.1]));
    house.add(box(1.5, 0.45, 0.14, paint('#4b5f7a', 0.9, 0), [-3.6, 0.78, -1.35]));
    const lampPost = cyl(0.02, 0.02, 1.1, metal('#222', 0.5), 12);
    lampPost.position.set(-4.5, 0.85, -0.9);
    house.add(lampPost);
    const shade = cyl(0.14, 0.22, 0.26, new THREE.MeshStandardMaterial({ color: '#ffe6bd', emissive: '#ffcf7a', emissiveIntensity: 1.2, roughness: 0.8 }), 24);
    shade.position.set(-4.5, 1.5, -0.9);
    house.add(shade);
    const lamp = new THREE.PointLight('#ffd9a8', 6, 6, 1.6);
    lamp.position.set(-3.2, 2.0, -0.6);
    house.add(lamp);
    // warm room glow (volume), tinted by the room temperature
    const roomGlow = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.6, 2.9), new THREE.MeshBasicMaterial({ color: '#ff9a4a', transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending }));
    roomGlow.position.set(-2.5, 1.6, 0);
    house.add(roomGlow);
    // heat-loss arrows through the walls and roof
    const arrows = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.3, 12), new THREE.MeshStandardMaterial({ color: '#ff9b3a', emissive: '#ff6a10', emissiveIntensity: 1.1 }), 10);
    root.add(arrows);
    const arrowSpots: [number, number, number, number][] = [
      [-5.3, 1.0, -0.8, Math.PI / 2], [-5.3, 1.8, 0.4, Math.PI / 2], [-5.3, 2.4, -0.2, Math.PI / 2],
      [-3.7, 4.3, 0.0, 0], [-1.3, 4.3, 0.2, 0], [-2.5, 4.6, -0.6, 0], [-4.0, 1.9, -1.8, 0], [-1.4, 0.0, 0, 0], [-3.8, 0.1, 0.5, 0], [-0.7, 1.3, 1.9, 0],
    ];

    /* ---------- indoor unit: cabinet with glass front, hot coil, blower ---------- */
    const IC = new THREE.Vector3(-0.85, 0, -0.55);
    const cab = new THREE.Group();
    cab.position.copy(IC);
    house.add(cab);
    const cabMat = paint('#eef1f5', 0.35, 0.3);
    cab.add(box(0.1, 1.7, 0.7, cabMat, [-0.5, 1.2, 0]));
    cab.add(box(0.1, 1.7, 0.7, cabMat, [0.5, 1.2, 0]));
    cab.add(box(1.1, 0.1, 0.7, cabMat, [0, 0.4, 0]));
    cab.add(box(1.1, 0.1, 0.7, cabMat, [0, 2.05, 0]));
    cab.add(box(1.1, 1.7, 0.06, paint('#cfd5de', 0.5, 0.3), [0, 1.2, -0.33]));
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.55), new THREE.MeshPhysicalMaterial({ color: '#cfe6ff', roughness: 0.04, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    front.position.set(0, 1.2, 0.36);
    cab.add(front);
    // A-coil: two inclined fin packs, hot
    const finMat = new THREE.MeshStandardMaterial({ color: '#d7dde5', metalness: 1, roughness: 0.3, emissive: '#000' });
    const coilGroup = new THREE.Group();
    const packs: THREE.InstancedMesh[] = [];
    for (const sgn of [-1, 1]) {
      const pack = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.78, 0.008), finMat, 44);
      for (let i = 0; i < 44; i++) {
        const z = -0.28 + (i / 43) * 0.56;
        M4.makeRotationZ(sgn * 0.42);
        M4.setPosition(sgn * 0.2, 1.45, z);
        pack.setMatrixAt(i, M4);
      }
      coilGroup.add(pack);
      packs.push(pack);
    }
    const hairpins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 10), new THREE.MeshStandardMaterial({ color: '#c9783a', metalness: 0.9, roughness: 0.28, emissive: '#c43a10', emissiveIntensity: 0.5 }), 16);
    for (let i = 0; i < 16; i++) {
      const sgn = i % 2 ? 1 : -1;
      M4.makeRotationX(Math.PI / 2);
      M4.setPosition(sgn * (0.12 + 0.07 * Math.floor(i / 2)), 1.25 + 0.12 * Math.floor(i / 4), 0);
      hairpins.setMatrixAt(i, M4);
    }
    coilGroup.add(hairpins);
    cab.add(coilGroup);
    // blower wheel (squirrel cage) at the bottom
    const blower = new THREE.Group();
    const cage = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.1, 0.4), metal('#9aa4b2', 0.35), 24);
    for (let i = 0; i < 24; i++) {
      M4.makeRotationZ((i / 24) * Math.PI * 2);
      M4.multiply(new THREE.Matrix4().makeTranslation(0.17, 0, 0));
      M4.multiply(new THREE.Matrix4().makeRotationZ(0.6));
      cage.setMatrixAt(i, M4);
    }
    blower.add(cage);
    for (const z of [-0.2, 0.2]) {
      const plate = cyl(0.19, 0.19, 0.012, metal('#c9d0d9', 0.3), 32);
      plate.rotation.x = Math.PI / 2;
      plate.position.z = z;
      blower.add(plate);
    }
    blower.position.set(0, 0.8, 0);
    cab.add(blower);
    const drip = box(0.9, 0.04, 0.5, metal('#5c6676', 0.4), [0, 0.5, 0]);
    cab.add(drip);
    // warm supply air out of the top, return air in at the bottom
    const warmAir = makeCloud(
      150,
      0.09,
      (u, a, b, out) => {
        const x = IC.x + (a - 0.5) * 0.5 - u * u * 1.7 * (0.3 + b);
        const y = IC.y + 2.15 + u * (0.5 + 0.3 * b);
        out.set(x, y, IC.z + (b - 0.5) * 0.6 + u * 0.6 * (a - 0.5));
      },
      (u, c) => c.copy(heat(0.62 + 0.18 * (1 - u))).multiplyScalar(0.9 * (1 - u * 0.5)),
    );
    const retAir = makeCloud(
      90,
      0.08,
      (u, a, b, out) => out.set(IC.x + 0.6 + 1.2 * (1 - u) * (0.4 + a * 0.6) + 0.1, 0.5 + 0.2 * b + 0.15 * (1 - u), IC.z + 0.55 + (b - 0.5) * 0.4 - u * 0.5),
      (u, c) => c.copy(heat(0.5 - 0.1 * u)).multiplyScalar(0.5),
    );
    root.add(warmAir.object, retAir.object);

    /* ---------- outdoor unit ---------- */
    const OX = 3.3;
    const out = new THREE.Group();
    root.add(out);
    out.add(box(1.9, 0.12, 1.4, new THREE.MeshStandardMaterial({ color: '#6a6e75', roughness: 0.95 }), [OX, 0.06, 0]));
    const skin = paint('#dfe4ea', 0.4, 0.5);
    for (const [x, z] of [[2.5, -0.5], [4.1, -0.5], [2.5, 0.5], [4.1, 0.5]]) out.add(box(0.07, 1.4, 0.07, metal('#9aa4b2', 0.3), [x, 0.82, z]));
    out.add(box(1.6, 0.06, 1.0, skin, [OX, 0.18, 0]));
    out.add(box(1.6, 0.05, 1.0, skin, [OX, 1.5, 0]));
    out.add(box(1.6, 1.3, 0.04, skin, [OX, 0.85, -0.5]));
    out.add(box(0.04, 1.3, 1.0, skin, [4.1, 0.85, 0]));
    // slatted louvre on the right-hand side of the front (protective grille over the coil is wire)
    const louv = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.012, 0.12), metal('#c4ccd6', 0.3), 28);
    for (let i = 0; i < 28; i++) louv.setMatrixAt(i, M4.makeTranslation(4.13, 0.3 + i * 0.04, 0.38 - (i % 2) * 0.0));
    out.add(louv);
    // compressor section (open to the camera, cut-away): compressor, accumulator, valves
    const comp = cyl(0.16, 0.16, 0.52, new THREE.MeshStandardMaterial({ color: '#1f2a33', metalness: 0.7, roughness: 0.35 }), 36);
    comp.position.set(2.78, 0.5, -0.05);
    out.add(comp);
    const compTop = cyl(0.1, 0.1, 0.1, paint('#c0392b', 0.5, 0.2), 20);
    compTop.position.set(2.78, 0.82, -0.05);
    out.add(compTop);
    const accu = cyl(0.09, 0.09, 0.5, metal('#aab3bf', 0.3), 24);
    accu.position.set(2.6, 0.5, 0.2);
    out.add(accu);
    const valve = box(0.12, 0.1, 0.16, metal('#d1a24a', 0.3), [3.0, 0.4, 0.25]);
    out.add(valve);
    out.add(box(0.03, 1.3, 0.5, metal('#9aa4b2', 0.4), [3.0, 0.85, 0.1]));
    // coil: tight vertical fin pack facing the camera
    const NF = 70;
    const coilFins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 1.12, 0.4), new THREE.MeshStandardMaterial({ color: '#cfd6df', metalness: 1, roughness: 0.32 }), NF);
    for (let i = 0; i < NF; i++) coilFins.setMatrixAt(i, M4.makeTranslation(3.07 + (i / (NF - 1)) * 0.95, 0.85, 0.28));
    out.add(coilFins);
    const frostMat = new THREE.MeshStandardMaterial({ color: '#f4fbff', roughness: 0.95, metalness: 0, transparent: true, opacity: 0 });
    const frostFins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 1.14, 0.42), frostMat, NF);
    for (let i = 0; i < NF; i++) frostFins.setMatrixAt(i, M4.makeTranslation(3.07 + (i / (NF - 1)) * 0.95, 0.85, 0.28));
    out.add(frostFins);
    const tubeEnds = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.017, 0.017, 0.44, 8), new THREE.MeshStandardMaterial({ color: '#c9783a', metalness: 0.95, roughness: 0.25, emissive: '#000' }), 28);
    for (let i = 0; i < 28; i++) {
      M4.makeRotationX(Math.PI / 2);
      M4.setPosition(3.15 + (i % 7) * 0.13 + (Math.floor(i / 7) % 2) * 0.06, 0.35 + Math.floor(i / 7) * 0.18, 0.28);
      tubeEnds.setMatrixAt(i, M4);
    }
    out.add(tubeEnds);
    // wire guard over the coil
    for (let i = 0; i < 12; i++) out.add(box(1.0, 0.006, 0.006, metal('#8c96a3', 0.4), [3.57, 0.35 + i * 0.09, 0.52]));
    // ice build-up at the bottom of the coil
    const ice = box(1.0, 0.1, 0.42, new THREE.MeshStandardMaterial({ color: '#dff3ff', roughness: 0.2, transparent: true, opacity: 0.85 }), [3.57, 0.28, 0.28]);
    out.add(ice);
    // fan on top: shroud, hub, blades, guard rings
    const fanY = 1.56;
    const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 14, 48), metal('#c4ccd6', 0.3));
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(3.55, fanY + 0.02, 0);
    out.add(shroud);
    const fanRot = new THREE.Group();
    const fblades = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.012, 0.16), paint('#2b3340', 0.5, 0.2), 5);
    for (let i = 0; i < 5; i++) {
      M4.makeRotationY((i / 5) * Math.PI * 2);
      M4.multiply(new THREE.Matrix4().makeTranslation(0.22, 0, 0));
      M4.multiply(new THREE.Matrix4().makeRotationX(0.45));
      fblades.setMatrixAt(i, M4);
    }
    fanRot.add(fblades, cyl(0.07, 0.07, 0.07, metal('#c9d0d9', 0.3), 24));
    fanRot.position.set(3.55, fanY + 0.02, 0);
    out.add(fanRot);
    for (const r of [0.14, 0.26, 0.38]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 40), metal('#aab3bf', 0.4));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(3.55, fanY + 0.12, 0);
      out.add(ring);
    }
    for (let i = 0; i < 8; i++) {
      const sp = box(0.42, 0.006, 0.006, metal('#aab3bf', 0.4), [3.55, fanY + 0.12, 0]);
      sp.rotation.y = (i / 8) * Math.PI;
      out.add(sp);
    }
    // cold exhaust air out of the fan, and snow
    const coldAir = makeCloud(
      120,
      0.1,
      (u, a, b, o) => o.set(3.55 + (a - 0.5) * 0.7 * (1 + u), fanY + 0.15 + u * 1.5, (b - 0.5) * 0.7 * (1 + u)),
      (u, c) => c.set('#9fd0ff').multiplyScalar(0.75 * (1 - u)),
    );
    const snow = makeCloud(
      150,
      0.06,
      (u, a, b, o) => o.set(1.2 + a * 5, 4.6 - u * 4.5, -1 + b * 2.2),
      '#ffffff',
    );
    root.add(coldAir.object, snow.object);

    /* ---------- refrigerant lines ---------- */
    type PipeRec = { object: THREE.Group; path: THREE.CurvePath<THREE.Vector3>; setColor: (c: THREE.Color) => void; cloud: Cloud; len: number };
    const pipes: Record<string, PipeRec> = {};
    const mk = (name: string, pts: [number, number, number][], r = 0.035) => {
      const p = makePipe(pts, r, 0.12);
      const len = p.path.getLength();
      const cloud = pipeCloud(p.path, Math.max(14, Math.round(len * 10)), 0.07, r * 0.5);
      root.add(p.object, cloud.object);
      pipes[name] = { ...p, cloud, len };
    };
    mk('hot', [[2.78, 0.88, -0.05], [2.78, 1.72, -0.05], [0.4, 1.72, -0.2], [-0.55, 1.95, -0.55], [-0.8, 2.0, -0.55]], 0.04);
    mk('liquid', [[-0.85, 0.55, -0.55], [-0.85, 0.4, -0.35], [0.5, 0.4, -0.35], [2.2, 0.4, -0.35], [2.95, 0.4, 0.25], [3.1, 0.35, 0.28]], 0.032);
    mk('suction', [[3.1, 1.25, 0.28], [2.95, 1.35, 0.2], [2.6, 1.3, 0.1], [2.6, 0.8, 0.05], [2.7, 0.62, -0.05]], 0.04);

    const lab = (txt: string, x: number, y: number, z = 0) => {
      const L = liveLabel(0.3);
      L.sprite.position.set(x, y, z);
      L.set(txt);
      root.add(L.sprite);
      return L;
    };
    const lIn = lab('indoor coil (condenser)', -0.85, 2.7, -0.4);
    const lOut = lab('outdoor coil (evaporator)', 3.55, 2.65, 0.3);
    lab('compressor', 2.7, 1.25, 0.9);
    const lFrost = liveLabel(0.3);
    lFrost.sprite.position.set(3.55, 3.15, 0.3);
    root.add(lFrost.sprite);
    const lRoom = lab('living space 21 °C', -2.5, 0.9, 0.9);
    void lRoom;

    let tAcc = 0;
    return {
      update: (dt: number) => {
        const p = P.current;
        tAcc += dt;
        const st2 = p.hp.c.states;
        const base = 0.35 + 1.4 * Math.min(1, p.mdot / 0.1);
        const setP = (n: string, T: number) => {
          const col = heat((T + 35) / 115, tmp);
          pipes[n].setColor(col);
          (pipes[n].cloud.object.material as THREE.PointsMaterial).color.copy(col).lerp(new THREE.Color('#ffffff'), 0.4);
          pipes[n].cloud.update(dt, base / pipes[n].len);
        };
        setP('hot', st2['2'].T);
        setP('liquid', st2['3'].T);
        setP('suction', st2['1'].T);
        // coils: indoor hot, outdoor cold, frosted when it is cold enough
        finMat.emissive.copy(cold(T_COND)).multiplyScalar(0.18);
        finMat.color.copy(cold(T_COND)).lerp(new THREE.Color('#d7dde5'), 0.6);
        (hairpins.material as THREE.MeshStandardMaterial).emissive.copy(cold(st2['2'].T));
        (tubeEnds.material as THREE.MeshStandardMaterial).emissive.copy(cold(st2['4'].T)).multiplyScalar(0.7);
        (coilFins.material as THREE.MeshStandardMaterial).color.copy(cold(st2['4'].T)).lerp(new THREE.Color('#d9e0e8'), 0.7);
        frostMat.opacity = Math.min(0.95, p.frost * 1.1);
        ice.visible = p.frost > 0.05;
        ice.scale.set(1, 0.3 + 3 * p.frost, 1);
        ice.position.y = 0.23 + 0.05 * (0.3 + 3 * p.frost);
        snow.object.visible = p.Tout < 2;
        snow.update(dt, p.Tout < 2 ? 0.18 : 0);
        // fans
        const qn = Math.min(1, p.Q / 12);
        fanRot.rotation.y += dt * (4 + 14 * qn) * (1 - 0.6 * p.frost);
        blower.rotation.z -= dt * (6 + 14 * qn);
        coldAir.update(dt, (0.15 + 0.35 * qn) * (1 - 0.6 * p.frost));
        warmAir.update(dt, 0.12 + 0.35 * qn);
        retAir.update(dt, 0.1 + 0.3 * qn);
        // heat leak arrows
        const loss = Math.min(1, Math.max(0, (T_IN - p.Tout) / 46));
        arrows.count = 10;
        for (let i = 0; i < 10; i++) {
          const [x, y, z, rz] = arrowSpots[i];
          const s = 0.2 + 1.8 * loss;
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz === 0 ? 0 : -rz));
          if (i === 6) q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
          if (i === 9) q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
          const pulse = 0.9 + 0.1 * Math.sin(tAcc * 5 + i);
          m.compose(new THREE.Vector3(x + (rz ? -s * 0.15 : 0), y + (rz === 0 && i < 6 ? s * 0.12 : 0), z), q, new THREE.Vector3(s * pulse, s * pulse, s * pulse));
          arrows.setMatrixAt(i, m);
        }
        arrows.instanceMatrix.needsUpdate = true;
        roomGlow.material.opacity = 0.05;
        lIn.set(`condenser ${T_COND} °C · ${Math.round(st2['2'].T)} °C discharge`);
        lOut.set(`evaporator ${Math.round(p.Tout - T_APP)} °C`);
        lFrost.set(p.frost > 0.05 ? `frost on the coil (${Math.round(p.frost * 100)} %)` : 'coil clear of frost');
      },
    };
  };

  return (
    <SimFrame title="Heat-pump lab" subtitle={<span>COP<sub>HP</sub> = q<sub>H</sub> / w for R-134a, evaporator 8 K below the outdoor air, condenser 45 °C</span>}>
      <LabGrid
        left={
          <>
            <Studio3D
              setup={setup}
              height={420}
              camera={[-0.5, 3.0, 14.2]}
              target={[-0.5, 1.7, 0]}
              fov={38}
              caption="Cut-section of a house with its indoor coil and an outdoor unit. Refrigerant lines are coloured by temperature (red hot discharge gas → orange liquid → cold evaporator); orange arrows are the heat the house loses; below about 2 °C the outdoor coil frosts."
            />
            <Plot
              x={[-25, 15]}
              y={[0, 9]}
              height={250}
              xLabel="outdoor temperature (°C)"
              yLabel="COP for heating"
              series={[
                { points: curve.a, color: 'var(--c1)', width: 2.6, label: 'R-134a cycle (η_C = 0.8)' },
                { points: curve.b, color: 'var(--c2)', width: 1.6, dash: true, label: 'Carnot between the coil temperatures' },
                { points: curve.res, color: 'var(--c3)', width: 2, label: 'resistance heater (COP = 1)' },
              ]}
              dots={[{ x: Tout, y: hp.cop, color: 'var(--c1)' }]}
              vlines={[{ x: 2, dash: true, label: 'frost starts ≈ 2 °C' }]}
              legend
            />
            <TsDiagramView fluid="r134a" points={ts} path={[0, 1, 2, 3, 0]} height={260} isobars={[st['1'].P, st['2'].P]} />
          </>
        }
        right={
          <>
            <Slider label="outdoor temperature" value={Tout} min={-25} max={15} step={1} onChange={setTout} unit=" °C" />
            <Slider label="house heat-loss UA" value={UA} min={100} max={500} step={10} onChange={setUA} unit=" W/K" />
            <Readout
              items={[
                ['heat delivered per kW of electricity', `${f(hp.cop, 3)} kW`],
                ['COP (Carnot, same coil temps)', f(hp.carnot, 3)],
                ['house heat demand', `${f(Q, 3)} kW`],
                ['electricity: heat pump', `${f(W, 3)} kW`],
                ['electricity: resistance', `${f(Q, 3)} kW`],
                ['saving vs resistance', `${f((1 - W / Q) * 100, 3)} %`],
                ['evaporator / condenser', `${f(Tout - T_APP, 3)} / ${T_COND} °C`],
                ['refrigerant flow', `${f(mdot * 1000, 3)} g/s`],
              ]}
            />
            <LabFoot>
              Indoor air is held at 21 °C; the pump must supply what the house loses, UA·(21 − T_out). The real seasonal COP is a bit lower still (defrost cycles, fan and pump power, part-load cycling). Frost makes the outdoor fan blow against a blocked coil and forces a defrost cycle that costs heat.
            </LabFoot>
          </>
        }
      />
    </SimFrame>
  );
}
