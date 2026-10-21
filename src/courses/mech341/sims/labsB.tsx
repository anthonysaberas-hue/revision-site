/**
 * MECH 341 3D labs B: HvacLab (rooftop unit + cooling tower), BurnerLab (flame vs equivalence ratio), NozzleLab (C-D nozzle regimes).
 * Physics comes from the tested lib (psychro, combustion, equilibrium, compressible); scenes are built once and read sliders from refs.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import { Plot } from '../../../core/Plot';
import { Studio3D, StudioCtx, box, cyl, glass, metal, paint } from '../../mech412/viz/Studio3D';
import { LabGrid, useLatest } from '../../mech412/viz/LabKit';
import { FlowSection3D, FieldPoint } from '../../mech430/viz/FlowSection3D';
import { f } from '../viz/Kit';
import { PsychroChartView } from '../viz/Diagrams';
import { water, solve } from '../lib/props';
import { atmosphere, hbar, Sp, SPECIES } from '../lib/gas';
import { hAir, mixStreams, omega, psyState } from '../lib/psychro';
import { Fuel, aft, burn, dewPoint, Hreact } from '../lib/combustion';
import { equilibrium, lnKpAt } from '../lib/equilibrium';
import { P0_P, T0_T, areaRatio, critical, machFromAreaRatio, soundSpeed } from '../lib/compressible';
import { LabCheck, LabNote, bladeRow, cutMat, dotTex, heat, lerpTable, liveLabel, makeCloud, makePipe, pipeCloud, Cloud } from './labsA';

const PA = 101.325;

/* ====================================================================== HvacLab */
interface HvacIn {
  To: number;
  phiO: number;
  fOA: number; // outdoor-air fraction (of dry-air mass)
  ma: number; // supply dry-air mass flow, kg/s
  Tcoil: number; // coil leaving-air temperature, °C
  Tsup: number; // supply temperature after the reheat coil, °C
}
const RET = { T: 24, phi: 0.5 };
function hvacCalc(i: HvacIn) {
  const out = psyState({ T: i.To, P: PA, phi: i.phiO });
  const ret = psyState({ T: RET.T, P: PA, phi: RET.phi });
  const mix = mixStreams({ ma: i.ma * i.fOA, w: out.w, h: out.h }, { ma: i.ma * (1 - i.fOA), w: ret.w, h: ret.h }, PA);
  const coilOn = mix.T > i.Tcoil + 0.05;
  const wsat = omega(i.Tcoil, 0.95, PA);
  const wc = coilOn ? Math.min(mix.w, wsat) : mix.w;
  const Tc = coilOn ? i.Tcoil : mix.T;
  const hc = hAir(Tc, wc);
  const condensate = i.ma * (mix.w - wc); // kg/s
  const hf = water.satT(Tc).hf;
  const coilLoad = coilOn ? i.ma * (mix.h - hc - (mix.w - wc) * hf) : 0;
  const Tsup = Math.max(i.Tsup, Tc);
  const hs = hAir(Tsup, wc);
  const reheat = i.ma * (hs - hc);
  // chiller rejects the coil load plus compressor work (COP 4); cooling tower: approach 5 K to the wet bulb, range 8 K
  const Qcond = coilLoad * 1.25;
  const Tcw = out.Twb + 5;
  const Thw = Tcw + 8;
  const Tex = (Tcw + Thw) / 2 + 1;
  const sat = psyState({ T: Tex, P: PA, phi: 1 });
  const maT = Qcond > 0 ? Qcond / (sat.h - out.h) : 0;
  const evap = maT * (sat.w - out.w); // kg/s
  const makeup = (evap * 4) / 3; // 4 cycles of concentration: blowdown = evap/3
  const supply = psyState({ T: Tsup, P: PA, w: wc });
  const coilExit = psyState({ T: Tc, P: PA, w: wc });
  return { out, ret, mix, coilOn, wc, Tc, condensate, coilLoad, reheat, Tsup, Qcond, Tcw, Thw, Tex, maT, evap, makeup, supply, coilExit };
}

