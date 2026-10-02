import { useState } from 'react';
import { Plot } from '../../../core/Plot';
import { Readout } from '../../../core/ui';
import { Chips, Note, Num, Sel, Two, f, range } from '../viz/Kit';
import { SIGMA, air, water, filmT } from '../lib/props';
import {
  NuLaminarFD,
  NuHausen,
  NuDittusBoelter,
  NuGnielinski,
  frictionPetukhov,
  frictionLaminar,
  hydraulicDiameter,
  flowRegime,
  entryLengthLaminarHydro,
  entryLengthLaminarThermal,
  entryLengthTurbulent,
  outletTempConstTs,
  outletTempConstQ,
  pressureDrop,
  Rayleigh,
  NuVerticalFull,
  NuVerticalLaminar,
  NuHorizontalPlate,
  NuHorizontalCylinder,
  NuSphereNatural,
  NuEnclosureHorizontal,
  NuEnclosureVertical,
} from '../lib/convection';
import { effectiveness, HXType, rateHX, lmtd, Fshell1, hxProfile, ntuFromEffectiveness } from '../lib/hx';
import { Eb, planck, bandFraction, lambdaMax, enclosure, withShields, F_disks, F_parallelRect } from '../lib/radiation';

/* ============================== 5. internal flow ============================== */
export function InternalTool() {
  const [fl, setFl] = useState<'air' | 'water'>('water');
  const [shape, setShape] = useState<'circle' | 'rect'>('circle');
  const [D, setD] = useState(0.02);
  const [a, setA] = useState(0.2);
  const [b, setB] = useState(0.1);
  const [L, setL] = useState(2.5);
  const [mdot, setMdot] = useState(0.07);
  const [Ti, setTi] = useState(15);
  const [bc, setBc] = useState<'q' | 'Ts'>('q');
  const [qs, setQs] = useState(25000);
  const [Ts, setTs] = useState(100);
  const [corr, setCorr] = useState<'auto' | 'gn' | 'db'>('auto');

  const Dh = shape === 'circle' ? D : hydraulicDiameter(a * b, 2 * (a + b));
  const Ac = shape === 'circle' ? (Math.PI * D * D) / 4 : a * b;
  const P = shape === 'circle' ? Math.PI * D : 2 * (a + b);
  const As = P * L;
  const fluid = (T: number) => (fl === 'air' ? air(T) : water(T));
  // iterate on the mean fluid temperature
  let Te = Ti + 10;
  let h = 100;
  let Re = 0;
  let Nu = 0;
  let fric = 0;
  let p = fluid(Ti);
  for (let it = 0; it < 12; it++) {
    const Tb = (Ti + Te) / 2;
    p = fluid(Tb);
    Re = (mdot * Dh) / (Ac * p.mu);
    const reg = flowRegime(Re);
    if (reg === 'laminar') {
      fric = frictionLaminar(Re);
      const Lt = entryLengthLaminarThermal(Re, p.Pr, Dh);
      Nu = L < Lt && bc === 'Ts' ? NuHausen(Re, p.Pr, Dh, L) : NuLaminarFD(bc === 'Ts' ? 'Ts' : 'qs');
    } else {
      fric = frictionPetukhov(Re);
      const heating = bc === 'q' ? true : Ts > Ti;
      Nu = corr === 'db' ? NuDittusBoelter(Re, p.Pr, heating) : NuGnielinski(Re, p.Pr, fric);
    }
    h = (Nu * p.k) / Dh;
    Te = bc === 'q' ? outletTempConstQ(Ti, qs, As, mdot, p.cp) : outletTempConstTs(Ts, Ti, h, As, mdot, p.cp);
  }
  const Q = mdot * p.cp * (Te - Ti);
  const Vm = mdot / (p.rho * Ac);
  const dP = pressureDrop(fric, L, Dh, p.rho, Vm);
  const reg = flowRegime(Re);
  const xs = range(0, L, 60);
  const Tm = xs.map((x) => ({ x, y: bc === 'q' ? Ti + (qs * P * x) / (mdot * p.cp) : outletTempConstTs(Ts, Ti, h, P * x, mdot, p.cp) }));
  const Twall = xs.map((x, i) => ({ x, y: bc === 'q' ? Tm[i].y + qs / h : Ts }));
  const allT = [...Tm.map((q) => q.y), ...Twall.map((q) => q.y)];
  const warn = reg === 'transitional' ? 'Transitional (2300 < Re < 10 000): Gnielinski is accepted for Re > 3000, results are uncertain.' : '';
  return (
    <Two
      left={
        <div>
          <Sel label="Fluid" value={fl} onChange={setFl} options={[{ v: 'water', t: 'Water' }, { v: 'air', t: 'Air (1 atm)' }]} />
          <Sel label="Cross-section" value={shape} onChange={setShape} options={[{ v: 'circle', t: 'Circular tube' }, { v: 'rect', t: 'Rectangular duct (a × b)' }]} />
          {shape === 'circle' ? <Num label="Diameter D" unit="m" value={D} onChange={setD} step={0.001} /> : (
            <>
              <Num label="a" unit="m" value={a} onChange={setA} step={0.01} />
              <Num label="b" unit="m" value={b} onChange={setB} step={0.01} />
            </>
          )}
          <Num label="Length L" unit="m" value={L} onChange={setL} />
          <Num label="Mass flow" unit="kg/s" value={mdot} onChange={setMdot} step={0.01} />
          <Num label="Inlet temperature" unit="°C" value={Ti} onChange={setTi} />
          <Sel label="Thermal condition" value={bc} onChange={setBc} options={[{ v: 'q', t: 'Constant wall heat flux' }, { v: 'Ts', t: 'Constant wall temperature' }]} />
          {bc === 'q' ? <Num label="Heat flux q″" unit="W/m²" value={qs} onChange={setQs} /> : <Num label="Wall temperature" unit="°C" value={Ts} onChange={setTs} />}
          <Sel label="Turbulent correlation" value={corr} onChange={setCorr} options={[{ v: 'auto', t: 'Gnielinski (default)' }, { v: 'gn', t: 'Gnielinski' }, { v: 'db', t: 'Dittus–Boelter' }]} />
        </div>
      }
      right={
        <div>
          <Chips
            items={[
              ['Dh', `${f(Dh * 100, 4)} cm`],
              ['Re', f(Re, 5), reg === 'laminar' ? 'ok' : reg === 'turbulent' ? 'ok' : 'warn'],
              ['regime', reg],
              ['properties at Tb', `${f((Ti + Te) / 2, 3)} °C`],
            ]}
          />
          <Readout
            items={[
              ['Nu', f(Nu, 5)],
              ['h', `${f(h)} W/m²K`],
              ['Exit T (mean)', `${f(Te, 4)} °C`],
              ['Heat rate', `${f(Q)} W`],
              ['Pressure drop', `${f(dP)} Pa`],
              ['Pump power', `${f((dP * mdot) / p.rho, 3)} W`],
            ]}
          />
          <Chips
            items={[
              ['L_h (laminar)', `${f(entryLengthLaminarHydro(Re, Dh), 3)} m`],
              ['L_t (laminar)', `${f(entryLengthLaminarThermal(Re, p.Pr, Dh), 3)} m`],
              ['L_h (turbulent)', `${f(entryLengthTurbulent(Dh), 3)} m`],
              ['mean velocity', `${f(Vm, 3)} m/s`],
            ]}
          />
          {warn && <Note>{warn}</Note>}
          <Plot
            x={[0, L]}
            y={[Math.min(...allT) - 2, Math.max(...allT, Ts) + 2]}
            series={[
              { points: Tm, color: 'var(--c1)', label: 'mean fluid T_m(x)' },
              { points: Twall, color: 'var(--c3)', label: 'wall T_s(x)', dash: true },
            ]}
            height={260}
            xLabel="x (m)"
            yLabel="T (°C)"
            legend
          />
        </div>
      }
    />
  );
}

