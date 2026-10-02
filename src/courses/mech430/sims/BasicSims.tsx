import { useMemo, useState } from 'react';
import { Plot, sample } from '../../../core/Plot';
import { Readout, SimFrame, Slider, Tex } from '../../../core/ui';
import * as ise from '../lib/isentropic';
import * as ns from '../lib/normalShock';
import { fmt, machColor } from './common';

/* ======================= Area–Mach explorer ======================= */
export function AreaMachSim() {
  const [ratio, setRatio] = useState(2);
  const [g, setG] = useState(1.4);
  const Msub = ise.M_from_A_Astar(ratio, 'sub', g);
  const Msup = ise.M_from_A_Astar(ratio, 'sup', g);
  const curve = useMemo(() => sample((M) => ise.A_Astar(M, g), 0.08, 4, 300), [g]);
  return (
    <SimFrame title="Area–Mach relation" subtitle="one area ratio → two possible Mach numbers">
      <div className="controls">
        <Slider label="A / A*" value={ratio} min={1} max={6} step={0.01} onChange={setRatio} />
        <Slider label="γ" value={g} min={1.1} max={1.67} step={0.01} onChange={setG} />
      </div>
      <Plot
        x={[0, 4]}
        y={[0, 6]}
        height={300}
        xLabel="Mach number M"
        yLabel="A / A*"
        series={[{ points: curve, width: 3, label: 'A/A* (M)' }]}
        hlines={[{ y: ratio, color: 'var(--c2)', label: `A/A* = ${ratio.toFixed(2)}` }]}
        vlines={[{ x: 1, label: 'M = 1: minimum area' }]}
        dots={[
          { x: Msub, y: ratio, color: machColor(Msub), label: `subsonic M = ${fmt(Msub, 3)}` },
          { x: Msup, y: ratio, color: machColor(Msup), label: `supersonic M = ${fmt(Msup, 3)}` },
        ]}
      />
      <Readout
        items={[
          ['subsonic p/p₀', fmt(ise.p_p0(Msub, g))],
          ['supersonic p/p₀', fmt(ise.p_p0(Msup, g))],
          ['subsonic T/T₀', fmt(ise.T_T0(Msub, g))],
          ['supersonic T/T₀', fmt(ise.T_T0(Msup, g))],
        ]}
      />
    </SimFrame>
  );
}

/* ======================= Mass flux vs Mach ======================= */
export function MassFluxSim() {
  const [g, setG] = useState(1.4);
  const f = (M: number) => ise.massFlux(M, 1, 1, 1, g) / ise.massFlux(1, 1, 1, 1, g);
  return (
    <SimFrame title="Why flow chokes" subtitle="mass flux per unit area peaks at M = 1">
      <div className="controls">
        <Slider label="γ" value={g} min={1.1} max={1.67} step={0.01} onChange={setG} />
      </div>
      <Plot
        x={[0, 4]}
        y={[0, 1.1]}
        height={260}
        xLabel="Mach number M"
        yLabel="(ṁ/A) / (ṁ/A*)"
        series={[{ points: sample(f, 0.001, 4, 300), width: 3 }]}
        dots={[{ x: 1, y: 1, label: 'maximum: the throat can pass no more', color: 'var(--c2)' }]}
      />
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
        Every area other than the throat can carry the same ṁ at <em>two</em> Mach numbers (the curve is crossed twice). Only
        the throat — the smallest area — sets the ceiling. Once <Tex>{'M_t = 1'}</Tex>, lowering the back pressure cannot
        pull any more mass through.
      </p>
    </SimFrame>
  );
}

/* ======================= Normal-shock explorer ======================= */
export function NormalShockSim() {
  const [Mx, setMx] = useState(2);
  const [g, setG] = useState(1.4);
  const s = ns.normalShock(Mx, g);
  const W = 640;
  const H = 120;
  return (
    <SimFrame title="Normal shock" subtitle="supersonic in, subsonic out, stagnation pressure lost">
      <div className="controls">
        <Slider label="Upstream Mach Mₓ" value={Mx} min={1} max={5} step={0.01} onChange={setMx} />
        <Slider label="γ" value={g} min={1.1} max={1.67} step={0.01} onChange={setG} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <rect x={0} y={20} width={W / 2} height={80} fill={machColor(Mx)} />
        <rect x={W / 2} y={20} width={W / 2} height={80} fill={machColor(s.My)} />
        <line x1={W / 2} x2={W / 2} y1={14} y2={106} stroke="var(--text)" strokeWidth={4} />
        {[0, 1, 2].map((k) => (
          <g key={k}>
            <line x1={40} x2={40 + 60 * Math.min(Mx, 4)} y1={40 + k * 20} y2={40 + k * 20} stroke="white" strokeWidth={2} markerEnd="url(#arr)" />
            <line x1={W / 2 + 30} x2={W / 2 + 30 + 60 * s.My} y1={40 + k * 20} y2={40 + k * 20} stroke="white" strokeWidth={2} markerEnd="url(#arr)" />
          </g>
        ))}
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="white" />
          </marker>
        </defs>
        <text x={10} y={14} style={{ fontSize: 12, fill: 'var(--text)' }}>x: Mₓ = {fmt(Mx, 3)}</text>
        <text x={W / 2 + 10} y={14} style={{ fontSize: 12, fill: 'var(--text)' }}>y: M_y = {fmt(s.My, 3)}</text>
      </svg>
      <Readout
        items={[
          ['M_y', fmt(s.My)],
          ['p_y / p_x', fmt(s.py_px)],
          ['ρ_y / ρ_x = V_x/V_y', fmt(s.rhoy_rhox)],
          ['T_y / T_x', fmt(s.Ty_Tx)],
          ['p₀y / p₀x = A*x/A*y', fmt(s.p0y_p0x)],
          ['Δs / R', fmt(ns.deltaS_R(Mx, g))],
        ]}
      />
      <div className="twocol">
        <Plot
          x={[1, 5]}
          y={[0, 1]}
          height={220}
          xLabel="Mₓ"
          yLabel="ratio"
          series={[
            { points: sample((m) => ns.My(m, g), 1, 5), label: 'M_y' },
            { points: sample((m) => ns.p0y_p0x(m, g), 1, 5), label: 'p₀y/p₀x' },
          ]}
          vlines={[{ x: Mx, color: 'var(--c2)' }]}
          hlines={[{ y: Math.sqrt((g - 1) / (2 * g)), label: 'M_y → √((γ−1)/2γ)' }]}
        />
        <Plot
          x={[1, 5]}
          y={[0, 30]}
          height={220}
          xLabel="Mₓ"
          yLabel="ratio"
          series={[
            { points: sample((m) => ns.py_px(m, g), 1, 5), label: 'p_y/p_x' },
            { points: sample((m) => ns.rhoy_rhox(m, g), 1, 5), label: 'ρ_y/ρ_x' },
            { points: sample((m) => ns.Ty_Tx(m, g), 1, 5), label: 'T_y/T_x' },
          ]}
          vlines={[{ x: Mx, color: 'var(--c2)' }]}
          hlines={[{ y: (g + 1) / (g - 1), label: 'ρ ratio → (γ+1)/(γ−1)' }]}
        />
      </div>
    </SimFrame>
  );
}

