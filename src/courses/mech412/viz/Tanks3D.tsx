/**
 * Tanks3D — two interacting glass tanks with a pump, two valves (R_b between the tanks, R_c at the outlet),
 * a disturbance faucet and an optional proportional level controller on tank 2.
 * Physics (RK4): A1 h1' = q_in − (h1−h2)/R_b ; A2 h2' = (h1−h2)/R_b + q_d − h2/R_c.
 * Matches MT2 W2012 Q2 / W2019 mk Q3 / T08 Q1:  Q_out/Q_in = 1/(R_bC_1R_cC_2 s² + (R_bC_1+R_cC_2+R_cC_1)s + 1).
 */
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Slider, Readout, SimFrame } from '../../../core/ui';
import { Studio3D, StudioCtx, box, cyl, metal, paint, label } from './Studio3D';
import { Controls, LabGrid, LiveChart, Trace, useLatest, useTick } from './LabKit';
import { advance, tanksDeriv, tanksPoly } from '../lib/plants';
import { roots } from '../lib/poly';

export function Tanks3D({ height = 340, title = 'Two-tank level control', A1: a1 = 2, A2: a2 = 2, Rb: rb = 1, Rc: rc = 1 }: { height?: number; title?: string; A1?: number; A2?: number; Rb?: number; Rc?: number }) {
  const [A1, setA1] = useState(a1);
  const [A2, setA2] = useState(a2);
  const [Rb, setRb] = useState(rb);
  const [Rc, setRc] = useState(rc);
  const [qin, setQin] = useState(1);
  const [qd, setQd] = useState(0);
  const [closed, setClosed] = useState(false);
  const [Kp, setKp] = useState(2);
  const [href, setHref] = useState(1);
  const [running, setRunning] = useState(true);
  const [token, setToken] = useState(0);
  const P = useLatest({ A1, A2, Rb, Rc, qin, qd, closed, Kp, href, running, token });
  const trace = useMemo(() => new Trace(['h₁ (m)', 'h₂ (m)', 'q_out (m³/s)'], 120), []);
  useTick(8);

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const gl = new THREE.MeshStandardMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.2, depthWrite: false });
    const steel = metal('#aeb8c6', 0.3);
    const water = new THREE.MeshStandardMaterial({ color: '#2f8cff', transparent: true, opacity: 0.62, roughness: 0.15, metalness: 0.1, emissive: '#0b3a7a', emissiveIntensity: 0.25 });
    const tankH = 2.6;
    const mkTank = (x: number, w: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, 0);
      const walls = box(w, tankH, w, gl, [0, tankH / 2 + 0.2, 0]);
      (walls.material as THREE.Material).side = THREE.DoubleSide;
      g.add(walls);
      const base = box(w + 0.1, 0.2, w + 0.1, steel, [0, 0.1, 0]);
      g.add(base);
      // frame
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.05, tankH, 0.05, steel, [sx * (w / 2), tankH / 2 + 0.2, sz * (w / 2)]));
      // level scale
      for (let i = 0; i <= 5; i++) g.add(box(0.1, 0.012, 0.012, paint('#ffd24a'), [w / 2 + 0.07, 0.2 + (i / 5) * tankH, w / 2]));
      const wat = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 1, w - 0.06), water);
      wat.renderOrder = 1;
      walls.renderOrder = 2;
      g.add(wat);
      scene.add(g);
      return { g, wat, w };
    };
    const T1 = mkTank(-2.0, 1.6);
    const T2 = mkTank(1.7, 1.6);
    // pipes
    const pipe = (len: number, x: number, y: number, z = 0) => {
      const p = cyl(0.07, 0.07, len, steel, 20);
      p.rotation.z = Math.PI / 2;
      p.position.set(x, y, z);
      scene.add(p);
      return p;
    };
    pipe(1.9, -0.15, 0.55); // between tanks
    pipe(1.6, 3.65, 0.55); // outlet
    pipe(2.2, -2.8, 3.55); // inlet
    const down = cyl(0.07, 0.07, 0.8, steel, 20);
    down.position.set(-2.0, 3.55 - 0.3, 0);
    scene.add(down);
    // valves with hand wheels
    const mkValve = (x: number, y: number) => {
      const body = box(0.3, 0.3, 0.3, metal('#2f6fd0', 0.35), [x, y, 0]);
      const stem = cyl(0.03, 0.03, 0.3, steel, 10);
      stem.position.set(x, y + 0.3, 0);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 10, 28), metal('#d63b3b', 0.4));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, y + 0.45, 0);
      scene.add(body, stem, wheel);
      return wheel;
    };
    const vb = mkValve(-0.15, 0.55);
    const vc = mkValve(3.65, 0.55);
    // pump
    const pump = new THREE.Group();
    pump.position.set(-3.6, 3.1, 0);
    const pb = cyl(0.3, 0.3, 0.5, metal('#e8a23a', 0.35), 32);
    pb.rotation.z = Math.PI / 2;
    const imp = box(0.1, 0.4, 0.04, steel);
    pump.add(pb, imp);
    scene.add(pump);
    pipe(0.9, -3.4 + 0.1, 3.55);
    // disturbance faucet over tank 2
    const faucet = cyl(0.05, 0.05, 0.7, steel, 14);
    faucet.rotation.z = Math.PI / 2;
    faucet.position.set(1.4, 3.35, 0);
    scene.add(faucet);
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 10), new THREE.MeshStandardMaterial({ color: '#7fc4ff', emissive: '#2f8cff', emissiveIntensity: 0.6 }));
    drop.position.set(1.7, 3.0, 0);
    scene.add(drop);
    // inlet jet + outlet jet
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 10), drop.material);
    scene.add(jet);
    const out = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 10), drop.material);
    out.rotation.z = Math.PI / 2;
    out.position.set(4.7, 0.55, 0);
    scene.add(out);
    const lt1 = label('tank 1 · C₁ = A₁', 0.28);
    lt1.position.set(-2.0, 3.55, 0.9);
    const lt2 = label('tank 2 · C₂ = A₂', 0.28);
    lt2.position.set(1.7, 3.55, 0.9);
    const lrb = label('R_b', 0.26);
    lrb.position.set(-0.15, 1.35, 0.1);
    const lrc = label('R_c', 0.26);
    lrc.position.set(3.65, 1.35, 0.1);
    const lpump = label('pump q_in', 0.26);
    lpump.position.set(-3.6, 3.75, 0);
    scene.add(lt1, lt2, lrb, lrc, lpump);

    let st = [0, 0];
    let tSim = 0;
    let acc = 0;
    let last = -1;
    const wScale = tankH / 3.2;
    return {
      update: (dt: number, t: number) => {
        const p = P.current;
        if (p.token !== last) {
          last = p.token;
          st = [0, 0];
          tSim = 0;
          trace.clear();
        }
        if (p.running) {
          const step = Math.min(dt, 0.033);
          const par = { A1: p.A1, A2: p.A2, Rb: p.Rb, Rc: p.Rc };
          const qinF = (_t: number, s: number[]) => (p.closed ? Math.max(0, Math.min(5, p.Kp * (p.href - s[1]))) : p.qin);
          st = advance(tanksDeriv(par, qinF, (tt) => (tt > 2 ? p.qd : 0)), st, tSim, step, 5e-3);
          tSim += step;
          acc += step;
          if (acc > 0.1) {
            acc = 0;
            trace.push(tSim, [st[0], st[1], st[1] / p.Rc]);
          }
        }
        const lv = (g: typeof T1, h: number) => {
          const hh = Math.max(0.02, Math.min(tankH - 0.05, h * wScale));
          g.wat.scale.y = hh;
          g.wat.position.y = 0.2 + hh / 2;
        };
        lv(T1, st[0]);
        lv(T2, st[1]);
        const qIn = p.closed ? Math.max(0, Math.min(5, p.Kp * (p.href - st[1]))) : p.qin;
        jet.scale.set(1, 1, 1);
        jet.position.set(-2.0, 3.0, 0);
        jet.scale.y = Math.min(1.2, qIn * 0.8 + 0.01) * 1.2;
        (jet.material as THREE.Material).opacity = 1;
        down.visible = true;
        drop.scale.y = p.qd > 0 && tSim > 2 ? 1 : 0.001;
        out.scale.x = Math.min(2.2, 0.2 + (st[1] / p.Rc) * 1.2);
        pump.rotation.x = t * 3;
        vb.rotation.z = Math.sin(p.Rb) * 0.5;
        vc.rotation.z = Math.sin(p.Rc) * 0.5;
        vb.scale.setScalar(0.8 + 0.2 * Math.min(2, 1 / p.Rb));
        vc.scale.setScalar(0.8 + 0.2 * Math.min(2, 1 / p.Rc));
      },
    };
  };

  useEffect(() => setToken((n) => n + 1), [A1, A2, Rb, Rc, qin, qd, closed, Kp, href]);

  const den = tanksPoly({ A1, A2, Rb, Rc });
  const rts = roots(den);
  const slow = Math.min(...rts.map((r) => Math.abs(r.re)));
  const ts = 4 / slow;
  const qss = closed ? (Kp * Rc * href) / (1 + Kp * Rc) / Rc : qin;
  return (
    <SimFrame title={title} subtitle={<span>Q_out/Q_in = 1 / (R_bC₁R_cC₂ s² + (R_bC₁+R_cC₂+R_cC₁)s + 1)</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={height} camera={[0.4, 4.2, 12.5]} target={[0.2, 1.7, 0]} caption="Tank 1 feeds tank 2 through valve R_b; tank 2 drains through R_c. The faucet over tank 2 is a disturbance q_d that switches on at t = 2 s." />
            <Controls running={running} onToggle={() => setRunning((r) => !r)} onReset={() => setToken((n) => n + 1)}>
              <button className={`btn ${closed ? 'primary' : ''}`} onClick={() => setClosed((c) => !c)}>
                proportional level control {closed ? 'ON' : 'off'}
              </button>
            </Controls>
            <LiveChart trace={trace} yLabel="level / flow" height={210} window={30} />
          </>
        }
        right={
          <>
            <Slider label="area A₁ (= C₁)" value={A1} min={0.5} max={6} step={0.1} onChange={setA1} unit=" m²" />
            <Slider label="area A₂ (= C₂)" value={A2} min={0.5} max={6} step={0.1} onChange={setA2} unit=" m²" />
            <Slider label="valve R_b" value={Rb} min={0.2} max={3} step={0.05} onChange={setRb} unit=" s/m²" />
            <Slider label="valve R_c" value={Rc} min={0.2} max={3} step={0.05} onChange={setRc} unit=" s/m²" />
            {!closed ? <Slider label="inflow q_in" value={qin} min={0} max={2} step={0.05} onChange={setQin} unit=" m³/s" /> : <><Slider label="level set-point" value={href} min={0.2} max={2.4} step={0.05} onChange={setHref} unit=" m" /><Slider label="controller K_p" value={Kp} min={0.1} max={20} step={0.1} onChange={setKp} /></>}
            <Slider label="disturbance q_d (from 2 s)" value={qd} min={0} max={1} step={0.05} onChange={setQd} unit=" m³/s" />
            <Readout
              items={[
                ['poles', rts.map((r) => r.re.toFixed(3)).join(', ')],
                ['time constants', rts.map((r) => (-1 / r.re).toFixed(2) + ' s').join(', ')],
                ['2 % settling (slow pole)', `${ts.toFixed(1)} s`],
                ['final q_out', `${qss.toFixed(2)} m³/s`],
                closed ? ['offset (no integrator)', `${(href / (1 + Kp * Rc)).toFixed(3)} m`] : ['final h₂ = R_c q_in', `${(Rc * qin).toFixed(2)} m`],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}
