/* Group B figures — normal shocks, flow with shocks, pitot, inlets, wind tunnels (Ch. 7–9, PS5–PS6). */
import { ReactNode } from 'react';
import { Figure } from '../../../core/ui';
import { Plot, sample } from '../../../core/Plot';
import * as ise from '../lib/isentropic';
import * as ns from '../lib/normalShock';
import { nozzleProfile, solveNozzle } from '../lib/nozzle';
import { machColor } from '../sims/common';

/* ---------------- shared "studio" SVG kit (dark panel, metal, glowing shocks) ---------------- */

const STUDIO_BG = '#070a12';
const lightTxt = { fontSize: 12, fill: '#e8ecf5', fontWeight: 600 } as const;
const dimTxt = { fontSize: 11, fill: '#9fb0d6' } as const;

/** Gradients, hatch pattern and glow filter shared by the realistic SVG drawings. `id` keeps ids unique per SVG. */
export function MetalDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a515b" />
        <stop offset="0.3" stopColor="#c9d0d8" />
        <stop offset="0.48" stopColor="#f4f6f8" />
        <stop offset="0.7" stopColor="#9aa3ae" />
        <stop offset="1" stopColor="#3d434c" />
      </linearGradient>
      <linearGradient id={`${id}-steelH`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#4a515b" />
        <stop offset="0.35" stopColor="#d5dbe2" />
        <stop offset="0.55" stopColor="#f4f6f8" />
        <stop offset="1" stopColor="#5b636e" />
      </linearGradient>
      <linearGradient id={`${id}-dark`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a3039" />
        <stop offset="0.5" stopColor="#59616d" />
        <stop offset="1" stopColor="#22272f" />
      </linearGradient>
      <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#aab3bf" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="#6b737e" strokeWidth="1.6" />
      </pattern>
      <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <radialGradient id={`${id}-bg`} cx="0.5" cy="0.45" r="0.7">
        <stop offset="0" stopColor="#15244d" />
        <stop offset="1" stopColor={STUDIO_BG} />
      </radialGradient>
      <marker id={`${id}-arr`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#e8ecf5" />
      </marker>
    </defs>
  );
}

/** A glowing shock sheet between two points (or a polyline). */
export function GlowShock({ id, d, width = 3 }: { id: string; d: string; width?: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke="#ffd9a0" strokeWidth={width * 4} opacity={0.55} filter={`url(#${id}-glow)`} />
      <path d={d} fill="none" stroke="#fff6e8" strokeWidth={width} strokeLinecap="round" />
    </g>
  );
}

/** Dark studio panel wrapper. */
export function StudioSvg({ id, w, h, children }: { id: string; w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 10, background: STUDIO_BG }}>
      <MetalDefs id={id} />
      <rect x={0} y={0} width={w} height={h} fill={`url(#${id}-bg)`} />
      {children}
    </svg>
  );
}

/** Horizontal duct walls (metal with hatched cut faces) between x0 and x1; inner half-height as a function of x. */
function DuctWalls({ id, x0, x1, cy, h, t = 14, n = 80 }: { id: string; x0: number; x1: number; cy: number; h: (x: number) => number; t?: number; n?: number }) {
  const xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
  const topIn = xs.map((x) => `${x},${cy - h(x)}`);
  const topOut = xs.map((x) => `${x},${cy - h(x) - t}`).reverse();
  const botIn = xs.map((x) => `${x},${cy + h(x)}`);
  const botOut = xs.map((x) => `${x},${cy + h(x) + t}`).reverse();
  return (
    <g>
      <polygon points={[...topIn, ...topOut].join(' ')} fill={`url(#${id}-hatch)`} stroke="#1d2129" strokeWidth={1} />
      <polygon points={[...botIn, ...botOut].join(' ')} fill={`url(#${id}-hatch)`} stroke="#1d2129" strokeWidth={1} />
      <polyline points={topIn.join(' ')} fill="none" stroke="#eef2f6" strokeWidth={1.4} />
      <polyline points={botIn.join(' ')} fill="none" stroke="#eef2f6" strokeWidth={1.4} />
    </g>
  );
}

