/* Group E simulations — MOC channel (Ch. 15, PS10), piston x–t and shock tube (Ch. 16, PS11). Physics from lib/moc.ts and lib/waves1d.ts. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plot, sample } from '../../../core/Plot';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import { fmt, machColor, MachLegend } from './common';
import { FlowSection3D } from '../viz/FlowSection3D';
import { MOCNetDrawing } from '../figures/figsE';
import { buildChannelNet, ChannelSpec, concaveWall, MOC_PRESETS, MOCPoint } from '../lib/moc';
import { pistonProfile, pistonSolution, shockTubeProfile, shockTubeWaves } from '../lib/waves1d';
import { GASES, gasR, soundSpeed } from '../lib/gas';
import { toRad } from '../lib/solve';

const f2 = (v: number) => (isFinite(v) ? v.toFixed(2) : '—');
const f3 = (v: number) => (isFinite(v) ? v.toFixed(3) : '—');
const selStyle = { font: 'inherit', padding: '0.35rem 0.5rem', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', maxWidth: '100%' } as const;
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.84rem', fontVariantNumeric: 'tabular-nums' as const };
const cell = { padding: '0.25rem 0.45rem', borderBottom: '1px solid var(--border)', textAlign: 'right' as const };

/** Animation clock: returns [frac, setFrac, playing, setPlaying]; frac loops 0 → 1 over `period` seconds. */
function useClock(period = 6, initial = 0.6) {
  const [frac, setFrac] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (ts: number) => {
      if (last.current !== null) setFrac((f) => (f + (ts - last.current!) / 1000 / period) % 1);
      last.current = ts;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing, period]);
  return [frac, setFrac, playing, setPlaying] as const;
}

/* =====================================================================
 * 1. MOC channel: step-by-step construction of the characteristic net
 * ===================================================================== */

function explain(q: MOCPoint, byId: Map<number, MOCPoint>) {
  if (q.kind === 'initial') return `Initial point: given M and the wall angle → ν = ${f2(q.nu)}°, C_I = ν + θ = ${f2(q.CI)}, C_II = ν − θ = ${f2(q.CII)}.`;
  if (q.kind === 'interior') {
    const a = byId.get(q.fromI!)!;
    const b = byId.get(q.fromII!)!;
    return `Interior: C_I = ${f2(a.CI)} arrives from point ${a.id} (right-running), C_II = ${f2(b.CII)} from point ${b.id} (left-running). θ = (C_I − C_II)/2 = ${f2(q.theta)}°, ν = (C_I + C_II)/2 = ${f2(q.nu)}° → M = ${f3(q.M)}.`;
  }
  if (q.kind === 'upper') {
    const b = byId.get(q.fromII!)!;
    return `Upper wall: θ = θ_wall = ${f2(q.theta)}°. Only C_II = ${f2(b.CII)} arrives (from point ${b.id}): ν = C_II + θ = ${f2(q.nu)}°${q.valid ? ` → M = ${f3(q.M)}` : ' < 0 → the flow would be subsonic: MOC stops here'}.`;
  }
  const a = byId.get(q.fromI!)!;
  return `Lower wall: θ = θ_wall = ${f2(q.theta)}°. Only C_I = ${f2(a.CI)} arrives (from point ${a.id}): ν = C_I − θ = ${f2(q.nu)}°${q.valid ? ` → M = ${f3(q.M)}` : ' < 0 → the flow would be subsonic: MOC stops here'}.`;
}

