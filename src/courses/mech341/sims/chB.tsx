/**
 * MECH 341 sims for chapters 13-17 (mixtures, psychrometrics, combustion, equilibrium, compressible flow).
 * Every number comes from the tested lib (mixtures.ts, psychro.ts, combustion.ts, equilibrium.ts, compressible.ts, realgas.ts, gas.ts).
 */
import { useMemo, useState } from 'react';
import { Plot, Series } from '../../../core/Plot';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import { range, Sel } from '../viz/Kit';
import { water, solve } from '../lib/props';
import { mixtureFromMoles, mixtureFromMass } from '../lib/mixtures';
import { leeKesler, kay, CRIT } from '../lib/realgas';
import { omega, phiOf, psyState, mixStreams, omegaFromWetBulb, Pg } from '../lib/psychro';
import { burn, dewPoint, steadyQ, aft } from '../lib/combustion';
import { SPECIES, heatingValues, A28, lnKp, hR, hbar, s0, Ru } from '../lib/gas';
import { equilibrium } from '../lib/equilibrium';
import { T0_T, P0_P, rho0_rho, areaRatio, machFromAreaRatio, soundSpeed, critical } from '../lib/compressible';

const pct = (v: number) => (Number.isFinite(v) ? `${(100 * v).toFixed(1)} %` : '—');
const num = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (s: string) => s.replace(/\d/g, (c) => SUBS[Number(c)]);

function Check({ label, checked, onChange, color }: { label: string; checked: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem', margin: '4px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {color && <span style={{ width: 14, height: 4, background: color, display: 'inline-block', borderRadius: 2 }} />}
      {label}
    </label>
  );
}

/* ====================================================================== chapter 13 */

/** Scuba nitrox: maximum operating depth from the oxygen partial-pressure limit (Dalton). */
export function NitroxDepthSim() {
  const [fO2, setFO2] = useState(0.32);
  const [lim, setLim] = useState(1.4);
  const Pmax = lim / fO2; // bar absolute
  const mod = Math.max(0, (Pmax - 1) * 10);
  const end = Math.max(0, (((1 - fO2) * Pmax) / 0.79 - 1) * 10); // equivalent air depth for N2 narcosis
  const mix = mixtureFromMoles({ O2: fO2, N2: 1 - fO2 });
  const curve = range(0.21, 1, 80).map((x) => ({ x: 100 * x, y: Math.max(0, (lim / x - 1) * 10) }));
  return (
    <SimFrame title="Nitrox: how deep can I go?" subtitle="Dalton's law: ppO₂ = y_O₂ · P_total, capped at a safe limit; every 10 m of seawater adds ≈ 1 bar">
      <div className="controls">
        <Slider label="oxygen fraction y_O₂" value={fO2} min={0.21} max={1} step={0.01} onChange={setFO2} format={(v) => `${(100 * v).toFixed(0)} %`} />
        <Slider label="ppO₂ limit" value={lim} min={1.2} max={1.6} step={0.05} onChange={setLim} unit=" bar" format={(v) => v.toFixed(2)} />
      </div>
      <Plot
        x={[21, 100]}
        y={[0, 70]}
        height={250}
        xLabel="O₂ in the tank (% by mole)"
        yLabel="max operating depth (m)"
        series={[{ points: curve, color: 'var(--c1)', width: 2.4 }]}
        dots={[{ x: 100 * fO2, y: mod, color: 'var(--c2)', label: `${num(mod, 0)} m` }]}
        legend={false}
      />
      <Readout
        items={[
          ['max total pressure P = ppO₂ / y_O₂', `${num(Pmax, 2)} bar absolute`],
          ['max operating depth (P − 1) × 10 m/bar', `${num(mod, 1)} m`],
          ['ppN₂ at that depth', `${num((1 - fO2) * Pmax, 2)} bar`],
          ['equivalent air depth (same ppN₂)', `${num(end, 0)} m`],
          ['mixture M, R', `${num(mix.M, 2)} kg/kmol, ${mix.R.toFixed(4)} kJ/kg·K`],
          ['mixture k = c_p/c_v', mix.k.toFixed(3)],
        ]}
      />
      <p className="srcnote">EAN32 (32 % O₂) with a 1.4 bar limit gives P = 4.375 bar, i.e. about 34 m. Air (21 %) would allow 57 m on oxygen alone; nitrogen narcosis is the reason air is not used that deep. Depth conversion ≈ 10 m per bar (seawater).</p>
    </SimFrame>
  );
}

const MIX_SPECIES = ['N2', 'O2', 'CO2', 'CH4', 'H2', 'He', 'Ar', 'CO'] as const;
const MIX_PRESETS: Record<string, { label: string; amt: Record<string, number> }> = {
  air: { label: 'Air-like: 0.79 N₂, 0.21 O₂', amt: { N2: 0.79, O2: 0.21 } },
  nitrox: { label: 'Nitrox EAN32: 0.68 N₂, 0.32 O₂', amt: { N2: 0.68, O2: 0.32 } },
  review: { label: 'Class example: 0.05 H₂, 0.015 O₂, 0.015 CO (kmol)', amt: { H2: 0.05, O2: 0.015, CO: 0.015 } },
  he_ar: { label: 'Equimolar He–Ar (13-62)', amt: { He: 0.5, Ar: 0.5 } },
  ng: { label: 'Natural gas (typical): 0.94 CH₄, 0.03 N₂, 0.03 CO₂', amt: { CH4: 0.94, N2: 0.03, CO2: 0.03 } },
  kay: { label: 'Kay example: 2 N₂ + 6 CO₂', amt: { N2: 0.25, CO2: 0.75 } },
};

