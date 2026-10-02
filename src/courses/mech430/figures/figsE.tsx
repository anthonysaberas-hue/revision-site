/* Group E figures — Ch. 15 (MOC) and Ch. 16 (unsteady waves), PS10, PS11. All numbers come from the lib. */
import { ReactNode, useId } from 'react';
import { Figure } from '../../../core/ui';
import { Plot } from '../../../core/Plot';
import { machColor } from '../sims/common';
import { buildChannelNet, ChannelSpec, interiorPoint, MOC_PRESETS, MOCNet, MOCPoint, stateFromMTheta, wallPoint, wallY } from '../lib/moc';
import { movingShock } from '../lib/unsteady';
import { shockTubeWaves } from '../lib/waves1d';
import { GASES } from '../lib/gas';
import { toRad } from '../lib/solve';

const svgStyle = { width: '100%', height: 'auto' } as const;
const INK = '#e8edf7';
const INK2 = '#9fb0d6';
const CI_COL = '#6fb8ff'; // right-running, C_I = ν + θ (C⁻)
const CII_COL = '#ffb454'; // left-running, C_II = ν − θ (C⁺)
const SHOCK = '#fff1d6';
const RED = '#ff5470';
const f2 = (v: number) => (isFinite(v) ? v.toFixed(2) : '—');
const f3 = (v: number) => (isFinite(v) ? v.toFixed(3) : '—');

/* ---------------- shared realistic-SVG pieces ---------------- */

/** Unique, url-safe id prefix for gradients inside one SVG. */
function usePrefix() {
  return 'e' + useId().replace(/[^a-zA-Z0-9]/g, '');
}