/* ============================== 6. natural convection ============================== */
type NGeom = 'vert' | 'hup' | 'hdown' | 'hcyl' | 'sphere' | 'encl-h' | 'encl-v';
export function NaturalTool() {
  const [g, setG] = useState<NGeom>('vert');
  const [Ts, setTs] = useState(90);
  const [Tinf, setTinf] = useState(25);
  const [L, setL] = useState(0.5);
  const [W, setW] = useState(2);
  const [H, setH] = useState(0.6);
  const [eps, setEps] = useState(0.85);
  const [Tsurr, setTsurr] = useState(25);
  const [fluid, setFluid] = useState<'air' | 'water'>('air');
  const enclosure_ = g === 'encl-h' || g === 'encl-v';
  const p = (fluid === 'air' ? air : water)(filmT(Ts, Tinf));
  const dT = Math.abs(Ts - Tinf);
  const Lc = g === 'hup' || g === 'hdown' ? (L * W) / (2 * (L + W)) : L;
  const Ra = Rayleigh(p.beta, dT, Lc, p.nu, p.alpha);
  let Nu = 1;
  let rangeNote = '';
  if (g === 'vert') {
    Nu = NuVerticalFull(Ra, p.Pr);
    rangeNote = Ra < 1e9 ? `laminar-only formula would give Nu = ${f(NuVerticalLaminar(Ra, p.Pr), 4)}` : 'Ra > 10⁹: turbulent, full-range formula';
  } else if (g === 'hup') Nu = NuHorizontalPlate(Ra, true);
  else if (g === 'hdown') Nu = NuHorizontalPlate(Ra, false);
  else if (g === 'hcyl') Nu = NuHorizontalCylinder(Ra, p.Pr);
  else if (g === 'sphere') Nu = NuSphereNatural(Ra, p.Pr);
  else if (g === 'encl-h') Nu = Ra < 1708 ? 1 : NuEnclosureHorizontal(Ra);
  else Nu = Ra < 1708 ? 1 : NuEnclosureVertical(Ra, p.Pr, H, L);
  const h = (Nu * p.k) / Lc;
  const area = g === 'vert' ? L * W : g === 'hup' || g === 'hdown' ? L * W : g === 'hcyl' ? Math.PI * L * W : g === 'sphere' ? Math.PI * L * L : W * H;
  const Qc = h * area * (Ts - Tinf);
  const Qr = enclosure_ ? 0 : eps * area * SIGMA * ((Ts + 273.15) ** 4 - (Tsurr + 273.15) ** 4);
  const hrad = Qr / (area * (Ts - Tsurr || 1));
  const dts = range(2, 150, 60).map((d) => {
    const pp = (fluid === 'air' ? air : water)(filmT(Tinf + d, Tinf));
    const R = Rayleigh(pp.beta, d, Lc, pp.nu, pp.alpha);
    const n = g === 'vert' ? NuVerticalFull(R, pp.Pr) : g === 'hup' ? NuHorizontalPlate(R, true) : g === 'hdown' ? NuHorizontalPlate(R, false) : g === 'hcyl' ? NuHorizontalCylinder(R, pp.Pr) : g === 'sphere' ? NuSphereNatural(R, pp.Pr) : g === 'encl-h' ? (R < 1708 ? 1 : NuEnclosureHorizontal(R)) : R < 1708 ? 1 : NuEnclosureVertical(R, pp.Pr, H, L);
    return { x: d, y: (n * pp.k) / Lc };
  });
  const lab: Record<NGeom, string> = {
    vert: 'Vertical plate / wall (height L)',
    hup: 'Horizontal plate, hot face up',
    hdown: 'Horizontal plate, hot face down',
    hcyl: 'Horizontal cylinder (diameter L, length W)',
    sphere: 'Sphere (diameter L)',
    'encl-h': 'Horizontal enclosure heated from below (gap L, area W × H)',
    'encl-v': 'Vertical enclosure (gap L, height H, width W)',
  };
  return (
    <Two
      left={
        <div>
          <Sel label="Geometry" value={g} onChange={setG} options={(Object.keys(lab) as NGeom[]).map((v) => ({ v, t: lab[v] }))} />
          <Sel label="Fluid" value={fluid} onChange={setFluid} options={[{ v: 'air', t: 'Air' }, { v: 'water', t: 'Water' }]} />
          <Num label={enclosure_ ? 'Hot-surface T' : 'Surface temperature'} unit="°C" value={Ts} onChange={setTs} />
          <Num label={enclosure_ ? 'Cold-surface T' : 'Fluid temperature'} unit="°C" value={Tinf} onChange={setTinf} />
          <Num label={g === 'vert' ? 'Height L' : g === 'hup' || g === 'hdown' ? 'Plate side a' : g === 'hcyl' || g === 'sphere' ? 'Diameter' : 'Gap L'} unit="m" value={L} onChange={setL} step={0.01} />
          {g !== 'sphere' && <Num label="Width / length W" unit="m" value={W} onChange={setW} />}
          {g === 'encl-v' && <Num label="Height H" unit="m" value={H} onChange={setH} />}
          {!enclosure_ && (
            <>
              <Num label="Emissivity ε" value={eps} onChange={setEps} step={0.05} />
              <Num label="Surroundings T" unit="°C" value={Tsurr} onChange={setTsurr} />
            </>
          )}
        </div>
      }
      right={
        <div>
          <Chips items={[['T_f', `${f(filmT(Ts, Tinf), 3)} °C`], ['β', f(p.beta, 4)], ['Lc', `${f(Lc, 4)} m`], ['Ra', f(Ra, 4), Ra < 1e9 ? 'ok' : 'warn']]} />
          <Readout
            items={[
              ['Nu', f(Nu, 4)],
              ['h', `${f(h)} W/m²K`],
              ['Q convection', `${f(Qc)} W`],
              ...(enclosure_ ? [] : ([['Q radiation', `${f(Qr)} W (h_rad ${f(hrad, 3)})`], ['Total', `${f(Qc + Qr)} W`]] as [string, string][])),
            ]}
          />
          {rangeNote && <Note>{rangeNote}</Note>}
          {enclosure_ && Ra < 1708 && <Note>Ra &lt; 1708: no circulation; the gap conducts only (Nu = 1).</Note>}
          <Plot x={[2, 150]} y={[0, Math.max(...dts.map((q) => q.y)) * 1.1]} series={[{ points: dts, color: 'var(--c1)', label: 'h vs ΔT' }]} height={240} xLabel="ΔT (K)" yLabel="h (W/m²K)" vlines={[{ x: dT, dash: true, label: 'your ΔT' }]} />
        </div>
      }
    />
  );
}

