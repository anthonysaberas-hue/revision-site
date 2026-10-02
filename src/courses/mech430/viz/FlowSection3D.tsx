/**
 * FlowSection3D — realistic half-section of an axisymmetric nozzle / duct / engine, rendered with Three.js.
 * The cut plane (z = 0) shows the flow field as a CFD-style colour map with streaks that travel at the
 * local gas velocity; walls are PBR metal with solid cut faces; shocks glow; the exhaust plume at the exit
 * responds to the expansion regime. Used by every duct/nozzle simulation on the site.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface FieldPoint {
  /** Mach number */
  M: number;
  /** p / p0 (any consistent reference) */
  p: number;
  /** T / T0 (any consistent reference) */
  T: number;
}

export type ColorBy = 'M' | 'p' | 'T';
export type PlumeKind = 'none' | 'subsonic' | 'ideal' | 'over' | 'under';

export interface FlowSection3DProps {
  /** Inner wall radius as a function of axial position */
  profile: (x: number) => number;
  x0: number;
  x1: number;
  /** Flow state along the axis (1-D) */
  field: (x: number) => FieldPoint;
  colorBy?: ColorBy;
  /** Normal-shock positions */
  shocks?: number[];
  /** 'engine' = rocket chamber + ribbed bell; 'duct' = flanged steel pipework; 'plain' = one metal body */
  wall?: 'engine' | 'duct' | 'plain';
  /** Axial position where a duct/pipe begins (for wall styling and a flange) */
  pipeStart?: number;
  plume?: { kind: PlumeKind; strength?: number };
  /** Rayleigh heating zone (glowing coils) */
  heatZone?: [number, number];
  /** Fanno friction zone (roughened wall) */
  frictionZone?: [number, number];
  labels?: { x: number; text: string; side?: 'top' | 'bottom' }[];
  height?: number;
  /** Scale of the streak animation speed */
  flowSpeed?: number;
}

/* ---------------- colour maps ---------------- */
const machStops: [number, THREE.Color][] = [
  [0, new THREE.Color('#12307a')],
  [0.5, new THREE.Color('#2f6fe0')],
  [0.9, new THREE.Color('#9cc4ff')],
  [1.0, new THREE.Color('#f4efe6')],
  [1.4, new THREE.Color('#ffc36a')],
  [2.2, new THREE.Color('#ff7a2a')],
  [3.2, new THREE.Color('#e0302a')],
  [4.5, new THREE.Color('#8a1030')],
];
const seqStops: [number, THREE.Color][] = [
  [0, new THREE.Color('#1b0c41')],
  [0.25, new THREE.Color('#4a0c6b')],
  [0.5, new THREE.Color('#a52c60')],
  [0.75, new THREE.Color('#ed6925')],
  [1, new THREE.Color('#fcffa4')],
];
function ramp(stops: [number, THREE.Color][], v: number, out: THREE.Color) {
  if (!isFinite(v)) return out.set('#555');
  if (v <= stops[0][0]) return out.copy(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      return out.copy(ca).lerp(cb, (v - a) / (b - a));
    }
  }
  return out.copy(stops[stops.length - 1][1]);
}
export function fieldColor(f: FieldPoint, by: ColorBy, out = new THREE.Color()) {
  if (by === 'M') return ramp(machStops, f.M, out);
  if (by === 'p') return ramp(seqStops, Math.min(1, Math.max(0, f.p)), out);
  return ramp(seqStops, Math.min(1, Math.max(0, f.T)), out);
}
export function colorLegend(by: ColorBy) {
  if (by === 'M') return { label: 'Mach number', stops: machStops.map(([v, c]) => ({ v, c: `#${c.getHexString()}` })) };
  return { label: by === 'p' ? 'p / p₀' : 'T / T₀', stops: seqStops.map(([v, c]) => ({ v, c: `#${c.getHexString()}` })) };
}

