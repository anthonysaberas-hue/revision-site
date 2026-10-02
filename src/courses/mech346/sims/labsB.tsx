/**
 * MECH 346 labs B: flat-plate boundary layer, counterflow heat exchanger, radiation furnace, natural-convection plume.
 */
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Slider, Readout, SimFrame } from '../../../core/ui';
import { Plot } from '../../../core/Plot';
import { Studio3D, StudioCtx, box, cyl, metal } from '../../mech412/viz/Studio3D';
import { Controls, LabGrid, useLatest } from '../../mech412/viz/LabKit';
import { heatColor, glowColor } from '../viz/heat';
import { f, range } from '../viz/Kit';
import { air, water } from '../lib/props';
import { NuPlate, NuxLocal, Re as reynolds, RE_CR_PLATE, boundaryThickness } from '../lib/convection';
import { rateHX, hxProfile, effectiveness } from '../lib/hx';
import { Eb, enclosure, F_parallelRect } from '../lib/radiation';
import { Rayleigh, NuVerticalFull, NuHorizontalPlate } from '../lib/convection';

/* ============================== BoundaryLayerLab ============================== */
export function BoundaryLayerLab() {
  const [V, setV] = useState(8);
  const [L, setL] = useState(2);
  const [fl, setFl] = useState<'air' | 'water'>('air');
  const [Ts, setTs] = useState(60);
  const [Tinf, setTinf] = useState(20);
  const [running, setRunning] = useState(true);
  const [token, setToken] = useState(0);
  useEffect(() => setToken((n) => n + 1), [V, L, fl, Ts, Tinf]);
  const P = useLatest({ V, L, fl, Ts, Tinf, token, running });
  const p = (fl === 'air' ? air : water)((Ts + Tinf) / 2);
  const ReL = reynolds(V, L, p.nu);
  const xcr = (RE_CR_PLATE * p.nu) / V;
  const np = NuPlate(ReL, p.Pr);
  const h = (np.Nu * p.k) / L;
  const xs = range(L / 200, L, 120);
  const hx = xs.map((x) => ({ x, y: (NuxLocal(reynolds(V, x, p.nu), p.Pr) * p.k) / x }));
  const dl = xs.map((x) => ({ x, y: boundaryThickness(x, reynolds(V, x, p.nu)) * 1000 }));

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const holder = new THREE.Group();
    scene.add(holder);
    const W = 5; // world length of the plate
    const N = 360;
    const pos = new Float32Array(N * 3);
    const info: { x: number; y: number; z: number; seed: number }[] = [];
    let last = -1;
    let deltaWorld: number[] = [];
    let trX = 0;
    let lamTurb: (x: number) => boolean = () => false;
    const pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#cfe6ff', size: 0.06, sizeAttenuation: true }));
    scene.add(pts);
    const build = () => {
      holder.clear();
      const q = P.current;
      const pp = (q.fl === 'air' ? air : water)((q.Ts + q.Tinf) / 2);
      const xcrL = (RE_CR_PLATE * pp.nu) / q.V;
      trX = Math.min(1, xcrL / q.L) * W;
      lamTurb = (xw) => xw > trX;
      // plate coloured by local h(x)
      const seg = 80;
      const hxs = range(q.L / 400, q.L, seg - 1).map((x) => (NuxLocal(reynolds(q.V, x, pp.nu), pp.Pr) * pp.k) / x);
      const hmax = Math.max(...hxs);
      const hmin = Math.min(...hxs);
      for (let i = 0; i < seg; i++) {
        const c = heatColor(Math.log(hxs[i] / hmin) / Math.max(1e-6, Math.log(hmax / hmin)));
        holder.add(box(W / seg + 0.001, 0.12, 1.6, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.3 }), [(i + 0.5) * (W / seg), 0.06, 0]));
      }
      // boundary-layer surface (amplified vertically)
      const amp = 0.7;
      deltaWorld = xs.map((x) => Math.min(1.2, boundaryThickness(Math.max(x, q.L / 400), reynolds(q.V, Math.max(x, q.L / 400), pp.nu)) * (W / q.L) * 3 * amp));
      const geo = new THREE.BufferGeometry();
      const verts: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i < xs.length; i++) {
        const x = (xs[i] / q.L) * W;
        verts.push(x, 0.12, -0.8, x, 0.12 + deltaWorld[i], -0.8);
        verts.push(x, 0.12, 0.8, x, 0.12 + deltaWorld[i], 0.8);
      }
      for (let i = 0; i < xs.length - 1; i++) {
        const a = i * 4;
        const b = (i + 1) * 4;
        // back face (z = -0.8) and top
        idx.push(a + 1, b + 1, b + 3, a + 1, b + 3, a + 3);
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      holder.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#6fb2ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide })));
      // transition marker
      const marker = box(0.04, 0.9, 1.7, new THREE.MeshBasicMaterial({ color: '#ff5a3c', transparent: true, opacity: 0.5 }), [trX, 0.5, 0]);
      holder.add(marker);
      // particles
      info.length = 0;
      for (let i = 0; i < N; i++) info.push({ x: Math.random() * W, y: Math.random() * 1.2, z: (Math.random() - 0.5) * 1.5, seed: Math.random() });
      pts.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    };
    const deltaAt = (xw: number) => {
      const i = Math.max(0, Math.min(deltaWorld.length - 1, Math.round((xw / W) * (deltaWorld.length - 1))));
      return Math.max(0.03, deltaWorld[i] ?? 0.05);
    };
    return {
      update: (dt: number, t: number) => {
        const q = P.current;
        if (q.token !== last) {
          last = q.token;
          build();
        }
        const speed = Math.min(2.6, 0.5 + q.V * 0.12);
        for (let i = 0; i < N; i++) {
          const a = info[i];
          if (q.running) {
            const d = deltaAt(a.x);
            const eta = Math.min(1, a.y / d);
            // laminar: 1.5 eta - 0.5 eta^3 ; turbulent: eta^(1/7)
            const turb = lamTurb(a.x);
            const u = a.y >= d ? 1 : turb ? Math.pow(eta, 1 / 7) : 1.5 * eta - 0.5 * eta ** 3;
            a.x += u * speed * dt * 1.4;
            if (turb) a.y += Math.sin(t * 9 + a.seed * 40) * 0.25 * dt * d * 3;
            if (a.y < 0.005) a.y = 0.005;
            if (a.x > W) {
              a.x = 0;
              a.y = Math.random() * 1.2;
              a.z = (Math.random() - 0.5) * 1.5;
            }
          }
          pos[3 * i] = a.x;
          pos[3 * i + 1] = 0.12 + a.y;
          pos[3 * i + 2] = a.z;
        }
        pts.geometry.attributes.position.needsUpdate = true;
        holder.position.x = -W / 2;
        pts.position.x = -W / 2;
      },
    };
  };

  return (
    <SimFrame title="Boundary-layer lab: flat plate" subtitle={<span>δ = 4.91x/√Re_x (laminar), h_x ∝ x^−1/2, transition at Re = 5×10⁵</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={330} camera={[0.3, 3.4, 8.2]} target={[0, 0.5, 0]} caption="Particles follow the velocity profile: slow at the wall, free-stream above δ (blue sheet, thickness exaggerated). The red wall marks transition; after it the particles jitter (turbulence). The plate is coloured by local h(x)." />
            <Controls running={running} onToggle={() => setRunning((r) => !r)} onReset={() => setToken((n) => n + 1)} />
            <Plot x={[0, L]} y={[0, Math.max(...hx.map((q) => q.y)) * 1.1]} series={[{ points: hx, color: 'var(--c1)', label: 'local h(x)' }]} hlines={[{ y: h, dash: true, label: 'average h' }]} vlines={[{ x: Math.min(xcr, L), dash: true, label: 'x_cr' }]} height={200} xLabel="x (m)" yLabel="h (W/m²K)" />
          </>
        }
        right={
          <>
            <div style={{ display: 'flex', gap: 6, margin: '4px 0' }}>
              {(['air', 'water'] as const).map((x) => (
                <button key={x} className={`btn ${fl === x ? 'primary' : ''}`} onClick={() => setFl(x)}>
                  {x}
                </button>
              ))}
            </div>
            <Slider label="free-stream velocity V" value={V} min={0.2} max={40} step={0.1} onChange={setV} unit=" m/s" />
            <Slider label="plate length L" value={L} min={0.2} max={5} step={0.05} onChange={setL} unit=" m" />
            <Slider label="plate temperature" value={Ts} min={25} max={120} step={1} onChange={setTs} unit=" °C" />
            <Slider label="fluid temperature" value={Tinf} min={0} max={40} step={1} onChange={setTinf} unit=" °C" />
            <Readout
              items={[
                ['Re_L', f(ReL, 4)],
                ['regime', np.regime],
                ['transition x_cr', xcr >= L ? 'none (laminar all along)' : `${f(xcr, 3)} m`],
                ['average Nu', f(np.Nu, 4)],
                ['average h', `${f(h)} W/m²K`],
                ['δ(L)', `${f(dl[dl.length - 1].y, 3)} mm`],
              ]}
            />
            <Plot x={[0, L]} y={[0, Math.max(...dl.map((q) => q.y)) * 1.1]} series={[{ points: dl, color: 'var(--c2)', label: 'δ(x) (mm)' }]} height={170} xLabel="x (m)" yLabel="δ (mm)" />
          </>
        }
      />
    </SimFrame>
  );
}