/* ============================== 7. heat exchangers ============================== */
const HX_TYPES: { v: HXType; t: string }[] = [
  { v: 'counter', t: 'Counterflow' },
  { v: 'parallel', t: 'Parallel flow' },
  { v: 'shell1', t: '1 shell pass, 2+ tube passes' },
  { v: 'cross-unmixed', t: 'Cross-flow, both unmixed' },
  { v: 'cross-cmax-mixed', t: 'Cross-flow, Cmax mixed' },
  { v: 'cross-cmin-mixed', t: 'Cross-flow, Cmin mixed' },
];
export function HXTool() {
  const [type, setType] = useState<HXType>('counter');
  const [mode, setMode] = useState<'rate' | 'size'>('rate');
  const [mh, setMh] = useState(1.2);
  const [ch, setCh] = useState(2100);
  const [Thi, setThi] = useState(110);
  const [mc, setMc] = useState(0.9);
  const [cc, setCc] = useState(4180);
  const [Tci, setTci] = useState(30);
  const [UA, setUA] = useState(2178);
  const [Tho, setTho] = useState(70);
  const [U, setU] = useState(350);
  const Ch = mh * ch;
  const Cc = mc * cc;
  const Cmin = Math.min(Ch, Cc);
  const Cr = Cmin / Math.max(Ch, Cc);
  // rating
  const r = rateHX(type, UA, Ch, Cc, Thi, Tci);
  // sizing from the hot outlet
  const Qs = Ch * (Thi - Tho);
  const Tco = Tci + Qs / Cc;
  const epsS = Qs / (Cmin * (Thi - Tci));
  const feasible = epsS > 0 && epsS < 1;
  let NTUs = NaN;
  try {
    NTUs = feasible ? ntuFromEffectiveness(type, epsS, Cr) : NaN;
  } catch {
    NTUs = NaN;
  }
  const dT1 = type === 'parallel' ? Thi - Tci : Thi - Tco;
  const dT2 = type === 'parallel' ? Tho - Tco : Tho - Tci;
  const lm = lmtd(dT1, dT2);
  const Pf = (Tco - Tci) / (Thi - Tci);
  const Rf = (Thi - Tho) / (Tco - Tci);
  let F = 1;
  if (type === 'shell1') {
    try {
      F = Fshell1(Pf, Rf);
    } catch {
      F = NaN;
    }
  }
  const Asz = (NTUs * Cmin) / U; // from epsilon-NTU (valid for every type)
  const lmtdOK = type === 'counter' || type === 'parallel' || type === 'shell1';
  const prof = type === 'parallel' || type === 'counter' ? hxProfile(type, mode === 'rate' ? UA : NTUs * Cmin || UA, Ch, Cc, Thi, Tci, 60) : null;
  const curves = [0, 0.25, 0.5, 0.75, 1].map((c) => ({ c, pts: range(0, 5, 60).map((n) => ({ x: n, y: effectiveness(type, n, c) })) }));
  const colors = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
  return (
    <Two
      left={
        <div>
          <Sel label="Type" value={type} onChange={setType} options={HX_TYPES} />
          <Sel label="Problem" value={mode} onChange={setMode} options={[{ v: 'rate', t: 'Rating: UA given → outlets (ε–NTU)' }, { v: 'size', t: 'Sizing: hot outlet given → area (LMTD)' }]} />
          <b style={{ fontSize: '.85rem' }}>Hot stream</b>
          <Num label="ṁ" unit="kg/s" value={mh} onChange={setMh} />
          <Num label="cp" unit="J/kgK" value={ch} onChange={setCh} />
          <Num label="Inlet T" unit="°C" value={Thi} onChange={setThi} />
          <b style={{ fontSize: '.85rem' }}>Cold stream</b>
          <Num label="ṁ" unit="kg/s" value={mc} onChange={setMc} />
          <Num label="cp" unit="J/kgK" value={cc} onChange={setCc} />
          <Num label="Inlet T" unit="°C" value={Tci} onChange={setTci} />
          {mode === 'rate' ? <Num label="UA" unit="W/K" value={UA} onChange={setUA} /> : (
            <>
              <Num label="Hot outlet T (target)" unit="°C" value={Tho} onChange={setTho} />
              <Num label="U" unit="W/m²K" value={U} onChange={setU} />
            </>
          )}
        </div>
      }
      right={
        <div>
          <Chips items={[['C_h', `${f(Ch)} W/K`], ['C_c', `${f(Cc)} W/K`], ['C_min', Ch <= Cc ? 'hot' : 'cold'], ['C_r', f(Cr, 4)]]} />
          {mode === 'rate' ? (
            <Readout items={[['NTU', f(r.NTU, 4)], ['ε', f(r.eps, 4)], ['Q', `${f(r.Q)} W`], ['Hot outlet', `${f(r.Tho, 4)} °C`], ['Cold outlet', `${f(r.Tco, 4)} °C`]]} />
          ) : feasible ? (
            <Readout items={[['Q', `${f(Qs)} W`], ['Cold outlet', `${f(Tco, 4)} °C`], ['ε required', f(epsS, 4)], ['NTU required', f(NTUs, 4)], ...(lmtdOK ? ([['LMTD (' + (type === 'parallel' ? 'parallel' : 'counterflow') + ' ends)', `${f(lm, 4)} K`], ['F', f(F, 4)]] as [string, string][]) : []), ['Area', `${f(Asz, 4)} m²`]]} />
          ) : (
            <Note>The requested outlet temperature violates the second law (ε ≥ 1 or negative).</Note>
          )}
          {prof && (
            <Plot
              x={[0, 1]}
              y={[Math.min(Tci, Tho) - 5, Thi + 5]}
              series={[
                { points: prof.x.map((x, i) => ({ x, y: prof.Th[i] })), color: 'var(--c3)', label: 'hot' },
                { points: prof.x.map((x, i) => ({ x, y: prof.Tc[i] })), color: 'var(--c1)', label: 'cold' },
              ]}
              height={240}
              xLabel="position along the exchanger (hot inlet at 0)"
              yLabel="T (°C)"
              legend
            />
          )}
          <Plot
            x={[0, 5]}
            y={[0, 1]}
            series={curves.map((cv, i) => ({ points: cv.pts, color: colors[i], label: `Cr = ${cv.c}` }))}
            dots={mode === 'rate' ? [{ x: r.NTU, y: r.eps, label: 'now' }] : feasible && Number.isFinite(NTUs) ? [{ x: NTUs, y: epsS, label: 'design' }] : []}
            height={240}
            xLabel="NTU"
            yLabel="effectiveness ε"
            legend
          />
        </div>
      }
    />
  );
}

