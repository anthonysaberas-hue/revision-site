/* Group F figures — Quiz 2 walkthroughs (W2019, W2023, F2023, W2024).
 * Realistic section sketches: machined-metal walls with cut hatching, the flow coloured by the local Mach
 * number from the lib (machColor), glowing shocks. The interactive 3-D sections live in sims/simsF.tsx. */
import { ReactNode, useId } from 'react';
import { Figure } from '../../../core/ui';
import { A_Astar, M_from_A_Astar } from '../lib/isentropic';
import { Mx_from_p0y_p0x, My as shockMy, p0y_p0x } from '../lib/normalShock';
import { startingMach, throatOpeningFactor, unstartMassFlowRatio } from '../lib/inlet';
import { bisect } from '../lib/solve';
import { machColor } from '../sims/common';
import { twoThroatSolution } from '../lib/twoThroat';

const txt = { fontSize: 12, fill: 'var(--text)' } as const;
const bold = { fontSize: 12, fill: 'var(--text)', fontWeight: 700 } as const;
const mut = { fontSize: 11, fill: 'var(--muted)' } as const;
const small = { fontSize: 10, fill: 'var(--muted)' } as const;
const svgStyle = { width: '100%', height: 'auto', display: 'block' } as const;
const r3 = (v: number) => String(Number(v.toPrecision(3)));
const r4 = (v: number) => String(Number(v.toPrecision(4)));

/** Smooth cosine blend between two x positions. */
function blend(x: number, x0: number, x1: number, h0: number, h1: number) {
  const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  return h0 + (h1 - h0) * 0.5 * (1 - Math.cos(Math.PI * t));
}
/** Piecewise profile through [x, value] knots joined by cosine blends. */
function knots(k: [number, number][]) {
  return (x: number) => {
    if (x <= k[0][0]) return k[0][1];
    for (let i = 0; i < k.length - 1; i++) if (x <= k[i + 1][0]) return blend(x, k[i][0], k[i + 1][0], k[i][1], k[i + 1][1]);
    return k[k.length - 1][1];
  };
}

/* ---------------- realistic duct rendering ---------------- */

function MetalDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f1f3f7" />
        <stop offset="0.35" stopColor="#b9c0cb" />
        <stop offset="0.55" stopColor="#7c8595" />
        <stop offset="0.8" stopColor="#aeb5c1" />
        <stop offset="1" stopColor="#dde1e8" />
      </linearGradient>
      <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(20,24,33,0.35)" strokeWidth="1.2" />
      </pattern>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.28" />
        <stop offset="0.25" stopColor="#fff" stopOpacity="0.10" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.16" />
        <stop offset="0.75" stopColor="#fff" stopOpacity="0.06" />
        <stop offset="1" stopColor="#000" stopOpacity="0.28" />
      </linearGradient>
      <filter id={`${id}-glow`} x="-50%" y="-10%" width="200%" height="120%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
  );
}

/**
 * Half-height h(x) (px) about centre line cy, walls of thickness t, flow strips coloured by M(x).
 * Everything between xa and xb.
 */
function Duct({
  id,
  h,
  M,
  xa,
  xb,
  cy,
  t = 9,
  shocks = [],
  step = 2,
}: {
  id: string;
  h: (x: number) => number;
  M: (x: number) => number;
  xa: number;
  xb: number;
  cy: number;
  t?: number;
  shocks?: number[];
  step?: number;
}) {
  const strips: ReactNode[] = [];
  for (let x = xa; x < xb; x += step) {
    const x2 = Math.min(xb, x + step);
    const hm = h(x + step / 2);
    strips.push(<rect key={x} x={x} y={cy - hm} width={x2 - x + 0.6} height={2 * hm} fill={machColor(M(x + step / 2))} />);
  }
  const inner = (side: 1 | -1) => {
    const pts: string[] = [];
    for (let x = xa; x <= xb + 0.01; x += 2) pts.push(`${x.toFixed(1)},${(cy - side * h(Math.min(x, xb))).toFixed(1)}`);
    return pts;
  };
  const wall = (side: 1 | -1) => {
    const a = inner(side);
    const b: string[] = [];
    for (let x = xb; x >= xa - 0.01; x -= 2) b.push(`${x.toFixed(1)},${(cy - side * (h(Math.max(x, xa)) + t)).toFixed(1)}`);
    return [...a, ...b].join(' ');
  };
  const flowPoly = [...inner(1), ...inner(-1).reverse()].join(' ');
  return (
    <g>
      {strips}
      <polygon points={flowPoly} fill={`url(#${id}-sheen)`} />
      {([1, -1] as const).map((s) => (
        <g key={s}>
          <polygon points={wall(s)} fill={`url(#${id}-metal)`} stroke="#394150" strokeWidth={1} />
          <polygon points={wall(s)} fill={`url(#${id}-hatch)`} />
        </g>
      ))}
      {shocks.map((x, i) => (
        <g key={i}>
          <line x1={x} x2={x} y1={cy - h(x) + 1} y2={cy + h(x) - 1} stroke="#fff3c4" strokeWidth={8} filter={`url(#${id}-glow)`} opacity={0.9} />
          <line x1={x} x2={x} y1={cy - h(x) + 1} y2={cy + h(x) - 1} stroke="#ffffff" strokeWidth={2.4} />
        </g>
      ))}
    </g>
  );
}