/* ============================== ExchangerLab ============================== */
export function ExchangerLab() {
  const [arr, setArr] = useState<'counter' | 'parallel'>('counter');
  const [mh, setMh] = useState(1.2);
  const [mc, setMc] = useState(0.9);
  const [UA, setUA] = useState(2000);
  const [Thi, setThi] = useState(110);
  const [Tci, setTci] = useState(30);
  const ch = 2100;
  const cc = 4180;
  const Ch = mh * ch;
  const Cc = mc * cc;
  const [token, setToken] = useState(0);
  useEffect(() => setToken((n) => n + 1), [arr, mh, mc, UA, Thi, Tci]);
  const P = useLatest({ arr, Ch, Cc, UA, Thi, Tci, token });
  const r = rateHX(arr, UA, Ch, Cc, Thi, Tci);
  const prof = hxProfile(arr, UA, Ch, Cc, Thi, Tci, 60);
  const curve = range(0, 5, 60).map((n) => ({ x: n, y: effectiveness(arr, n, r.Cr) }));

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const holder = new THREE.Group();
    scene.add(holder);
    let last = -1;
    const segs = 24;
    const Lx = 5.2;
    let hot: THREE.Mesh[] = [];
    let cold: THREE.Mesh[] = [];
    const flow: { m: THREE.Mesh; x: number; hotSide: boolean }[] = [];
    const build = () => {
      holder.clear();
      hot = [];
      cold = [];
      flow.length = 0;
      // shell (annulus, hot fluid) as segments, inner tube (cold) as segments
      for (let i = 0; i < segs; i++) {
        const x = -Lx / 2 + ((i + 0.5) * Lx) / segs;
        const sh = cyl(0.62, 0.62, Lx / segs + 0.004, new THREE.MeshStandardMaterial({ color: '#ff6a3c', transparent: true, opacity: 0.38, roughness: 0.3, depthWrite: false }), 40);
        sh.rotation.z = Math.PI / 2;
        sh.position.set(x, 0.9, 0);
        holder.add(sh);
        hot.push(sh);
        const tb = cyl(0.3, 0.3, Lx / segs + 0.004, new THREE.MeshStandardMaterial({ color: '#4aa8ff', roughness: 0.3, metalness: 0.2 }), 36);
        tb.rotation.z = Math.PI / 2;
        tb.position.set(x, 0.9, 0);
        holder.add(tb);
        cold.push(tb);
      }
      // end caps and nozzles
      holder.add(box(0.12, 1.5, 1.5, metal('#9aa6b5', 0.3), [-Lx / 2 - 0.08, 0.9, 0]));
      holder.add(box(0.12, 1.5, 1.5, metal('#9aa6b5', 0.3), [Lx / 2 + 0.08, 0.9, 0]));
      // flow particles (small spheres) in each stream
      for (let i = 0; i < 26; i++) {
        const pm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
        const hs = i % 2 === 0;
        flow.push({ m: pm, x: Math.random() * Lx, hotSide: hs });
        holder.add(pm);
      }
    };
    return {
      update: (dt: number) => {
        const q = P.current;
        if (q.token !== last) {
          last = q.token;
          build();
        }
        const pr = hxProfile(q.arr, q.UA, q.Ch, q.Cc, q.Thi, q.Tci, segs);
        const tmin = Math.min(q.Tci, q.Thi);
        const tmax = Math.max(q.Tci, q.Thi);
        for (let i = 0; i < segs; i++) {
          const th = (pr.Th[i] + pr.Th[i + 1]) / 2;
          const tc = (pr.Tc[i] + pr.Tc[i + 1]) / 2;
          (hot[i].material as THREE.MeshStandardMaterial).color.copy(heatColor((th - tmin) / (tmax - tmin)));
          (hot[i].material as THREE.MeshStandardMaterial).emissive.copy(heatColor((th - tmin) / (tmax - tmin))).multiplyScalar(0.35);
          (cold[i].material as THREE.MeshStandardMaterial).color.copy(heatColor((tc - tmin) / (tmax - tmin)));
          (cold[i].material as THREE.MeshStandardMaterial).emissive.copy(heatColor((tc - tmin) / (tmax - tmin))).multiplyScalar(0.5);
        }
        for (const p of flow) {
          // hot stream flows +x (hot inlet at x = -Lx/2 -> index 0); cold goes +x for parallel, -x for counter
          const dir = p.hotSide ? 1 : q.arr === 'counter' ? -1 : 1;
          p.x += dir * dt * (p.hotSide ? 0.6 + 0.4 * (q.Ch / 3000) : 0.6 + 0.4 * (q.Cc / 3000)) * 1.2;
          if (p.x > Lx / 2) p.x -= Lx;
          if (p.x < -Lx / 2) p.x += Lx;
          const ang = (p.x * 3 + (p.hotSide ? 0 : 1.5)) % (Math.PI * 2);
          p.m.position.set(p.x, 0.9 + (p.hotSide ? 0.47 : 0) * Math.cos(ang), (p.hotSide ? 0.47 : 0.12) * Math.sin(ang));
        }
      },
    };
  };

  return (
    <SimFrame title="Heat-exchanger lab (double pipe)" subtitle={<span>ε–NTU rating; temperatures along the exchanger from the local energy balance</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={300} camera={[0, 2.8, 6.4]} target={[0, 0.9, 0]} caption="Outer pipe: hot oil (enters on the left). Inner tube: cold water. Colours show the local temperature along the length." />
            <Plot
              x={[0, 1]}
              y={[Math.min(Tci, r.Tho) - 3, Thi + 3]}
              series={[
                { points: prof.x.map((x, i) => ({ x, y: prof.Th[i] })), color: 'var(--c3)', label: 'hot oil' },
                { points: prof.x.map((x, i) => ({ x, y: prof.Tc[i] })), color: 'var(--c1)', label: 'cold water' },
              ]}
              height={230}
              xLabel="position (hot inlet at 0)"
              yLabel="T (°C)"
              legend
            />
          </>
        }
        right={
          <>
            <div style={{ display: 'flex', gap: 6, margin: '4px 0' }}>
              {(['counter', 'parallel'] as const).map((a) => (
                <button key={a} className={`btn ${arr === a ? 'primary' : ''}`} onClick={() => setArr(a)}>
                  {a}flow
                </button>
              ))}
            </div>
            <Slider label="oil flow ṁ (cp 2100)" value={mh} min={0.2} max={4} step={0.05} onChange={setMh} unit=" kg/s" />
            <Slider label="water flow ṁ (cp 4180)" value={mc} min={0.2} max={4} step={0.05} onChange={setMc} unit=" kg/s" />
            <Slider label="UA" value={UA} min={200} max={10000} step={50} onChange={setUA} unit=" W/K" />
            <Slider label="oil inlet" value={Thi} min={60} max={200} step={1} onChange={setThi} unit=" °C" />
            <Slider label="water inlet" value={Tci} min={5} max={50} step={1} onChange={setTci} unit=" °C" />
            <Readout
              items={[
                ['C_min / C_max', `${f(r.Cmin, 4)} / ${f(r.Cmax, 4)} (C_r ${f(r.Cr, 3)})`],
                ['NTU', f(r.NTU, 4)],
                ['ε', f(r.eps, 4)],
                ['Q', `${f(r.Q)} W`],
                ['oil out', `${f(r.Tho, 4)} °C`],
                ['water out', `${f(r.Tco, 4)} °C`],
              ]}
            />
            <Plot x={[0, 5]} y={[0, 1]} series={[{ points: curve, color: 'var(--c2)', label: `ε(NTU), Cr = ${f(r.Cr, 3)}` }]} dots={[{ x: r.NTU, y: r.eps }]} height={180} xLabel="NTU" yLabel="ε" />
          </>
        }
      />
    </SimFrame>
  );
}