/** Mixture property calculator: moles or masses in; M, R, c_p, c_v, k, partial pressures and Amagat volumes out. */
export function MixtureSim() {
  const [amt, setAmt] = useState<Record<string, number>>({ N2: 0.79, O2: 0.21 });
  const [basis, setBasis] = useState<'mole' | 'mass'>('mole');
  const [P, setP] = useState(300);
  const [T, setT] = useState(300);
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(amt)) if (v > 0) clean[k] = v;
  const total = Object.values(clean).reduce((a, b) => a + b, 0);
  const mix = total > 0 ? (basis === 'mole' ? mixtureFromMoles(clean) : mixtureFromMass(clean)) : null;
  const colors = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--muted)', 'var(--border)', 'var(--accent)'];
  const bar = (title: string, frac: Record<string, number>) => {
    let x = 0;
    return (
      <g>
        <text x={0} y={-6} style={{ fill: 'var(--text)', fontSize: 12.5, fontWeight: 600 }}>
          {title}
        </text>
        {MIX_SPECIES.map((s, i) => {
          const w = (frac[s] ?? 0) * 660;
          const r =
            w > 0 ? (
              <g key={s}>
                <rect x={x} y={0} width={w} height={26} fill={colors[i]} opacity={0.85} stroke="var(--surface)" />
                {w > 52 && (
                  <text x={x + w / 2} y={17} textAnchor="middle" style={{ fill: '#fff', fontSize: 11, fontWeight: 700 }}>
                    {sub(s)} {(100 * (frac[s] ?? 0)).toFixed(1)}%
                  </text>
                )}
              </g>
            ) : null;
          x += w;
          return r;
        })}
      </g>
    );
  };
  const Vm = (Ru * T) / P; // m3 per kmol of mixture
  return (
    <SimFrame title="Mixture property calculator" subtitle="Gibbs–Dalton: M = Σ yᵢMᵢ, c_p = Σ mfᵢ c_pᵢ, pᵢ = yᵢ P, Vᵢ = yᵢ V (ideal gases)">
      <div className="controls">
        <Sel
          label="load an example"
          value="air"
          options={Object.entries(MIX_PRESETS).map(([v, p]) => ({ v, t: p.label }))}
          onChange={(v) => {
            setAmt(MIX_PRESETS[v].amt);
            setBasis('mole');
          }}
        />
        <Sel label="amounts are given as" value={basis} options={[{ v: 'mole', t: 'moles' }, { v: 'mass', t: 'masses' }]} onChange={setBasis} />
        {MIX_SPECIES.map((s) => (
          <Slider key={s} label={`${sub(s)} (${basis === 'mole' ? 'kmol' : 'kg'})`} value={amt[s] ?? 0} min={0} max={basis === 'mole' ? 1 : 10} step={basis === 'mole' ? 0.005 : 0.05} onChange={(v) => setAmt({ ...amt, [s]: v })} format={(v) => v.toFixed(basis === 'mole' ? 3 : 2)} />
        ))}
        <Slider label="mixture pressure P" value={P} min={50} max={2000} step={10} onChange={setP} unit=" kPa" format={(v) => v.toFixed(0)} />
        <Slider label="temperature T" value={T} min={200} max={900} step={5} onChange={setT} unit=" K" format={(v) => v.toFixed(0)} />
      </div>
      {mix && (
        <>
          <svg viewBox="0 0 700 120" style={{ width: '100%', height: 'auto' }} role="img" aria-label="mole fractions and mass fractions">
            <g transform="translate(10,22)">{bar('mole fraction yᵢ = pressure share (Dalton) = volume share (Amagat)', mix.y)}</g>
            <g transform="translate(10,82)">{bar('mass fraction mfᵢ (a different set: heavy molecules weigh more)', mix.mf)}</g>
          </svg>
          <Readout
            items={[
              ['M mixture', `${num(mix.M, 3)} kg/kmol`],
              ['R = Ru / M', `${mix.R.toFixed(4)} kJ/kg·K`],
              ['c_p, c_v (mass-weighted)', `${mix.cp.toFixed(4)}, ${mix.cv.toFixed(4)} kJ/kg·K`],
              ['k = c_p / c_v', mix.k.toFixed(4)],
              ['v = R T / P', `${((mix.R * T) / P).toFixed(4)} m³/kg`],
              ['volume per kmol Ru T / P', `${num(Vm, 3)} m³/kmol`],
              ...Object.entries(mix.y).map(([s, y]) => [`${sub(s)}: y, pᵢ, Vᵢ`, `${y.toFixed(4)}, ${num(y * P, 1)} kPa, ${num(y * Vm, 3)} m³/kmol`] as [string, string]),
            ]}
          />
        </>
      )}
      <p className="srcnote">For ideal gases Dalton (add pressures at the same V, T) and Amagat (add volumes at the same P, T) give the same answer, which is why yᵢ is simultaneously the mole, pressure and volume fraction. Mass fractions are a different set of numbers: convert with mfᵢ = yᵢ Mᵢ / M.</p>
    </SimFrame>
  );
}

/** Kay's rule: pseudo-critical constants and the compressibility factor of a two-gas real mixture. */
export function KaySim() {
  const keys = ['N2', 'CO2', 'CH4', 'O2', 'H2', 'He', 'Ar', 'C3H8'];
  const [A, setA] = useState('N2');
  const [B, setB] = useState('CO2');
  const [yA, setYA] = useState(0.25);
  const [T, setT] = useState(300);
  const [P, setP] = useState(15);
  const y: Record<string, number> = B === A ? { [A]: 1 } : { [A]: yA, [B]: 1 - yA };
  const k = kay(y);
  const Zm = (p: number) => leeKesler(T / k.Tcr, p / k.Pcr).Z;
  const Mm = Object.entries(y).reduce((a, [s, v]) => a + v * CRIT[s].M, 0);
  const z = Zm(P);
  const Vid = (Ru * T) / (P * 1000);
  return (
    <SimFrame title="Kay's rule: is the mixture still ideal?" subtitle="T′cr = Σ yᵢ Tcr,ᵢ, P′cr = Σ yᵢ Pcr,ᵢ; Z from the Lee–Kesler generalized chart (lib leeKesler())">
      <div className="controls">
        <Sel label="gas A" value={A} options={keys.map((v) => ({ v, t: sub(v) }))} onChange={setA} />
        <Sel label="gas B" value={B} options={keys.map((v) => ({ v, t: sub(v) }))} onChange={setB} />
        <Slider label={`mole fraction of ${sub(A)}`} value={yA} min={0} max={1} step={0.01} onChange={setYA} />
        <Slider label="temperature T" value={T} min={150} max={700} step={5} onChange={setT} unit=" K" format={(v) => v.toFixed(0)} />
        <Slider label="pressure P" value={P} min={0.1} max={40} step={0.1} onChange={setP} unit=" MPa" />
      </div>
      <Plot
        x={[0.1, 40]}
        y={[0, 1.3]}
        height={250}
        xLabel="P (MPa)"
        yLabel="Z of the mixture"
        series={[{ points: range(0.1, 40, 120).map((p) => ({ x: p, y: Zm(p) })), color: 'var(--c1)', width: 2.4 }]}
        hlines={[{ y: 1, color: 'var(--muted)', dash: true, label: 'ideal gas' }]}
        dots={[{ x: P, y: z, color: 'var(--c2)', label: `Z = ${z.toFixed(3)}` }]}
        legend={false}
      />
      <Readout
        items={[
          ['T′cr, P′cr (Kay)', `${num(k.Tcr, 1)} K, ${k.Pcr.toFixed(3)} MPa`],
          ['T_R = T / T′cr', (T / k.Tcr).toFixed(3)],
          ['P_R = P / P′cr', (P / k.Pcr).toFixed(3)],
          ['Z (generalized chart)', z.toFixed(3)],
          ['volume of 1 kmol: real, ideal', `${(z * Vid).toFixed(4)}, ${Vid.toFixed(4)} m³`],
          ['M mixture', `${num(Mm, 2)} kg/kmol`],
        ]}
      />
      <p className="srcnote">Kay's rule is good to roughly 10 % over wide ranges. The lib's Z is the simple-fluid correlation, so it differs from a chart reading by a few percent (his chart read Z = 0.49 for the 2 N₂ + 6 CO₂ tank at 300 K, 15 MPa; this gives about 0.47).</p>
    </SimFrame>
  );
}

/* ====================================================================== chapter 14 */

const PSY_TMAX = 50;
/** φ = 10…100 % curves of a psychrometric chart at pressure P */
function psyCurves(P: number): Series[] {
  const Ts = range(0, PSY_TMAX, 50);
  const out: Series[] = [];
  for (let phi = 10; phi <= 100; phi += 10) out.push({ points: Ts.map((T) => ({ x: T, y: omega(T, phi / 100, P) })), color: phi === 100 ? 'var(--c1)' : 'var(--muted)', width: phi === 100 ? 2.4 : 1 });
  return out;
}