/** Metal gradients, cut hatching, studio background, glow filter and arrow marker. */
function Defs({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}-metal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5b6472" />
        <stop offset="0.18" stopColor="#d9dee6" />
        <stop offset="0.35" stopColor="#8e97a5" />
        <stop offset="0.7" stopColor="#3d4450" />
        <stop offset="1" stopColor="#6c7482" />
      </linearGradient>
      <linearGradient id={`${p}-metalV`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#4a525e" />
        <stop offset="0.3" stopColor="#dfe4ea" />
        <stop offset="0.55" stopColor="#8a93a1" />
        <stop offset="1" stopColor="#3a414c" />
      </linearGradient>
      <radialGradient id={`${p}-studio`} cx="0.5" cy="0.4" r="0.8">
        <stop offset="0" stopColor="#141b2e" />
        <stop offset="1" stopColor="#070a12" />
      </radialGradient>
      <pattern id={`${p}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="#2a303a" />
        <line x1="0" y1="0" x2="0" y2="7" stroke="#7d8696" strokeWidth="1.4" />
      </pattern>
      <filter id={`${p}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker id={`${p}-arr`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10z" fill={INK} />
      </marker>
    </defs>
  );
}

function Studio({ p, w, h }: { p: string; w: number; h: number }) {
  return <rect x={0} y={0} width={w} height={h} rx={10} fill={`url(#${p}-studio)`} />;
}

/** A horizontal tube cut in half so the gas is visible. */
function TubeWalls({ p, x0, x1, y0, y1, t = 9 }: { p: string; x0: number; x1: number; y0: number; y1: number; t?: number }) {
  return (
    <g>
      <rect x={x0} y={y0 - t} width={x1 - x0} height={t} fill={`url(#${p}-metal)`} />
      <rect x={x0} y={y1} width={x1 - x0} height={t} fill={`url(#${p}-metal)`} />
      <rect x={x0} y={y0 - t} width={x1 - x0} height={2} fill="#eef2f7" opacity={0.35} />
      <rect x={x0} y={y1 + t - 2} width={x1 - x0} height={2} fill="#000" opacity={0.35} />
    </g>
  );
}

function Piston({ p, x, y0, y1, rodTo }: { p: string; x: number; y0: number; y1: number; rodTo?: number }) {
  const w = 16;
  return (
    <g>
      {rodTo !== undefined && <rect x={Math.min(rodTo, x - w)} y={(y0 + y1) / 2 - 4} width={Math.abs(x - w - rodTo)} height={8} fill={`url(#${p}-metal)`} />}
      <rect x={x - w} y={y0 + 1} width={w} height={y1 - y0 - 2} rx={2} fill={`url(#${p}-metalV)`} stroke="#1b1f27" />
      {[0.3, 0.7].map((f) => (
        <line key={f} x1={x - w + 2} x2={x - 2} y1={y0 + f * (y1 - y0)} y2={y0 + f * (y1 - y0)} stroke="#2b313b" strokeWidth={2} />
      ))}
    </g>
  );
}

function ShockSheet({ p, x, y0, y1 }: { p: string; x: number; y0: number; y1: number }) {
  const n = 9;
  const d = Array.from({ length: n + 1 }, (_, i) => `${i ? 'L' : 'M'}${x + (i % 2 ? 2.5 : -2.5)},${y0 + ((y1 - y0) * i) / n}`).join(' ');
  return <path d={d} fill="none" stroke={SHOCK} strokeWidth={2.4} filter={`url(#${p}-glow)`} />;
}

function Arrow({ p, x1, y1, x2, y2, color = INK, w = 1.6 }: { p: string; x1: number; y1: number; x2: number; y2: number; color?: string; w?: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} markerEnd={`url(#${p}-arr)`} />;
}

function Tx({ x, y, children, c = INK, s = 12, a = 'start', b = false }: { x: number; y: number; children: ReactNode; c?: string; s?: number; a?: 'start' | 'middle' | 'end'; b?: boolean }) {
  return (
    <text x={x} y={y} textAnchor={a} style={{ fill: c, fontSize: s, fontWeight: b ? 650 : 400 }}>
      {children}
    </text>
  );
}

/** Gas colour by "hotness" 0…1 (cool blue → hot orange) for tube figures. */
const gasHot = (k: number) => `hsl(${Math.max(0, 215 - 190 * Math.min(1, k))} 70% ${40 + 12 * Math.min(1, k)}%)`;

/* =====================================================================
 * MOC net drawing (used by MOCChannelSim and the static MOC figures)
 * ===================================================================== */

interface NetDrawingProps {
  net: MOCNet;
  /** Show only points with id ≤ shown (step-by-step construction) */
  shown?: number;
  current?: number;
  showField?: boolean;
  showCrossings?: boolean;
  width?: number;
  height?: number;
}

/** Realistic channel section: metal walls, Mach-coloured flow, characteristic net on top. */
export function MOCNetDrawing({ net, shown = Infinity, current, showField = true, showCrossings = true, width = 780, height = 330 }: NetDrawingProps) {
  const p = usePrefix();
  const H = net.spec.height ?? 1;
  const vis = net.points.filter((q) => q.valid && q.id <= shown);
  const all = net.points.filter((q) => q.valid);
  const byId = new Map(net.points.map((q) => [q.id, q]));
  const xMaxNet = Math.max(...all.map((q) => q.x));
  const xMin = -0.22 * H;
  const xMax = xMaxNet + 0.35 * H;
  const init = net.stages[0].map((id) => byId.get(id)!);
  const upAt = (x: number) => (x < 0 ? net.upperWallPts[0].y + x * Math.tan(toRad(init[0].theta)) : wallY(net.upperWallPts, x));
  const loAt = (x: number) => (x < 0 ? net.lowerWallPts[0].y + x * Math.tan(toRad(init[init.length - 1].theta)) : wallY(net.lowerWallPts, x));
  const samplesX = Array.from({ length: 61 }, (_, i) => xMin + ((xMax - xMin) * i) / 60);
  const yTop = Math.max(...samplesX.map(upAt));
  const yBot = Math.min(...samplesX.map(loAt));
  const pad = 30;
  const wallT = 0.14 * H;
  const k = Math.min((width - 2 * pad) / (xMax - xMin), (height - 2 * pad - 20) / (yTop - yBot + 2 * wallT));
  const X = (x: number) => pad + (x - xMin) * k;
  const Y = (y: number) => height - pad - 10 - (y - yBot + wallT) * k;
  const poly = (f: (x: number) => number, off: number) => samplesX.map((x) => `${X(x).toFixed(1)},${Y(f(x) + off).toFixed(1)}`);
  const upperPath = `M${poly(upAt, 0).join(' L')} L${poly(upAt, wallT).reverse().join(' L')} Z`;
  const lowerPath = `M${poly(loAt, 0).join(' L')} L${poly(loAt, -wallT).reverse().join(' L')} Z`;
  const channelPath = `M${poly(upAt, 0).join(' L')} L${poly(loAt, 0).reverse().join(' L')} Z`;

  // Mach field: inverse-distance blend of the constructed points; the not-yet-built region is faint
  const cells: ReactNode[] = [];
  if (showField && all.length) {
    const nx = 70;
    const ny = 26;
    const dx = (xMax - xMin) / nx;
    const dy = (yTop - yBot) / ny;
    const src = vis.length ? vis : all.slice(0, 1);
    const reachX = Math.max(0, ...vis.map((q) => q.x)) + 0.12 * H;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const cx = xMin + (i + 0.5) * dx;
        const cy = yBot + (j + 0.5) * dy;
        if (cy > upAt(cx) + dy || cy < loAt(cx) - dy) continue;
        let wsum = 0;
        let msum = 0;
        for (const q of src) {
          const qx = q.stage === 0 && cx < 0 ? cx : q.x;
          const d2 = (cx - qx) ** 2 + (cy - q.y) ** 2 + 1e-6;
          const w = 1 / (d2 * d2);
          wsum += w;
          msum += w * q.M;
        }
        cells.push(<rect key={`${i}-${j}`} x={X(cx - dx / 2)} y={Y(cy + dy / 2)} width={dx * k + 0.6} height={dy * k + 0.6} fill={machColor(msum / wsum)} opacity={cx <= reachX ? 0.78 : 0.2} />);
      }
  }

  const seg = (a: MOCPoint, b: MOCPoint, fam: 'I' | 'II', hot: boolean, key: string) => (
    <line key={key} x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} stroke={fam === 'I' ? CI_COL : CII_COL} strokeWidth={hot ? 3.4 : 1.7} />
  );
  const lines: ReactNode[] = [];
  for (const q of vis) {
    const hot = q.id === current;
    if (q.fromI !== undefined) lines.push(seg(byId.get(q.fromI)!, q, 'I', hot, `i${q.id}`));
    if (q.fromII !== undefined) lines.push(seg(byId.get(q.fromII)!, q, 'II', hot, `ii${q.id}`));
  }
  const done = shown >= net.points.length;
  const exts: ReactNode[] = [];
  if (done)
    net.lines.forEach((l, i) => {
      if (!l.ext) return;
      const a = byId.get(l.ids[l.ids.length - 1])!;
      exts.push(<line key={`x${i}`} x1={X(a.x)} y1={Y(a.y)} x2={X(l.ext.x)} y2={Y(l.ext.y)} stroke={l.family === 'I' ? CI_COL : CII_COL} strokeDasharray="5 4" strokeWidth={1.2} opacity={0.7} />);
    });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={svgStyle} role="img">
      <Defs p={p} />
      <clipPath id={`${p}-chan`}>
        <path d={channelPath} />
      </clipPath>
      <Studio p={p} w={width} h={height} />
      <g clipPath={`url(#${p}-chan)`}>
        <rect x={X(xMin)} y={Y(yTop)} width={(xMax - xMin) * k} height={(yTop - yBot) * k} fill="#0d1426" />
        {cells}
        {exts}
        {lines}
      </g>
      <path d={upperPath} fill={`url(#${p}-metal)`} stroke="#1a1e26" />
      <path d={lowerPath} fill={`url(#${p}-metal)`} stroke="#1a1e26" />
      <path d={upperPath} fill={`url(#${p}-hatch)`} opacity={0.35} />
      <path d={lowerPath} fill={`url(#${p}-hatch)`} opacity={0.35} />
      <line x1={X(0)} x2={X(0)} y1={Y(upAt(0))} y2={Y(loAt(0))} stroke={INK2} strokeDasharray="3 4" />
      {[0.25, 0.5, 0.75].map((f) => {
        const y = loAt(xMin) + f * (upAt(xMin) - loAt(xMin));
        return <Arrow key={f} p={p} x1={X(xMin) + 4} y1={Y(y)} x2={X(xMin * 0.35)} y2={Y(y)} />;
      })}
      <Tx x={X(xMin) + 4} y={Math.max(14, Y(upAt(xMin)) - wallT * k - 6)} b>
        M = {net.spec.M0}
        {net.spec.pIn !== undefined ? `, p = ${net.spec.pIn} ${net.spec.pIn === 1 ? 'atm' : 'kPa'}` : ''}
      </Tx>
      {vis.map((q) => (
        <g key={q.id}>
          {q.id === current && <circle cx={X(q.x)} cy={Y(q.y)} r={11} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.85} />}
          <circle cx={X(q.x)} cy={Y(q.y)} r={q.kind === 'interior' ? 4.2 : 5} fill={q.kind === 'interior' ? '#ffffff' : '#ffe08a'} stroke="#0b0f18" strokeWidth={1.2} />
          <Tx x={X(q.x) + 7} y={Y(q.y) + (q.kind === 'upper' ? 17 : -8)} b>
            {q.id}
          </Tx>
        </g>
      ))}
      {showCrossings &&
        done &&
        net.crossings.slice(0, 4).map((c, i) => (
          <g key={`c${i}`}>
            <circle cx={X(c.x)} cy={Y(c.y)} r={9} fill="none" stroke={RED} strokeWidth={2.4} strokeDasharray={c.kind === 'projected' ? '3 3' : undefined} filter={`url(#${p}-glow)`} />
            {i === 0 && (
              <Tx x={X(c.x) + 12} y={Y(c.y) - 10} c={RED} s={11.5} b>
                {c.kind === 'actual' ? 'same-family characteristics cross → shock' : 'extended lines would cross → shock forms'}
              </Tx>
            )}
          </g>
        ))}
      <g transform={`translate(${width - 290}, ${height - 10})`}>
        <line x1={0} x2={22} y1={-4} y2={-4} stroke={CI_COL} strokeWidth={2.4} />
        <Tx x={26} y={0} c={INK2} s={10.5}>
          right-running: C_I = ν + θ
        </Tx>
        <line x1={148} x2={170} y1={-4} y2={-4} stroke={CII_COL} strokeWidth={2.4} />
        <Tx x={174} y={0} c={INK2} s={10.5}>
          left-running: C_II = ν − θ
        </Tx>
      </g>
    </svg>
  );
}

