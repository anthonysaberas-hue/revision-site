/* Group G simulations — ramjet (Final B P3 / RJ43-9 project), detonation (Final A P1),
   Merlin/Raptor nozzle lip waves (Final A P2), capillary tube to vacuum (Final B P2). */
import { useMemo, useState } from 'react';
import { Plot, sample } from '../../../core/Plot';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import { FlowSection3D, FieldPoint } from '../viz/FlowSection3D';
import { fmt } from './common';
import { A_Astar, M_from_A_Astar, massFlux, p_p0, T_T0, T0_T } from '../lib/isentropic';
import { p_pstar as ray_p_pstar, T_Tstar as ray_T_Tstar, T0_T0star, M_from_T0_T0star } from '../lib/rayleigh';
import { ramjetDesign, ramjetOffDesign, Flight } from '../lib/ramjet';
import { cjMach, detonation, hugoniotP, rayleighLineP } from '../lib/detonation';
import { optimumAreaRatio, exitVelocity } from '../lib/rocket';
import { sigmaFromPressureRatio, deltaFromSigma } from '../lib/obliqueShock';
import { nu, nuMax } from '../lib/prandtlMeyer';
import { nozzleArea } from '../lib/nozzle';
import { fLmax, M_from_fLmax, p_pstar as fan_p_pstar, T_Tstar as fan_T_Tstar } from '../lib/fanno';
import { bisect } from '../lib/solve';

const btnRow = { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 };

/* =====================================================================
   RAMJET — fixed geometry, vary Δq; the shock walks forward, then unstart
   ===================================================================== */
const RJ_PRESETS = {
  finalB: {
    label: 'Final B P3 (M 3, 250 K, 10 kPa)',
    flight: { M0: 3, T: 250, p: 10e3, R: 8314 / 28.9, cp: 1000 } as Flight,
    Ain: 1,
    Ashock: 0.4,
    Acomb: 0.6,
    qDesign: 500e3,
    qMaxSlider: 1700e3,
    fuelLHV: 0,
  },
  rj43: {
    label: 'Semester project RJ43-9 (M 2.7, 18 km, d = 0.89 m)',
    flight: { M0: 2.7, T: 216.65, p: 7505, R: 287, cp: 1005 } as Flight,
    Ain: (Math.PI * 0.89 * 0.89) / 4,
    Ashock: 0.21,
    Acomb: (Math.PI * 0.89 * 0.89) / 4,
    qDesign: 1.92e6,
    qMaxSlider: 2.3e6,
    fuelLHV: 43e6,
  },
};
type RJKey = keyof typeof RJ_PRESETS;

// axial stations of the drawn engine
const XS = { in: 0, t1: 0.42, c0: 1.0, c1: 1.75, t2: 2.0, e: 2.45 };
function blend(a: number, b: number, s: number) {
  return a + (b - a) * 0.5 * (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, s))));
}