export function HvacLab() {
  const [To, setTo] = useState(34);
  const [phiO, setPhiO] = useState(0.55);
  const [fOA, setFOA] = useState(0.3);
  const [ma, setMa] = useState(3);
  const [Tcoil, setTcoil] = useState(11);
  const [Tsup, setTsup] = useState(16);
  const inp = { To, phiO, fOA, ma, Tcoil, Tsup };
  const r = hvacCalc(inp);
  const P = useLatest({ inp, r });

  const pts = useMemo(() => {
    const seg = (a: { T: number; w: number }, b: { T: number; w: number }, n: number) =>
      Array.from({ length: n }, (_, k) => ({ T: a.T + ((b.T - a.T) * (k + 1)) / (n + 1), w: a.w + ((b.w - a.w) * (k + 1)) / (n + 1), label: '' }));
    return [
      ...seg(r.out, r.mix, 7),
      ...seg(r.ret, r.mix, 7),
      ...seg(r.mix, { T: r.Tc, w: r.wc }, 9),
      ...seg({ T: r.Tc, w: r.wc }, { T: r.Tsup, w: r.wc }, 6),
      { T: r.out.T, w: r.out.w, label: 'OA' },
      { T: r.ret.T, w: r.ret.w, label: 'RA' },
      { T: r.mix.T, w: r.mix.w, label: 'M' },
      { T: r.Tc, w: r.wc, label: 'C' },
      { T: r.Tsup, w: r.wc, label: 'S' },
    ];
  }, [r.out.T, r.out.w, r.mix.T, r.mix.w, r.Tc, r.wc, r.Tsup, r.ret.T, r.ret.w]);

  const setup = (ctx: StudioCtx) => {
    const { scene, renderer, controls } = ctx;
    renderer.localClippingEnabled = true;
    controls.maxDistance = 30;
    scene.fog = new THREE.Fog('#070a12', 26, 60);
    const planes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    const root = new THREE.Group();
    scene.add(root);
    const M4 = new THREE.Matrix4();
    const tmp = new THREE.Color();
    const air = (T: number) => heat((T - 5) / 40, tmp);
    const gal = metal('#b3bcc8', 0.38);

    /* roof deck */
    root.add(box(16, 0.2, 4.6, new THREE.MeshStandardMaterial({ color: '#4e535b', roughness: 0.95 }), [-0.2, 0.0, 0]));

    /* ---------- rooftop unit ---------- */
    const U = { x0: -6.4, x1: -0.4, y0: 0.7, y1: 2.1, zh: 0.62 };
    const unit = new THREE.Group();
    root.add(unit);
    unit.add(box(U.x1 - U.x0 + 0.3, 0.34, 1.5, metal('#3a424e', 0.5), [(U.x0 + U.x1) / 2, 0.37, 0]));
    unit.add(box(U.x1 - U.x0, 0.06, 1.46, gal, [(U.x0 + U.x1) / 2, U.y1 + 0.03, 0]));
    unit.add(box(U.x1 - U.x0, 0.06, 1.46, gal, [(U.x0 + U.x1) / 2, U.y0 - 0.03, 0]));
    unit.add(box(U.x1 - U.x0, U.y1 - U.y0, 0.06, gal, [(U.x0 + U.x1) / 2, (U.y0 + U.y1) / 2, -U.zh - 0.03]));
    for (let i = 0; i < 9; i++) unit.add(box(0.03, U.y1 - U.y0, 0.02, metal('#8f9aa8', 0.35), [U.x0 + 0.5 + i * 0.69, (U.y0 + U.y1) / 2, -U.zh - 0.07]));
    // front: glass inspection panel with frame
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(U.x1 - U.x0, U.y1 - U.y0), new THREE.MeshPhysicalMaterial({ color: '#bcd8ff', roughness: 0.03, transparent: true, opacity: 0.1, side: THREE.DoubleSide }));
    glassPane.position.set((U.x0 + U.x1) / 2, (U.y0 + U.y1) / 2, U.zh + 0.03);
    unit.add(glassPane);
    for (const x of [U.x0, -4.9, -3.1, -0.4]) unit.add(box(0.07, U.y1 - U.y0 + 0.1, 0.07, metal('#d3d9e1', 0.3), [x, (U.y0 + U.y1) / 2, U.zh + 0.03]));
    for (const y of [U.y0, U.y1]) unit.add(box(U.x1 - U.x0, 0.06, 0.07, metal('#d3d9e1', 0.3), [(U.x0 + U.x1) / 2, y, U.zh + 0.03]));
    // outdoor-air louver on the left end + damper blades (angle = outdoor fraction)
    const oaBlades = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.17, 1.2), metal('#c9d0d9', 0.3), 8);
    unit.add(oaBlades);
    const raBlades = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.025, 0.06), metal('#c9d0d9', 0.3), 8);
    unit.add(raBlades);
    unit.add(box(0.05, 1.5, 0.05, gal, [U.x0 - 0.05, 1.4, U.zh]), box(0.05, 1.5, 0.05, gal, [U.x0 - 0.05, 1.4, -U.zh]));
    // return duct rising through the roof deck, open into the mixing box
    unit.add(box(0.7, 0.55, 1.1, gal, [-5.85, 0.4, 0]));
    // filter bank (V pleats)
    const filt = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1.3, 0.012), new THREE.MeshStandardMaterial({ color: '#e8edf2', roughness: 0.95 }), 22);
    for (let i = 0; i < 22; i++) {
      M4.makeRotationY(i % 2 ? 0.95 : -0.95);
      M4.setPosition(-5.0, 1.4, -0.57 + i * 0.054);
      filt.setMatrixAt(i, M4);
    }
    unit.add(filt);
    unit.add(box(0.05, 1.4, 1.24, metal('#8f9aa8', 0.4), [-5.2, 1.4, 0]));
    // cooling coil: fins parallel to the flow, stacked in y; copper U-bends on the front face
    const coilMat = new THREE.MeshStandardMaterial({ color: '#8fbfff', metalness: 1, roughness: 0.28, emissive: '#102a55', emissiveIntensity: 0.3 });
    const cFins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 0.008, 1.2), coilMat, 38);
    for (let i = 0; i < 38; i++) cFins.setMatrixAt(i, M4.makeTranslation(-4.1, 0.82 + i * 0.033, 0));
    unit.add(cFins);
    const cBends = new THREE.InstancedMesh(new THREE.TorusGeometry(0.06, 0.016, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#4d8fd6', metalness: 0.9, roughness: 0.25, emissive: '#16427a', emissiveIntensity: 0.6 }), 18);
    for (let i = 0; i < 18; i++) {
      M4.makeRotationY(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(-4.35 + (i % 3) * 0.25, 0.9 + Math.floor(i / 3) * 0.18, 0.62));
      cBends.setMatrixAt(i, M4);
    }
    unit.add(cBends);
    unit.add(box(0.05, 1.3, 1.24, metal('#8f9aa8', 0.4), [-3.62, 1.4, 0]), box(0.05, 1.3, 1.24, metal('#8f9aa8', 0.4), [-4.62, 1.4, 0]));
    // drain pan with water
    unit.add(box(1.3, 0.06, 1.2, metal('#d6dce3', 0.25), [-4.1, 0.74, 0]));
    const panWater = box(1.2, 0.02, 1.0, new THREE.MeshStandardMaterial({ color: '#3b8fe0', roughness: 0.05, transparent: true, opacity: 0.75 }), [-4.1, 0.79, 0]);
    unit.add(panWater);
    const drips = makeCloud(
      70,
      0.05,
      (u, a, b, out) => out.set(-4.45 + a * 0.7, 1.15 - u * 0.4, -0.5 + b * 1.0),
      '#9fd0ff',
    );
    root.add(drips.object);
    // reheat coil (hot)
    const rhMat = new THREE.MeshStandardMaterial({ color: '#d98a50', metalness: 1, roughness: 0.3, emissive: '#c0300c', emissiveIntensity: 0.6 });
    const rFins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.008, 1.2), rhMat, 38);
    for (let i = 0; i < 38; i++) rFins.setMatrixAt(i, M4.makeTranslation(-3.1, 0.82 + i * 0.033, 0));
    unit.add(rFins);
    const rBends = new THREE.InstancedMesh(new THREE.TorusGeometry(0.06, 0.016, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#c8562a', metalness: 0.9, roughness: 0.3, emissive: '#c0300c', emissiveIntensity: 0.9 }), 12);
    for (let i = 0; i < 12; i++) {
      M4.makeRotationY(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(-3.2 + (i % 2) * 0.2, 0.92 + Math.floor(i / 2) * 0.22, 0.62));
      rBends.setMatrixAt(i, M4);
    }
    unit.add(rBends);
    // supply fan: scroll housing (cut) + wheel
    const fanC = new THREE.Vector3(-1.85, 1.4, 0);
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 1.0, 56, 1, true), cutMat({ color: '#9fb0c4', metalness: 0.8, roughness: 0.4 }, '#4a5668', planes));
    scroll.rotation.x = Math.PI / 2;
    scroll.position.copy(fanC);
    unit.add(scroll);
    const wheel = new THREE.Group();
    const vanes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.22, 0.9), metal('#cdd5de', 0.28), 28);
    for (let i = 0; i < 28; i++) {
      M4.makeRotationZ((i / 28) * Math.PI * 2);
      M4.multiply(new THREE.Matrix4().makeTranslation(0.42, 0, 0));
      M4.multiply(new THREE.Matrix4().makeRotationZ(0.55));
      vanes.setMatrixAt(i, M4);
    }
    wheel.add(vanes);
    for (const z of [-0.45, 0.45]) {
      const plate = cyl(0.5, 0.5, 0.015, metal('#aeb8c4', 0.3), 40);
      plate.rotation.x = Math.PI / 2;
      plate.position.z = z;
      wheel.add(plate);
    }
    wheel.position.copy(fanC);
    unit.add(wheel);
    const motor = cyl(0.2, 0.2, 0.45, paint('#2b5c8f', 0.45, 0.5), 28);
    motor.rotation.x = Math.PI / 2;
    motor.position.set(-1.85, 1.4, -0.9);
    unit.add(motor);
    // supply grille
    const sup = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.06, 1.2), metal('#c9d0d9', 0.3), 14);
    for (let i = 0; i < 14; i++) sup.setMatrixAt(i, M4.makeTranslation(U.x1 + 0.02, 0.8 + i * 0.09, 0));
    unit.add(sup);
    // chilled-water pipes to the coil
    const chS = makePipe([[0.7, 0.62, -0.5], [0.35, 0.62, -1.0], [-4.3, 0.5, -1.0], [-4.3, 2.35, -1.0], [-4.3, 2.35, -0.5], [-4.3, 1.9, -0.5]], 0.045, 0.12);
    const chR = makePipe([[0.7, 0.9, -0.5], [0.45, 0.9, -1.25], [-3.95, 0.7, -1.25], [-3.95, 2.45, -1.25], [-3.95, 2.45, -0.45], [-3.95, 1.9, -0.45]], 0.045, 0.12);
    chS.setColor(heat((7 - 5) / 40));
    chR.setColor(heat((12 - 5) / 40));
    const chSc = pipeCloud(chS.path, 40, 0.07, 0.03);
    const chRc = pipeCloud(chR.path, 40, 0.07, 0.03);
    (chSc.object.material as THREE.PointsMaterial).color.copy(heat(0.08)).lerp(new THREE.Color('#fff'), 0.4);
    (chRc.object.material as THREE.PointsMaterial).color.copy(heat(0.2)).lerp(new THREE.Color('#fff'), 0.4);
    root.add(chS.object, chR.object, chSc.object, chRc.object);

    /* ---------- chiller ---------- */
    const chiller = new THREE.Group();
    root.add(chiller);
    const evapShell = cyl(0.3, 0.3, 1.5, paint('#2f6ea8', 0.35, 0.6), 40);
    evapShell.rotation.z = Math.PI / 2;
    evapShell.position.set(1.5, 0.62, -0.5);
    const condShell = cyl(0.3, 0.3, 1.5, paint('#a85a2f', 0.35, 0.6), 40);
    condShell.rotation.z = Math.PI / 2;
    condShell.position.set(1.5, 1.28, -0.5);
    const comp = cyl(0.28, 0.28, 0.5, metal('#8b97a6', 0.3), 32);
    comp.rotation.z = Math.PI / 2;
    comp.position.set(2.55, 0.95, -0.5);
    const mot = cyl(0.24, 0.24, 0.5, paint('#24527a', 0.4, 0.5), 32);
    mot.rotation.z = Math.PI / 2;
    mot.position.set(3.0, 0.95, -0.5);
    for (const x of [0.78, 2.22]) {
      for (const y of [0.62, 1.28]) {
        const cap = cyl(0.33, 0.33, 0.06, metal('#c9d0d9', 0.3), 36);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(x, y, -0.5);
        chiller.add(cap);
      }
    }
    chiller.add(evapShell, condShell, comp, mot, box(2.6, 0.12, 0.8, metal('#3a424e', 0.5), [1.9, 0.26, -0.5]));
    root.add(chiller);

    /* ---------- hyperbolic cooling tower (half-section) ---------- */
    const TX = 5.2;
    const rAt = (y: number) => Math.sqrt(0.95 * 0.95 + 0.1131 * (y - 3.1) * (y - 3.1));
    const ys: number[] = [];
    for (let k = 0; k <= 22; k++) ys.push(0.95 + (3.75 * k) / 22);
    const shellPts: THREE.Vector2[] = [];
    for (const y of ys) shellPts.push(new THREE.Vector2(rAt(y), y));
    for (let k = ys.length - 1; k >= 0; k--) shellPts.push(new THREE.Vector2(rAt(ys[k]) + 0.07, ys[k]));
    shellPts.push(shellPts[0].clone());
    shellPts.reverse();
    const shellG = new THREE.LatheGeometry(shellPts, 72);
    const tower = new THREE.Mesh(shellG, cutMat({ color: '#a6a39b', metalness: 0.05, roughness: 0.92 }, '#6f6c66', planes));
    tower.position.set(TX, 0, 0);
    root.add(tower);
    // basin + legs
    const basin = cyl(1.9, 1.9, 0.3, new THREE.MeshStandardMaterial({ color: '#777b82', roughness: 0.95 }), 56);
    basin.position.set(TX, 0.15, 0);
    root.add(basin);
    const water = cyl(1.75, 1.75, 0.04, new THREE.MeshStandardMaterial({ color: '#2f7fd0', roughness: 0.05, transparent: true, opacity: 0.8 }), 56);
    water.position.set(TX, 0.31, 0);
    root.add(water);
    const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.78, 0.1), new THREE.MeshStandardMaterial({ color: '#8d8a83', roughness: 0.9 }), 14);
    for (let i = 0; i < 14; i++) {
      const th = (i / 14) * Math.PI * 2;
      M4.makeTranslation(TX + Math.cos(th) * 1.5, 0.62, Math.sin(th) * 1.5);
      legs.setMatrixAt(i, M4);
    }
    root.add(legs);
    // film fill: crossed slats in layers
    const fill = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.03, 0.07), new THREE.MeshStandardMaterial({ color: '#7f9a8a', roughness: 0.5, metalness: 0.1, clippingPlanes: planes, side: THREE.DoubleSide }), 40);
    let fi = 0;
    for (let layer = 0; layer < 3; layer++)
      for (let k = 0; k < 13; k++) {
        const th = (k / 13) * Math.PI + layer * 0.5;
        M4.makeRotationY(th);
        M4.setPosition(TX, 1.05 + layer * 0.16, 0);
        fill.setMatrixAt(fi++, M4);
      }
    fill.count = fi;
    root.add(fill);
    // spray headers and nozzles
    for (const r0 of [0.45, 0.9]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r0, 0.03, 8, 48), metal('#7d8794', 0.35));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(TX, 1.9, 0);
      root.add(ring);
    }
    const nozz = new THREE.InstancedMesh(new THREE.ConeGeometry(0.04, 0.09, 10), metal('#d1a24a', 0.3), 30);
    for (let i = 0; i < 30; i++) {
      const r0 = i < 10 ? 0.45 : 0.9;
      const n0 = i < 10 ? 10 : 20;
      const th = ((i < 10 ? i : i - 10) / n0) * Math.PI * 2;
      M4.makeRotationX(Math.PI);
      M4.setPosition(TX + Math.cos(th) * r0, 1.82, Math.sin(th) * r0);
      nozz.setMatrixAt(i, M4);
    }
    root.add(nozz);
    // clipped half of the tower: water droplets (hot at top → cold at the bottom)
    const spray = makeCloud(
      200,
      0.055,
      (u, a, b, out) => {
        const rr = 1.25 * Math.sqrt(a);
        out.set(TX + rr * Math.cos(b * 6.283), 1.85 - u * 0.95, rr * Math.sin(b * 6.283));
      },
      (u, c) => {
        const { Thw, Tcw } = P.current.r;
        c.copy(heat((Thw + (Tcw - Thw) * u - 5) / 40)).lerp(new THREE.Color('#fff'), 0.3);
      },
      { planes },
    );
    root.add(spray.object);
    // draft air: in at the base, up through the fill and the throat
    const draft = makeCloud(
      170,
      0.07,
      (u, a, b, out) => {
        const th = b * 6.283;
        if (u < 0.22) {
          const k = u / 0.22;
          const rr = 2.3 - 1.4 * k;
          out.set(TX + rr * Math.cos(th), 0.45 + 0.4 * a + 0.35 * k, rr * Math.sin(th));
        } else {
          const y = 0.95 + ((u - 0.22) / 0.78) * 3.7;
          const rr = rAt(y) * 0.85 * Math.sqrt(a);
          out.set(TX + rr * Math.cos(th), y, rr * Math.sin(th));
        }
      },
      (u, c) => c.set('#bfe4ff').lerp(new THREE.Color('#ffe3b8'), Math.min(1, u * 1.2)).multiplyScalar(0.55),
      { planes },
    );
    root.add(draft.object);
    // plume above the shell
    const plumeTex = dotTex(0.05);
    const plume = makeCloud(
      150,
      1.0,
      (u, a, b, out) => out.set(TX + (a - 0.5) * (0.6 + 1.6 * u) + 0.6 * u * u, 4.8 + u * 3.6, (b - 0.5) * (0.6 + 1.6 * u)),
      (u, c) => c.setScalar(0.5 * (1 - u) ** 1.2),
      { tex: plumeTex },
    );
    root.add(plume.object);
    // condenser-water pipes between the chiller and the tower
    const hotPipe = makePipe([[2.25, 1.28, -0.2], [2.9, 1.28, 0.5], [3.4, 1.28, 0.5], [3.4, 1.9, 0.4], [TX - 0.9, 1.9, 0.2]], 0.05, 0.14);
    const coldPipe = makePipe([[TX - 1.2, 0.34, 0.55], [3.2, 0.34, 0.55], [2.9, 0.62, 0.2], [2.25, 0.62, -0.2]], 0.05, 0.14);
    const hpC = pipeCloud(hotPipe.path, 40, 0.08, 0.035);
    const cpC = pipeCloud(coldPipe.path, 40, 0.08, 0.035);
    root.add(hotPipe.object, coldPipe.object, hpC.object, cpC.object);

    /* ---------- the air stream through the unit ---------- */
    const place = (x0: number, x1: number) => (u: number, a: number, b: number, out: THREE.Vector3) =>
      out.set(x0 + u * (x1 - x0), 0.8 + 1.25 * a, (b - 0.5) * 1.1);
    const oaCloud = makeCloud(110, 0.07, place(-6.9, -5.3), (u, c) => c.copy(air(P.current.r.out.T)).multiplyScalar(0.9), { planes });
    const raCloud = makeCloud(
      110,
      0.07,
      (u, a, b, out) => {
        if (u < 0.5) out.set(-5.85 + (a - 0.5) * 0.5, 0.2 + 1.0 * (u / 0.5), (b - 0.5) * 0.9);
        else out.set(-5.85 + ((u - 0.5) / 0.5) * 0.7, 1.2 + 0.9 * a, (b - 0.5) * 1.0);
      },
      (u, c) => c.copy(air(RET.T)).multiplyScalar(0.9),
      { planes },
    );
    const X = (u: number) => -5.3 + u * 5.2; // mixed stream from -5.3 to -0.1
    const mixCloud = makeCloud(
      420,
      0.06,
      (u, a, b, out) => out.set(X(u), 0.8 + 1.25 * a, (b - 0.5) * 1.1),
      (u, c) => {
        const { r } = P.current;
        const T = lerpTable([[-5.3, r.mix.T], [-4.75, r.mix.T], [-3.65, r.Tc], [-3.3, r.Tc], [-2.8, r.Tsup], [-0.1, r.Tsup]], X(u));
        c.copy(air(T)).multiplyScalar(0.85);
      },
      { planes },
    );
    const outCloud = makeCloud(
      80,
      0.09,
      (u, a, b, out) => out.set(-0.3 + u * 1.3, 0.85 + 1.2 * a + 0.2 * u, (b - 0.5) * (1.0 + 0.6 * u)),
      (u, c) => c.copy(air(P.current.r.Tsup)).multiplyScalar(0.7 * (1 - u)),
    );
    root.add(oaCloud.object, raCloud.object, mixCloud.object, outCloud.object);

    const lab = (txt: string, x: number, y: number, z = 0) => {
      const L = liveLabel(0.3);
      L.sprite.position.set(x, y, z);
      L.set(txt);
      root.add(L.sprite);
      return L;
    };
    lab('mixing box', -5.85, 2.75, 0.3);
    const lcc = lab('cooling coil', -4.1, 2.75, 0.3);
    const lrh = lab('reheat coil', -3.1, 3.3, 0.3);
    lab('supply fan', -1.85, 2.75, 0.3);
    lab('chiller', 1.5, 2.05, 0);
    lab('cooling tower', TX, 5.0, 1.2);
    const lPlume = liveLabel(0.3);
    lPlume.sprite.position.set(TX + 0.8, 8.9, 0.5);
    root.add(lPlume.sprite);

    return {
      update: (dt: number) => {
        const { inp: p, r: q } = P.current;
        // dampers: outdoor-air blades open with the outdoor fraction
        const ang = (1 - p.fOA) * 1.35;
        for (let i = 0; i < 8; i++) {
          M4.makeRotationZ(ang).setPosition(U.x0 + 0.02, 0.88 + i * 0.17, 0);
          oaBlades.setMatrixAt(i, M4);
          M4.makeRotationZ(-(p.fOA) * 1.35 * 0.0 + p.fOA * 1.35).setPosition(-5.85 + 0.0, 0.7 + 0.0, -0.45 + (i * 0.9) / 7 + 0.0);
          raBlades.setMatrixAt(i, M4);
        }
        oaBlades.instanceMatrix.needsUpdate = true;
        raBlades.instanceMatrix.needsUpdate = true;
        const v = 0.04 + 0.022 * p.ma;
        oaCloud.update(dt, v * (0.4 + 1.6 * p.fOA));
        oaCloud.object.visible = p.fOA > 0.02;
        (oaCloud.object.material as THREE.PointsMaterial).opacity = 0.2 + 0.75 * p.fOA;
        raCloud.update(dt, v * (0.5 + 1.2 * (1 - p.fOA)));
        (raCloud.object.material as THREE.PointsMaterial).opacity = 0.2 + 0.75 * (1 - p.fOA);
        mixCloud.update(dt, v * 0.7);
        outCloud.update(dt, v * 0.7);
        wheel.rotation.z -= dt * (4 + 2.2 * p.ma);
        // cooling coil: wet and cold when it dehumidifies; the fins tint with the coil temperature
        coilMat.color.copy(heat((q.Tc - 5) / 40)).lerp(new THREE.Color('#dfeaf7'), 0.6);
        coilMat.emissive.copy(heat((q.Tc - 5) / 40)).multiplyScalar(q.coilOn ? 0.22 : 0.02);
        coilMat.roughness = q.condensate > 1e-6 ? 0.12 : 0.3;
        const cr = Math.min(1, q.condensate / 0.012);
        drips.object.visible = q.condensate > 1e-6;
        drips.update(dt, 0.35 + 1.0 * cr);
        (drips.object.material as THREE.PointsMaterial).opacity = 0.35 + 0.65 * cr;
        panWater.scale.y = 1 + 3 * cr;
        // reheat coil glows when on
        const rr = Math.min(1, q.reheat / 20);
        rhMat.emissiveIntensity = 0.1 + 1.0 * rr;
        rhMat.color.copy(heat((q.Tsup - 5) / 40)).lerp(new THREE.Color('#d98a50'), 0.4);
        // water loops
        const loop = 0.05 + 0.18 * Math.min(1, q.coilLoad / 40);
        chSc.update(dt, q.coilOn ? loop : 0.01);
        chRc.update(dt, q.coilOn ? loop : 0.01);
        hotPipe.setColor(heat((q.Thw - 5) / 40));
        coldPipe.setColor(heat((q.Tcw - 5) / 40));
        (hpC.object.material as THREE.PointsMaterial).color.copy(heat((q.Thw - 5) / 40)).lerp(new THREE.Color('#fff'), 0.4);
        (cpC.object.material as THREE.PointsMaterial).color.copy(heat((q.Tcw - 5) / 40)).lerp(new THREE.Color('#fff'), 0.4);
        const tl = q.Qcond > 0 ? 0.06 + 0.12 * Math.min(1, q.Qcond / 60) : 0.01;
        hpC.update(dt, tl);
        cpC.update(dt, tl);
        spray.update(dt, q.Qcond > 0 ? 0.9 : 0.1);
        draft.update(dt, q.Qcond > 0 ? 0.08 + 0.08 * Math.min(1, q.Qcond / 60) : 0.03);
        // plume: size and brightness grow with the evaporation rate
        const s = Math.min(1.6, q.evap / 0.012);
        const pm = plume.object.material as THREE.PointsMaterial;
        pm.size = 0.25 + 1.6 * Math.sqrt(s);
        pm.opacity = Math.min(0.9, 0.04 + 0.5 * s);
        plume.update(dt, 0.04 + 0.05 * s);
        lcc.set(q.coilOn ? `cooling coil · ${f(q.Tc, 3)} °C off-coil` : 'cooling coil · idle');
        lrh.set(q.reheat > 0.05 ? `reheat coil · ${f(q.reheat, 3)} kW` : 'reheat coil · off');
        lPlume.set(`evaporation ${f(q.evap * 3600, 3)} kg/h`);
      },
    };
  };

  const f1 = (v: number) => f(v, 4);
  return (
    <SimFrame title="HVAC and cooling-tower lab" subtitle={<span>mixing → cooling coil (dehumidifies) → reheat → fan, and the tower that rejects the heat</span>}>
      <LabGrid
        left={
          <>
            <Studio3D
              setup={setup}
              height={420}
              camera={[0.4, 4.4, 21]}
              target={[0.4, 3.0, 0]}
              fov={38}
              caption="Cut-away rooftop unit (left) feeding a chiller and a hyperbolic cooling tower (right). Air particles are coloured by dry-bulb temperature; the coil drips condensate when it dehumidifies; the plume grows with the evaporation rate."
            />
            <PsychroChartView points={pts} P={PA} />
          </>
        }
        right={
          <>
            <Slider label="outdoor temperature" value={To} min={18} max={42} step={0.5} onChange={setTo} unit=" °C" />
            <Slider label="outdoor humidity φ" value={phiO} min={0.2} max={0.95} step={0.01} onChange={setPhiO} format={(v) => `${Math.round(v * 100)}`} unit=" %" />
            <Slider label="outdoor-air fraction" value={fOA} min={0} max={1} step={0.05} onChange={setFOA} format={(v) => `${Math.round(v * 100)}`} unit=" %" />
            <Slider label="supply air flow" value={ma} min={1} max={10} step={0.1} onChange={setMa} format={(v) => v.toFixed(1)} unit=" kg/s" />
            <Slider label="coil leaving T" value={Tcoil} min={7} max={16} step={0.5} onChange={setTcoil} unit=" °C" />
            <Slider label="supply T (after reheat)" value={Tsup} min={12} max={24} step={0.5} onChange={setTsup} unit=" °C" />
            <Readout
              items={[
                ['coil load', `${f1(r.coilLoad)} kW`],
                ['condensate', `${f1(r.condensate * 3600)} kg/h`],
                ['reheat load', `${f1(r.reheat)} kW`],
                ['tower make-up water', `${f1(r.makeup * 3600)} kg/h`],
                ['mixed air', `${f1(r.mix.T)} °C, φ ${f(r.mix.phi, 3)}`],
                ['supply air', `${f1(r.supply.T)} °C, φ ${f(r.supply.phi, 3)}`],
                ['tower water in / out', `${f1(r.Thw)} / ${f1(r.Tcw)} °C`],
                ['outdoor wet bulb', `${f1(r.out.Twb)} °C`],
              ]}
            />
            <LabNote>
              Return air is held at 24 °C, 50 %. Coil leaving air is taken at 95 % relative humidity; load = ṁ[(h_mix − h_c) − (ω_mix − ω_c)h_f]. The chiller rejects the coil load plus compressor work (COP 4) to the tower; the water leaves the tower 5 K above the wet bulb with an 8 K range, the exhaust air is saturated, and make-up includes blowdown at 4 cycles of concentration.
            </LabNote>
          </>
        }
      />
    </SimFrame>
  );
}