type PsyMode = 'heat' | 'cool' | 'steam' | 'evap' | 'mix';
/** Psychrometric chart with one process: sensible heating, cooling and dehumidification, steam humidification, evaporative cooling, adiabatic mixing. */
export function PsychroProcessSim() {
  const P = 101.325;
  const [mode, setMode] = useState<PsyMode>('cool');
  const [T1, setT1] = useState(30);
  const [phi1, setPhi1] = useState(0.7);
  const [T2, setT2] = useState(12);
  const [phi2, setPhi2] = useState(0.9);
  const [TB, setTB] = useState(14);
  const [phiB, setPhiB] = useState(1);
  const [xB, setXB] = useState(0.4);
  const s1 = psyState({ T: T1, P, phi: phi1 });
  const sB = psyState({ T: TB, P, phi: phiB });
  const r = useMemo(() => {
    let pts: { x: number; y: number }[] = [{ x: s1.T, y: s1.w }];
    let s2 = s1;
    let note = '';
    let q = NaN;
    let dw = 0;
    if (mode === 'heat') {
      s2 = psyState({ T: T2, P, w: s1.w });
      pts.push({ x: T2, y: s1.w });
      q = s2.h - s1.h;
      note = 'ω constant: a horizontal line. φ drops as T rises.';
    } else if (mode === 'cool') {
      const wsat2 = omega(T2, 1, P);
      const saturated = s1.w >= wsat2;
      const w2 = saturated ? wsat2 : s1.w;
      s2 = psyState({ T: T2, P, w: w2 });
      if (saturated && T2 < s1.Tdp) {
        pts.push({ x: s1.Tdp, y: s1.w });
        for (const T of range(s1.Tdp, T2, 12)) pts.push({ x: T, y: omega(T, 1, P) });
      } else pts.push({ x: T2, y: s1.w });
      dw = w2 - s1.w;
      q = s2.h - s1.h + (s1.w - w2) * water.satT(Math.max(T2, 0.01)).hf;
      note = saturated ? `Below the dew point (${num(s1.Tdp, 1)} °C) vapour condenses and the state follows the saturation curve down to the coil exit temperature.` : 'T₂ is above the dew point, so this is sensible cooling only: no condensate.';
    } else if (mode === 'steam') {
      const w2 = Math.max(omega(T1, phi2, P), s1.w);
      s2 = psyState({ T: T1, P, w: w2 });
      pts.push({ x: T1, y: w2 });
      dw = w2 - s1.w;
      note = 'Steam injection moves the state almost vertically (T nearly constant). φ₂ is the target; if it is below φ₁ nothing is added.';
    } else if (mode === 'evap') {
      const Twb = s1.Twb;
      const f = (T: number) => phiOf(T, omegaFromWetBulb(T, Twb, P), P) - phi2;
      let e = T1;
      if (phi2 > phi1 && f(Twb + 1e-3) < 0) e = Twb + 1e-3;
      else if (phi2 > phi1) e = solve(f, Twb + 1e-3, T1, 1e-9);
      s2 = psyState({ T: e, P, w: omegaFromWetBulb(e, Twb, P) });
      pts = range(T1, e, 20).map((T) => ({ x: T, y: omegaFromWetBulb(T, Twb, P) }));
      dw = s2.w - s1.w;
      q = s2.h - s1.h;
      note = 'Evaporative cooling follows the constant wet-bulb line: h is nearly constant, T falls, ω rises. The limit is saturation at T_wb.';
    } else {
      const m = mixStreams({ ma: 1 - xB, w: s1.w, h: s1.h }, { ma: xB, w: sB.w, h: sB.h }, P);
      s2 = psyState({ T: m.T, P, w: m.w });
      pts = [
        { x: s1.T, y: s1.w },
        { x: sB.T, y: sB.w },
      ];
      dw = s2.w - s1.w;
      note = 'Adiabatic mixing: the mixed state lies on the straight line between the two states, dividing it in the inverse ratio of the dry-air masses. If it lands above the saturation curve the excess condenses (fog).';
    }
    return { pts, s2, q, dw, note };
  }, [mode, T1, phi1, T2, phi2, xB, s1, sB]);
  const dots = [
    { x: s1.T, y: s1.w, label: '1', color: 'var(--c2)' },
    { x: r.s2.T, y: r.s2.w, label: '2', color: 'var(--c3)' },
    ...(mode === 'mix' ? [{ x: sB.T, y: sB.w, label: 'B', color: 'var(--c4)' }] : []),
  ];
  const series: Series[] = [...psyCurves(P), { points: r.pts, color: 'var(--c3)', width: 3, label: 'process' }];
  const row = (s: ReturnType<typeof psyState>) => `${num(s.T, 1)} °C, φ ${(100 * s.phi).toFixed(0)} %, ω ${(1000 * s.w).toFixed(2)} g/kg, h ${num(s.h, 1)} kJ/kg, T_dp ${num(s.Tdp, 1)}, T_wb ${num(s.Twb, 1)} °C`;
  return (
    <SimFrame title="Psychrometric chart with a process" subtitle="P = 101.325 kPa; h = 1.005 T + ω(2501.3 + 1.82 T) per kg dry air; saturation from the steam tables">
      <div className="controls">
        <Sel
          label="process"
          value={mode}
          options={[
            { v: 'heat', t: 'sensible heating (ω constant)' },
            { v: 'cool', t: 'cooling and dehumidification' },
            { v: 'steam', t: 'humidification by steam (T constant)' },
            { v: 'evap', t: 'evaporative cooling (constant wet bulb)' },
            { v: 'mix', t: 'adiabatic mixing with a second stream' },
          ]}
          onChange={(v) => {
            setMode(v);
            if (v === 'heat') setT2(Math.min(PSY_TMAX, T1 + 12));
            if (v === 'cool') setT2(12);
          }}
        />
        <Slider label="state 1: dry-bulb T₁" value={T1} min={0} max={45} step={0.5} onChange={setT1} unit=" °C" />
        <Slider label="state 1: relative humidity φ₁" value={phi1} min={0.05} max={1} step={0.01} onChange={setPhi1} format={(v) => `${(100 * v).toFixed(0)} %`} />
        {(mode === 'heat' || mode === 'cool') && <Slider label="exit temperature T₂" value={T2} min={1} max={PSY_TMAX} step={0.5} onChange={setT2} unit=" °C" />}
        {(mode === 'steam' || mode === 'evap') && <Slider label="target humidity φ₂" value={phi2} min={0.05} max={1} step={0.01} onChange={setPhi2} format={(v) => `${(100 * v).toFixed(0)} %`} />}
        {mode === 'mix' && (
          <>
            <Slider label="stream B: T" value={TB} min={0} max={45} step={0.5} onChange={setTB} unit=" °C" />
            <Slider label="stream B: φ" value={phiB} min={0.05} max={1} step={0.01} onChange={setPhiB} format={(v) => `${(100 * v).toFixed(0)} %`} />
            <Slider label="share of B in the dry-air flow" value={xB} min={0} max={1} step={0.01} onChange={setXB} format={(v) => `${(100 * v).toFixed(0)} %`} />
          </>
        )}
      </div>
      <Plot x={[0, PSY_TMAX]} y={[0, 0.03]} height={340} xLabel="dry-bulb T (°C)" yLabel="ω (kg/kg dry air)" series={series} dots={dots} legend={false} />
      <Readout
        items={[
          ['state 1', row(s1)],
          ['state 2', row(r.s2)],
          ['Δω', `${(1000 * r.dw).toFixed(2)} g water per kg dry air (negative = condensate)`],
          ['v₁ per kg dry air', `${s1.v.toFixed(4)} m³`],
          ...(Number.isFinite(r.q) ? ([[mode === 'cool' ? 'heat added to the air (negative = removed by the coil)' : 'Δh per kg dry air', `${num(r.q, 1)} kJ`]] as [string, string][]) : []),
        ]}
      />
      <p className="srcnote">{r.note}</p>
    </SimFrame>
  );
}

