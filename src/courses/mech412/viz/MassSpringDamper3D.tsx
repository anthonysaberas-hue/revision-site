/**
 * MassSpringDamper3D — a steel cart on a rail, held to a wall by a real coil spring and an oil dashpot.
 * Position comes from an RK4 simulation of  m x'' + b x' + k x = F(t); the chart and the readouts use
 * the same numbers as the exam formulas (ζ, ω_n, OS, t_s).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Slider, Readout, SimFrame } from '../../../core/ui';
import { Studio3D, StudioCtx, box, cyl, makeDashpot, makeSpring, metal, paint, label } from './Studio3D';
import { Controls, LabGrid, LiveChart, Trace, useLatest, useTick } from './LabKit';
import { advance, msdDeriv, msdWn, msdZeta } from '../lib/plants';
import { osFromZeta } from '../lib/specs';

type Input = 'step' | 'sine' | 'pulse' | 'release';

export function MassSpringDamper3D({
  m: m0 = 1,
  b: b0 = 2,
  k: k0 = 25,
  input: in0 = 'step',
  height = 340,
  title = 'Mass–spring–damper workbench',
}: {
  m?: number;
  b?: number;
  k?: number;
  input?: Input;
  height?: number;
  title?: string;
}) {
  const [m, setM] = useState(m0);
  const [b, setB] = useState(b0);
  const [k, setK] = useState(k0);
  const [input, setInput] = useState<Input>(in0);
  const [F0, setF0] = useState(10);
  const [w, setW] = useState(4);
  const [running, setRunning] = useState(true);
  const [token, setToken] = useState(0);
  const P = useLatest({ m, b, k, input, F0, w, running, token });
  const trace = useMemo(() => new Trace(['x (m)', 'F/k (m)'], 40), []);
  useTick(8);

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const steel = metal('#9aa6b5', 0.35);
    const dark = metal('#4b5565', 0.45);
    const alu = metal('#d8dde6', 0.28);
    const wallX = -2.6;
    // rail
    scene.add(box(6.4, 0.12, 0.7, dark, [0.2, 0.06, 0]));
    for (let i = -3; i <= 3; i++) scene.add(box(0.04, 0.125, 0.72, steel, [0.2 + i * 0.9, 0.06, 0]));
    // wall block + bolts
    const wall = box(0.4, 1.6, 1.2, paint('#2b3345', 0.7, 0.3), [wallX - 0.2, 0.8, 0]);
    scene.add(wall);
    for (const dy of [0.3, 1.3]) for (const dz of [-0.4, 0.4]) {
      const bolt = cyl(0.05, 0.05, 0.06, steel, 6);
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(wallX + 0.01, dy, dz);
      scene.add(bolt);
    }
    // cart
    const cart = new THREE.Group();
    const body = box(0.9, 0.42, 0.6, alu, [0, 0.46, 0]);
    cart.add(body);
    const plate = box(0.94, 0.04, 0.64, metal('#ff9d3a', 0.4), [0, 0.69, 0]);
    cart.add(plate);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.3, 0.3]) {
      const wh = cyl(0.12, 0.12, 0.08, dark, 28);
      wh.rotation.x = Math.PI / 2;
      wh.position.set(sx, 0.18, sz);
      cart.add(wh);
    }
    const mLabel = label('m', 0.35);
    mLabel.position.set(0, 1.0, 0);
    cart.add(mLabel);
    scene.add(cart);
    // spring + dashpot
    const spring = makeSpring(0.13, 9, 0.022, metal('#c9d2de', 0.25), 1);
    const dash = makeDashpot(0.085, 0.8, metal('#2f6fd0', 0.35), metal('#e6ebf2', 0.2));
    spring.object.position.set(wallX, 0.62, 0.18);
    dash.object.position.set(wallX, 0.3, -0.12);
    scene.add(spring.object, dash.object);
    const kLab = label('k', 0.3);
    kLab.position.set(wallX + 1, 1.0, 0.18);
    const bLab = label('b', 0.3);
    bLab.position.set(wallX + 1, 0.0 + 0.05, -0.2);
    scene.add(kLab, bLab);
    // rest marker + ruler
    const restLine = box(0.015, 0.02, 1.0, metal('#ffd24a', 0.4), [0, 0.13, 0]);
    scene.add(restLine);
    for (let i = -10; i <= 10; i++) scene.add(box(0.008, 0.01, i % 5 === 0 ? 0.28 : 0.14, paint('#8fa2c4'), [i * 0.25, 0.126, 0.45]));
    // force arrow
    const arrow = new THREE.Group();
    const shaft = cyl(0.04, 0.04, 0.7, new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 0.9 }), 14);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = 0.35;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 20), shaft.material);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.8;
    arrow.add(shaft, head);
    scene.add(arrow);

    let sim = [0, 0];
    let tSim = 0;
    let sampleAcc = 0;
    let lastToken = -1;
    let scale = 1;
    const rest = -0.9; // world x of the cart centre at x = 0
    const force = (t: number) => {
      const p = P.current;
      if (p.input === 'step') return p.F0;
      if (p.input === 'sine') return p.F0 * Math.sin(p.w * t);
      if (p.input === 'pulse') return t < 0.5 ? p.F0 : 0;
      return 0;
    };

    return {
      update: (dt: number) => {
        const p = P.current;
        if (p.token !== lastToken) {
          lastToken = p.token;
          sim = p.input === 'release' ? [p.F0 / Math.max(p.k, 1e-6), 0] : [0, 0];
          tSim = 0;
          trace.clear();
        }
        const amp = Math.max(Math.abs(p.F0) / p.k, 1e-3);
        scale = 0.85 / (p.input === 'sine' ? amp * 1.3 : amp * 1.15);
        if (p.running) {
          const step = Math.min(dt, 0.033);
          sim = advance(msdDeriv({ m: p.m, b: p.b, k: p.k }, force), sim, tSim, step, 5e-4);
          tSim += step;
          sampleAcc += step;
          if (sampleAcc >= 0.03) {
            sampleAcc = 0;
            trace.push(tSim, [sim[0], p.input === 'step' ? p.F0 / p.k : 0]);
          }
        }
        const cx = rest + Math.max(-1.5, Math.min(1.6, sim[0] * scale));
        cart.position.x = cx;
        const sc = 0.82 + 0.1 * Math.sqrt(p.m);
        cart.scale.set(1, sc, 1);
        const left = cx - 0.45;
        const L = left - wallX;
        spring.setLength(L);
        dash.setLength(L);
        arrow.visible = p.input !== 'release' && Math.abs(force(tSim)) > 1e-6;
        const f = force(tSim);
        arrow.position.set(cx + 0.5, 0.58, 0);
        arrow.scale.set(Math.max(0.15, Math.min(2.2, Math.abs(f) / Math.max(1e-6, Math.abs(p.F0)))) * (f >= 0 ? 1 : -1), 1, 1);
        restLine.position.x = rest;
      },
    };
  };

  useEffect(() => setToken((n) => n + 1), [m, b, k, input, F0, w]);

  const wn = msdWn({ m, b, k });
  const zeta = msdZeta({ m, b, k });
  const os = osFromZeta(zeta);
  const ts = zeta > 0 ? 4 / (zeta * wn) : Infinity;
  const kind = zeta < 0.999 ? 'underdamped' : zeta < 1.001 ? 'critically damped' : 'overdamped';

  return (
    <SimFrame title={title} subtitle={<span>m x″ + b x′ + k x = F(t)</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={height} camera={[1.2, 2.0, 5.0]} target={[-0.6, 0.55, 0]} caption="Drag to orbit. The yellow line is the equilibrium position; the orange arrow is the applied force." />
            <Controls running={running} onToggle={() => setRunning((r) => !r)} onReset={() => setToken((n) => n + 1)}>
              {(['step', 'pulse', 'sine', 'release'] as Input[]).map((i) => (
                <button key={i} className={`btn ${input === i ? 'primary' : ''}`} onClick={() => setInput(i)}>
                  {i}
                </button>
              ))}
            </Controls>
            <TraceBox trace={trace} refK={input === 'step'} />
          </>
        }
        right={
          <>
            <Slider label="mass m" value={m} min={0.2} max={5} step={0.05} onChange={setM} unit=" kg" />
            <Slider label="damping b" value={b} min={0} max={30} step={0.1} onChange={setB} unit=" N·s/m" />
            <Slider label="stiffness k" value={k} min={2} max={200} step={1} onChange={setK} unit=" N/m" />
            <Slider label="force amplitude" value={F0} min={1} max={50} step={1} onChange={setF0} unit=" N" />
            {input === 'sine' && <Slider label="frequency" value={w} min={0.5} max={20} step={0.1} onChange={setW} unit=" rad/s" />}
            <Readout
              items={[
                ['ω_n = √(k/m)', `${wn.toFixed(2)} rad/s`],
                ['ζ = b/(2√(km))', zeta.toFixed(3)],
                ['regime', kind],
                ['overshoot', `${os.toFixed(1)} %`],
                ['t_s (2 %)', Number.isFinite(ts) ? `${ts.toFixed(2)} s` : '∞'],
                ['static deflection F/k', `${(F0 / k).toFixed(3)} m`],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}

function TraceBox({ trace, refK }: { trace: Trace; refK: boolean }) {
  return <LiveChart trace={trace} yLabel="x" show={refK ? [0, 1] : [0]} height={200} />;
}
