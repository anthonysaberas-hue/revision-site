/* Group B simulations — normal shocks, flow with shocks, pitot, inlets, wind tunnels (Ch. 7–9). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plot, sample } from '../../../core/Plot';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import * as ise from '../lib/isentropic';
import * as ns from '../lib/normalShock';
import * as un from '../lib/unsteady';
import * as inl from '../lib/inlet';
import { fmt, MachLegend, machColor } from './common';
import { FlowSection3D, FieldPoint } from '../viz/FlowSection3D';
import { GlowShock, StudioSvg } from '../figures/figsB';

const G = 1.4;
const lt = { fontSize: 12, fill: '#e8ecf5', fontWeight: 600 } as const;
const dt_ = { fontSize: 11, fill: '#9fb0d6' } as const;

/** requestAnimationFrame loop helper: calls cb(dtSeconds) while `on` is true. */
function useRaf(on: boolean, cb: (dt: number) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!on) return;
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const d = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(d);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [on]);
}

const btnRow = { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 };

/* =====================================================================
   1. Shock formation: accelerating piston, x–t diagram + p(x) snapshots
   ===================================================================== */

const SF_TMAX = 8;
const SF_N = 36;

interface WaveModel {
  tau: number[];
  x0: number[];
  S: number[];
  P: number[];
  absT: number[];
  shock: { x: number; t: number }[];
  tb: number;
  xp: (t: number) => number;
  pPiston: (t: number) => number;
  X: (i: number, t: number) => number;
}

/**
 * Simple-wave model of a piston ramped linearly from rest to speed V (units of c₀) over time Ta.
 * Each wave carries J⁻ from the quiescent gas, so c = c₀ + (γ−1)u/2 (lib: unsteady.expansionState with
 * u → −u), and travels at u + c. Where waves cross, the shock is tracked with the weak-shock rule:
 * shock speed = average of the wave speeds just ahead and just behind.
 */
function buildWaves(V: number, Ta: number, g = G): WaveModel {
  const u = (t: number) => V * Math.min(Math.max(t, 0) / Ta, 1);
  const xp = (t: number) => (t <= Ta ? (V * t * t) / (2 * Ta) : (V * Ta) / 2 + V * (t - Ta));
  const tau: number[] = [];
  const x0: number[] = [];
  const S: number[] = [];
  const P: number[] = [];
  for (let i = 0; i <= SF_N; i++) {
    const tt = (Ta * i) / SF_N;
    const ui = u(tt);
    const st = un.expansionState(-ui, 1, g);
    tau.push(tt);
    x0.push(xp(tt));
    S.push(ui + st.c_c4);
    P.push(st.p_p4);
  }
  const X = (i: number, t: number) => x0[i] + S[i] * (t - tau[i]);
  const pPiston = (t: number) => un.expansionState(-u(t), 1, g).p_p4;
  let tb = Infinity;
  let ib = -1;
  for (let i = 0; i < SF_N; i++) {
    const j = i + 1;
    if (S[j] <= S[i] + 1e-12) continue;
    const tc = (x0[j] - x0[i] + S[i] * tau[i] - S[j] * tau[j]) / (S[i] - S[j]);
    if (tc >= tau[j] && tc < tb) {
      tb = tc;
      ib = i;
    }
  }
  const absT = new Array(SF_N + 1).fill(Infinity);
  const shock: { x: number; t: number }[] = [];
  if (isFinite(tb) && tb < SF_TMAX) {
    let a = ib;
    let b = ib + 1;
    let t = tb;
    let xs = X(ib, tb);
    shock.push({ x: xs, t });
    const dt = SF_TMAX / 4000;
    let k = 0;
    while (t < SF_TMAX) {
      const sa = a >= 0 ? S[a] : 1;
      const sb = b <= SF_N ? S[b] : S[SF_N];
      xs += 0.5 * (sa + sb) * dt;
      t += dt;
      while (a >= 0 && X(a, t) <= xs) absT[a--] = t;
      while (b <= SF_N && tau[b] <= t && X(b, t) >= xs) absT[b++] = t;
      if (++k % 10 === 0) shock.push({ x: xs, t });
    }
  }
  return { tau, x0, S, P, absT, shock, tb, xp, pPiston, X };
}

function shockAt(m: WaveModel, t: number): number | undefined {
  if (!m.shock.length || t < m.tb) return undefined;
  const s = m.shock;
  for (let i = 1; i < s.length; i++) if (s[i].t >= t) return s[i - 1].x + ((s[i].x - s[i - 1].x) * (t - s[i - 1].t)) / (s[i].t - s[i - 1].t);
  return s[s.length - 1].x;
}

function waveProfile(m: WaveModel, t: number, xmax: number) {
  const pts: { x: number; y: number }[] = [{ x: m.xp(t), y: m.pPiston(t) }];
  const live: { x: number; y: number }[] = [];
  for (let i = SF_N; i >= 0; i--) if (m.tau[i] <= t && m.absT[i] > t) live.push({ x: m.X(i, t), y: m.P[i] });
  live.sort((p, q) => p.x - q.x);
  const xs = shockAt(m, t);
  if (xs === undefined) {
    pts.push(...live.filter((p) => p.x >= pts[0].x));
  } else {
    const behind = live.filter((p) => p.x < xs && p.x >= pts[0].x);
    const ahead = live.filter((p) => p.x > xs);
    pts.push(...behind);
    const pb = behind.length ? behind[behind.length - 1].y : pts[0].y;
    const pa = ahead.length ? ahead[0].y : 1;
    pts.push({ x: xs, y: pb }, { x: xs, y: pa }, ...ahead);
  }
  const last = pts[pts.length - 1];
  pts.push({ x: Math.max(last.x, xmax), y: 1 });
  return pts;
}

/** Piston-in-tube picture for the shock-formation sim (metal tube, pressure-coloured gas, glowing shock). */
function PistonTube({ m, t, xmin, xmax }: { m: WaveModel; t: number; xmin: number; xmax: number }) {
  const W = 720;
  const H = 120;
  const top = 30;
  const bot = 90;
  const X = (x: number) => 20 + ((x - xmin) / (xmax - xmin)) * (W - 40);
  const prof = waveProfile(m, t, xmax);
  const pMax = Math.max(1.0001, ...prof.map((p) => p.y));
  const pMin = Math.min(0.9999, ...prof.map((p) => p.y));
  const col = (p: number) => {
    if (p >= 1) {
      const f = Math.min(1, (p - 1) / Math.max(0.2, pMax - 1));
      return `hsl(${30 - 25 * f} 90% ${45 + 10 * f}%)`;
    }
    return `hsl(215 75% ${30 + 20 * Math.min(1, (1 - p) / Math.max(0.2, 1 - pMin))}%)`;
  };
  const strips = [];
  for (let i = 0; i < prof.length - 1; i++) {
    const a = X(prof[i].x);
    const b = X(prof[i + 1].x);
    if (b - a < 0.2) continue;
    strips.push(<rect key={i} x={a} y={top} width={b - a + 0.5} height={bot - top} fill={col(prof[i].y)} opacity={0.85} />);
  }
  const xs = shockAt(m, t);
  const xp = X(m.xp(t));
  return (
    <StudioSvg id="sfpt" w={W} h={H}>
      <rect x={20} y={top} width={W - 40} height={bot - top} fill={col(1)} opacity={0.35} />
      {strips}
      <rect x={10} y={top - 10} width={W - 20} height={10} fill="url(#sfpt-hatch)" />
      <rect x={10} y={bot} width={W - 20} height={10} fill="url(#sfpt-hatch)" />
      <rect x={Math.max(0, xp - 120)} y={(top + bot) / 2 - 5} width={Math.max(0, xp - 16 - Math.max(0, xp - 120))} height={10} fill="url(#sfpt-steel)" />
      <rect x={xp - 16} y={top + 1} width={16} height={bot - top - 2} fill="url(#sfpt-steelH)" stroke="#1d2129" />
      {xs !== undefined && <GlowShock id="sfpt" d={`M${X(xs)},${top} L${X(xs)},${bot}`} />}
      <text x={24} y={20} style={lt}>
        piston in a tube · colour = p/p₀ (warm = compressed, blue = expanded)
      </text>
      <text x={W - 170} y={H - 6} style={dt_}>
        t = {t.toFixed(2)} t_ref
      </text>
    </StudioSvg>
  );
}