/** Flow inside a duct painted by Mach number in thin strips. */
function DuctFlow({ x0, x1, cy, h, M, n = 120 }: { x0: number; x1: number; cy: number; h: (x: number) => number; M: (x: number) => number; n?: number }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n;
    const b = x0 + ((x1 - x0) * (i + 1)) / n;
    out.push(<polygon key={i} points={`${a},${cy - h(a)} ${b + 0.6},${cy - h(b)} ${b + 0.6},${cy + h(b)} ${a},${cy + h(a)}`} fill={machColor(M(a))} opacity={0.92} />);
  }
  return <g>{out}</g>;
}

/* =====================================================================
   Chapter 7 figures
   ===================================================================== */

/** Thin control volume around a stationary normal shock, x → y. */
export function ShockCVFigure({ Mx = 2 }: { Mx?: number }) {
  const id = 'fbcv';
  const s = ns.normalShock(Mx);
  const W = 620;
  const H = 210;
  const cy = 105;
  const h = () => 60;
  return (
    <Figure caption={`Stationary normal shock (Mₓ = ${Mx}). The control volume hugs the shock, so Aₓ = Aᵧ, no wall force, no heat, and it is steady even if the shock is moving slowly. Only the integral laws apply: properties jump.`}>
      <StudioSvg id={id} w={W} h={H}>
        <DuctFlow x0={20} x1={W - 20} cy={cy} h={h} M={(x) => (x < W / 2 ? Mx : s.My)} />
        <DuctWalls id={id} x0={20} x1={W - 20} cy={cy} h={h} />
        <rect x={W / 2 - 40} y={cy - 70} width={80} height={140} fill="none" stroke="#9fc1ff" strokeDasharray="6 5" strokeWidth={2} />
        <GlowShock id={id} d={`M${W / 2},${cy - 60} L${W / 2},${cy + 60}`} />
        {[-30, 0, 30].map((dy) => (
          <g key={dy}>
            <line x1={60} x2={60 + 36 * Mx} y1={cy + dy} y2={cy + dy} stroke="#e8ecf5" strokeWidth={2} markerEnd={`url(#${id}-arr)`} />
            <line x1={W / 2 + 60} x2={W / 2 + 60 + 36 * s.My * 1.4} y1={cy + dy} y2={cy + dy} stroke="#e8ecf5" strokeWidth={2} markerEnd={`url(#${id}-arr)`} />
          </g>
        ))}
        <text x={30} y={24} style={lightTxt}>x (upstream): Mₓ = {Mx}, pₓ, ρₓ, Tₓ, Vₓ</text>
        <text x={W / 2 + 20} y={24} style={lightTxt}>y (downstream): M_y = {s.My.toFixed(3)}</text>
        <text x={W / 2 - 38} y={cy + 88} style={dimTxt}>control volume</text>
        <text x={30} y={H - 8} style={dimTxt}>ρₓVₓ = ρᵧVᵧ · pₓ + ρₓVₓ² = pᵧ + ρᵧVᵧ² · hₓ + Vₓ²/2 = hᵧ + Vᵧ²/2</text>
      </StudioSvg>
    </Figure>
  );
}