/* ============================== FurnaceLab ============================== */
export function FurnaceLab() {
  const [T1, setT1] = useState(900);
  const [T2, setT2] = useState(400);
  const [e1, setE1] = useState(0.9);
  const [e2, setE2] = useState(0.7);
  const [gap, setGap] = useState(1);
  const [rerad, setRerad] = useState(true);
  const [T3, setT3] = useState(300);
  const [e3, setE3] = useState(0.8);
  const P = useLatest({ T1, T2, e1, e2, gap, rerad, T3, e3 });

  const F12 = F_parallelRect(1, 1, gap);
  const A1 = 1;
  const A2 = 1;
  const A3 = 4 * gap; // four side walls of height gap
  const F13 = 1 - F12;
  const F21 = F12;
  const F23 = 1 - F21;
  const F31 = (A1 * F13) / A3;
  const F32 = (A2 * F23) / A3;
  const F33 = 1 - F31 - F32;
  const Fm = [
    [0, F12, F13],
    [F21, 0, F23],
    [F31, F32, F33],
  ];
  const res = enclosure([{ A: A1, eps: e1, T: T1 }, { A: A2, eps: e2, T: T2 }, rerad ? { A: A3, eps: e3, Q: 0 } : { A: A3, eps: e3, T: T3 }], Fm);
  const curve = range(0.2, 3, 50).map((g) => {
    const f12 = F_parallelRect(1, 1, g);
    const a3 = 4 * g;
    const f13 = 1 - f12;
    const f23 = 1 - f12;
    const m = [
      [0, f12, f13],
      [f12, 0, f23],
      [(A1 * f13) / a3, (A2 * f23) / a3, 1 - (A1 * f13) / a3 - (A2 * f23) / a3],
    ];
    const rr = enclosure([{ A: A1, eps: e1, T: T1 }, { A: A2, eps: e2, T: T2 }, rerad ? { A: a3, eps: e3, Q: 0 } : { A: a3, eps: e3, T: T3 }], m);
    return { x: g, y: -rr.Q[1] / 1000 };
  });

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 2), new THREE.MeshStandardMaterial({ color: '#222', emissive: '#ff4000', emissiveIntensity: 1.8 }));
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 2), new THREE.MeshStandardMaterial({ color: '#222', emissive: '#aa2000', emissiveIntensity: 1.8 }));
    scene.add(floor, ceil);
    const walls: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshStandardMaterial({ color: '#333', emissive: '#661500', emissiveIntensity: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      walls.push(w);
      scene.add(w);
    }
    const N = 80;
    const photons: { m: THREE.Mesh; t: number; x: number; z: number; dir: number }[] = [];
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
      scene.add(m);
      photons.push({ m, t: Math.random(), x: (Math.random() - 0.5) * 1.8, z: (Math.random() - 0.5) * 1.8, dir: Math.random() < 0.5 ? 1 : -1 });
    }
    return {
      update: (dt: number) => {
        const q = P.current;
        const c = 2.2 * Math.max(0.2, q.gap);
        floor.position.set(0, 0.06, 0);
        ceil.position.set(0, 0.06 + c, 0);
        const F12n = F_parallelRect(1, 1, q.gap);
        const A3n = 4 * q.gap;
        const Fq = [
          [0, F12n, 1 - F12n],
          [F12n, 0, 1 - F12n],
          [(1 - F12n) / A3n, (1 - F12n) / A3n, 1 - (2 * (1 - F12n)) / A3n],
        ];
        const rr = enclosure([{ A: 1, eps: q.e1, T: q.T1 }, { A: 1, eps: q.e2, T: q.T2 }, q.rerad ? { A: A3n, eps: q.e3, Q: 0 } : { A: A3n, eps: q.e3, T: q.T3 }], Fq);
        (floor.material as THREE.MeshStandardMaterial).emissive.copy(glowColor(q.T1));
        (ceil.material as THREE.MeshStandardMaterial).emissive.copy(glowColor(q.T2));
        const Tw = rr.T[2];
        walls.forEach((w, i) => {
          (w.material as THREE.MeshStandardMaterial).emissive.copy(glowColor(Tw));
          const ang = (i * Math.PI) / 2;
          w.scale.set(1, c, 1);
          w.position.set(Math.sin(ang) * 1.0, 0.06 + c / 2, Math.cos(ang) * 1.0);
          w.rotation.y = ang;
        });
        for (const p of photons) {
          // photons go from the hotter to the colder plate, some bounce off the side walls
          p.t += dt * 0.6 * p.dir;
          if (p.t > 1) p.t -= 1;
          if (p.t < 0) p.t += 1;
          const y = 0.06 + p.t * c;
          p.m.position.set(p.x * (1 - 0.25 * Math.sin(p.t * Math.PI)), y, p.z);
          (p.m.material as THREE.MeshBasicMaterial).color.copy(glowColor(q.T1 * (1 - p.t) + q.T2 * p.t).addScalar(0.15));
        }
      },
    };
  };

  return (
    <SimFrame title="Radiation furnace lab" subtitle={<span>floor, ceiling and four side walls: radiosity network (surface and space resistances)</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={330} camera={[4.6, 3.4, 4.6]} target={[0, 1.1, 0]} caption="Surfaces glow with their own temperature (emissive colour). The side walls are insulated: they re-radiate and float to the temperature shown on the right." />
            <Plot x={[0.2, 3]} y={[0, Math.max(...curve.map((c) => c.y)) * 1.1]} series={[{ points: curve, color: 'var(--c1)', label: 'Q to the ceiling (kW) vs spacing' }]} vlines={[{ x: gap, dash: true, label: 'now' }]} height={210} xLabel="plate spacing (m), plates 1 m × 1 m" yLabel="Q₁₂ (kW)" />
          </>
        }
        right={
          <>
            <Slider label="floor temperature T₁" value={T1} min={500} max={1500} step={10} onChange={setT1} unit=" K" />
            <Slider label="ceiling temperature T₂" value={T2} min={300} max={900} step={10} onChange={setT2} unit=" K" />
            <Slider label="ε₁" value={e1} min={0.05} max={1} step={0.05} onChange={setE1} />
            <Slider label="ε₂" value={e2} min={0.05} max={1} step={0.05} onChange={setE2} />
            <Slider label="spacing" value={gap} min={0.2} max={3} step={0.05} onChange={setGap} unit=" m" />
            <label style={{ fontSize: '.9rem' }}>
              <input type="checkbox" checked={rerad} onChange={(e) => setRerad(e.target.checked)} /> side walls insulated (reradiating)
            </label>
            {!rerad && <Slider label="side-wall temperature" value={T3} min={250} max={900} step={10} onChange={setT3} unit=" K" />}
            <Slider label="ε₃ (side walls)" value={e3} min={0.05} max={1} step={0.05} onChange={setE3} />
            <Readout
              items={[
                ['F₁₂ (parallel squares)', f(F12, 4)],
                ['Q₁ (floor)', `${f(res.Q[0])} W`],
                ['Q₂ (ceiling)', `${f(res.Q[1])} W`],
                ['Q₃ (side walls)', `${f(res.Q[2])} W`],
                ['T₃', `${f(res.T[2], 4)} K`],
                ['E_b1, E_b2', `${f(Eb(T1))}, ${f(Eb(T2))} W/m²`],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}

/* ============================== PlumeLab ============================== */
export function PlumeLab() {
  const [orient, setOrient] = useState<'vert' | 'hup' | 'hdown'>('hup');
  const [dT, setDT] = useState(40);
  const [L, setL] = useState(0.3);
  const [fl, setFl] = useState<'air' | 'water'>('air');
  const [Tinf, setTinf] = useState(20);
  const P = useLatest({ orient, dT, L, fl, Tinf });
  const [token, setToken] = useState(0);
  useEffect(() => setToken((n) => n + 1), [orient]);
  const pr = (fl === 'air' ? air : water)(Tinf + dT / 2);
  const Lc = orient === 'vert' ? L : L / 4;
  const Ra = Rayleigh(pr.beta, dT, Lc, pr.nu, pr.alpha);
  const Nu = orient === 'vert' ? NuVerticalFull(Ra, pr.Pr) : NuHorizontalPlate(Ra, orient === 'hup');
  const h = (Nu * pr.k) / Lc;
  const Q = h * L * L * dT;
  const curve = range(2, 120, 60).map((d) => {
    const p2 = (fl === 'air' ? air : water)(Tinf + d / 2);
    const R = Rayleigh(p2.beta, d, Lc, p2.nu, p2.alpha);
    const n = orient === 'vert' ? NuVerticalFull(R, p2.Pr) : NuHorizontalPlate(R, orient === 'hup');
    return { x: d, y: (n * p2.k) / Lc };
  });

  const setup = (ctx: StudioCtx) => {
    const { scene } = ctx;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.6), new THREE.MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.5 }));
    scene.add(plate);
    const N = 700;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.075, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(pts);
    const part = Array.from({ length: N }, () => ({ s: Math.random(), u: Math.random(), v: Math.random(), z: Math.random() * 3, age: Math.random() }));
    let lastO = '';
    const respawn = (p: (typeof part)[number]) => {
      p.u = Math.random();
      p.v = Math.random();
      p.z = 0;
      p.age = 0;
    };
    return {
      update: (dt: number) => {
        const q = P.current;
        const pp = (q.fl === 'air' ? air : water)(q.Tinf + q.dT / 2);
        const g = 9.81 * pp.beta * q.dT;
        const vScale = Math.sqrt(Math.max(1e-6, g * 0.3)) * (q.fl === 'air' ? 1 : 0.6);
        if (q.orient !== lastO) {
          lastO = q.orient;
          if (q.orient === 'vert') {
            plate.scale.set(0.08 / 1.6, 1, 1);
            plate.geometry.dispose();
            plate.geometry = new THREE.BoxGeometry(0.08, 2.0, 1.6);
            plate.position.set(0, 1.0, 0);
            plate.scale.set(1, 1, 1);
          } else {
            plate.geometry.dispose();
            plate.geometry = new THREE.BoxGeometry(1.6, 0.08, 1.6);
            plate.position.set(0, q.orient === 'hup' ? 0.04 : 2.0, 0);
            plate.scale.set(1, 1, 1);
          }
          part.forEach(respawn);
        }
        const tt = new THREE.Color();
        for (let i = 0; i < N; i++) {
          const p = part[i];
          p.age += dt;
          const rise = Math.min(1.8, 0.3 + vScale * 0.9);
          let x = 0;
          let y = 0;
          let z = 0;
          if (q.orient === 'vert') {
            // boundary layer on a vertical wall: thickness grows as (height)^(1/4)
            p.z += dt * rise * (0.4 + Math.min(1, p.z / 0.8)) * 0.9;
            const delta = 0.06 + 0.22 * Math.pow(Math.max(p.z, 0.01) / 2, 0.25);
            const eta = p.u;
            const prof = 4 * eta * (1 - eta) * (1 - eta) * 1.5;
            x = 0.06 + eta * delta + prof * 0.02;
            y = 0.02 + p.z;
            z = (p.v - 0.5) * 1.5;
            if (p.z > 2) respawn(p);
          } else {
            const up = q.orient === 'hup' ? 1 : -1;
            p.z += dt * rise * (0.35 + Math.min(1.2, p.z / 0.6));
            const pull = Math.max(0.15, 1 - p.z * (q.orient === 'hup' ? 0.28 : 0.1));
            x = (p.u - 0.5) * 1.5 * pull + Math.sin(p.age * 3 + p.s * 6) * 0.04 * p.z;
            z = (p.v - 0.5) * 1.5 * pull + Math.cos(p.age * 3 + p.s * 6) * 0.04 * p.z;
            if (q.orient === 'hup') y = 0.1 + p.z;
            else {
              // hot face down: the warm fluid cannot leave directly; it creeps sideways along the underside then drifts
              y = 1.98 - Math.min(p.z, 0.25) * 0.7 - Math.max(0, p.z - 0.25) * 0.0;
              x = (p.u - 0.5) * 1.5 + (p.u - 0.5) * 1.5 * Math.max(0, p.z - 0.2) * 1.4;
              z = (p.v - 0.5) * 1.5 + (p.v - 0.5) * 1.5 * Math.max(0, p.z - 0.2) * 1.4;
            }
            void up;
            if (p.z > (q.orient === 'hup' ? 3 : 1.4)) respawn(p);
          }
          pos[3 * i] = x;
          pos[3 * i + 1] = y;
          pos[3 * i + 2] = z;
          heatColor(Math.max(0, 1 - p.z / 2.2), tt);
          col[3 * i] = tt.r;
          col[3 * i + 1] = tt.g;
          col[3 * i + 2] = tt.b;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
      },
    };
  };
  void cyl;
  void token;
  void Controls;

  return (
    <SimFrame title="Natural-convection plume lab" subtitle={<span>Ra = gβΔT L³/(να); Churchill–Chu and horizontal-plate correlations</span>}>
      <LabGrid
        left={
          <>
            <Studio3D setup={setup} height={340} camera={[3.4, 2.6, 4.2]} target={[0, 1.0, 0]} caption="Warm fluid is lighter and rises. Hot face up: a free plume (h high). Hot face down: the fluid is trapped under the plate and must creep sideways (h half as large). Vertical: a boundary layer that thickens upward." />
            <Plot x={[2, 120]} y={[0, Math.max(...curve.map((c) => c.y)) * 1.1]} series={[{ points: curve, color: 'var(--c1)', label: 'h(ΔT)' }]} vlines={[{ x: dT, dash: true, label: 'now' }]} height={200} xLabel="ΔT (K)" yLabel="h (W/m²K)" />
          </>
        }
        right={
          <>
            <div style={{ display: 'flex', gap: 6, margin: '4px 0', flexWrap: 'wrap' }}>
              {(
                [
                  ['hup', 'hot face up'],
                  ['hdown', 'hot face down'],
                  ['vert', 'vertical'],
                ] as const
              ).map(([v, t]) => (
                <button key={v} className={`btn ${orient === v ? 'primary' : ''}`} onClick={() => setOrient(v)}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, margin: '4px 0' }}>
              {(['air', 'water'] as const).map((x) => (
                <button key={x} className={`btn ${fl === x ? 'primary' : ''}`} onClick={() => setFl(x)}>
                  {x}
                </button>
              ))}
            </div>
            <Slider label="ΔT (plate − fluid)" value={dT} min={2} max={120} step={1} onChange={setDT} unit=" K" />
            <Slider label="plate side / height L" value={L} min={0.05} max={1} step={0.01} onChange={setL} unit=" m" />
            <Slider label="fluid temperature" value={Tinf} min={0} max={40} step={1} onChange={setTinf} unit=" °C" />
            <Readout
              items={[
                ['Lc', `${f(Lc, 4)} m`],
                ['Ra', f(Ra, 4)],
                ['Nu', f(Nu, 4)],
                ['h', `${f(h)} W/m²K`],
                ['Q (one face)', `${f(Q)} W`],
                ['regime', orient === 'vert' ? (Ra < 1e9 ? 'laminar' : 'turbulent') : Ra < 1e7 ? 'laminar plume' : 'turbulent plume'],
              ]}
            />
          </>
        }
      />
    </SimFrame>
  );
}

void useMemo;