/** Wet cooling tower: air flow, make-up water and approach from a mass and energy balance. */
export function CoolingTowerSim() {
  const P = 101.325;
  const [mw, setMw] = useState(100);
  const [Thot, setThot] = useState(35);
  const [Tcold, setTcold] = useState(22);
  const [Tin, setTin] = useState(20);
  const [phiIn, setPhiIn] = useState(0.6);
  const [Tout, setTout] = useState(30);
  const calc = (T2: number) => {
    const a = psyState({ T: Tin, P, phi: phiIn });
    const b = psyState({ T: T2, P, phi: 1 });
    const hf3 = water.satT(Thot).hf;
    const hf4 = water.satT(Tcold).hf;
    const ma = (mw * (hf3 - hf4)) / (b.h - a.h - (b.w - a.w) * hf4);
    return { a, b, ma, mk: ma * (b.w - a.w) };
  };
  const c = calc(Tout);
  const curve = range(Tin + 2, 40, 40).map((t) => ({ x: t, y: calc(t).ma / mw })).filter((p) => p.y > 0 && Number.isFinite(p.y));
  const ok = Thot > Tcold && c.ma > 0 && curve.length > 2;
  return (
    <SimFrame title="Wet cooling tower" subtitle="hot water in, cooled water out, air in at (T₁, φ₁), saturated air out; ṁ_a from mass + energy balance">
      <div className="controls">
        <Slider label="hot water flow ṁ₃" value={mw} min={10} max={500} step={5} onChange={setMw} unit=" kg/s" format={(v) => v.toFixed(0)} />
        <Slider label="hot water in T₃" value={Thot} min={25} max={50} step={0.5} onChange={setThot} unit=" °C" />
        <Slider label="cooled water out T₄" value={Tcold} min={12} max={35} step={0.5} onChange={setTcold} unit=" °C" />
        <Slider label="air in T₁" value={Tin} min={0} max={35} step={0.5} onChange={setTin} unit=" °C" />
        <Slider label="air in φ₁" value={phiIn} min={0.1} max={1} step={0.01} onChange={setPhiIn} format={(v) => `${(100 * v).toFixed(0)} %`} />
        <Slider label="air out T₂ (saturated)" value={Tout} min={Math.min(Tin + 2, 38)} max={40} step={0.5} onChange={setTout} unit=" °C" />
      </div>
      {ok ? (
        <>
          <Plot x={[Tin + 2, 40]} y={[0, Math.max(...curve.map((p) => p.y)) * 1.1]} height={230} xLabel="air exit temperature T₂ (°C)" yLabel="ṁ_a / ṁ_water" series={[{ points: curve, color: 'var(--c1)', width: 2.4 }]} dots={[{ x: Tout, y: c.ma / mw, color: 'var(--c2)', label: (c.ma / mw).toFixed(2) }]} legend={false} />
          <Readout
            items={[
              ['dry-air flow ṁ_a', `${num(c.ma, 1)} kg/s`],
              ['inlet air volume flow ṁ_a v₁', `${num(c.ma * c.a.v, 1)} m³/s`],
              ['make-up water ṁ_a(ω₂ − ω₁)', `${num(c.mk, 2)} kg/s (${pct(c.mk / mw)} of the circulating flow)`],
              ['range T₃ − T₄', `${num(Thot - Tcold, 1)} K`],
              ['approach T₄ − T_wb,in', `${num(Tcold - c.a.Twb, 1)} K`],
              ['inlet air ω₁, h₁, T_wb', `${(1000 * c.a.w).toFixed(2)} g/kg, ${num(c.a.h, 1)} kJ/kg, ${num(c.a.Twb, 1)} °C`],
              ['outlet air ω₂, h₂', `${(1000 * c.b.w).toFixed(2)} g/kg, ${num(c.b.h, 1)} kJ/kg`],
            ]}
          />
        </>
      ) : (
        <p className="srcnote">Choose T₃ above T₄ and an air outlet that carries away more energy than the inlet brings in.</p>
      )}
      <p className="srcnote">Water cannot be cooled below the inlet wet-bulb temperature (approach above 0). Most of the heat leaves as latent heat of the 1–3 % of the flow that evaporates, which is why a tower needs make-up water.</p>
    </SimFrame>
  );
}

/* ====================================================================== chapter 15 */

const FUELS: { k: string; t: string }[] = [
  { k: 'CH4', t: 'Methane CH₄ (natural gas)' },
  { k: 'C3H8', t: 'Propane C₃H₈ (gas)' },
  { k: 'C4H10', t: 'n-Butane C₄H₁₀ (gas)' },
  { k: 'C8H18l', t: 'Octane C₈H₁₈ (liquid, gasoline stand-in)' },
  { k: 'C10H22', t: 'Decane C₁₀H₂₂ (jet-fuel stand-in)' },
  { k: 'CH3OHl', t: 'Methanol CH₃OH (liquid)' },
  { k: 'H2', t: 'Hydrogen H₂' },
];
const fuelLabel = (k: string) => FUELS.find((f) => f.k === k)?.t.split(' ')[0] ?? k;
const fmtN = (v: number) => (Math.abs(v) < 1e-9 ? '0' : String(Number(v.toPrecision(4))));

/** Balanced equation, air-fuel ratio, products, dew point and adiabatic flame temperature versus % theoretical air. */
export function CombustionSim() {
  const [fuel, setFuel] = useState('CH4');
  const [air, setAir] = useState(1.5);
  const [Tair, setTair] = useState(298.15);
  const F: [number, string][] = [[1, fuel]];
  const b = burn({ fuel: F, theoAir: air });
  const Tdp = dewPoint(b.products);
  const Tad = aft({ fuel: F, theoAir: air, Tfuel: 298.15, Tair });
  const grid = useMemo(() => range(1, 6, 50), []);
  const curve = useMemo(() => grid.map((a) => ({ x: 100 * a, y: aft({ fuel: [[1, fuel]], theoAir: a, Tfuel: 298.15, Tair }) })), [grid, fuel, Tair]);
  const curve298 = useMemo(() => (Tair === 298.15 ? [] : grid.map((a) => ({ x: 100 * a, y: aft({ fuel: [[1, fuel]], theoAir: a, Tfuel: 298.15, Tair: 298.15 }) }))), [grid, fuel, Tair]);
  const dew = useMemo(() => grid.map((a) => ({ x: 100 * a, y: dewPoint(burn({ fuel: [[1, fuel]], theoAir: a }).products) })), [grid, fuel]);
  const stoich = burn({ fuel: F, theoAir: 1 });
  const names: [keyof typeof b.products, string][] = [['CO2', 'CO₂'], ['H2O', 'H₂O'], ['O2', 'O₂'], ['N2', 'N₂']];
  const eqn = `${fuelLabel(fuel)} + ${fmtN(b.a)} (O₂ + 3.76 N₂) → ${names.filter(([k]) => b.products[k] > 1e-9).map(([k, n]) => `${fmtN(b.products[k])} ${n}`).join(' + ')}`;
  return (
    <SimFrame title="Combustion explorer" subtitle="complete combustion, no dissociation; fuel enters at 25 °C; H₂O(g) in the products; lib burn(), dewPoint(), aft()">
      <div className="controls">
        <Sel label="fuel" value={fuel} options={FUELS.map((f) => ({ v: f.k, t: f.t }))} onChange={setFuel} />
        <Slider label="theoretical air (150 % = 50 % excess)" value={air} min={1} max={6} step={0.05} onChange={setAir} format={(v) => `${(100 * v).toFixed(0)} %`} />
        <Slider label="air inlet temperature" value={Tair} min={298.15} max={900} step={5} onChange={setTair} unit=" K" format={(v) => v.toFixed(0)} />
      </div>
      <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.92rem', overflowWrap: 'anywhere' }}>{eqn}</p>
      <Plot
        x={[100, 600]}
        y={[600, Math.max(...curve.map((p) => p.y), 2600) * 1.03]}
        height={260}
        xLabel="theoretical air (%)"
        yLabel="adiabatic flame temperature (K)"
        series={[{ points: curve, color: 'var(--c3)', width: 2.4, label: `air at ${num(Tair, 0)} K` }, ...(curve298.length ? [{ points: curve298, color: 'var(--muted)', width: 1.6, dash: true, label: 'air at 298 K' }] : [])]}
        dots={[{ x: 100 * air, y: Tad, color: 'var(--c2)', label: `${num(Tad, 0)} K` }]}
        legend={curve298.length > 0}
      />
      <Plot x={[100, 600]} y={[0, 70]} height={200} xLabel="theoretical air (%)" yLabel="product dew point (°C)" series={[{ points: dew, color: 'var(--c1)', width: 2.4 }]} dots={[{ x: 100 * air, y: Tdp, color: 'var(--c2)', label: `${num(Tdp, 1)} °C` }]} legend={false} />
      <Readout
        items={[
          ['air–fuel ratio AF (kg air / kg fuel)', num(b.AF, 2)],
          ['stoichiometric AF', num(stoich.AF, 2)],
          ['equivalence ratio φ = 1 / (theoretical air)', (1 / air).toFixed(3)],
          ['products N (kmol / kmol fuel)', num(b.Nprod, 2)],
          ['dew point (100 kPa-class, P = 101.325)', `${num(Tdp, 1)} °C`],
          ['adiabatic flame temperature', `${num(Tad, 0)} K`],
        ]}
      />
      <p className="srcnote">Excess air dilutes the same heat release across more N₂ and O₂, so T_ad falls fast (stoichiometric about 2300–2400 K for hydrocarbons, ≈ 1500 K at 200 %). Real flames at the stoichiometric point are lower than these numbers because of dissociation (chapter 16). Dew point: the water-vapour partial pressure in the products is y_H₂O · P.</p>
    </SimFrame>
  );
}

