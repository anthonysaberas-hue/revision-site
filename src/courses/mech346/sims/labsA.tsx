/**
 * MECH 346 labs A: insulated pipe (critical radius), heat-sink fins, quenching of a solid.
 * Every number comes from the same lib functions the calculators and the exam solutions use.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Slider, Readout, SimFrame } from '../../../core/ui';
import { Plot } from '../../../core/Plot';
import { Studio3D, StudioCtx, box, cyl, metal, paint } from '../../mech412/viz/Studio3D';
import { Controls, LabGrid, LiveChart, Trace, useLatest, useTick } from '../../mech412/viz/LabKit';
import { heatColor, RadialSolver } from '../viz/heat';
import { f, range } from '../viz/Kit';
import { SOLIDS } from '../lib/props';
import { rCritCyl, insulatedPipeQ } from '../lib/conduction';
import { finProfileAdiabatic, rectFin, finAnalysis } from '../lib/fins';
import { oneTerm, thetaAt, biot } from '../lib/transient';

/* ---------- helper: a flat ring (annulus) extruded along z ---------- */
function ringMesh(ra: number, rb: number, len: number, mat: THREE.Material) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rb, 0, Math.PI * 2, false);
  if (ra > 1e-6) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, ra, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 56 });
  g.translate(0, 0, -len / 2);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ============================== PipeLab ============================== */
export function PipeLab() {
  const r1 = 0.025; // pipe outer radius (steel, thin)
  const [r2, setR2] = useState(0.068);
  const [kIns, setKIns] = useState(0.04);
  const [ho, setHo] = useState(15);
  const [Tin, setTin] = useState(200);
  const [Tair, setTair] = useState(20);
  const P = useLatest({ r2, kIns, ho, Tin, Tair });
  const [token, setToken] = useState(0);
  useEffect(() => setToken((n) => n + 1), [r2, kIns, ho, Tin, Tair]);
  const tokenRef = useLatest(token);

  const rcr = rCritCyl(kIns, ho);
  const q = insulatedPipeQ(Tin, Tair, r1, r2, kIns, ho, 1);
  const qBare = insulatedPipeQ(Tin, Tair, r1, r1, kIns, ho, 1);
  const Tsurf = Tair + q / (ho * 2 * Math.PI * r2);
  const rs = range(r1, 0.15, 90);
  const curve = rs.map((r) => ({ x: r * 100, y: insulatedPipeQ(Tin, Tair, r1, r, kIns, ho, 1) }));

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const holder = new THREE.Group();
    scene.add(holder);
    const len = 1.4;
    let last = -1;
    const S = 9; // world units per metre of radius (so a 15 cm radius is 1.35 units)
    const build = () => {
      holder.clear();
      const p = P.current;
      const qq = insulatedPipeQ(p.Tin, p.Tair, r1, p.r2, p.kIns, p.ho, 1);
      // steam core
      const core = new THREE.Mesh(new THREE.CylinderGeometry(r1 * S * 0.9, r1 * S * 0.9, len + 0.02, 40), new THREE.MeshStandardMaterial({ color: heatColor(1), emissive: heatColor(1), emissiveIntensity: 0.6 }));
      core.rotation.x = Math.PI / 2;
      holder.add(core);
      holder.add(ringMesh(r1 * S * 0.9, r1 * S, len, metal('#9aa6b5', 0.3)));
      // insulation: thin rings coloured by the local temperature
      const n = Math.max(3, Math.round((p.r2 - r1) / 0.004));
      for (let i = 0; i < n; i++) {
        const ra = r1 + ((p.r2 - r1) * i) / n;
        const rb = r1 + ((p.r2 - r1) * (i + 1)) / n;
        const rm = (ra + rb) / 2;
        const T = p.Tin - (qq * Math.log(rm / r1)) / (2 * Math.PI * p.kIns);
        const t01 = (T - p.Tair) / Math.max(p.Tin - p.Tair, 1);
        const mat = new THREE.MeshStandardMaterial({ color: heatColor(t01), roughness: 0.8, metalness: 0 });
        holder.add(ringMesh(ra * S, rb * S, len, mat));
      }
      // critical radius ring (thin dashed look)
      const rc = rCritCyl(p.kIns, p.ho);
      const crit = new THREE.Mesh(new THREE.TorusGeometry(Math.max(rc, r1) * S, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
      crit.position.z = len / 2 + 0.01;
      holder.add(crit);
      // heat arrows
      const al = Math.min(1.3, 0.25 + qq / 400);
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.06, al * 0.5, 12), new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 0.9 }));
        arrow.position.set(Math.cos(ang) * (p.r2 * S + al * 0.3 + 0.1), Math.sin(ang) * (p.r2 * S + al * 0.3 + 0.1), len / 2 + 0.05);
        arrow.rotation.z = ang - Math.PI / 2;
        holder.add(arrow);
      }
    };
    return {
      update: () => {
        if (tokenRef.current !== last) {
          last = tokenRef.current;
          build();
        }
        holder.rotation.y = -0.45;
        holder.position.set(0, 1.5, 0);
      },
    };
  };

  return (
    <SimFrame title="Insulated pipe: the critical radius" subtitle={<span>Q′ = (T_s − T_∞) / [ln(r₂/r₁)/2πk + 1/(h·2πr₂)]</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={340} camera={[0, 1.7, 5.4]} target={[0, 1.5, 0]} floor={false} caption="Cross-section of a steam pipe. Rings are coloured by temperature (red = steam, blue = air); the white circle marks the critical radius k/h." />
            <Plot
              x={[curve[0].x, curve[curve.length - 1].x]}
              y={[0, Math.max(...curve.map((c) => c.y)) * 1.1]}
              series={[{ points: curve, color: 'var(--c1)', label: "Q′ vs outer radius (W/m)" }]}
              vlines={[{ x: rcr * 100, dash: true, label: 'r_cr = k/h' }, { x: r2 * 100, label: 'now', color: 'var(--c3)' }]}
              dots={[{ x: r2 * 100, y: q }]}
              height={230}
              xLabel="outer radius of the insulation (cm)"
              yLabel="Q′ (W/m)"
            />
          </>
        }
        right={
          <>
            <Slider label="outer radius r₂" value={r2} min={0.026} max={0.15} step={0.001} onChange={setR2} format={(v) => (v * 100).toFixed(1)} unit=" cm" />
            <Slider label="insulation k" value={kIns} min={0.02} max={1} step={0.005} onChange={setKIns} unit=" W/mK" />
            <Slider label="outside h" value={ho} min={3} max={100} step={1} onChange={setHo} unit=" W/m²K" />
            <Slider label="steam temperature" value={Tin} min={60} max={400} step={5} onChange={setTin} unit=" °C" />
            <Slider label="air temperature" value={Tair} min={-20} max={40} step={1} onChange={setTair} unit=" °C" />
            <Readout
              items={[
                ['Q′ now', `${f(q)} W/m`],
                ['bare pipe', `${f(qBare)} W/m`],
                ['critical radius k/h', `${f(rcr * 100, 3)} cm`],
                ['outer surface T', `${f(Tsurf, 4)} °C`],
                ['saving', `${f((100 * (qBare - q)) / qBare, 3)} %`],
              ]}
            />
            <p style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Try k = 1 W/mK (a poor insulator, r_cr = 6.7 cm): thin coats *increase* the loss until r₂ passes the critical radius.</p>
          </>
        }
      />
    </SimFrame>
  );
}