export function MOCChannelSim({ preset = 'ps10p3' }: { preset?: string }) {
  const [key, setKey] = useState(preset);
  const [M0, setM0] = useState(2);
  const [wall, setWall] = useState(-10);
  const [nInit, setNInit] = useState(2);
  const [nStages, setNStages] = useState(6);
  const [ramp, setRamp] = useState(15);
  const concave = key === 'concave';
  const spec: ChannelSpec = useMemo(
    () => (key in MOC_PRESETS ? MOC_PRESETS[key].spec : { M0, upperWall: [wall], nInitial: nInit, stages: nStages, pIn: 100, height: nInit > 2 ? 1.5 : 1 }),
    [key, M0, wall, nInit, nStages],
  );
  const net = useMemo(() => buildChannelNet(spec), [spec]);
  const cw = useMemo(() => concaveWall(M0, Array.from({ length: 7 }, (_, i) => (ramp * i) / 6), 0.3), [M0, ramp]);
  const total = concave ? cw.wall.length : net.points.length;
  const nFirst = concave ? 1 : net.stages[0].length;
  const [shown, setShown] = useState(nFirst);
  useEffect(() => setShown(concave ? 1 : buildChannelNet(spec).stages[0].length), [spec, concave]);
  const byId = useMemo(() => new Map(net.points.map((q) => [q.id, q])), [net]);
  const current = Math.min(shown, total);
  const curPt = byId.get(current);
  const pUnit = spec.pIn === 1 ? 'atm' : 'kPa';
  const rows = concave ? [] : net.points.filter((q) => q.id <= shown).sort((a, b) => a.id - b.id);

  return (
    <SimFrame title="Method of characteristics: build the net point by point" subtitle="C_I = ν + θ along right-running, C_II = ν − θ along left-running">
      <div className="controls">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
          Case
          <select style={selStyle} value={key} onChange={(e) => setKey(e.target.value)}>
            {Object.entries(MOC_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
            <option value="custom">Custom channel (sliders)</option>
            <option value="concave">Concave ramp: compression waves coalesce → shock</option>
          </select>
        </label>
        {(key === 'custom' || concave) && <Slider label="Inlet Mach number M₀" value={M0} min={1.3} max={4} step={0.05} onChange={setM0} format={(v) => v.toFixed(2)} />}
        {key === 'custom' && (
          <>
            <Slider label="Upper-wall angle (− converging, + diverging)" value={wall} min={-15} max={15} step={0.5} onChange={setWall} unit="°" />
            <Slider label="Points on the initial line" value={nInit} min={2} max={5} step={1} onChange={setNInit} format={(v) => String(v)} />
            <Slider label="Stages to march" value={nStages} min={2} max={12} step={1} onChange={setNStages} format={(v) => String(v)} />
          </>
        )}
        {concave && <Slider label="Total ramp turn (6 steps)" value={ramp} min={3} max={30} step={0.5} onChange={setRamp} unit="°" />}
      </div>
      <div className="step-controls">
        <button className="btn primary" disabled={shown >= total} onClick={() => setShown((s) => Math.min(total, s + 1))}>
          Next point ({Math.min(shown, total)}/{total})
        </button>
        <button className="btn" disabled={shown <= nFirst} onClick={() => setShown((s) => Math.max(nFirst, s - 1))}>
          Back
        </button>
        <button className="btn" onClick={() => setShown(total)}>
          Show all
        </button>
        <button className="btn" onClick={() => setShown(nFirst)}>
          Reset
        </button>
      </div>
      {concave ? (
        <ConcaveRampDrawing cw={cw} shown={shown} M0={M0} />
      ) : (
        <MOCNetDrawing net={net} shown={shown} current={current} />
      )}
      <MachLegend />
      {!concave && curPt && <div className="regime">Point {curPt.id}: {explain(curPt, byId)}</div>}
      {!concave && net.breakdown && shown >= total && (
        <div className="regime" style={{ background: 'rgba(255,84,112,0.12)', color: 'var(--c2)' }}>
          {net.breakdown.reason === 'subsonic'
            ? `MOC breaks down at point ${net.breakdown.id}: ν would be negative, i.e. the flow would have to go subsonic. Before that, the converging compression waves would already be steepening toward a shock.`
            : 'Characteristics of the same family cross inside the net: the solution would be multivalued, so a shock forms and isentropic MOC stops.'}
        </div>
      )}
      {concave && cw.shock && shown >= total && (
        <div className="regime">
          Neighbouring left-running waves first cross at x = {f2(cw.shock.x)}, y = {f2(cw.shock.y)} (between waves {cw.shock.between[0]} and {cw.shock.between[1]}). Downstream of there the "solution" would be multivalued: the waves have coalesced into an oblique shock.
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {['Point', 'type', 'C_I = ν+θ', 'C_II = ν−θ', 'θ (°)', 'ν (°)', 'M', 'μ (°)', 'p/p₀', concave ? 'p/p_∞' : `p (${pUnit})`].map((h) => (
                <th key={h} style={{ ...cell, textAlign: 'center' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {concave
              ? cw.wall.slice(0, shown).map((q) => (
                  <tr key={q.id} style={q.id === shown ? { background: 'var(--accent-soft)' } : undefined}>
                    <td style={cell}>{q.id}</td>
                    <td style={cell}>wall</td>
                    <td style={cell}>{f2(q.CI)}</td>
                    <td style={cell}>{f2(q.CII)}</td>
                    <td style={cell}>{f2(q.theta)}</td>
                    <td style={cell}>{f2(q.nu)}</td>
                    <td style={cell}>{q.valid ? f3(q.M) : '< 1'}</td>
                    <td style={cell}>{q.valid ? f2(q.mu) : '—'}</td>
                    <td style={cell}>{q.valid ? fmt(q.p_p0) : '—'}</td>
                    <td style={cell}>{q.valid ? f3(q.p_pin) : '—'}</td>
                  </tr>
                ))
              : rows.map((q) => (
                  <tr key={q.id} style={q.id === current ? { background: 'var(--accent-soft)' } : !q.valid ? { color: 'var(--c2)' } : undefined}>
                    <td style={cell}>{q.id}</td>
                    <td style={cell}>{q.kind}</td>
                    <td style={cell}>{f2(q.CI)}</td>
                    <td style={cell}>{f2(q.CII)}</td>
                    <td style={cell}>{f2(q.theta)}</td>
                    <td style={cell}>{f2(q.nu)}</td>
                    <td style={cell}>{q.valid ? f3(q.M) : 'subsonic'}</td>
                    <td style={cell}>{q.valid ? f2(q.mu) : '—'}</td>
                    <td style={cell}>{q.valid ? fmt(q.p_p0) : '—'}</td>
                    <td style={cell}>{q.valid ? fmt(q.p_pin * (spec.pIn ?? 1)) : '—'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </SimFrame>
  );
}

/** Uniform flow over a lower wall that turns upward in steps; left-running waves drawn straight until they cross. */
function ConcaveRampDrawing({ cw, shown, M0 }: { cw: ReturnType<typeof concaveWall>; shown: number; M0: number }) {
  const W = 780;
  const H = 330;
  const k = 230;
  const X = (x: number) => 80 + x * k;
  const Y = (y: number) => 290 - y * k;
  const last = cw.wall[cw.wall.length - 1];
  const wallPath = `M0,${Y(0)} ${cw.wall.map((q) => `L${X(q.x)},${Y(q.y)}`).join(' ')} L${X(last.x) + 400},${Y(last.y) - 400 * Math.tan(toRad(last.theta))} L${W},${H} L0,${H} Z`;
  const L = 3;
  const end = (q: (typeof cw.wall)[number]) => ({ x: q.x + L * Math.cos(toRad(q.theta + q.mu)), y: q.y + L * Math.sin(toRad(q.theta + q.mu)) });
  const done = shown >= cw.wall.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="eRampMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9dee6" />
          <stop offset="0.25" stopColor="#8e97a5" />
          <stop offset="1" stopColor="#3d4450" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} rx={10} fill="#0b1020" />
      <rect width={W} height={H} rx={10} fill={machColor(M0)} opacity={0.45} />
      {cw.wall.slice(0, shown).map((q, i) => {
        const nxt = cw.wall[i + 1];
        if (!nxt || i + 1 >= shown || !q.valid) return null;
        const e1 = end(q);
        const e2 = end(nxt);
        return <path key={`s${i}`} d={`M${X(q.x)},${Y(q.y)} L${X(e1.x)},${Y(e1.y)} L${X(e2.x)},${Y(e2.y)} L${X(nxt.x)},${Y(nxt.y)} Z`} fill={machColor(q.M)} opacity={0.55} />;
      })}
      {cw.wall.slice(0, shown).map((q) => {
        if (!q.valid) return null;
        const e = end(q);
        return <line key={q.id} x1={X(q.x)} y1={Y(q.y)} x2={X(e.x)} y2={Y(e.y)} stroke="#ffb454" strokeWidth={q.id === shown ? 3 : 1.6} />;
      })}
      <path d={wallPath} fill="url(#eRampMetal)" stroke="#1a1e26" />
      {cw.wall.slice(0, shown).map((q) => (
        <g key={`p${q.id}`}>
          <circle cx={X(q.x)} cy={Y(q.y)} r={5} fill="#ffe08a" stroke="#0b0f18" />
          <text x={X(q.x) - 4} y={Y(q.y) + 20} style={{ fill: '#e8edf7', fontSize: 12, fontWeight: 650 }}>
            {q.id}
          </text>
        </g>
      ))}
      {done &&
        cw.crossings.map((c, i) => (
          <circle key={i} cx={X(c.x)} cy={Y(c.y)} r={c === cw.shock ? 10 : 6} fill="none" stroke="#ff5470" strokeWidth={c === cw.shock ? 2.6 : 1.4} />
        ))}
      {done && cw.shock && (
        <text x={Math.min(W - 250, X(cw.shock.x) + 14)} y={Math.max(20, Y(cw.shock.y) - 12)} style={{ fill: '#ff5470', fontSize: 12, fontWeight: 650 }}>
          first crossing → oblique shock forms
        </text>
      )}
      {[60, 120, 180].map((y) => (
        <line key={y} x1={14} y1={y} x2={64} y2={y} stroke="#e8edf7" strokeWidth={1.6} />
      ))}
      <text x={14} y={36} style={{ fill: '#e8edf7', fontSize: 12, fontWeight: 650 }}>
        M = {M0}, uniform: C_I = ν₀ on every right-running line
      </text>
    </svg>
  );
}

/* =====================================================================
 * 2. Piston pushed (shock) or pulled (centred rarefaction) — x–t diagram
 * ===================================================================== */

export function PistonXTSim({ up0 = 200, T1 = 300 }: { up0?: number; T1?: number }) {
  const [up, setUp] = useState(up0);
  const [frac, setFrac, playing, setPlaying] = useClock(5, 0.6);
  const g = 1.4;
  const c1 = soundSpeed(g, gasR(28.9), T1);
  const sol = useMemo(() => pistonSolution(up, c1, g), [up, c1]);
  const L = 1;
  const fastest = sol.mode === 'shock' ? sol.Vs! : c1;
  const tEnd = L / fastest;
  const t = Math.max(1e-9, frac * tEnd);
  const xLeft = Math.min(0, up * tEnd) - 0.03;
  const ms = 1000;
  const prof = (x: number) => pistonProfile(sol, x, t);
  const pMax = Math.max(1, sol.p2_p1 ?? 1);
  const TMax = Math.max(1, sol.T2_T1 ?? 1);
  const field = (x: number) => {
    const s = prof(x);
    if (s.region === 'none') return { M: 0, p: 0, T: 0 };
    return { M: Math.abs(s.u) / (c1 * Math.sqrt(s.T_T1)), p: s.p_p1 / pMax, T: s.T_T1 / TMax };
  };
  const fanRays = sol.mode === 'fan' || sol.mode === 'cavitation' ? Array.from({ length: 6 }, (_, i) => sol.tail! + ((sol.head! - sol.tail!) * i) / 5) : [];
  const xp = up * t;
  const labels = [
    { x: Math.max(xLeft + 0.02, xp), text: `piston ${up >= 0 ? '→' : '←'} ${Math.abs(up)} m/s`, side: 'bottom' as const },
    ...(sol.mode === 'shock' ? [{ x: sol.Vs! * t, text: `shock M_s = ${f3(sol.Ms!)}` }] : []),
    ...(fanRays.length ? [{ x: sol.head! * t, text: 'fan head (+c₁)' }] : []),
    ...(sol.mode === 'fan' ? [{ x: sol.tail! * t, text: 'fan tail', side: 'bottom' as const }] : []),
    ...(sol.mode === 'cavitation' ? [{ x: sol.tail! * t, text: 'gas front: vacuum behind', side: 'bottom' as const }] : []),
  ];
  return (
    <SimFrame title="Piston pushed in or pulled out" subtitle="shock vs centred expansion, and the escape velocity 2c₁/(γ−1)">
      <div className="controls">
        <Slider label="Piston velocity (+ push, − pull)" value={up} min={-2000} max={800} step={5} onChange={setUp} unit=" m/s" format={(v) => v.toFixed(0)} />
        <Slider label="Time" value={frac} min={0} max={1} step={0.001} onChange={setFrac} format={(v) => `${(v * tEnd * ms).toFixed(2)} ms`} />
        <div className="step-controls">
          <button className="btn primary" onClick={() => setPlaying(!playing)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button className="btn" onClick={() => setUp(200)}>
            Final A: push 200
          </button>
          <button className="btn" onClick={() => setUp(-200)}>
            Final A: pull 200
          </button>
          <button className="btn" onClick={() => setUp(-1.1 * sol.uEsc)}>
            Pull faster than 5c₁
          </button>
        </div>
      </div>
      <div className="regime">
        {sol.mode === 'shock' && `Pushed: a shock runs ahead at V_s = ${sol.Vs!.toFixed(0)} m/s, faster than the piston. Gas between them moves with the piston.`}
        {sol.mode === 'fan' && `Pulled: a centred expansion fan runs into the gas. Its head moves at +c₁ = ${c1.toFixed(0)} m/s and its tail at u_p + c_p = ${sol.tail!.toFixed(0)} m/s.`}
        {sol.mode === 'cavitation' && `Pulled faster than u_esc = 2c₁/(γ−1) = ${sol.uEsc.toFixed(0)} m/s: the gas cannot follow. It expands to vacuum, and a gap opens at the piston face.`}
        {sol.mode === 'rest' && 'Piston at rest: nothing happens.'}
      </div>
      <FlowSection3D
        wall="duct"
        x0={xLeft}
        x1={L}
        profile={() => 0.07 * (L - xLeft)}
        field={field}
        colorBy="p"
        shocks={sol.mode === 'shock' ? [sol.Vs! * t] : []}
        labels={labels}
        height={250}
      />
      <div className="twocol">
        <Plot
          x={[xLeft, L]}
          y={[0, tEnd * ms]}
          height={270}
          xLabel="x (m)"
          yLabel="t (ms)"
          legend={false}
          series={[
            { points: [{ x: 0, y: 0 }, { x: up * tEnd, y: tEnd * ms }], color: 'var(--text)', width: 4 },
            ...(sol.mode === 'shock' ? [{ points: [{ x: 0, y: 0 }, { x: sol.Vs! * tEnd, y: tEnd * ms }], color: 'var(--c2)', width: 3 }] : []),
            ...fanRays.map((s, i) => ({ points: [{ x: 0, y: 0 }, { x: s * tEnd, y: tEnd * ms }], color: 'var(--c1)', width: i === 0 || i === 5 ? 2 : 1 })),
          ]}
          hlines={[{ y: t * ms, color: 'var(--accent)', label: 'now' }]}
        />
        <Plot
          x={[xLeft, L]}
          y={[0, Math.max(1.2, pMax * 1.1)]}
          height={270}
          xLabel="x (m)"
          yLabel="p/p₁ and u/c₁"
          series={[
            { points: sample((x) => prof(x).p_p1, xLeft, L, 400), color: 'var(--c2)', label: 'p/p₁' },
            { points: sample((x) => prof(x).u / c1, xLeft, L, 400), color: 'var(--c1)', label: 'u/c₁ (negative values clipped)' },
          ]}
          vlines={[{ x: xp, color: 'var(--text)', label: 'piston' }]}
        />
      </div>
      <Readout
        items={
          sol.mode === 'shock'
            ? [
                ['c₁', `${c1.toFixed(1)} m/s`],
                ['M_s', f3(sol.Ms!)],
                ['V_s', `${sol.Vs!.toFixed(0)} m/s`],
                ['p₂/p₁', f3(sol.p2_p1!)],
                ['T₂', `${(T1 * sol.T2_T1!).toFixed(1)} K`],
                ['lab Mach behind shock', f3(sol.M2lab!)],
              ]
            : [
                ['c₁', `${c1.toFixed(1)} m/s`],
                ['c at piston', sol.cp !== undefined ? `${sol.cp.toFixed(1)} m/s` : '—'],
                ['p/p₁ at piston', sol.pp_p1 !== undefined ? f3(sol.pp_p1) : '—'],
                ['T at piston', sol.Tp_T1 !== undefined ? `${(T1 * sol.Tp_T1).toFixed(1)} K` : '—'],
                ['fan head / tail', sol.head !== undefined ? `${sol.head.toFixed(0)} / ${sol.tail!.toFixed(0)} m/s` : '—'],
                ['escape speed 2c₁/(γ−1)', `${sol.uEsc.toFixed(0)} m/s = 5c₁`],
              ]
        }
      />
    </SimFrame>
  );
}

/* =====================================================================
 * 3. Shock tube: x–t diagram, time slices, reflected shock
 * ===================================================================== */

export function ShockTubeSim({ p41: p410 = 10, driver: d0 = 'air', driven: dd0 = 'air', T4: T40 = 300 }: { p41?: number; driver?: string; driven?: string; T4?: number }) {
  const [lp, setLp] = useState(Math.log10(p410));
  const [driver, setDriver] = useState(d0);
  const [driven, setDriven] = useState(dd0);
  const [T4, setT4] = useState(T40);
  const [T1, setT1] = useState(300);
  const [by, setBy] = useState<'p' | 'T'>('p');
  const [frac, setFrac, playing, setPlaying] = useClock(6, 0.55);
  const p41 = 10 ** lp;
  const L1 = 3;
  const w = useMemo(() => shockTubeWaves({ p4_p1: p41, driver: GASES[driver], driven: GASES[driven], T4, T1, L1 }), [p41, driver, driven, T4, T1]);
  const L4 = Math.min(Math.max(1.5, 1.02 * w.c4 * w.tMeet), 3 * L1);
  const tEnd = Math.min(w.tMeet, (0.98 * L4) / w.c4);
  const t = Math.max(1e-9, frac * tEnd);
  const ms = 1000;
  const prof = (x: number) => shockTubeProfile(w, x, t);
  const pMax = Math.max(w.p4_p1, w.p5_p1);
  const TMax = Math.max(w.T4, w.T5, w.T2, w.T1) / w.T1;
  const field = (x: number) => {
    const s = prof(x);
    return { M: Math.abs(s.u) / (w.c1 * Math.sqrt(s.T_T1)), p: s.p_p1 / pMax, T: s.T_T1 / TMax };
  };
  const xShock = t < w.tWall ? w.Vs * t : L1 - w.WR * (t - w.tWall);
  const fan = Array.from({ length: 6 }, (_, i) => w.headSpeed + ((w.tailSpeed - w.headSpeed) * i) / 5);
  const xR = (tt: number) => L1 - w.WR * (tt - w.tWall);
  const tailored = Math.abs(w.Z2_Z3 - 1) < 0.05;
  const gasOpts = Object.entries(GASES).map(([k, v]) => (
    <option key={k} value={k}>
      {v.name}
    </option>
  ));
  return (
    <SimFrame title="Shock tube" subtitle="diaphragm burst → shock, contact surface, expansion fan, reflected shock">
      <div className="controls">
        <Slider label="Diaphragm pressure ratio p₄/p₁" value={lp} min={0.1} max={3} step={0.01} onChange={setLp} format={(v) => (10 ** v).toPrecision(3)} />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
          Driver gas (4)
          <select style={selStyle} value={driver} onChange={(e) => setDriver(e.target.value)}>
            {gasOpts}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
          Driven gas (1)
          <select style={selStyle} value={driven} onChange={(e) => setDriven(e.target.value)}>
            {gasOpts}
          </select>
        </label>
        <Slider label="Driver temperature T₄" value={T4} min={200} max={1200} step={10} onChange={setT4} unit=" K" format={(v) => v.toFixed(0)} />
        <Slider label="Driven temperature T₁" value={T1} min={200} max={600} step={10} onChange={setT1} unit=" K" format={(v) => v.toFixed(0)} />
        <Slider label="Time" value={frac} min={0} max={1} step={0.001} onChange={setFrac} format={(v) => `${(v * tEnd * ms).toFixed(2)} ms`} />
        <div className="step-controls">
          <button className="btn primary" onClick={() => setPlaying(!playing)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button className="btn" onClick={() => setBy(by === 'p' ? 'T' : 'p')}>
            Colour by {by === 'p' ? 'T' : 'p'}
          </button>
        </div>
      </div>
      <FlowSection3D
        wall="duct"
        x0={-L4}
        x1={L1}
        profile={() => 0.05 * (L4 + L1)}
        field={field}
        colorBy={by}
        shocks={[xShock]}
        labels={[
          { x: w.headSpeed * t, text: 'fan head' },
          { x: w.u2 * t, text: 'contact', side: 'bottom' },
          { x: xShock, text: t < w.tWall ? `shock M_s = ${f3(w.Ms)}` : `reflected M_R = ${f3(w.MR)}` },
        ]}
        height={240}
      />
      <div className="twocol">
        <Plot
          x={[-L4, L1]}
          y={[0, tEnd * ms]}
          height={300}
          xLabel="x (m)"
          yLabel="t (ms)"
          legend={false}
          series={[
            ...fan.map((s, i) => ({ points: [{ x: 0, y: 0 }, { x: s * tEnd, y: tEnd * ms }], color: 'var(--c1)', width: i === 0 || i === 5 ? 2 : 1 })),
            { points: [{ x: 0, y: 0 }, { x: w.u2 * tEnd, y: tEnd * ms }], color: 'var(--muted)', dash: true, width: 2 },
            { points: [{ x: 0, y: 0 }, { x: L1, y: w.tWall * ms }], color: 'var(--c2)', width: 3 },
            ...(tEnd > w.tWall ? [{ points: [{ x: L1, y: w.tWall * ms }, { x: xR(tEnd), y: tEnd * ms }], color: 'var(--c4)', width: 3 }] : []),
          ]}
          hlines={[{ y: t * ms, color: 'var(--accent)', label: 'now' }]}
        >
          {(sx, sy) => (
            <g style={{ fontWeight: 700, fontSize: 14, fill: 'var(--text)' }}>
              <text x={sx(-0.8 * L4)} y={sy(0.3 * tEnd * ms)}>4</text>
              <text x={sx(0.5 * (w.tailSpeed + w.u2) * 0.85 * tEnd)} y={sy(0.85 * tEnd * ms)}>3</text>
              <text x={sx(0.5 * (w.u2 + w.Vs) * 0.6 * Math.min(w.tWall, tEnd))} y={sy(0.6 * Math.min(w.tWall, tEnd) * ms)}>2</text>
              <text x={sx(0.85 * L1)} y={sy(0.2 * w.tWall * ms)}>1</text>
              {tEnd > w.tWall && <text x={sx(0.97 * L1) - 6} y={sy(0.5 * (w.tWall + tEnd) * ms) + 14}>5</text>}
            </g>
          )}
        </Plot>
        <Plot
          x={[-L4, L1]}
          y={[0, pMax * 1.08]}
          height={300}
          xLabel="x (m)"
          yLabel="p / p₁"
          series={[{ points: sample((x) => prof(x).p_p1, -L4, L1, 500), color: 'var(--c2)', label: 'p/p₁' }]}
          vlines={[{ x: 0, label: 'diaphragm' }]}
        />
        <Plot
          x={[-L4, L1]}
          y={[0, Math.max(10, w.u2 * 1.15)]}
          height={250}
          xLabel="x (m)"
          yLabel="u (m/s)"
          series={[{ points: sample((x) => prof(x).u, -L4, L1, 500), color: 'var(--c1)', label: 'u' }]}
        />
        <Plot
          x={[-L4, L1]}
          y={[0, TMax * w.T1 * 1.08]}
          height={250}
          xLabel="x (m)"
          yLabel="T (K)"
          series={[{ points: sample((x) => prof(x).T_T1 * w.T1, -L4, L1, 500), color: 'var(--c4)', label: 'T' }]}
        />
      </div>
      <Readout
        items={[
          ['c₁ / c₄', `${w.c1.toFixed(0)} / ${w.c4.toFixed(0)} m/s`],
          ['p₂/p₁ = p₃/p₁', f3(w.p2_p1)],
          ['M_s, V_s', `${f3(w.Ms)}, ${w.Vs.toFixed(0)} m/s`],
          ['u₂ = u₃ (contact)', `${w.u2.toFixed(0)} m/s`],
          ['T₂ / T₃', `${w.T2.toFixed(0)} / ${w.T3.toFixed(0)} K`],
          ['p₃/p₄', f3(w.p3_p4)],
          ['M_R (reflected)', f3(w.MR)],
          ['p₅/p₁, T₅', `${f3(w.p5_p1)}, ${w.T5.toFixed(0)} K`],
          ['ρ₂c₂ / ρ₃c₃', `${f3(w.Z2_Z3)}${tailored ? ' (≈ tailored)' : ''}`],
        ]}
      />
    </SimFrame>
  );
}