/** HHV, LHV and a condensing boiler: how much of the water-vapour latent heat is recovered. */
export function HhvLhvSim() {
  const [fuel, setFuel] = useState('CH4');
  const [air, setAir] = useState(1.15);
  const [Tflue, setTflue] = useState(40);
  const P = 101.325;
  const sp = SPECIES[fuel];
  const hv = heatingValues(sp);
  const HHV = hv.HHV * sp.M; // kJ/kmol
  const LHV = hv.LHV * sp.M;
  const b = burn({ fuel: [[1, fuel]], theoAir: air });
  const eff = (T: number) => {
    const Pgs = Pg(T);
    const nDry = b.Nprod - b.products.H2O;
    const nvmax = Pgs < P ? (nDry * Pgs) / (P - Pgs) : Infinity;
    const cond = Math.max(0, b.products.H2O - nvmax);
    const hfg = water.satT(Math.min(T, 300)).hfg;
    const Q = steadyQ({ fuel: [[1, fuel]], theoAir: air, Tfuel: 298.15, Tair: 298.15, Tprod: T + 273.15 }) + cond * 18.015 * hfg;
    return { cond, frac: cond / b.products.H2O, etaL: Q / LHV, etaH: Q / HHV };
  };
  const cur = eff(Tflue);
  const Ts = range(25, 200, 70);
  const Tdp = dewPoint(b.products, P);
  return (
    <SimFrame title="HHV, LHV and the condensing boiler" subtitle="all heat of reaction minus the heat carried out by the flue gas; condensate leaves as liquid at the flue temperature">
      <div className="controls">
        <Sel label="fuel" value={fuel} options={FUELS.filter((f) => f.k !== 'C10H22').map((f) => ({ v: f.k, t: f.t }))} onChange={setFuel} />
        <Slider label="theoretical air" value={air} min={1} max={2} step={0.01} onChange={setAir} format={(v) => `${(100 * v).toFixed(0)} %`} />
        <Slider label="flue-gas exit temperature" value={Tflue} min={25} max={200} step={1} onChange={setTflue} unit=" °C" format={(v) => v.toFixed(0)} />
      </div>
      <Plot
        x={[25, 200]}
        y={[0.6, 1.2]}
        height={250}
        xLabel="flue-gas exit temperature (°C)"
        yLabel="boiler efficiency"
        series={[
          { points: Ts.map((T) => ({ x: T, y: eff(T).etaL })), color: 'var(--c1)', width: 2.4, label: 'on LHV' },
          { points: Ts.map((T) => ({ x: T, y: eff(T).etaH })), color: 'var(--c3)', width: 2.4, label: 'on HHV' },
        ]}
        vlines={[{ x: Tdp, color: 'var(--c4)', dash: true, label: 'dew point' }]}
        hlines={[{ y: 1, color: 'var(--muted)', dash: true }]}
        dots={[{ x: Tflue, y: cur.etaL, color: 'var(--c2)', label: pct(cur.etaL) }]}
      />
      <Readout
        items={[
          ['HHV, LHV (per kg fuel)', `${num(hv.HHV, 0)}, ${num(hv.LHV, 0)} kJ/kg`],
          ['HHV / LHV', (hv.HHV / hv.LHV).toFixed(4)],
          ['dew point of the flue gas', `${num(Tdp, 1)} °C`],
          ['water condensed', `${pct(cur.frac)} of the vapour`],
          ['efficiency on LHV basis', pct(cur.etaL)],
          ['efficiency on HHV basis', pct(cur.etaH)],
        ]}
      />
      <p className="srcnote">LHV = HHV − m_w h_fg: the lower value pretends the water leaves as vapour. A boiler that condenses part of it recovers energy the LHV never counted, so its LHV-based efficiency can exceed 100 %; the HHV-based efficiency never does. The maximum on an LHV basis is HHV/LHV (≈ 111 % for methane). Above the dew point the flue gas carries the latent heat up the stack.</p>
    </SimFrame>
  );
}

/* ====================================================================== chapter 16 */

const KP_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--accent)', 'var(--muted)'];