function MachKey({ x, y }: { x: number; y: number }) {
  const stops = [0.2, 0.5, 0.8, 1, 1.5, 2, 2.5, 3];
  return (
    <g>
      <text x={x} y={y} style={small}>
        M
      </text>
      {stops.map((m, i) => (
        <g key={m}>
          <rect x={x + 12 + i * 26} y={y - 9} width={26} height={10} fill={machColor(m)} />
          <text x={x + 12 + i * 26 + 13} y={y + 11} textAnchor="middle" style={{ fontSize: 8.5, fill: 'var(--muted)' }}>
            {m}
          </text>
        </g>
      ))}
      <line x1={x + 240} x2={x + 240} y1={y - 10} y2={y + 1} stroke="#ffffff" strokeWidth={3} />
      <line x1={x + 240} x2={x + 240} y1={y - 10} y2={y + 1} stroke="#e9b949" strokeWidth={1} />
      <text x={x + 246} y={y} style={small}>
        normal shock
      </text>
    </g>
  );
}

/* =====================================================================
 * 1. Supersonic inlet / diffuser starting (W2019 P1, W2023 P1)
 * ===================================================================== */

/**
 * Three section sketches side by side: the design point, starting by overspeed, and either the opened throat
 * (variable geometry) or the unstarted inlet with its bow shock and spillage. The Mach colouring is computed
 * from the real area ratios with lib/isentropic + lib/inlet; the contraction is drawn exaggerated ×4.
 */
