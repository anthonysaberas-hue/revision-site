import { useState } from 'react';
import { Plot } from '../../../core/Plot';
import { Readout } from '../../../core/ui';
import { Chips, Note, Num, Sel, Two, f, range } from '../viz/Kit';
import { SOLIDS, air, water, filmT } from '../lib/props';
import { Rcyl, Rsph, Rwall, Rconv, chainTemps, rCritCyl, rCritSph, insulatedPipeQ } from '../lib/conduction';
import { rectFin, pinFin, finAnalysis, finProfileAdiabatic, finM, correctedLength, TipBC } from '../lib/fins';
import { Geom, biot, lambda1, A1, oneTerm, thetaAt, QoverQmax, lumpedB, lumpedT } from '../lib/transient';
import {
  Re as reynolds,
  NuPlate,
  NuPlateTurbulent,
  NuCylinderCB,
  NuSphere,
  cfAvgLaminar,
  cfAvgMixed,
  cfAvgTurbulent,
  boundaryThickness,
  NuxLocal,
  RE_CR_PLATE,
} from '../lib/convection';

/* ============================== 1. thermal resistance network ============================== */
interface Layer {
  name: string;
  t: number; // thickness (m)
  k: number;
}

export function ResistanceTool() {
  const [geom, setGeom] = useState<'wall' | 'cyl' | 'sph'>('wall');
  const [Tin, setTin] = useState(200);
  const [Tout, setTout] = useState(20);
  const [hi, setHi] = useState(100);
  const [ho, setHo] = useState(15);
  const [A, setA] = useState(1);
  const [r0, setR0] = useState(0.025);
  const [L, setL] = useState(1);
  const [layers, setLayers] = useState<Layer[]>([
    { name: 'steel', t: 0.003, k: 45 },
    { name: 'insulation', t: 0.04, k: 0.04 },
  ]);

  const upd = (i: number, p: Partial<Layer>) => setLayers(layers.map((l, j) => (j === i ? { ...l, ...p } : l)));

  // radii of each interface (cylinder / sphere); area of each surface
  const radii = [r0];
  layers.forEach((l) => radii.push(radii[radii.length - 1] + l.t));
  const rOut = radii[radii.length - 1];
  const Ain = geom === 'wall' ? A : geom === 'cyl' ? 2 * Math.PI * r0 * L : 4 * Math.PI * r0 * r0;
  const Aout = geom === 'wall' ? A : geom === 'cyl' ? 2 * Math.PI * rOut * L : 4 * Math.PI * rOut * rOut;
  const R: number[] = [Rconv(hi, Ain)];
  layers.forEach((l, i) => {
    if (geom === 'wall') R.push(Rwall(l.t, l.k, A));
    else if (geom === 'cyl') R.push(Rcyl(radii[i], radii[i + 1], l.k, L));
    else R.push(Rsph(radii[i], radii[i + 1], l.k));
  });
  R.push(Rconv(ho, Aout));
  const Rtot = R.reduce((a, b) => a + b, 0);
  const Q = (Tin - Tout) / Rtot;
  const T = chainTemps(Tin, Q, R); // fluid in, wall surface, interfaces..., outer surface, fluid out
  const names = ['inside film', ...layers.map((l) => l.name), 'outside film'];
  const share = R.map((r) => (100 * r) / Rtot);
  const biggest = share.indexOf(Math.max(...share));

  // cylinder: critical radius sweep (outer layer = last layer, insulation)
  const last = layers[layers.length - 1];
  const rcr = geom === 'cyl' ? rCritCyl(last.k, ho) : geom === 'sph' ? rCritSph(last.k, ho) : NaN;
  const sweep =
    geom === 'cyl'
      ? range(radii[radii.length - 2] * 1.0, Math.max(radii[radii.length - 2] * 6, rcr * 4), 80).map((r2) => ({
          x: r2 * 100,
          y: insulatedPipeQ(Tin, Tout, radii[radii.length - 2], r2, last.k, ho, L) / L,
        }))
      : [];
  const sw = sweep.map((p) => p.y);

  // profile plot: T vs cumulative position through the layers
  const pos = [0];
  layers.forEach((l, i) => pos.push(geom === 'wall' ? pos[pos.length - 1] + l.t * 100 : radii[i + 1] * 100));
  const prof = layers.length + 1;
  const pts = Array.from({ length: prof }, (_, i) => ({ x: geom === 'wall' ? (i === 0 ? 0 : pos[i]) : radii[i] * 100, y: T[i + 1] }));

  return (
    <Two
      left={
        <div>
          <Sel
            label="Geometry"
            value={geom}
            onChange={setGeom}
            options={[
              { v: 'wall', t: 'Plane wall (area A)' },
              { v: 'cyl', t: 'Cylinder / pipe (per length L)' },
              { v: 'sph', t: 'Sphere' },
            ]}
          />
          <Num label="Inside fluid T" unit="°C" value={Tin} onChange={setTin} />
          <Num label="Outside fluid T" unit="°C" value={Tout} onChange={setTout} />
          <Num label="Inside h" unit="W/m²K" value={hi} onChange={setHi} />
          <Num label="Outside h" unit="W/m²K" value={ho} onChange={setHo} />
          {geom === 'wall' ? <Num label="Area A" unit="m²" value={A} onChange={setA} /> : <Num label="Inner radius r₀" unit="m" value={r0} onChange={setR0} step={0.005} />}
          {geom === 'cyl' && <Num label="Length L" unit="m" value={L} onChange={setL} />}
          {layers.map((l, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', margin: '6px 0' }}>
              <b style={{ fontSize: '.85rem' }}>
                Layer {i + 1}: {l.name}
              </b>
              <Num label="thickness" unit="m" value={l.t} onChange={(v) => upd(i, { t: v })} step={0.001} />
              <Num label="k" unit="W/mK" value={l.k} onChange={(v) => upd(i, { k: v })} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setLayers([...layers, { name: `layer ${layers.length + 1}`, t: 0.01, k: 1 }])}>
              + layer
            </button>
            {layers.length > 1 && (
              <button className="btn" onClick={() => setLayers(layers.slice(0, -1))}>
                − layer
              </button>
            )}
          </div>
        </div>
      }
      right={
        <div>
          <Readout
            items={[
              ['R total', `${f(Rtot)} K/W`],
              ['Heat rate Q', `${f(Q)} W${geom === 'cyl' ? ` (${f(Q / L)} W/m)` : ''}`],
              ['Largest resistance', `${names[biggest]} (${f(share[biggest], 3)} %)`],
            ]}
          />
          <table style={{ width: '100%', fontSize: '.85rem', margin: '8px 0' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Element</th>
                <th>R (K/W)</th>
                <th>share</th>
                <th>ΔT (K)</th>
                <th>T after (°C)</th>
              </tr>
            </thead>
            <tbody>
              {R.map((r, i) => (
                <tr key={i}>
                  <td>{names[i]}</td>
                  <td style={{ textAlign: 'center' }}>{f(r, 4)}</td>
                  <td style={{ textAlign: 'center' }}>{f(share[i], 3)} %</td>
                  <td style={{ textAlign: 'center' }}>{f(Q * r, 4)}</td>
                  <td style={{ textAlign: 'center' }}>{f(T[i + 1], 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Plot
            x={[0, Math.max(...pts.map((p) => p.x)) * 1.02 || 1]}
            y={[Math.min(Tin, Tout, ...pts.map((p) => p.y)) - 5, Math.max(Tin, Tout, ...pts.map((p) => p.y)) + 5]}
            series={[{ points: pts, color: 'var(--c1)', label: 'interface temperature' }]}
            height={240}
            xLabel={geom === 'wall' ? 'position through the wall (cm)' : 'radius (cm)'}
            yLabel="T (°C)"
            hlines={[
              { y: Tin, dash: true, label: 'inside fluid' },
              { y: Tout, dash: true, label: 'outside fluid' },
            ]}
            dots={pts.map((p) => ({ x: p.x, y: p.y }))}
          />
          {geom === 'cyl' && sweep.length > 0 && (
            <div>
              <Chips items={[['r_cr = k/h', `${f(rcr * 100, 3)} cm`], ['outer radius now', `${f(radii[radii.length - 2] * 100, 3)} cm (before last layer)`]]} />
              <Plot
                x={[sweep[0].x, sweep[sweep.length - 1].x]}
                y={[Math.min(...sw) * 0.95, Math.max(...sw) * 1.05]}
                series={[{ points: sweep, color: 'var(--c2)', label: 'Q per metre' }]}
                height={220}
                xLabel="outer radius of the last layer (cm)"
                yLabel="Q' (W/m)"
                vlines={[{ x: rcr * 100, label: 'critical radius', dash: true }]}
              />
              <Note>Loss per metre as the last layer is thickened: it **rises** until r = k/h, then falls. Only beyond the critical radius does insulation help.</Note>
            </div>
          )}
        </div>
      }
    />
  );
}

/* ============================== 2. fins ============================== */
const MATS: Record<string, number> = { aluminum: 237, copper: 401, carbonSteel: 54, stainless: 14.9, brass: 110, 'custom 177': 177 };

export function FinTool() {
  const [shape, setShape] = useState<'rect' | 'pin'>('rect');
  const [mat, setMat] = useState('custom 177');
  const [k, setK] = useState(177);
  const [h, setH] = useState(50);
  const [Tb, setTb] = useState(50);
  const [Tinf, setTinf] = useState(20);
  const [L, setL] = useState(0.15);
  const [w, setW] = useState(0.25);
  const [t, setT] = useState(0.002);
  const [D, setD] = useState(0.005);
  const [tip, setTip] = useState<TipBC>('adiabatic');

  const g = shape === 'rect' ? rectFin(w, t, L) : pinFin(D, L);
  const r = finAnalysis(g, k, h, Tb, Tinf, tip);
  const ad = finAnalysis(g, k, h, Tb, Tinf, 'adiabatic');
  const inf = finAnalysis(g, k, h, Tb, Tinf, 'infinite');
  const m = finM(h, k, g);
  const mL = m * L;
  const xs = range(0, L, 60);
  const prof = xs.map((x) => ({ x: x * 100, y: finProfileAdiabatic(g, k, h, Tb, Tinf, x) }));
  const Ls = range(L / 20, L * 3, 80);
  const qL = Ls.map((l) => ({ x: l * 100, y: finAnalysis({ ...g, L: l }, k, h, Tb, Tinf, tip).Q }));
  const Qinf = inf.Q;
  return (
    <Two
      left={
        <div>
          <Sel
            label="Fin shape"
            value={shape}
            onChange={setShape}
            options={[
              { v: 'rect', t: 'Rectangular (width w, thickness t)' },
              { v: 'pin', t: 'Pin (diameter D)' },
            ]}
          />
          <Sel
            label="Material"
            value={mat}
            onChange={(v) => {
              setMat(v);
              setK(MATS[v]);
            }}
            options={Object.keys(MATS).map((v) => ({ v, t: `${v} (k = ${MATS[v]})` }))}
          />
          <Num label="k" unit="W/mK" value={k} onChange={setK} />
          <Num label="h" unit="W/m²K" value={h} onChange={setH} />
          <Num label="Base temperature" unit="°C" value={Tb} onChange={setTb} />
          <Num label="Fluid temperature" unit="°C" value={Tinf} onChange={setTinf} />
          <Num label="Length L" unit="m" value={L} onChange={setL} step={0.005} />
          {shape === 'rect' ? (
            <>
              <Num label="Width w" unit="m" value={w} onChange={setW} step={0.01} />
              <Num label="Thickness t" unit="m" value={t} onChange={setT} step={0.0005} />
            </>
          ) : (
            <Num label="Diameter D" unit="m" value={D} onChange={setD} step={0.001} />
          )}
          <Sel
            label="Tip condition"
            value={tip}
            onChange={setTip}
            options={[
              { v: 'adiabatic', t: 'Adiabatic tip' },
              { v: 'convective', t: 'Convective tip' },
              { v: 'corrected', t: 'Corrected length (adiabatic at Lc)' },
              { v: 'infinite', t: 'Infinitely long' },
            ]}
          />
        </div>
      }
      right={
        <div>
          <Readout
            items={[
              ['m = √(hp/kAc)', `${f(m)} 1/m`],
              ['mL', f(mL, 3)],
              ['Heat rate Q', `${f(r.Q)} W`],
              ['Efficiency η', f(r.eta, 3)],
              ['Effectiveness ε', f(r.eps, 4)],
              ['Tip temperature', `${f(r.tipTemp, 4)} °C`],
            ]}
          />
          <Chips
            items={[
              ['adiabatic tip', `${f(ad.Q)} W`],
              ['infinite fin', `${f(inf.Q)} W`],
              ['error of infinite fin', `${f((100 * (inf.Q - ad.Q)) / ad.Q, 3)} %`, mL < 2.5 ? 'bad' : 'ok'],
              ['corrected length Lc', `${f(correctedLength(g) * 100, 4)} cm`],
            ]}
          />
          <Plot
            x={[0, L * 100]}
            y={[Math.min(Tinf, Tb) - 2, Math.max(Tinf, Tb) + 2]}
            series={[{ points: prof, color: 'var(--c1)', label: 'T(x), adiabatic tip' }]}
            hlines={[{ y: Tinf, dash: true, label: 'fluid' }]}
            height={220}
            xLabel="distance from the base (cm)"
            yLabel="T (°C)"
          />
          <Plot
            x={[Ls[0] * 100, Ls[Ls.length - 1] * 100]}
            y={[0, Qinf * 1.05]}
            series={[{ points: qL, color: 'var(--c2)', label: 'Q(L)' }]}
            hlines={[{ y: Qinf, dash: true, label: 'infinite-fin limit' }]}
            vlines={[{ x: L * 100, dash: true, label: 'your L' }]}
            height={220}
            xLabel="fin length L (cm)"
            yLabel="Q (W)"
          />
          <Note>Past mL ≈ 2.5 a longer fin buys almost nothing (tanh mL → 1): the plot flattens at the infinite-fin value.</Note>
        </div>
      }
    />
  );
}

/* ============================== 3. transient conduction ============================== */
const GEOMS: { v: Geom; t: string; Lc: (L: number) => number }[] = [
  { v: 'wall', t: 'Plane wall (half-thickness L, both faces)', Lc: (L) => L },
  { v: 'cylinder', t: 'Long cylinder (radius r₀)', Lc: (L) => L / 2 },
  { v: 'sphere', t: 'Sphere (radius r₀)', Lc: (L) => L / 3 },
];

export function TransientTool() {
  const [geom, setGeom] = useState<Geom>('sphere');
  const [mat, setMat] = useState<keyof typeof SOLIDS>('carbonSteel');
  const [k, setK] = useState(54);
  const [rho, setRho] = useState(7833);
  const [cp, setCp] = useState(465);
  const [L, setL] = useState(0.15);
  const [h, setH] = useState(75);
  const [Ti, setTi] = useState(900);
  const [Tinf, setTinf] = useState(35);
  const [t, setT] = useState(3000);
  const alpha = k / (rho * cp);
  const g = GEOMS.find((x) => x.v === geom)!;
  const Lcc = g.Lc(L);
  const BiL = biot(h, Lcc, k);
  const Bi = biot(h, L, k);
  const tau = (alpha * t) / (L * L);
  const o = oneTerm(geom, Bi, tau);
  const lam = lambda1(geom, Bi);
  const A = A1(geom, lam);
  const bL = h / (rho * cp * Lcc);
  const Tc = Tinf + (Ti - Tinf) * o.theta0;
  const Ts = Tinf + (Ti - Tinf) * thetaAt(geom, o, 1);
  const Tl = lumpedT(t, Ti, Tinf, bL);
  const q = QoverQmax(geom, o);
  const tmax = Math.max(t * 1.6, 1);
  const ts = range(0, tmax, 80);
  const centre = ts.map((tt) => {
    const oo = oneTerm(geom, Bi, (alpha * tt) / (L * L));
    return { x: tt, y: Tinf + (Ti - Tinf) * oo.theta0 };
  });
  const surf = ts.map((tt) => {
    const oo = oneTerm(geom, Bi, (alpha * tt) / (L * L));
    return { x: tt, y: Tinf + (Ti - Tinf) * thetaAt(geom, oo, 1) };
  });
  const lump = ts.map((tt) => ({ x: tt, y: lumpedT(tt, Ti, Tinf, bL) }));
  const fo = (alpha * t) / (L * L);
  return (
    <Two
      left={
        <div>
          <Sel label="Shape" value={geom} onChange={setGeom} options={GEOMS.map((x) => ({ v: x.v, t: x.t }))} />
          <Sel
            label="Material (fills k, ρ, cp)"
            value={mat}
            onChange={(v) => {
              setMat(v);
              setK(SOLIDS[v].k);
              setRho(SOLIDS[v].rho);
              setCp(SOLIDS[v].cp);
            }}
            options={Object.keys(SOLIDS).map((v) => ({ v: v as keyof typeof SOLIDS, t: v }))}
          />
          <Num label="k" unit="W/mK" value={k} onChange={setK} />
          <Num label="ρ" unit="kg/m³" value={rho} onChange={setRho} />
          <Num label="cp" unit="J/kgK" value={cp} onChange={setCp} />
          <Num label={geom === 'wall' ? 'Half-thickness L' : 'Radius r₀'} unit="m" value={L} onChange={setL} step={0.005} />
          <Num label="h" unit="W/m²K" value={h} onChange={setH} />
          <Num label="Initial T" unit="°C" value={Ti} onChange={setTi} />
          <Num label="Fluid T" unit="°C" value={Tinf} onChange={setTinf} />
          <Num label="Time" unit="s" value={t} onChange={setT} />
        </div>
      }
      right={
        <div>
          <Chips
            items={[
              ['α', `${f(alpha, 4)} m²/s`],
              ['Bi (Lc = V/As)', f(BiL, 3), BiL <= 0.1 ? 'ok' : 'bad'],
              ['Bi (one-term, r₀ or L)', f(Bi, 3)],
              ['Fo', f(fo, 3), fo > 0.2 ? 'ok' : 'warn'],
            ]}
          />
          <Readout
            items={[
              ['λ₁ (Table 4-2)', f(lam, 5)],
              ['A₁', f(A, 5)],
              ['Centre T (one-term)', `${f(Tc, 4)} °C`],
              ['Surface T (one-term)', `${f(Ts, 4)} °C`],
              ['Q / Qmax', f(q, 4)],
              ['Lumped T (if Bi ≤ 0.1)', `${f(Tl, 4)} °C`],
            ]}
          />
          <Note>
            {BiL <= 0.1 ? 'Bi ≤ 0.1: the lumped model agrees with the one-term centre value.' : 'Bi > 0.1: the lumped curve (dashed) lags the real centre temperature; use the one-term solution.'}
            {fo <= 0.2 ? ' Fo ≤ 0.2: the one-term solution is not accurate yet (use the series or a semi-infinite model).' : ''}
          </Note>
          <Plot
            x={[0, tmax]}
            y={[Math.min(Ti, Tinf) - 5, Math.max(Ti, Tinf) + 5]}
            series={[
              { points: centre, color: 'var(--c1)', label: 'centre' },
              { points: surf, color: 'var(--c2)', label: 'surface' },
              { points: lump, color: 'var(--c3)', label: 'lumped', dash: true },
            ]}
            vlines={[{ x: t, dash: true, label: 't' }]}
            hlines={[{ y: Tinf, dash: true, label: 'fluid' }]}
            height={280}
            xLabel="time (s)"
            yLabel="T (°C)"
            legend
          />
        </div>
      }
    />
  );
}

/* ============================== 4. external flow ============================== */
export function PlateTool() {
  const [mode, setMode] = useState<'plate' | 'cyl' | 'sph'>('plate');
  const [fl, setFl] = useState<'air' | 'water'>('air');
  const [V, setV] = useState(15);
  const [Ls, setLs] = useState(2);
  const [w, setW] = useState(1);
  const [Ts, setTs] = useState(80);
  const [Tinf, setTinf] = useState(15);
  const [trip, setTrip] = useState(false);
  const Tf = filmT(Ts, Tinf);
  const p = fl === 'air' ? air(mode === 'sph' ? Tinf : Tf) : water(mode === 'sph' ? Tinf : Tf);
  const Rel = reynolds(V, Ls, p.nu);
  let Nu = 0;
  let regime = '';
  let note = '';
  if (mode === 'plate') {
    const r = NuPlate(Rel, p.Pr);
    Nu = trip ? NuPlateTurbulent(Rel, p.Pr) : r.Nu;
    regime = trip ? 'turbulent from the leading edge' : r.regime;
  } else if (mode === 'cyl') {
    Nu = NuCylinderCB(Rel, p.Pr);
    regime = 'Churchill–Bernstein';
  } else {
    const ps = fl === 'air' ? air(Ts) : water(Ts);
    Nu = NuSphere(Rel, p.Pr, p.mu / ps.mu);
    regime = 'Whitaker (properties at T∞, μs at Ts)';
  }
  const h = (Nu * p.k) / Ls;
  const As = mode === 'plate' ? Ls * w : mode === 'cyl' ? Math.PI * Ls * w : Math.PI * Ls * Ls;
  const Q = h * As * (Ts - Tinf);
  const xcr = (RE_CR_PLATE * p.nu) / V;
  const cf = trip ? cfAvgTurbulent(Rel) : Rel <= RE_CR_PLATE ? cfAvgLaminar(Rel) : cfAvgMixed(Rel);
  const F = cf * As * (p.rho * V * V) / 2;
  if (mode === 'plate' && Rel > 1e7) note = 'Re > 10⁷: beyond the range of the correlations.';
  const xs = range(Ls / 200, Ls, 100);
  const hx = xs.map((x) => {
    const Rex = reynolds(V, x, p.nu);
    const nux = trip ? 0.0296 * Math.pow(Rex, 0.8) * Math.cbrt(p.Pr) : NuxLocal(Rex, p.Pr);
    return { x, y: (nux * p.k) / x };
  });
  const dl = xs.map((x) => ({ x, y: boundaryThickness(x, reynolds(V, x, p.nu)) * 1000 }));
  return (
    <Two
      left={
        <div>
          <Sel
            label="Geometry"
            value={mode}
            onChange={setMode}
            options={[
              { v: 'plate', t: 'Flat plate (length L along the flow, width w)' },
              { v: 'cyl', t: 'Cylinder in crossflow (diameter D, length w)' },
              { v: 'sph', t: 'Sphere (diameter D)' },
            ]}
          />
          <Sel label="Fluid" value={fl} onChange={setFl} options={[{ v: 'air', t: 'Air (1 atm)' }, { v: 'water', t: 'Water' }]} />
          <Num label="Free-stream velocity V" unit="m/s" value={V} onChange={setV} />
          <Num label={mode === 'plate' ? 'Plate length L' : 'Diameter D'} unit="m" value={Ls} onChange={setLs} step={0.01} />
          {mode !== 'sph' && <Num label={mode === 'plate' ? 'Width w' : 'Length'} unit="m" value={w} onChange={setW} />}
          <Num label="Surface temperature" unit="°C" value={Ts} onChange={setTs} />
          <Num label="Free-stream temperature" unit="°C" value={Tinf} onChange={setTinf} />
          {mode === 'plate' && (
            <label style={{ display: 'block', margin: '6px 0', fontSize: '.9rem' }}>
              <input type="checkbox" checked={trip} onChange={(e) => setTrip(e.target.checked)} /> flow tripped to turbulent at the leading edge
            </label>
          )}
        </div>
      }
      right={
        <div>
          <Chips
            items={[
              [`properties at ${f(mode === 'sph' ? Tinf : Tf, 3)} °C`, `ν=${f(p.nu, 4)}, k=${f(p.k, 4)}, Pr=${f(p.Pr, 4)}`],
              ['Re', f(Rel, 5)],
              ['regime', regime],
            ]}
          />
          <Readout
            items={[
              ['Nu', f(Nu, 5)],
              ['h', `${f(h)} W/m²K`],
              ['Q', `${f(Q)} W`],
              ...(mode === 'plate' ? ([['Transition x_cr', `${f(xcr, 4)} m`], ['Drag (one side)', `${f(F, 3)} N`]] as [string, string][]) : []),
            ]}
          />
          {note && <Note>{note}</Note>}
          {mode === 'plate' && (
            <>
              <Plot
                x={[0, Ls]}
                y={[0, Math.max(...hx.map((p2) => p2.y)) * 1.1]}
                series={[{ points: hx, color: 'var(--c1)', label: 'local h(x)' }]}
                hlines={[{ y: h, dash: true, label: 'average h' }]}
                vlines={[{ x: xcr, dash: true, label: 'x_cr' }]}
                height={220}
                xLabel="x (m)"
                yLabel="h (W/m²K)"
              />
              <Plot x={[0, Ls]} y={[0, Math.max(...dl.map((p2) => p2.y)) * 1.1]} series={[{ points: dl, color: 'var(--c2)', label: 'δ(x) (mm)' }]} height={200} xLabel="x (m)" yLabel="δ (mm)" />
            </>
          )}
        </div>
      }
    />
  );
}