/** Entropy change across a "shock" for Mₓ on both sides of 1: the subsonic branch would destroy entropy. */
export function EntropyJumpFigure() {
  const f = (M: number) => ns.deltaS_R(M) / 3.5; // Δs/cp = (Δs/R)(γ−1)/γ
  return (
    <Figure caption="Δs/c_p across a normal 'shock' from the notes' plot: positive for Mₓ > 1, negative for Mₓ < 1. An expansion (subsonic) shock would reduce entropy in an adiabatic process, which the second law forbids.">
      <Plot
        x={[0.5, 2.5]}
        y={[-0.2, 0.2]}
        height={260}
        xLabel="Mₓ"
        yLabel="(s_y − s_x)/c_p"
        series={[
          { points: sample(f, 0.5, 1, 100), color: 'var(--c5)', width: 3, dash: true, label: 'subsonic "expansion shock": Δs < 0, impossible' },
          { points: sample(f, 1, 2.5, 100), color: 'var(--c3)', width: 3, label: 'compression shock: Δs > 0' },
        ]}
        bands={[{ x0: 0.5, x1: 1, color: 'var(--c5)', opacity: 0.08, label: 'forbidden' }]}
        hlines={[{ y: 0, dash: false }]}
        vlines={[{ x: 1, label: 'Mₓ = 1' }]}
      />
    </Figure>
  );
}

/* =====================================================================
   Chapter 8 figures
   ===================================================================== */

/** The notes' 1 → 2 → 3 m² nozzle with stations A, B (x|y) and C and the solution table values. */
export function ThreeAreaNozzleFigure() {
  const id = 'fb3a';
  const W = 640;
  const H = 230;
  const cy = 110;
  // area profile: reservoir-ish inlet (A=2.5) → throat 1 at x=180 → 3 at x=600
  const A = (x: number) => {
    if (x <= 180) return 1 + 1.5 * 0.5 * (1 + Math.cos((Math.PI * (x - 30)) / 150));
    return 1 + 2 * ((x - 180) / 420);
  };
  const hs = (x: number) => 26 * Math.sqrt(A(Math.max(30, x)));
  const xB = 180 + 420 * 0.5; // A = 2
  const Mx = ise.M_from_A_Astar(2, 'sup');
  const r = ns.p0y_p0x(Mx);
  const M = (x: number) => {
    const a = A(Math.max(30, x));
    if (x <= 180) return ise.M_from_A_Astar(Math.max(1, a), 'sub');
    if (x < xB) return ise.M_from_A_Astar(Math.max(1, a), 'sup');
    return ise.M_from_A_Astar(Math.max(1, a * r), 'sub');
  };
  return (
    <Figure caption="Notes §8.1.1: p₀ = 1 atm, T₀ = 300 K, throat A = 1 m², shock at B (2 m²), exit C (3 m²). Colour = Mach number from the lib solution.">
      <StudioSvg id={id} w={W} h={H}>
        <DuctFlow x0={30} x1={600} cy={cy} h={hs} M={M} />
        <DuctWalls id={id} x0={30} x1={600} cy={cy} h={hs} />
        <GlowShock id={id} d={`M${xB},${cy - hs(xB)} L${xB},${cy + hs(xB)}`} />
        {[
          [180, 'A · 1 m² · M = 1'],
          [xB, 'B · 2 m² · 2.20 | 0.547'],
          [600, 'C · 3 m² · M = 0.33'],
        ].map(([x, t]) => (
          <g key={String(t)}>
            <line x1={Number(x)} x2={Number(x)} y1={cy + hs(Number(x)) + 16} y2={cy + hs(Number(x)) + 4} stroke="#9fb0d6" />
            <text x={Math.min(Number(x) - 40, W - 190)} y={cy + hs(Number(x)) + 30} style={lightTxt}>
              {String(t)}
            </text>
          </g>
        ))}
        <text x={20} y={22} style={lightTxt}>reservoir p₀ = 1 atm, T₀ = 300 K</text>
        <text x={xB - 30} y={24} style={dimTxt}>p₀ and A* reset here</text>
      </StudioSvg>
    </Figure>
  );
}