/** Static MOC net for a preset (notes, ps10p3, ps10p4, ps10p4ext, finalA, finalB). */
export function MOCNetFigure({ preset = 'ps10p3', spec, caption }: { preset?: string; spec?: ChannelSpec; caption?: string }) {
  const s = spec ?? MOC_PRESETS[preset]?.spec ?? MOC_PRESETS.ps10p3.spec;
  const net = buildChannelNet(s);
  return (
    <Figure caption={caption ?? MOC_PRESETS[preset]?.label}>
      <MOCNetDrawing net={net} />
    </Figure>
  );
}

/* =====================================================================
 * Ch. 15 figures
 * ===================================================================== */

/** The two Mach lines through a point, at θ ± μ, with the invariant each one carries. */
export function CharacteristicsAtPointFigure({ M = 2, theta = 12 }: { M?: number; theta?: number }) {
  const p = usePrefix();
  const s = stateFromMTheta(M, theta);
  const cx = 330;
  const cy = 170;
  const ray = (ang: number, len: number) => ({ x: cx + len * Math.cos(toRad(ang)), y: cy - len * Math.sin(toRad(ang)) });
  const up = ray(theta + s.mu, 250);
  const dn = ray(theta - s.mu, 250);
  const upB = ray(theta + s.mu + 180, 170);
  const dnB = ray(theta - s.mu + 180, 170);
  const v = ray(theta, 150);
  const arc = (a0: number, a1: number, r: number) => {
    const A = ray(a0, r);
    const B = ray(a1, r);
    return `M${A.x},${A.y} A${r},${r} 0 0 0 ${B.x},${B.y}`;
  };
  return (
    <Figure caption={`Two Mach lines pass through every point of a supersonic flow, at ±μ to the local velocity. At M = ${M}, μ = ${f2(s.mu)}°. With θ = ${theta}°, their slopes are tan(θ + μ) = tan ${f2(theta + s.mu)}° and tan(θ − μ) = tan ${f2(theta - s.mu)}°. Each one carries one invariant along it.`}>
      <svg viewBox="0 0 660 330" style={svgStyle}>
        <Defs p={p} />
        <Studio p={p} w={660} h={330} />
        <line x1={cx - 250} x2={cx + 290} y1={cy} y2={cy} stroke={INK2} strokeDasharray="4 5" />
        <line x1={upB.x} y1={upB.y} x2={up.x} y2={up.y} stroke={CII_COL} strokeWidth={2.6} />
        <line x1={dnB.x} y1={dnB.y} x2={dn.x} y2={dn.y} stroke={CI_COL} strokeWidth={2.6} />
        <Arrow p={p} x1={cx} y1={cy} x2={v.x} y2={v.y} w={2.6} />
        <path d={arc(0, theta, 70)} fill="none" stroke={INK2} />
        <path d={arc(theta, theta + s.mu, 110)} fill="none" stroke={CII_COL} />
        <path d={arc(theta - s.mu, theta, 95)} fill="none" stroke={CI_COL} />
        <Tx x={cx + 76} y={cy - 6} c={INK2} s={11}>
          θ
        </Tx>
        <Tx x={ray(theta + s.mu / 2, 118).x + 4} y={ray(theta + s.mu / 2, 118).y} c={CII_COL} s={11}>
          μ
        </Tx>
        <Tx x={ray(theta - s.mu / 2, 102).x + 4} y={ray(theta - s.mu / 2, 102).y + 6} c={CI_COL} s={11}>
          μ
        </Tx>
        <Tx x={v.x + 6} y={v.y - 4} b>
          V (M = {M})
        </Tx>
        <circle cx={cx} cy={cy} r={5} fill="#fff" />
        <Tx x={cx - 14} y={cy + 20} b>
          P
        </Tx>
        <Tx x={up.x - 230} y={Math.max(16, up.y - 10)} c={CII_COL} s={12.5} b>
          left-running C_II (C⁺): dy/dx = tan(θ + μ)
        </Tx>
        <Tx x={up.x - 230} y={Math.max(32, up.y + 7)} c={CII_COL} s={11.5}>
          carries C_II = ν − θ = {f2(s.CII)}°
        </Tx>
        <Tx x={dn.x - 260} y={Math.min(300, dn.y + 4)} c={CI_COL} s={12.5} b>
          right-running C_I (C⁻): dy/dx = tan(θ − μ)
        </Tx>
        <Tx x={dn.x - 260} y={Math.min(318, dn.y + 21)} c={CI_COL} s={11.5}>
          carries C_I = ν + θ = {f2(s.CI)}°
        </Tx>
      </svg>
    </Figure>
  );
}