/* ======================= Influence table ======================= */
type Driver = 'converging' | 'diverging' | 'friction' | 'heating' | 'cooling';
const DRIVERS: { k: Driver; label: string }[] = [
  { k: 'converging', label: 'Area ↓ (converging)' },
  { k: 'diverging', label: 'Area ↑ (diverging)' },
  { k: 'friction', label: 'Friction (Fanno)' },
  { k: 'heating', label: 'Heating (Rayleigh)' },
  { k: 'cooling', label: 'Cooling (Rayleigh)' },
];
/** Sign of d(property) for each driver, subsonic / supersonic. +1 up, −1 down, 0 constant, 2 = depends (T for heating 1/√γ<M<1). */
function signs(d: Driver, sup: boolean, M: number, g: number) {
  const s = sup ? -1 : 1; // many signs flip with (1 − M²)
  switch (d) {
    case 'converging':
      return { M: s, V: s, p: -s, rho: -s, T: -s, p0: 0, T0: 0, s: 0 };
    case 'diverging':
      return { M: -s, V: -s, p: s, rho: s, T: s, p0: 0, T0: 0, s: 0 };
    case 'friction':
      return { M: s, V: s, p: -s, rho: -s, T: -s, p0: -1, T0: 0, s: 1 };
    case 'heating': {
      const T = sup ? 1 : M < 1 / Math.sqrt(g) ? 1 : -1;
      return { M: s, V: s, p: -s, rho: -s, T, p0: -1, T0: 1, s: 1 };
    }
    case 'cooling': {
      const T = sup ? -1 : M < 1 / Math.sqrt(g) ? -1 : 1;
      return { M: -s, V: -s, p: s, rho: s, T, p0: 1, T0: -1, s: -1 };
    }
  }
}
export function InfluenceTable() {
  const [M, setM] = useState(0.5);
  const g = 1.4;
  const sup = M > 1;
  const cell = (v: number) => (
    <td className={v > 0 ? 'up' : v < 0 ? 'down' : 'zero'}>{v > 0 ? '▲' : v < 0 ? '▼' : '—'}</td>
  );
  return (
    <SimFrame title="What does each 'driver' do to the flow?" subtitle="the one table that summarises Ch. 5, 10 and 11">
      <div className="controls">
        <Slider label="Mach number of the incoming flow" value={M} min={0.05} max={3} step={0.01} onChange={setM} />
      </div>
      <div className="regime" style={{ background: sup ? 'var(--warn-soft)' : 'var(--accent-soft)', color: sup ? 'var(--warn)' : 'var(--accent)' }}>
        {sup ? 'Supersonic: everything flips (1 − M² < 0)' : M > 1 / Math.sqrt(g) ? `Subsonic, and above 1/√γ = 0.845 — heating now COOLS the gas` : 'Subsonic'}
      </div>
      <table className="signs" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Driver</th>
            <th>M</th>
            <th>V</th>
            <th>p</th>
            <th>ρ</th>
            <th>T</th>
            <th>p₀</th>
            <th>T₀</th>
            <th>s</th>
          </tr>
        </thead>
        <tbody>
          {DRIVERS.map(({ k, label }) => {
            const r = signs(k, sup, M, g);
            return (
              <tr key={k}>
                <td style={{ textAlign: 'left', fontWeight: 500 }}>{label}</td>
                {cell(r.M)}
                {cell(r.V)}
                {cell(r.p)}
                {cell(r.rho)}
                {cell(r.T)}
                {cell(r.p0)}
                {cell(r.T0)}
                {cell(r.s)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
        Pattern to remember: <b>friction and heating both push M toward 1</b> (like a converging duct) — from either side.
        They also both destroy stagnation pressure. You can never cross M = 1 with a single driver; the flow chokes instead.
      </p>
    </SimFrame>
  );
}