/** p/p₀ along a nozzle with a shock, marking p_y (just behind the shock) vs p_e (exit) — the PS5 P3(c) trap. */
export function ShockNozzlePressureFigure({ AR = 4.2346, pb = 0.5 }: { AR?: number; pb?: number }) {
  const sol = solveNozzle(AR, pb);
  const prof = nozzleProfile(AR, sol);
  const xs = prof.xs ?? 0.7;
  const pre = prof.pts.filter((p) => p.x <= xs);
  const post = prof.pts.filter((p) => p.x >= xs);
  const px = pre[pre.length - 1]?.p ?? 0;
  const py = post[0]?.p ?? 0;
  return (
    <Figure caption={`p/p₀ for A_e/A_t = ${AR.toFixed(3)} and p_b = ${pb} p₀ (lib solution: shock at A/A* = ${(sol.As ?? 0).toFixed(2)}). After the shock the subsonic flow keeps diffusing, so the pressure keeps rising from p_y = ${py.toFixed(3)} p₀ to p_e = p_b = ${pb} p₀. Setting p_y = p_b is the classic mistake.`}>
      <Plot
        x={[0, 1]}
        y={[0, 1.02]}
        height={280}
        xLabel="position along nozzle"
        yLabel="p / p₀"
        series={[
          { points: pre.map((p) => ({ x: p.x, y: p.p })), color: 'var(--c1)', width: 3, label: 'isentropic, p₀ₓ = p₀' },
          { points: post.map((p) => ({ x: p.x, y: p.p })), color: 'var(--c2)', width: 3, label: 'isentropic again, with p₀ᵧ and A*ᵧ' },
          { points: [{ x: xs, y: px }, { x: xs, y: py }], color: 'var(--text)', width: 2.5 },
        ]}
        vlines={[{ x: prof.xt, label: 'throat' }]}
        dots={[
          { x: xs, y: py, color: 'var(--c5)', label: `p_y = ${py.toFixed(3)} (not p_b!)` },
          { x: 1, y: pb, color: 'var(--c3)', label: 'p_e = p_b' },
        ]}
      />
    </Figure>
  );
}

/* =====================================================================
   Chapter 9 / PS5–PS6 figures
   ===================================================================== */

/** Pitot-static probe in supersonic flow with a manometer (PS5 P4 setup). */
export function PitotProbeFigure({ dp = '400 kPa', M = 2.7 }: { dp?: string; M?: number }) {
  const id = 'fbpt';
  const W = 640;
  const H = 250;
  const cy = 95;
  const R = 14;
  const xn = 250;
  const cot = 1 / Math.tan(Math.asin(1 / M));
  const stand = (0.78 * 2 * R) / ns.rhoy_rhox(M) + 3;
  const pts: string[] = [];
  for (let y = -85; y <= 85; y += 5) pts.push(`${xn - stand + Math.sqrt(900 + (y * cot) ** 2) - 30},${cy + y}`);
  return (
    <Figure caption="Supersonic pitot-static probe: the bow shock is normal where it crosses the stagnation streamline, so the pitot port reads p₀ᵧ. The side port, far behind the curved shock, reads ≈ pₓ. The manometer shows p₀ᵧ − pₓ.">
      <StudioSvg id={id} w={W} h={H}>
        <rect x={0} y={cy - 90} width={W} height={180} fill={machColor(M)} opacity={0.45} />
        <path d={`M${pts.join(' L')} L${W},${cy + 85} L${W},${cy - 85} Z`} fill={machColor(ns.My(M))} opacity={0.25} />
        {[-60, -30, 30, 60].map((dy) => (
          <line key={dy} x1={20} x2={100} y1={cy + dy} y2={cy + dy} stroke="#e8ecf5" strokeWidth={1.6} markerEnd={`url(#${id}-arr)`} />
        ))}
        <text x={20} y={22} style={lightTxt}>M &gt; 1, pₓ = 45 kPa, Tₓ = −20 °C</text>
        <GlowShock id={id} d={`M${pts.join(' L')}`} width={2.5} />
        <path d={`M${xn},${cy} A${R},${R} 0 0 1 ${xn + R},${cy - R} L${W - 150},${cy - R} L${W - 150},${cy + R} L${xn + R},${cy + R} A${R},${R} 0 0 1 ${xn},${cy} Z`} fill={`url(#${id}-steel)`} stroke="#1d2129" />
        <circle cx={xn + 2} cy={cy} r={2.5} fill="#ff8c52" />
        <rect x={xn + 110} y={cy - R - 2} width={8} height={3} fill="#7c9cff" />
        {/* tubing to manometer */}
        <path d={`M${W - 150},${cy - 4} L${W - 110},${cy - 4} L${W - 110},${cy + 60}`} fill="none" stroke="#ff8c52" strokeWidth={3} />
        <path d={`M${xn + 114},${cy - R - 2} L${xn + 114},${cy - R - 20} L${W - 70},${cy - R - 20} L${W - 70},${cy + 60}`} fill="none" stroke="#7c9cff" strokeWidth={3} />
        <path d={`M${W - 118},${cy + 60} L${W - 118},${cy + 130} Q${W - 118},${cy + 150} ${W - 90},${cy + 150} Q${W - 62},${cy + 150} ${W - 62},${cy + 130} L${W - 62},${cy + 60}`} fill="none" stroke={`url(#${id}-steelH)`} strokeWidth={10} />
        <path d={`M${W - 118},${cy + 110} L${W - 118},${cy + 130} Q${W - 118},${cy + 148} ${W - 90},${cy + 148} Q${W - 62},${cy + 148} ${W - 62},${cy + 130} L${W - 62},${cy + 70}`} fill="none" stroke="#5cc98d" strokeWidth={6} />
        <text x={W - 50} y={cy + 100} style={lightTxt}>Δp = {dp}</text>
        <text x={xn - 60} y={cy + 60} style={dimTxt}>bow shock</text>
        <text x={xn + 30} y={cy + R + 16} style={dimTxt}>pitot port → p₀ᵧ</text>
        <text x={xn + 80} y={cy - R - 26} style={dimTxt}>static port → pₓ</text>
      </StudioSvg>
    </Figure>
  );
}

