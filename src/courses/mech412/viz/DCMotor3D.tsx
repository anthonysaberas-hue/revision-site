/**
 * DCMotor3D — cut-away permanent-magnet DC motor driving a flywheel through a shaft, with a tachometer disc.
 * Physics (RK4): L_a di/dt = v − R_a i − K ω ;  J dω/dt = K i − B ω − T_L.   Optional tach feedback v = K_p(ω_ref − ω).
 */
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Slider, Readout, SimFrame } from '../../../core/ui';
import { Studio3D, StudioCtx, box, cyl, metal, paint, label } from './Studio3D';
import { Controls, LabGrid, LiveChart, Trace, useLatest, useTick } from './LabKit';
import { advance, motorDeriv, motorDcGain } from '../lib/plants';
import { roots } from '../lib/poly';

type Drive = 'step' | 'square' | 'sine';

export function DCMotor3D({ height = 340, title = 'DC motor servo lab', closedLoop: cl0 = false }: { height?: number; title?: string; closedLoop?: boolean }) {
  const [Ra, setRa] = useState(0.6);
  const [LaMs, setLa] = useState(2);
  const [J, setJ] = useState(2);
  const [B, setB] = useState(0.7);
  const [Kt, setKt] = useState(0.04);
  const [V, setV] = useState(12);
  const [drive, setDrive] = useState<Drive>('step');
  const [TL, setTL] = useState(0);
  const [closed, setClosed] = useState(cl0);
  const [Kp, setKp] = useState(2);
  const [running, setRunning] = useState(true);
  const [token, setToken] = useState(0);
  const P = useLatest({ Ra, La: LaMs * 1e-3, J: J * 1e-5, B: B * 1e-5, Kt, V, drive, TL, closed, Kp, running, token });
  const trace = useMemo(() => new Trace(['ω (rad/s)', 'i (A) ×10', 'v (V)'], 30), []);
  useTick(8);

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const housingMat = new THREE.MeshStandardMaterial({ color: '#7b8ba3', metalness: 1, roughness: 0.38, side: THREE.DoubleSide });
    const steel = metal('#aab4c2', 0.3);
    const copper = metal('#c8793a', 0.3);
    const R = 0.62;
    const len = 1.5;
    const motor = new THREE.Group();
    motor.position.set(-0.9, 0.95, 0);
    scene.add(motor);
    // cut-away housing (open wedge facing the camera at +z/+y)
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 64, 1, true, Math.PI * 0.72, Math.PI * 1.56), housingMat);
    shell.rotation.z = Math.PI / 2;
    shell.castShadow = true;
    motor.add(shell);
    // end caps
    for (const s of [-1, 1]) {
      const cap = cyl(R, R, 0.1, metal('#5d6b82', 0.4), 64);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = s * (len / 2 + 0.05);
      motor.add(cap);
    }
    // magnets (N red, S blue)
    const mag = (c: string, a0: number) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(R - 0.02, R - 0.02, len * 0.7, 32, 1, true, a0, 0.9),
        new THREE.MeshStandardMaterial({ color: c, metalness: 0.4, roughness: 0.45, side: THREE.DoubleSide }),
      );
      m.rotation.z = Math.PI / 2;
      return m;
    };
    const nM = mag('#d63b3b', Math.PI * 1.2);
    const sM = mag('#2f6fe0', Math.PI * 0.1);
    motor.add(nM, sM);
    // armature (rotates about x)
    const arm = new THREE.Group();
    motor.add(arm);
    const core = cyl(0.36, 0.36, len * 0.62, steel, 40);
    core.rotation.z = Math.PI / 2;
    arm.add(core);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const slot = box(len * 0.64, 0.1, 0.06, copper);
      slot.position.set(0, Math.cos(a) * 0.37, Math.sin(a) * 0.37);
      slot.rotation.x = a;
      arm.add(slot);
    }
    const shaft = cyl(0.07, 0.07, 4.2, metal('#e2e8f2', 0.15), 24);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = 1.25;
    arm.add(shaft);
    // commutator + brushes (static)
    const comm = cyl(0.17, 0.17, 0.2, metal('#d4a24a', 0.28), 36);
    comm.rotation.z = Math.PI / 2;
    comm.position.x = -len * 0.44;
    arm.add(comm);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const seg = box(0.2, 0.012, 0.04, metal('#8a6a2a'));
      seg.position.set(-len * 0.44, Math.cos(a) * 0.175, Math.sin(a) * 0.175);
      seg.rotation.x = a;
      arm.add(seg);
    }
    for (const s of [-1, 1]) {
      const br = box(0.16, 0.14, 0.1, paint('#222a38', 0.8));
      br.position.set(-len * 0.44 - 0.0, s * 0.27, 0);
      motor.add(br);
    }
    // flywheel (rotates) at the load end
    const wheel = new THREE.Group();
    wheel.position.set(1.35, 0.95, 0);
    scene.add(wheel);
    const disc = cyl(0.62, 0.62, 0.16, metal('#c4ccd8', 0.3), 72);
    disc.rotation.z = Math.PI / 2;
    wheel.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 16, 72), metal('#e0e6ef', 0.2));
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const hole = cyl(0.09, 0.09, 0.18, metal('#10151f', 0.9), 20);
      hole.rotation.z = Math.PI / 2;
      hole.position.set(0, Math.cos(a) * 0.38, Math.sin(a) * 0.38);
      wheel.add(hole);
    }
    const mark = box(0.2, 0.34, 0.07, new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 0.8 }), [0.0, 0.42, 0]);
    wheel.add(mark);
    // brake caliper for the load torque (glows with T_L)
    const caliper = box(0.3, 0.12, 0.26, new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff0000', emissiveIntensity: 0 }), [1.35, 0.28, 0]);
    scene.add(caliper);
    // tach disc with encoder slots
    const tach = new THREE.Group();
    tach.position.set(0.55, 0.95, 0);
    scene.add(tach);
    const td = cyl(0.3, 0.3, 0.03, metal('#3a4458', 0.4), 48);
    td.rotation.z = Math.PI / 2;
    tach.add(td);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sl = box(0.035, 0.1, 0.03, metal('#cbd3df'));
      sl.position.set(0, Math.cos(a) * 0.22, Math.sin(a) * 0.22);
      sl.rotation.x = a;
      tach.add(sl);
    }
    // base plate + pedestals
    scene.add(box(4.6, 0.14, 1.5, metal('#39455a', 0.5), [0.5, 0.07, 0]));
    for (const x of [-0.9, 0.55, 1.35]) scene.add(box(0.2, 0.62, 0.9, metal('#4b5870', 0.45), [x, 0.45, 0]));
    // labels
    const l1 = label('armature  R_a, L_a', 0.3);
    l1.position.set(-0.9, 1.95, 0);
    const l2 = label('flywheel J', 0.3);
    l2.position.set(1.35, 1.95, 0);
    const l3 = label('tach', 0.3);
    l3.position.set(0.55, 1.5, 0);
    scene.add(l1, l2, l3);

    let st = [0, 0, 0];
    let tSim = 0;
    let acc = 0;
    let last = -1;
    const vIn = (t: number, s: number[]) => {
      const p = P.current;
      const ref = p.drive === 'step' ? 1 : p.drive === 'square' ? (Math.floor(t / 2) % 2 === 0 ? 1 : -1) : Math.sin(2 * Math.PI * 0.4 * t);
      if (p.closed) {
        const wRef = ref * p.V * motorDcGain({ Ra: p.Ra, La: p.La, J: p.J, B: p.B, Kt: p.Kt }) * 0.6;
        return Math.max(-30, Math.min(30, p.Kp * (wRef - s[1])));
      }
      return p.V * ref;
    };
    return {
      update: (dt: number) => {
        const p = P.current;
        if (p.token !== last) {
          last = p.token;
          st = [0, 0, 0];
          tSim = 0;
          trace.clear();
        }
        if (p.running) {
          const step = Math.min(dt, 0.033);
          const par = { Ra: p.Ra, La: p.La, J: p.J, B: p.B, Kt: p.Kt };
          st = advance(motorDeriv(par, vIn, (t) => (t > 1 ? p.TL * 1e-3 : 0)), st, tSim, step, Math.min(2e-4, par.La / 8, 5e-4));
          tSim += step;
          acc += step;
          if (acc > 0.03) {
            acc = 0;
            trace.push(tSim, [st[1], st[0] * 10, vIn(tSim, st)]);
          }
        }
        // drawn rotation: scale down so fast speeds stay visible (≤ 6 rev/s on screen)
        const vis = st[2] * 0.02;
        arm.rotation.x = vis;
        wheel.rotation.x = vis;
        tach.rotation.x = vis;
        (caliper.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(1.5, p.TL / 20);
        caliper.position.y = 0.34 - Math.min(0.06, p.TL / 400);
      },
    };
  };

  useEffect(() => setToken((n) => n + 1), [Ra, LaMs, J, B, Kt, V, drive, TL, closed, Kp]);

  const par = { Ra, La: LaMs * 1e-3, J: J * 1e-5, B: B * 1e-5, Kt };
  const den = [par.La * par.J, par.La * par.B + par.Ra * par.J, par.Ra * par.B + par.Kt * par.Kt];
  const rts = roots(den);
  const wss = V * motorDcGain(par);
  const tauM = (par.Ra * par.J) / (par.Ra * par.B + par.Kt * par.Kt);
  const complex = rts.some((r) => Math.abs(r.im) > 1e-6);

  return (
    <SimFrame title={title} subtitle={<span>L di/dt = v − R i − Kω · J dω/dt = K i − Bω − T_L</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={height} camera={[0.3, 4.4, 6.8]} target={[0.2, 0.9, 0]} caption="Cut-away motor: permanent magnets (red N, blue S), copper-wound armature, commutator and brushes, tach disc and flywheel. On screen the rotation is slowed down." />
            <Controls running={running} onToggle={() => setRunning((r) => !r)} onReset={() => setToken((n) => n + 1)}>
              {(['step', 'square', 'sine'] as Drive[]).map((d) => (
                <button key={d} className={`btn ${drive === d ? 'primary' : ''}`} onClick={() => setDrive(d)}>
                  {d}
                </button>
              ))}
              <button className={`btn ${closed ? 'primary' : ''}`} onClick={() => setClosed((c) => !c)}>
                tach feedback {closed ? 'ON' : 'off'}
              </button>
            </Controls>
            <LiveChart trace={trace} yLabel="ω, i×10, v" height={210} show={[0, 1, 2]} />
          </>
        }
        right={
          <>
            <Slider label="armature R_a" value={Ra} min={0.2} max={5} step={0.05} onChange={setRa} unit=" Ω" />
            <Slider label="armature L_a" value={LaMs} min={0.2} max={20} step={0.1} onChange={setLa} unit=" mH" />
            <Slider label="inertia J" value={J} min={0.5} max={20} step={0.1} onChange={setJ} unit=" ×10⁻⁵ kg·m²" />
            <Slider label="friction B" value={B} min={0} max={10} step={0.1} onChange={setB} unit=" ×10⁻⁵" />
            <Slider label="K_t = K_b" value={Kt} min={0.01} max={0.2} step={0.005} onChange={setKt} unit=" N·m/A" />
            <Slider label={closed ? 'speed command scale (V)' : 'supply voltage'} value={V} min={1} max={30} step={0.5} onChange={setV} unit=" V" />
            <Slider label="load torque after t = 1 s" value={TL} min={0} max={20} step={0.5} onChange={setTL} unit=" mN·m" />
            {closed && <Slider label="tach loop gain K_p" value={Kp} min={0.1} max={30} step={0.1} onChange={setKp} />}
            <Readout
              items={[
                ['DC gain ω/v', `${motorDcGain(par).toFixed(2)} rad/s/V`],
                ['no-load speed', `${wss.toFixed(0)} rad/s (${((wss * 60) / (2 * Math.PI)).toFixed(0)} rpm)`],
                ['mechanical τ_m', `${(tauM * 1000).toFixed(1)} ms`],
                ['poles', rts.map((r) => (Math.abs(r.im) > 1e-6 ? `${r.re.toFixed(0)}${r.im >= 0 ? '+' : '−'}j${Math.abs(r.im).toFixed(0)}` : r.re.toFixed(0))).join(', ')],
                ['response', complex ? 'oscillatory (complex poles)' : 'no oscillation (real poles)'],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}