/* ====================================================================== BurnerLab */
type FuelKey = 'CH4' | 'C3H8' | 'H2';
const FUELS: Record<FuelKey, { label: string; C: number; H: number }> = {
  CH4: { label: 'methane CH₄', C: 1, H: 4 },
  C3H8: { label: 'propane C₃H₈', C: 3, H: 8 },
  H2: { label: 'hydrogen H₂', C: 0, H: 2 },
};
type Prod = { CO2: number; CO: number; H2O: number; H2: number; O2: number; N2: number };
const PSP: Record<keyof Prod, Sp> = { CO2: 'CO2', CO: 'CO', H2O: 'H2O', H2: 'H2', O2: 'O2', N2: 'N2' };
/** product composition (kmol per kmol fuel) at T with CO2 ⇌ CO + ½O2 and H2O ⇌ H2 + ½O2 in equilibrium at 1 atm; a = kmol O2 supplied */
function prodAt(C: number, H: number, a: number, T: number): Prod {
  const K1 = C > 0 ? Math.exp(lnKpAt('CO₂ ⇌ CO + ½O₂', T)) : 0;
  const K2 = Math.exp(lnKpAt('H₂O ⇌ H₂ + ½O₂', T));
  const nN2 = 3.76 * a;
  const comp = (nO2: number): Prod => {
    const N = C + H / 2 + nO2 + nN2; // CO2+CO = C and H2O+H2 = H/2, so N does not depend on the split
    const s = Math.sqrt(N / nO2);
    const r1 = K1 * s;
    const r2 = K2 * s;
    const nCO = (C * r1) / (1 + r1);
    const nH2 = ((H / 2) * r2) / (1 + r2);
    return { CO2: C - nCO, CO: nCO, H2O: H / 2 - nH2, H2: nH2, O2: nO2, N2: nN2 };
  };
  const g = (nO2: number) => {
    const c = comp(nO2);
    return 2 * c.O2 + 2 * c.CO2 + c.CO + c.H2O - 2 * a;
  };
  let lo = 1e-18;
  let hi = a;
  for (let i = 0; i < 90; i++) {
    const mid = Math.sqrt(lo * hi);
    if (g(mid) > 0) hi = mid;
    else lo = mid;
  }
  return comp(Math.sqrt(lo * hi));
}
const Hp = (c: Prod, T: number) => (Object.keys(c) as (keyof Prod)[]).reduce((s, k) => s + c[k] * hbar(PSP[k], T), 0);
const sumP = (c: Prod) => c.CO2 + c.CO + c.H2O + c.H2 + c.O2 + c.N2;