/** ln Kp(T) curves for the eight reactions of table A-28 (seven independent ones), also versus 1/T (van 't Hoff straight lines). */
export function KpCurvesSim() {
  const [on, setOn] = useState<boolean[]>(A28.map((_, i) => [3, 5, 6, 1].includes(i)));
  const [vh, setVh] = useState(false);
  const [T, setT] = useState(2200);
  const [focus, setFocus] = useState(5);
  const Ts = range(1000, 6000, 100);
  const series: Series[] = A28.flatMap((rx, i) =>
    on[i]
      ? [
          {
            points: Ts.map((t) => ({ x: vh ? 1000 / t : t, y: lnKp(rx, t) })).filter((p) => p.y > -60),
            color: KP_COLORS[i],
            width: 2.2,
            dash: i >= 5,
            label: rx.label,
          },
        ]
      : [],
  );
  const rx = A28[focus];
  const d = 0.01;
  const hVan = (-Ru * (lnKp(rx, T * (1 + d)) - lnKp(rx, T * (1 - d)))) / (1 / (T * (1 + d)) - 1 / (T * (1 - d)));
  const lk = lnKp(rx, T);
  return (
    <SimFrame title="ln Kp(T) for the table A-28 reactions" subtitle="ln Kp = −ΔG°(T)/(Ru T), computed from ḡ = h̄ − T s̄° of every species; P₀ = 1 atm">
      <div className="controls">
        <div>
          {A28.map((r, i) => (
            <Check key={r.label} label={r.label} checked={on[i]} color={KP_COLORS[i]} onChange={(v) => setOn(on.map((o, j) => (j === i ? v : o)))} />
          ))}
          <Check label="plot against 1000/T (van 't Hoff: slope = −h̄_R/Ru)" checked={vh} onChange={setVh} />
        </div>
        <Sel label="reaction for the readout" value={String(focus)} options={A28.map((r, i) => ({ v: String(i), t: r.label }))} onChange={(v) => setFocus(Number(v))} />
        <Slider label="temperature T" value={T} min={1000} max={6000} step={50} onChange={setT} unit=" K" format={(v) => v.toFixed(0)} />
      </div>
      <Plot
        x={vh ? [1000 / 6000, 1] : [1000, 6000]}
        y={[-50, 10]}
        height={300}
        xLabel={vh ? '1000 / T (1/K × 1000)' : 'T (K)'}
        yLabel="ln Kp"
        series={series}
        hlines={[{ y: 0, color: 'var(--text)', dash: true, label: 'Kp = 1' }]}
        dots={[{ x: vh ? 1000 / T : T, y: Math.max(lk, -50), color: 'var(--c2)', label: lk.toFixed(2) }]}
        legend
      />
      <Readout
        items={[
          [rx.label, `ln Kp(${T} K) = ${lk.toFixed(3)}`],
          ['Kp', Math.abs(lk) < 12 ? Math.exp(lk).toPrecision(4) : Math.exp(lk).toExponential(2)],
          ['h̄_R from the enthalpy tables', `${num(hR(rx, T), 0)} kJ/kmol`],
          ['h̄_R from the slope of ln Kp vs 1/T', `${num(hVan, 0)} kJ/kmol`],
          ['reading', lk > 0 ? 'Kp > 1: products favoured' : 'Kp < 1: reactants favoured'],
          ['effect of T', hR(rx, T) > 0 ? 'endothermic: Kp rises with T' : 'exothermic: Kp falls with T'],
        ]}
      />
      <p className="srcnote">Every dissociation reaction is endothermic (h̄_R &gt; 0) so ln Kp climbs with T; the curve is nearly straight against 1/T because h̄_R changes slowly. Where the curve crosses 0 (Kp = 1) the products start to win: about 3600 K for CO₂ → CO + ½O₂. ½N₂ + ½O₂ → NO barely gets there, which is why NO stays at the ppm–percent level.</p>
    </SimFrame>
  );
}

const DISS = [0, 1, 2, 3, 5];
/** Equilibrium dissociation fraction of a single-reactant reaction versus T, for three pressures; inert gas shifts it like a pressure drop. */
export function DissociationSim() {
  const [idx, setIdx] = useState(5);
  const [P, setP] = useState(1);
  const [inert, setInert] = useState(0);
  const [T, setT] = useState(3000);
  const rx = A28[idx];
  const sp = rx.reac[0][1] as string;
  const alpha = (t: number, p: number) => {
    const e = equilibrium({ lnK: lnKp(rx, t), reac: rx.reac, prod: rx.prod, initial: { [sp]: 1 }, inert: inert > 0 ? { N2: inert } : undefined, P: p });
    return 1 - e[sp];
  };
  const Ts = range(1500, 5500, 80);
  const Ps = [P / 10, P, P * 10];
  const cols = ['var(--c1)', 'var(--c3)', 'var(--c4)'];
  const series: Series[] = Ps.map((p, i) => ({ points: Ts.map((t) => ({ x: t, y: alpha(t, p) })), color: cols[i], width: i === 1 ? 2.8 : 1.8, label: `P = ${p < 1 ? p.toFixed(2) : p.toFixed(p < 10 ? 1 : 0)} atm` }));
  const a = alpha(T, P);
  return (
    <SimFrame title="Dissociation versus temperature and pressure" subtitle={`1 kmol of ${sub(sp)} (${rx.label}); extent found from Kp = Π(Nᵢ^νᵢ)(P/N_total)^Δν; lib equilibrium()`}>
      <div className="controls">
        <Sel label="reaction" value={String(idx)} options={DISS.map((i) => ({ v: String(i), t: A28[i].label }))} onChange={(v) => setIdx(Number(v))} />
        <Slider label="pressure P (middle curve)" value={Math.log10(P)} min={-1} max={2} step={0.05} onChange={(v) => setP(Math.pow(10, v))} format={(v) => `${Math.pow(10, v).toPrecision(2)} atm`} />
        <Slider label="inert N₂ added (kmol)" value={inert} min={0} max={5} step={0.25} onChange={setInert} />
        <Slider label="temperature T" value={T} min={1500} max={5500} step={50} onChange={setT} unit=" K" format={(v) => v.toFixed(0)} />
      </div>
      <Plot x={[1500, 5500]} y={[0, 1]} height={280} xLabel="T (K)" yLabel="fraction dissociated" series={series} vlines={[{ x: T, color: 'var(--muted)', dash: true }]} dots={[{ x: T, y: a, color: 'var(--c2)', label: pct(a) }]} legend />
      <Readout
        items={[
          ['ln Kp at T', lnKp(rx, T).toFixed(3)],
          ['fraction dissociated at T, P', pct(a)],
          ['at P × 10', pct(alpha(T, P * 10))],
          ['at P / 10', pct(alpha(T, P / 10))],
          ['inert N₂ present', `${inert.toFixed(2)} kmol`],
        ]}
      />
      <p className="srcnote">Three of the six remarks about Kp in one picture: Kp depends on T only (the curve shifts with T), pressure does not change Kp but moves the composition (the three curves), and an inert gas acts like lower pressure at constant total P (it raises N_total, which lowers P/N_total). Dissociation produces more moles, so low P and added inert favour it (Le Chatelier).</p>
    </SimFrame>
  );
}