/** Two-throat supersonic wind tunnel: the starting sequence as stacked frames. */
export function TunnelStartingFramesFigure({ Mtest = 4 }: { Mtest?: number }) {
  const id = 'fbwt';
  const W = 640;
  const rowH = 92;
  const Ats = ise.A_Astar(Mtest);
  const need = 1 / ns.p0y_p0x(Mtest);
  const A = (x: number, At2: number) => {
    // 0-80 converge, 80-230 diverge, 230-400 test section, 400-480 converge to At2, 480-620 diverge
    if (x <= 80) return 1 + 2 * 0.5 * (1 + Math.cos((Math.PI * x) / 80));
    if (x <= 230) return 1 + (Ats - 1) * 0.5 * (1 - Math.cos((Math.PI * (x - 80)) / 150));
    if (x <= 400) return Ats;
    if (x <= 480) return At2 + (Ats - At2) * 0.5 * (1 + Math.cos((Math.PI * (x - 400)) / 80));
    return At2 + (Ats - At2) * 0.5 * (1 - Math.cos((Math.PI * (x - 480)) / 140));
  };
  const scale = 30 / Math.sqrt(Ats);
  const frames: { title: string; At2: number; shocks: number[]; M: (x: number) => number }[] = [];
  const supUp = (x: number) => (x <= 80 ? ise.M_from_A_Astar(Math.max(1, A(x, need)), 'sub') : ise.M_from_A_Astar(Math.max(1, A(x, need)), 'sup'));
  const subAfter = (x: number, xs: number, At2: number) => {
    const Mx = ise.M_from_A_Astar(Math.max(1, A(xs, At2)), 'sup');
    const r = ns.p0y_p0x(Mx);
    return ise.M_from_A_Astar(Math.max(1, A(x, At2) * r), 'sub');
  };
  const big = need * 1.05;
  frames.push({ title: '1 · choked at the first throat, shock in the nozzle', At2: big, shocks: [150], M: (x) => (x < 150 ? supUp(x) : subAfter(x, 150, big)) });
  frames.push({ title: `2 · shock at the test-section entrance: the worst case, needs A_t2/A_t1 ≥ ${need.toFixed(2)}`, At2: big, shocks: [230], M: (x) => (x < 230 ? supUp(x) : subAfter(x, 230, big)) });
  frames.push({
    title: '3 · started: shock snaps through and parks past the second throat',
    At2: big,
    shocks: [520],
    M: (x) => {
      if (x < 520) return x <= 80 ? supUp(x) : ise.M_from_A_Astar(Math.max(1, A(x, big)), 'sup');
      const Mx = ise.M_from_A_Astar(Math.max(1, A(520, big)), 'sup');
      return ise.M_from_A_Astar(Math.max(1, A(x, big) * ns.p0y_p0x(Mx)), 'sub');
    },
  });
  const small = need * 0.6;
  const Mblock = ns.Mx_from_p0y_p0x(1 / small);
  const Ablock = ise.A_Astar(Mblock);
  let xBlock = 80;
  for (let x = 80; x <= 230; x += 0.5) if (A(x, small) <= Ablock) xBlock = x;
  frames.push({ title: `4 · blocked: A_t2 too small, the second throat chokes and the shock is stuck at Mₓ = ${Mblock.toFixed(2)}`, At2: small, shocks: [xBlock], M: (x) => (x < xBlock ? supUp(x) : subAfter(x, xBlock, small)) });
  const H = rowH * frames.length + 10;
  return (
    <Figure caption={`Two-throat wind tunnel for M_test = ${Mtest}. Starting is an area problem: the second throat must pass the post-shock sonic area A*ᵧ = A*ₓ·(p₀ₓ/p₀ᵧ) when the shock sits at the test-section entrance.`}>
      <StudioSvg id={id} w={W} h={H}>
        {frames.map((f, k) => {
          const cy = 10 + k * rowH + 52;
          const h = (x: number) => scale * Math.sqrt(A(x, f.At2));
          return (
            <g key={k}>
              <text x={12} y={cy - 36} style={{ ...lightTxt, fontSize: 11.5 }}>{f.title}</text>
              <DuctFlow x0={10} x1={620} cy={cy} h={h} M={f.M} n={140} />
              <DuctWalls id={id} x0={10} x1={620} cy={cy} h={h} t={7} />
              {f.shocks.map((xs) => (
                <GlowShock key={xs} id={id} d={`M${xs},${cy - h(xs)} L${xs},${cy + h(xs)}`} width={2.5} />
              ))}
            </g>
          );
        })}
      </StudioSvg>
    </Figure>
  );
}