export function RamjetSim({ preset = 'finalB' }: { preset?: RJKey }) {
  const [key, setKey] = useState<RJKey>(preset);
  const P = RJ_PRESETS[key];
  const [q, setQ] = useState(P.qDesign);
  const design = useMemo(() => ramjetDesign({ ...P.flight, Ain: P.Ain, Ashock: P.Ashock, Acomb: P.Acomb, q: P.qDesign }), [P]);
  const geom = { Ain: P.Ain, At1: design.At1, Acomb: P.Acomb, At2: design.At2, Ae: design.Ae };
  const s = useMemo(() => ramjetOffDesign(P.flight, geom, q), [P, q, design]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = 1.4;
  const unstart = s.status === 'unstart';

  const area = (x: number) => {
    if (x <= XS.t1) return blend(geom.Ain, geom.At1, x / XS.t1);
    if (x <= XS.c0) return blend(geom.At1, geom.Acomb, (x - XS.t1) / (XS.c0 - XS.t1));
    if (x <= XS.c1) return geom.Acomb;
    if (x <= XS.t2) return blend(geom.Acomb, geom.At2, (x - XS.c1) / (XS.t2 - XS.c1));
    return blend(geom.At2, geom.Ae, (x - XS.t2) / (XS.e - XS.t2));
  };
  const Amax = Math.max(geom.Ain, geom.Acomb, geom.Ae);
  const xShock = unstart ? 0.03 : bisect((x) => area(x) - Math.min(s.Ashock, geom.Acomb * 0.9999), XS.t1, XS.c0);
  const T0max = Math.max(s.T02, s.T01);
  const field = (x: number): FieldPoint => {
    const p0x = s.p0x;
    const iso = (M: number, p0: number, T0: number): FieldPoint => ({ M, p: (p0 * p_p0(M, g)) / p0x, T: (T0 * T_T0(M, g)) / T0max });
    if (x < XS.c0) {
      if (unstart) {
        if (x < xShock) return iso(P.flight.M0, p0x, s.T01);
        return iso(M_from_A_Astar(Math.max(1, area(x) / geom.At1), 'sub', g), s.p0y, s.T01);
      }
      if (x < xShock) return iso(M_from_A_Astar(Math.max(1, area(x) / geom.At1), 'sup', g), p0x, s.T01);
      return iso(M_from_A_Astar(Math.max(1, area(x) / s.Asy), 'sub', g), s.p0y, s.T01);
    }
    if (x <= XS.c1) {
      const lam = (x - XS.c0) / (XS.c1 - XS.c0);
      const T0 = s.T01 + lam * (s.T02 - s.T01);
      const M = M_from_T0_T0star(Math.min(1, T0 / s.T0star), 'sub', g);
      const pc = s.p0y * p_p0(s.Mc, g);
      const Tc = s.T01 * T_T0(s.Mc, g);
      return { M, p: (pc * (ray_p_pstar(M, g) / ray_p_pstar(s.Mc, g))) / p0x, T: (Tc * (ray_T_Tstar(M, g) / ray_T_Tstar(s.Mc, g))) / T0max };
    }
    const A = area(x);
    const M = M_from_A_Astar(Math.max(1, A / geom.At2), x < XS.t2 ? 'sub' : 'sup', g);
    return iso(M, s.p02, s.T02);
  };
  const plume = unstart ? 'subsonic' : Math.abs(s.pe / P.flight.p - 1) < 0.03 ? 'ideal' : s.pe > P.flight.p ? 'under' : 'over';
  const fuel = P.fuelLHV ? (s.mdot * q) / P.fuelLHV : 0;
  const statusText = unstart
    ? `UNSTART: Δq = ${fmt(q / 1e3, 4)} kJ/kg > Δq_max = ${fmt(s.qMax / 1e3, 4)} kJ/kg. The shock has been pushed out through the inlet throat; a bow shock stands ahead, air spills, thrust collapses.`
    : s.status === 'shock-at-combustor'
      ? 'Shock swallowed down to the combustor face (too little heat): this 1-D model stops here.'
      : `Started. Normal shock at A = ${fmt(s.Ashock, 3)} m² (Mₓ = ${fmt(s.Mx, 3)}). ${q > P.qDesign * 1.001 ? 'More heat → the shock has moved forward (weaker shock, higher p₀₂, as the choked nozzle throat demands).' : q < P.qDesign * 0.999 ? 'Less heat → the shock has moved aft (stronger shock).' : 'Design point.'}`;

  return (
    <SimFrame title="Ramjet: inlet → shock → diffuser → Rayleigh combustor → nozzle" subtitle="fixed geometry sized at the design Δq; drag Δq and watch the shock">
      <div style={btnRow}>
        {(Object.keys(RJ_PRESETS) as RJKey[]).map((k) => (
          <button
            key={k}
            className={`btn ${k === key ? 'primary' : ''}`}
            onClick={() => {
              setKey(k);
              setQ(RJ_PRESETS[k].qDesign);
            }}
          >
            {RJ_PRESETS[k].label}
          </button>
        ))}
      </div>
      <div className="controls">
        <Slider label="Heat added Δq" value={q / 1e3} min={P.qDesign / 1e3 / 4} max={P.qMaxSlider / 1e3} step={5} onChange={(v) => setQ(v * 1e3)} unit=" kJ/kg" format={(v) => v.toFixed(0)} />
      </div>
      <div style={btnRow}>
        <button className="btn" onClick={() => setQ(P.qDesign)}>
          design Δq
        </button>
        {key === 'finalB' && (
          <button className="btn" onClick={() => setQ(1000e3)}>
            part (c): 1000 kJ/kg
          </button>
        )}
        <button className="btn" onClick={() => setQ(s.qMax * 0.995)}>
          just before unstart
        </button>
        <button className="btn" onClick={() => setQ(s.qMax * 1.05)}>
          over the limit
        </button>
      </div>
      <div className="regime" style={unstart ? { background: 'var(--warn-soft)', color: 'var(--warn)' } : undefined}>
        {statusText}
      </div>
      <FlowSection3D
        wall="plain"
        x0={0}
        x1={XS.e}
        profile={(x) => 0.32 * Math.sqrt(area(x) / Amax)}
        field={field}
        colorBy="M"
        shocks={[xShock]}
        heatZone={[XS.c0 + 0.05, XS.c1 - 0.05]}
        plume={{ kind: plume, strength: 1 }}
        labels={[
          { x: 0.02, text: `M∞ = ${P.flight.M0}` },
          { x: XS.t1, text: unstart ? 'throat 1' : 'throat 1 · M = 1', side: 'bottom' },
          { x: xShock, text: unstart ? 'bow shock' : `shock Mₓ ${fmt(s.Mx, 3)}` },
          { x: (XS.c0 + XS.c1) / 2, text: `Δq · M ${fmt(s.Mc, 2)} → ${fmt(s.M2, 2)}`, side: 'bottom' },
          { x: XS.t2, text: 'throat 2 · M = 1' },
          { x: XS.e, text: `exit M ${fmt(s.Me, 3)}`, side: 'bottom' },
        ]}
        height={300}
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ fontSize: '0.82rem', width: '100%', marginTop: 8 }}>
          <thead>
            <tr>
              <th>station</th>
              <th>M</th>
              <th>p₀ (kPa)</th>
              <th>T₀ (K)</th>
              <th>A (m²)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>free stream ∞</td><td>{fmt(P.flight.M0, 3)}</td><td>{fmt(s.p0x / 1e3)}</td><td>{fmt(s.T01)}</td><td>{fmt(geom.Ain, 4)}</td></tr>
            <tr><td>inlet throat 1</td><td>1</td><td>{fmt(s.p0x / 1e3)}</td><td>{fmt(s.T01)}</td><td>{fmt(geom.At1, 4)}</td></tr>
            <tr><td>shock x → y</td><td>{unstart ? '—' : `${fmt(s.Mx, 3)} → ${fmt(s.My, 3)}`}</td><td>{fmt(s.p0x / 1e3)} → {fmt(s.p0y / 1e3)}</td><td>{fmt(s.T01)}</td><td>{unstart ? '—' : fmt(s.Ashock, 4)}</td></tr>
            <tr><td>combustor in</td><td>{fmt(s.Mc, 3)}</td><td>{fmt(s.p0y / 1e3)}</td><td>{fmt(s.T01)}</td><td>{fmt(geom.Acomb, 4)}</td></tr>
            <tr><td>combustor out</td><td>{fmt(s.M2, 3)}</td><td>{fmt(s.p02 / 1e3)}</td><td>{fmt(s.T02)}</td><td>{fmt(geom.Acomb, 4)}</td></tr>
            <tr><td>nozzle throat 2</td><td>1</td><td>{fmt(s.p02 / 1e3)}</td><td>{fmt(s.T02)}</td><td>{fmt(geom.At2, 4)}</td></tr>
            <tr><td>exit</td><td>{fmt(s.Me, 3)}</td><td>{fmt(s.p02 / 1e3)}</td><td>{fmt(s.T02)}</td><td>{fmt(geom.Ae, 4)}</td></tr>
          </tbody>
        </table>
      </div>
      <Readout
        items={[
          ['captured ṁ', `${fmt(s.mdot)} kg/s`],
          ['V∞ → V_e', `${fmt(s.V0)} → ${fmt(s.Ve)} m/s`],
          ['p_e vs p∞', `${fmt(s.pe / 1e3)} vs ${fmt(P.flight.p / 1e3)} kPa`],
          ['thrust F', unstart ? 'collapses' : `${fmt(s.F / 1e3)} kN`],
          ['Δq window (started)', `${fmt(Math.max(0, s.qMin) / 1e3, 3)} – ${fmt(s.qMax / 1e3, 4)} kJ/kg`],
          ['Δq* at DESIGN entry M', `${fmt((P.flight.cp * (design.T0star - design.T01)) / 1e3, 4)} kJ/kg`],
          ...(P.fuelLHV ? ([['fuel flow', `${fmt(fuel, 3)} kg/s (unstart at ${fmt((s.mdot * s.qMax) / P.fuelLHV, 3)})`]] as [string, string][]) : []),
        ]}
      />
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
        Geometry (inlet throat, combustor, nozzle throat and exit) is sized once at the design Δq exactly as in Final B P3(a); the slider then runs the
        fixed engine off-design. The nozzle throat pins the combustor-exit Mach number, so extra heat must be paid for with a higher p₀₂: the shock moves
        forward to a weaker position. When it reaches the inlet throat there is nowhere left to go and the inlet unstarts. Thrust =
        ṁ(V_e − V∞) + (p_e − p∞)A_e, fuel mass neglected. All numbers come from lib/ramjet.ts.
      </p>
    </SimFrame>
  );
}