/** Notes §15.3: interior point 3 from points 1 and 2, and wall point 4 from point 1. */
export function InteriorPointFigure() {
  const p = usePrefix();
  const s1 = stateFromMTheta(2, 20);
  const s2 = stateFromMTheta(2.1, 5);
  const s3 = interiorPoint(s1, s2);
  const s4 = wallPoint(s1, 13, 'upper');
  const P1 = { x: 200, y: 130 };
  const P2 = { x: 200, y: 270 };
  const dir = (a: number) => ({ c: Math.cos(toRad(a)), s: -Math.sin(toRad(a)) });
  const a = dir((s1.theta - s1.mu + s3.theta - s3.mu) / 2);
  const b = dir((s2.theta + s2.mu + s3.theta + s3.mu) / 2);
  const det = a.c * -b.s - a.s * -b.c;
  const t = ((P2.x - P1.x) * -b.s - (P2.y - P1.y) * -b.c) / det;
  const P3 = { x: P1.x + t * a.c, y: P1.y + t * a.s };
  const c4 = dir(s1.theta + s1.mu);
  const P4 = { x: P1.x + 110 * c4.c, y: P1.y + 110 * c4.s };
  const wl = dir(13);
  const box = (x: number, y: number, lines: string[], col = INK) => (
    <g>
      <rect x={x} y={y} width={176} height={16 * lines.length + 8} rx={6} fill="rgba(12,16,28,0.85)" stroke="rgba(143,179,255,0.35)" />
      {lines.map((l, i) => (
        <Tx key={i} x={x + 8} y={y + 18 + 16 * i} c={col} s={11.5}>
          {l}
        </Tx>
      ))}
    </g>
  );
  return (
    <Figure caption={`Notes §15.3. Point 3 takes C_I from point 1 and C_II from point 2. That gives θ₃ = (C_I − C_II)/2 = ${f2(s3.theta)}° and ν₃ = (C_I + C_II)/2 = ${f2(s3.nu)}°, so M₃ = ${f2(s3.M)}. The notes get 11.15°, 35.22° and 2.34 because they use the table value ν(2.1) = 29.07°. Wall point 4 (θ_wall = 13°) only receives C_II = ${f2(s1.CII)}° from point 1, so ν₄ = C_II + θ_wall = ${f2(s4.nu)}° and M₄ = ${f2(s4.M)}.`}>
      <svg viewBox="0 0 700 330" style={svgStyle}>
        <Defs p={p} />
        <Studio p={p} w={700} h={330} />
        <path d={`M${P4.x - 120 * wl.c},${P4.y - 120 * wl.s} L${P4.x + 120 * wl.c},${P4.y + 120 * wl.s} L${P4.x + 120 * wl.c},${P4.y + 120 * wl.s - 14} L${P4.x - 120 * wl.c},${P4.y - 120 * wl.s - 14} Z`} fill={`url(#${p}-metal)`} />
        <line x1={P1.x} y1={P1.y} x2={P3.x} y2={P3.y} stroke={CI_COL} strokeWidth={2.4} />
        <line x1={P2.x} y1={P2.y} x2={P3.x} y2={P3.y} stroke={CII_COL} strokeWidth={2.4} />
        <line x1={P1.x} y1={P1.y} x2={P4.x} y2={P4.y} stroke={CII_COL} strokeWidth={2.4} />
        {(
          [
            [P1, s1.theta, '1'],
            [P2, s2.theta, '2'],
            [P3, s3.theta, '3'],
            [P4, 13, '4'],
          ] as [{ x: number; y: number }, number, string][]
        ).map(([Q, th, l]) => {
          const d = dir(th);
          return (
            <g key={l}>
              <Arrow p={p} x1={Q.x} y1={Q.y} x2={Q.x + 40 * d.c} y2={Q.y + 40 * d.s} color={INK2} />
              <circle cx={Q.x} cy={Q.y} r={5.5} fill={l === '4' ? '#ffe08a' : '#fff'} />
              <Tx x={Q.x - 18} y={Q.y + 4} b>
                {l}
              </Tx>
            </g>
          );
        })}
        {box(8, 56, ['Point 1: M = 2, θ = 20°', `ν = ${f2(s1.nu)}°, μ = ${f2(s1.mu)}°`, `C_I = ${f2(s1.CI)}, C_II = ${f2(s1.CII)}`])}
        {box(8, 250, ['Point 2: M = 2.1, θ = 5°', `ν = ${f2(s2.nu)}°, μ = ${f2(s2.mu)}°`, `C_I = ${f2(s2.CI)}, C_II = ${f2(s2.CII)}`])}
        {box(Math.min(510, P3.x + 30), P3.y - 10, ['Point 3 (interior)', `θ = ${f2(s3.theta)}°, ν = ${f2(s3.nu)}°`, `M = ${f2(s3.M)}, μ = ${f2(s3.mu)}°`], '#bfe0ff')}
        {box(Math.min(510, P4.x + 40), 14, ['Point 4 (wall at 13°)', `ν = ${f2(s1.CII)} + 13 = ${f2(s4.nu)}°`, `M = ${f2(s4.M)}`], '#ffe3b0')}
      </svg>
    </Figure>
  );
}