function burnerAt(fk: FuelKey, phi: number, Tair: number, dissoc: boolean) {
  const { C, H } = FUELS[fk];
  const fuel: Fuel = [[1, fk]];
  const a = (C + H / 4) / phi;
  let T: number;
  let comp: Prod;
  if (!dissoc && phi <= 1) {
    T = aft({ fuel, theoAir: 1 / phi, Tfuel: 298.15, Tair });
    const b = burn({ fuel, theoAir: 1 / phi });
    comp = { CO2: b.products.CO2, CO: 0, H2O: b.products.H2O, H2: 0, O2: b.products.O2, N2: b.products.N2 };
  } else {
    const HR = Hreact({ fuel, theoAir: 1 / phi, Tfuel: 298.15, Tair });
    T = solve((t) => Hp(prodAt(C, H, a, t), t) - HR, 320, 4800, 1e-9);
    comp = prodAt(C, H, a, T);
  }
  const N = sumP(comp);
  let NO = 0;
  if (comp.O2 > 1e-9) {
    const eq = equilibrium({
      lnK: lnKpAt('½N₂ + ½O₂ ⇌ NO', T),
      reac: [[0.5, 'N2'], [0.5, 'O2']],
      prod: [[1, 'NO']],
      initial: { N2: comp.N2, O2: comp.O2 },
      inert: { CO2: comp.CO2, CO: comp.CO, H2O: comp.H2O, H2: comp.H2 },
      P: 1,
    });
    NO = eq.NO / N;
  }
  const AF = burn({ fuel, theoAir: 1 }).AF / phi;
  const Tdp = phi <= 1 ? dewPoint(burn({ fuel, theoAir: 1 / phi }).products, PA) : NaN;
  return { T, comp, N, y: Object.fromEntries((Object.keys(comp) as (keyof Prod)[]).map((k) => [k, comp[k] / N])) as Prod, NOppm: NO * 1e6, AF, Tdp };
}