/** PS6 P2 / §9.2: the three inlet states (swallowing, swallowed, decelerated to a sonic throat). */
export function InletThreeStatesFigure({ M = 1.75 }: { M?: number }) {
  const id = 'fbi3';
  const W = 640;
  const rowH = 110;
  const AinAt = 1 / (1 / ise.A_Astar(ns.My(M))); // A_in/A_t from Kantrowitz
  const Mlow = ise.M_from_A_Astar(AinAt, 'sup');
  const A = (x: number) => {
    // lip at 150 (A = AinAt), throat at 330 (A = 1), diffuser to 620 (A = 1.6·AinAt)
    if (x <= 330) return 1 + (AinAt - 1) * 0.5 * (1 + Math.cos((Math.PI * (x - 150)) / 180));
    return 1 + (AinAt * 1.6 - 1) * 0.5 * (1 - Math.cos((Math.PI * (x - 330)) / 290));
  };
  const hs = (x: number) => 30 * Math.sqrt(A(x));
  const rows: { title: string; Minf: number; shock: number; M: (x: number) => number }[] = [
    {
      title: `a · swallowing condition: M∞ = ${M}, shock AT the lip, M_y = ${ns.My(M).toFixed(3)} chokes at the throat → A_in/A_t = ${AinAt.toFixed(3)}`,
      Minf: M,
      shock: 150,
      M: (x) => ise.M_from_A_Astar(Math.max(1, A(x)), x <= 330 ? 'sub' : 'sub'),
    },
    {
      title: `b · swallowed: supersonic into the converging inlet, shock parked just past the throat`,
      Minf: M,
      shock: 380,
      M: (x) => {
        const AxStar = AinAt / ise.A_Astar(M);
        if (x < 380) return ise.M_from_A_Astar(Math.max(1, A(x) / AxStar), 'sup');
        const Mx = ise.M_from_A_Astar(Math.max(1, A(380) / AxStar), 'sup');
        return ise.M_from_A_Astar(Math.max(1, (A(x) / AxStar) * ns.p0y_p0x(Mx)), 'sub');
      },
    },
    {
      title: `c · slow down to M∞ = ${Mlow.toFixed(3)}: isentropic, M = 1 exactly at the throat, no shock`,
      Minf: Mlow,
      shock: -1,
      M: (x) => ise.M_from_A_Astar(Math.max(1, A(x)), x <= 330 ? 'sup' : 'sub'),
    },
  ];
  const H = rows.length * rowH + 10;
  return (
    <Figure caption="The starting ratio (a) comes from the post-shock flow; the ideal ratio (c) from the isentropic flow. Once started at 1.75, the vehicle can slow to 1.475 before the shock is expelled.">
      <StudioSvg id={id} w={W} h={H}>
        {rows.map((r, k) => {
          const cy = 10 + k * rowH + 62;
          return (
            <g key={k}>
              <text x={12} y={cy - 46} style={{ ...lightTxt, fontSize: 11 }}>{r.title}</text>
              <rect x={10} y={cy - 38} width={140} height={76} fill={machColor(r.Minf)} opacity={0.5} />
              {[-20, 0, 20].map((dy) => (
                <line key={dy} x1={20} x2={80} y1={cy + dy} y2={cy + dy} stroke="#e8ecf5" strokeWidth={1.4} markerEnd={`url(#${id}-arr)`} />
              ))}
              <DuctFlow x0={150} x1={620} cy={cy} h={hs} M={r.M} />
              <DuctWalls id={id} x0={150} x1={620} cy={cy} h={hs} t={9} />
              {r.shock > 0 && <GlowShock id={id} d={`M${r.shock},${cy - hs(r.shock)} L${r.shock},${cy + hs(r.shock)}`} width={2.5} />}
              <text x={322} y={cy + hs(330) + 22} style={dimTxt}>A_t</text>
              <text x={140} y={cy + hs(150) + 22} style={dimTxt}>A_in</text>
            </g>
          );
        })}
      </StudioSvg>
    </Figure>
  );
}