export function ShockFormationSim({ initialMode = 'push', initialVp = 0.5, initialTa = 2 }: { initialMode?: 'push' | 'pull'; initialVp?: number; initialTa?: number }) {
  const [mode, setMode] = useState<'push' | 'pull'>(initialMode);
  const [Vp, setVp] = useState(initialVp);
  const [Ta, setTa] = useState(initialTa);
  const [t, setT] = useState(SF_TMAX * 0.75);
  const [playing, setPlaying] = useState(false);
  const V = mode === 'push' ? Vp : -Vp;
  const m = useMemo(() => buildWaves(V, Ta), [V, Ta]);
  useRaf(playing, (d) =>
    setT((old) => {
      const n = old + d * (SF_TMAX / 7);
      if (n >= SF_TMAX) {
        setPlaying(false);
        return SF_TMAX;
      }
      return n;
    }),
  );
  const xmin = Math.min(0, m.xp(SF_TMAX)) - 0.3;
  const xmax = Math.max(...m.S.map((_, i) => m.X(i, SF_TMAX)), SF_TMAX) + 0.5;
  const chars = m.tau.map((tau, i) => {
    const tEnd = Math.min(m.absT[i], SF_TMAX);
    return { points: [{ x: m.x0[i], y: tau }, { x: m.X(i, tEnd), y: tEnd }], color: 'var(--c1)', width: 1 };
  });
  const pistonPath = sample((tt) => m.xp(tt), 0, SF_TMAX, 120).map((p) => ({ x: p.y, y: p.x }));
  const xsNow = shockAt(m, t);
  const snaps = [0.25, 0.5, 0.75].map((f) => f * t);
  const prof = waveProfile(m, t, xmax);
  const Ms = mode === 'push' ? un.Ms_from_up(Vp) : NaN;
  const pRange: [number, number] = mode === 'push' ? [0.9, Math.max(1.2, m.P[SF_N] * 1.08)] : [Math.min(0.9, m.P[SF_N] * 0.9), 1.08];
  const tbAnalytic = mode === 'push' ? (2 * Ta) / ((G + 1) * Vp) : Infinity;
  return (
    <SimFrame title="How a shock is born" subtitle="an accelerating piston launches compression waves that catch up with each other">
      <div className="controls">
        <Slider label="Final piston speed |V_p| / c₀" value={Vp} min={0.05} max={1} step={0.01} onChange={setVp} />
        <Slider label="Acceleration time (t_ref)" value={Ta} min={0.3} max={4} step={0.05} onChange={setTa} />
        <Slider
          label="Time t (t_ref)"
          value={t}
          min={0}
          max={SF_TMAX}
          step={0.01}
          onChange={(v) => {
            setPlaying(false);
            setT(v);
          }}
        />
      </div>
      <div style={btnRow}>
        <button className={`btn ${mode === 'push' ? 'primary' : ''}`} onClick={() => setMode('push')}>
          Push piston in (compression)
        </button>
        <button className={`btn ${mode === 'pull' ? 'primary' : ''}`} onClick={() => setMode('pull')}>
          Pull piston out (rarefaction, PS5 P1)
        </button>
        <button
          className="btn"
          onClick={() => {
            setT(0);
            setPlaying(true);
          }}
        >
          ▶ Play from t = 0
        </button>
      </div>
      <div className="regime" style={mode === 'pull' ? { background: 'var(--good-soft)', color: 'var(--good)' } : undefined}>
        {mode === 'pull'
          ? 'Rarefaction: each new wave is slower (gas moves backward AND is colder), so the waves fan out. No expansion shock.'
          : xsNow !== undefined
            ? 'The waves have overtaken each other: a shock has formed and is swallowing the waves.'
            : 'Compression waves: each new wave is faster (gas already moving forward AND hotter). Watch them converge.'}
      </div>
      <PistonTube m={m} t={t} xmin={xmin} xmax={xmax} />
      <div className="twocol">
        <Plot
          x={[xmin, xmax]}
          y={[0, SF_TMAX]}
          height={320}
          xLabel="x / (c₀ t_ref)"
          yLabel="t / t_ref"
          series={[
            ...chars,
            { points: pistonPath, color: 'var(--text)', width: 3, label: 'piston path' },
            { points: m.shock.map((p) => ({ x: p.x, y: p.t })), color: 'var(--c2)', width: 3.5, label: 'shock' },
          ]}
          hlines={[{ y: t, color: 'var(--c4)', label: `t = ${t.toFixed(2)}` }]}
          dots={[{ x: m.xp(t), y: t, color: 'var(--text)', r: 4 }, ...(xsNow !== undefined ? [{ x: xsNow, y: t, color: 'var(--c2)', r: 5 }] : [])]}
        />
        <Plot
          x={[xmin, xmax]}
          y={pRange}
          height={320}
          xLabel="x / (c₀ t_ref)"
          yLabel="p / p₀"
          series={[
            ...snaps.map((s, i) => ({ points: waveProfile(m, s, xmax), color: 'var(--muted)', width: 1.2, dash: i % 2 === 0 })),
            { points: prof, color: 'var(--c2)', width: 3, label: 'p(x) now (grey: earlier times)' },
          ]}
          hlines={[{ y: 1, label: 'undisturbed p₀' }]}
        />
      </div>
      <Readout
        items={[
          ['wave speed, last / first', fmt(m.S[SF_N] / m.S[0], 3)],
          ['shock forms at t_b', isFinite(m.tb) && m.tb < SF_TMAX ? fmt(m.tb, 3) : 'not in window'],
          ['theory t_b = 2t_acc/((γ+1)V_p/c₀)', isFinite(tbAnalytic) ? fmt(tbAnalytic, 3) : '∞ (never)'],
          ['p at piston (isentropic)', fmt(m.P[SF_N], 4)],
          ['final shock Mach Mₛ', mode === 'push' ? fmt(Ms, 4) : '—'],
          ['final p₂/p₁ (A3)', mode === 'push' ? fmt(ns.py_px(Ms), 4) : '—'],
        ]}
      />
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
        Blue lines are the waves (slope = 1/speed: steeper means slower). Each moves at u + c in the lab. Behind a compression both u and c are larger,
        so later waves are flatter and cross the earlier ones. The shock (orange) moves at the average of the wave speeds on either side. Its final
        strength comes from the exact moving-shock relation in the readout.
      </p>
    </SimFrame>
  );
}