/* =====================================================================
   DETONATION — ZND structure in a tube + p–v (Hugoniot / Rayleigh line)
   ===================================================================== */
export function DetonationSim({ q0 = 4000, cp = 3, T1 = 300 }: { q0?: number; cp?: number; T1?: number }) {
  const g = 1.4;
  const [q, setQ] = useState(q0);
  const Q = q / (cp * T1);
  const Mcj = cjMach(Q, g);
  const [ratio, setRatio] = useState(1);
  const M1 = Mcj * ratio;
  const d = useMemo(() => detonation(M1, Q, g), [M1, Q]);
  const Tmax = Math.max(d.end.T, d.at(1).T, d.vn.T) * 1.02;
  const xs = 0.45;
  const xe = 1.6;
  const lamOf = (x: number) => {
    const s = Math.min(1, Math.max(0, (x - xs) / (xe - xs)));
    return (1 - Math.exp(-4 * s)) / (1 - Math.exp(-4));
  };
  const field = (x: number): FieldPoint => {
    if (x < xs) return { M: M1, p: 1 / d.vn.p, T: 1 / Tmax };
    const st = d.at(lamOf(x));
    return { M: st.M, p: st.p / d.vn.p, T: st.T / Tmax };
  };
  const vEnd = d.at(1).v;
  const pmax = d.vn.p * 1.12;
  return (
    <SimFrame title="Detonation = normal shock + Rayleigh heating to M = 1" subtitle="Chapman–Jouguet / ZND picture in the wave frame">
      <div className="controls">
        <Slider label="Heat release Δq" value={q} min={500} max={8000} step={50} onChange={setQ} unit=" kJ/kg" format={(v) => v.toFixed(0)} />
        <Slider label="Wave Mach M₁ / M_CJ" value={ratio} min={0.85} max={1.4} step={0.005} onChange={setRatio} format={(v) => v.toFixed(3)} />
      </div>
      <div style={btnRow}>
        <button className="btn" onClick={() => setRatio(1)}>
          snap to CJ
        </button>
        <button
          className="btn"
          onClick={() => {
            setQ(4000);
            setRatio(1);
          }}
        >
          Final A P1 (4000 kJ/kg)
        </button>
      </div>
      <div className="regime" style={d.choked ? { background: 'var(--warn-soft)', color: 'var(--warn)' } : undefined}>
        {d.choked
          ? `M₁ = ${fmt(M1, 3)} < M_CJ: the Rayleigh line misses the burned Hugoniot. Only part of Δq can be added before M = 1 (thermal choking), so a steady wave this slow is impossible — it would be overtaken by its own pressure waves and settle at CJ.`
          : ratio > 1.001
            ? `Overdriven (M₁ > M_CJ): the burned gas leaves subsonic (M = ${fmt(d.end.M, 3)}). Needs a piston behind it to be sustained.`
            : `Chapman–Jouguet: M₁ = ${fmt(Mcj, 4)}; the burned gas leaves at exactly M = 1. Self-sustaining detonation speed.`}
      </div>
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={2}
        pipeStart={0.05}
        profile={() => 0.2}
        field={field}
        colorBy="T"
        shocks={[xs]}
        heatZone={[xs + 0.05, xe]}
        plume={{ kind: 'none' }}
        flowSpeed={0.5}
        labels={[
          { x: 0.2, text: `unburned · M₁ = ${fmt(M1, 3)} · T₁ = ${T1} K` },
          { x: xs, text: `shock → M ${fmt(d.vn.M, 3)}, T ${fmt(d.vn.T * T1, 4)} K`, side: 'bottom' },
          { x: (xs + xe) / 2 + 0.15, text: 'heat release (Rayleigh)' },
          { x: 1.85, text: d.choked ? 'chokes before all heat is released' : `${ratio > 1.001 ? 'end' : 'CJ plane'} · M ${fmt(d.end.M, 3)}`, side: 'bottom' },
        ]}
        height={240}
      />
      <div className="twocol">
        <Plot
          x={[0.1, 1.15]}
          y={[0, pmax]}
          height={270}
          xLabel="v / v₁"
          yLabel="p / p₁"
          series={[
            { points: sample((v) => hugoniotP(v, 0, g), 0.19, 1.15), color: 'var(--c1)', label: 'shock Hugoniot (no heat)' },
            { points: sample((v) => hugoniotP(v, Q, g), 0.19, 1.15), color: 'var(--c2)', label: 'burned Hugoniot (Δq)' },
            { points: sample((v) => rayleighLineP(v, M1, g), 0.1, 1.05), color: 'var(--c3)', dash: true, label: `Rayleigh line, M₁ = ${fmt(M1, 3)}` },
            { points: Array.from({ length: 41 }, (_, i) => d.at(i / 40)).map((st) => ({ x: st.v, y: st.p })), color: 'var(--c4)', width: 4, label: 'path through the wave' },
          ]}
          dots={[
            { x: 1, y: 1, label: '1', color: 'var(--c1)' },
            { x: d.vn.T / d.vn.p, y: d.vn.p, label: 'vN spike', color: 'var(--c2)' },
            { x: vEnd, y: d.at(1).p, label: d.choked ? 'choke' : ratio > 1.001 ? 'end' : 'CJ', color: 'var(--c4)' },
          ]}
        />
        <Plot
          x={[0, 1]}
          y={[0, Math.max(d.vn.p, Tmax) * 1.05]}
          height={270}
          xLabel="fraction of Δq released (ZND reaction zone →)"
          yLabel="ratio to unburned state"
          series={[
            { points: sample((l) => d.at(l).p, 0, 1, 80), color: 'var(--c1)', label: 'p / p₁' },
            { points: sample((l) => d.at(l).T, 0, 1, 80), color: 'var(--c2)', label: 'T / T₁' },
            { points: sample((l) => 10 * d.at(l).M, 0, 1, 80), color: 'var(--c3)', dash: true, label: '10 × M' },
          ]}
          hlines={[{ y: 10, label: 'M = 1' }]}
        />
      </div>
      <Readout
        items={[
          ['Q = Δq/(c_p T₁)', fmt(Q, 4)],
          ['M_CJ', fmt(Mcj, 4)],
          ['T₀₁ / T₀*', fmt(T0_T0star(M1, g), 4)],
          ['T₀₁ → T₀*', `${fmt(T1 * T0_T(M1, g))} → ${fmt(T1 * d.T0star_T1)} K`],
          ['vN: p, T', `${fmt(d.vn.p, 3)} p₁, ${fmt(d.vn.T * T1, 4)} K`],
          ['end: p, T', `${fmt(d.at(1).p, 3)} p₁, ${fmt(d.at(1).T * T1, 4)} K`],
        ]}
      />
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
        The shock jumps from 1 to the von Neumann spike along the Rayleigh line (same ṁ/A and p + ρV²) onto the no-heat Hugoniot; heat release then
        slides the state back down the <em>same</em> straight line until it touches the burned Hugoniot. At CJ the line is tangent: that tangency is the
        M = 1 (thermal choking) condition. Colour in the tube = static temperature.
      </p>
    </SimFrame>
  );
}