/** Gibbs function of the CO₂ ⇌ CO + ½O₂ mixture versus extent of reaction: equilibrium is the minimum, where dG = 0. */
export function GibbsMinimumSim() {
  const [T, setT] = useState(3000);
  const [P, setP] = useState(1);
  const g = (sp: 'CO2' | 'CO' | 'O2') => hbar(sp, T) - T * s0(sp, T);
  const gC = g('CO2');
  const gM = g('CO');
  const gO = g('O2');
  const G = (x: number) => {
    const N = 1 + x / 2;
    const nC = 1 - x;
    const nM = x;
    const nO = x / 2;
    const t = (n: number, gi: number) => (n > 0 ? n * (gi + Ru * T * Math.log((n / N) * P)) : 0);
    return t(nC, gC) + t(nM, gM) + t(nO, gO);
  };
  const G0 = G(1e-7);
  const xs = range(1e-4, 0.9999, 200);
  const pts = xs.map((x) => ({ x, y: (G(x) - G0) / 1000 }));
  const lk = lnKp(A28[5], T);
  const xe = equilibrium({ lnK: lk, reac: A28[5].reac, prod: A28[5].prod, initial: { CO2: 1 }, P }).CO;
  return (
    <SimFrame title="Why equilibrium is a minimum of G" subtitle="1 kmol CO₂ at fixed T and P; G(ξ) = Σ Nᵢ [ḡᵢ°(T) + Ru T ln(yᵢ P)]; ξ = kmol of CO formed">
      <div className="controls">
        <Slider label="temperature T" value={T} min={2000} max={4500} step={50} onChange={setT} unit=" K" format={(v) => v.toFixed(0)} />
        <Slider label="pressure P" value={Math.log10(P)} min={-1} max={2} step={0.05} onChange={(v) => setP(Math.pow(10, v))} format={(v) => `${Math.pow(10, v).toPrecision(2)} atm`} />
      </div>
      <Plot x={[0, 1]} y={[Math.min(...pts.map((p) => p.y)) * 1.1 - 1, Math.max(...pts.map((p) => p.y)) * 1.05 + 1]} height={270} xLabel="extent of reaction ξ (kmol CO formed)" yLabel="G − G(ξ=0) (MJ)" series={[{ points: pts, color: 'var(--c1)', width: 2.6 }]} vlines={[{ x: xe, color: 'var(--c3)', dash: true, label: 'equilibrium' }]} dots={[{ x: xe, y: (G(xe) - G0) / 1000, color: 'var(--c2)', label: `ξ = ${xe.toFixed(3)}` }]} legend={false} />
      <Readout
        items={[
          ['ln Kp (table A-28 form)', lk.toFixed(3)],
          ['equilibrium extent ξ', xe.toFixed(4)],
          ['mixture at equilibrium', `${(1 - xe).toFixed(3)} CO₂, ${xe.toFixed(3)} CO, ${(xe / 2).toFixed(3)} O₂ kmol`],
          ['ΔG° = ḡ_CO + ½ḡ_O₂ − ḡ_CO₂ at T', `${num((gM + 0.5 * gO - gC) / 1000, 1)} MJ/kmol`],
        ]}
      />
      <p className="srcnote">Left of the minimum the reaction can lower G by proceeding, right of it by reversing; at the minimum (dG)_T,P = 0. The minimum moves right at higher T (endothermic) and left at higher P (fewer moles on the left). ΔG° = −Ru T ln Kp fixes where it sits.</p>
    </SimFrame>
  );
}

/* ====================================================================== chapter 17 */

const KOPTS = [
  { v: '1.4', t: 'k = 1.4 (air)' },
  { v: '1.333', t: 'k = 1.333 (hot combustion gas)' },
  { v: '1.289', t: 'k = 1.289 (CO₂)' },
  { v: '1.2', t: 'k = 1.2 (rocket exhaust ≈)' },
  { v: '1.667', t: 'k = 1.667 (He, Ar)' },
];

/** Isentropic ratios T/T0, P/P0, ρ/ρ0 and A/A* versus Mach number; static versus stagnation temperature. */
export function IsentropicRatiosSim() {
  const [ks, setKs] = useState('1.4');
  const [Ma, setMa] = useState(0.5);
  const [T, setT] = useState(288);
  const k = Number(ks);
  const ar = areaRatio(Ma, k);
  const conj = Ma === 1 ? 1 : machFromAreaRatio(ar, k, Ma < 1 ? 'sup' : 'sub');
  const Ms = range(0.02, 3, 150);
  const R = 0.287;
  const c = soundSpeed(T, R, k);
  const V = Ma * c;
  const arCurve = Ms.map((m) => ({ x: m, y: areaRatio(m, k) })).filter((p) => p.y <= 6);
  return (
    <SimFrame title="Isentropic flow: static, stagnation and the area ratio" subtitle="ideal gas, constant k; T₀/T = 1 + (k−1)Ma²/2, P₀/P = (T₀/T)^(k/(k−1)); lib compressible.ts">
      <div className="controls">
        <Sel label="gas" value={ks} options={KOPTS} onChange={setKs} />
        <Slider label="Mach number Ma" value={Ma} min={0.02} max={3} step={0.01} onChange={setMa} />
        <Slider label="static temperature T (air-like, R = 0.287)" value={T} min={200} max={600} step={1} onChange={setT} unit=" K" format={(v) => v.toFixed(0)} />
      </div>
      <Plot
        x={[0, 3]}
        y={[0, 1]}
        height={240}
        xLabel="Ma"
        yLabel="static / stagnation"
        series={[
          { points: Ms.map((m) => ({ x: m, y: 1 / T0_T(m, k) })), color: 'var(--c1)', width: 2.4, label: 'T/T₀' },
          { points: Ms.map((m) => ({ x: m, y: 1 / P0_P(m, k) })), color: 'var(--c3)', width: 2.4, label: 'P/P₀' },
          { points: Ms.map((m) => ({ x: m, y: 1 / rho0_rho(m, k) })), color: 'var(--c4)', width: 2.4, label: 'ρ/ρ₀' },
        ]}
        vlines={[{ x: 1, color: 'var(--muted)', dash: true, label: 'sonic' }]}
        dots={[{ x: Ma, y: 1 / P0_P(Ma, k), color: 'var(--c2)' }]}
      />
      <Plot
        x={[0, 3]}
        y={[1, 5]}
        height={240}
        xLabel="Ma"
        yLabel="A / A*"
        series={[{ points: arCurve, color: 'var(--c1)', width: 2.4 }]}
        vlines={[{ x: 1, color: 'var(--muted)', dash: true, label: 'throat' }]}
        dots={[
          { x: Ma, y: Math.min(ar, 5), color: 'var(--c2)', label: ar.toFixed(3) },
          ...(Number.isFinite(conj) && ar < 5 ? [{ x: conj, y: ar, color: 'var(--c3)', label: `Ma ${conj.toFixed(3)}` }] : []),
        ]}
        legend={false}
      />
      <Readout
        items={[
          ['T₀/T', T0_T(Ma, k).toFixed(4)],
          ['P₀/P', P0_P(Ma, k).toFixed(4)],
          ['ρ₀/ρ', rho0_rho(Ma, k).toFixed(4)],
          ['A/A*', ar.toFixed(4)],
          ['other Mach with the same A/A*', Number.isFinite(conj) ? conj.toFixed(4) : '—'],
          ['critical ratios T*/T₀, P*/P₀', `${critical(k).T.toFixed(4)}, ${critical(k).P.toFixed(4)}`],
          ['sound speed c, velocity V', `${num(c, 1)} m/s, ${num(V, 1)} m/s`],
          ['stagnation temperature T₀', `${num(T * T0_T(Ma, k), 1)} K`],
        ]}
      />
      <p className="srcnote">A/A* has a minimum of 1 at Ma = 1: for every other area ratio there are two solutions, one subsonic and one supersonic. Which one occurs is decided by the back pressure, not by the area. T is what a thermometer moving with the flow reads; T₀ is what the flow would read if brought to rest.</p>
    </SimFrame>
  );
}

/** normal-shock stagnation-pressure ratio P0y/P0x */
const sigma = (M: number, k: number) => Math.pow(((k + 1) * M * M) / ((k - 1) * M * M + 2), k / (k - 1)) * Math.pow((k + 1) / (2 * k * M * M - (k - 1)), 1 / (k - 1));
const pOfM = (M: number, k: number) => 1 / P0_P(M, k);
const machFromP = (p: number, k: number) => Math.sqrt((2 / (k - 1)) * (Math.pow(1 / p, (k - 1) / k) - 1));