/* =====================================================================
   2. Moving shock: lab frame vs shock-fixed frame
   ===================================================================== */

export function MovingShockSim({ initialUp = 773.3, initialFrame = 'lab', c1 = 348 }: { initialUp?: number; initialFrame?: 'lab' | 'shock'; c1?: number }) {
  const [up, setUp] = useState(initialUp);
  const [frame, setFrame] = useState<'lab' | 'shock'>(initialFrame);
  const [time, setTime] = useState(1.5);
  const [playing, setPlaying] = useState(true);
  const s = useMemo(() => un.movingShock(un.Ms_from_up(up / c1), c1), [up, c1]);
  const My = ns.My(s.Ms);
  const Vy = s.Vs - s.up;
  const PERIOD = 5;
  useRaf(playing, (d) => setTime((t) => (t + d) % PERIOD));

  const W = 720;
  const top = 40;
  const bot = 120;
  const H = 230;
  const xStart = 60;
  const k = (0.8 * (W - xStart)) / (s.Vs * PERIOD);
  const shift = frame === 'lab' ? 0 : -k * s.Vs * time + (W * 0.55 - xStart);
  const xsLab = xStart + k * s.Vs * time;
  const xpLab = xStart + k * s.up * time;
  const toView = (x: number) => x + shift;
  const spacing = 22;
  const span = k * s.Vs * PERIOD + W;
  const particles: { x: number; y: number }[] = [];
  for (let x0 = xStart + 6; x0 < xStart + span; x0 += spacing) {
    let x = x0;
    if (x0 <= xsLab) x = x0 + k * s.up * (time - (x0 - xStart) / (k * s.Vs));
    for (const [y, off] of [
      [58, 0],
      [80, spacing / 2],
      [102, 0],
    ])
      particles.push({ x: toView(x) + off, y });
  }
  const xs = toView(xsLab);
  const xp = toView(xpLab);
  const Mahead = frame === 'lab' ? 0 : s.Ms;
  const Mbehind = frame === 'lab' ? s.M2lab : My;
  const vs = 0.1;
  const arrow = (x: number, y: number, v: number, label: string, color: string) => {
    const len = v * vs;
    return (
      <g>
        {Math.abs(len) > 2 ? <line x1={x} y1={y} x2={x + len} y2={y} stroke={color} strokeWidth={3} markerEnd="url(#msv-arr)" /> : <circle cx={x} cy={y} r={4} fill={color} />}
        <text x={len < 0 ? x + len - 8 : x + Math.max(len, 0) + 8} y={y + 4} textAnchor={len < 0 ? 'end' : 'start'} style={{ ...lt, fill: color }}>
          {label}
        </text>
      </g>
    );
  };
  const presets: [string, number][] = [
    ['Notes §8.4.1: Mₛ = 3', 773.3],
    ['Shinkansen 83.3 m/s', 83.3],
    ['Tolerable boom 45.8 m/s', 45.8],
    ['Strong 1500 m/s', 1500],
  ];
  return (
    <SimFrame title="Moving shock: change the frame, keep the physics" subtitle="the normal-shock table only works in the shock-fixed frame">
      <div className="controls">
        <Slider label="Piston (particle) speed V_p′" value={up} min={5} max={1600} step={0.1} onChange={setUp} unit=" m/s" format={(v) => v.toFixed(1)} />
      </div>
      <div style={btnRow}>
        <button className={`btn ${frame === 'lab' ? 'primary' : ''}`} onClick={() => setFrame('lab')}>
          Lab frame (ground)
        </button>
        <button className={`btn ${frame === 'shock' ? 'primary' : ''}`} onClick={() => setFrame('shock')}>
          Shock-fixed frame
        </button>
        <button className="btn" onClick={() => setPlaying(!playing)}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        {presets.map(([l, v]) => (
          <button key={l} className="btn" onClick={() => setUp(v)}>
            {l}
          </button>
        ))}
      </div>
      <StudioSvg id="msv" w={W} h={H}>
        <defs>
          <clipPath id="msvClip">
            <rect x={0} y={top} width={W} height={bot - top} />
          </clipPath>
        </defs>
        <g clipPath="url(#msvClip)">
          <rect x={0} y={top} width={W} height={bot - top} fill={machColor(Mahead)} opacity={0.5} />
          <rect x={xp} y={top} width={Math.max(0, xs - xp)} height={bot - top} fill={machColor(Mbehind)} opacity={0.8} />
          {particles.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="#ffffff" opacity={p.x < xp ? 0 : 0.85} />
          ))}
          <rect x={xp - 400} y={(top + bot) / 2 - 7} width={384} height={14} fill="url(#msv-steel)" />
          <rect x={xp - 18} y={top + 1} width={18} height={bot - top - 2} fill="url(#msv-steelH)" stroke="#1d2129" />
        </g>
        <GlowShock id="msv" d={`M${xs},${top} L${xs},${bot}`} />
        <rect x={0} y={top - 12} width={W} height={12} fill="url(#msv-hatch)" />
        <rect x={0} y={bot} width={W} height={12} fill="url(#msv-hatch)" />
        <text x={Math.min(Math.max(xp - 70, 4), W - 140)} y={top - 18} style={lt}>
          piston
        </text>
        <text x={Math.min(Math.max(xs + 6, 4), W - 140)} y={top - 18} style={lt}>
          shock
        </text>
        <text x={W - 230} y={bot + 28} style={dt_}>
          {frame === 'lab' ? 'gas ahead: at rest, M = 0' : `gas ahead: Mₓ = ${fmt(s.Ms, 3)}`}
        </text>
        <text x={12} y={bot + 28} style={dt_}>
          {frame === 'lab' ? `shocked gas: M′ = V_p′/c₂ = ${fmt(s.M2lab, 3)}` : `shocked gas: M_y = ${fmt(My, 3)}`}
        </text>
        {frame === 'lab' ? (
          <g>
            {arrow(20, H - 52, s.up, `gas behind: V_p′ = ${fmt(s.up, 4)} m/s`, '#ff8c52')}
            {arrow(20, H - 22, s.Vs, `shock: V_s′ = ${fmt(s.Vs, 4)} m/s`, '#fff6e8')}
            {arrow(560, H - 52, 0, 'gas ahead: V = 0', '#7c9cff')}
          </g>
        ) : (
          <g>
            {arrow(330, H - 52, -Vy, `V_y = V_s − V_p′ = ${fmt(Vy, 4)} m/s`, '#ff8c52')}
            {arrow(700, H - 22, -s.Vs, `Vₓ = V_s = ${fmt(s.Vs, 4)} m/s`, '#7c9cff')}
            {arrow(20, H - 22, 0, 'shock: at rest', '#fff6e8')}
          </g>
        )}
      </StudioSvg>
      <MachLegend />
      <Readout
        items={[
          ['shock Mach Mₛ = Mₓ', fmt(s.Ms)],
          ['shock speed V_s′', `${fmt(s.Vs)} m/s`],
          ['p₂/p₁ (A3)', fmt(s.p2_p1)],
          ['T₂/T₁ (A3)', fmt(s.T2_T1)],
          ['c₂ = c₁√(T₂/T₁)', `${fmt(s.c2)} m/s`],
          ['M_y (shock frame)', fmt(My)],
          ['V_y = V_s − V_p′', `${fmt(Vy)} m/s`],
          ['M′ = V_p′/c₂ (lab)', fmt(s.M2lab)],
        ]}
      />
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
        Pressures and temperatures are the same in both frames; only velocities (and so Mach numbers) change. In the shock frame the flow behind is always
        subsonic (M_y), but in the lab it can be supersonic: for Mₛ = 3 the shocked gas moves at M′ = 1.36. Piston formula: V_p′/c₁ = (2/(γ+1))(Mₛ² − 1)/Mₛ,
        with c₁ = {c1} m/s here.
      </p>
    </SimFrame>
  );
}

