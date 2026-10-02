/**
 * CartPendulum3D — inverted pendulum on a motorised cart (the rocket-attitude problem F2010 P4 in miniature).
 * Full nonlinear dynamics (RK4). Control force u = K_p θ + K_d θ̇ pushes the cart toward the lean.
 * Linear check:  M L θ'' + K_d θ' + (K_p − (M+m) g) θ = 0  →  K_p must first beat the toppling term (M+m) g.
 */
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Slider, Readout, SimFrame } from '../../../core/ui';
import { Studio3D, StudioCtx, box, cyl, metal, paint, label } from './Studio3D';
import { Controls, LabGrid, LiveChart, Trace, useLatest, useTick } from './LabKit';
import { advance, cartPoleDeriv } from '../lib/plants';

export function CartPendulum3D({ height = 360, title = 'Inverted pendulum on a cart' }: { height?: number; title?: string }) {
  const [M, setM] = useState(1);
  const [m, setm] = useState(0.3);
  const [L, setL] = useState(0.8);
  const [Kp, setKp] = useState(40);
  const [Kd, setKd] = useState(8);
  const [ctl, setCtl] = useState(true);
  const [running, setRunning] = useState(true);
  const [token, setToken] = useState(0);
  const [nudge, setNudge] = useState(0);
  const P = useLatest({ M, m, L, Kp, Kd, ctl, running, token, nudge });
  const trace = useMemo(() => new Trace(['θ (rad)', 'x (m)', 'u/10 (N)'], 20), []);
  useTick(8);
  const g = 9.81;

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const steel = metal('#9aa6b5', 0.35);
    const dark = metal('#434d60', 0.45);
    scene.add(box(7.6, 0.12, 0.8, dark, [0, 0.06, 0]));
    for (let i = -3; i <= 3; i++) scene.add(box(0.05, 0.13, 0.82, steel, [i * 1.1, 0.06, 0]));
    for (const s of [-1, 1]) {
      scene.add(box(0.25, 0.6, 0.9, paint('#d63b3b', 0.5), [s * 3.8, 0.3, 0]));
    }
    // cart
    const cart = new THREE.Group();
    cart.add(box(1.0, 0.34, 0.6, metal('#d8dde6', 0.28), [0, 0.38, 0]));
    cart.add(box(1.04, 0.04, 0.64, metal('#ff9d3a', 0.4), [0, 0.57, 0]));
    for (const sx of [-0.33, 0.33]) for (const sz of [-0.3, 0.3]) {
      const wh = cyl(0.11, 0.11, 0.08, dark, 28);
      wh.rotation.x = Math.PI / 2;
      wh.position.set(sx, 0.17, sz);
      cart.add(wh);
    }
    // motor housing + drive belt look
    const belt = box(1.0, 0.03, 0.04, metal('#222831', 0.9), [0, 0.14, 0.33]);
    cart.add(belt);
    scene.add(cart);
    // pivot + rod + bob
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.62, 0);
    cart.add(pivot);
    const hub = cyl(0.07, 0.07, 0.14, metal('#e6ebf3', 0.2), 20);
    hub.rotation.x = Math.PI / 2;
    pivot.add(hub);
    const rod = cyl(0.025, 0.025, 1, metal('#cfd6e2', 0.2), 14);
    pivot.add(rod);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 24), metal('#e8a23a', 0.25));
    pivot.add(bob);
    const trail: THREE.Vector3[] = [];
    void trail;
    const lb = label('bob m', 0.22);
    scene.add(lb);
    const lc = label('cart M', 0.22);
    lc.position.set(0, 0.0, 0.6);
    cart.add(lc);
    // push arrow
    const arrow = new THREE.Group();
    const sh = cyl(0.03, 0.03, 0.6, new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 0.9 }), 12);
    sh.rotation.z = Math.PI / 2;
    sh.position.x = 0.3;
    const hd = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 16), sh.material);
    hd.rotation.z = -Math.PI / 2;
    hd.position.x = 0.7;
    arrow.add(sh, hd);
    scene.add(arrow);

    let st = [0, 0, 0.05, 0];
    let tSim = 0;
    let acc = 0;
    let lastTok = -1;
    let lastNudge = 0;
    let uNow = 0;
    return {
      update: (dt: number) => {
        const p = P.current;
        if (p.token !== lastTok) {
          lastTok = p.token;
          st = [0, 0, 0.05, 0];
          tSim = 0;
          trace.clear();
        }
        if (p.nudge !== lastNudge) {
          lastNudge = p.nudge;
          st = [st[0], st[1], st[2], st[3] + 1.2];
        }
        if (p.running) {
          const par = { M: p.M, m: p.m, L: p.L, g, c: 0.3 };
          const ctrl = (_t: number, s: number[]) => {
            let u = p.ctl ? p.Kp * s[2] + p.Kd * s[3] : 0;
            // soft end stops so the demo cart does not leave the rail
            if (s[0] > 3.2) u -= 200 * (s[0] - 3.2) + 30 * s[1];
            if (s[0] < -3.2) u -= 200 * (s[0] + 3.2) + 30 * s[1];
            uNow = u;
            return u;
          };
          const step = Math.min(dt, 0.033);
          st = advance(cartPoleDeriv(par, ctrl), st, tSim, step, 1e-3);
          tSim += step;
          acc += step;
          if (acc > 0.03) {
            acc = 0;
            trace.push(tSim, [st[2], st[0], uNow / 10]);
          }
          if (Math.abs(st[2]) > 2.6) {
            st = [0, 0, 0.05, 0]; // reset when it has fallen flat
            tSim = 0;
          }
        }
        cart.position.x = st[0];
        pivot.rotation.z = -st[2];
        const Ld = p.L * 1.5;
        rod.scale.y = Ld;
        rod.position.y = Ld / 2;
        bob.position.y = Ld;
        bob.scale.setScalar(0.7 + 0.5 * Math.cbrt(p.m));
        lb.position.set(st[0] + Math.sin(st[2]) * Ld, 0.62 + Math.cos(st[2]) * Ld + 0.35, 0);
        arrow.visible = p.ctl && Math.abs(uNow) > 0.5;
        const s = Math.sign(uNow) || 1;
        arrow.position.set(st[0] - s * 0.6, 0.42, 0);
        arrow.scale.set(s * Math.min(2.2, Math.abs(uNow) / 15), 1, 1);
      },
    };
  };

  useEffect(() => setToken((n) => n + 1), [M, m, L, Kp, Kd, ctl]);

  const toppling = (M + m) * g;
  const wn2 = (Kp - toppling) / (M * L);
  const zeta = wn2 > 0 ? Kd / (M * L) / (2 * Math.sqrt(wn2)) : NaN;
  const openPole = Math.sqrt(toppling / (M * L));
  return (
    <SimFrame title={title} subtitle={<span>M L θ″ + K_d θ′ + (K_p − (M+m) g) θ = 0</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={height} camera={[0.2, 1.9, 5.6]} target={[0, 0.95, 0]} caption="Full nonlinear dynamics. Without control the pole at s = +√((M+m)g/(ML)) makes it fall; with PD feedback on the angle it balances once K_p exceeds (M+m)g." />
            <Controls running={running} onToggle={() => setRunning((r) => !r)} onReset={() => setToken((n) => n + 1)}>
              <button className={`btn ${ctl ? 'primary' : ''}`} onClick={() => setCtl((c) => !c)}>
                controller {ctl ? 'ON' : 'off'}
              </button>
              <button className="btn" onClick={() => setNudge((n) => n + 1)}>
                ⚡ nudge
              </button>
            </Controls>
            <LiveChart trace={trace} yLabel="θ, x, u/10" height={210} window={12} />
          </>
        }
        right={
          <>
            <Slider label="cart mass M" value={M} min={0.3} max={4} step={0.1} onChange={setM} unit=" kg" />
            <Slider label="bob mass m" value={m} min={0.05} max={1.5} step={0.05} onChange={setm} unit=" kg" />
            <Slider label="rod length L" value={L} min={0.3} max={1.5} step={0.05} onChange={setL} unit=" m" />
            <Slider label="K_p (angle)" value={Kp} min={0} max={120} step={1} onChange={setKp} unit=" N/rad" />
            <Slider label="K_d (rate)" value={Kd} min={0} max={30} step={0.5} onChange={setKd} unit=" N·s/rad" />
            <Readout
              items={[
                ['open-loop pole', `+${openPole.toFixed(2)} s⁻¹ (unstable)`],
                ['toppling term (M+m)g', `${toppling.toFixed(1)} N/rad`],
                ['K_p must exceed it', Kp > toppling ? '✔ yes' : '✘ no — it will fall'],
                ['closed-loop ω_n', wn2 > 0 ? `${Math.sqrt(wn2).toFixed(2)} rad/s` : '—'],
                ['closed-loop ζ', Number.isFinite(zeta) ? zeta.toFixed(2) : '—'],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}