/* =====================================================================
 * Ch. 16 / PS11 figures
 * ===================================================================== */

/** Moving shock seen in the lab frame and in the shock frame (PS11 P1, notes Ms = 3 example). */
export function MovingShockFramesFigure({ Ms = 3, c1 = 348, T1 = 300 }: { Ms?: number; c1?: number; T1?: number }) {
  const p = usePrefix();
  const s = movingShock(Ms, c1);
  const Vy = s.Vs - s.up;
  const y0 = 60;
  const y1 = 110;
  const Y0 = 200;
  const Y1 = 250;
  return (
    <Figure caption={`The same shock in two frames. Lab frame: a piston pushes at V_p' = ${s.up.toFixed(0)} m/s and the shock runs at V_s = M_s c_x = ${s.Vs.toFixed(0)} m/s into still gas. Shock frame ("add ${s.Vs.toFixed(0)} m/s to everything"): gas enters at M_x = ${Ms} and leaves at ${Vy.toFixed(0)} m/s. Temperatures do not depend on the frame, so c_y = ${s.c2.toFixed(0)} m/s and T_y = ${(T1 * s.T2_T1).toFixed(0)} K in both. In the lab frame the gas behind the shock moves at M = V_p'/c_y = ${s.M2lab.toFixed(3)}, which is supersonic.`}>
      <svg viewBox="0 0 700 290" style={svgStyle}>
        <Defs p={p} />
        <Studio p={p} w={700} h={290} />
        <Tx x={20} y={34} b>
          Lab frame (gas ahead at rest)
        </Tx>
        <rect x={120} y={y0} width={260} height={y1 - y0} fill={gasHot(0.8)} opacity={0.8} />
        <rect x={380} y={y0} width={290} height={y1 - y0} fill={gasHot(0.1)} opacity={0.8} />
        <TubeWalls p={p} x0={40} x1={670} y0={y0} y1={y1} />
        <Piston p={p} x={120} y0={y0} y1={y1} rodTo={40} />
        <ShockSheet p={p} x={380} y0={y0} y1={y1} />
        <Arrow p={p} x1={200} y1={92} x2={290} y2={92} />
        <Tx x={200} y={82} s={11}>
          V_p' = {s.up.toFixed(0)} m/s
        </Tx>
        <Arrow p={p} x1={384} y1={y0 - 16} x2={440} y2={y0 - 16} color={SHOCK} />
        <Tx x={444} y={y0 - 12} c={SHOCK} s={11}>
          V_s' = {s.Vs.toFixed(0)} m/s
        </Tx>
        <Tx x={440} y={90} s={11}>
          V = 0, T = {T1} K, c_x = {c1} m/s
        </Tx>
        <Tx x={20} y={174} b>
          Shock frame (shock at rest)
        </Tx>
        <rect x={40} y={Y0} width={340} height={Y1 - Y0} fill={gasHot(0.8)} opacity={0.8} />
        <rect x={380} y={Y0} width={290} height={Y1 - Y0} fill={gasHot(0.1)} opacity={0.8} />
        <TubeWalls p={p} x0={40} x1={670} y0={Y0} y1={Y1} />
        <ShockSheet p={p} x={380} y0={Y0} y1={Y1} />
        <Arrow p={p} x1={640} y1={235} x2={450} y2={235} />
        <Tx x={450} y={222} s={11}>
          V_x = {s.Vs.toFixed(0)} m/s (M_x = {Ms})
        </Tx>
        <Arrow p={p} x1={340} y1={235} x2={250} y2={235} />
        <Tx x={70} y={222} s={11}>
          V_y = {Vy.toFixed(0)} m/s, T_y = {(T1 * s.T2_T1).toFixed(0)} K
        </Tx>
      </svg>
    </Figure>
  );
}