/* =====================================================================
   3. Pitot probe: subsonic vs supersonic
   ===================================================================== */

export function PitotSim({ initialM = 0.6 }: { initialM?: number }) {
  const [M, setM] = useState(initialM);
  const [phase, setPhase] = useState(0);
  useRaf(true, (d) => setPhase((p) => (p + d) % 100));
  const sup = M > 1;
  const iso = ise.p0_p(M);
  const reading = sup ? ns.p0y_px(M) : iso;
  const Mwrong = ise.M_from_p_p0(1 / reading);
  const err = (Mwrong - M) / M;
  const W = 640;
  const H = 210;
  const cy = 105;
  const R = 16;
  const xn = 330;
  const standoff = sup ? (0.78 * R * 2) / ns.rhoy_rhox(M) + 2 : 0;
  const xsh = xn - standoff;
  const cotMu = sup ? 1 / Math.tan(Math.asin(1 / M)) : 0;
  const Rc = 2.2 * R;
  const shockPts: string[] = [];
  if (sup) for (let y = -95; y <= 95; y += 5) shockPts.push(`${xsh + Math.sqrt(Rc * Rc + (y * cotMu) ** 2) - Rc},${cy + y}`);
  const My = sup ? ns.My(M) : M;
  const px = 45;
  // tracers: straight streaks that bend around the probe near the nose
  const dots = [];
  for (const dy of [-70, -45, -24, 24, 45, 70]) {
    for (let k = 0; k < 6; k++) {
      const x = ((phase * 60 * Math.max(0.3, Math.min(M, 2.5)) + k * 110 + (dy + 100) * 3) % (W + 40)) - 20;
      const bend = Math.abs(dy) < 30 && x > xn - 40 ? Math.sign(dy) * Math.min(10, (x - xn + 40) * 0.4) : 0;
      dots.push(<circle key={`${dy}-${k}`} cx={x} cy={cy + dy + bend} r={2.2} fill="#fff" opacity={0.75} />);
    }
  }
  return (
    <SimFrame title="Pitot probe" subtitle="subsonic: reads p₀. Supersonic: reads p₀ᵧ behind its own bow shock">
      <div className="controls">
        <Slider label="Free-stream Mach number" value={M} min={0.05} max={4} step={0.005} onChange={setM} format={(v) => v.toFixed(3)} />
      </div>
      <div style={btnRow}>
        <button className="btn" onClick={() => setM(0.6)}>
          subsonic M = 0.6
        </button>
        <button className="btn" onClick={() => setM(ns.Mx_from_p0y_px(445 / 45))}>
          PS5 P4: p_pitot/p = 445/45
        </button>
        <button className="btn" onClick={() => setM(2)}>
          M = 2
        </button>
      </div>
      <div className="regime" style={sup ? { background: 'var(--warn-soft)', color: 'var(--warn)' } : undefined}>
        {sup
          ? `Bow shock ahead of the probe: it reads p₀ᵧ, not p₀. Isentropic inversion would give M = ${fmt(Mwrong, 3)} (${(err * 100).toFixed(0)} % error).`
          : 'Subsonic: the probe brings the flow to rest isentropically and reads the true p₀.'}
      </div>
      <StudioSvg id="pts" w={W} h={H}>
        <rect x={0} y={0} width={W} height={H} fill={machColor(M)} opacity={0.4} />
        {sup && <path d={`M${shockPts.join(' L')} L${W},${cy + 95} L${W},${cy - 95} Z`} fill={machColor(My)} opacity={0.3} />}
        <circle cx={xn - 6} cy={cy} r={22} fill={machColor(0)} opacity={0.55} filter="url(#pts-glow)" />
        {dots}
        <path
          d={`M${xn},${cy} A${R},${R} 0 0 1 ${xn + R},${cy - R} L${W - 40},${cy - R} L${W - 40},${cy + R} L${xn + R},${cy + R} A${R},${R} 0 0 1 ${xn},${cy} Z`}
          fill="url(#pts-steel)"
          stroke="#1d2129"
        />
        <circle cx={xn + 3} cy={cy} r={3} fill="#ff8c52" />
        <rect x={xn + 110} y={cy - R - 3} width={8} height={3} fill="#7c9cff" />
        <text x={xn + 80} y={cy - R - 8} style={dt_}>
          static port ≈ p
        </text>
        <text x={xn + 20} y={cy + R + 16} style={dt_}>
          pitot port
        </text>
        {sup && <GlowShock id="pts" d={`M${shockPts.join(' L')}`} width={2.5} />}
        {sup && (
          <text x={Math.max(10, xsh - 160)} y={cy - 74} style={lt}>
            bow shock (normal on the axis)
          </text>
        )}
        <text x={14} y={22} style={lt}>
          M∞ = {fmt(M, 3)}, p = {px} kPa
        </text>
        <text x={W - 250} y={H - 12} style={lt}>
          pitot reads {fmt(reading * px, 4)} kPa {sup ? '= p₀ᵧ' : '= p₀'}
        </text>
      </StudioSvg>
      <div className="twocol">
        <Plot
          x={[0, 4]}
          y={[1, 200]}
          logY
          yTicks={[1, 2, 5, 10, 20, 50, 100, 200]}
          height={280}
          xLabel="free-stream Mach number"
          yLabel="p_pitot / p"
          series={[
            { points: sample((m) => ise.p0_p(m), 0.02, 1, 100), color: 'var(--c1)', width: 3, label: 'isentropic p₀/p (true reading, M < 1)' },
            { points: sample((m) => ise.p0_p(m), 1, 4, 100), color: 'var(--c1)', width: 1.5, dash: true, label: 'isentropic p₀/p (NOT what it reads)' },
            { points: sample((m) => ns.p0y_px(m), 1, 4, 150), color: 'var(--c2)', width: 3, label: 'Rayleigh pitot p₀ᵧ/pₓ (M > 1)' },
          ]}
          hlines={[{ y: reading, color: 'var(--c4)' }]}
          dots={[{ x: M, y: reading, color: 'var(--c2)', label: 'actual' }, ...(sup ? [{ x: Mwrong, y: reading, color: 'var(--c1)', label: 'wrong M' }] : [])]}
        />
        <Plot
          x={[1, 4]}
          y={[0, 0.6]}
          height={280}
          xLabel="true free-stream Mach number"
          yLabel="relative error in M"
          series={[{ points: sample((m) => (m - ise.M_from_p_p0(1 / ns.p0y_px(m))) / m, 1, 4, 160), color: 'var(--c2)', width: 3, label: 'error if you use p₀/p when supersonic' }]}
          dots={sup ? [{ x: M, y: -err, color: 'var(--c2)' }] : []}
        />
      </div>
      <Readout
        items={[
          ['true p₀/p', fmt(iso)],
          ['probe reads p_pitot/p', fmt(reading)],
          ['p₀ᵧ/p₀ₓ', sup ? fmt(ns.p0y_p0x(M)) : '1'],
          ['M from isentropic formula', fmt(Mwrong)],
          ['M from the right formula', fmt(M)],
          ['M_y on the stagnation line', sup ? fmt(My) : '—'],
        ]}
      />
    </SimFrame>
  );
}

