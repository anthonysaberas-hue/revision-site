/**
 * Procedural 3D rocket engine on a thrust-block test stand, with a live physics-driven plume.
 * Imperative Three.js class; the React page drives it through setters.
 *
 * Layout: engine axis = world +x, throat at x = 0, exhaust toward +x.
 * All propellant hardware lies in the z = 0 plane so the half-section (cut at z = 0,
 * viewed from +z) shows every component in section, like a textbook cutaway drawing.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GEOM, plumeVisual, engineState, EngineState } from './engineModel';

export type ViewMode = 'whole' | 'cutaway' | 'exploded';
export type FollowMode = 'all' | 'oxygen' | 'methane' | 'fire';

export interface LabelOut {
  id: string;
  text: string;
  sub?: string;
  x: number;
  y: number;
  visible: boolean;
  kind?: string;
}

const O2 = new THREE.Color('#3d8bff');
const CH4 = new THREE.Color('#ff9a3a');
const FLOOR_Y = -1.45;
const WALL_X = -1.62;
const LB = 1.55; // bell length
const RC = 0.3; // chamber radius
const X_INJ = -0.78; // injector face

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTex = () =>
  canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
const diamondTex = () =>
  canvasTexture(256, 128, (c) => {
    const img = c.createImageData(256, 128);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 256; x++) {
        const d = Math.abs(x - 128) / 128 + Math.abs(y - 64) / 64;
        const a = Math.max(0, 1 - d) ** 1.6;
        const i = (y * 256 + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 235;
        img.data[i + 2] = 205;
        img.data[i + 3] = Math.round(255 * a);
      }
    c.putImageData(img, 0, 0);
  });
const ribTex = () => {
  const t = canvasTexture(1024, 4, (c) => {
    for (let x = 0; x < 1024; x++) {
      const v = 0.5 + 0.5 * Math.cos((x / 1024) * Math.PI * 2 * 140);
      const k = Math.round(90 + 120 * v ** 3);
      c.fillStyle = `rgb(${k},${k},${k})`;
      c.fillRect(x, 0, 1, 4);
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const brushedTex = () => {
  const t = canvasTexture(512, 512, (c) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const y = Math.random() * 512;
      const k = 100 + Math.random() * 60;
      c.strokeStyle = `rgba(${k},${k},${k},0.25)`;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(512, y + (Math.random() - 0.5) * 2);
      c.stroke();
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a: number, b: number, lambda: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

/** Nozzle contour: cubic Hermite from throat (angle 32°) to exit (angle 8°). */
export function nozzleRadius(x: number) {
  const { Rt, Re } = GEOM;
  const L = LB;
  const s = Math.min(1, Math.max(0, x / L));
  const m0 = Math.tan((32 * Math.PI) / 180);
  const m1 = Math.tan((8 * Math.PI) / 180);
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  const h11 = s ** 3 - s ** 2;
  return h00 * Rt + h10 * L * m0 + h01 * Re + h11 * L * m1;
}
/** Chamber inner radius from the injector to the throat. */
function chamberRadius(x: number) {
  const { Rt } = GEOM;
  const xConv = -0.26;
  if (x < xConv) return RC;
  if (x >= 0) return Rt;
  const s = (x - xConv) / -xConv;
  return Rt + (RC - Rt) * 0.5 * (1 + Math.cos(Math.PI * s));
}

/**
 * Solid body of revolution about the x axis from an inner-surface profile [x, r] and a wall thickness.
 * The profile is closed (inner → outer), so the body is watertight and its back faces can be painted
 * as the "cut face" when sectioned.
 */