/** quasi-1D flow through a nozzle for given exit/throat area ratio and back-pressure ratio (all pressures over P0) */
function nozzleFlow(k: number, AeAt: number, pb: number) {
  const conv = AeAt < 1.0005;
  const A = (x: number) => 1 + ((x < 0 ? 3 : AeAt) - 1) * x * x; // A/At
  const xs = conv ? range(-1, 0, 80) : [...range(-1, 0, 60), ...range(0, 1, 80).slice(1)];
  const Pstar = critical(k).P;
  const sup = (ar: number) => machFromAreaRatio(Math.max(ar, 1 + 1e-9), k, 'sup');
  const subM = (ar: number) => machFromAreaRatio(Math.max(ar, 1 + 1e-9), k, 'sub');
  const subsonic = (Me: number) => {
    const Astar = AeAt / areaRatio(Me, k);
    return { Astar, prof: xs.map((x) => { const M = subM(A(x) / Astar); return { x, M, p: pOfM(M, k) }; }) };
  };
  const design = () => xs.map((x) => { const M = x < 0 ? subM(A(x)) : sup(A(x)); return { x, M, p: pOfM(M, k) }; });
  let regime = '';
  let prof: { x: number; M: number; p: number }[] = [];
  let mdot = 1;
  let pe = pb;
  let Me = 1;
  let xShock: number | null = null;
  let crit: { first: number; second: number | null; third: number | null };
  if (conv) {
    crit = { first: Pstar, second: null, third: null };
    if (pb >= Pstar) {
      Me = machFromP(pb, k);
      const s = subsonic(Me);
      prof = s.prof;
      mdot = s.Astar;
      pe = pb;
      regime = 'subsonic everywhere: exit pressure equals the back pressure, flow rate rises as P_b falls';
    } else {
      prof = xs.map((x) => { const M = subM(A(x)); return { x, M, p: pOfM(M, k) }; });
      Me = 1;
      pe = Pstar;
      regime = 'choked: exit is sonic at P*, and a lower back pressure changes nothing inside the nozzle (underexpanded jet outside)';
    }
  } else {
    const Mdes = sup(AeAt);
    const pb3 = pOfM(Mdes, k);
    const pb1 = pOfM(subM(AeAt), k);
    const pb2 = pb3 * (1 + ((2 * k) / (k + 1)) * (Mdes * Mdes - 1));
    crit = { first: pb1, second: pb2, third: pb3 };
    if (pb >= pb1) {
      Me = machFromP(pb, k);
      const s = subsonic(Me);
      prof = s.prof;
      mdot = s.Astar;
      pe = pb;
      regime = 'subsonic throughout (venturi): throat not choked, flow rate depends on P_b';
    } else if (pb >= pb2) {
      const f = (Mx: number) => sigma(Mx, k) * pOfM(subM(AeAt * sigma(Mx, k)), k) - pb;
      const Mx = solve(f, 1 + 1e-6, Mdes, 1e-10);
      const sg = sigma(Mx, k);
      xShock = Math.sqrt((areaRatio(Mx, k) - 1) / (AeAt - 1));
      prof = xs.map((x) => {
        if (x < 0) { const M = subM(A(x)); return { x, M, p: pOfM(M, k) }; }
        if (x <= (xShock as number)) { const M = sup(A(x)); return { x, M, p: pOfM(M, k) }; }
        const M = subM(A(x) * sg);
        return { x, M, p: sg * pOfM(M, k) };
      });
      Me = prof[prof.length - 1].M;
      pe = pb;
      regime = 'choked, with a normal shock inside the diverging section: the shock moves toward the exit as P_b falls';
    } else if (pb > pb3 * 1.002) {
      prof = design();
      Me = Mdes;
      pe = pb3;
      regime = 'overexpanded: supersonic all the way to the exit, then oblique shocks outside raise the pressure up to P_b';
    } else if (pb >= pb3 * 0.998) {
      prof = design();
      Me = Mdes;
      pe = pb3;
      regime = 'design condition: shock-free supersonic exit with P_e = P_b';
    } else {
      prof = design();
      Me = Mdes;
      pe = pb3;
      regime = 'underexpanded: exit pressure above P_b, expansion waves outside the nozzle';
    }
  }
  return { prof, regime, mdot, pe, Me, xShock, crit, conv };
}

/** Converging or converging–diverging nozzle: pressure along the axis, shock position and the choking curve as the back pressure falls. */
export function NozzleChokingSim() {
  const [ks, setKs] = useState('1.4');
  const [AeAt, setAeAt] = useState(2);
  const [pb, setPb] = useState(0.9);
  const k = Number(ks);
  const r = nozzleFlow(k, AeAt, pb);
  const mdotCurve = range(0.02, 1, 120).map((p) => {
    const f = nozzleFlow(k, AeAt, p);
    return { x: p, y: f.mdot };
  });
  return (
    <SimFrame title="Nozzle choking and shock position" subtitle="isentropic flow from a reservoir (P₀, T₀) into back pressure P_b; shock via the normal-shock relations; lib compressible.ts">
      <div className="controls">
        <Sel label="gas" value={ks} options={KOPTS} onChange={setKs} />
        <Slider label="exit-to-throat area ratio A_e/A_t (1 = converging nozzle only)" value={AeAt} min={1} max={4} step={0.05} onChange={setAeAt} />
        <Slider label="back pressure P_b / P₀" value={pb} min={0.02} max={1} step={0.005} onChange={setPb} format={(v) => v.toFixed(3)} />
      </div>
      <Plot
        x={[-1, r.conv ? 0 : 1]}
        y={[0, 1.05]}
        height={260}
        xLabel="axial position (throat at 0)"
        yLabel="P / P₀"
        series={[{ points: r.prof.map((p) => ({ x: p.x, y: p.p })), color: 'var(--c1)', width: 2.6 }]}
        vlines={[{ x: 0, color: 'var(--muted)', dash: true, label: 'throat' }, ...(r.xShock !== null ? [{ x: r.xShock, color: 'var(--c3)', label: 'shock' }] : [])]}
        hlines={[{ y: pb, color: 'var(--c4)', dash: true, label: 'P_b/P₀' }]}
        legend={false}
      />
      <Plot
        x={[-1, r.conv ? 0 : 1]}
        y={[0, 3.5]}
        height={200}
        xLabel="axial position"
        yLabel="Mach number"
        series={[{ points: r.prof.map((p) => ({ x: p.x, y: p.M })), color: 'var(--c3)', width: 2.6 }]}
        hlines={[{ y: 1, color: 'var(--muted)', dash: true }]}
        legend={false}
      />
      <Plot x={[0, 1]} y={[0, 1.05]} height={200} xLabel="P_b / P₀" yLabel="ṁ / ṁ_max" series={[{ points: mdotCurve, color: 'var(--c1)', width: 2.6 }]} vlines={[{ x: r.crit.first, color: 'var(--c3)', dash: true, label: 'choking' }]} dots={[{ x: pb, y: r.mdot, color: 'var(--c2)', label: r.mdot.toFixed(3) }]} legend={false} />
      <Readout
        items={[
          ['regime', r.regime],
          ['exit Mach number', r.Me.toFixed(3)],
          ['exit pressure P_e/P₀', r.pe.toFixed(4)],
          ['mass flow ṁ / ṁ_max', r.mdot.toFixed(4)],
          ['P*/P₀ (critical, sonic)', critical(k).P.toFixed(4)],
          ['P_b/P₀ for choking (first critical)', r.crit.first.toFixed(4)],
          ...(r.crit.second !== null ? ([['shock at the exit (second critical)', r.crit.second.toFixed(4)], ['design, shock-free (third critical)', (r.crit.third as number).toFixed(4)]] as [string, string][]) : []),
        ]}
      />
      <p className="srcnote">Once the throat is sonic, information from downstream cannot travel upstream, so ṁ stops depending on P_b: it is ṁ = A* P₀ √(k/(R T₀)) (2/(k+1))^((k+1)/(2(k−1))) and only P₀, T₀ and the throat area set it. Lower P_b then only moves the shock down the diverging section (or, below the second critical, outside).</p>
    </SimFrame>
  );
}