/** Shinkansen in a tunnel: tight-fitting (piston) vs leaky piston with a gap. */
export function TrainTunnelFigure() {
  const id = 'fbtr';
  const W = 640;
  const H = 250;
  const train = (x: number, y: number, h: number) => (
    <g>
      <path d={`M${x},${y} L${x + 150},${y} Q${x + 200},${y} ${x + 215},${y + h / 2} Q${x + 200},${y + h} ${x + 150},${y + h} L${x},${y + h} Z`} fill={`url(#${id}-steel)`} stroke="#1d2129" />
      <rect x={x + 20} y={y + h * 0.25} width={120} height={h * 0.18} rx={3} fill="#1b2a4a" opacity={0.85} />
    </g>
  );
  return (
    <Figure caption="Notes §9.4. Top: a train that fills the tunnel is a piston, V_p′ = V_train = 83.3 m/s, driving a Mₛ = 1.154 shock (p_y/p_x = 1.39) ahead of it. Bottom: a bigger tunnel makes a leaky piston; the gap chokes and V_p′ drops to 45.8 m/s (Mₛ = 1.082) when A_tunnel = 1.22 A_train.">
      <StudioSvg id={id} w={W} h={H}>
        {/* tight tunnel */}
        <rect x={10} y={20} width={620} height={10} fill={`url(#${id}-hatch)`} />
        <rect x={10} y={96} width={620} height={10} fill={`url(#${id}-hatch)`} />
        <rect x={225} y={30} width={235} height={66} fill={machColor(0.2)} opacity={0.6} />
        <rect x={460} y={30} width={170} height={66} fill={machColor(0)} opacity={0.35} />
        {train(10, 32, 62)}
        <GlowShock id={id} d="M460,30 L460,96" />
        <text x={470} y={48} style={lightTxt}>Mₛ = 1.154 →</text>
        <text x={240} y={70} style={lightTxt}>slug at V_p′ = 83.3 m/s</text>
        <text x={470} y={88} style={dimTxt}>still air, 348 m/s sound speed</text>
        {/* leaky piston */}
        <rect x={10} y={130} width={620} height={10} fill={`url(#${id}-hatch)`} />
        <rect x={10} y={232} width={620} height={10} fill={`url(#${id}-hatch)`} />
        <rect x={10} y={140} width={620} height={92} fill={machColor(0.1)} opacity={0.45} />
        <rect x={10} y={140} width={220} height={16} fill={machColor(1)} opacity={0.7} />
        {train(10, 158, 72)}
        <GlowShock id={id} d="M500,140 L500,232" />
        <text x={250} y={170} style={lightTxt}>gap chokes: A* = A_tunnel − A_train</text>
        <text x={250} y={190} style={dimTxt}>train frame: air approaches at 83.3 − 45.8 = 37.5 m/s, M = 0.105</text>
        <text x={510} y={160} style={lightTxt}>Mₛ = 1.082 →</text>
      </StudioSvg>
    </Figure>
  );
}