/* =====================================================================
   4. Normal shock in a duct (3-D section) — Ch. 7 / PS5 P2
   ===================================================================== */

const GASES_B: [string, number, number][] = [
  ['Air', 28.9, 1.4],
  ['Argon', 40, 1.67],
  ['Fluorine F₂', 38, 1.4],
  ['CO₂', 44, 1.28],
];

export function ShockDuctSim({ initialMx = 2, initialGamma = 1.4 }: { initialMx?: number; initialGamma?: number }) {
  const [Mx, setMx] = useState(initialMx);
  const [g, setG] = useState(initialGamma);
  const [by, setBy] = useState<'M' | 'p' | 'T'>('M');
  const s = ns.normalShock(Mx, g);
  const pxr = ise.p_p0(Mx, g);
  const Txr = ise.T_T0(Mx, g);
  const field = (x: number): FieldPoint => (x < 0.8 ? { M: Mx, p: pxr, T: Txr } : { M: s.My, p: pxr * s.py_px, T: Txr * s.Ty_Tx });
  const setGas = (MW: number, gam: number) => {
    setG(gam);
    setMx(1000 / Math.sqrt(gam * (8314 / MW) * 300));
  };
  return (
    <SimFrame title="A normal shock in a duct" subtitle="colour by M, p or T: the jump is only a few mean free paths thick">
      <div className="controls">
        <Slider label="Upstream Mach Mₓ" value={Mx} min={1.01} max={5} step={0.001} onChange={setMx} format={(v) => v.toFixed(3)} />
        <Slider label="γ" value={g} min={1.1} max={1.67} step={0.01} onChange={setG} />
      </div>
      <div style={btnRow}>
        {(['M', 'p', 'T'] as const).map((k) => (
          <button key={k} className={`btn ${by === k ? 'primary' : ''}`} onClick={() => setBy(k)}>
            colour by {k === 'M' ? 'Mach' : k === 'p' ? 'p/p₀ₓ' : 'T/T₀'}
          </button>
        ))}
        {GASES_B.map(([n, MW, gam]) => (
          <button key={n} className="btn" onClick={() => setGas(MW, gam)}>
            {n}, 1000 m/s, 300 K
          </button>
        ))}
      </div>
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={1.6}
        pipeStart={0.8}
        profile={() => 0.16}
        field={field}
        colorBy={by}
        shocks={[0.8]}
        labels={[
          { x: 0.35, text: `x · M = ${fmt(Mx, 3)}` },
          { x: 0.8, text: 'normal shock', side: 'bottom' },
          { x: 1.25, text: `y · M = ${fmt(s.My, 3)}` },
        ]}
        height={260}
      />
      <Readout
        items={[
          ['M_y', fmt(s.My)],
          ['p_y/p_x', fmt(s.py_px)],
          ['T_y/T_x', fmt(s.Ty_Tx)],
          ['ρ_y/ρ_x = Vₓ/V_y', fmt(s.rhoy_rhox)],
          ['p₀ᵧ/p₀ₓ = A*ₓ/A*ᵧ', fmt(s.p0y_p0x)],
          ['Δs/R', fmt(ns.deltaS_R(Mx, g))],
          ['T_y if Tₓ = 300 K', `${fmt(300 * s.Ty_Tx)} K`],
          ['p₀ₓ/pₓ', fmt(ise.p0_p(Mx, g))],
        ]}
      />
    </SimFrame>
  );
}

/* =====================================================================
   5. Supersonic inlet starting: 3-D section + outside view + hysteresis map
   ===================================================================== */

/** Inlet area (fraction of A_in) along s ∈ [0,1]: lip at 0, throat at 0.45, diffuser exit at 1. */
function inletArea(s: number, r: number) {
  const st = 0.45;
  if (s <= st) return r + (1 - r) * 0.5 * (1 + Math.cos((Math.PI * Math.max(0, s)) / st));
  const q = Math.min(1, (s - st) / (1 - st));
  const Ae = Math.max(1.05, r * 1.3);
  return r + (Ae - r) * 0.5 * (1 - Math.cos(Math.PI * q));
}

type Pt = { M: number; r: number; started: boolean };