/* ============================== 8. radiation ============================== */
export function RadiationTool() {
  const [tab, setTab] = useState<'band' | 'net' | 'shield'>('band');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
        {(
          [
            ['band', 'Planck / Wien / bands'],
            ['net', '3-surface enclosure'],
            ['shield', 'Parallel plates and shields'],
          ] as const
        ).map(([v, t]) => (
          <button key={v} className="btn" onClick={() => setTab(v)} style={{ fontWeight: tab === v ? 700 : 400 }}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'band' && <BandPane />}
      {tab === 'net' && <NetPane />}
      {tab === 'shield' && <ShieldPane />}
    </div>
  );
}

function BandPane() {
  const [T, setT] = useState(5800);
  const [l1, setL1] = useState(0.4);
  const [l2, setL2] = useState(0.7);
  const lm = lambdaMax(T);
  const frac = bandFraction(l2 * T) - bandFraction(l1 * T);
  const lo = Math.max(0.05, lm / 8);
  const hi = lm * 14;
  const pts = range(lo, hi, 200).map((l) => ({ x: l, y: planck(l, T) / 1e6 }));
  const band = pts.filter((q) => q.x >= l1 && q.x <= l2);
  return (
    <Two
      left={
        <div>
          <Num label="Blackbody temperature" unit="K" value={T} onChange={setT} />
          <Num label="λ₁" unit="µm" value={l1} onChange={setL1} step={0.1} />
          <Num label="λ₂" unit="µm" value={l2} onChange={setL2} step={0.1} />
          <Note>Visible: 0.4–0.7 µm. Thermal infrared: 0.7–100 µm.</Note>
        </div>
      }
      right={
        <div>
          <Readout items={[['E_b = σT⁴', `${f(Eb(T))} W/m²`], ['λ_max (Wien)', `${f(lm, 4)} µm`], ['Fraction in band', `${f(100 * frac, 4)} %`], ['Band power', `${f(frac * Eb(T))} W/m²`]]} />
          <Plot
            x={[lo, hi]}
            y={[0, Math.max(...pts.map((q) => q.y)) * 1.1]}
            series={[{ points: pts, color: 'var(--c1)', label: 'E_bλ (MW/m²µm)' }, { points: band, color: 'var(--c3)', width: 4, label: 'band' }]}
            vlines={[{ x: lm, dash: true, label: 'λ_max' }]}
            height={260}
            xLabel="wavelength (µm)"
            yLabel="E_bλ (MW/m² µm)"
            legend
          />
        </div>
      }
    />
  );
}

function NetPane() {
  const [A, setA] = useState<[number, number, number]>([1, 1, 4]);
  const [eps, setEps] = useState<[number, number, number]>([0.9, 0.7, 1]);
  const [T, setT] = useState<[number, number, number]>([900, 400, 300]);
  const [rerad3, setRerad3] = useState(true);
  const [F12, setF12] = useState(0.1998);
  const [F13, setF13] = useState(0.8002);
  const set3 = <X,>(arr: [X, X, X], i: number, v: X): [X, X, X] => arr.map((q, j) => (j === i ? v : q)) as [X, X, X];
  // view factors by reciprocity and summation
  const F21 = (A[0] * F12) / A[1];
  const F23 = 1 - F21;
  const F31 = (A[0] * F13) / A[2];
  const F32 = (A[1] * F23) / A[2];
  const F33 = 1 - F31 - F32;
  const F = [
    [0, F12, F13],
    [F21, 0, F23],
    [F31, F32, F33],
  ];
  let res: ReturnType<typeof enclosure> | null = null;
  let err = '';
  try {
    res = enclosure(
      [
        { A: A[0], eps: eps[0], T: T[0] },
        { A: A[1], eps: eps[1], T: T[1] },
        rerad3 ? { A: A[2], eps: eps[2], Q: 0 } : { A: A[2], eps: eps[2], T: T[2] },
      ],
      F,
    );
  } catch (e) {
    err = (e as Error).message;
  }
  const rows = ['1', '2', '3'];
  const Rs = (i: number) => (eps[i] >= 1 ? 0 : (1 - eps[i]) / (eps[i] * A[i]));
  return (
    <Two
      left={
        <div>
          {rows.map((r, i) => (
            <div key={r} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', margin: '6px 0' }}>
              <b style={{ fontSize: '.85rem' }}>Surface {r}</b>
              <Num label="Area" unit="m²" value={A[i]} onChange={(v) => setA(set3(A, i, v))} />
              <Num label="Emissivity" value={eps[i]} onChange={(v) => setEps(set3(eps, i, v))} step={0.05} min={0.01} max={1} />
              {(i < 2 || !rerad3) && <Num label="Temperature" unit="K" value={T[i]} onChange={(v) => setT(set3(T, i, v))} />}
            </div>
          ))}
          <label style={{ fontSize: '.9rem' }}>
            <input type="checkbox" checked={rerad3} onChange={(e) => setRerad3(e.target.checked)} /> surface 3 is reradiating (insulated, Q = 0)
          </label>
          <Num label="F₁₂" value={F12} onChange={(v) => { setF12(v); setF13(1 - v); }} step={0.01} />
          <Note>F₁₃ = 1 − F₁₂ (surface 1 sees no itself). The other factors follow from reciprocity and the summation rule.</Note>
        </div>
      }
      right={
        <div>
          <Chips items={[['F₂₁', f(F21, 4)], ['F₂₃', f(F23, 4)], ['F₃₁', f(F31, 4)], ['F₃₂', f(F32, 4)], ['F₃₃', f(F33, 4)]]} />
          {err && <Note>{err}</Note>}
          {res && (
            <>
              <table style={{ width: '100%', fontSize: '.85rem' }}>
                <thead>
                  <tr>
                    <th>Surface</th>
                    <th>R_surface (m⁻²·…)</th>
                    <th>E_b (W/m²)</th>
                    <th>J (W/m²)</th>
                    <th>Q (W)</th>
                    <th>T (K)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r}>
                      <td style={{ textAlign: 'center' }}>{r}</td>
                      <td style={{ textAlign: 'center' }}>{f(Rs(i), 4)}</td>
                      <td style={{ textAlign: 'center' }}>{f(Eb(res!.T[i]), 5)}</td>
                      <td style={{ textAlign: 'center' }}>{f(res!.J[i], 5)}</td>
                      <td style={{ textAlign: 'center' }}>{f(res!.Q[i], 5)}</td>
                      <td style={{ textAlign: 'center' }}>{f(res!.T[i], 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Note>Check: ΣQ = {f(res.Q[0] + res.Q[1] + res.Q[2], 3)} W (zero in a closed enclosure). A positive Q is net radiation leaving the surface.</Note>
            </>
          )}
          <Chips
            items={[
              ['disks r=L=1', `F = ${f(F_disks(1, 1, 1), 4)}`],
              ['squares 1×1 at 1', `F = ${f(F_parallelRect(1, 1, 1), 4)}`],
            ]}
          />
        </div>
      }
    />
  );
}

function ShieldPane() {
  const [T1, setT1] = useState(700);
  const [T2, setT2] = useState(350);
  const [e1, setE1] = useState(0.6);
  const [e2, setE2] = useState(0.9);
  const [es, setEs] = useState(0.15);
  const [N, setN] = useState(1);
  const q0 = withShields(T1, T2, e1, e2, es, 0);
  const qN = withShields(T1, T2, e1, e2, es, N);
  const pts = range(0, 6, 6).map((n) => ({ x: n, y: withShields(T1, T2, e1, e2, es, n) }));
  // shield temperatures: Eb drops linearly with the resistance from plate 1 (all shields identical)
  const temps: number[] = [];
  for (let i = 1; i <= N; i++) {
    const Rfrom1 = 1 / e1 + 1 / es - 1 + (i - 1) * (2 / es - 1);
    temps.push(Math.pow((Eb(T1) - qN * Rfrom1) / SIGMA, 0.25));
  }
  return (
    <Two
      left={
        <div>
          <Num label="Plate 1 temperature" unit="K" value={T1} onChange={setT1} />
          <Num label="Plate 2 temperature" unit="K" value={T2} onChange={setT2} />
          <Num label="ε₁" value={e1} onChange={setE1} step={0.05} />
          <Num label="ε₂" value={e2} onChange={setE2} step={0.05} />
          <Num label="Shield emissivity (both sides)" value={es} onChange={setEs} step={0.05} />
          <Num label="Number of shields" value={N} onChange={(v) => setN(Math.max(0, Math.round(v)))} step={1} />
        </div>
      }
      right={
        <div>
          <Readout items={[['q without shields', `${f(q0)} W/m²`], [`q with ${N} shield(s)`, `${f(qN)} W/m²`], ['Reduction', `${f(100 * (1 - qN / q0), 4)} %`]]} />
          {temps.length > 0 && <Note>Shield temperatures (plate 1 side first): {temps.map((t) => `${f(t, 4)} K`).join(', ')}</Note>}
          <Plot x={[0, 6]} y={[0, q0 * 1.05]} series={[{ points: pts, color: 'var(--c1)', label: 'q vs number of shields' }]} dots={[{ x: N, y: qN, label: 'now' }]} height={240} xLabel="number of shields" yLabel="q (W/m²)" />
        </div>
      }
    />
  );
}

/* ============================== 9. properties ============================== */
export function PropsTool() {
  const [fl, setFl] = useState<'air' | 'water'>('air');
  const [T, setT] = useState(40);
  const p = (fl === 'air' ? air : water)(T);
  const Ts = range(fl === 'air' ? -50 : 1, fl === 'air' ? 400 : 140, 80);
  const get = (x: number) => (fl === 'air' ? air : water)(x);
  const [what, setWhat] = useState<'k' | 'nu' | 'Pr' | 'rho' | 'cp' | 'mu'>('nu');
  const pts = Ts.map((x) => ({ x, y: get(x)[what] }));
  const lbl: Record<string, string> = { k: 'k (W/mK)', nu: 'ν (m²/s)', Pr: 'Pr', rho: 'ρ (kg/m³)', cp: 'cp (J/kgK)', mu: 'μ (Pa·s)' };
  const lo = Math.min(...pts.map((q) => q.y));
  const hi = Math.max(...pts.map((q) => q.y));
  return (
    <Two
      left={
        <div>
          <Sel label="Fluid" value={fl} onChange={setFl} options={[{ v: 'air', t: 'Air at 1 atm' }, { v: 'water', t: 'Saturated liquid water' }]} />
          <Num label="Temperature" unit="°C" value={T} onChange={setT} />
          <Sel label="Plot" value={what} onChange={setWhat} options={(Object.keys(lbl) as (keyof typeof lbl)[]).map((v) => ({ v: v as 'k', t: lbl[v] }))} />
          <Note>Generated with CoolProp and interpolated; textbook tables can differ in the last digit.</Note>
        </div>
      }
      right={
        <div>
          <Readout
            items={[
              ['ρ', `${f(p.rho, 5)} kg/m³`],
              ['cp', `${f(p.cp, 5)} J/kgK`],
              ['k', `${f(p.k, 5)} W/mK`],
              ['μ', `${f(p.mu, 5)} Pa·s`],
              ['ν', `${f(p.nu, 5)} m²/s`],
              ['α', `${f(p.alpha, 5)} m²/s`],
              ['Pr', f(p.Pr, 5)],
              ['β', `${f(p.beta, 5)} 1/K`],
            ]}
          />
          <Plot x={[Ts[0], Ts[Ts.length - 1]]} y={[lo - (hi - lo) * 0.05, hi + (hi - lo) * 0.05]} series={[{ points: pts, color: 'var(--c1)' }]} dots={[{ x: T, y: p[what] }]} height={260} xLabel="T (°C)" yLabel={lbl[what]} />
        </div>
      }
    />
  );
}