/* =====================================================================
   MERLIN / RAPTOR — design, over-expanded (sea level), under-expanded (vacuum)
   ===================================================================== */
export function RaptorNozzleSim() {
  const g = 1.4;
  const R = 8314 / 17;
  const T0 = 3500;
  const [engine, setEngine] = useState<'merlin' | 'raptor'>('raptor');
  const [amb, setAmb] = useState<'design' | 'sea' | 'vac'>('design');
  const p0 = engine === 'merlin' ? 10e6 : 30e6;
  const { Me, AR } = optimumAreaRatio(p0, 70e3, g);
  const pe = 70e3;
  const pa = amb === 'design' ? 70e3 : amb === 'sea' ? 100e3 : 0;
  const Ve = exitVelocity(pe / p0, T0, R, g);
  const Te = T0 * T_T0(Me, g);
  const rhoe = pe / (R * Te);
  const Fm = Ve + (pe - pa) / (rhoe * Ve);
  const sig = sigmaFromPressureRatio(Me, 100 / 70, g);
  const del = deltaFromSigma(Me, sig, g);
  const turn = nuMax(g) - nu(Me, g);
  const field = (x: number): FieldPoint => {
    const A = nozzleArea(x, AR);
    const M = M_from_A_Astar(Math.max(1, A), x < 0.35 ? 'sub' : 'sup', g);
    return { M, p: p_p0(M, g), T: T_T0(M, g) };
  };
  return (
    <SimFrame title="Merlin vs Raptor: one nozzle, three ambients" subtitle="Final A P2: designed for 70 kPa (3 km)">
      <div style={btnRow}>
        <button className={`btn ${engine === 'merlin' ? 'primary' : ''}`} onClick={() => setEngine('merlin')}>
          Merlin p₀ = 10 MPa
        </button>
        <button className={`btn ${engine === 'raptor' ? 'primary' : ''}`} onClick={() => setEngine('raptor')}>
          Raptor p₀ = 30 MPa
        </button>
        <span style={{ width: 12 }} />
        <button className={`btn ${amb === 'design' ? 'primary' : ''}`} onClick={() => setAmb('design')}>
          (a,b) 3 km, 70 kPa
        </button>
        <button className={`btn ${amb === 'sea' ? 'primary' : ''}`} onClick={() => setAmb('sea')}>
          (c) sea level, 100 kPa
        </button>
        <button className={`btn ${amb === 'vac' ? 'primary' : ''}`} onClick={() => setAmb('vac')}>
          (d) vacuum
        </button>
      </div>
      <FlowSection3D
        wall="engine"
        x0={0}
        x1={1}
        profile={(x) => 0.05 * Math.sqrt(nozzleArea(x, AR))}
        field={field}
        plume={{ kind: amb === 'design' ? 'ideal' : amb === 'sea' ? 'over' : 'under', strength: amb === 'vac' ? 1.6 : 1 }}
        labels={[
          { x: 0.35, text: 'throat · M = 1' },
          { x: 1, text: `exit M ${fmt(Me, 4)} · A/A* ${fmt(AR, 4)}`, side: 'bottom' },
          { x: 0.97, text: amb === 'design' ? 'p_e = p_amb' : amb === 'sea' ? `lip shock σ ${fmt(sig, 3)}°, δ ${fmt(del, 3)}° inward` : `lip fan: ${fmt(turn, 3)}° outward` },
        ]}
        height={280}
      />
      <Readout
        items={[
          ['M_e', fmt(Me, 5)],
          ['A_e/A_t', fmt(AR, 5)],
          ['V_e = Isp (design)', `${fmt(Ve, 5)} m/s`],
          ['F/ṁ at this ambient', `${fmt(Fm, 5)} m/s`],
          ['sea level: σ, δ', `${fmt(sig, 4)}°, ${fmt(del, 3)}°`],
          ['vacuum: ν_max − ν(M_e)', `${fmt(nuMax(g), 5)} − ${fmt(nu(Me, g), 4)} = ${fmt(turn, 4)}°`],
        ]}
      />
    </SimFrame>
  );
}