const flameVert = /* glsl */ `
  uniform float uTime; uniform float uWob;
  varying vec3 vN; varying vec3 vV; varying float vH;
  void main(){
    vec3 p = position; vH = p.y;
    float w = uWob * vH * vH;
    p.x += w * sin(uTime*9.0 + p.y*7.0 + p.z*3.0);
    p.z += w * cos(uTime*8.0 + p.y*6.0 + p.x*3.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;
const flameFrag = /* glsl */ `
  uniform vec3 uCol; uniform vec3 uTip; uniform float uInt; uniform float uTime;
  varying vec3 vN; varying vec3 vV; varying float vH;
  float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
  void main(){
    float fc = abs(dot(normalize(vN), normalize(vV)));
    float n = noise(vec3(vH*7.0 - uTime*2.5, uTime*1.3, fc*2.0));
    float a = pow(fc, 1.25) * (1.0 - pow(vH, 2.0)) * (0.55 + 0.7*n) * uInt;
    vec3 c = mix(uCol, uTip, smoothstep(0.25, 1.0, vH)) * (1.0 + 0.8*(1.0 - vH));
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
  }
`;
const columnFrag = /* glsl */ `
  uniform vec3 uCol; uniform float uA; uniform float uTime;
  varying vec3 vN; varying vec3 vV; varying float vH;
  float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  void main(){
    float fc = abs(dot(normalize(vN), normalize(vV)));
    float sh = 0.75 + 0.25*sin(vH*38.0 - uTime*4.0 + hash(vec3(vH*3.0, 1.0, 1.0))*6.0);
    float a = pow(fc, 1.4) * pow(1.0 - vH, 1.5) * 0.22 * uA * sh;
    gl_FragColor = vec4(uCol, clamp(a, 0.0, 1.0));
  }