/** PS5 P1 x–t sketch: piston pulled back in velocity steps, the rarefaction waves fan apart. */
export function RetractingPistonXtFigure() {
  const c = 1;
  const steps = [0, 0.15, 0.3, 0.45];
  // piston velocity steps at t = 0, 1, 2, 3 (dV = −0.15 c each)
  const tK = [0, 1, 2, 3];
  const xp = (t: number) => {
    let x = 0;
    for (let k = 0; k < 4; k++) {
      const a = tK[k];
      const b = k < 3 ? tK[k + 1] : Infinity;
      if (t > a) x -= steps[k] * (Math.min(t, b) - a);
    }
    return x;
  };
  const waves = [1, 2, 3].map((k) => {
    const u = -steps[k];
    const speed = u + c + 0.2 * u; // u + c, with c = c0 + (γ−1)u/2
    const t0 = tK[k];
    return { k, pts: [{ x: xp(t0), y: t0 }, { x: xp(t0) + speed * (6 - t0), y: 6 }] };
  });
  return (
    <Figure caption="PS5 P1: each velocity step dV sends a rarefaction wave. Behind the first wave the gas moves toward the piston and is colder, so wave 2 is slower than wave 1 (steeper line), wave 3 slower still. The lines diverge; they never meet. No rarefaction shock.">
      <Plot
        x={[-2, 6]}
        y={[0, 6]}
        height={280}
        xLabel="x"
        yLabel="t"
        series={[
          { points: sample(xp, 0, 6, 120).map((p) => ({ x: p.y, y: p.x })), color: 'var(--text)', width: 3, label: 'piston path (pulled left)' },
          ...waves.map((w, i) => ({ points: w.pts, color: ['var(--c1)', 'var(--c3)', 'var(--c4)'][i], width: 2.2, label: `wave c${w.k}` })),
          { points: [{ x: 0, y: 0 }, { x: 6, y: 6 }], color: 'var(--c2)', width: 2.2, label: 'wave c1 (into still gas, speed c)' },
        ]}
      />
    </Figure>
  );
}