/* ---------------- helpers ---------------- */
function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
const glow = () =>
  tex(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
const ribs = () => {
  const t = tex(
    1024,
    4,
    (c) => {
      for (let x = 0; x < 1024; x++) {
        const v = 0.5 + 0.5 * Math.cos((x / 1024) * Math.PI * 2 * 120);
        const k = Math.round(90 + 120 * v ** 3);
        c.fillStyle = `rgb(${k},${k},${k})`;
        c.fillRect(x, 0, 1, 4);
      }
    },
    false,
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const noiseTex = () => {
  const t = tex(
    256,
    256,
    (c) => {
      const img = c.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 110 + Math.random() * 90;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    },
    false,
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
};

/** Watertight solid of revolution about +x from inner profile samples and a wall thickness. */
function revolveSolid(inner: [number, number][], t: number, seg = 96) {
  const pts: THREE.Vector2[] = [];
  for (const [x, r] of inner) pts.push(new THREE.Vector2(Math.max(0.0005, r), x));
  for (let i = inner.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(inner[i][1] + t, inner[i][0]));
  pts.push(pts[0].clone());
  pts.reverse();
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function sectionMaterial(params: THREE.MeshStandardMaterialParameters, cut: string, planes: THREE.Plane[]) {
  const m = new THREE.MeshStandardMaterial({ ...params, side: THREE.DoubleSide, clippingPlanes: planes });
  const cc = new THREE.Color(cut);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = { value: cc };
    sh.fragmentShader =
      'uniform vec3 uCut;\n' +
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (!gl_FrontFacing) { gl_FragColor = vec4(uCut, 1.0); return; }');
  };
  m.customProgramCacheKey = () => `fs-cut-${cut}`;
  return m;
}

/* ---------------- shaders ---------------- */
const sliceVert = /* glsl */ `
  attribute vec3 color; attribute float tau; attribute float eta;
  varying vec3 vCol; varying float vTau; varying float vEta;
  void main(){ vCol = color; vTau = tau; vEta = eta; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const sliceFrag = /* glsl */ `
  uniform float uTime; uniform float uStreak;
  varying vec3 vCol; varying float vTau; varying float vEta;
  float h(float n){ return fract(sin(n)*43758.5453); }
  void main(){
    // streamline streaks: lanes across the radius, each with dashes advected by travel time tau
    float lanes = 18.0;
    float lf = (vEta * 0.5 + 0.5) * lanes;
    float lane = floor(lf);
    float laneMask = exp(-pow((fract(lf) - 0.5) * 7.0, 2.0));      // thin line in the middle of each lane
    float ph = fract(vTau * 2.2 - uTime * 0.7 + h(lane) * 7.0);
    float dash = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.05, 0.45, ph)); // bright head, fading tail
    float wall = smoothstep(1.0, 0.8, abs(vEta));                   // boundary-layer darkening
    vec3 c = vCol * (0.5 + 0.4 * wall);
    c += vec3(1.0) * dash * laneMask * 0.3 * uStreak * wall;
    gl_FragColor = vec4(c, 1.0);
  }
`;
const plumeVert = /* glsl */ `
  uniform float uLen, uRe, uSpread, uPinch, uSpacing, uRipple, uTime;
  varying float vT; varying vec3 vN; varying vec3 vView; varying float vX; varying vec2 vUv;
  void main() {
    float t = position.y + 0.5; float x = t * uLen; float r = uRe;
    r *= 1.0 - uPinch * (1.0 - exp(-x / (uRe * 1.6)));
    r += x * tan(uSpread);
    r *= 1.0 - uRipple * 0.5 * (1.0 - cos(6.2831853 * x / uSpacing));
    r += x * 0.05;
    r *= 1.0 + 0.02 * sin(uTime * 23.0 + x * 3.0);
    vec3 p = vec3(position.x * r, x, position.z * r);
    vT = t; vX = x; vUv = uv;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = normalize(-mv.xyz); vN = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
    gl_Position = projectionMatrix * mv;
  }
`;
const plumeFrag = /* glsl */ `
  uniform float uTime, uIntensity, uSpacing, uRipple; uniform vec3 uColA, uColB;
  varying float vT; varying vec3 vN; varying vec3 vView; varying float vX; varying vec2 vUv;
  float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
  void main(){
    float facing = abs(dot(normalize(vN), normalize(vView)));
    float n = noise(vec3(vUv.x*8.0, vX*3.0 - uTime*5.0, uTime*0.6));
    float along = 1.0 - smoothstep(0.0, 1.0, vT);
    float ph = fract(vX / uSpacing);
    float band = (exp(-pow((ph-0.95)*9.0,2.0)) + exp(-pow((ph+0.05)*9.0,2.0))) * uRipple * 3.0;
    vec3 col = mix(uColA, uColB, smoothstep(0.0, 0.6, vT));
    float a = pow(facing, 1.6) * along * (0.5 + 0.7*n) * uIntensity * 0.22 * (1.0 + band);
    gl_FragColor = vec4(col + band*vec3(1.0,0.85,0.6)*0.5, clamp(a,0.0,1.0));
  }
`;

/* ---------------- the scene ---------------- */
class FlowScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 2, 0.01, 200);
  controls: OrbitControls;
  planes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
  hardware = new THREE.Group();
  slice?: THREE.Mesh;
  sliceMat: THREE.ShaderMaterial;
  shockGroup = new THREE.Group();
  plume = new THREE.Group();
  plumeU: Record<string, THREE.IUniform>;
  diamonds: THREE.Sprite[] = [];
  coils: THREE.MeshStandardMaterial[] = [];
  particles: THREE.Points;
  pState: { x: Float32Array; eta: Float32Array };
  speedAt: (x: number) => number = () => 1;
  profile: (x: number) => number = () => 1;
  x0 = 0;
  x1 = 1;
  raf = 0;
  visible = true;
  time = 0;
  clock = new THREE.Clock();
  glowTex = glow();
  flowSpeed = 1;
  labelsCb?: (l: { text: string; x: number; y: number; side: string }[]) => void;
  labels: { x: number; text: string; side?: 'top' | 'bottom' }[] = [];
  host: HTMLElement;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#070a12');
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    this.scene.add(new THREE.HemisphereLight('#4a6cc0', '#05070d', 0.5));
    const key = new THREE.DirectionalLight('#fff4e6', 2.2);
    key.position.set(-2, 4, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#3d7bff', 1.6);
    rim.position.set(2, 2, -5);
    this.scene.add(rim);
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: '#1d3f9e', transparent: true, opacity: 0.45, depthWrite: false }));
    bg.scale.set(30, 12, 1);
    bg.position.set(0, 0, -8);
    this.scene.add(bg);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.minAzimuthAngle = -0.9;
    this.controls.maxAzimuthAngle = 0.9;
    this.controls.minPolarAngle = 0.9;
    this.controls.maxPolarAngle = 2.0;

    this.sliceMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uStreak: { value: 1 } }, vertexShader: sliceVert, fragmentShader: sliceFrag, side: THREE.DoubleSide });
    this.scene.add(this.hardware, this.shockGroup, this.plume);

    // plume
    const pu = {
      uLen: { value: 1 },
      uRe: { value: 0.3 },
      uSpread: { value: 0 },
      uPinch: { value: 0 },
      uSpacing: { value: 0.5 },
      uRipple: { value: 0 },
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uColA: { value: new THREE.Color('#ffc890') },
      uColB: { value: new THREE.Color('#7a5cff') },
    };
    this.plumeU = pu;
    const pm = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 48, 80, true),
      new THREE.ShaderMaterial({ uniforms: pu, vertexShader: plumeVert, fragmentShader: plumeFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    pm.rotation.z = -Math.PI / 2;
    pm.frustumCulled = false;
    this.plume.add(pm);
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: '#ffe0b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.plume.add(s);
      this.diamonds.push(s);
    }

    // tracer particles on the cut plane
    const N = 260;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.022, map: this.glowTex, color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    this.pState = { x: new Float32Array(N), eta: new Float32Array(N) };

    const io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting));
    io.observe(host);
    this.io = io;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }
  io: IntersectionObserver;
  ro: ResizeObserver;

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
    // fit the whole assembly (+ some plume) in view
    const w = this.x1 - this.x0;
    const extra = this.plume.visible ? w * 0.55 : w * 0.04;
    const lead = this.leadIn;
    const cx = (this.x0 - lead + this.x1 + extra) / 2;
    const span = (w + lead + extra) * 1.12;
    const fovH = 2 * Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
    const d = (span / 2) / Math.tan(fovH / 2);
    this.controls.target.set(cx, 0, 0);
    this.camera.position.set(cx - w * 0.06, d * 0.22, d * 0.98);
    this.controls.update();
  }

  /** Rebuild wall hardware and the slice mesh for a new geometry. */
  build(p: FlowSection3DProps) {
    this.x0 = p.x0;
    this.x1 = p.x1;
    this.profile = p.profile;
    this.leadIn = (p.wall ?? 'plain') === 'engine' ? p.profile(p.x0) * 0.6 : 0;
    // clear
    this.hardware.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
    this.hardware.clear();
    this.coils = [];
    const n = 120;
    const samples: [number, number][] = [];
    let rMax = 0;
    let xt = p.x0;
    let rMin = Infinity;
    for (let i = 0; i <= n; i++) {
      const x = p.x0 + ((p.x1 - p.x0) * i) / n;
      const r = p.profile(x);
      samples.push([x, r]);
      rMax = Math.max(rMax, r);
      if (r < rMin) {
        rMin = r;
        xt = x;
      }
    }
    const t = rMax * 0.09;
    const wall = p.wall ?? 'plain';
    const steel = { color: '#aeb6c2', metalness: 0.95, roughness: 0.3 };
    const graphite = { color: '#262a31', metalness: 0.6, roughness: 0.42, bumpMap: ribs(), bumpScale: 2 };
    const add = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const mesh = new THREE.Mesh(g, m);
      this.hardware.add(mesh);
      return mesh;
    };
    const split = (a: number, b: number) => samples.filter(([x]) => x >= a - 1e-9 && x <= b + 1e-9);
    if (wall === 'engine') {
      add(revolveSolid(split(p.x0, xt), t * 1.2), sectionMaterial(steel, '#d7dbe2', this.planes));
      add(revolveSolid(split(xt, p.pipeStart ?? p.x1), t * 0.7), sectionMaterial(graphite, '#c8743e', this.planes));
      // injector dome closing the chamber
      const r0 = p.profile(p.x0);
      const dome: [number, number][] = [];
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * (Math.PI / 2);
        dome.push([p.x0 - r0 * 0.45 * Math.cos(a), r0 * Math.sin(a)]);
      }
      add(revolveSolid(dome, t * 1.2), sectionMaterial(steel, '#d7dbe2', this.planes));
      const plate = add(new THREE.CylinderGeometry(r0, r0, t * 0.6, 48), sectionMaterial({ color: '#c0703f', metalness: 0.9, roughness: 0.35 }, '#e08a55', this.planes));
      plate.rotation.z = Math.PI / 2;
      plate.position.x = p.x0 + t * 0.3;
      const lip = add(new THREE.TorusGeometry((p.pipeStart ? p.profile(p.pipeStart) : p.profile(p.x1)) + t * 0.7, t * 0.35, 12, 80), sectionMaterial(steel, '#d7dbe2', this.planes));
      lip.rotation.y = Math.PI / 2;
      lip.position.x = p.pipeStart ?? p.x1;
      if (p.pipeStart) add(revolveSolid(split(p.pipeStart, p.x1), t), sectionMaterial(steel, '#d7dbe2', this.planes));
    } else {
      add(revolveSolid(samples, t), sectionMaterial(wall === 'duct' ? steel : steel, '#d7dbe2', this.planes));
      if (wall === 'duct') {
        const flangeAt = [p.x0, p.pipeStart ?? (p.x0 + p.x1) / 2, p.x1].filter((v, i, a) => a.indexOf(v) === i);
        for (const xf of flangeAt) {
          const f = add(new THREE.TorusGeometry(p.profile(xf) + t * 1.2, t * 0.55, 10, 64), sectionMaterial({ color: '#59616d', metalness: 0.9, roughness: 0.4 }, '#9aa3ad', this.planes));
          f.rotation.y = Math.PI / 2;
          f.position.x = xf;
        }
      }
    }
    if (p.frictionZone) {
      const [a, b] = p.frictionZone;
      const rough = add(revolveSolid(split(a, b).map(([x, r]) => [x, r - t * 0.12]), t * 0.14), sectionMaterial({ color: '#8a7a64', metalness: 0.5, roughness: 0.9, bumpMap: noiseTex(), bumpScale: 4 }, '#b8a58a', this.planes));
      void rough;
    }
    if (p.heatZone) {
      const [a, b] = p.heatZone;
      const nC = 8;
      for (let i = 0; i < nC; i++) {
        const x = a + ((b - a) * (i + 0.5)) / nC;
        const m = new THREE.MeshStandardMaterial({ color: '#40160a', emissive: '#ff4a1a', emissiveIntensity: 1.5, metalness: 0.5, roughness: 0.5, clippingPlanes: this.planes, side: THREE.DoubleSide });
        const c = add(new THREE.TorusGeometry(p.profile(x) + t * 1.35, t * 0.35, 10, 64), m);
        c.rotation.y = Math.PI / 2;
        c.position.x = x;
        this.coils.push(m);
      }
    }
    // cut-plane flow slice
    if (this.slice) {
      this.slice.geometry.dispose();
      this.scene.remove(this.slice);
    }
    const nx = 260;
    const ny = 28;
    const pos = new Float32Array((nx + 1) * (ny + 1) * 3);
    const eta = new Float32Array((nx + 1) * (ny + 1));
    const idx: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const x = p.x0 + ((p.x1 - p.x0) * i) / nx;
      const r = p.profile(x);
      for (let j = 0; j <= ny; j++) {
        const e = -1 + (2 * j) / ny;
        const k = i * (ny + 1) + j;
        pos[k * 3] = x;
        pos[k * 3 + 1] = e * r;
        pos[k * 3 + 2] = 0.0005;
        eta[k] = e;
        if (i < nx && j < ny) {
          const a = k;
          const b = k + ny + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('eta', new THREE.BufferAttribute(eta, 1));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    g.setAttribute('tau', new THREE.BufferAttribute(new Float32Array(eta.length), 1));
    g.setIndex(idx);
    this.slice = new THREE.Mesh(g, this.sliceMat);
    this.scene.add(this.slice);
    // particles
    for (let i = 0; i < this.pState.x.length; i++) {
      this.pState.x[i] = p.x0 + Math.random() * (p.x1 - p.x0);
      this.pState.eta[i] = (Math.random() * 2 - 1) * 0.9;
    }
    this.frame();
  }

  /** Update the flow-dependent parts (colours, streak timing, shocks, plume). */
  update(p: FlowSection3DProps) {
    this.flowSpeed = p.flowSpeed ?? 1;
    this.labels = p.labels ?? [];
    const by = p.colorBy ?? 'M';
    if (this.slice) {
      const g = this.slice.geometry;
      const pos = g.attributes.position.array as Float32Array;
      const col = g.attributes.color.array as Float32Array;
      const tau = g.attributes.tau.array as Float32Array;
      const ny = 28;
      const nCols = pos.length / 3 / (ny + 1);
      const c = new THREE.Color();
      let t = 0;
      let prevX = pos[0];
      for (let i = 0; i < nCols; i++) {
        const x = pos[i * (ny + 1) * 3];
        const f = p.field(x);
        fieldColor(f, by, c);
        const v = Math.max(0.03, f.M * Math.sqrt(Math.max(0.05, f.T)));
        t += (x - prevX) / v;
        prevX = x;
        for (let j = 0; j <= ny; j++) {
          const k = i * (ny + 1) + j;
          col[k * 3] = c.r;
          col[k * 3 + 1] = c.g;
          col[k * 3 + 2] = c.b;
          tau[k] = t / (p.x1 - p.x0);
        }
      }
      g.attributes.color.needsUpdate = true;
      g.attributes.tau.needsUpdate = true;
    }
    this.speedAt = (x: number) => {
      const f = p.field(x);
      return Math.max(0.03, f.M * Math.sqrt(Math.max(0.05, f.T)));
    };
    // shocks
    this.shockGroup.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
    this.shockGroup.clear();
    for (const xs of p.shocks ?? []) {
      const r = p.profile(xs);
      const disk = new THREE.Mesh(
        new THREE.CircleGeometry(r * 0.995, 48),
        new THREE.MeshBasicMaterial({ color: '#ffe6c4', transparent: true, opacity: 0.55, side: THREE.DoubleSide, clippingPlanes: this.planes, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      disk.rotation.y = Math.PI / 2;
      disk.position.x = xs;
      const line = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.03 + 0.004, 2 * r), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      line.position.set(xs, 0, 0.002);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: '#ffd9a0', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.set(xs, 0, 0.01);
      halo.scale.set(r * 0.9, r * 2.6, 1);
      this.shockGroup.add(disk, line, halo);
    }
    // plume
    const kind = p.plume?.kind ?? 'none';
    const s = p.plume?.strength ?? 1;
    const Re = p.profile(p.x1);
    this.plume.visible = kind !== 'none';
    this.plume.position.x = p.x1;
    const U = this.plumeU;
    U.uRe.value = Re;
    U.uLen.value = (p.x1 - p.x0) * (kind === 'subsonic' ? 0.5 : 0.9);
    U.uSpread.value = kind === 'under' ? 0.18 * s : kind === 'over' ? -0.05 * s : 0;
    U.uPinch.value = kind === 'over' ? 0.18 * s : 0;
    U.uRipple.value = kind === 'over' ? 0.12 : kind === 'under' ? 0.06 : 0;
    U.uSpacing.value = Re * 2.2;
    U.uIntensity.value = kind === 'subsonic' ? 0.35 : 1;
    ;(U.uColA.value as THREE.Color).set(kind === 'subsonic' ? '#8fb6ff' : '#ffc890');
    this.diamonds.forEach((d, k) => {
      const on = (kind === 'over' || kind === 'under') && k < (kind === 'over' ? 4 : 2);
      (d.material as THREE.SpriteMaterial).opacity = on ? 0.55 * Math.pow(0.75, k) : 0;
      d.position.set((k + 1) * Re * 2.2 - Re * 0.25, 0, 0);
      d.scale.set(Re * 1.1, Re * 1.4, 1);
    });
    const needsReframe = this.plume.visible !== this.lastPlume;
    this.lastPlume = this.plume.visible;
    if (needsReframe) this.frame();
  }
  lastPlume = false;
  leadIn = 0;

  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.visible) return;
    this.time += dt;
    this.sliceMat.uniforms.uTime.value = this.time * this.flowSpeed;
    this.plumeU.uTime.value = this.time;
    for (const m of this.coils) m.emissiveIntensity = 1.2 + 0.4 * Math.sin(this.time * 3);
    // advect tracers with the local velocity
    const arr = this.particles.geometry.attributes.position.array as Float32Array;
    const L = this.x1 - this.x0;
    for (let i = 0; i < this.pState.x.length; i++) {
      let x = this.pState.x[i] + dt * this.speedAt(this.pState.x[i]) * L * 0.18 * this.flowSpeed;
      if (x > this.x1) {
        x = this.x0;
        this.pState.eta[i] = (Math.random() * 2 - 1) * 0.9;
      }
      this.pState.x[i] = x;
      arr[i * 3] = x;
      arr[i * 3 + 1] = this.pState.eta[i] * this.profile(x);
      arr[i * 3 + 2] = 0.003;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.labelsCb) {
      const w = this.host.clientWidth;
      const h = this.host.clientHeight;
      this.labelsCb(
        this.labels.map((l) => {
          const r = this.profile(l.x);
          const v = new THREE.Vector3(l.x, (l.side === 'bottom' ? -1 : 1) * r * 1.12, 0).project(this.camera);
          return { text: l.text, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, side: l.side ?? 'top' };
        }),
      );
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

export function FlowSection3D(props: FlowSection3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const sc = useRef<FlowScene | null>(null);
  const [labels, setLabels] = useState<{ text: string; x: number; y: number; side: string }[]>([]);
  const [err, setErr] = useState(false);
  // geometry key: rebuild hardware only when the shape actually changes
  const geomKey = useMemo(() => {
    const s: number[] = [props.x0, props.x1, props.pipeStart ?? -1];
    for (let i = 0; i <= 24; i++) s.push(Math.round(props.profile(props.x0 + ((props.x1 - props.x0) * i) / 24) * 1e4));
    return `${props.wall}|${s.join(',')}|${props.heatZone?.join(',')}|${props.frictionZone?.join(',')}`;
  }, [props]);

  useEffect(() => {
    if (!host.current) return;
    try {
      sc.current = new FlowScene(host.current);
      sc.current.labelsCb = (l) => setLabels(l);
    } catch {
      setErr(true);
    }
    return () => {
      sc.current?.dispose();
      sc.current = null;
    };
  }, []);
  useEffect(() => {
    sc.current?.build(props);
    sc.current?.update(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomKey]);
  useEffect(() => {
    sc.current?.update(props);
  });

  const legend = colorLegend(props.colorBy ?? 'M');
  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#070a12' }}>
      <div ref={host} style={{ width: '100%', height: props.height ?? 300, cursor: 'grab' }} />
      {err && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#ff8a80' }}>WebGL unavailable</div>}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {labels.map((l, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: l.x,
              top: l.y,
              transform: `translate(-50%, ${l.side === 'bottom' ? '4px' : 'calc(-100% - 4px)'})`,
              fontSize: 11.5,
              fontWeight: 600,
              color: '#eef2fb',
              background: 'rgba(12,16,28,0.78)',
              border: '1px solid rgba(143,179,255,0.35)',
              borderRadius: 999,
              padding: '2px 9px',
              whiteSpace: 'nowrap',
            }}
          >
            {l.text}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 10, bottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#9fb0d6', pointerEvents: 'none' }}>
        <span>{legend.label}</span>
        <div
          style={{
            width: 150,
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${legend.stops.map((s, i) => `${s.c} ${(100 * i) / (legend.stops.length - 1)}%`).join(', ')})`,
          }}
        />
        <span>{legend.stops[0].v} → {legend.stops[legend.stops.length - 1].v}</span>
      </div>
      <div style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 10.5, color: '#6f7b99', pointerEvents: 'none' }}>drag to rotate · section view</div>
    </div>
  );
}

/** Build a field function by linear interpolation of sampled points {x, M, p} (T/T0 from M, adiabatic γ = 1.4). */
export function interpField(pts: { x: number; M: number; p: number }[], g = 1.4) {
  return (x: number): FieldPoint => {
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1].x < x) i++;
    const a = pts[i];
    const b = pts[i + 1] ?? a;
    const t = b.x === a.x ? 0 : Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
    const M = a.M + (b.M - a.M) * t;
    return { M, p: a.p + (b.p - a.p) * t, T: 1 / (1 + ((g - 1) / 2) * M * M) };
  };
}