export function InletStartSim({ initialM = 1.5, initialRatio = 0.85, initialStarted = false }: { initialM?: number; initialRatio?: number; initialStarted?: boolean }) {
  const okStart = initialStarted && initialM > 1 && initialRatio >= 1 / ise.A_Astar(initialM);
  const [M, setM] = useState(initialM);
  const [ratio, setRatio] = useState(initialRatio); // A_throat / A_inlet
  const [started, setStarted] = useState(okStart);
  const [trail, setTrail] = useState<Pt[]>([]);
  const [sigma, setSigma] = useState(okStart ? 1 : 0); // 0 = shock outside, 1 = swallowed
  const [demo, setDemo] = useState<{ path: [number, number][]; t: number } | null>(null);
  const startedRef = useRef(okStart);

  const d = M > 1 ? 1 / ise.A_Astar(M) : 1;
  const kz = M > 1 ? inl.startingThroatRatio(M) : 1;

  useEffect(() => {
    let st = startedRef.current;
    if (M <= 1) st = false;
    else if (!st && ratio >= kz) st = true;
    else if (st && ratio < d) st = false;
    startedRef.current = st;
    setStarted(st);
    setTrail((tr) => {
      const last = tr[tr.length - 1];
      if (last && Math.abs(last.M - M) < 1e-4 && Math.abs(last.r - ratio) < 1e-4 && last.started === st) return tr;
      return [...tr.slice(-600), { M, r: ratio, started: st }];
    });
  }, [M, ratio, d, kz]);

  const target = started ? 1 : 0;
  useRaf(Math.abs(sigma - target) > 1e-3, (dt) =>
    setSigma((s0) => {
      const rate = target > s0 ? 1.4 : 3.5; // unstart is violent
      const n = s0 + Math.sign(target - s0) * rate * dt;
      return target > s0 ? Math.min(n, target) : Math.max(n, target);
    }),
  );

  useRaf(demo !== null, (dt) => {
    if (!demo) return;
    const nT = demo.t + dt * 0.35;
    const seg = Math.floor(nT);
    if (seg >= demo.path.length - 1) {
      const [m1, r1] = demo.path[demo.path.length - 1];
      setM(m1);
      setRatio(r1);
      setDemo(null);
      return;
    }
    const f = nT - seg;
    const [m0, r0] = demo.path[seg];
    const [m1, r1] = demo.path[seg + 1];
    setM(m0 + (m1 - m0) * f);
    setRatio(r0 + (r1 - r0) * f);
    setDemo({ ...demo, t: nT });
  });
  const reset = (m: number, r: number) => {
    startedRef.current = false;
    setStarted(false);
    setSigma(0);
    setTrail([]);
    setM(m);
    setRatio(r);
  };
  const runDemo = (path: [number, number][]) => {
    reset(path[0][0], path[0][1]);
    setDemo({ path, t: 0 });
  };
  const preset = (m: number, r: number) => {
    setDemo(null);
    reset(m, r);
  };

  // ------ physics (lib) ------
  const AinAt = 1 / ratio;
  const Mdesign = ise.M_from_A_Astar(Math.max(1, AinAt), 'sup');
  const canStart = AinAt < ise.A_Astar(Math.sqrt((G - 1) / (2 * G))) - 1e-6;
  const Mstart = canStart ? inl.startingMach(AinAt) : Infinity;
  const r0 = M > 1 ? ns.p0y_p0x(M) : 1;
  const capture = M > 1 ? Math.min(1, r0 * ratio * ise.A_Astar(M)) : 1;
  const Mt = M > 1 && ratio >= d ? ise.M_from_A_Astar(Math.max(1, ratio * ise.A_Astar(M)), 'sup') : 1;
  const recovery = started ? ns.p0y_p0x(Math.max(1, Mt)) : r0;

  // ------ flow field along the inlet ------
  const L = 1.4;
  const AxStar = M > 1 ? 1 / ise.A_Astar(M) : ratio;
  const sInside = 0.58;
  const shockS = -0.35 + (sInside + 0.35) * sigma; // < 0: outside the lip
  const inside = shockS > 0.005;
  const sub = (A: number, Astar: number) => ise.M_from_A_Astar(Math.max(1, A / Astar), 'sub');
  const machAt = (s: number): { M: number; p: number } => {
    const A = inletArea(s, ratio);
    if (M <= 1) {
      const m = sub(A, Math.max(ratio, 1 / ise.A_Astar(Math.max(M, 0.02))));
      return { M: m, p: ise.p_p0(m) };
    }
    if (!inside) {
      const m = sub(A, ratio); // choked throat, p0 = p0y
      return { M: m, p: r0 * ise.p_p0(m) };
    }
    if (s < shockS) {
      const m = ise.M_from_A_Astar(Math.max(1, A / AxStar), 'sup');
      return { M: m, p: ise.p_p0(m) };
    }
    const Mx = ise.M_from_A_Astar(Math.max(1, inletArea(shockS, ratio) / AxStar), 'sup');
    const r = ns.p0y_p0x(Math.max(1, Mx));
    const m = sub(A, AxStar / r);
    return { M: m, p: r * ise.p_p0(m) };
  };
  const field = (x: number): FieldPoint => {
    const f = machAt(x / L);
    return { M: f.M, p: f.p, T: ise.T_T0(f.M) };
  };
  const shock3D = M > 1 ? [inside ? shockS * L : 0.004] : [];
  const stateTxt =
    M <= 1
      ? 'Subsonic flight: no shock yet'
      : started
        ? 'STARTED: supersonic into the inlet, the shock is held just past the throat'
        : 'UNSTARTED: the normal shock stands outside the lip and the excess flow spills around the cowl';

  // ------ outside view (SVG) ------
  const W = 460;
  const H = 240;
  const cy = 120;
  const Hs = 62;
  const X0 = 220;
  const X1 = 450;
  const sx = (s: number) => X0 + s * (X1 - X0);
  const n = 60;
  const standoff = 16 + 110 * (1 - capture);
  const frac = Math.min(1, Math.max(0, -shockS / 0.35));
  const xOut = X0 - 2 - standoff * frac;
  const cotMu = M > 1 ? 1 / Math.tan(Math.asin(1 / M)) : 0;
  const bowPts: string[] = [];
  if (M > 1 && !inside) for (let y = -110; y <= 110; y += 6) bowPts.push(`${xOut + Math.sqrt(900 + (y * cotMu * 0.8) ** 2) - 30},${cy + y}`);
  const hc = Hs * (M > 1 && !inside ? capture : 1);
  const strips = [];
  for (let i = 0; i < n; i++) {
    const a = inletArea(i / n, ratio) * Hs;
    const b = inletArea((i + 1) / n, ratio) * Hs;
    strips.push(
      <polygon key={i} points={`${sx(i / n)},${cy - a} ${sx((i + 1) / n) + 0.6},${cy - b} ${sx((i + 1) / n) + 0.6},${cy + b} ${sx(i / n)},${cy + a}`} fill={machColor(machAt(i / n).M)} />,
    );
  }
  const wall = (sgn: number) => {
    const inner = Array.from({ length: n + 1 }, (_, i) => `${sx(i / n)},${cy + sgn * inletArea(i / n, ratio) * Hs}`);
    return `${X0},${cy + sgn * Hs} ${X1},${cy + sgn * (Hs + 24)} ${inner.reverse().join(' ')}`;
  };

  // ------ map ------
  const curves = useMemo(() => inl.inletCurves(4, 200), []);
  const trailSegs: { points: { x: number; y: number }[]; color: string; width: number }[] = [];
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    trailSegs.push({ points: [{ x: Math.max(1, a.M), y: a.r }, { x: Math.max(1, b.M), y: b.r }], color: b.started ? 'var(--c3)' : 'var(--c2)', width: 2.5 });
  }
  return (
    <SimFrame title="Starting a supersonic inlet" subtitle="overspeed or open the throat to swallow the shock, and watch the hysteresis">
      <div className="controls">
        <Slider
          label="Flight Mach number M∞"
          value={M}
          min={0.8}
          max={4}
          step={0.005}
          onChange={(v) => {
            setDemo(null);
            setM(v);
          }}
          format={(v) => v.toFixed(3)}
        />
        <Slider
          label="Throat / inlet area A_t / A_in"
          value={ratio}
          min={0.3}
          max={1}
          step={0.001}
          onChange={(v) => {
            setDemo(null);
            setRatio(v);
          }}
          format={(v) => `${v.toFixed(3)} (A_in/A_t = ${(1 / v).toFixed(3)})`}
        />
      </div>
      <div style={btnRow}>
        <button className="btn primary" onClick={() => runDemo([[0.9, 0.85], [1.5, 0.85], [1.9, 0.85], [1.5, 0.85], [1.4, 0.85], [1.6, 0.85]])}>
          ▶ Fixed inlet (design M 1.5): overspeed, slow, unstart
        </button>
        <button className="btn primary" onClick={() => runDemo([[1.5, 0.85], [1.5, 0.94], [1.5, 0.85], [1.5, 0.82]])}>
          ▶ Variable throat at M 1.5
        </button>
        <button className="btn primary" onClick={() => runDemo([[1.0, 0.3793], [4, 0.3793]])}>
          ▶ Design M 2.5, fixed: never starts
        </button>
        <button className="btn" onClick={() => preset(1.3, 1 / ise.A_Astar(1.3))}>
          Q2 W2023 (design 1.3)
        </button>
        <button className="btn" onClick={() => preset(1.4, 1 / ise.A_Astar(1.4))}>
          Final B (design 1.4)
        </button>
        <button className="btn" onClick={() => preset(1.75, inl.startingThroatRatio(1.75))}>
          PS6 P2 (start at 1.75)
        </button>
        <button className="btn" onClick={() => setTrail([])}>
          clear path
        </button>
      </div>
      <div className="regime" style={started ? { background: 'var(--good-soft)', color: 'var(--good)' } : M > 1 ? { background: 'var(--warn-soft)', color: 'var(--warn)' } : undefined}>
        {stateTxt}
      </div>
      <FlowSection3D
        wall="plain"
        x0={0}
        x1={L}
        profile={(x) => 0.17 * Math.sqrt(inletArea(x / L, ratio))}
        field={field}
        shocks={shock3D}
        labels={[
          { x: 0.02, text: inside || M <= 1 ? 'lip · A_in' : 'shock expelled ahead of the lip' },
          { x: 0.45 * L, text: `throat · M = ${fmt(machAt(0.45).M, 3)}`, side: 'bottom' },
          ...(inside ? [{ x: shockS * L, text: 'swallowed shock' }] : []),
        ]}
        height={260}
      />
      <div className="twocol">
        <StudioSvg id="ins" w={W} h={H}>
          <rect x={0} y={0} width={W} height={H} fill={machColor(M)} opacity={0.35} />
          {bowPts.length > 0 && <path d={`M${bowPts.join(' L')} L${X0},${cy + 110} L${X0},${cy - 110} Z`} fill={machColor(M > 1 ? ns.My(M) : M)} opacity={0.4} />}
          {strips}
          <polygon points={wall(-1)} fill="url(#ins-steel)" stroke="#1d2129" />
          <polygon points={wall(1)} fill="url(#ins-steel)" stroke="#1d2129" />
          {[-1, 1].map((sg) => (
            <path
              key={sg}
              d={`M8,${cy + sg * hc} L${bowPts.length ? xOut : X0 - 8},${cy + sg * hc} Q${X0 - 6},${cy + sg * hc} ${X0},${cy + sg * (Hs - 2)}`}
              fill="none"
              stroke="#e8ecf5"
              strokeDasharray="5 4"
              strokeWidth={1.3}
            />
          ))}
          {bowPts.length > 0 &&
            [-1, 1].map((sg) => (
              <path
                key={`sp${sg}`}
                d={`M8,${cy + sg * (hc + 0.5 * (Hs - hc) + 4)} L${xOut},${cy + sg * (hc + 0.5 * (Hs - hc) + 4)} Q${X0 - 8},${cy + sg * (Hs + 4)} ${X0 + 50},${cy + sg * (Hs + 16)} L${X1},${cy + sg * (Hs + 34)}`}
                fill="none"
                stroke="#ff8c52"
                strokeWidth={1.8}
                markerEnd="url(#ins-arr)"
              />
            ))}
          {bowPts.length > 0 && <GlowShock id="ins" d={`M${bowPts.join(' L')}`} />}
          {inside && <GlowShock id="ins" d={`M${sx(shockS)},${cy - inletArea(shockS, ratio) * Hs + 1} L${sx(shockS)},${cy + inletArea(shockS, ratio) * Hs - 1}`} />}
          <text x={10} y={18} style={lt}>
            outside view · M∞ = {fmt(M, 3)}
          </text>
          {bowPts.length > 0 && (
            <text x={10} y={H - 8} style={{ ...lt, fill: '#ff8c52' }}>
              spillage: captured ṁ / full = {fmt(capture, 3)}
            </text>
          )}
        </StudioSvg>
        <Plot
          x={[1, 4]}
          y={[0, 1]}
          height={300}
          xLabel="flight Mach number M∞"
          yLabel="A_throat / A_inlet"
          series={[
            { points: curves.map((c) => ({ x: c.M, y: c.design })), color: 'var(--c1)', width: 2.5, label: 'isentropic design (A2): below → must unstart' },
            { points: curves.map((c) => ({ x: c.M, y: c.kantrowitz })), color: 'var(--c3)', width: 2.5, label: 'Kantrowitz limit: above → starts' },
            ...trailSegs,
          ]}
          hlines={[{ y: 1 / 1.6661, label: 'asymptote 0.600 (design M 1.98)' }]}
          dots={[{ x: Math.max(1, M), y: ratio, color: started ? 'var(--c3)' : 'var(--c2)', r: 6, label: started ? 'started' : 'unstarted' }]}
        >
          {(X, Y) => (
            <g>
              <polygon points={[...curves.map((c) => `${X(c.M)},${Y(c.kantrowitz)}`), ...curves.map((c) => `${X(c.M)},${Y(c.design)}`).reverse()].join(' ')} fill="var(--c4)" opacity={0.1} />
              <text x={X(2.5)} y={Y(0.5)} style={{ fontSize: 11, fill: 'var(--c4)' }}>
                hysteresis: either state
              </text>
            </g>
          )}
        </Plot>
      </div>
      <MachLegend />
      <Readout
        items={[
          ['A_in/A_t', fmt(AinAt)],
          ['isentropic (design) M of this geometry', fmt(Mdesign)],
          ['starts by overspeed at M (Kantrowitz)', canStart ? fmt(Mstart) : 'never (A_in/A_t > 1.666)'],
          ['A_t/A_in to start at this M', M > 1 ? fmt(kz) : '—'],
          ['A_t/A_in isentropic at this M', M > 1 ? fmt(d) : '—'],
          ['throat opening p₀ₓ/p₀ᵧ', M > 1 ? fmt(inl.throatOpeningFactor(M)) : '—'],
          ['ṁ / ṁ_full capture', fmt(started ? 1 : capture)],
          ['p₀ recovery', fmt(recovery)],
        ]}
      />
      <p style={{ fontSize: '0.86rem', color: 'var(--muted)' }}>
        Map: orange path = unstarted, green = started. Between the blue and green curves the state depends on history. Unstarted with a choked throat:
        ṁ/ṁ_full = (p₀ᵧ/p₀ₓ)(A_t/A*ₓ). For a design-sized throat this is just p₀ᵧ/p₀ₓ (W2023: 0.979, Final B: 0.958). The started p₀ recovery assumes the
        shock is held at the throat.
      </p>
    </SimFrame>
  );
}

