/**
 * Studio3D — shared Three.js host for the MECH 412 hardware visuals.
 * Dark studio look (same as the MECH 430 engine lab): PBR metal under a RoomEnvironment, blue rim light,
 * soft floor, orbit controls, pauses when off-screen. A component passes `setup`, which builds meshes and
 * returns an `update(dt)` callback; parameters are read from refs so sliders never rebuild the scene.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface StudioCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
}
export interface StudioHandle {
  update: (dt: number, t: number) => void;
  dispose?: () => void;
}

export function Studio3D({
  setup,
  height = 360,
  camera = [3.2, 2.2, 4.2],
  target = [0, 0.6, 0],
  fov = 38,
  floor = true,
  caption,
}: {
  setup: (ctx: StudioCtx) => StudioHandle;
  height?: number;
  camera?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  floor?: boolean;
  caption?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      el.textContent = 'WebGL is not available in this browser.';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070a12');
    scene.fog = new THREE.Fog('#070a12', 14, 30);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const cam = new THREE.PerspectiveCamera(fov, 1, 0.05, 100);
    cam.position.set(...camera);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.target.set(...target);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.minDistance = 1.2;
    controls.maxDistance = 14;
    controls.update();

    const key = new THREE.DirectionalLight('#fff4e6', 2.2);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#4f8dff', 1.6);
    rim.position.set(-4, 2.5, -3);
    scene.add(rim);
    scene.add(new THREE.AmbientLight('#8da2c8', 0.35));

    if (floor) {
      const g = new THREE.Mesh(
        new THREE.CircleGeometry(9, 64),
        new THREE.MeshStandardMaterial({ color: '#0c111d', metalness: 0.6, roughness: 0.55 }),
      );
      g.rotation.x = -Math.PI / 2;
      g.position.y = -0.001;
      g.receiveShadow = true;
      scene.add(g);
      const grid = new THREE.GridHelper(18, 36, '#1d2a44', '#111a2d');
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.5;
      scene.add(grid);
    }

    const handle = setupRef.current({ scene, camera: cam, renderer, controls });

    const resize = () => {
      const w = el.clientWidth || 600;
      const h = el.clientHeight || height;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    let raf = 0;
    let last = performance.now();
    let t = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      t += dt;
      handle.update(dt, t);
      controls.update();
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      handle.dispose?.();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <figure className="studio3d" style={{ margin: '1rem 0' }}>
      <div ref={host} style={{ height, width: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: '#070a12' }} />
      {caption && <figcaption style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 4 }}>{caption}</figcaption>}
    </figure>
  );
}

/* ---------------- material + geometry helpers ---------------- */
export const metal = (color = '#b8c2cf', roughness = 0.32, metalness = 1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const paint = (color: string, roughness = 0.5, metalness = 0.15) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const glass = (color = '#7fb7ff', opacity = 0.35) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness: 0, transmission: 0.6, transparent: true, opacity, thickness: 0.05 });

export function box(w: number, h: number, d: number, mat: THREE.Material, pos?: [number, number, number]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (pos) m.position.set(...pos);
  return m;
}
export function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 40) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A helical coil spring along +x from 0 to L. Call setLength(L) each frame (cheap: only rebuilds when changed). */
export function makeSpring(radius: number, coils: number, wire: number, mat: THREE.Material, L0 = 1) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.castShadow = true;
  g.add(mesh);
  let cur = -1;
  const build = (L: number) => {
    const lead = Math.min(0.06 * L, 0.12); // straight end tails
    const pts: THREE.Vector3[] = [];
    const N = coils * 28;
    pts.push(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = u * coils * 2 * Math.PI;
      pts.push(new THREE.Vector3(lead + u * (L - 2 * lead), Math.cos(a) * radius, Math.sin(a) * radius));
    }
    pts.push(new THREE.Vector3(L, 0, 0));
    mesh.geometry.dispose();
    mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, wire, 8, false);
  };
  build(L0);
  cur = L0;
  return {
    object: g,
    setLength(L: number) {
      if (Math.abs(L - cur) > 0.002) {
        build(Math.max(L, 0.05));
        cur = L;
      }
    },
  };
}

/** Dashpot along +x: a cylinder body of fixed length and a rod that slides in. setLength(L) = total end-to-end length. */
export function makeDashpot(radius: number, bodyLen: number, mat: THREE.Material, rodMat: THREE.Material) {
  const g = new THREE.Group();
  const body = cyl(radius, radius, bodyLen, mat);
  body.rotation.z = Math.PI / 2;
  body.position.x = bodyLen / 2;
  const cap = cyl(radius * 1.08, radius * 1.08, 0.03, mat);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = bodyLen;
  const rod = cyl(radius * 0.32, radius * 0.32, 1, rodMat, 20);
  rod.rotation.z = Math.PI / 2;
  g.add(body, cap, rod);
  return {
    object: g,
    setLength(L: number) {
      const rodLen = Math.max(0.02, L - bodyLen);
      rod.scale.y = rodLen;
      rod.position.x = bodyLen + rodLen / 2;
    },
  };
}

/** Floating text label sprite */
export function label(text: string, scale = 0.6, color = '#cfe0ff') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(8,12,22,.72)';
  x.beginPath();
  x.roundRect(4, 20, 504, 88, 18);
  x.fill();
  x.fillStyle = color;
  x.font = '600 46px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(scale * 4, scale, 1);
  s.renderOrder = 10;
  return s;
}