/** PS11 P2: valve slammed shut on a 50 m/s pipe flow; then the same scene riding with the gas. */
export function WaterHammerFigure({ V = 50, Ms = 1.09, c = 346 }: { V?: number; Ms?: number; c?: number }) {
  const p = usePrefix();
  const rows = [
    { y: 44, title: '1. Before: steady flow toward the valve', shock: 0, valve: 'open' },
    { y: 134, title: '2. After closure (lab frame): the shock runs upstream; the gas behind it is at rest', shock: 430, valve: 'shut' },
    { y: 224, title: `3. Riding with the incoming gas: the valve is a piston moving at ${V} m/s`, shock: 430, valve: 'piston' },
  ];
  return (
    <Figure caption={`Water hammer in air. In frame 3 the gas ahead of the shock is at rest, so the unsteady-shock formula applies with V_p' = ${V} m/s, giving M_s = ${Ms}. In the lab frame the shock runs upstream at M_s c − ${V} ≈ ${(Ms * c - V).toFixed(0)} m/s.`}>
      <svg viewBox="0 0 700 290" style={svgStyle}>
        <Defs p={p} />
        <Studio p={p} w={700} h={290} />
        {rows.map((r, i) => {
          const y0 = r.y;
          const y1 = r.y + 40;
          return (
            <g key={i}>
              <Tx x={30} y={y0 - 14} s={11.5} b>
                {r.title}
              </Tx>
              <rect x={30} y={y0} width={(r.shock || 630) - 30} height={40} fill={gasHot(0.25)} opacity={0.8} />
              {r.shock > 0 && <rect x={r.shock} y={y0} width={630 - r.shock} height={40} fill={gasHot(0.55)} opacity={0.85} />}
              <TubeWalls p={p} x0={30} x1={630} y0={y0} y1={y1} />
              {r.valve === 'open' ? (
                <rect x={632} y={y0 - 24} width={10} height={28} fill={`url(#${p}-metalV)`} transform={`rotate(-35 637 ${y0})`} />
              ) : (
                <rect x={630} y={y0 - 9} width={12} height={58} fill={`url(#${p}-metalV)`} stroke="#1a1e26" />
              )}
              {r.shock > 0 && <ShockSheet p={p} x={r.shock} y0={y0} y1={y1} />}
              {r.shock > 0 && <Arrow p={p} x1={r.shock - 6} y1={y1 + 12} x2={r.shock - 70} y2={y1 + 12} color={SHOCK} />}
              {i < 2 && <Arrow p={p} x1={90} y1={y0 + 20} x2={170} y2={y0 + 20} />}
              {i < 2 && (
                <Tx x={180} y={y0 + 24} s={11}>
                  {V} m/s
                </Tx>
              )}
              {i === 1 && (
                <Tx x={470} y={y0 + 24} s={11}>
                  u = 0, p ≈ 122 kPa
                </Tx>
              )}
              {i === 2 && (
                <>
                  <Tx x={90} y={y0 + 24} s={11}>
                    gas at rest, c = {c} m/s
                  </Tx>
                  <Arrow p={p} x1={590} y1={y0 + 20} x2={500} y2={y0 + 20} />
                  <Tx x={440} y={y0 + 24} s={11}>
                    {V} m/s
                  </Tx>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

/** Shock-tube x–t diagram with regions 1–5 and the tube underneath (numbers from lib/waves1d). */
export function ShockTubeXTFigure({ p41 = 10, driver = 'air', driven = 'air' }: { p41?: number; driver?: string; driven?: string }) {
  const p = usePrefix();
  const w = shockTubeWaves({ p4_p1: p41, driver: GASES[driver], driven: GASES[driven], T4: 300, T1: 300, L1: 3 });
  const tEnd = w.tMeet * 1.08;
  const L4 = Math.max(1.5, 1.02 * w.c4 * tEnd);
  const ms = 1000;
  const fan = Array.from({ length: 6 }, (_, i) => w.headSpeed + ((w.tailSpeed - w.headSpeed) * i) / 5);
  const xR = (t: number) => w.L1 - w.WR * (t - w.tWall);
  const span = L4 + w.L1 * 1.03;
  const xd = 52 + (L4 / span) * 634;
  return (
    <Figure caption={`Shock tube with p₄/p₁ = ${p41} (${GASES[driver].name} driving ${GASES[driven].name}, both at 300 K). The diaphragm bursts at x = 0, t = 0. A shock (M_s = ${f3(w.Ms)}) runs into the driven gas 1 and leaves region 2 behind it, with p₂/p₁ = ${f3(w.p2_p1)}. The contact surface (dashed) acts as a "gas piston" moving at u₂ = ${w.u2.toFixed(0)} m/s. A centred rarefaction fan runs back into the driver gas 4 and leaves region 3, with p₃ = p₂ and u₃ = u₂. The shock reflects from the end wall and leaves region 5 at rest, with p₅/p₁ = ${f3(w.p5_p1)} and T₅ = ${w.T5.toFixed(0)} K.`}>
      <div style={{ background: '#070a12', borderRadius: 10, padding: '6px 6px 0', color: INK }}>
        <Plot
          x={[-L4, w.L1 * 1.03]}
          y={[0, tEnd * ms]}
          height={300}
          xLabel="x (m)"
          yLabel="t (ms)"
          legend={false}
          series={[
            ...fan.map((s, i) => ({ points: [{ x: 0, y: 0 }, { x: s * tEnd, y: tEnd * ms }], color: CI_COL, width: i === 0 || i === 5 ? 2 : 1 })),
            { points: [{ x: 0, y: 0 }, { x: w.u2 * tEnd, y: tEnd * ms }], color: '#c9d4ea', dash: true, width: 2 },
            { points: [{ x: 0, y: 0 }, { x: w.L1, y: w.tWall * ms }], color: SHOCK, width: 3.2 },
            { points: [{ x: w.L1, y: w.tWall * ms }, { x: xR(w.tMeet), y: w.tMeet * ms }], color: '#ff9f6b', width: 3.2 },
            { points: [{ x: w.L1, y: 0 }, { x: w.L1, y: tEnd * ms }], color: '#9aa3b2', width: 4 },
          ]}
        >
          {(sx, sy) => (
            <g style={{ fontWeight: 700, fontSize: 15 }}>
              <text x={sx(-0.75 * L4)} y={sy(0.3 * tEnd * ms)} style={{ fill: INK }}>4</text>
              <text x={sx(0.5 * (w.tailSpeed + w.u2) * 0.85 * tEnd)} y={sy(0.85 * tEnd * ms)} style={{ fill: INK }}>3</text>
              <text x={sx(0.5 * (w.u2 + w.Vs) * 0.6 * w.tWall)} y={sy(0.6 * w.tWall * ms)} style={{ fill: INK }}>2</text>
              <text x={sx(0.8 * w.L1)} y={sy(0.25 * w.tWall * ms)} style={{ fill: INK }}>1</text>
              <text x={sx(0.985 * w.L1) - 8} y={sy(0.5 * (w.tWall + w.tMeet) * ms) + 12} style={{ fill: INK }}>5</text>
              <text x={sx(w.headSpeed * 0.6 * tEnd)} y={sy(0.6 * tEnd * ms) - 6} style={{ fill: CI_COL, fontSize: 11 }}>expansion head</text>
              <text x={sx(0.5 * w.L1) + 8} y={sy(0.5 * w.tWall * ms) + 14} style={{ fill: SHOCK, fontSize: 11 }}>incident shock</text>
              <text x={sx(xR(w.tMeet)) - 100} y={sy(w.tMeet * ms) - 6} style={{ fill: '#ff9f6b', fontSize: 11 }}>reflected shock</text>
            </g>
          )}
        </Plot>
        <svg viewBox="0 0 700 60" style={svgStyle}>
          <Defs p={p} />
          <rect x={52} y={16} width={xd - 52} height={28} fill={gasHot(0.6)} opacity={0.85} />
          <rect x={xd} y={16} width={(w.L1 / span) * 634} height={28} fill={gasHot(0.15)} opacity={0.85} />
          <TubeWalls p={p} x0={46} x1={xd + (w.L1 / span) * 634 + 4} y0={16} y1={44} t={7} />
          <rect x={xd + (w.L1 / span) * 634} y={8} width={10} height={44} fill={`url(#${p}-metalV)`} />
          <rect x={xd - 1.5} y={10} width={3} height={40} fill="#e8edf7" />
          <Tx x={60} y={35} s={11} b>
            4: driver, p₄ (high)
          </Tx>
          <Tx x={xd + 8} y={35} s={11} b>
            1: driven, p₁ (low)
          </Tx>
        </svg>
      </div>
    </Figure>
  );
}

/** End-wall close-up (PS11 P6): before and after reflection. */
export function ReflectedShockFigure({ Ms = 2.705, MR = 2.019 }: { Ms?: number; MR?: number }) {
  const p = usePrefix();
  const rows = [
    { y: 50, title: `Before reflection: the incident shock (M_s = ${Ms}) runs into gas 1`, sx: 470, right: gasHot(0.1), lR: '1 (at rest)', dir: 1 },
    { y: 150, title: `After reflection: the reflected shock (M_R = ${MR}) runs back into gas 2`, sx: 430, right: gasHot(1), lR: '5 (at rest, hot)', dir: -1 },
  ];
  return (
    <Figure caption="Seen from gas 2, the end wall moves toward it at u₂. The wall therefore acts as a piston, and the reflected shock obeys the same unsteady-shock formula with c_x = c₂. Gas 5 is brought to rest at the wall. That is the test state used for chemical kinetics, and it is the reservoir of a shock tunnel.">
      <svg viewBox="0 0 700 230" style={svgStyle}>
        <Defs p={p} />
        <Studio p={p} w={700} h={230} />
        {rows.map((r, i) => (
          <g key={i}>
            <Tx x={40} y={r.y - 14} s={11.5} b>
              {r.title}
            </Tx>
            <rect x={40} y={r.y} width={r.sx - 40} height={44} fill={gasHot(0.5)} opacity={0.85} />
            <rect x={r.sx} y={r.y} width={620 - r.sx} height={44} fill={r.right} opacity={0.85} />
            <TubeWalls p={p} x0={40} x1={620} y0={r.y} y1={r.y + 44} />
            <rect x={620} y={r.y - 9} width={18} height={62} fill={`url(#${p}-metalV)`} stroke="#1a1e26" />
            <ShockSheet p={p} x={r.sx} y0={r.y} y1={r.y + 44} />
            <Arrow p={p} x1={r.sx + 4 * r.dir} y1={r.y + 58} x2={r.sx + 60 * r.dir} y2={r.y + 58} color={SHOCK} />
            <Tx x={60} y={r.y + 27} s={11.5}>
              2 (moving right at u₂)
            </Tx>
            <Tx x={r.sx + 14} y={r.y + 27} s={11.5}>
              {r.lR}
            </Tx>
          </g>
        ))}
        <Tx x={660} y={222} c={INK2} s={11} a="end">
          end wall
        </Tx>
      </svg>
    </Figure>
  );
}

/** Gas gun: C⁺ characteristics from the reservoir reach the projectile base. */
export function GasGunFigure() {
  const p = usePrefix();
  const W = 700;
  const Hh = 330;
  const ox = 70;
  const oy = 250;
  const traj = Array.from({ length: 30 }, (_, i) => {
    const t = i / 29;
    return { x: ox + 250 + (330 * t * t) / (0.4 + t), y: oy - 190 * t };
  });
  const path = traj.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
  return (
    <Figure caption="How fast can a gas gun launch a projectile? Every u + c characteristic (C⁺, orange) that reaches the projectile base started in the still reservoir gas, so it carries u + 2c/(γ−1) = 2c₀/(γ−1). At the base u = u_p, and u_p is largest when c → 0 there: u_max = 2c₀/(γ−1), which is 5c₀ for γ = 1.4. The u − c waves (blue) are the expansion running back into the breech.">
      <svg viewBox={`0 0 ${W} ${Hh}`} style={svgStyle}>
        <Defs p={p} />
        <Studio p={p} w={W} h={Hh} />
        <line x1={ox} y1={oy} x2={W - 30} y2={oy} stroke={INK2} />
        <line x1={ox} y1={oy} x2={ox} y2={30} stroke={INK2} />
        <Tx x={W - 36} y={oy + 16} c={INK2} s={11}>
          x
        </Tx>
        <Tx x={ox - 16} y={40} c={INK2} s={11}>
          t
        </Tx>
        {Array.from({ length: 6 }, (_, i) => {
          const s = 0.3 + 0.14 * i;
          return <line key={i} x1={ox + 250} y1={oy} x2={ox + 250 - 250 * s} y2={oy - 150 * (1 - 0.3 * s)} stroke={CI_COL} strokeWidth={1.1} opacity={0.8} />;
        })}
        {Array.from({ length: 7 }, (_, i) => {
          const x0 = ox + 30 + 32 * i;
          const target = traj[Math.min(29, 6 + 3 * i)];
          return <path key={i} d={`M${x0},${oy} Q${(x0 + target.x) / 2},${oy - 30 - 10 * i} ${target.x},${target.y}`} fill="none" stroke={CII_COL} strokeWidth={1.4} />;
        })}
        <path d={path} fill="none" stroke="#fff" strokeWidth={3} />
        <Tx x={traj[18].x + 12} y={traj[18].y + 16} s={11.5} b>
          projectile path: u = u_p
        </Tx>
        <Tx x={traj[29].x - 260} y={traj[29].y - 8} c={CII_COL} s={11.5}>
          u + 2c/(γ−1) = 2c₀/(γ−1) on every C⁺
        </Tx>
        <rect x={ox} y={oy + 26} width={250} height={30} fill={gasHot(0.7)} opacity={0.85} />
        <TubeWalls p={p} x0={ox - 6} x1={W - 40} y0={oy + 26} y1={oy + 56} t={8} />
        <rect x={ox - 14} y={oy + 16} width={10} height={50} fill={`url(#${p}-metalV)`} />
        <path d={`M${ox + 250},${oy + 28} L${ox + 290},${oy + 28} L${ox + 306},${oy + 41} L${ox + 290},${oy + 54} L${ox + 250},${oy + 54} Z`} fill={`url(#${p}-metalV)`} stroke="#1a1e26" />
        <Tx x={ox + 8} y={oy + 46} s={11} b>
          p₀, T₀, c₀ (reservoir gas)
        </Tx>
      </svg>
    </Figure>
  );
}

/** PS11 P3: characteristics from an initial line in the x–t plane carrying the Riemann invariants. */
export function RiemannXTFigure() {
  const p = usePrefix();
  const pts = [120, 200, 280, 360, 440, 520];
  const oy = 250;
  return (
    <Figure caption="1-D unsteady MOC. Two acoustic waves leave every point of a known initial state. A u + c wave carries C⁺ = u + 2c/(γ−1), and a u − c wave carries C⁻ = u − 2c/(γ−1). Where a C⁺ and a C⁻ meet, u and c follow: u = (C⁺ + C⁻)/2 and c = (γ−1)(C⁺ − C⁻)/4. This is the same bookkeeping as ν ± θ in 2-D steady flow.">
      <svg viewBox="0 0 640 290" style={svgStyle}>
        <Defs p={p} />
        <Studio p={p} w={640} h={290} />
        <line x1={60} y1={oy} x2={610} y2={oy} stroke={INK2} />
        <line x1={60} y1={oy} x2={60} y2={30} stroke={INK2} />
        <Tx x={600} y={oy + 18} c={INK2} s={11}>
          x
        </Tx>
        <Tx x={44} y={40} c={INK2} s={11}>
          t
        </Tx>
        {pts.map((x, i) => (
          <g key={i}>
            <path d={`M${x},${oy} Q${x + 40},${oy - 100} ${x + 70 + 6 * i},${40}`} fill="none" stroke={CII_COL} strokeWidth={1.6} />
            <path d={`M${x},${oy} Q${x - 30},${oy - 100} ${x - 70 + 4 * i},${40}`} fill="none" stroke={CI_COL} strokeWidth={1.6} />
            <circle cx={x} cy={oy} r={4.5} fill="#fff" />
          </g>
        ))}
        <Tx x={440} y={30} c={CII_COL} s={11.5}>
          u + c: C⁺ = u + 2c/(γ−1)
        </Tx>
        <Tx x={70} y={30} c={CI_COL} s={11.5}>
          u − c: C⁻ = u − 2c/(γ−1)
        </Tx>
        <Tx x={180} y={oy + 24} c={INK2} s={11}>
          known initial state u(x, 0), c(x, 0)
        </Tx>
      </svg>
    </Figure>
  );
}