/* =====================================================================
   6. Two-throat supersonic wind tunnel (3-D section)
   ===================================================================== */

export function WindTunnelStartSim({ initialMtest = 2.5, initialAt2 = 1.6, initialProgress = 0.3 }: { initialMtest?: number; initialAt2?: number; initialProgress?: number }) {
  const [Mt, setMt] = useState(initialMtest);
  const [At2, setAt2] = useState(initialAt2);
  const [lam, setLam] = useState(initialProgress);
  const Ats = ise.A_Astar(Mt);
  const a2 = Math.max(1.0001, Math.min(At2, Ats * 0.97));
  const need = inl.secondThroatRatio(Mt);
  const A = (x: number) => {
    if (x <= 0.35) return 1 + 1.5 * 0.5 * (1 + Math.cos((Math.PI * Math.max(0, x)) / 0.35));
    if (x <= 1.0) return 1 + (Ats - 1) * 0.5 * (1 - Math.cos((Math.PI * (x - 0.35)) / 0.65));
    if (x <= 1.8) return Ats;
    if (x <= 2.3) return a2 + (Ats - a2) * 0.5 * (1 + Math.cos((Math.PI * (x - 1.8)) / 0.5));
    return a2 + (Ats - a2) * 0.5 * (1 - Math.cos(Math.PI * Math.min(1, (x - 2.3) / 0.7)));
  };
  const blocked = a2 < need;
  const Mblock = blocked ? ns.Mx_from_p0y_p0x(1 / a2) : 1;
  const Ablock = ise.A_Astar(Mblock);
  let xBlock = 0.35;
  if (blocked) for (let x = 0.35; x <= 1.0; x += 0.001) if (A(x) <= Ablock) xBlock = x;
  let regime: 'subsonic' | 'moving' | 'blocked' | 'started';
  let xs1 = -1;
  let xs2 = -1;
  const xMove = 0.35 + ((lam - 0.05) / 0.55) * 0.65;
  if (lam < 0.05) regime = 'subsonic';
  else if (blocked && (lam >= 0.6 || xMove >= xBlock)) {
    regime = 'blocked';
    xs1 = xBlock;
    xs2 = 2.33 + Math.max(0, (lam - 0.05) / 0.95) * 0.6;
  } else if (lam < 0.6) {
    regime = 'moving';
    xs1 = xMove;
  } else {
    regime = 'started';
    xs2 = 2.33 + ((lam - 0.6) / 0.4) * 0.6;
  }
  const field = (x: number): FieldPoint => {
    const a = A(x);
    const mk = (M: number, p0: number) => ({ M, p: p0 * ise.p_p0(M), T: ise.T_T0(M) });
    const supM = (v: number) => ise.M_from_A_Astar(Math.max(1, v), 'sup');
    const subM = (v: number) => ise.M_from_A_Astar(Math.max(1, v), 'sub');
    if (regime === 'subsonic' || x <= 0.35) return mk(subM(a), 1);
    if (regime === 'moving') {
      if (x < xs1) return mk(supM(a), 1);
      const r = ns.p0y_p0x(supM(A(xs1)));
      return mk(subM(a * r), r);
    }
    if (regime === 'blocked') {
      if (x < xs1) return mk(supM(a), 1);
      const r = 1 / a2; // A*y = A_t2
      if (x <= 2.3) return mk(subM(a / a2), r);
      if (x < xs2) return mk(supM(a / a2), r);
      const r2 = ns.p0y_p0x(supM(A(xs2) / a2));
      return mk(subM((a / a2) * r2), r * r2);
    }
    if (x < xs2) return mk(supM(a), 1);
    const r = ns.p0y_p0x(supM(A(xs2)));
    return mk(subM(a * r), r);
  };
  const k = 0.3 / Math.sqrt(Math.max(Ats, 2.5));
  const pts = Array.from({ length: 301 }, (_, i) => {
    const x = (3 * i) / 300;
    return { x, ...field(x) };
  });
  const msg = {
    subsonic: 'Back pressure barely lowered: choked at the first throat, subsonic everywhere else.',
    moving: 'Shock in the nozzle, marching toward the test section as p_b drops. The second throat still passes the post-shock flow.',
    blocked: `BLOCKED: the second throat is too small (needs A_t2/A_t1 ≥ ${need.toFixed(3)}). It chokes on the post-shock flow and the first shock is stuck at Mₓ = ${Mblock.toFixed(3)}. Lowering p_b only moves a second shock in the diffuser.`,
    started: 'STARTED: the shock snapped through the test section (now supersonic at M_test) and sits past the second throat.',
  }[regime];
  return (
    <SimFrame title="Starting a two-throat supersonic wind tunnel" subtitle="the second throat must swallow the post-shock sonic area A*ᵧ">
      <div className="controls">
        <Slider label="Test-section Mach M_test" value={Mt} min={1.3} max={4.5} step={0.01} onChange={setMt} />
        <Slider label="Second / first throat A_t2 / A_t1" value={At2} min={1} max={12} step={0.01} onChange={setAt2} />
        <Slider label="Lower the back pressure →" value={lam} min={0} max={1} step={0.002} onChange={setLam} />
      </div>
      <div style={btnRow}>
        <button
          className="btn"
          onClick={() => {
            setMt(4);
            setAt2(7.3);
            setLam(0.75);
          }}
        >
          PS6 P1: M 4, A_t2/A_t1 = 7.3 (starts)
        </button>
        <button
          className="btn"
          onClick={() => {
            setMt(4);
            setAt2(6);
            setLam(0.75);
          }}
        >
          M 4, A_t2/A_t1 = 6 (blocked)
        </button>
      </div>
      <div
        className="regime"
        style={regime === 'started' ? { background: 'var(--good-soft)', color: 'var(--good)' } : regime === 'blocked' ? { background: 'var(--bad-soft)', color: 'var(--bad)' } : undefined}
      >
        {msg}
      </div>
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={3}
        pipeStart={1}
        profile={(x) => k * Math.sqrt(A(x))}
        field={field}
        shocks={[xs1, xs2].filter((x) => x > 0)}
        labels={[
          { x: 0.35, text: 'A_t1 · M = 1' },
          { x: 1.4, text: `test section · M = ${fmt(field(1.4).M, 3)}`, side: 'bottom' },
          { x: 2.3, text: `A_t2 · M = ${fmt(field(2.3).M, 3)}` },
        ]}
        height={280}
      />
      <Plot
        x={[0, 3]}
        y={[0, 1.02]}
        height={230}
        xLabel="position along the tunnel"
        yLabel="p / p₀"
        series={[
          { points: pts.map((p) => ({ x: p.x, y: p.p })), color: 'var(--c1)', width: 3, label: 'p/p₀' },
          { points: pts.map((p) => ({ x: p.x, y: Math.min(1, p.M / 4.5) })), color: 'var(--c2)', width: 1.8, dash: true, label: 'M / 4.5' },
        ]}
        vlines={[{ x: 0.35, label: 't1' }, { x: 1, label: 'test' }, { x: 2.3, label: 't2' }]}
      />
      <Readout
        items={[
          ['A_test/A_t1 (A2)', fmt(Ats)],
          ['p₀ᵧ/p₀ₓ at M_test (A3)', fmt(ns.p0y_p0x(Mt))],
          ['min A_t2/A_t1 = A*ᵧ/A*ₓ', fmt(need)],
          ['actual A_t2/A_t1', fmt(a2)],
          ['state', regime],
        ]}
      />
    </SimFrame>
  );
}
