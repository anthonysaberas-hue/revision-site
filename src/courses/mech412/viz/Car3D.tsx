/**
 * Car3D — cruise control on a hilly road (PID tuner).  m v' = F − b v − m g sin(θ(x)).
 * Compare "fixed throttle" (open loop: the hill is a disturbance) with P / PI / PID feedback.
 * Illustrates L16 sensitivity, L17 type-0 vs type-1 offset, L19 PID.
 */
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Slider, Readout, SimFrame } from '../../../core/ui';
import { Studio3D, StudioCtx, box, cyl, metal, paint, label } from './Studio3D';
import { Controls, LabGrid, LiveChart, Trace, useLatest, useTick } from './LabKit';
import { advance, newPID, pidStep } from '../lib/plants';

const S = 0.25; // world units per metre

/** road grade θ(x) in radians: flat, climb, flat, descent, flat */
function gradeAt(x: number, steep: number) {
  if (x < 120) return 0;
  if (x < 300) return steep;
  if (x < 420) return 0;
  if (x < 600) return -steep;
  return 0;
}
function elevation(x: number, steep: number) {
  let h = 0;
  const dx = 2;
  for (let s = 0; s < x; s += dx) h += Math.tan(gradeAt(s, steep)) * dx;
  return h;
}

export function Car3D({ height = 360, title = 'Cruise control on a hill' }: { height?: number; title?: string }) {
  const [mode, setMode] = useState<'open' | 'P' | 'PI' | 'PID'>('PI');
  const [vset, setVset] = useState(25);
  const [Kp, setKp] = useState(800);
  const [Ki, setKi] = useState(250);
  const [Kd, setKd] = useState(0);
  const [steep, setSteep] = useState(5);
  const [mass, setMass] = useState(1500);
  const [running, setRunning] = useState(true);
  const [token, setToken] = useState(0);
  const P = useLatest({ mode, vset, Kp, Ki, Kd, steep, mass, running, token });
  const trace = useMemo(() => new Trace(['speed v (m/s)', 'set-point', 'throttle F/400'], 60), []);
  useTick(8);
  const b = 120;

  const setup = (ctx: StudioCtx) => {
    const { scene, controls } = ctx;
    const steepNow = (steep * Math.PI) / 180;
    // road ribbon
    const pts: THREE.Vector3[] = [];
    for (let x = 0; x <= 900; x += 4) pts.push(new THREE.Vector3(x * S, elevation(x, steepNow) * S, 0));
    const roadW = 1.6;
    const pos: number[] = [];
    const idx: number[] = [];
    pts.forEach((p, i) => {
      pos.push(p.x, p.y, -roadW / 2, p.x, p.y, roadW / 2);
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    const road = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: '#232a38', roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide }));
    road.receiveShadow = true;
    scene.add(road);
    // lane dashes and hill ground
    for (let x = 0; x < 900; x += 12) {
      const p0 = new THREE.Vector3(x * S, elevation(x, steepNow) * S + 0.004, 0);
      const d = box(1.0 * S * 4 * 0.5, 0.01, 0.05, paint('#e8edf5', 0.6), [p0.x + 0.5, p0.y + 0.005, 0]);
      d.rotation.z = Math.atan2(Math.tan(gradeAt(x, steepNow)), 1);
      scene.add(d);
    }
    const hillGeo = new THREE.BufferGeometry();
    const hp: number[] = [];
    const hi: number[] = [];
    pts.forEach((p, i) => {
      hp.push(p.x, p.y - 0.02, -roadW / 2 - 0.0, p.x, p.y - 0.02, -6, p.x, p.y - 0.02, roadW / 2, p.x, p.y - 0.02, 6);
      void hi;
    });
    void hillGeo;
    // under-road earth block
    const under = new THREE.Mesh(
      (() => {
        const g = new THREE.BufferGeometry();
        const v: number[] = [];
        const f: number[] = [];
        pts.forEach((p, i) => {
          v.push(p.x, p.y - 0.01, -3, p.x, p.y - 0.01, 3, p.x, -0.5, -3, p.x, -0.5, 3);
          if (i > 0) {
            const a = (i - 1) * 4;
            const c = i * 4;
            f.push(a + 0, a + 1, c + 0, a + 1, c + 1, c + 0); // top
            f.push(a + 1, a + 3, c + 1, a + 3, c + 3, c + 1); // +z side
            f.push(a + 2, a + 0, c + 2, a + 0, c + 0, c + 2); // -z side
          }
        });
        g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        g.setIndex(f);
        g.computeVertexNormals();
        return g;
      })(),
      new THREE.MeshStandardMaterial({ color: '#1d3a2c', roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    );
    scene.add(under);

    // car
    const car = new THREE.Group();
    const paintMat = new THREE.MeshPhysicalMaterial({ color: '#d63b3b', metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 });
    const bodyG = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.5), paintMat);
    bodyG.position.y = 0.2;
    bodyG.castShadow = true;
    car.add(bodyG);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.17, 0.44), new THREE.MeshPhysicalMaterial({ color: '#1b2a44', metalness: 0.2, roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.85 }));
    cabin.position.set(-0.05, 0.38, 0);
    car.add(cabin);
    const roof = box(0.46, 0.02, 0.42, paintMat, [-0.05, 0.475, 0]);
    car.add(roof);
    const wheels: THREE.Mesh[] = [];
    for (const wx of [-0.33, 0.33]) for (const wz of [-0.26, 0.26]) {
      const w = cyl(0.1, 0.1, 0.08, new THREE.MeshStandardMaterial({ color: '#15181f', roughness: 0.9 }), 28);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.1, wz);
      const hub = cyl(0.05, 0.05, 0.085, metal('#c9d0dc', 0.25), 16);
      hub.rotation.x = Math.PI / 2;
      w.add(hub);
      car.add(w);
      wheels.push(w);
    }
    for (const wz of [-0.18, 0.18]) car.add(box(0.03, 0.05, 0.1, new THREE.MeshStandardMaterial({ color: '#fff8c8', emissive: '#ffe8a0', emissiveIntensity: 1.2 }), [0.5, 0.22, wz]));
    scene.add(car);
    const lab = label('', 0.3);
    scene.add(lab);

    let st = [0, 0]; // v, x
    let tSim = 0;
    let acc = 0;
    let lastTok = -1;
    let pid = newPID();
    let thr = 0;
    controls.target.set(0, 0.5, 0);
    return {
      update: (dt: number) => {
        const p = P.current;
        if (p.token !== lastTok) {
          lastTok = p.token;
          st = [p.vset * 0.0, 0];
          tSim = 0;
          pid = newPID();
          trace.clear();
        }
        if (p.running) {
          const step = Math.min(dt, 0.033);
          const sNow = (p.steep * Math.PI) / 180;
          // controller (zero-order hold over the frame)
          const err = p.vset - st[0];
          if (p.mode === 'open') thr = b * p.vset;
          else thr = pidStep(pid, err, step, p.Kp, p.mode === 'P' ? 0 : p.Ki, p.mode === 'PID' ? p.Kd : 0, 20, 9000) + 0;
          if (p.mode === 'open') thr = Math.min(9000, thr);
          if (p.mode !== 'open') thr = Math.max(0, thr);
          const deriv = (s: number[]) => [(thr - b * s[0] - p.mass * 9.81 * Math.sin(gradeAt(s[1], sNow))) / p.mass, s[0]];
          st = advance((s) => deriv(s), st, tSim, step, 5e-3);
          tSim += step;
          acc += step;
          if (acc > 0.1) {
            acc = 0;
            trace.push(tSim, [st[0], p.vset, thr / 400]);
          }
          if (st[1] > 880) st = [st[0], 0];
        }
        const sNow = (P.current.steep * Math.PI) / 180;
        const x = st[1];
        const gr = gradeAt(x, sNow);
        car.position.set(x * S, elevation(x, sNow) * S, 0);
        car.rotation.z = gr;
        wheels.forEach((w) => (w.rotation.z -= st[0] * 0.35 * dt * 12));
        controls.target.lerp(new THREE.Vector3(car.position.x, car.position.y + 0.4, 0), 0.12);
        const cam = ctx.camera;
        const want = new THREE.Vector3(car.position.x - 1.0, car.position.y + 1.8, 4.0);
        cam.position.lerp(want, 0.06);
        lab.position.set(car.position.x, car.position.y + 1.2, 0);
      },
    };
  };

  useEffect(() => setToken((n) => n + 1), [mode, vset, Kp, Ki, Kd, steep, mass]);

  return (
    <SimFrame title={title} subtitle={<span>m v′ = F − b v − m g sin θ · F = PID(v_set − v)</span>}>
      <LabGrid
        left={
          <>
            <Studio3D key={steep} setup={setup} height={height} camera={[-1, 2.0, 4]} target={[0, 0.5, 0]} floor={false} caption="The car drives a road with a climb (from 120 m), a flat, then a descent. The slope is a disturbance force m g sin θ." />
            <Controls running={running} onToggle={() => setRunning((r) => !r)} onReset={() => setToken((n) => n + 1)}>
              {(['open', 'P', 'PI', 'PID'] as const).map((md) => (
                <button key={md} className={`btn ${mode === md ? 'primary' : ''}`} onClick={() => setMode(md)}>
                  {md === 'open' ? 'fixed throttle' : md}
                </button>
              ))}
            </Controls>
            <LiveChart trace={trace} yLabel="m/s" height={210} window={60} />
          </>
        }
        right={
          <>
            <Slider label="speed set-point" value={vset} min={10} max={35} step={1} onChange={setVset} unit=" m/s" />
            <Slider label="hill grade" value={steep} min={0} max={10} step={0.5} onChange={setSteep} unit="°" />
            <Slider label="car mass" value={mass} min={800} max={3000} step={50} onChange={setMass} unit=" kg" />
            <Slider label="K_p" value={Kp} min={0} max={3000} step={10} onChange={setKp} unit=" N/(m/s)" />
            {(mode === 'PI' || mode === 'PID') && <Slider label="K_i" value={Ki} min={0} max={800} step={5} onChange={setKi} />}
            {mode === 'PID' && <Slider label="K_d" value={Kd} min={0} max={800} step={5} onChange={setKd} />}
            <Readout
              items={[
                ['hill force m g sin θ', `${(mass * 9.81 * Math.sin((steep * Math.PI) / 180)).toFixed(0)} N`],
                ['open-loop speed on the hill', `${Math.max(0, vset - (mass * 9.81 * Math.sin((steep * Math.PI) / 180)) / b).toFixed(1)} m/s`],
                ['P-only offset', `${((mass * 9.81 * Math.sin((steep * Math.PI) / 180)) / (Kp + b)).toFixed(2)} m/s`],
                ['with integral action', 'offset → 0 (type 1)'],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}