/* ============================== FinLab ============================== */
const FIN_MATS: [string, number][] = [
  ['aluminum', 237],
  ['copper', 401],
  ['steel (54)', 54],
  ['stainless (15)', 15],
];
export function FinLab() {
  const [N, setN] = useState(9);
  const [H, setH] = useState(0.025);
  const [t, setT] = useState(0.0015);
  const [mi, setMi] = useState(0);
  const [h, setH2] = useState(45);
  const [Tb, setTb] = useState(70);
  const [Tinf, setTinf] = useState(30);
  const k = FIN_MATS[mi][1];
  const Wb = 0.1; // base width (m)
  const D = 0.06; // depth (m, along the fin length direction z)
  const [token, setToken] = useState(0);
  useEffect(() => setToken((n) => n + 1), [N, H, t, mi, h, Tb, Tinf]);
  const P = useLatest({ N, H, t, k, h, Tb, Tinf, token });

  const g = rectFin(D, t, H);
  const m = Math.sqrt((2 * h) / (k * t));
  const Lc = H + t / 2;
  const eta = Math.tanh(m * Lc) / (m * Lc);
  const Afin = N * 2 * D * Lc;
  const Aunf = Wb * D - N * t * D;
  const Qtot = h * (Tb - Tinf) * (eta * Afin + Aunf);
  const Rsink = (Tb - Tinf) / Qtot;
  const Qbare = h * Wb * D * (Tb - Tinf);
  const Qad = finAnalysis(g, k, h, Tb, Tinf, 'adiabatic').Q;
  void Qad;
  const xs = range(0, H, 40);
  const prof = xs.map((x) => ({ x: x * 100, y: finProfileAdiabatic({ ...g, P: 2 * (D + t) }, k, h, Tb, Tinf, x) }));
  const Hs = range(0.005, 0.1, 60);
  const Qh = Hs.map((hh) => {
    const mm = Math.sqrt((2 * h) / (k * t));
    const lc = hh + t / 2;
    const e = Math.tanh(mm * lc) / (mm * lc);
    return { x: hh * 100, y: h * (Tb - Tinf) * (e * N * 2 * D * lc + Aunf) };
  });

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const holder = new THREE.Group();
    scene.add(holder);
    let last = -1;
    const S = 10;
    const build = () => {
      holder.clear();
      const p = P.current;
      const mm = Math.sqrt((2 * p.h) / (p.k * p.t));
      const base = box(Wb * S, 0.18, D * S, metal('#aeb8c6', 0.3), [0, 0.09, 0]);
      holder.add(base);
      const segs = 14;
      const pitch = (Wb - p.t) / Math.max(1, p.N - 1);
      for (let i = 0; i < p.N; i++) {
        const xx = p.N === 1 ? 0 : -Wb / 2 + p.t / 2 + i * pitch;
        for (let j = 0; j < segs; j++) {
          const y0 = (p.H * j) / segs;
          const y1 = (p.H * (j + 1)) / segs;
          const T = p.Tinf + ((p.Tb - p.Tinf) * Math.cosh(mm * (p.H - (y0 + y1) / 2))) / Math.cosh(mm * p.H);
          const col = heatColor((T - p.Tinf) / Math.max(p.Tb - p.Tinf, 1e-6));
          const seg = box(p.t * S, (y1 - y0) * S + 0.002, D * S, new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.4 }), [xx * S, 0.18 + ((y0 + y1) / 2) * S, 0]);
          holder.add(seg);
        }
      }
      // transistor (TO-220 look) under the base
      holder.add(box(0.5, 0.16, 0.7, paint('#15181f', 0.6, 0.1), [0, -0.0, 0]));
    };
    return {
      update: () => {
        if (P.current.token !== last) {
          last = P.current.token;
          build();
        }
        holder.position.y = 0.2;
      },
    };
  };

  return (
    <SimFrame title="Heat-sink fin lab" subtitle={<span>η = tanh(mL_c)/(mL_c), Q = hθ_b(ηA_fin + A_base)</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={320} camera={[1.6, 2.2, 2.6]} target={[0, 0.5, 0]} caption="Fins coloured by temperature: bright (hot) at the base, darker toward the tip. A long thin fin wastes its outer metal." />
            <Plot x={[0, H * 100]} y={[Math.min(Tinf, Tb) - 1, Math.max(Tinf, Tb) + 1]} series={[{ points: prof, color: 'var(--c1)', label: 'T(x) along a fin' }]} height={200} xLabel="distance from the base (cm)" yLabel="T (°C)" />
            <Plot x={[0.5, 10]} y={[0, Math.max(...Qh.map((q) => q.y)) * 1.05]} series={[{ points: Qh, color: 'var(--c2)', label: 'Q vs fin height' }]} vlines={[{ x: H * 100, dash: true, label: 'now' }]} height={200} xLabel="fin height (cm)" yLabel="Q (W)" />
          </>
        }
        right={
          <>
            <Slider label="number of fins" value={N} min={2} max={20} step={1} onChange={setN} />
            <Slider label="fin height" value={H} min={0.005} max={0.1} step={0.0005} onChange={setH} format={(v) => (v * 100).toFixed(1)} unit=" cm" />
            <Slider label="fin thickness" value={t} min={0.0005} max={0.004} step={0.00005} onChange={setT} format={(v) => (v * 1000).toFixed(2)} unit=" mm" />
            <div className="slider">
              <label>
                <span>material</span>
                <b>{FIN_MATS[mi][0]}</b>
              </label>
              <input type="range" min={0} max={FIN_MATS.length - 1} step={1} value={mi} onChange={(e) => setMi(parseInt(e.target.value, 10))} />
            </div>
            <Slider label="h (air flow)" value={h} min={5} max={200} step={1} onChange={setH2} unit=" W/m²K" />
            <Slider label="base temperature" value={Tb} min={40} max={150} step={1} onChange={setTb} unit=" °C" />
            <Readout
              items={[
                ['m', `${f(m)} 1/m`],
                ['mL_c', f(m * Lc, 3)],
                ['efficiency η', f(eta, 3)],
                ['Q total', `${f(Qtot)} W`],
                ['R sink', `${f(Rsink, 4)} K/W`],
                ['vs bare base', `×${f(Qtot / Qbare, 3)}`],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}

/* ============================== QuenchLab ============================== */
type Shape = 'sphere' | 'cylinder' | 'wall';
export function QuenchLab() {
  const [shape, setShape] = useState<Shape>('sphere');
  const [matKey, setMatKey] = useState<keyof typeof SOLIDS>('carbonSteel');
  const [R, setR] = useState(0.05);
  const [h, setH] = useState(500);
  const [Ti, setTi] = useState(600);
  const [Tinf, setTinf] = useState(40);
  const [speed, setSpeed] = useState(20);
  const [running, setRunning] = useState(true);
  const [token, setToken] = useState(0);
  const mat = SOLIDS[matKey];
  const alpha = mat.k / (mat.rho * mat.cp);
  const P = useLatest({ shape, R, h, Ti, Tinf, speed, running, token, mat, alpha });
  const trace = useMemo(() => new Trace(['centre', 'surface', 'lumped'], 4000), []);
  useTick(8);
  useEffect(() => setToken((n) => n + 1), [shape, matKey, R, h, Ti, Tinf]);

  const Lcc = shape === 'wall' ? R : shape === 'cylinder' ? R / 2 : R / 3;
  const BiL = biot(h, Lcc, mat.k);
  const Bi = biot(h, R, mat.k);
  const tau = (rho: number, cp: number) => (rho * cp * Lcc) / h;
  const tauL = tau(mat.rho, mat.cp);
  const tEnd = Math.max(5 * (R * R) / alpha, 2 * tauL);

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const hot = new THREE.MeshStandardMaterial({ color: heatColor(1), roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Group();
    scene.add(body);
    let solver: RadialSolver | null = null;
    let last = -1;
    let simT = 0;
    let acc = 0;
    // slice disc with canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const tex = new THREE.CanvasTexture(canvas);
    const slice = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), new THREE.MeshBasicMaterial({ map: tex }));
    slice.position.set(2.3, 1.4, 0);
    scene.add(slice);
    const sliceBar = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.12), new THREE.MeshBasicMaterial({ color: '#8fa2c4' }));
    sliceBar.position.set(2.3, 0.0 + 0.0, 0);
    let wallSlab: THREE.Mesh | null = null;
    const rebuild = () => {
      const p = P.current;
      body.clear();
      if (wallSlab) {
        scene.remove(wallSlab);
        wallSlab = null;
      }
      let geo: THREE.BufferGeometry;
      if (p.shape === 'sphere') geo = new THREE.SphereGeometry(1.0, 48, 32);
      else if (p.shape === 'cylinder') geo = new THREE.CylinderGeometry(0.9, 0.9, 2.4, 48);
      else geo = new THREE.BoxGeometry(0.7, 2.0, 2.0);
      const m = new THREE.Mesh(geo, hot.clone());
      m.position.y = 1.4;
      m.castShadow = true;
      body.add(m);
      (body as THREE.Group & { mesh?: THREE.Mesh }).mesh = m;
      solver = new RadialSolver(p.shape, 60, p.R, p.alpha, p.mat.k, p.h, p.Ti, p.Tinf);
      simT = 0;
      trace.clear();
    };
    const paintSlice = () => {
      if (!solver) return;
      const p = P.current;
      const ctx2 = canvas.getContext('2d')!;
      const img = ctx2.createImageData(256, 256);
      const col = new THREE.Color();
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 256; x++) {
          const dx = (x - 127.5) / 127.5;
          const dy = (y - 127.5) / 127.5;
          const rr = p.shape === 'wall' ? Math.abs(dx) : Math.hypot(dx, dy);
          const i = (y * 256 + x) * 4;
          if (rr > 1) {
            img.data[i + 3] = 0;
            continue;
          }
          const idx = Math.min(solver.n - 1, Math.round(rr * (solver.n - 1)));
          heatColor((solver.T[idx] - p.Tinf) / Math.max(p.Ti - p.Tinf, 1e-6), col);
          img.data[i] = col.r * 255;
          img.data[i + 1] = col.g * 255;
          img.data[i + 2] = col.b * 255;
          img.data[i + 3] = 255;
        }
      ctx2.putImageData(img, 0, 0);
      tex.needsUpdate = true;
    };
    return {
      update: (dt: number) => {
        const p = P.current;
        if (p.token !== last) {
          last = p.token;
          rebuild();
          paintSlice();
        }
        if (!solver) return;
        if (p.running && simT < tEndRef.current) {
          const step = dt * p.speed;
          solver.advance(step, Math.max(0.02, (p.R * p.R) / p.alpha / 400));
          simT += step;
          acc += dt;
          if (acc > 0.05) {
            acc = 0;
            const Tc = solver.T[0];
            const Ts = solver.T[solver.n - 1];
            const Lc = p.shape === 'wall' ? p.R : p.shape === 'cylinder' ? p.R / 2 : p.R / 3;
            const bL = p.h / (p.mat.rho * p.mat.cp * Lc);
            trace.push(simT, [Tc, Ts, p.Tinf + (p.Ti - p.Tinf) * Math.exp(-bL * simT)]);
            paintSlice();
          }
        }
        const mesh = (body as THREE.Group & { mesh?: THREE.Mesh }).mesh;
        if (mesh) {
          const t01 = (solver.T[solver.n - 1] - p.Tinf) / Math.max(p.Ti - p.Tinf, 1e-6);
          (mesh.material as THREE.MeshStandardMaterial).color.copy(heatColor(t01));
          (mesh.material as THREE.MeshStandardMaterial).emissive.copy(heatColor(t01)).multiplyScalar(0.25);
          body.rotation.y += dt * 0.3;
        }
      },
    };
  };
  const tEndRef = useLatest(tEnd);

  // analytic one-term values for the readout at the current simulated time (last trace point)
  const n = trace.t.length;
  const tNow = n ? trace.t[n - 1] : 0;
  const Fo = (alpha * tNow) / (R * R);
  const o = oneTerm(shape === 'wall' ? 'wall' : shape, Bi, Fo);
  const Tc1 = Tinf + (Ti - Tinf) * o.theta0;
  const Ts1 = Tinf + (Ti - Tinf) * thetaAt(shape === 'wall' ? 'wall' : shape, o, 1);

  return (
    <SimFrame title="Quenching lab: Bi and Fo in action" subtitle={<span>implicit finite-difference solution of the conduction equation, compared with the lumped model and the one-term formula</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={320} camera={[1.2, 2.2, 6.2]} target={[1.1, 1.4, 0]} caption="Left: the body coloured by its surface temperature. Right: a cut through the centre (centre of the disc = centre of the body)." />
            <Controls running={running} onToggle={() => setRunning((r) => !r)} onReset={() => setToken((x) => x + 1)}>
              {(['sphere', 'cylinder', 'wall'] as Shape[]).map((s) => (
                <button key={s} className={`btn ${shape === s ? 'primary' : ''}`} onClick={() => setShape(s)}>
                  {s}
                </button>
              ))}
            </Controls>
            <LiveChart trace={trace} window={Math.max(10, tEnd)} height={230} yLabel="T (°C)" />
          </>
        }
        right={
          <>
            <div className="slider">
              <label>
                <span>material</span>
                <b>{matKey}</b>
              </label>
              <input type="range" min={0} max={Object.keys(SOLIDS).length - 1} step={1} value={Object.keys(SOLIDS).indexOf(matKey)} onChange={(e) => setMatKey(Object.keys(SOLIDS)[parseInt(e.target.value, 10)] as keyof typeof SOLIDS)} />
            </div>
            <Slider label="radius / half-thickness" value={R} min={0.005} max={0.2} step={0.001} onChange={setR} format={(v) => (v * 100).toFixed(1)} unit=" cm" />
            <Slider label="h" value={h} min={5} max={5000} step={5} onChange={setH} unit=" W/m²K" />
            <Slider label="initial T" value={Ti} min={100} max={1000} step={10} onChange={setTi} unit=" °C" />
            <Slider label="fluid T" value={Tinf} min={0} max={100} step={1} onChange={setTinf} unit=" °C" />
            <Slider label="playback speed" value={speed} min={1} max={200} step={1} onChange={setSpeed} unit="×" />
            <Readout
              items={[
                ['Bi (Lc = V/As)', f(BiL, 3)],
                ['lumped valid?', BiL <= 0.1 ? 'yes' : 'no: use one-term'],
                ['α', `${f(alpha, 3)} m²/s`],
                ['t (simulated)', `${f(tNow, 4)} s`],
                ['Fo', f(Fo, 3)],
                ['one-term centre / surface', Fo > 0.2 ? `${f(Tc1, 4)} / ${f(Ts1, 4)} °C` : 'Fo < 0.2 (not valid yet)'],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}

// avoid unused-import lint noise for helpers kept for future labs
void cyl;
void useRef;