`;
function flameProfile(n = 26) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const h = i / n;
    pts.push(new THREE.Vector2(Math.max(0.0005, Math.pow(Math.sin(Math.PI * (1 - h) * 0.5), 0.85)), h));
  }
  return pts;
}
const flameMatOf = (col: string, tip: string) =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uWob: { value: 0.1 }, uCol: { value: new THREE.Color(col) }, uTip: { value: new THREE.Color(tip) }, uInt: { value: 1 } },
    vertexShader: flameVert,
    fragmentShader: flameFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

export function BurnerLab() {
  const [phi, setPhi] = useState(0.9);
  const [fk, setFk] = useState<FuelKey>('CH4');
  const [Tair, setTair] = useState(300);
  const [dissoc, setDissoc] = useState(true);
  const st = burnerAt(fk, phi, Tair, dissoc);
  const P = useLatest({ phi, fk, Tair, st });

  const curves = useMemo(() => {
    const aftD: { x: number; y: number }[] = [];
    const aftC: { x: number; y: number }[] = [];
    const no: { x: number; y: number }[] = [];
    for (let k = 0; k <= 40; k++) {
      const p = 0.5 + k * 0.025;
      const d = burnerAt(fk, p, Tair, true);
      aftD.push({ x: p, y: d.T });
      no.push({ x: p, y: d.NOppm });
      if (p <= 1.0001) aftC.push({ x: p, y: burnerAt(fk, p, Tair, false).T });
    }
    const peak = aftD.reduce((m, q) => (q.y > m.y ? q : m), aftD[0]);
    const peakNO = no.reduce((m, q) => (q.y > m.y ? q : m), no[0]);
    return { aftD, aftC, no, peak, peakNO };
  }, [fk, Tair]);

  const setup = (ctx: StudioCtx) => {
    const { scene, controls } = ctx;
    controls.maxDistance = 20;
    scene.fog = new THREE.Fog('#070a12', 18, 50);
    const root = new THREE.Group();
    scene.add(root);
    const steel = metal('#b8c2cf', 0.28);
    const tmp = new THREE.Color();

    /* bench */
    root.add(box(7, 0.18, 3.2, metal('#2a313b', 0.5), [0, 0.5, 0]));
    for (const x of [-3.2, 3.2]) for (const z of [-1.3, 1.3]) root.add(box(0.14, 0.45, 0.14, metal('#3b4350', 0.5), [x, 0.22, z]));
    root.add(box(7, 3.4, 0.1, metal('#1b212b', 0.7), [0, 2.2, -1.55]));

    /* burner head: stainless plenum, tapered neck, flame-holder ring with ports, swirl vanes */
    const body = new THREE.Mesh(
      new THREE.LatheGeometry(
        [[0.001, 0.59], [0.55, 0.59], [0.55, 0.66], [0.38, 0.7], [0.38, 1.0], [0.31, 1.2], [0.31, 1.26], [0.34, 1.3], [0.28, 1.3], [0.001, 1.3]].map(([r, y]) => new THREE.Vector2(r, y)),
        64,
      ),
      steel,
    );
    body.castShadow = true;
    root.add(body);
    const ports = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8), new THREE.MeshBasicMaterial({ color: '#0a0c10' }), 28);
    const M4 = new THREE.Matrix4();
    for (let i = 0; i < 28; i++) {
      const ring = i < 16 ? 0.2 : 0.1;
      const n = i < 16 ? 16 : 12;
      const th = ((i < 16 ? i : i - 16) / n) * Math.PI * 2;
      M4.makeTranslation(Math.cos(th) * ring, 1.31, Math.sin(th) * ring);
      ports.setMatrixAt(i, M4);
    }
    root.add(ports);
    for (let i = 0; i < 8; i++) {
      const v = box(0.2, 0.012, 0.05, steel, [0, 1.08, 0]);
      v.rotation.y = (i / 8) * Math.PI * 2;
      v.position.set(Math.cos(v.rotation.y) * 0.17, 1.08, -Math.sin(v.rotation.y) * 0.17);
      v.rotation.x = 0.5;
      root.add(v);
    }
    /* feed pipes: fuel (brass/yellow, left) and air (blue-white, right) */
    const fuelPipe = makePipe([[-2.6, 0.9, 0.3], [-1.2, 0.9, 0.3], [-0.55, 0.85, 0.1], [-0.38, 0.85, 0]], 0.07, 0.15);
    const airPipe = makePipe([[2.6, 0.95, 0.3], [1.2, 0.95, 0.3], [0.55, 0.9, 0.1], [0.38, 0.9, 0]], 0.1, 0.18);
    fuelPipe.setColor(new THREE.Color('#e0b040'));
    const fuelC = pipeCloud(fuelPipe.path, 30, 0.07, 0.04);
    const airC = pipeCloud(airPipe.path, 40, 0.08, 0.06);
    (fuelC.object.material as THREE.PointsMaterial).color.set('#ffd86a');
    root.add(fuelPipe.object, airPipe.object, fuelC.object, airC.object);
    /* rotameters */
    const rota = (x: number) => {
      const tube = cyl(0.08, 0.08, 1.2, glass('#bcd8ff', 0.28), 20);
      tube.position.set(x, 2.0, -1.2);
      root.add(tube);
      const flt = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), metal('#e8c15a', 0.25));
      root.add(flt);
      for (const y of [1.4, 2.6]) {
        const cap = cyl(0.1, 0.1, 0.08, steel, 16);
        cap.position.set(x, y, -1.2);
        root.add(cap);
      }
      return flt;
    };
    const fltFuel = rota(-1.6);
    const fltAir = rota(1.6);

    /* quartz chamber */
    const quartz = cyl(0.55, 0.55, 2.9, new THREE.MeshPhysicalMaterial({ color: '#cfe4ff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }), 56);
    quartz.position.set(0, 2.7, 0);
    quartz.castShadow = false;
    root.add(quartz);
    for (const y of [1.25, 4.15]) {
      const col = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 12, 56), metal('#c8a060', 0.3));
      col.rotation.x = Math.PI / 2;
      col.position.set(0, y, 0);
      root.add(col);
    }

    /* flame: outer envelope, inner blue cone, luminous tip */
    const prof = flameProfile();
    const outerMat = flameMatOf('#6a9bff', '#9fc4ff');
    const innerMat = flameMatOf('#3248ff', '#6c8cff');
    const tipMat = flameMatOf('#ffb02a', '#ff6a14');
    const outer = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), outerMat);
    const inner = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), innerMat);
    const tip = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), tipMat);
    for (const m of [outer, inner, tip]) {
      m.position.y = 1.32;
      m.renderOrder = 5;
      root.add(m);
    }
    const colMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uWob: { value: 0 }, uCol: { value: new THREE.Color('#ff9a4a') }, uA: { value: 1 } },
      vertexShader: flameVert,
      fragmentShader: columnFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const colGeo = new THREE.LatheGeometry([new THREE.Vector2(0.5, 0), new THREE.Vector2(0.5, 1)], 40);
    const colum = new THREE.Mesh(colGeo, colMat);
    colum.position.set(0, 4.2, 0);
    colum.scale.set(1, 2.3, 1);
    root.add(colum);
    const flameLight = new THREE.PointLight('#7aa0ff', 6, 8, 1.4);
    flameLight.position.set(0, 2.3, 0.2);
    root.add(flameLight);
    // hot product particles rising up the column, cooling with height
    const prods = makeCloud(
      220,
      0.09,
      (u, a, b, o) => {
        const rr = 0.42 * Math.sqrt(a);
        o.set(rr * Math.cos(b * 6.283), 1.6 + u * 4.6, rr * Math.sin(b * 6.283));
      },
      (u, c) => {
        const T = P.current.st.T;
        const Tl = 650 + (T - 650) * Math.pow(1 - u, 0.9);
        c.copy(heat((Tl - 300) / 2400)).multiplyScalar(0.8 * Math.min(1, 1.6 - u));
      },
    );
    root.add(prods.object);
    const soot = makeCloud(
      90,
      0.35,
      (u, a, b, o) => o.set((a - 0.5) * 0.6 * (1 + u), 3.4 + u * 3.0, (b - 0.5) * 0.6 * (1 + u)),
      '#555a63',
      { additive: false, tex: dotTex(0.1) },
    );
    root.add(soot.object);

    const lab = (txt: string, x: number, y: number, z = 0) => {
      const L = liveLabel(0.3);
      L.sprite.position.set(x, y, z);
      L.set(txt);
      root.add(L.sprite);
      return L;
    };
    lab('burner head', -1.1, 0.5, 0.9);
    lab('fuel', -1.6, 2.85, -1.2);
    lab('air', 1.6, 2.85, -1.2);
    const lAft = liveLabel(0.34);
    lAft.sprite.position.set(1.7, 4.2, 0);
    root.add(lAft.sprite);
    const lFlame = liveLabel(0.3);
    lFlame.sprite.position.set(-1.5, 2.2, 0.4);
    root.add(lFlame.sprite);

    const lerpC = (a: string, b: string, t: number) => tmp.set(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))).clone();
    let t = 0;
    return {
      update: (dt: number) => {
        const p = P.current;
        t += dt;
        const phi0 = p.phi;
        const isH2 = p.fk === 'H2';
        // length: short and hot near stoichiometric, long yellow diffusion-like tip when rich, lifted and faint when very lean
        const lean = Math.min(1, Math.max(0, (0.95 - phi0) / 0.45));
        const rich = Math.min(1, Math.max(0, (phi0 - 1.02) / 0.48));
        const L = 0.8 + 0.35 * lean + 1.65 * rich;
        const rad = 0.3 * (1 + 0.1 * lean - 0.1 * rich);
        const sootAmt = isH2 ? 0 : Math.min(1, Math.max(0, (phi0 - (p.fk === 'C3H8' ? 1.12 : 1.25)) / 0.2));
        outer.scale.set(rad, L, rad);
        inner.scale.set(rad * 0.8, L * 0.42, rad * 0.8);
        tip.scale.set(rad * 0.9, L * 1.12, rad * 0.9);
        const intens = (0.55 + 0.55 * (1 - lean)) * (isH2 ? 0.55 : 1);
        outerMat.uniforms.uInt.value = intens * 1.2;
        outerMat.uniforms.uCol.value.copy(lerpC('#6a9bff', '#ffcf6a', isH2 ? 0 : (phi0 - 1.0) / 0.35));
        outerMat.uniforms.uTip.value.copy(lerpC('#9fc4ff', '#ff8a2a', isH2 ? 0 : (phi0 - 1.0) / 0.3));
        innerMat.uniforms.uInt.value = 1.1 * (1 - 0.5 * lean);
        innerMat.uniforms.uCol.value.copy(lerpC('#2f46ff', '#35e0d0', (phi0 - 0.9) / 0.4));
        innerMat.uniforms.uTip.value.copy(lerpC('#7090ff', '#9fffe8', (phi0 - 0.9) / 0.4));
        tipMat.uniforms.uInt.value = isH2 ? 0 : Math.min(1.1, rich * 1.3);
        for (const m of [outerMat, innerMat, tipMat]) {
          m.uniforms.uTime.value = t;
          m.uniforms.uWob.value = 0.06 + 0.12 * rich + 0.05 * lean;
        }
        const fl = 0.9 + 0.1 * Math.sin(t * 21) * Math.sin(t * 6.1);
        flameLight.color.copy(lerpC('#7aa0ff', '#ffa040', isH2 ? 0 : (phi0 - 1.0) / 0.3));
        flameLight.intensity = (3 + 8 * (1 - lean * 0.6)) * fl;
        flameLight.position.y = 1.4 + L * 0.5;
        // hot column above: glow colour tracks the flame temperature
        const Tn = (p.st.T - 300) / 2400;
        colMat.uniforms.uCol.value.copy(heat(Tn)).lerp(new THREE.Color('#ffffff'), 0.2);
        colMat.uniforms.uA.value = 0.6 + 0.8 * Tn;
        colMat.uniforms.uTime.value = t;
        const lenCol = 1.6 + 0.5 * Tn;
        colum.scale.y = lenCol * 1.4;
        prods.update(dt, 0.1 + 0.05 * Tn);
        (prods.object.material as THREE.PointsMaterial).opacity = 0.9;
        soot.object.visible = sootAmt > 0.01;
        (soot.object.material as THREE.PointsMaterial).opacity = 0.5 * sootAmt;
        soot.update(dt, 0.08);
        // feed lines: fuel flow fixed, air flow ∝ 1/φ; air pipe takes the preheat colour
        airPipe.setColor(heat((p.Tair - 280) / 700).lerp(new THREE.Color('#bcd6ff'), 0.5));
        (airC.object.material as THREE.PointsMaterial).color.copy(heat((p.Tair - 280) / 700)).lerp(new THREE.Color('#ffffff'), 0.5);
        fuelC.update(dt, 0.1);
        airC.update(dt, 0.1 / Math.max(0.5, phi0));
        fltFuel.position.set(-1.6, 1.55 + 0.5, -1.2);
        fltAir.position.set(1.6, 1.5 + 0.55 * (0.6 / Math.max(0.5, phi0)) * 1.2, -1.2);
        lAft.set(`AFT ${Math.round(p.st.T)} K`);
        lFlame.set(phi0 < 0.9 ? 'lean: blue, premixed' : phi0 <= 1.05 ? 'near stoichiometric' : isH2 ? 'rich hydrogen (pale)' : sootAmt > 0.3 ? 'rich: yellow, sooting' : 'rich: yellow tip');
      },
    };
  };

  const noAt = curves.no.find((q) => Math.abs(q.x - phi) < 0.0126);
  void noAt;
  const lean = phi <= 1;
  return (
    <SimFrame title="Burner lab: equivalence ratio" subtitle={<span>φ = (F/A)<sub>actual</sub> / (F/A)<sub>stoich</sub>, adiabatic flame temperature and equilibrium NO</span>}>
      <LabGrid
        left={
          <>
            <Studio3D
              setup={setup}
              height={430}
              camera={[0.4, 3.1, 8.8]}
              target={[0, 2.7, 0]}
              fov={38}
              caption="A premixed burner firing into a quartz tube. Flame length and colour follow φ (blue lean cone → short bright blue near stoichiometric → long yellow, sooting tip when rich); the column above is tinted by the flame temperature."
            />
            <Plot
              x={[0.5, 1.5]}
              y={[Math.min(...curves.aftD.map((q) => q.y)) - 100, Math.max(...curves.aftD.map((q) => q.y), ...curves.aftC.map((q) => q.y)) + 100]}
              height={240}
              xLabel="equivalence ratio φ"
              yLabel="adiabatic flame temperature (K)"
              series={[
                { points: curves.aftD, color: 'var(--c1)', width: 2.6, label: 'with CO₂ and H₂O dissociation' },
                { points: curves.aftC, color: 'var(--c2)', width: 1.8, dash: true, label: 'complete combustion (lib aft, lean side)' },
              ]}
              dots={[{ x: phi, y: st.T, color: 'var(--c3)' }]}
              vlines={[{ x: 1, dash: true, label: 'φ = 1' }]}
              legend
            />
            <Plot
              x={[0.5, 1.5]}
              y={[0, Math.max(curves.peakNO.y * 1.1, 10)]}
              height={220}
              xLabel="equivalence ratio φ"
              yLabel="equilibrium NO at the AFT (ppm, mole)"
              series={[{ points: curves.no, color: 'var(--c3)', width: 2.6, label: 'equilibrium NO, an upper bound' }]}
              dots={[{ x: phi, y: st.NOppm, color: 'var(--c1)' }]}
              vlines={[{ x: 1, dash: true, label: 'φ = 1' }]}
              legend
            />
          </>
        }
        right={
          <>
            <Slider label="equivalence ratio φ" value={phi} min={0.5} max={1.5} step={0.01} onChange={setPhi} format={(v) => v.toFixed(2)} />
            <div className="slider">
              <label>
                <span>fuel</span>
                <b>{FUELS[fk].label}</b>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(Object.keys(FUELS) as FuelKey[]).map((k) => (
                  <button key={k} className="btn" style={{ flex: 1, outline: k === fk ? '2px solid var(--accent)' : 'none' }} onClick={() => setFk(k)}>
                    {k === 'CH4' ? 'CH₄' : k === 'C3H8' ? 'C₃H₈' : 'H₂'}
                  </button>
                ))}
              </div>
            </div>
            <Slider label="air preheat" value={Tair} min={300} max={900} step={10} onChange={setTair} unit=" K" />
            <LabCheck label="include dissociation (CO₂ ⇌ CO + ½O₂, H₂O ⇌ H₂ + ½O₂)" checked={dissoc} onChange={setDissoc} />
            <Readout
              items={[
                ['adiabatic flame T', `${f(st.T, 4)} K (${f(st.T - 273.15, 4)} °C)`],
                ['equilibrium NO', `${f(st.NOppm, 3)} ppm`],
                ['air–fuel ratio (mass)', f(st.AF, 4)],
                ['CO in products', `${f(st.y.CO * 100, 3)} %`],
                ['H₂ in products', `${f(st.y.H2 * 100, 3)} %`],
                ['O₂ in products', `${f(st.y.O2 * 100, 3)} %`],
                ['dew point of products', lean ? `${f(st.Tdp, 4)} °C` : '— (rich)'],
                ['model', !dissoc && lean ? 'complete combustion (lib aft)' : 'with dissociation'],
              ]}
            />
            <LabNote>
              <b>Equilibrium NO, an upper bound: real NO is limited by kinetics and residence time</b> (thermal NO forms slowly, over milliseconds). The NO curve peaks on the lean side because it needs both free O₂ and a high temperature; the flame temperature peaks slightly rich because there the products carry less O₂, so less energy goes into dissociation and the molar mass of the products is lower. Above φ = 1 the complete-combustion model no longer exists (no O₂ left), so the dissociation model is used there.
            </LabNote>
          </>
        }
      />
    </SimFrame>
  );
}

/* ====================================================================== NozzleLab */
const NOZ_GAS = {
  rocket: { label: 'rocket exhaust (k = 1.2, R = 0.36, T₀ = 3500 K)', k: 1.2, R: 0.36, T0: 3500, lp: Math.log10(7000) },
  air: { label: 'cold air (k = 1.4, R = 0.287, T₀ = 300 K)', k: 1.4, R: 0.287, T0: 300, lp: Math.log10(700) },
};
type GasKey = keyof typeof NOZ_GAS;
const AT = 0.05; // throat area, m²
const X_T = 0.3; // throat position along the unit-length nozzle
const CONTRACT = 3; // chamber / throat area
const divShape = (u: number) => 0.5 * u + 0.5 * (3 * u * u - 2 * u * u * u);
const areaAt = (x: number, AR: number) => (x <= X_T ? 1 + (CONTRACT - 1) * Math.pow((X_T - x) / X_T, 2) : 1 + (AR - 1) * divShape((x - X_T) / (1 - X_T)));
const xOfArea = (A: number, AR: number) => {
  if (A <= 1) return X_T;
  if (A >= AR) return 1;
  let lo = X_T;
  let hi = 1;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (areaAt(mid, AR) < A) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
const normalShock = (M: number, k: number) => {
  const M2 = Math.sqrt(((k - 1) * M * M + 2) / (2 * k * M * M - (k - 1)));
  const p02 = Math.pow(((k + 1) * M * M) / ((k - 1) * M * M + 2), k / (k - 1)) * Math.pow((k + 1) / (2 * k * M * M - (k - 1)), 1 / (k - 1));
  const p2p1 = 1 + ((2 * k) / (k + 1)) * (M * M - 1);
  return { M2, p02, p2p1 };
};
type Regime = 'no-flow' | 'subsonic' | 'shock' | 'over' | 'design' | 'under';
function nozzleSolve(AR: number, k: number, pb: number) {
  const Msup = machFromAreaRatio(AR, k, 'sup');
  const Msub = machFromAreaRatio(AR, k, 'sub');
  const pd = 1 / P0_P(Msup, k);
  const p3 = 1 / P0_P(Msub, k);
  const p4 = pd * normalShock(Msup, k).p2p1;
  let regime: Regime;
  let Mt = 1;
  let Me = Msup;
  let pe = pd;
  let As: number | undefined;
  let Mx: number | undefined;
  let p02 = 1;
  if (pb >= 1) {
    regime = 'no-flow';
    Mt = 0;
    Me = 0;
    pe = 1;
  } else if (pb >= p3) {
    regime = 'subsonic';
    pe = pb;
    Me = Math.sqrt((2 / (k - 1)) * (Math.pow(pb, -(k - 1) / k) - 1));
    Mt = machFromAreaRatio(Math.max(1, areaRatio(Me, k) / AR), k, 'sub');
  } else if (pb > p4) {
    regime = 'shock';
    const peOf = (A: number) => {
      const mx = machFromAreaRatio(A, k, 'sup');
      const s = normalShock(mx, k);
      const me = machFromAreaRatio(Math.max(1, AR * s.p02), k, 'sub');
      return { me, pe: s.p02 / P0_P(me, k), p02: s.p02, mx };
    };
    As = solve((A) => peOf(A).pe - pb, 1.0000001, AR - 1e-7, 1e-12);
    const r = peOf(As);
    Me = r.me;
    pe = pb;
    Mx = r.mx;
    p02 = r.p02;
  } else if (Math.abs(pb - pd) <= 1e-3 * pd) {
    regime = 'design';
  } else if (pb > pd) {
    regime = 'over';
  } else {
    regime = 'under';
  }
  const peFinal = regime === 'shock' || regime === 'subsonic' || regime === 'no-flow' ? pe : pd;
  return { regime, Msup, Msub, pd, p3, p4, Mt, Me, pe: peFinal, As, Mx, p02 };
}
function nozzlePerf(AR: number, gas: GasKey, P0: number, Pa: number) {
  const { k, R, T0 } = NOZ_GAS[gas];
  const sol = nozzleSolve(AR, k, Pa / P0);
  const Pe = sol.pe * P0;
  const Te = T0 / T0_T(sol.Me, k);
  const Ve = sol.Me * soundSpeed(Te, R, k);
  const Ae = AR * AT;
  const mdot = sol.regime === 'no-flow' ? 0 : ((Pe / (R * Te)) * Ve * Ae);
  const F = mdot * Ve + (Pe - Pa) * 1000 * Ae;
  return { sol, Pe, Te, Ve, mdot, F, Isp: mdot > 0 ? F / (mdot * 9.80665) : 0 };
}
function nozzleField(AR: number, sol: ReturnType<typeof nozzleSolve>, k: number) {
  const n = 160;
  const xs: number[] = [];
  const pts: { x: number; M: number; p: number; T: number }[] = [];
  const xShock = sol.As !== undefined ? xOfArea(sol.As, AR) : undefined;
  const Atn = sol.regime === 'subsonic' ? areaRatio(sol.Mt, k) : 1; // A_t / A*
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    xs.push(x);
    const A = areaAt(x, AR);
    let M: number;
    let p0r = 1;
    if (sol.regime === 'no-flow') M = 0;
    else if (sol.regime === 'subsonic') M = machFromAreaRatio(Math.max(1, A * Atn), k, 'sub');
    else if (x <= X_T) M = machFromAreaRatio(Math.max(1, A), k, 'sub');
    else if (xShock !== undefined && x > xShock) {
      M = machFromAreaRatio(Math.max(1, A * sol.p02), k, 'sub');
      p0r = sol.p02;
    } else M = machFromAreaRatio(Math.max(1, A), k, 'sup');
    pts.push({ x, M, p: p0r / P0_P(M, k), T: 1 / T0_T(M, k) });
  }
  const field = (x: number): FieldPoint => {
    const i = Math.min(n - 1, Math.max(0, Math.floor(x * n)));
    const a = pts[i];
    const b = pts[i + 1];
    const t = Math.min(1, Math.max(0, x * n - i));
    return { M: a.M + (b.M - a.M) * t, p: a.p + (b.p - a.p) * t, T: a.T + (b.T - a.T) * t };
  };
  return { pts, field, xShock };
}
const REGIME_TEXT: Record<Regime, string> = {
  'no-flow': 'No flow: the ambient pressure is at or above the chamber pressure.',
  subsonic: 'Subsonic (venturi): the flow accelerates to the throat and decelerates again; nothing is choked, the throat Mach number is below 1.',
  shock: 'Choked, with a normal shock inside the diverging section: supersonic up to the shock, subsonic after it, exit pressure equals the ambient pressure.',
  over: 'Choked and over-expanded: the nozzle exit pressure is below ambient, so oblique shocks form in the plume outside the nozzle (barrel shocks).',
  design: 'Design point: the exit pressure equals the ambient pressure, a clean parallel supersonic jet and the best thrust for this nozzle.',
  under: 'Choked and under-expanded: the exit pressure is above ambient, so the jet keeps expanding outside the nozzle (expansion fans, a fat plume).',
};

export function NozzleLab() {
  const [AR, setAR] = useState(8);
  const [alt, setAlt] = useState(0); // km
  const [gas, setGas] = useState<GasKey>('rocket');
  const [lp, setLp] = useState(NOZ_GAS.rocket.lp);
  const [by, setBy] = useState<'M' | 'p' | 'T'>('M');
  const { k } = NOZ_GAS[gas];
  const P0 = Math.pow(10, lp);
  const Pa = atmosphere(alt * 1000).P;
  const perf = nozzlePerf(AR, gas, P0, Pa);
  const sol = perf.sol;
  const fld = useMemo(() => nozzleField(AR, sol, k), [AR, k, sol.regime, sol.As, sol.p02, sol.Mt]);
  const cScale = Math.min(0.12, 0.34 / Math.sqrt(AR));

  const thrustCurve = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let z = 0; z <= 80; z += 2) {
      const p = atmosphere(z * 1000).P;
      const q = nozzlePerf(AR, gas, P0, p);
      out.push({ x: z, y: q.F / 1000 });
    }
    return out;
  }, [AR, gas, P0]);

  const setP0 = (target: number) => setLp(Math.min(Math.log10(25000), Math.max(Math.log10(30), Math.log10(Pa / target))));
  const presets: [string, number][] = [
    ['subsonic venturi', (1 + sol.p3) / 2],
    ['just choked', sol.p3 * 0.97],
    ['shock inside', (sol.p3 + sol.p4) / 2],
    ['over-expanded', Math.sqrt(sol.p4 * sol.pd)],
    ['design', sol.pd],
    ['under-expanded', sol.pd * 0.35],
  ];
  const regimeName: Record<Regime, string> = { 'no-flow': 'no flow', subsonic: 'subsonic', shock: 'shock in nozzle', over: 'over-expanded', design: 'design point', under: 'under-expanded' };
  const kPa = (v: number) => (v >= 1000 ? `${f(v / 1000, 3)} MPa` : `${f(v, 3)} kPa`);

  return (
    <SimFrame title="Converging–diverging nozzle lab" subtitle={<span>isentropic flow with choking; F = ṁV<sub>e</sub> + (P<sub>e</sub> − P<sub>a</sub>)A<sub>e</sub></span>}>
      <div className="regime" style={{ margin: '4px 0 8px', fontSize: '.92rem' }}>
        <b>{regimeName[sol.regime]}.</b> {REGIME_TEXT[sol.regime]}{' '}
        {sol.regime === 'shock' && (
          <>
            Shock at A/A<sub>t</sub> = {f(sol.As ?? NaN, 3)}, M<sub>x</sub> = {f(sol.Mx ?? NaN, 3)}, stagnation-pressure ratio across it {f(sol.p02, 3)}. For the full back-pressure picture, open the <Link to="/mech430/lab/engine">MECH 430 nozzle and engine lab</Link>.
          </>
        )}
      </div>
      <LabGrid
        left={
          <>
            <FlowSection3D
              wall="engine"
              x0={0}
              x1={1}
              profile={(x) => cScale * Math.sqrt(areaAt(x, AR))}
              field={fld.field}
              colorBy={by}
              shocks={fld.xShock !== undefined ? [fld.xShock] : []}
              plume={{ kind: sol.regime === 'no-flow' ? 'none' : sol.regime === 'subsonic' ? 'subsonic' : sol.regime === 'design' ? 'ideal' : sol.regime === 'under' ? 'under' : 'over', strength: 1 }}
              labels={[
                { x: X_T, text: sol.regime === 'subsonic' ? `throat · M = ${f(sol.Mt, 3)}` : 'throat · M = 1' },
                ...(fld.xShock !== undefined ? [{ x: fld.xShock, text: `shock · Mₓ = ${f(sol.Mx ?? NaN, 3)}`, side: 'bottom' as const }] : []),
                { x: 1, text: `exit · M = ${f(sol.Me, 3)}` },
              ]}
              flowSpeed={sol.regime === 'no-flow' ? 0 : 1}
              height={330}
            />
            <Plot
              x={[0, 1]}
              y={[0, Math.max(1.2, ...fld.pts.map((p) => p.M)) * 1.05]}
              height={210}
              xLabel="position along the nozzle"
              yLabel="Mach number"
              series={[{ points: fld.pts.map((p) => ({ x: p.x, y: p.M })), color: 'var(--c2)', width: 3, label: 'M(x)' }]}
              hlines={[{ y: 1, label: 'M = 1' }]}
              vlines={[{ x: X_T, label: 'throat' }, ...(fld.xShock !== undefined ? [{ x: fld.xShock, color: 'var(--c3)', label: 'shock' }] : [])]}
            />
            <Plot
              x={[0, 1]}
              y={[0, 1.02]}
              height={210}
              xLabel="position along the nozzle"
              yLabel="p / p₀"
              series={[{ points: fld.pts.map((p) => ({ x: p.x, y: p.p })), color: 'var(--c1)', width: 3, label: 'p(x)/p₀' }]}
              hlines={[{ y: Math.min(1, Pa / P0), color: 'var(--c3)', label: 'ambient' }, { y: critical(k).P, label: 'p*/p₀' }]}
              vlines={[{ x: X_T, label: 'throat' }]}
            />
            <Plot
              x={[0, 80]}
              y={[0, Math.max(10, ...thrustCurve.map((p) => p.y)) * 1.1]}
              height={210}
              xLabel="altitude (km)"
              yLabel="thrust (kN)"
              series={[{ points: thrustCurve, color: 'var(--c4)', width: 2.6, label: 'thrust vs altitude (fixed nozzle)' }]}
              dots={[{ x: alt, y: perf.F / 1000, color: 'var(--c3)' }]}
              legend
            />
          </>
        }
        right={
          <>
            <Slider label="area ratio A_e / A_t" value={AR} min={1.5} max={25} step={0.1} onChange={setAR} format={(v) => v.toFixed(1)} />
            <Slider label="chamber pressure p₀" value={lp} min={Math.log10(30)} max={Math.log10(25000)} step={0.005} onChange={setLp} format={(v) => kPa(Math.pow(10, v))} />
            <Slider label="altitude (ambient pressure)" value={alt} min={0} max={80} step={0.5} onChange={setAlt} format={(v) => v.toFixed(1)} unit=" km" />
            <div className="slider">
              <label>
                <span>gas</span>
                <b>{gas === 'rocket' ? 'rocket exhaust' : 'cold air'}</b>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(Object.keys(NOZ_GAS) as GasKey[]).map((g) => (
                  <button
                    key={g}
                    className="btn"
                    style={{ flex: 1, outline: g === gas ? '2px solid var(--accent)' : 'none' }}
                    onClick={() => {
                      setGas(g);
                      setLp(NOZ_GAS[g].lp);
                    }}
                  >
                    {g === 'rocket' ? 'rocket' : 'air'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
              {presets.map(([t, pb]) => (
                <button key={t} className="btn" onClick={() => setP0(pb)}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, margin: '4px 0 8px', alignItems: 'center', fontSize: '.85rem', color: 'var(--muted)' }}>
              colour by
              {(['M', 'p', 'T'] as const).map((c) => (
                <button key={c} className="btn" style={{ outline: c === by ? '2px solid var(--accent)' : 'none' }} onClick={() => setBy(c)}>
                  {c === 'M' ? 'Mach' : c === 'p' ? 'p/p₀' : 'T/T₀'}
                </button>
              ))}
            </div>
            <Readout
              items={[
                ['throat Mach', f(sol.Mt, 4)],
                ['exit Mach', f(sol.Me, 4)],
                ['exit pressure P_e', kPa(perf.Pe)],
                ['ambient pressure P_a', kPa(Pa)],
                ['exit velocity V_e', `${f(perf.Ve, 4)} m/s`],
                ['mass flow ṁ', `${f(perf.mdot, 4)} kg/s`],
                ['thrust F', `${f(perf.F / 1000, 4)} kN`],
                ['specific impulse', `${f(perf.Isp, 4)} s`],
                ['p_b/p₀ · design p_d/p₀', `${f(Pa / P0, 3)} · ${f(sol.pd, 3)}`],
                ['choke limits p₃ · p₄', `${f(sol.p3, 3)} · ${f(sol.p4, 3)}`],
              ]}
            />
            <LabNote>
              Throat area {AT} m². Mach 1 at the throat as soon as p_b/p₀ falls below p₃ (the choked, subsonic-exit pressure ratio); between p₃ and p₄ a normal shock stands in the diverging part and moves out to the exit as p_b falls to p₄. Raise the altitude and the same nozzle goes from over- to under-expanded, which is why thrust rises with height.
            </LabNote>
          </>
        }
      />
    </SimFrame>
  );
}