function revolveSolid(inner: [number, number][], t: number, segments = 128) {
  const pts: THREE.Vector2[] = [];
  for (const [x, r] of inner) pts.push(new THREE.Vector2(Math.max(0.0005, r), x));
  for (let i = inner.length - 1; i >= 0; i--) {
    const [x, r] = inner[i];
    pts.push(new THREE.Vector2(r + t, x));
  }
  pts.push(pts[0].clone());
  pts.reverse(); // winding so the outer skin is front-facing
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateZ(-Math.PI / 2); // lathe axis (y) → world x
  return g;
}
function sampleProfile(f: (x: number) => number, x0: number, x1: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    out.push([x, f(x)]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* shaders                                                             */
/* ------------------------------------------------------------------ */
const plumeVert = /* glsl */ `
  uniform float uLen, uRe, uSpread, uPinch, uSpacing, uRipple, uTime, uWiden;
  varying float vT; varying vec3 vN; varying vec3 vView; varying float vX; varying vec2 vUv;
  void main() {
    float t = position.y + 0.5;
    float x = t * uLen;
    float r = uRe;
    r *= 1.0 - uPinch * (1.0 - exp(-x / (uRe * 1.6)));
    r += x * tan(uSpread);
    r *= 1.0 - uRipple * 0.5 * (1.0 - cos(6.2831853 * x / uSpacing));
    r += x * 0.045 * uWiden;
    r *= 1.0 + 0.025 * sin(uTime * 23.0 + x * 3.0) * sin(uTime * 17.0 + position.x * 5.0);
    vec3 p = vec3(position.x * r, x, position.z * r);
    vT = t; vX = x; vUv = uv;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = normalize(-mv.xyz);
    vN = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
    gl_Position = projectionMatrix * mv;
  }
`;
const plumeFrag = /* glsl */ `
  uniform float uTime, uIntensity, uSpacing, uRipple, uCore, uVac, uLen;
  uniform vec3 uColA, uColB, uColC;
  varying float vT; varying vec3 vN; varying vec3 vView; varying float vX; varying vec2 vUv;
  float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vView)));
    float body = pow(facing, uCore > 0.5 ? 3.0 : 1.6);
    float n = fbm(vec3(vUv.x * 7.0, vX * 1.3 - uTime * 6.0, uTime * 0.7));
    float along = 1.0 - smoothstep(0.0, 1.0, vT);
    float lip = smoothstep(0.0, 0.03, vT);
    float ph = fract(vX / uSpacing);
    float band = exp(-pow((ph - 0.95) * 9.0, 2.0)) + exp(-pow((ph + 0.05) * 9.0, 2.0));
    band *= uRipple * 3.0;
    vec3 col = mix(uColA, uColB, smoothstep(0.0, 0.35 + 0.3*uVac, vT));
    col = mix(col, uColC, smoothstep(0.35, 1.0, vT));
    float a = body * along * lip * (0.55 + 0.75 * n) * uIntensity;
    a *= uCore > 0.5 ? 0.32 : (0.12 - 0.03 * uVac);
    gl_FragColor = vec4(col + band * vec3(1.0, 0.85, 0.65) * along * 0.6, clamp(a * (1.0 + band), 0.0, 1.0));
  }
`;
/** Glowing propellant line with light pulses running along it. */
const flowVert = /* glsl */ `
  varying vec2 vUv; varying vec3 vN; varying vec3 vView;
  void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;
const flowFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uTime, uSpeed, uRepeat, uOpacity;
  varying vec2 vUv; varying vec3 vN; varying vec3 vView;
  void main(){
    float s = fract(vUv.x * uRepeat - uTime * uSpeed);
    float seg = smoothstep(0.0, 0.12, s) * smoothstep(0.62, 0.38, s);
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.5);
    vec3 col = uColor * (0.35 + 0.9 * seg) + vec3(1.0) * seg * 0.12;
    float a = uOpacity * (0.25 + 0.55 * seg) * (0.55 + 0.45 * (1.0 - rim));
    gl_FragColor = vec4(col, a);
  }
`;

/* ------------------------------------------------------------------ */
/* the scene                                                           */
/* ------------------------------------------------------------------ */
interface Part {
  name: string;
  group: THREE.Group;
  home: THREE.Vector3;
  explode: THREE.Vector3;
  mats: THREE.MeshStandardMaterial[];
  highlight: number;
}
interface CamPreset {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}
type MatKind = 'graphite' | 'steel' | 'dark' | 'gold' | 'o2' | 'ch4' | 'copper' | 'ice' | 'bronze';

interface Flow {
  key: 'oxygen' | 'methane';
  curve: THREE.CatmullRomCurve3;
  tubeMat: THREE.ShaderMaterial;
  tube: THREE.Mesh;
  points: THREE.Points;
  pointsMat: THREE.PointsMaterial;
  offsets: Float32Array;
}

export class EngineScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  clock = new THREE.Clock();
  container: HTMLElement;

  engineRoot = new THREE.Group();
  parts: Record<string, Part> = {};
  /** Half-section: removes everything with z > constant */
  clipPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 20)];
  pickables: THREE.Object3D[] = [];
  ribs = ribTex();
  brushed = brushedTex();

  flows: Flow[] = [];
  innerGlow!: THREE.Mesh;
  innerGlowMat!: THREE.MeshBasicMaterial;
  hotCores: THREE.MeshBasicMaterial[] = [];
  spinners: THREE.Object3D[] = [];

  plumeGroup = new THREE.Group();
  plumeUniformsOuter!: Record<string, THREE.IUniform>;
  plumeUniformsCore!: Record<string, THREE.IUniform>;
  diamonds: THREE.Sprite[] = [];
  plumeLight!: THREE.PointLight;
  lipGlow!: THREE.Sprite;

  target = { throttle: 1, pa: 101325, view: 'whole' as ViewMode, follow: 'all' as FollowMode, step: 0 };
  cur = { throttle: 1, cut: 0, explode: 0, flowO: 1, flowF: 1, len: 0, spread: 0, pinch: 0, ripple: 0, spacing: 1, intensity: 0, vac: 0, nD: 0, diamond: 0, spin: 0 };
  state: EngineState = engineState(1, 101325);
  playing = true;
  time = 0;

  tween: { from: CamPreset; to: CamPreset; t: number; dur: number } | null = null;
  lastInteraction = performance.now();
  onLabels?: (labels: LabelOut[]) => void;
  onRuler?: (ticks: { x: number; y: number; label: string }[]) => void;
  frame = 0;
  raf = 0;
  raycaster = new THREE.Raycaster();
  occluded: Record<string, boolean> = {};
  disposed = false;
  resizeObs: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#05070d');
    this.scene.fog = new THREE.FogExp2('#05070d', 0.04);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;

    this.camera = new THREE.PerspectiveCamera(36, w / h, 0.05, 200);
    this.camera.position.copy(CAMS.home.pos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 22;
    this.controls.maxPolarAngle = Math.PI * 0.53;
    this.controls.target.copy(CAMS.home.target);
    this.controls.addEventListener('start', () => {
      this.lastInteraction = performance.now();
      this.tween = null;
    });

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.45, 0.75);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.buildEnvironment();
    this.buildThrustBlock();
    this.buildEngine();
    this.buildFlows();
    this.buildPlume();
    this.scene.add(this.engineRoot);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.loop();
  }

  /* ---------------- environment ---------------- */
  buildEnvironment() {
    this.scene.add(new THREE.HemisphereLight('#3b5fb0', '#05070d', 0.35));
    const key = new THREE.SpotLight('#fff4e6', 45, 30, Math.PI / 5, 0.5, 1.4);
    key.position.set(-3, 6.5, 6);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    this.scene.add(key, key.target);
    const fill = new THREE.DirectionalLight('#9fb6ff', 0.6);
    fill.position.set(2, 1, 6);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight('#3d7bff', 2.4);
    rim.position.set(1, 3, -7);
    this.scene.add(rim);
    const rim2 = new THREE.DirectionalLight('#6a4dff', 0.8);
    rim2.position.set(-6, 1, -3);
    this.scene.add(rim2);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#06080f', metalness: 0.6, roughness: 0.5 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(40, 80, '#1a2440', '#0d1322');
    grid.position.y = FLOOR_Y + 0.002;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    this.scene.add(grid);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#1d3f9e', transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    glow.scale.set(26, 13, 1);
    glow.position.set(2, 1.5, -12);
    this.scene.add(glow);
  }

  /* ---------------- materials ---------------- */
  /**
   * Standard PBR material. When `clip` is set it is sectioned by the cut plane and its back faces
   * (the inside of the solid wall, only visible through the cut) are painted flat in `cut` colour.
   */
  mat(kind: MatKind, clip = false, cut?: string) {
    const base: Record<MatKind, THREE.MeshStandardMaterialParameters> = {
      graphite: { color: '#23262d', metalness: 0.6, roughness: 0.42, bumpMap: this.ribs, bumpScale: 2.2 },
      steel: { color: '#aab3bf', metalness: 0.95, roughness: 0.3, roughnessMap: this.brushed },
      dark: { color: '#3b414b', metalness: 0.85, roughness: 0.42 },
      gold: { color: '#d6a634', metalness: 1, roughness: 0.3 },
      o2: { color: '#8fb0e0', metalness: 0.9, roughness: 0.28 },
      ch4: { color: '#d19a6a', metalness: 0.9, roughness: 0.3 },
      copper: { color: '#c0703f', metalness: 0.9, roughness: 0.33 },
      ice: { color: '#bfe3ff', metalness: 0.7, roughness: 0.25 },
      bronze: { color: '#e0a060', metalness: 0.85, roughness: 0.3 },
    };
    const m = new THREE.MeshStandardMaterial({ ...base[kind], side: THREE.DoubleSide });
    m.emissive = new THREE.Color('#4a8bff');
    m.emissiveIntensity = 0;
    if (clip) {
      m.clippingPlanes = this.clipPlanes;
      const cutCol = new THREE.Color(cut ?? '#cfd4dc');
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uCutColor = { value: cutCol };
        sh.fragmentShader =
          'uniform vec3 uCutColor;\n' +
          sh.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            '#include <clipping_planes_fragment>\n  if (!gl_FrontFacing) { gl_FragColor = vec4(uCutColor * 0.9, 1.0); return; }',
          );
      };
      m.customProgramCacheKey = () => `cut-${kind}-${cut ?? ''}`;
    }
    return m;
  }

  addPart(name: string, home: THREE.Vector3, explode: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.copy(home);
    this.engineRoot.add(group);
    const p: Part = { name, group, home: home.clone(), explode, mats: [], highlight: 0 };
    this.parts[name] = p;
    return p;
  }
  mesh(part: Part, geo: THREE.BufferGeometry, mat: THREE.MeshStandardMaterial) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    part.group.add(m);
    part.mats.push(mat);
    this.pickables.push(m);
    return m;
  }

  /* ---------------- thrust block (test stand) ---------------- */
  buildThrustBlock() {
    const g = new THREE.Group();
    const concrete = new THREE.MeshStandardMaterial({ color: '#10131b', metalness: 0.35, roughness: 0.75 });
    const W = 1.2;
    const H = 3.6;
    const D = 3.6;
    const block = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), concrete);
    block.position.set(WALL_X - W / 2, FLOOR_Y + H / 2, 0);
    block.castShadow = block.receiveShadow = true;
    g.add(block);
    // bevel strips
    const edge = new THREE.MeshStandardMaterial({ color: '#1b202b', metalness: 0.6, roughness: 0.5 });
    for (const y of [FLOOR_Y + 0.25, FLOOR_Y + H - 0.25]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, D), edge);
      s.position.set(WALL_X + 0.02, y, 0);
      g.add(s);
    }
    // glowing bolt heads on the face and the front side
    const boltMat = new THREE.MeshStandardMaterial({ color: '#e8ecf5', emissive: '#cfd8ff', emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.3 });
    const boltGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16);
    for (let iy = 0; iy < 6; iy++)
      for (let iz = 0; iz < 6; iz++) {
        const y = FLOOR_Y + 0.4 + iy * ((H - 0.8) / 5);
        const z = -D / 2 + 0.35 + iz * ((D - 0.7) / 5);
        if (Math.abs(y) < 0.7 && Math.abs(z) < 0.7) continue; // leave room for the mount plate
        const b = new THREE.Mesh(boltGeo, boltMat);
        b.rotation.z = Math.PI / 2;
        b.position.set(WALL_X + 0.015, y, z);
        g.add(b);
      }
    for (let iy = 0; iy < 5; iy++)
      for (let ix = 0; ix < 3; ix++) {
        const b = new THREE.Mesh(boltGeo, boltMat);
        b.rotation.x = Math.PI / 2;
        b.position.set(WALL_X - 0.2 - ix * 0.38, FLOOR_Y + 0.5 + iy * 0.62, D / 2 + 0.015);
        g.add(b);
      }
    // mount plate
    const gold = new THREE.MeshStandardMaterial({ color: '#d4a331', metalness: 1, roughness: 0.32 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 1.1), new THREE.MeshStandardMaterial({ color: '#2a2f3a', metalness: 0.9, roughness: 0.35 }));
    plate.position.set(WALL_X + 0.03, 0, 0);
    plate.castShadow = true;
    g.add(plate);
    for (const dy of [-0.45, 0.45])
      for (const dz of [-0.45, 0.45]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16), boltMat);
        b.rotation.z = Math.PI / 2;
        b.position.set(WALL_X + 0.07, dy, dz);
        g.add(b);
      }
    // gold floor plate
    const fp = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.3), gold);
    fp.position.set(WALL_X + 0.45, FLOOR_Y + 0.025, 1.1);
    fp.receiveShadow = true;
    g.add(fp);
    // plaque on the front face of the block
    const plaqueTex = canvasTexture(1024, 256, (c) => {
      c.fillStyle = '#c99a2e';
      c.fillRect(0, 0, 1024, 256);
      c.fillStyle = '#1a1406';
      c.font = '700 84px Inter, system-ui, sans-serif';
      c.fillText('MECH 430 · TEST STAND 1', 40, 120);
      c.font = '44px Inter, system-ui, sans-serif';
      c.fillText('generic methalox · full flow · 1 : 1 scale', 40, 200);
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: 0.6, roughness: 0.4 }));
    plaque.position.set(WALL_X - W / 2, FLOOR_Y + 0.35, D / 2 + 0.005);
    g.add(plaque);
    this.scene.add(g);
  }

  /* ---------------- engine ---------------- */
  buildEngine() {
    const { Rt, Re } = GEOM;

    // ---- nozzle bell: regeneratively cooled wall (graphite outside, copper liner in section)
    const nozzle = this.addPart('nozzle', V(0, 0), V(1.7, 0));
    this.mesh(nozzle, revolveSolid(sampleProfile(nozzleRadius, 0, LB, 90), 0.035, 160), this.mat('graphite', true, '#c8743e'));
    const lip = this.mesh(nozzle, new THREE.TorusGeometry(Re + 0.035, 0.022, 14, 120), this.mat('steel', true));
    lip.rotation.y = Math.PI / 2;
    lip.position.x = LB;
    const xm = 1.38;
    const manifold = this.mesh(nozzle, new THREE.TorusGeometry(nozzleRadius(xm) + 0.07, 0.05, 16, 110), this.mat('ch4', true, '#e0a060'));
    manifold.rotation.y = Math.PI / 2;
    manifold.position.x = xm;
    for (const xs of [0.3, 0.8]) {
      const band = this.mesh(nozzle, new THREE.TorusGeometry(nozzleRadius(xs) + 0.04, 0.016, 10, 100), this.mat('steel', true));
      band.rotation.y = Math.PI / 2;
      band.position.x = xs;
    }

    // ---- main chamber: dome + cylinder + converging section to the throat (one solid)
    const chamber = this.addPart('chamber', V(0, 0), V(0, 0));
    const inner: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      // elliptical dome from the axis to the chamber wall
      const a = (i / 16) * (Math.PI / 2);
      inner.push([X_INJ - 0.14 * Math.cos(a), RC * Math.sin(a)]);
    }
    inner.push(...sampleProfile(chamberRadius, X_INJ + 0.01, 0.02, 50));
    this.mesh(chamber, revolveSolid(inner, 0.045, 120), this.mat('steel', true, '#d9dde4'));
    for (const xf of [X_INJ + 0.02, -0.26]) {
      const f = this.mesh(chamber, new THREE.TorusGeometry(RC + 0.06, 0.025, 12, 90), this.mat('dark', true, '#9aa3ad'));
      f.rotation.y = Math.PI / 2;
      f.position.x = xf;
    }
    // injector plate with coaxial elements (visible in section)
    const plate = this.mesh(chamber, new THREE.CylinderGeometry(RC - 0.005, RC - 0.005, 0.04, 64), this.mat('copper', true, '#e08a55'));
    plate.rotation.z = Math.PI / 2;
    plate.position.x = X_INJ + 0.02;
    const elemMat = this.mat('ice', true, '#ffffff');
    for (let ring = 0; ring <= 3; ring++) {
      const n = ring === 0 ? 1 : ring * 8;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const e = this.mesh(chamber, new THREE.CylinderGeometry(0.014, 0.014, 0.09, 10), elemMat);
        e.rotation.z = Math.PI / 2;
        e.position.set(X_INJ + 0.07, Math.cos(a) * ring * 0.065, Math.sin(a) * ring * 0.065);
      }
    }
    // hot gas inside chamber + nozzle
    const gpts: THREE.Vector2[] = [];
    for (let i = 0; i <= 90; i++) {
      const x = X_INJ + 0.12 + (i / 90) * (LB - X_INJ - 0.14);
      const r = x < 0 ? chamberRadius(x) : nozzleRadius(x);
      gpts.push(new THREE.Vector2(r * 0.9, x));
    }
    this.innerGlowMat = new THREE.MeshBasicMaterial({
      map: canvasTexture(8, 256, (c) => {
        // canvas top = far end (exit, cooler); bottom = injector (hot)
        const g = c.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, '#6a3fd0');
        g.addColorStop(0.35, '#d0508f');
        g.addColorStop(0.52, '#ff9a4a');
        g.addColorStop(0.62, '#fff0d0'); // throat: brightest
        g.addColorStop(0.72, '#e07bd0');
        g.addColorStop(1, '#8a5cff'); // chamber: violet-pink
        c.fillStyle = g;
        c.fillRect(0, 0, 8, 256);
      }),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glowGeo = new THREE.LatheGeometry(gpts, 64);
    glowGeo.rotateZ(-Math.PI / 2);
    this.innerGlow = new THREE.Mesh(glowGeo, this.innerGlowMat);
    chamber.group.add(this.innerGlow);

    // ---- gimbal & thrust structure (on axis, to the wall)
    const gimbal = this.addPart('gimbal', V(-1.2, 0), V(-0.25, 0, 0));
    const ball = this.mesh(gimbal, new THREE.SphereGeometry(0.12, 32, 20), this.mat('steel', true));
    ball.position.x = 0.02;
    const cone = this.mesh(gimbal, revolveSolid([[-0.38, 0.28], [-0.1, 0.1], [0.12, 0.07]], 0.03, 60), this.mat('dark', true, '#8e97a3'));
    void cone;
    const post = this.mesh(gimbal, new THREE.CylinderGeometry(0.06, 0.06, 0.28, 24), this.mat('steel', true));
    post.rotation.z = Math.PI / 2;
    post.position.x = 0.22;
    for (const s of [-1, 1]) {
      const act = this.mesh(gimbal, new THREE.CylinderGeometry(0.03, 0.03, 0.62, 16), this.mat('steel'));
      act.rotation.z = Math.PI / 2 + s * 0.35;
      act.position.set(0.05, s * 0.2, 0.32);
      const body = this.mesh(gimbal, new THREE.CylinderGeometry(0.045, 0.045, 0.24, 16), this.mat('dark'));
      body.rotation.z = Math.PI / 2 + s * 0.35;
      body.position.set(-0.14, s * 0.27, 0.32);
    }

    // ---- turbopumps (axis along x): impeller + inducer on the right, turbine on the left
    const makePump = (name: string, y: number, tint: 'o2' | 'ch4', cutTint: string, explode: THREE.Vector3) => {
      const p = this.addPart(name, V(-0.98, y), explode);
      this.mesh(p, revolveSolid([[-0.24, 0.13], [-0.16, 0.15], [0.12, 0.15], [0.22, 0.11]], 0.03, 64), this.mat('steel', true, '#dfe3ea'));
      const volute = this.mesh(p, new THREE.TorusGeometry(0.2, 0.065, 20, 60), this.mat(tint, true, cutTint));
      volute.rotation.y = Math.PI / 2;
      volute.position.x = 0.06;
      const inlet = this.mesh(p, revolveSolid([[0.22, 0.1], [0.36, 0.075]], 0.025, 40), this.mat(tint, true, cutTint));
      void inlet;
      // internals (not clipped: seen whole through the section)
      const shaft = this.mesh(p, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 16), this.mat('steel'));
      shaft.rotation.z = Math.PI / 2;
      const rotor = new THREE.Group();
      p.group.add(rotor);
      this.spinners.push(rotor);
      const impMat = this.mat(tint === 'o2' ? 'ice' : 'bronze');
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.05, 0.08, 32), impMat);
      hub.rotation.z = -Math.PI / 2;
      hub.position.x = 0.08;
      rotor.add(hub);
      for (let k = 0; k < 10; k++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.085, 0.012), impMat);
        const a = (k / 10) * Math.PI * 2;
        blade.position.set(0.08, Math.cos(a) * 0.075, Math.sin(a) * 0.075);
        blade.rotation.x = a;
        blade.rotation.y = 0.35;
        rotor.add(blade);
      }
      const turbMat = this.mat('dark');
      const tdisk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 32), turbMat);
      tdisk.rotation.z = Math.PI / 2;
      tdisk.position.x = -0.15;
      rotor.add(tdisk);
      for (let k = 0; k < 28; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.008), this.mat('steel'));
        const a = (k / 28) * Math.PI * 2;
        b.position.set(-0.15, Math.cos(a) * 0.115, Math.sin(a) * 0.115);
        b.rotation.x = a;
        b.rotation.y = 0.5;
        rotor.add(b);
      }
      rotor.traverse((o) => this.pickables.push(o));
      return p;
    };
    makePump('pumpO', -0.56, 'o2', '#a9c8f0', V(-0.2, -0.7, 0.9));
    makePump('pumpF', 0.56, 'ch4', '#e7b27f', V(-0.2, 0.7, 0.9));

    // ---- preburners (horizontal canisters) with glowing cores
    const makePre = (name: string, y: number, tint: 'o2' | 'ch4', core: string, explode: THREE.Vector3) => {
      const p = this.addPart(name, V(-0.42, y), explode);
      const prof: [number, number][] = [
        [-0.2, 0.001],
        [-0.19, 0.05],
        [-0.16, 0.085],
        [-0.12, 0.095],
        [0.14, 0.095],
        [0.19, 0.06],
        [0.21, 0.04],
      ];
      this.mesh(p, revolveSolid(prof, 0.025, 64), this.mat('steel', true, '#e2e5ea'));
      for (const xr of [-0.1, 0.1]) {
        const ring = this.mesh(p, new THREE.TorusGeometry(0.125, 0.014, 10, 40), this.mat(tint, true));
        ring.rotation.y = Math.PI / 2;
        ring.position.x = xr;
      }
      const cm = new THREE.MeshBasicMaterial({ color: core, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      this.hotCores.push(cm);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.3, 24), cm);
      c.rotation.z = Math.PI / 2;
      p.group.add(c);
      return p;
    };
    makePre('preO', -0.62, 'o2', '#ff7a5a', V(0.35, -0.95, 1.1));
    makePre('preF', 0.62, 'ch4', '#ff4a2a', V(0.35, 0.95, 1.1));
  }

  /* ---------------- propellant paths ---------------- */
  /** Returns the path as segments; `pipe` > 0 means external plumbing of that radius is drawn. */
  pathSegments(key: 'oxygen' | 'methane') {
    const s = key === 'oxygen' ? -1 : 1;
    const { Rt } = GEOM;
    const segs: { pts: THREE.Vector3[]; pipe: number }[] = [];
    // tank inlet through the thrust block → pump
    segs.push({ pts: [V(-2.9, s * 1.05), V(-2.2, s * 0.98), V(WALL_X + 0.05, s * 0.86), V(-1.45, s * 0.7), V(-1.25, s * 0.58)], pipe: 0.055 });
    // through the pump (turbine side → impeller) and out the volute
    segs.push({ pts: [V(-1.12, s * 0.56), V(-0.9, s * 0.56), V(-0.78, s * 0.58)], pipe: 0 });
    if (key === 'oxygen') {
      segs.push({ pts: [V(-0.72, -0.63), V(-0.66, -0.63)], pipe: 0.04 });
    } else {
      // methane: over the top to the nozzle manifold, then back up the cooling channels
      segs.push({
        pts: [V(-0.74, 0.66), V(-0.55, 0.95), V(-0.1, 1.0), V(0.55, 0.95), V(1.1, 0.88), V(1.38, nozzleRadius(1.38) + 0.14)],
        pipe: 0.05,
      });
      const cool: THREE.Vector3[] = [];
      for (const x of [1.38, 1.15, 0.9, 0.65, 0.4, 0.2, 0.05, -0.08]) cool.push(V(x, (x > 0 ? nozzleRadius(x) : chamberRadius(x)) + 0.018, 0.012));
      segs.push({ pts: cool, pipe: 0 });
      segs.push({ pts: [V(-0.2, RC + 0.07), V(-0.15, 0.5), V(-0.2, 0.62)], pipe: 0.035 });
    }
    // through the preburner (right → left for methane, left → right for oxygen)
    if (key === 'oxygen') segs.push({ pts: [V(-0.6, -0.62), V(-0.42, -0.62), V(-0.24, -0.62)], pipe: 0 });
    else segs.push({ pts: [V(-0.24, 0.62), V(-0.42, 0.62), V(-0.6, 0.62)], pipe: 0 });
    // hot-gas duct into the injector dome
    if (key === 'oxygen') segs.push({ pts: [V(-0.16, -0.66), V(-0.1, -0.45), V(-0.5, -0.36), V(-0.84, -0.24), V(-0.92, -0.08)], pipe: 0.055 });
    else segs.push({ pts: [V(-0.66, 0.6), V(-0.8, 0.45), V(-0.9, 0.26), V(-0.92, 0.08)], pipe: 0.055 });
    // injector → chamber → throat → nozzle exit
    segs.push({ pts: [V(-0.8, s * 0.05), V(-0.5, s * 0.08), V(-0.2, s * 0.05), V(0, s * 0.012), V(0.6, s * 0.08), V(LB + 0.05, s * 0.14)], pipe: 0 });
    void Rt;
    return segs;
  }

  buildFlows() {
    const piping = this.addPart('piping', V(0, 0), V(0, 0, 1.5));
    const sprite = glowTex();
    for (const key of ['oxygen', 'methane'] as const) {
      const segs = this.pathSegments(key);
      const color = key === 'oxygen' ? O2 : CH4;
      // external plumbing (sectioned, so the cut shows a solid pipe wall)
      for (const sg of segs) {
        if (!sg.pipe) continue;
        const c = new THREE.CatmullRomCurve3(sg.pts, false, 'centripetal');
        this.mesh(piping, new THREE.TubeGeometry(c, 80, sg.pipe, 16, false), this.mat(key === 'oxygen' ? 'o2' : 'ch4', true, key === 'oxygen' ? '#a9c8f0' : '#e7b27f'));
      }
      // full path
      const all = segs.flatMap((sg) => sg.pts);
      const curve = new THREE.CatmullRomCurve3(all, false, 'centripetal', 0.3);
      const len = curve.getLength();
      const tubeMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color.clone() }, uTime: { value: 0 }, uSpeed: { value: 1.2 }, uRepeat: { value: len / 0.16 }, uOpacity: { value: 1 } },
        vertexShader: flowVert,
        fragmentShader: flowFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 600, 0.03, 10, false), tubeMat);
      tube.renderOrder = 2;
      this.scene.add(tube);
      // sparks running along the path
      const N = 90;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const pointsMat = new THREE.PointsMaterial({ size: 0.06, map: sprite, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const points = new THREE.Points(geo, pointsMat);
      points.frustumCulled = false;
      this.scene.add(points);
      const offsets = new Float32Array(N);
      for (let i = 0; i < N; i++) offsets[i] = i / N + Math.random() * 0.004;
      this.flows.push({ key, curve, tubeMat, tube, points, pointsMat, offsets });
    }
    // small instrumentation / purge lines for visual density
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    for (let k = 0; k < 16; k++) {
      const s = k % 2 ? 1 : -1;
      const a = V(rnd(-1.3, -0.7), s * rnd(0.2, 0.75), rnd(-0.25, 0.25));
      const b = V(rnd(-0.7, -0.1), s * rnd(0.3, 0.5), rnd(-0.3, 0.3));
      const mid = a.clone().lerp(b, 0.5).add(V(0, s * rnd(0.05, 0.25), rnd(-0.1, 0.1)));
      this.mesh(piping, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, mid, b]), 30, rnd(0.008, 0.016), 8, false), this.mat('steel', true));
    }
  }

  /* ---------------- plume ---------------- */
  buildPlume() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 72, 140, true);
    const mk = (core: boolean) => {
      const u = {
        uLen: { value: 8 },
        uRe: { value: GEOM.Re * (core ? 0.55 : 1) },
        uSpread: { value: 0 },
        uPinch: { value: 0 },
        uSpacing: { value: 1.5 },
        uRipple: { value: 0 },
        uTime: { value: 0 },
        uWiden: { value: core ? 0.3 : 1 },
        uIntensity: { value: 1 },
        uCore: { value: core ? 1 : 0 },
        uVac: { value: 0 },
        uColA: { value: new THREE.Color(core ? '#fff6e0' : '#ffb36b') },
        uColB: { value: new THREE.Color(core ? '#ff9a3c' : '#9b6bff') },
        uColC: { value: new THREE.Color(core ? '#ff5a2a' : '#3d2a9e') },
      };
      const m = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({ uniforms: u, vertexShader: plumeVert, fragmentShader: plumeFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      m.rotation.z = -Math.PI / 2;
      m.frustumCulled = false;
      this.plumeGroup.add(m);
      return u;
    };
    this.plumeUniformsOuter = mk(false);
    this.plumeUniformsCore = mk(true);
    this.plumeGroup.position.x = LB;
    const dt = diamondTex();
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dt, color: '#ffe2b8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.plumeGroup.add(s);
      this.diamonds.push(s);
    }
    this.lipGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffb46a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lipGlow.scale.set(1.3, 1.3, 1);
    this.plumeGroup.add(this.lipGlow);
    this.plumeLight = new THREE.PointLight('#ff9a4a', 10, 7, 2);
    this.plumeLight.position.set(0.6, 0.2, 0);
    this.plumeGroup.add(this.plumeLight);
    this.engineRoot.add(this.plumeGroup);
  }

  /* ---------------- public API ---------------- */
  setThrottle(t: number) {
    this.target.throttle = t;
    this.poke();
  }
  setAmbient(pa: number) {
    this.target.pa = pa;
    this.poke();
  }
  setView(v: ViewMode) {
    this.target.view = v;
    this.poke();
    if (v === 'exploded') this.flyTo(CAMS.exploded);
    else if (v === 'cutaway') this.flyTo(CAMS.cutaway);
  }
  setFollow(f: FollowMode) {
    this.target.follow = f;
    this.target.step = 0;
    this.poke();
    this.flyTo(f === 'oxygen' ? CAMS.oxygen : f === 'methane' ? CAMS.methane : f === 'fire' ? CAMS.fire : CAMS.home);
  }
  setStep(n: number) {
    this.target.step = n;
    this.poke();
    if (n > 0) this.flyTo(STEP_CAMS[n - 1]);
  }
  setPlaying(p: boolean) {
    this.playing = p;
  }
  resetCamera() {
    this.flyTo(CAMS.home);
  }
  poke() {
    this.lastInteraction = performance.now();
  }
  flyTo(to: CamPreset, dur = 1.3) {
    this.tween = { from: { pos: this.camera.position.clone(), target: this.controls.target.clone() }, to, t: 0, dur };
  }

  /* ---------------- animation ---------------- */
  loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.playing) this.time += dt;
    this.update(dt);
    this.composer.render();
  };

  update(dt: number) {
    const c = this.cur;
    const tg = this.target;
    c.throttle = damp(c.throttle, tg.throttle, 3, dt);
    this.state = engineState(c.throttle, tg.pa);
    const pv = plumeVisual(this.state);
    c.len = damp(c.len, pv.length, 2.5, dt);
    c.spread = damp(c.spread, (pv.spreadDeg * Math.PI) / 180, 2.5, dt);
    c.pinch = damp(c.pinch, pv.pinch, 2.5, dt);
    c.ripple = damp(c.ripple, pv.nDiamonds > 0 ? 0.1 * pv.diamondStrength : 0, 2.5, dt);
    c.spacing = damp(c.spacing, pv.spacing, 2.5, dt);
    c.intensity = damp(c.intensity, pv.intensity, 4, dt);
    c.vac = damp(c.vac, pv.vacuum, 2.5, dt);
    c.diamond = damp(c.diamond, pv.diamondStrength, 2.5, dt);
    c.nD = pv.nDiamonds;
    const step = tg.step;
    const f = tg.follow;
    // the tour opens the engine for the internal steps; following a propellant also opens it
    const wantCut = tg.view === 'cutaway' || step === 2 || step === 3 || (step === 0 && (f === 'oxygen' || f === 'methane'));
    c.cut = damp(c.cut, wantCut && tg.view !== 'exploded' ? 1 : 0, 3.2, dt);
    c.explode = damp(c.explode, tg.view === 'exploded' ? 1 : 0, 3.2, dt);
    const wantO = step === 0 ? (f === 'methane' ? 0.08 : f === 'fire' ? 0.15 : 1) : step === 4 ? 0.25 : 1;
    const wantF = step === 0 ? (f === 'oxygen' ? 0.08 : f === 'fire' ? 0.15 : 1) : step === 4 ? 0.25 : 1;
    c.flowO = damp(c.flowO, wantO, 4, dt);
    c.flowF = damp(c.flowF, wantF, 4, dt);

    const time = this.time;
    const flick = 0.85 + 0.15 * Math.sin(time * 31) * Math.sin(time * 13.7) + 0.05 * Math.sin(time * 71);

    // --- section plane: slides from in front of the engine to z = 0
    this.clipPlanes[0].constant = THREE.MathUtils.lerp(4, 0, easeInOut(c.cut));
    this.innerGlowMat.opacity = 0.45 * c.cut * c.intensity * flick * (1 - c.explode);
    this.innerGlow.visible = this.innerGlowMat.opacity > 0.01;
    for (const m of this.hotCores) m.opacity = (0.15 + 0.35 * c.cut) * c.intensity * flick;

    // --- spinning turbomachinery (rpm ∝ throttle)
    for (const r of this.spinners) if (this.playing) r.rotation.x += dt * 22 * c.throttle;

    // --- exploded
    const e = easeInOut(c.explode);
    for (const p of Object.values(this.parts)) p.group.position.copy(p.home).addScaledVector(p.explode, e);
    this.plumeGroup.position.x = LB + this.parts.nozzle.explode.x * e;
    c.spin = e > 0.02 ? c.spin + dt * 0.2 * e : damp(c.spin, Math.round(c.spin / (Math.PI * 2)) * Math.PI * 2, 2, dt);
    this.engineRoot.rotation.y = c.spin * 0.25 * Math.sin(time * 0.3) * e;
    this.plumeGroup.visible = e < 0.6;

    // --- highlight
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    const hl: Record<string, number> = {};
    if (step === 1) hl.piping = 1;
    if (step === 2) Object.assign(hl, { pumpO: 1, pumpF: 1, preO: 1, preF: 1 });
    if (step === 3) hl.chamber = 1;
    if (step === 4) hl.nozzle = 1;
    for (const p of Object.values(this.parts)) {
      p.highlight = damp(p.highlight, hl[p.name] ?? 0, 5, dt);
      for (const m of p.mats) m.emissiveIntensity = p.highlight * (0.05 + 0.13 * pulse);
    }

    // --- flows
    const on = c.throttle > 0.02 ? 1 : 0.15;
    for (const fl of this.flows) {
      const k = fl.key === 'oxygen' ? c.flowO : c.flowF;
      const vis = k * (1 - e) * on;
      fl.tubeMat.uniforms.uTime.value = time;
      fl.tubeMat.uniforms.uSpeed.value = 0.5 + 1.6 * c.throttle;
      fl.tubeMat.uniforms.uOpacity.value = 0.6 * vis;
      fl.pointsMat.opacity = 0.6 * vis;
      const pos = fl.points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const sp = 0.03 + 0.12 * c.throttle;
      for (let i = 0; i < fl.offsets.length; i++) {
        const p = fl.curve.getPointAt((fl.offsets[i] + time * sp) % 1);
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }
      pos.needsUpdate = true;
      fl.tube.visible = fl.points.visible = vis > 0.01;
    }

    // --- plume
    for (const u of [this.plumeUniformsOuter, this.plumeUniformsCore]) {
      const core = u.uCore.value > 0.5;
      u.uTime.value = time;
      u.uLen.value = Math.max(0.01, c.len * (core ? 0.55 - 0.2 * c.vac : 1));
      u.uSpread.value = c.spread * (core ? 0.4 : 1);
      u.uPinch.value = c.pinch;
      u.uRipple.value = c.ripple * (core ? 1.6 : 1);
      u.uSpacing.value = c.spacing;
      u.uIntensity.value = c.intensity * flick;
      u.uVac.value = c.vac;
    }
    for (let k = 0; k < this.diamonds.length; k++) {
      const d = this.diamonds[k];
      const m = d.material as THREE.SpriteMaterial;
      m.opacity = damp(m.opacity, 0.75 * (k < c.nD ? 1 : 0) * c.diamond * Math.pow(0.8, k) * c.intensity * (0.8 + 0.2 * flick), 4, dt);
      const x = (k + 1) * c.spacing - c.spacing * 0.1;
      d.position.set(x, 0, 0);
      const rLocal = GEOM.Re * (1 - c.pinch) + x * Math.tan(c.spread) * 0.6;
      d.scale.set(c.spacing * 0.45, Math.max(0.2, rLocal * 1.1), 1);
      d.visible = m.opacity > 0.01;
    }
    (this.lipGlow.material as THREE.SpriteMaterial).opacity = 0.35 * c.intensity * flick;
    this.plumeLight.intensity = 10 * c.intensity * flick;

    // --- camera
    if (this.tween) {
      this.tween.t += dt / this.tween.dur;
      const k = easeInOut(Math.min(1, this.tween.t));
      this.camera.position.lerpVectors(this.tween.from.pos, this.tween.to.pos, k);
      this.controls.target.lerpVectors(this.tween.from.target, this.tween.to.target, k);
      if (this.tween.t >= 1) this.tween = null;
    } else if (performance.now() - this.lastInteraction > 10000) {
      const off = this.camera.position.clone().sub(this.controls.target);
      const ang = Math.sin(time * 0.05) * 0.0006;
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      this.camera.position.copy(this.controls.target).add(off);
    }
    this.controls.update();

    this.frame++;
    if (this.frame % 2 === 0) this.emitOverlays();
  }

  anchor(partName: string, local: THREE.Vector3) {
    const p = this.parts[partName];
    return local.clone().add(p.group.position).applyEuler(this.engineRoot.rotation);
  }

  emitOverlays() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const f = this.target.follow;
    const step = this.target.step;
    const cut = this.cur.cut > 0.6;
    const ex = this.cur.explode > 0.5;
    type L = { id: string; text: string; sub?: string; world: THREE.Vector3; show: boolean; kind?: string; occlude?: boolean };
    const labels: L[] = [
      { id: 'pumpO', text: 'Oxygen turbopump', sub: 'liquid O₂ → hundreds of bar', world: this.anchor('pumpO', V(0.05, -0.24)), show: f === 'oxygen' || step === 2 || ex || cut, occlude: !cut },
      { id: 'pumpF', text: 'Methane turbopump', sub: 'fuel pump', world: this.anchor('pumpF', V(0.05, 0.24)), show: f === 'methane' || step === 2 || ex || cut, occlude: !cut },
      { id: 'preO', text: 'Preburner — oxygen-rich', sub: 'a trace of fuel burns to drive the O₂ turbine', world: this.anchor('preO', V(0.05, -0.16)), show: f === 'oxygen' || step === 2 || ex || cut, occlude: !cut },
      { id: 'preF', text: 'Preburner — methane-rich', sub: 'drives the methane turbine', world: this.anchor('preF', V(0.05, 0.16)), show: f === 'methane' || step === 2 || ex || cut, occlude: !cut },
      { id: 'turbine', text: 'Turbine', world: this.anchor('pumpO', V(-0.15, 0.02, 0.05)), show: cut && (step === 2 || f === 'oxygen'), kind: 'small' },
      { id: 'duct', text: 'Hot-gas duct', sub: 'turbine exhaust → injector', world: V(-0.62, 0.41, 0), show: cut && (f === 'methane' || step === 2), kind: 'small' },
      { id: 'inj', text: 'Injector', sub: 'coaxial elements mix O₂-rich and CH₄-rich gas', world: this.anchor('chamber', V(X_INJ + 0.08, 0.2)), show: cut && (step === 3 || f !== 'all' || this.target.view === 'cutaway'), kind: 'small' },
      { id: 'chamber', text: 'Main combustion chamber', sub: `p₀ ≈ ${Math.round(this.state.p0 / 1e5)} bar, T₀ ≈ 3600 K — the "reservoir"`, world: this.anchor('chamber', V(-0.45, RC + 0.06)), show: step === 3 || f === 'fire' || cut || ex },
      { id: 'throat', text: 'Throat — Mach 1', sub: 'choked: ṁ ∝ p₀', world: this.anchor('chamber', V(0, GEOM.Rt + 0.05)), show: step === 3 || cut, kind: 'small' },
      { id: 'cool', text: 'Cooling channels', sub: 'methane runs back up inside the wall', world: this.anchor('nozzle', V(0.75, nozzleRadius(0.75) + 0.02)), show: (cut && f !== 'oxygen') || step === 4, kind: 'small' },
      { id: 'exit', text: `Exit — Mach ${GEOM.Me.toFixed(1)}`, sub: `A_e/A_t = ${GEOM.AR.toFixed(1)}`, world: this.anchor('nozzle', V(LB, -GEOM.Re * 0.7)), show: step === 4 || f === 'fire' || cut || ex, kind: 'small' },
      { id: 'inlets', text: 'Propellant inlets', sub: 'from the tanks: liquid O₂ (blue) and methane (orange)', world: V(WALL_X + 0.1, 0.95, 0), show: step === 1 },
      { id: 'engine', text: 'Full-flow staged combustion', sub: 'every drop of propellant passes through a turbine', world: this.anchor('chamber', V(-0.5, 1.05)), show: f === 'fire' && step === 0 },
    ];
    for (let k = 0; k < Math.min(3, this.cur.nD); k++) {
      const d = this.diamonds[k];
      const wp = new THREE.Vector3();
      d.getWorldPosition(wp);
      wp.y += d.scale.y * 0.55;
      labels.push({ id: `d${k}`, text: 'Shock diamond', world: wp, show: (d.material as THREE.SpriteMaterial).opacity > 0.15 && this.plumeGroup.visible, kind: 'small' });
    }
    if (this.state.regime !== 'off') {
      const lipW = new THREE.Vector3(this.plumeGroup.position.x, GEOM.Re + 0.08, 0);
      const txt = this.state.regime === 'over' || this.state.regime === 'separated' ? 'Oblique shock at the lip' : this.state.regime === 'ideal' ? '' : 'Prandtl–Meyer fan at the lip';
      labels.push({ id: 'lip', text: txt, sub: `${this.state.lipAngle > 0 ? '+' : ''}${this.state.lipAngle.toFixed(1)}° turn`, world: lipW, show: !!txt && (f === 'fire' || step === 4), kind: 'small' });
    }

    const out: LabelOut[] = [];
    const camPos = this.camera.position;
    for (const L of labels) {
      const v = L.world.clone().project(this.camera);
      let visible = L.show && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      if (visible && L.occlude) {
        if (this.frame % 6 === 0) {
          const dir = L.world.clone().sub(camPos);
          const dist = dir.length();
          this.raycaster.set(camPos, dir.normalize());
          this.raycaster.far = dist - 0.1;
          this.occluded[L.id] = this.raycaster.intersectObjects(this.pickables, false).length > 0;
        }
        if (this.occluded[L.id]) visible = false;
      }
      out.push({ id: L.id, text: L.text, sub: L.sub, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible, kind: L.kind });
    }
    this.onLabels?.(out);

    const ticks: { x: number; y: number; label: string }[] = [];
    for (let m = -1; m <= 12; m++) {
      const p = new THREE.Vector3(m, FLOOR_Y, 1.6).project(this.camera);
      if (p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05) ticks.push({ x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, label: `${m} m` });
    }
    this.onRuler?.(ticks);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const CAMS: Record<string, CamPreset> = {
  home: { pos: V(-1.2, 1.1, 8.2), target: V(0.2, 0.1, 0) },
  cutaway: { pos: V(-0.1, 0.35, 5.2), target: V(-0.05, 0.05, 0) },
  oxygen: { pos: V(-0.55, -0.3, 3.3), target: V(-0.6, -0.4, 0) },
  methane: { pos: V(0.1, 0.9, 4.1), target: V(0.0, 0.45, 0) },
  fire: { pos: V(3.6, 0.9, 6.4), target: V(3.4, 0, 0) },
  exploded: { pos: V(1.2, 2.0, 9.0), target: V(0.1, 0.2, 0.5) },
};
const STEP_CAMS: CamPreset[] = [
  { pos: V(-1.2, 0.9, 4.6), target: V(-1.6, 0.1, 0) },
  { pos: V(-0.7, 0.15, 3.6), target: V(-0.7, 0, 0) },
  { pos: V(-0.35, 0.15, 2.8), target: V(-0.4, 0, 0) },
  { pos: V(2.2, 0.7, 5.4), target: V(2.0, 0, 0) },
];