export function InletStartFigure({ M = 1.5, third = 'open-throat' }: { M?: number; third?: 'open-throat' | 'unstarted' }) {
  const uid = useId().replace(/:/g, '');
  const AR = A_Astar(M);
  const Mstart = startingMach(AR);
  const MyStart = shockMy(Mstart);
  const open = throatOpeningFactor(M);
  const spill = unstartMassFlowRatio(M);
  const cy = 102;
  const hIn = 46;
  const panel = (ox: number, kind: 'design' | 'overspeed' | 'open-throat' | 'unstarted', key: string) => {
    const xl = ox + 70;
    const xt = ox + 150;
    const xe = ox + 238;
    const At = kind === 'open-throat' ? open : 1; // throat area / design throat area
    const realA = knots([
      [xl, AR],
      [xt, At],
      [xe, AR * 1.05],
    ]);
    const h = (x: number) => hIn * (1 + 4 * (realA(x) / AR - 1));
    const Minf = kind === 'overspeed' ? Mstart : M;
    const Mfield = (x: number) => {
      const A = realA(x);
      if (kind === 'design') return M_from_A_Astar(Math.max(1, A), x < xt ? 'sup' : 'sub');
      return M_from_A_Astar(Math.max(1, A / At), 'sub');
    };
    const title =
      kind === 'design'
        ? `Design: M∞ = ${M}, isentropic`
        : kind === 'overspeed'
          ? `Overspeed to M∞ = ${r3(Mstart)}`
          : kind === 'open-throat'
            ? `Open the throat by ${r3((open - 1) * 100)} %`
            : `Unstarted at M∞ = ${M}`;
    const bow = kind === 'unstarted' ? xl - 26 : xl;
    return (
      <g key={key}>
        <text x={ox + 8} y={16} style={bold}>
          {title}
        </text>
        {/* approaching free stream */}
        <rect x={ox + 6} y={cy - hIn - 8} width={bow - ox - 6} height={2 * hIn + 16} fill={machColor(Minf)} opacity={0.55} rx={4} />
        {kind === 'unstarted' && (
          <>
            <rect x={bow} y={cy - hIn - 8} width={xl - bow} height={2 * hIn + 16} fill={machColor(shockMy(M))} opacity={0.55} />
            <path d={`M${bow + 6},${cy - hIn - 24} Q${bow - 10},${cy} ${bow + 6},${cy + hIn + 24}`} fill="none" stroke="#fff3c4" strokeWidth={8} filter={`url(#${uid}-glow)`} />
            <path d={`M${bow + 6},${cy - hIn - 24} Q${bow - 10},${cy} ${bow + 6},${cy + hIn + 24}`} fill="none" stroke="#fff" strokeWidth={2.4} />
            <path d={`M${ox + 10},${cy - 40} C${bow},${cy - 40} ${xl - 20},${cy - 54} ${xl + 30},${cy - hIn - 26}`} fill="none" stroke="var(--c4)" strokeWidth={1.6} strokeDasharray="5 3" />
            <path d={`M${ox + 10},${cy + 40} C${bow},${cy + 40} ${xl - 20},${cy + 54} ${xl + 30},${cy + hIn + 26}`} fill="none" stroke="var(--c4)" strokeWidth={1.6} strokeDasharray="5 3" />
            <text x={xl + 34} y={cy - hIn - 22} style={{ ...small, fill: 'var(--c4)' }}>
              spillage
            </text>
          </>
        )}
        <text x={ox + 10} y={cy + 4} style={{ ...txt, fontWeight: 600, fill: '#10131a' }}>
          M∞ {r3(Minf)}
        </text>
        <Duct id={uid} h={h} M={Mfield} xa={xl} xb={xe} cy={cy} shocks={kind === 'overspeed' || kind === 'open-throat' ? [xl + 2] : []} />
        {kind === 'open-throat' && (
          <>
            {([1, -1] as const).map((s) => (
              <path
                key={s}
                d={Array.from({ length: 45 }, (_, i) => xl + ((xe - xl) * i) / 44)
                  .map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${(cy - s * hIn * (1 + 4 * (knots([[xl, AR], [xt, 1], [xe, AR * 1.05]])(x) / AR - 1))).toFixed(1)}`)
                  .join('')}
                fill="none"
                stroke="var(--text)"
                strokeDasharray="3 3"
                strokeWidth={1.2}
              />
            ))}
          </>
        )}
        <line x1={xt} x2={xt} y1={cy - h(xt)} y2={cy + h(xt)} stroke="var(--c3)" strokeWidth={2} strokeDasharray="3 2" />
        <text x={xt - 14} y={cy + hIn + 30} style={small}>
          {kind === 'open-throat' ? 'A_t,new' : 'A_t'}: M = 1
        </text>
        <text x={xl - 10} y={cy - hIn - 14} style={small}>
          A_in
        </text>
        <text x={ox + 8} y={190} style={mut}>
          {kind === 'design'
            ? `A_in/A_t = A/A*(${M}) = ${r4(AR)}`
            : kind === 'overspeed'
              ? `shock on lip, M_y = ${r3(MyStart)}, A*_y = A_t`
              : kind === 'open-throat'
                ? `A_t,new/A_t = p0x/p0y = ${r4(open)}`
                : `throat choked at p0y: ṁ ratio ${r3(spill)}`}
        </text>
      </g>
    );
  };
  return (
    <Figure caption="Inlet starting, drawn as sections with the flow coloured by Mach number. Left: the design (isentropic) state. Middle: the shock parked on the lip, with the flow behind it just choking the throat, so A*_y = A_t. Right: the other way to swallow the shock (dashed = the old wall), or the inlet before it starts. The contraction is exaggerated ×4.">
      <svg viewBox="0 0 800 222" style={svgStyle}>
        <MetalDefs id={uid} />
        {panel(0, 'design', 'p1')}
        {panel(268, 'overspeed', 'p2')}
        {panel(536, third, 'p3')}
        <MachKey x={240} y={210} />
      </svg>
    </Figure>
  );
}

/* =====================================================================
 * 2. Two-throat channel = blocked supersonic wind tunnel (F2023 P1)
 * ===================================================================== */

/**
 * The F2023 P1(c) answer sketch: every region labelled subsonic / sonic / supersonic, and both shocks drawn
 * where the lib puts them (twoThroatSolution in sims/simsF.tsx). `scenario="started"` shows the
 * supersonic-through-both-throats state that cannot be reached with fixed areas.
 */
export function TwoThroatTunnelFigure({ scenario = 'blocked' }: { scenario?: 'blocked' | 'started' }) {
  const uid = useId().replace(/:/g, '');
  const sol = twoThroatSolution(1, 1.5, 5, 0.5);
  const cy = 110;
  const kpx = 11; // px of half-height per cm²
  const X = { c0: 80, t1: 180, i0: 280, i1: 420, t2: 500, e0: 600, e1: 700 };
  const A = knots([
    [X.c0, 5],
    [X.t1, 1],
    [X.i0, 5],
    [X.i1, 5],
    [X.t2, 1.5],
    [X.e0, 5],
    [X.e1, 5],
  ]);
  const h = (x: number) => A(x) * kpx;
  const xOfArea = (a: number, xa: number, xb: number) => bisect((x) => A(x) - a, xa, xb);
  const st = scenario === 'blocked' ? sol.blocked : sol.started;
  const xs = st.shockAreas.map((a, i) => xOfArea(a, i === 0 && scenario === 'blocked' ? X.t1 : X.t2, i === 0 && scenario === 'blocked' ? X.i0 : X.e0));
  const Mf = (x: number) => st.machAt(A(x), x < X.t1 ? 0 : x < X.i0 ? 1 : x < X.t2 ? 2 : 3, xs, x);
  const zones =
    scenario === 'blocked'
      ? [
          { x: (X.c0 + X.t1) / 2, n: '①', l: 'M < 1' },
          { x: (X.t1 + xs[0]) / 2, n: '③', l: 'M > 1' },
          { x: (xs[0] + X.t2) / 2 + 10, n: '④', l: `M < 1 (≈ ${r3(sol.blocked.Minter)})` },
          { x: (X.t2 + xs[1]) / 2, n: '⑥', l: 'M > 1' },
          { x: (xs[1] + X.e1) / 2, n: '⑦', l: 'M < 1' },
        ]
      : [
          { x: (X.c0 + X.t1) / 2, n: '', l: 'M < 1' },
          { x: (X.i0 + X.i1) / 2, n: '', l: `M > 1 (${r3(sol.started.Minter)})` },
          { x: (xs[0] + X.e1) / 2, n: '', l: 'M < 1' },
        ];
  return (
    <Figure
      caption={
        scenario === 'blocked'
          ? `F2023 P1(c), the "blocked" tunnel. Shock 1 is in the diverging part after t₁ (M_x = ${r3(sol.Mx1)}, at A = ${r3(sol.blocked.shockAreas[0])} cm²). Shock 2 is in the diverging part after t₂ (exact: A ≈ ${r3(sol.blocked.shockAreas[1])} cm², M_x ≈ ${r3(sol.blocked.Mx2)}). Regions: ① M < 1, ② M = 1, ③ M > 1, ④ M < 1, ⑤ M = 1, ⑥ M > 1, ⑦ M < 1.`
          : `The "started" state: supersonic through both throats (M = ${r3(sol.started.Mt2)} at t₂) and one shock after t₂. It satisfies the equations, but with fixed areas you can never get there: shock 1 cannot be swallowed through t₂.`
      }
    >
      <svg viewBox="0 0 800 240" style={svgStyle}>
        <MetalDefs id={uid} />
        <rect x={8} y={30} width={X.c0 - 8} height={160} rx={6} fill={`url(#${uid}-metal)`} stroke="#394150" />
        <rect x={16} y={40} width={X.c0 - 16} height={140} rx={4} fill={machColor(0.02)} />
        <text x={20} y={60} style={{ ...bold, fill: '#fff' }}>
          tank
        </text>
        <text x={20} y={76} style={{ fontSize: 10, fill: '#dfe7ff' }}>
          10 bar
        </text>
        <text x={20} y={90} style={{ fontSize: 10, fill: '#dfe7ff' }}>
          300 K
        </text>
        <rect x={X.e1} y={30} width={92} height={160} rx={6} fill={`url(#${uid}-metal)`} stroke="#394150" />
        <rect x={X.e1} y={40} width={84} height={140} rx={4} fill={machColor(0.08)} />
        <text x={X.e1 + 8} y={60} style={{ ...bold, fill: '#fff' }}>
          p_b = 5 bar
        </text>
        <Duct id={uid} h={h} M={Mf} xa={X.c0} xb={X.e1} cy={cy} shocks={xs} />
        {(scenario === 'blocked' ? [X.t1, X.t2] : [X.t1]).map((x, i) => (
          <g key={x}>
            <line x1={x} x2={x} y1={cy - h(x)} y2={cy + h(x)} stroke="var(--c3)" strokeWidth={2} strokeDasharray="3 2" />
            <text x={x - 20} y={cy + h(x) + 24} style={{ ...small, fill: 'var(--text)', fontWeight: 600 }}>
              {scenario === 'blocked' ? (i === 0 ? '② ' : '⑤ ') : ''}M = 1
            </text>
          </g>
        ))}
        {xs.map((x, i) => (
          <text key={x} x={x - 22} y={cy - h(x) - 16} style={bold}>
            {scenario === 'blocked' ? `shock ${i + 1}` : 'shock'}
          </text>
        ))}
        {zones.map((z, i) => (
          <text key={i} x={z.x} y={cy - 2} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: '#10131a' }}>
            {z.n}
            <tspan x={z.x} dy={14}>
              {z.l}
            </tspan>
          </text>
        ))}
        <text x={X.t1 - 26} y={cy + 1 * kpx + 38} style={small}>
          A_t1 = 1 cm²
        </text>
        <text x={X.t2 - 30} y={cy + 1.5 * kpx + 38} style={small}>
          A_t2 = 1.5 cm²
        </text>
        <MachKey x={240} y={228} />
      </svg>
    </Figure>
  );
}
