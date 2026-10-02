/**
 * HydraulicServo3D — fly-ball governor + lever + spool valve + power piston + dashpot–spring feedback
 * (MT2 W2019 Q2, MT2 F2022 Q2, T08 Q3).  y' = K x ;  x = a2/(a1+a2) e − a1/(a1+a2) z ;  z' = y' − (k/b) z.
 * With a large gain the controller becomes  Y/E ≈ (a2/a1)(1 + k/(b s))  = a P+I controller (K_p = a2/a1, T_i = b/k).
 */
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Slider, Readout, SimFrame } from '../../../core/ui';
import { Studio3D, StudioCtx, box, cyl, makeDashpot, makeSpring, metal, paint, label } from './Studio3D';
import { Controls, LabGrid, LiveChart, Trace, useLatest, useTick } from './LabKit';
import { advance, servoDeriv } from '../lib/plants';

type In = 'step' | 'square' | 'sine';

export function HydraulicServo3D({ height = 360, title = 'Hydraulic servo with dashpot feedback (speed governor)' }: { height?: number; title?: string }) {
  const [K, setK] = useState(30);
  const [a1, setA1] = useState(1);
  const [a2, setA2] = useState(2);
  const [b, setB] = useState(1);
  const [k, setKs] = useState(2);
  const [amp, setAmp] = useState(0.5);
  const [inp, setInp] = useState<In>('step');
  const [running, setRunning] = useState(true);
  const [token, setToken] = useState(0);
  const P = useLatest({ K, a1, a2, b, k, amp, inp, running, token });
  const trace = useMemo(() => new Trace(['e (sleeve)', 'y (piston)', 'z (dashpot)', 'x (valve)'], 30), []);
  useTick(8);

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const steel = metal('#a9b3c1', 0.3);
    const dark = metal('#566176', 0.4);
    const brass = metal('#d1a24a', 0.28);
    const blue = metal('#2f6fd0', 0.35);
    scene.add(box(9.2, 0.14, 2.2, metal('#394457', 0.5), [1.4, 0.07, 0]));

    // ---------- governor (left): spindle, two fly-balls, sleeve
    const gov = new THREE.Group();
    gov.position.set(-3.3, 0.14, 0);
    scene.add(gov);
    const spindle = cyl(0.07, 0.07, 3.0, steel, 18);
    spindle.position.y = 1.5;
    gov.add(spindle);
    gov.add(box(0.7, 0.3, 0.7, dark, [0, 0.15, 0]));
    const sleeve = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 12, 28), brass);
    ring.rotation.x = Math.PI / 2;
    sleeve.add(ring);
    gov.add(sleeve);
    const balls: { arm: THREE.Mesh; ball: THREE.Mesh; link: THREE.Mesh; s: number }[] = [];
    for (const s of [-1, 1]) {
      const arm = box(1, 0.05, 0.05, steel);
      const link = box(1, 0.04, 0.04, steel);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), metal('#3c4658', 0.2));
      gov.add(arm, link, ball);
      balls.push({ arm, ball, link, s });
    }
    const gl = label('fly-ball governor', 0.26);
    gl.position.set(-3.3, 3.6, 0);
    scene.add(gl);

    // ---------- lever
    const lever = box(1, 0.07, 0.12, metal('#e8a23a', 0.35));
    scene.add(lever);
    const pivotE = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), brass);
    const pivotZ = pivotE.clone();
    const pivotX = pivotE.clone();
    scene.add(pivotE, pivotZ, pivotX);
    const l1 = label('e', 0.22);
    const l2 = label('x', 0.22);
    const l3 = label('z', 0.22);
    scene.add(l1, l2, l3);

    // ---------- spool valve (cut-away) + power cylinder
    const vh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.5, 40, 1, true, Math.PI * 0.6, Math.PI * 1.6), new THREE.MeshStandardMaterial({ color: '#8d9bb2', metalness: 1, roughness: 0.38, side: THREE.DoubleSide }));
    vh.position.set(-0.3, 2.0, 0);
    scene.add(vh);
    const spool = new THREE.Group();
    const land = (yy: number) => {
      const c = cyl(0.3, 0.3, 0.22, metal('#e6ebf3', 0.18), 28);
      c.position.y = yy;
      spool.add(c);
    };
    land(-0.42);
    land(0.42);
    const rodS = cyl(0.06, 0.06, 1.7, steel, 14);
    spool.add(rodS);
    spool.position.set(-0.3, 2.0, 0);
    scene.add(spool);
    const oil = new THREE.MeshStandardMaterial({ color: '#ffb02e', emissive: '#d77a00', emissiveIntensity: 0.4, transparent: true, opacity: 0.8 });
    const supply = cyl(0.06, 0.06, 0.9, oil, 12);
    supply.rotation.z = Math.PI / 2;
    supply.position.set(-0.3 - 0.8, 2.0, 0);
    scene.add(supply);
    const pcyl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 3.2, 48, 1, true, Math.PI * 0.55, Math.PI * 1.6), new THREE.MeshStandardMaterial({ color: '#7e8da6', metalness: 1, roughness: 0.4, side: THREE.DoubleSide }));
    pcyl.rotation.z = Math.PI / 2;
    pcyl.position.set(1.9, 0.95, 0);
    scene.add(pcyl);
    const piston = new THREE.Group();
    const pd = cyl(0.58, 0.58, 0.28, metal('#e6ebf3', 0.2), 40);
    pd.rotation.z = Math.PI / 2;
    const rod = cyl(0.12, 0.12, 3.0, steel, 18);
    rod.rotation.z = Math.PI / 2;
    rod.position.x = 1.5;
    piston.add(pd, rod);
    piston.position.set(1.9, 0.95, 0);
    scene.add(piston);
    // oil in the two chambers
    const chL = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 1, 36), oil);
    chL.rotation.z = Math.PI / 2;
    const chR = chL.clone();
    scene.add(chL, chR);
    // fuel valve (load) at the end of the rod
    const fuel = box(0.7, 0.9, 0.7, paint('#cf3b3b', 0.5), [5.4, 0.6, 0]);
    scene.add(fuel);
    const lf = label('fuel valve', 0.26);
    lf.position.set(5.4, 1.5, 0);
    scene.add(lf);
    const ly = label('piston y', 0.26);
    ly.position.set(2.7, 1.9, 0);
    scene.add(ly);
    // dashpot + spring feedback under the cylinder
    const fb = new THREE.Group();
    scene.add(fb);
    const dash = makeDashpot(0.1, 1.0, blue, metal('#e6ebf2', 0.2));
    const sprg = makeSpring(0.14, 8, 0.02, metal('#c9d2de', 0.25), 1);
    dash.object.position.set(0.8, 0.6, 0.55);
    sprg.object.position.set(0.8, 0.6, -0.55);
    fb.add(dash.object, sprg.object);
    const wallF = box(0.2, 0.9, 1.6, paint('#2b3345', 0.7, 0.3), [0.7, 0.6, 0]);
    scene.add(wallF);
    const lfb = label('dashpot b + spring k', 0.26);
    lfb.position.set(1.7, 0.1, 0.9);
    scene.add(lfb);

    let st = [0, 0];
    let tSim = 0;
    let acc = 0;
    let last = -1;
    const ex = (t: number) => {
      const p = P.current;
      return p.inp === 'step' ? p.amp : p.inp === 'square' ? (Math.floor(t / 6) % 2 === 0 ? p.amp : -p.amp) : p.amp * Math.sin(0.8 * t);
    };
    const wrap = (v: number, lim: number) => (((v + lim) % (2 * lim)) + 2 * lim) % (2 * lim) - lim;
    return {
      update: (dt: number, tAnim: number) => {
        const p = P.current;
        if (p.token !== last) {
          last = p.token;
          st = [0, 0];
          tSim = 0;
          trace.clear();
        }
        if (p.running) {
          const step = Math.min(dt, 0.033);
          st = advance(servoDeriv({ K: p.K, a1: p.a1, a2: p.a2, b: p.b, k: p.k }, ex), st, tSim, step, 2e-3);
          tSim += step;
          acc += step;
          if (acc > 0.05) {
            acc = 0;
            const e = ex(tSim);
            const xv = (p.a2 / (p.a1 + p.a2)) * e - (p.a1 / (p.a1 + p.a2)) * st[1];
            trace.push(tSim, [e, st[0], st[1], xv]);
          }
        }
        const e = ex(tSim);
        const xv = (P.current.a2 / (P.current.a1 + P.current.a2)) * e - (P.current.a1 / (P.current.a1 + P.current.a2)) * st[1];
        const S = 0.55; // drawing scale for e, x, z
        // governor
        sleeve.position.y = 1.3 + e * S;
        for (const bl of balls) {
          const th = 0.55 + e * 0.45;
          const ax = bl.s * Math.sin(th) * 1.0;
          const ay = 2.5 - Math.cos(th) * 1.0;
          bl.ball.position.set(ax, ay, 0);
          bl.arm.position.set(ax / 2, (2.5 + ay) / 2, 0);
          bl.arm.rotation.z = Math.atan2(ay - 2.5, ax);
          bl.arm.scale.x = Math.hypot(ax, ay - 2.5);
          const sx = bl.s * 0.14;
          const sy = 1.3 + e * S;
          bl.link.position.set((ax + sx) / 2, ((ay + 2.5) / 2 + sy) / 2 + 0.0, 0);
          bl.link.position.set((ax * 0.6 + sx) / 2, (ay * 0.6 + 2.5 * 0.4 + sy) / 2, 0);
          bl.link.rotation.z = Math.atan2(sy - (ay * 0.6 + 2.5 * 0.4), sx - ax * 0.6);
          bl.link.scale.x = Math.hypot(sx - ax * 0.6, sy - (ay * 0.6 + 2.5 * 0.4));
        }
        gov.rotation.y = tAnim * (4 + e * 2);
        // lever between sleeve ring (x=-3.3) and dashpot rod end (x=0.8)
        const Pe = new THREE.Vector3(-3.3, 0.14 + 1.3 + e * S, 0);
        const zEnd = new THREE.Vector3(0.8 + 1.0 + Math.max(0.05, 0.9), 0.6, 0);
        void zEnd;
        const Pz = new THREE.Vector3(-0.1, 0.14 + 1.45 - st[1] * S, 0);
        // pilot point dividing the lever a1 from the sleeve end
        const f = P.current.a1 / (P.current.a1 + P.current.a2);
        const Px = new THREE.Vector3().lerpVectors(Pe, Pz, f);
        const dirv = Pz.clone().sub(Pe);
        lever.position.copy(Pe.clone().add(Pz).multiplyScalar(0.5));
        lever.rotation.z = Math.atan2(dirv.y, dirv.x);
        lever.scale.x = dirv.length();
        pivotE.position.copy(Pe);
        pivotZ.position.copy(Pz);
        pivotX.position.copy(Px);
        l1.position.set(Pe.x, Pe.y + 0.35, 0);
        l2.position.set(Px.x, Px.y + 0.4, 0);
        l3.position.set(Pz.x + 0.1, Pz.y - 0.35, 0);
        // spool follows x (clamped for drawing)
        const sx = Math.max(-0.5, Math.min(0.5, xv * S * 1.2));
        spool.position.y = 2.0 + sx;
        // power piston moves along +x with y
        const yy = Math.max(-1.2, Math.min(1.2, st[0] * S * 0.8));
        piston.position.x = 1.9 + yy;
        chL.scale.y = Math.max(0.05, 1.5 + yy);
        chL.position.set(1.9 - 1.5 + (1.5 + yy) / 2 - 0.0 - 0.0, 0.95, 0);
        chL.position.x = 0.4 + (1.5 + yy) / 2;
        chR.scale.y = Math.max(0.05, 1.5 - yy);
        chR.position.set(3.4 - (1.5 - yy) / 2, 0.95, 0);
        (chL.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.max(0, xv) * 0.8;
        fuel.position.x = 5.4 + yy;
        lf.position.x = 5.4 + yy;
        // dashpot-spring length follows z
        const Ld = 1.0 + 0.2 + st[1] * S;
        dash.setLength(Math.max(1.05, Ld));
        sprg.setLength(Math.max(0.3, Ld));
        fb.position.x = 0.0;
      },
    };
  };

  useEffect(() => setToken((n) => n + 1), [K, a1, a2, b, k, amp, inp]);

  const Kp = a2 / a1;
  const Ti = b / k;
  const pole = ((a1 + a2) * k + a1 * b * K) / ((a1 + a2) * b);
  return (
    <SimFrame title={title} subtitle={<span>y′ = K x · x = a₂/(a₁+a₂) e − a₁/(a₁+a₂) z · z′ = y′ − (k/b) z</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={height} camera={[0.8, 4.2, 12.5]} target={[0.8, 1.6, 0]} caption="Speed up the governor (e > 0): the sleeve rises, the lever moves the spool, oil drives the piston, the dashpot–spring pulls the lever back. Piston keeps moving while e ≠ 0: integral action." />
            <Controls running={running} onToggle={() => setRunning((r) => !r)} onReset={() => setToken((n) => n + 1)}>
              {(['step', 'square', 'sine'] as In[]).map((d) => (
                <button key={d} className={`btn ${inp === d ? 'primary' : ''}`} onClick={() => setInp(d)}>
                  {d}
                </button>
              ))}
            </Controls>
            <LiveChart trace={trace} yLabel="displacement" height={210} />
          </>
        }
        right={
          <>
            <Slider label="servo gain K (y′ = Kx)" value={K} min={1} max={200} step={1} onChange={setK} />
            <Slider label="lever arm a₁" value={a1} min={0.5} max={4} step={0.1} onChange={setA1} />
            <Slider label="lever arm a₂" value={a2} min={0.5} max={4} step={0.1} onChange={setA2} />
            <Slider label="dashpot b" value={b} min={0.2} max={5} step={0.1} onChange={setB} />
            <Slider label="spring k" value={k} min={0.2} max={10} step={0.1} onChange={setKs} />
            <Slider label="error e" value={amp} min={0.1} max={1} step={0.05} onChange={setAmp} />
            <Readout
              items={[
                ['high-gain controller', 'Y/E ≈ (a₂/a₁)(1 + k/(b s))'],
                ['K_p = a₂/a₁', Kp.toFixed(2)],
                ['T_i = b/k', `${Ti.toFixed(2)} s`],
                ['closed-loop pole (besides s = 0)', `s = −${pole.toFixed(2)}`],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}