/* =====================================================================
   CAPILLARY TUBE TO VACUUM — Fanno choking (Final B P2)
   ===================================================================== */
export function VacuumTubeSim() {
  const g = 1.4;
  const R = 8314 / 28.9;
  const [L, setL] = useState(10);
  const D = 1e-3;
  const f = 0.005;
  const fL = (4 * f * L) / D;
  const Min = M_from_fLmax(fL, 'sub', g);
  const mdot = ((Math.PI * D * D) / 4) * massFlux(Min, 1e6, 300, R, g);
  const xp = 0.35;
  const field = (x: number): FieldPoint => {
    if (x < xp) {
      // smooth bell-mouth from the tank (A/A_pipe from 30 → 1)
      const Ar = 1 + 29 * Math.pow(1 - x / xp, 2);
      const M = M_from_A_Astar(Ar * A_Astar(Min, g), 'sub', g);
      return { M, p: p_p0(M, g), T: T_T0(M, g) };
    }
    const rem = fL * (1 - (x - xp) / (2 - xp));
    const M = rem <= 1e-9 ? 1 : M_from_fLmax(rem, 'sub', g);
    return { M, p: p_p0(Min, g) * (fan_p_pstar(M, g) / fan_p_pstar(Min, g)), T: T_T0(Min, g) * (fan_T_Tstar(M, g) / fan_T_Tstar(Min, g)) };
  };
  return (
    <SimFrame title="Tank → 1 mm tube → vacuum" subtitle="always choked: the tube is exactly one L*">
      <div className="controls">
        <Slider label="Tube length L" value={L} min={0.5} max={15} step={0.01} onChange={setL} unit=" m" format={(v) => v.toFixed(2)} />
      </div>
      <div style={btnRow}>
        <button className="btn" onClick={() => setL(10)}>
          (a) L = 10 m
        </button>
        <button className="btn" onClick={() => setL(2.2704)}>
          (b) L = 2.27 m
        </button>
      </div>
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={2}
        pipeStart={xp}
        profile={(x) => (x < xp ? 0.07 * Math.sqrt(1 + 29 * Math.pow(1 - x / xp, 2)) : 0.07)}
        field={field}
        frictionZone={[xp, 2]}
        plume={{ kind: 'under', strength: 1 }}
        labels={[
          { x: 0.05, text: 'tank 1000 kPa, 300 K' },
          { x: xp + 0.05, text: `M_in ${fmt(Min, 3)}`, side: 'bottom' },
          { x: 1.95, text: 'exit M = 1 → vacuum' },
        ]}
        height={220}
      />
      <Readout
        items={[
          ['4fL/D (= 4fL*/D)', fmt(fL, 4)],
          ['M_in (exact)', fmt(Min, 4)],
          ['ṁ', `${fmt(mdot * 1e3, 4)} g/s`],
          ['p* at exit', `${fmt((1e6 * p_p0(Min, g)) / fan_p_pstar(Min, g) / 1e3, 3)} kPa`],
          ['check 4fL*/D(M_in)', fmt(fLmax(Min, g), 4)],
        ]}
      />
    </SimFrame>
  );
}
