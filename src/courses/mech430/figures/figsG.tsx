/* Group G figures — finals A/B, recipes page and cheat sheet. */
import { ReactNode } from 'react';
import { Figure } from '../../../core/ui';
import { Plot } from '../../../core/Plot';
import { Ms_from_up, expansionState } from '../lib/unsteady';
import { My, py_px } from '../lib/normalShock';
import { obliqueShock } from '../lib/obliqueShock';
import { expansion, M_from_nu, nu } from '../lib/prandtlMeyer';
import { A_Astar, M_from_A_Astar, machAngle, p_p0 } from '../lib/isentropic';
import { machColor } from '../sims/common';

const txt = { fontSize: 12, fill: 'var(--text)' } as const;
const mut = { fontSize: 11, fill: 'var(--muted)' } as const;
const bold = { fontSize: 13, fill: 'var(--text)', fontWeight: 700 } as const;
const svgStyle = { width: '100%', height: 'auto' } as const;
const DEG = Math.PI / 180;
const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);

/** Shared SVG defs: brushed-metal gradients, cut-face hatching, glow for shocks, arrow heads. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e9edf3" />
        <stop offset="0.35" stopColor="#a9b2bf" />
        <stop offset="0.55" stopColor="#7d8796" />
        <stop offset="0.8" stopColor="#c3cad4" />
        <stop offset="1" stopColor="#5d6674" />
      </linearGradient>
      <linearGradient id={`${id}-metalh`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#6b7483" />
        <stop offset="0.5" stopColor="#dfe4eb" />
        <stop offset="1" stopColor="#7c8594" />
      </linearGradient>
      <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="#7d8796" />
        <line x1="0" y1="0" x2="0" y2="7" stroke="#4a5260" strokeWidth="2" />
      </pattern>
      <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker id={`${id}-arr`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10z" fill="#eef2fb" />
      </marker>
      <marker id={`${id}-arrm`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10z" fill="var(--muted)" />
      </marker>
    </defs>
  );
}
const SHOCK = '#fff3c4';
const FAN = 'rgba(210,230,255,0.75)';
const DARK = '#0b1020';
/** Label on a dark pill (readable on top of the coloured field). */
function Pill({ x, y, children, anchor = 'middle' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) {
  const s = String(children);
  const w = s.length * 6.2 + 12;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return (
    <g>
      <rect x={x0} y={y - 12} width={w} height={17} rx={8.5} fill="rgba(12,16,28,0.8)" stroke="rgba(143,179,255,0.35)" />
      <text x={x0 + w / 2} y={y + 1} textAnchor="middle" style={{ fontSize: 11, fill: '#eef2fb', fontWeight: 600 }}>
        {s}
      </text>
    </g>
  );
}

/* ============================================================
   Airfoils — Final A P3 (diamond) and Final B P4 (wedge, reconstructed)
   Every colour and number comes from the lib (exact θ-β-M and ν(M)).
   ============================================================ */
interface Side {
  front: number; // flow direction along the front face, deg from horizontal (y up)
  sigma: number; // shock angle (deg, positive magnitude)
  M1: number; // Mach behind the shock
  p1: number;
  rear?: { angle: number; M: number; p: number; mu1: number; mu2: number };
}
export function AirfoilFigure({ variant = 'diamond' }: { variant?: 'diamond' | 'wedge' }) {
  const Minf = 2;
  const pinf = 100;
  const alpha = 5;
  const id = `gaf-${variant}`;
  const side = (deflect: number, turn?: number, sign = 1): Side => {
    const r = obliqueShock(Minf, deflect);
    const s: Side = { front: sign * deflect, sigma: r.sigma, M1: r.M2, p1: pinf * r.p2_p1 };
    if (turn) {
      const e = expansion(r.M2, turn);
      s.rear = { angle: sign * (deflect - turn), M: e.M2, p: s.p1 * e.p2_p1, mu1: e.mu1, mu2: e.mu2 };
    }
    return s;
  };
  const up = variant === 'diamond' ? side(10 - alpha, 20, 1) : side(20 - alpha, 40, 1);
  const lo = variant === 'diamond' ? side(10 + alpha, 20, -1) : side(alpha, undefined, -1);
  // geometry (math coords, chord 1, rotated nose-up by α)
  const rot = ([x, y]: number[]) => [x * Math.cos(alpha * DEG) + y * Math.sin(alpha * DEG), -x * Math.sin(alpha * DEG) + y * Math.cos(alpha * DEG)];
  const half = variant === 'diamond' ? 10 : 20;
  const body = variant === 'diamond' ? [[0, 0], [0.5, 0.5 * Math.tan(half * DEG)], [1, 0], [0.5, -0.5 * Math.tan(half * DEG)]] : [[0, 0], [0.5, 0.5 * Math.tan(half * DEG)], [1, 0]];
  const S = 330;
  const ox = 150;
  const oy = 140;
  const P = body.map(rot).map(([x, y]) => [ox + S * x, oy - S * y]);
  const LE = P[0];
  const TE = P[2];
  const shU = P[1];
  const shL = variant === 'diamond' ? P[3] : null;
  const R = 400;
  const dir = (angDeg: number) => [Math.cos(angDeg * DEG), -Math.sin(angDeg * DEG)];
  const at = (p: number[], ang: number, r = R) => [p[0] + r * dir(ang)[0], p[1] + r * dir(ang)[1]];
  const pts = (a: number[][]) => a.map((p) => p.join(',')).join(' ');
  const regions: { poly: number[][]; M: number }[] = [];
  // upper
  if (up.rear) {
    regions.push({ poly: [LE, at(LE, up.sigma), at(shU, up.front + up.rear.mu1), shU], M: up.M1 });
    regions.push({ poly: [shU, at(shU, up.rear.angle + up.rear.mu2), at(TE, up.rear.angle), TE], M: up.rear.M });
  }
  if (lo.rear && shL) {
    regions.push({ poly: [LE, at(LE, -lo.sigma), at(shL, lo.front - lo.rear.mu1), shL], M: lo.M1 });
    regions.push({ poly: [shL, at(shL, lo.rear.angle - lo.rear.mu2), at(TE, lo.rear.angle), TE], M: lo.rear.M });
  } else {
    regions.push({ poly: [LE, at(LE, -lo.sigma), at(TE, -lo.sigma), TE], M: lo.M1 });
  }
  const fan = (p: number[], a0: number, a1: number, k: string) =>
    [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const a = a0 + (a1 - a0) * t;
      const q = at(p, a, 130);
      return <line key={`${k}${t}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={FAN} strokeWidth={1.1} />;
    });
  const face = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const labelsUp = variant === 'diamond' ? ['1', '2'] : ['A', 'B'];
  const labelsLo = variant === 'diamond' ? ['3', '4'] : ['C'];
  const m1 = face(LE, shU);
  const m2 = face(shU, TE);
  const m3 = shL ? face(LE, shL) : face(LE, TE);
  const m4 = shL ? face(shL, TE) : null;
  return (
    <Figure
      caption={
        variant === 'diamond'
          ? 'Final A P3: 10° half-angle diamond at α = 5° (nose up) in M = 2, p∞ = 100 kPa. Colour = local Mach number. The windward (lower) front face turns the flow 15° (strong compression), the leeward (upper) one only 5°; each shoulder expands through the full 20° included turn. Values are the exact shock-expansion solution from the lib.'
          : 'Final B P4 (reconstructed): single-wedge profile (20° upper wedge, flat lower surface) at α = 5° in M = 2, p∞ = 100 kPa. Upper front face turns 15°, the shoulder expands 40°, the flat bottom turns 5°. Exact values from the lib.'
      }
    >
      <svg viewBox="0 0 640 290" style={svgStyle}>
        <Defs id={id} />
        <clipPath id={`${id}-clip`}>
          <rect x="0" y="0" width="640" height="290" rx="10" />
        </clipPath>
        <g clipPath={`url(#${id}-clip)`}>
          <rect x="0" y="0" width="640" height="290" fill={DARK} />
          <rect x="0" y="0" width="640" height="290" fill={machColor(Minf)} opacity={0.55} />
          {regions.map((r, i) => (
            <polygon key={i} points={pts(r.poly)} fill={machColor(r.M)} opacity={0.85} />
          ))}
          {[70, 110, 170, 210, 250].map((y) => (
            <line key={y} x1="8" y1={y} x2="70" y2={y} stroke="#eef2fb" strokeWidth={1.6} markerEnd={`url(#${id}-arr)`} opacity={0.8} />
          ))}
          {up.rear && fan(shU, up.front + up.rear.mu1, up.rear.angle + up.rear.mu2, 'u')}
          {lo.rear && shL && fan(shL, lo.front - lo.rear.mu1, lo.rear.angle - lo.rear.mu2, 'l')}
          <g filter={`url(#${id}-glow)`}>
            <line x1={LE[0]} y1={LE[1]} x2={at(LE, up.sigma)[0]} y2={at(LE, up.sigma)[1]} stroke={SHOCK} strokeWidth={2.6} />
            <line x1={LE[0]} y1={LE[1]} x2={at(LE, -lo.sigma)[0]} y2={at(LE, -lo.sigma)[1]} stroke={SHOCK} strokeWidth={2.6} />
          </g>
          <polygon points={pts(P)} fill={`url(#${id}-metal)`} stroke="#2a303b" strokeWidth={1.5} />
          <line x1={LE[0]} y1={LE[1]} x2={TE[0]} y2={TE[1]} stroke="#39414e" strokeDasharray="4 4" strokeWidth={1} />
          <Pill x={70} y={30} anchor="start">{`M∞ = 2 · p∞ = 100 kPa`}</Pill>
          <Pill x={at(LE, up.sigma, 150)[0] + 40} y={at(LE, up.sigma, 150)[1] + 8}>{`σ = ${f1(up.sigma)}°`}</Pill>
          <Pill x={at(LE, -lo.sigma, 140)[0] + 44} y={at(LE, -lo.sigma, 140)[1]}>{`σ = ${f1(lo.sigma)}°`}</Pill>
          <Pill x={m1[0]} y={m1[1] - 16}>{`${labelsUp[0]}: M ${f2(up.M1)}, ${f1(up.p1)} kPa`}</Pill>
          {up.rear && <Pill x={m2[0] + 40} y={m2[1] - 12}>{`${labelsUp[1]}: M ${f2(up.rear.M)}, ${f1(up.rear.p)} kPa`}</Pill>}
          <Pill x={m3[0]} y={m3[1] + 26}>{`${labelsLo[0]}: M ${f2(lo.M1)}, ${f1(lo.p1)} kPa`}</Pill>
          {m4 && lo.rear && <Pill x={m4[0] + 40} y={m4[1] + 26}>{`${labelsLo[1]}: M ${f2(lo.rear.M)}, ${f1(lo.rear.p)} kPa`}</Pill>}
          <Pill x={632} y={284} anchor="end">
            {variant === 'diamond' ? 'face = (c/2)/cos 10° = 0.5077 m · span 1 m' : 'chord & span unknown (photo missing)'}
          </Pill>
        </g>
      </svg>
    </Figure>
  );
}

/* ============================================================
   MOC channels — Final A P4 (A) and Final B P5 (B)
   ============================================================ */
type Pt = { id: string; x: number; y: number; nu: number; th: number };
function wallPath(x0: number, y0: number, knots: [number, number][], x1: number) {
  const th = (x: number) => {
    if (x <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++) {
      if (x <= knots[i][0]) {
        const [xa, ta] = knots[i - 1];
        const [xb, tb] = knots[i];
        return ta + ((tb - ta) * (x - xa)) / (xb - xa);
      }
    }
    return knots[knots.length - 1][1];
  };
  const out: [number, number][] = [[x0, y0]];
  let y = y0;
  for (let x = x0; x < x1; x += 2) {
    y -= 2 * Math.tan(th(x) * DEG);
    out.push([x + 2, y]);
  }
  return out;
}
const yAt = (path: [number, number][], x: number) => {
  let best = path[0];
  for (const p of path) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
  return best[1];
};

/** Invariant bookkeeping for the two exam channels (C_I = ν + θ on right-running, C_II = ν − θ on left-running). */
function mocExamPoints(variant: 'A' | 'B') {
  const n = variant === 'A' ? nu(2) : nu(3);
  // [id, ν, θ] from the exam tables (interior: ν = (C_I + C_II)/2, θ = (C_I − C_II)/2; wall: θ = θ_wall)
  const rows: [string, number, number][] =
    variant === 'A'
      ? [
          ['1', n, 0],
          ['2', n, 15],
          ['3', n + 7.5, 7.5],
          ['4', n + 15, 0],
          ['5', n + 5, 5],
          ['6', n + 12.5, -2.5],
          ['7', n + 10, 0],
          ['8', n + 15, 0],
          ['9', n + 12.5, 2.5],
          ['10', n + 15, 0],
          ['11', n + 5, -5],
          ['12', n + 7.5, -7.5],
        ]
      : [
          ['1', n, 0],
          ['2', n, 0],
          ['3', n, 0],
          ['4', n - 5, -5],
          ['5', n, 0],
          ['6', n - 5, -5],
          ['7', n - 10, -10],
          ['8', n - 10, 0],
          ['9', n - 15, -5],
          ['10', n - 25, -15],
          ['11', n - 20, 0],
        ];
  const M0 = variant === 'A' ? 2 : 3;
  return rows.map(([id, v, th]) => {
    const M = M_from_nu(v);
    return { id, nu: v, th, CI: v + th, CII: v - th, M, p: (100 * p_p0(M)) / p_p0(M0), mu: machAngle(M) };
  });
}

export function MOCChannelFigure({ variant = 'A' }: { variant?: 'A' | 'B' }) {
  const low = 250;
  const id = `gmoc-${variant}`;
  const tab = mocExamPoints(variant);
  const T = Object.fromEntries(tab.map((r) => [r.id, r]));
  let wall: [number, number][];
  let place: [string, number, number | 'w'][];
  let right: string[][];
  let left: string[][];
  let angles: { id: string; t: string }[];
  if (variant === 'A') {
    wall = wallPath(20, 140, [[20, 15], [170, 5], [330, 0], [500, -5], [600, -8]], 600);
    place = [['1', 20, low], ['2', 20, 'w'], ['3', 95, 190], ['4', 165, low], ['5', 170, 'w'], ['6', 250, 175], ['7', 330, low], ['8', 330, 'w'], ['9', 415, 170], ['10', 495, low], ['11', 500, 'w'], ['12', 575, 175]];
    right = [['2', '3', '4'], ['5', '6', '7'], ['8', '9', '10'], ['11', '12']];
    left = [['1', '3', '5'], ['4', '6', '8'], ['7', '9', '11'], ['10', '12']];
    angles = [{ id: '2', t: 'θw = 15°' }, { id: '5', t: '5°' }, { id: '8', t: '0°' }, { id: '11', t: '−5°' }];
  } else {
    wall = wallPath(20, 60, [[20, 0], [60, 0], [170, -5], [320, -10], [470, -15], [600, -15]], 600);
    place = [['1', 20, 'w'], ['2', 20, low], ['3', 110, 160], ['4', 175, 'w'], ['5', 200, low], ['6', 270, 180], ['7', 320, 'w'], ['8', 360, low], ['9', 410, 190], ['10', 470, 'w'], ['11', 500, low]];
    right = [['1', '3', '5'], ['4', '6', '8'], ['7', '9', '11']];
    left = [['2', '3', '4'], ['5', '6', '7'], ['8', '9', '10']];
    angles = [{ id: '1', t: 'θw = 0°' }, { id: '4', t: '−5°' }, { id: '7', t: '−10°' }, { id: '10', t: '−15°' }];
  }
  const pts: Pt[] = place.map(([pid, x, y]) => ({ id: pid, x, y: y === 'w' ? yAt(wall, x) : y, nu: T[pid].nu, th: T[pid].th }));
  const byId = Object.fromEntries(pts.map((p) => [p.id, p]));
  // colour the channel: gradient along x through the points' Mach numbers (average of points at similar x)
  const sorted = [...pts].sort((a, b) => a.x - b.x);
  const stops = sorted.map((p) => ({ o: (p.x - 10) / 590, c: machColor(T[p.id].M) }));
  const channel = [...wall.map((p) => p.join(',')), `600,${low}`, `10,${low}`, `10,${wall[0][1]}`].join(' ');
  const line = (ids: string[], color: string, key: string) => (
    <polyline key={key} points={ids.map((i) => `${byId[i].x},${byId[i].y}`).join(' ')} fill="none" stroke={color} strokeWidth={1.8} />
  );
  const Mmin = Math.min(...tab.map((r) => r.M));
  const Mmax = Math.max(...tab.map((r) => r.M));
  return (
    <Figure
      caption={
        variant === 'A'
          ? `Final A P4: M = 2, 100 kPa entering parallel to the walls. Colour = Mach number from the MOC table (${f2(Mmin)} → ${f2(Mmax)}). Orange lines are right-running (carry C_I = ν + θ), pale-blue lines left-running (carry C_II = ν − θ). The rising-then-falling upper wall is an expansion, so M only grows.`
          : `Final B P5: M = 3, 100 kPa into a channel whose upper wall turns down (converging = compressive). Colour = Mach number (${f2(Mmax)} → ${f2(Mmin)}). Orange = right-running (C_I), pale blue = left-running (C_II). Same-family lines converge downstream: that is where a shock would form.`
      }
    >
      <svg viewBox="0 0 610 290" style={svgStyle}>
        <Defs id={id} />
        <linearGradient id={`${id}-flow`} x1="0" y1="0" x2="1" y2="0">
          {stops.map((s, i) => (
            <stop key={i} offset={Math.max(0, Math.min(1, s.o))} stopColor={s.c} />
          ))}
        </linearGradient>
        <rect x="0" y="0" width="610" height="290" rx="10" fill={DARK} />
        <polygon points={channel} fill={`url(#${id}-flow)`} opacity={0.9} />
        {/* metal walls with cut hatching */}
        <polygon points={[...wall.map((p) => `${p[0]},${p[1]}`), `600,${wall[wall.length - 1][1] - 16}`, ...[...wall].reverse().map((p) => `${p[0]},${p[1] - 16}`)].join(' ')} fill={`url(#${id}-hatch)`} stroke="#c3cad4" strokeWidth={1} />
        <polyline points={wall.map((p) => p.join(',')).join(' ')} fill="none" stroke="#e9edf3" strokeWidth={2.5} />
        <rect x="10" y={low} width="590" height="16" fill={`url(#${id}-hatch)`} stroke="#c3cad4" strokeWidth={1} />
        <line x1="10" y1={low} x2="600" y2={low} stroke="#e9edf3" strokeWidth={2.5} />
        {right.map((r, i) => line(r, '#ffb14a', `r${i}`))}
        {left.map((r, i) => line(r, '#bcd6ff', `l${i}`))}
        {pts.map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r={4.5} fill="#0b1020" stroke="#eef2fb" strokeWidth={1.5} />
            <text x={p.x + 7} y={p.y + (p.y >= low - 1 ? -6 : p.y < 120 ? 18 : 4)} style={{ fontSize: 12.5, fontWeight: 700, fill: '#ffffff' }}>
              {p.id}
            </text>
          </g>
        ))}
        {angles.map((a) => (
          <text key={a.id} x={byId[a.id].x - 4} y={byId[a.id].y - 22} style={{ fontSize: 11, fill: '#c9d3ea' }}>
            {a.t}
          </text>
        ))}
        <text x="440" y={low + 32} style={{ fontSize: 11, fill: '#c9d3ea' }}>
          lower wall θ = 0°
        </text>
        <Pill x={60} y={variant === 'A' ? 215 : 120}>{variant === 'A' ? 'M = 2, 100 kPa' : 'M = 3, 100 kPa'}</Pill>
      </svg>
    </Figure>
  );
}

/* ============================================================
   Final A P5 — piston pushed / pulled: p(x) at two times (the requested sketches)
   ============================================================ */
export function PistonPushPullFigure({ mode = 'push' }: { mode?: 'push' | 'pull' }) {
  const g = 1.4;
  const c1 = Math.sqrt(1.4 * (8314 / 28.9) * 300);
  const Vp = 200;
  const t1 = 1;
  const t2 = 2; // ms
  if (mode === 'push') {
    const Ms = Ms_from_up(Vp / c1, g);
    const Ws = Ms * c1;
    const p2 = py_px(Ms, g);
    const prof = (t: number) => [
      { x: (Vp * t) / 1000, y: p2 },
      { x: (Ws * t) / 1000, y: p2 },
      { x: (Ws * t) / 1000, y: 1 },
      { x: 1.2, y: 1 },
    ];
    return (
      <Figure caption={`(b) Pressure along the tube at t₁ = 1 ms and t₂ = 2 ms. Between the piston (x = V_p t) and the shock (x = W_s t, W_s = M_s c₁ ≈ ${Math.round(Ws)} m/s) the gas is uniform at p ≈ ${p2.toFixed(2)} atm and moves with the piston; ahead of the shock it is still at rest at 1 atm. The plateau lengthens because the shock outruns the piston.`}>
        <Plot
          x={[0, 1.2]}
          y={[0, 2.5]}
          height={240}
          xLabel="x (m) from the piston's starting position"
          yLabel="p (atm)"
          series={[
            { points: prof(t1), label: 't₁ = 1 ms', color: 'var(--c1)' },
            { points: prof(t2), label: 't₂ = 2 ms', color: 'var(--c2)', dash: true },
          ]}
          vlines={[
            { x: (Vp * t1) / 1000, label: 'piston t₁', color: 'var(--c1)' },
            { x: (Ws * t1) / 1000, label: 'shock t₁', color: 'var(--c1)' },
            { x: (Vp * t2) / 1000, label: 'piston t₂', color: 'var(--c2)' },
            { x: (Ws * t2) / 1000, label: 'shock t₂', color: 'var(--c2)' },
          ]}
        />
      </Figure>
    );
  }
  const ex = expansionState(Vp, c1, g);
  const cp = c1 * ex.c_c4;
  const tail = cp - Vp;
  const prof = (t: number) => {
    const pts: { x: number; y: number }[] = [{ x: (-Vp * t) / 1000, y: ex.p_p4 }, { x: (tail * t) / 1000, y: ex.p_p4 }];
    for (let i = 1; i <= 30; i++) {
      // inside the fan x/t = c1 − (γ+1)/2·|u|, so |u| = 2(c1 − x/t)/(γ+1)
      const xt = tail + ((c1 - tail) * i) / 30;
      const u = (2 / (g + 1)) * (c1 - xt);
      pts.push({ x: (xt * t) / 1000, y: expansionState(u, c1, g).p_p4 });
    }
    pts.push({ x: 1.2, y: 1 });
    return pts;
  };
  return (
    <Figure caption={`(e) Pressure along the tube at t₁ = 1 ms and t₂ = 2 ms. At the piston face p ≈ ${ex.p_p4.toFixed(3)} atm, uniform back to the fan's trailing edge, which still moves right at c_p − V_p ≈ +${Math.round(tail)} m/s. Through the fan p rises smoothly to 1 atm at the leading edge (+c₁ ≈ ${Math.round(c1)} m/s). The fan widens linearly with time.`}>
      <Plot
        x={[-0.5, 1.2]}
        y={[0, 1.2]}
        height={240}
        xLabel="x (m) from the piston's starting position"
        yLabel="p (atm)"
        series={[
          { points: prof(t1), label: 't₁ = 1 ms', color: 'var(--c1)' },
          { points: prof(t2), label: 't₂ = 2 ms', color: 'var(--c2)', dash: true },
        ]}
        vlines={[
          { x: (-Vp * t1) / 1000, label: 'piston t₁', color: 'var(--c1)' },
          { x: (-Vp * t2) / 1000, label: 'piston t₂', color: 'var(--c2)' },
          { x: (tail * t2) / 1000, label: 'tail t₂', color: 'var(--c2)' },
          { x: (c1 * t1) / 1000, label: 'head t₁', color: 'var(--c1)' },
          { x: (c1 * t2) / 1000, label: 'head t₂', color: 'var(--c2)' },
        ]}
      />
    </Figure>
  );
}

/* ============================================================
   Final B P1 — supersonic inlet: design, start, unstarted (realistic cut-away SVG)
   ============================================================ */
export function InletPanelsFigure() {
  const id = 'ginl';
  const Md = 1.4;
  const AR = A_Astar(Md); // A_in/A_t
  const Mstart = 1.583;
  const MyLip = My(Mstart);
  const Mbow = My(Md);
  const Msub = M_from_A_Astar(AR, 'sub'); // just inside the lip after a lip shock
  // one inlet in local coords: lip at x=30, throat at x=110, exit x=190; half-heights by √A
  const hIn = 52;
  const hT = hIn / Math.sqrt(AR);
  const hEx = hIn * 1.15;
  const cy = 90;
  const inner = (x: number) => (x <= 110 ? hIn + ((hT - hIn) * (x - 30)) / 80 : hT + ((hEx - hT) * (x - 110)) / 80);
  const cowl = (dx: number, sign: 1 | -1) => {
    const ys = (x: number) => cy - sign * inner(x);
    const outer = (x: number) => cy - sign * (hIn + 4 + ((x - 30) / 160) * 14);
    const a = [`${dx + 30},${ys(30)}`, `${dx + 110},${ys(110)}`, `${dx + 190},${ys(190)}`, `${dx + 190},${outer(190)}`, `${dx + 30},${outer(30) + sign * 1}`];
    return <polygon points={a.join(' ')} fill={`url(#${id}-${sign > 0 ? 'metal' : 'metal'})`} stroke="#2a303b" strokeWidth={1} />;
  };
  const flow = (dx: number, grad: string) => {
    const top: string[] = [];
    const bot: string[] = [];
    for (let x = 30; x <= 190; x += 10) {
      top.push(`${dx + x},${cy - inner(x)}`);
      bot.unshift(`${dx + x},${cy + inner(x)}`);
    }
    return <polygon points={[...top, ...bot].join(' ')} fill={`url(#${grad})`} />;
  };
  const panel = (k: number) => 10 + k * 210;
  const lg = (gid: string, st: [number, string][]) => (
    <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
      {st.map(([o, c], i) => (
        <stop key={i} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
  return (
    <Figure caption="Colour = Mach number (lib values). (a) Design: isentropic 1.4 → 1 at the throat → subsonic. (b) Starting by overspeed: the normal shock sits at the lip (M∞ = 1.58 → 0.67) and the post-shock flow exactly chokes the throat. (c) Unstarted at M∞ = 1.4: a detached bow shock, the throat still chokes but on the lower p₀y, so the excess air spills around the cowl (ṁ ratio 0.958).">
      <svg viewBox="0 0 640 200" style={svgStyle}>
        <Defs id={id} />
        {lg(`${id}-fa`, [[0, machColor(Md)], [0.5, machColor(1)], [1, machColor(0.45)]])}
        {lg(`${id}-fb`, [[0, machColor(MyLip)], [0.5, machColor(0.95)], [1, machColor(0.45)]])}
        {lg(`${id}-fc`, [[0, machColor(Msub)], [0.5, machColor(1)], [1, machColor(0.45)]])}
        <rect x="0" y="0" width="640" height="200" rx="10" fill={DARK} />
        {/* free streams */}
        <rect x={panel(0)} y="10" width="200" height="160" fill={machColor(Md)} opacity={0.35} />
        <rect x={panel(1)} y="10" width="200" height="160" fill={machColor(Mstart)} opacity={0.35} />
        <rect x={panel(2)} y="10" width="200" height="160" fill={machColor(Md)} opacity={0.35} />
        <path d={`M${panel(2) + 22},12 Q${panel(2) - 4},${cy} ${panel(2) + 22},168 L${panel(2) + 200},168 L${panel(2) + 200},12 Z`} fill={machColor(Mbow)} opacity={0.45} />
        {[0, 1, 2].map((k) => (
          <g key={k}>
            {flow(panel(k) - 10, `${id}-f${'abc'[k]}`)}
            {cowl(panel(k) - 10, 1)}
            {cowl(panel(k) - 10, -1)}
            <line x1={panel(k) + 100} y1={cy - hT} x2={panel(k) + 100} y2={cy + hT} stroke="#eef2fb" strokeDasharray="3 3" opacity={0.7} />
          </g>
        ))}
        <g filter={`url(#${id}-glow)`}>
          <line x1={panel(1) + 21} y1={cy - hIn} x2={panel(1) + 21} y2={cy + hIn} stroke={SHOCK} strokeWidth={3} />
          <path d={`M${panel(2) + 22},14 Q${panel(2) - 4},${cy} ${panel(2) + 22},166`} stroke={SHOCK} strokeWidth={3} fill="none" />
        </g>
        <path d={`M${panel(2) + 2},${cy - 40} Q${panel(2) + 22},${cy - 46} ${panel(2) + 40},${cy - 78}`} stroke="#eef2fb" strokeWidth={1.4} fill="none" markerEnd={`url(#${id}-arr)`} />
        <path d={`M${panel(2) + 2},${cy + 40} Q${panel(2) + 22},${cy + 46} ${panel(2) + 40},${cy + 78}`} stroke="#eef2fb" strokeWidth={1.4} fill="none" markerEnd={`url(#${id}-arr)`} />
        <Pill x={panel(0) + 100} y={190}>{`(a) design M∞ = 1.4`}</Pill>
        <Pill x={panel(1) + 100} y={190}>{`(b) start at M∞ = 1.58`}</Pill>
        <Pill x={panel(2) + 100} y={190}>{`(c) unstarted at 1.4`}</Pill>
        <Pill x={panel(0) + 100} y={24}>{`A_in/A_t = ${AR.toFixed(4)}`}</Pill>
        <Pill x={panel(1) + 100} y={24}>{`lip shock → M ${MyLip.toFixed(2)}`}</Pill>
        <Pill x={panel(2) + 120} y={24}>{`bow shock · spillage`}</Pill>
      </svg>
    </Figure>
  );
}

/* ============================================================
   Recipes: a generic vertical decision flowchart (clean 2-D)
   ============================================================ */
type FlowNode = string | { q: string; yes: string; no: string };

function wrap(s: string, max: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

export function RecipeFlow({ nodes, caption }: { nodes: FlowNode[]; caption?: string }) {
  const W = 660;
  const boxW = 340;
  const bx = 10;
  const lh = 15;
  let y = 8;
  const items: ReactNode[] = [];
  nodes.forEach((n, i) => {
    const isQ = typeof n !== 'string';
    const lines = wrap(isQ ? n.q : n, 48);
    const h = lines.length * lh + 14;
    const yl = isQ ? wrap(`YES → ${n.yes}`, 44) : [];
    const nl = isQ ? wrap(`NO → ${n.no}`, 44) : [];
    const sideH = isQ ? (yl.length + nl.length) * 13 + 8 : 0;
    const blockH = Math.max(h, sideH);
    const by = y + (blockH - h) / 2;
    items.push(
      <g key={i}>
        {i > 0 && <line x1={bx + boxW / 2} y1={y - 16} x2={bx + boxW / 2} y2={by - 2} stroke="var(--muted)" strokeWidth={1.5} markerEnd="url(#grf-arrm)" />}
        <rect x={bx} y={by} width={boxW} height={h} rx={isQ ? h / 2 : 6} fill={isQ ? 'var(--warn-soft, var(--surface-2))' : 'var(--surface-2)'} stroke={isQ ? 'var(--warn, var(--c2))' : 'var(--border)'} strokeWidth={1.5} />
        <text x={bx + 8} y={by + 11} style={{ fontSize: 9.5, fill: 'var(--muted)' }}>
          {i + 1}
        </text>
        {lines.map((l, k) => (
          <text key={k} x={bx + boxW / 2} y={by + 18 + k * lh} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--text)', fontWeight: isQ ? 650 : 400 }}>
            {l}
          </text>
        ))}
        {isQ && (
          <g>
            <line x1={bx + boxW} y1={by + h / 2} x2={bx + boxW + 20} y2={by + h / 2} stroke="var(--muted)" strokeWidth={1.5} markerEnd="url(#grf-arrm)" />
            {yl.map((l, k) => (
              <text key={`y${k}`} x={bx + boxW + 26} y={y + 12 + k * 13} style={{ fontSize: 11, fill: 'var(--good, var(--c3))', fontWeight: k === 0 ? 600 : 400 }}>
                {l}
              </text>
            ))}
            {nl.map((l, k) => (
              <text key={`n${k}`} x={bx + boxW + 26} y={y + 16 + (yl.length + k) * 13} style={{ fontSize: 11, fill: 'var(--bad, var(--c2))', fontWeight: k === 0 ? 600 : 400 }}>
                {l}
              </text>
            ))}
          </g>
        )}
      </g>,
    );
    y += blockH + 20;
  });
  return (
    <Figure caption={caption}>
      <svg viewBox={`0 0 ${W} ${y - 10}`} style={svgStyle}>
        <defs>
          <marker id="grf-arrm" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10z" fill="var(--muted)" />
          </marker>
        </defs>
        {items}
      </svg>
    </Figure>
  );
}

/* ============================================================
   Cheat sheet helpers (clean 2-D, print-friendly)
   ============================================================ */
export function WhichTableChart() {
  const rows: [string, string, string][] = [
    ['Area changes, no loss (nozzle, diffuser, inlet)', 'A-2 isentropic', 'A/A*, p/p₀, T/T₀; ṁ from the throat'],
    ['Jump normal to the flow (shock in a duct, pitot)', 'A-3 normal shock', 'x → y; p₀ drops, T₀ same; A*y = A*x·p₀x/p₀y'],
    ['Jump inclined to the flow (wedge, lip, ramp)', 'A-3 with Mₙ = M sin σ', 'σ from θ-β-M; M_y = M_yn / sin(σ − δ)'],
    ['Constant area + friction (pipe, tube)', 'A-4 Fanno', '4fL/D vs 4fL*/D; T₀ const; p₀ drops'],
    ['Constant area + heat (combustor, detonation)', 'A-5 Rayleigh', 'T₀/T₀*, p₀/p₀*; check Δq ≤ c_p(T₀* − T₀₁)'],
    ['Flow turns away from itself (convex corner)', 'A-6 Prandtl–Meyer', 'ν₂ = ν₁ + θ; p₀ const'],
    ['2-D smooth walls, many waves', 'MOC (A-6 + invariants)', 'C_I = ν + θ, C_II = ν − θ; p₀ const'],
    ['Something moves (piston, shock tube)', 'moving shock / Riemann', 'shock frame → A-3; fan: u ± 2c/(γ−1) const'],
  ];
  return (
    <div style={{ margin: '0.4rem 0' }}>
      <table style={{ fontSize: '0.8rem', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>What happens to the gas?</th>
            <th style={{ textAlign: 'left' }}>Use</th>
            <th style={{ textAlign: 'left' }}>Key move</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              <td>{r[0]}</td>
              <td>
                <b>{r[1]}</b>
              </td>
              <td>{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '0.3rem 0 0' }}>
        Chain the blocks: every junction hands on M plus p₀ and T₀. Isentropic keeps both; shocks and friction keep T₀ only; heat keeps neither (T₀ rises
        by Δq/c_p).
      </p>
    </div>
  );
}

/** Dense multi-column wrapper for the printable cheat sheet. */
export function CheatSheet({ children }: { children: ReactNode }) {
  return (
    <div className="cheatsheet-g">
      <style>{`
        .cheatsheet-g { columns: 2 330px; column-gap: 1.2rem; font-size: 0.86rem; line-height: 1.35; }
        .cheatsheet-g .cheat-block { break-inside: avoid; border: 1px solid var(--border); border-radius: 8px; padding: 0.3rem 0.6rem 0.15rem; margin: 0 0 0.7rem; background: var(--surface); }
        .cheatsheet-g .cheat-block h3 { font-size: 0.92rem; margin: 0.1rem 0 0.15rem; color: var(--accent); }
        .cheatsheet-g .katex-display { margin: 0.2rem 0; overflow-x: auto; overflow-y: hidden; }
        .cheatsheet-g p, .cheatsheet-g ul { margin: 0.15rem 0; }
        .cheatsheet-g table { font-size: 0.78rem; }
        @media print {
          .cheatsheet-g { columns: 3; font-size: 7.4pt; column-gap: 0.7rem; }
          .cheatsheet-g .cheat-block { padding: 0.1rem 0.3rem; margin-bottom: 0.25rem; border-color: #999; }
          .cheatsheet-g .katex { font-size: 1em; }
          .no-print { display: none !important; }
        }
      `}</style>
      {children}
    </div>
  );
}
export function CheatBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="cheat-block">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
