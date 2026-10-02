/* Group C figures — Fanno (Ch 10) and Rayleigh (Ch 11) setups, T–s paths and helper plots. Physics from ../lib. */
import { useId } from 'react';
import { Figure } from '../../../core/ui';
import { Plot, sample } from '../../../core/Plot';
import * as fa from '../lib/fanno';
import * as ra from '../lib/rayleigh';
import * as ise from '../lib/isentropic';
import * as ns from '../lib/normalShock';
import { machColor } from '../sims/common';
import { FlowSection3D, type FieldPoint } from '../viz/FlowSection3D';

const txt = { fontSize: 12, fill: 'var(--text)' } as const;
const mut = { fontSize: 11, fill: 'var(--muted)' } as const;

const lines = (s: string | undefined, x: number, y: number, style: object, anchor: 'start' | 'middle' | 'end' = 'middle') =>
  s
    ? s.split('|').map((l, i) => (
        <text key={i} x={x} y={y + i * 14} textAnchor={anchor} style={style}>
          {l.trim()}
        </text>
      ))
    : null;

/* ================================================================
 * Realistic cut-away SVG of reservoir → nozzle → duct → back chamber.
 * Flow coloured by Mach (machColor), steel walls with hatched cut faces,
 * roughened wall for friction, glowing coils for heat, glowing shock.
 * ================================================================ */
export function FannoDuctSetupFigure({
  nozzle = 'none',
  reservoir,
  Min = 0.5,
  Mout = 0.6,
  shockAt,
  Mx,
  My,
  heat = false,
  friction = false,
  inlet,
  exit,
  back,
  duct,
  extension,
  caption,
}: {
  nozzle?: 'cd' | 'conv' | 'none';
  reservoir?: string;
  Min?: number;
  Mout?: number;
  /** shock position as a fraction of the duct (0 = inlet, 1 = exit) */
  shockAt?: number;
  Mx?: number;
  My?: number;
  heat?: boolean;
  friction?: boolean;
  inlet?: string;
  exit?: string;
  back?: string;
  duct?: string;
  extension?: string;
  caption?: string;
}) {
  const id = useId().replace(/:/g, '');
  const cy = 118;
  const hD = 26; // duct half-height (inner)
  const tW = 11; // wall thickness
  const hasRes = !!reservoir || nozzle !== 'none';
  const xRes1 = hasRes ? 96 : 20;
  const xThroat = nozzle === 'cd' ? 150 : nozzle === 'conv' ? 170 : xRes1;
  const xd0 = nozzle === 'none' ? (hasRes ? 110 : 30) : nozzle === 'cd' ? 214 : 170;
  const xd1 = back ? 560 : extension ? 540 : 640;
  const h = (x: number) => {
    if (nozzle === 'none' || x >= xd0) return hD;
    const hIn = 62;
    const hT = nozzle === 'cd' ? 13 : hD;
    if (x <= xThroat) {
      const u = (x - xRes1) / (xThroat - xRes1);
      return hT + (hIn - hT) * 0.5 * (1 + Math.cos(Math.PI * u));
    }
    const u = (x - xThroat) / (xd0 - xThroat);
    return hT + (hD - hT) * 0.5 * (1 - Math.cos(Math.PI * u));
  };
  const xs: number[] = [];
  for (let x = xRes1; x <= xd1 + 0.01; x += 3) xs.push(x);
  const inner = (sgn: number) => xs.map((x) => `${x.toFixed(1)},${(cy - sgn * h(x)).toFixed(1)}`);
  const outer = (sgn: number) => xs.map((x) => `${x.toFixed(1)},${(cy - sgn * (h(x) + tW)).toFixed(1)}`).reverse();
  const wallPath = (sgn: number) => `M${inner(sgn).join(' L')} L${outer(sgn).join(' L')} Z`;
  const flowPath = `M${inner(1).join(' L')} L${inner(-1).reverse().join(' L')} Z`;

  // Mach colour stops along x (reservoir ≈ 0 → throat → duct inlet → shock → exit)
  const X0 = hasRes ? 16 : xRes1;
  const span = xd1 - X0;
  const off = (x: number) => Math.min(1, Math.max(0, (x - X0) / span));
  const stops: [number, number][] = [];
  if (hasRes) stops.push([off(X0), 0.02], [off(xRes1), 0.08]);
  if (nozzle === 'cd' || nozzle === 'conv') stops.push([off(xThroat), nozzle === 'cd' || Min >= 0.999 ? 1 : Min]);
  stops.push([off(xd0), Min]);
  if (shockAt !== undefined && Mx && My) {
    const xsP = xd0 + shockAt * (xd1 - xd0);
    stops.push([off(xsP) - 0.001, Mx], [off(xsP) + 0.001, My]);
  }
  stops.push([1, Mout]);
  const xShock = shockAt !== undefined ? xd0 + shockAt * (xd1 - xd0) : undefined;

  return (
    <Figure caption={caption}>
      <svg viewBox="0 0 690 240" style={{ width: '100%', height: 'auto', maxWidth: 690 }}>
        <defs>
          <linearGradient id={`st${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef1f5" />
            <stop offset="0.35" stopColor="#a9b0bb" />
            <stop offset="0.6" stopColor="#6c7480" />
            <stop offset="1" stopColor="#c9ced6" />
          </linearGradient>
          <pattern id={`hx${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#8a929e" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#4d545e" strokeWidth="1.4" />
          </pattern>
          <linearGradient id={`fl${id}`} gradientUnits="userSpaceOnUse" x1={X0} y1="0" x2={xd1} y2="0">
            {stops.map(([o, M], i) => (
              <stop key={i} offset={Math.min(1, Math.max(0, o))} stopColor={machColor(M)} />
            ))}
          </linearGradient>
          <linearGradient id={`sh${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="1" stopColor="#000" stopOpacity="0.35" />
          </linearGradient>
          <radialGradient id={`gl${id}`}>
            <stop offset="0" stopColor="#fff3c4" />
            <stop offset="0.4" stopColor="#ff9a2a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ff4a1a" stopOpacity="0" />
          </radialGradient>
          <filter id={`bl${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        {/* reservoir tank */}
        {hasRes && (
          <g>
            <rect x={6} y={34} width={xRes1 - 2} height={168} rx={20} fill={`url(#st${id})`} stroke="#4d545e" />
            <rect x={16} y={cy - 62} width={xRes1 - 14} height={124} rx={10} fill={machColor(0.03)} />
            <rect x={16} y={cy - 62} width={xRes1 - 14} height={124} rx={10} fill={`url(#sh${id})`} />
            {lines(reservoir, (16 + xRes1) / 2, cy - 30, { fontSize: 11, fill: '#fff', fontWeight: 600 })}
          </g>
        )}
        {/* flow on the cut plane */}
        <path d={flowPath} fill={`url(#fl${id})`} />
        <path d={flowPath} fill={`url(#sh${id})`} />
        {/* streamlines */}
        {[-0.6, -0.2, 0.2, 0.6].map((k) => (
          <path
            key={k}
            d={`M${xs.map((x) => `${x.toFixed(1)},${(cy + k * h(x)).toFixed(1)}`).join(' L')}`}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.35"
            strokeWidth="0.8"
            strokeDasharray="10 7"
          />
        ))}
        {/* heater coils */}
        {heat &&
          Array.from({ length: 12 }, (_, i) => {
            const x = xd0 + 40 + i * ((xd1 - xd0 - 80) / 11);
            return (
              <g key={i}>
                <ellipse cx={x} cy={cy - hD - tW - 5} rx={9} ry={6} fill={`url(#gl${id})`} />
                <ellipse cx={x} cy={cy + hD + tW + 5} rx={9} ry={6} fill={`url(#gl${id})`} />
                <rect x={x - 3} y={cy - hD - tW - 9} width={6} height={8} rx={2} fill="#c0392b" stroke="#ffb36b" strokeWidth={0.8} />
                <rect x={x - 3} y={cy + hD + tW + 1} width={6} height={8} rx={2} fill="#c0392b" stroke="#ffb36b" strokeWidth={0.8} />
              </g>
            );
          })}
        {/* walls with cut faces */}
        {[1, -1].map((sgn) => (
          <g key={sgn}>
            <path d={wallPath(sgn)} fill={`url(#hx${id})`} stroke="#3c424a" strokeWidth={1} />
          </g>
        ))}
        {/* outer steel skin (depth cue) */}
        <path d={`M${xs.map((x) => `${x.toFixed(1)},${(cy - h(x) - tW).toFixed(1)}`).join(' L')}`} fill="none" stroke="#e7ebf0" strokeWidth={2} />
        {/* friction roughness */}
        {friction &&
          [1, -1].map((sgn) => (
            <path
              key={sgn}
              d={`M${Array.from({ length: Math.floor((xd1 - xd0) / 4) }, (_, i) => {
                const x = xd0 + i * 4;
                return `${x},${cy - sgn * (hD - (i % 2 ? 2.4 : 0))}`;
              }).join(' L')}`}
              fill="none"
              stroke="#2d3238"
              strokeWidth={1.3}
            />
          ))}
        {/* flanges */}
        {[xd0, xd1].map((x, i) => (
          <rect key={i} x={x - 4} y={cy - hD - tW - 8} width={8} height={2 * (hD + tW + 8)} rx={2} fill={`url(#st${id})`} stroke="#4d545e" />
        ))}
        {/* extension to L* */}
        {extension && (
          <g>
            <rect x={xd1 + 4} y={cy - hD - tW} width={70} height={2 * (hD + tW)} fill="none" stroke="var(--muted)" strokeDasharray="5 4" />
            <text x={xd1 + 78} y={cy + 4} style={{ ...txt, fontWeight: 700 }}>
              *
            </text>
            {lines(extension, xd1 + 40, cy + hD + tW + 18, mut)}
          </g>
        )}
        {/* back chamber */}
        {back && (
          <g>
            <rect x={xd1 + 4} y={34} width={680 - xd1 - 4} height={168} rx={16} fill={`url(#st${id})`} stroke="#4d545e" />
            <rect x={xd1 + 12} y={cy - 62} width={680 - xd1 - 20} height={124} rx={8} fill={machColor(Math.min(Mout, 0.3))} />
            <rect x={xd1 + 12} y={cy - 62} width={680 - xd1 - 20} height={124} rx={8} fill={`url(#sh${id})`} />
            {lines(back, (xd1 + 680) / 2, cy - 20, { fontSize: 11, fill: '#fff', fontWeight: 600 })}
          </g>
        )}
        {/* shock */}
        {xShock !== undefined && (
          <g>
            <line x1={xShock} x2={xShock} y1={cy - hD} y2={cy + hD} stroke="#fff6c8" strokeWidth={7} filter={`url(#bl${id})`} />
            <line x1={xShock} x2={xShock} y1={cy - hD} y2={cy + hD} stroke="#fff" strokeWidth={2} />
            <text x={xShock} y={cy - hD - tW - 26} textAnchor="middle" style={{ ...txt, fontWeight: 700 }}>
              x | y
            </text>
          </g>
        )}
        {/* stations */}
        {[
          [xd0, '1'],
          [xd1, '2'],
        ].map(([x, l]) => (
          <g key={l as string}>
            <circle cx={x as number} cy={cy + hD + tW + 26} r={9} fill="var(--surface)" stroke="var(--text)" />
            <text x={x as number} y={cy + hD + tW + 30} textAnchor="middle" style={{ ...txt, fontWeight: 700 }}>
              {l}
            </text>
          </g>
        ))}
        {nozzle === 'cd' && lines('throat', xThroat, cy + 34, mut)}
        {lines(inlet, xd0 + 6, 18, txt, 'start')}
        {lines(exit, xd1 - 6, 18, txt, 'end')}
        {lines(duct, (xd0 + xd1) / 2, cy + hD + tW + 52, mut)}
        {heat && lines('q (heat added)', (xd0 + xd1) / 2, cy - hD - tW - 20, { ...txt, fill: '#e8742a', fontWeight: 700 })}
      </svg>
    </Figure>
  );
}

/* ================================================================
 * 4fL*-over-D against M (Table A4's first column) with the 0.8215 asymptote.
 * ================================================================ */
export function FannoFLPlot({ mark }: { mark?: number[] }) {
  const sub = sample((M) => fa.fLmax(M), 0.2, 1, 200);
  const sup = sample((M) => fa.fLmax(M), 1, 5, 200);
  return (
    <Figure caption="4fL*/D (Table A4). Subsonic: grows without bound as M → 0 (a slow flow needs a very long pipe to choke). Supersonic: saturates at 0.8215 — even an infinitely fast flow chokes within 4fL/D = 0.82.">
      <Plot
        x={[0, 5]}
        y={[0, 3]}
        height={260}
        xLabel="Mach number M"
        yLabel="4fL*/D"
        series={[
          { points: sub, color: 'var(--c1)', width: 3, label: 'subsonic branch' },
          { points: sup, color: 'var(--c2)', width: 3, label: 'supersonic branch' },
        ]}
        hlines={[{ y: fa.fLmaxInfinity(), label: 'M → ∞ limit 0.8215', color: 'var(--c4)' }]}
        vlines={[{ x: 1, label: 'M = 1' }]}
        dots={(mark ?? []).map((M) => ({ x: M, y: fa.fLmax(M), color: machColor(M), label: `M = ${M}: ${fa.fLmax(M).toFixed(4)}` }))}
      />
    </Figure>
  );
}

/* ================================================================
 * T–s path figure along a Fanno or Rayleigh line (static).
 * ================================================================ */
export function TsPathFigure({
  kind,
  segments = [],
  shock,
  dots = [],
  caption,
}: {
  kind: 'fanno' | 'rayleigh';
  /** Mach-number segments travelled along the line (e.g. [[2.94, 1.544]]) */
  segments?: [number, number][];
  /** normal-shock jump [Mx, My] (dashed) */
  shock?: [number, number];
  dots?: { M: number; label: string }[];
  caption?: string;
}) {
  const k = 0.4 / 1.4;
  const Ts = (M: number) =>
    kind === 'fanno'
      ? { x: Math.log(fa.T_Tstar(M)) - k * Math.log(fa.p_pstar(M)), y: fa.T_Tstar(M) }
      : { x: Math.log(ra.T_Tstar(M)) - k * Math.log(ra.p_pstar(M)), y: ra.T_Tstar(M) };
  const lineSub = sample((M) => M, kind === 'fanno' ? 0.2 : 0.15, 1, 200).map((p) => Ts(p.x));
  const lineSup = sample((M) => M, 1, 4, 200).map((p) => Ts(p.x));
  const segs = segments.map(([a, b]) => sample((M) => M, a, b, 120).map((p) => Ts(p.x)));
  const all = [...lineSub, ...lineSup];
  const xMin = Math.max(-2.2, Math.min(...all.map((p) => p.x)));
  const yMax = Math.max(...all.map((p) => p.y));
  return (
    <Figure caption={caption}>
      <Plot
        x={[xMin, 0.12]}
        y={[0, Math.min(1.3, yMax * 1.05)]}
        height={280}
        xLabel="(s − s*) / c_p"
        yLabel="T / T*"
        series={[
          { points: lineSub, color: 'var(--muted)', width: 1.5, label: `${kind === 'fanno' ? 'Fanno' : 'Rayleigh'} line, subsonic branch` },
          { points: lineSup, color: 'var(--muted)', width: 1.5, dash: true, label: 'supersonic branch' },
          ...segs.map((pts, i) => ({ points: pts, color: 'var(--c2)', width: 4, label: i === 0 ? (kind === 'fanno' ? 'friction' : 'heating') : undefined })),
        ]}
        dots={[{ x: 0, y: 1, color: 'var(--text)', r: 3.5, label: '* (M = 1)' }, ...dots.map((d) => ({ ...Ts(d.M), color: machColor(d.M), label: d.label }))]}
      >
        {(sx, sy) =>
          shock ? (
            <line x1={sx(Ts(shock[0]).x)} y1={sy(Ts(shock[0]).y)} x2={sx(Ts(shock[1]).x)} y2={sy(Ts(shock[1]).y)} stroke="var(--c4)" strokeWidth={2.5} strokeDasharray="6 4" />
          ) : null
        }
      </Plot>
    </Figure>
  );
}

/* ================================================================
 * PS7 P5: exit pressure against the assumed shock position (the iteration).
 * ================================================================ */
export function FannoShockTrialsPlot() {
  const fs = fa.fLmax(3);
  const pStar = (300 * ise.p_p0(3)) / fa.p_pstar(3);
  const pe = (xD: number) => {
    const Mx = fa.M_from_fLmax(fs - 0.01 * xD, 'sup');
    const My = ns.My(Mx);
    const rem = fa.fLmax(My) - 0.01 * (60 - xD);
    if (rem < 0) return NaN;
    return pStar * fa.p_pstar(fa.M_from_fLmax(rem, 'sub'));
  };
  const curve = sample(pe, 0, 36, 200);
  const trials: [number, number, string][] = [
    [20, 56.77, 'official 20D: 56.8'],
    [25, 52.59, '25D: 52.6'],
    [28, 50.33, '28D: 50.3 (official)'],
    [30, 49.2, "30D: ≈49 (Anthony, old sol'n)"],
  ];
  return (
    <Figure caption="Exit pressure against the assumed shock position (exact curve from the Fanno and shock relations). The curve is shallow: 28D and 30D bracket p_exit = 50 kPa; the exact answer is 28.9D.">
      <Plot
        x={[0, 36]}
        y={[40, 75]}
        height={260}
        xLabel="assumed shock position x_s / D"
        yLabel="p_exit [kPa]"
        series={[{ points: curve, color: 'var(--c1)', width: 3, label: 'exact p_exit(x_s)' }]}
        hlines={[{ y: 50, label: 'p_b = 50 kPa', color: 'var(--c2)' }]}
        vlines={[{ x: 28.95, label: 'exact 28.9D', color: 'var(--c4)' }]}
        dots={trials.map(([x, y, l]) => ({ x, y, label: l, color: 'var(--c3)', r: 4 }))}
      />
    </Figure>
  );
}

/* ================================================================
 * PS7 P7: p and V always change in opposite directions in a Fanno duct.
 * ================================================================ */
export function FannoSignsFigure() {
  const prof = (M1: number, fL: number) => {
    const br = M1 < 1 ? 'sub' : 'sup';
    const fs = fa.fLmax(M1);
    return sample((u) => u, 0, 1, 120).map((pt) => {
      const M = fa.M_from_fLmax(Math.max(0, fs - pt.x * fL), br);
      return { x: pt.x, p: fa.p_pstar(M) / fa.p_pstar(M1), V: fa.V_Vstar(M) / fa.V_Vstar(M1) };
    });
  };
  const a = prof(0.5, 1.0);
  const b = prof(2.0, 0.3);
  return (
    <Figure caption="Two Fanno ducts from the lib. Subsonic (M₁ = 0.5, 4fL/D = 1.0): V rises and p falls. Supersonic (M₁ = 2, 4fL/D = 0.3): V falls and p rises. In both, dp and dV have opposite signs.">
      <div className="twocol">
        <Plot
          x={[0, 1]}
          y={[0, 2]}
          height={220}
          xLabel="x / L (subsonic, M₁ = 0.5)"
          yLabel="ratio to inlet"
          series={[
            { points: a.map((p) => ({ x: p.x, y: p.V })), color: 'var(--c2)', width: 3, label: 'V / V₁' },
            { points: a.map((p) => ({ x: p.x, y: p.p })), color: 'var(--c1)', width: 3, label: 'p / p₁' },
          ]}
        />
        <Plot
          x={[0, 1]}
          y={[0, 2]}
          height={220}
          xLabel="x / L (supersonic, M₁ = 2)"
          yLabel="ratio to inlet"
          series={[
            { points: b.map((p) => ({ x: p.x, y: p.V })), color: 'var(--c2)', width: 3, label: 'V / V₁' },
            { points: b.map((p) => ({ x: p.x, y: p.p })), color: 'var(--c1)', width: 3, label: 'p / p₁' },
          ]}
        />
      </div>
    </Figure>
  );
}

/* ================================================================
 * PS8 P1: maximum heat against inlet Mach.
 * ================================================================ */
export function QmaxPlotFigure() {
  const g = 1.4;
  const qT1 = (M: number) => (M * M - 1) ** 2 / (2 * M * M * (g + 1));
  const qT01 = (M: number) => 1 / ra.T0_T0star(M) - 1; // = q*/(cp T01)
  return (
    <Figure caption="Maximum (choking) heat addition. Normalised by the static T₁ it grows without bound as M₁ → ∞; normalised by the stagnation T₀₁ it levels off at 1/(γ² − 1) = 1.042.">
      <Plot
        x={[0, 6]}
        y={[0, 3]}
        height={260}
        xLabel="inlet Mach M₁"
        yLabel="q_max / (c_p T)"
        series={[
          { points: sample(qT1, 0.25, 6, 300), color: 'var(--c1)', width: 3, label: 'q_max / (c_p T₁)' },
          { points: sample(qT01, 0.25, 6, 300), color: 'var(--c3)', width: 3, label: 'q_max / (c_p T₀₁)' },
        ]}
        hlines={[{ y: 1 / (g * g - 1), label: '1/(γ² − 1) = 1.042', color: 'var(--c3)' }]}
        vlines={[{ x: 1, label: 'M₁ = 1: no heat can be added' }]}
      />
    </Figure>
  );
}

/* ================================================================
 * Notes §10.4.1 back-pressure ladder (realistic gauge-style SVG).
 * ================================================================ */
export function BackPressureLadderFigure({
  p0 = 792.6,
  levels = [700, 408, 331, 177],
  unit = 'kPa',
  pb,
}: {
  p0?: number;
  levels?: number[];
  unit?: string;
  pb?: number;
}) {
  const id = useId().replace(/:/g, '');
  const top = 30;
  const bot = 250;
  const y = (p: number) => bot - (p / p0) * (bot - top);
  const names = [
    'subsonic everywhere (not choked; ṁ depends on p_b)',
    'throat choked; normal shock in the diverging nozzle',
    'supersonic into the duct; normal shock inside the duct',
    'supersonic through the whole duct; oblique shocks outside',
    'supersonic through the whole duct; expansion fans outside',
  ];
  const bounds = [p0, ...levels, 0];
  const colors = [machColor(0.4), machColor(0.8), machColor(1.3), machColor(1.9), machColor(2.6)];
  return (
    <Figure caption={`The back-pressure ladder for the notes' example (Min = 2 duct, p₀ = ${p0} ${unit}). Four "test" calculations give the rungs; the given p_b tells you which regime you are in without any iteration.`}>
      <svg viewBox="0 0 640 270" style={{ width: '100%', height: 'auto', maxWidth: 640 }}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="1">
            <stop offset="0" stopColor="#6c7480" />
            <stop offset="0.5" stopColor="#eef1f5" />
            <stop offset="1" stopColor="#6c7480" />
          </linearGradient>
        </defs>
        <rect x={60} y={top - 8} width={44} height={bot - top + 16} rx={8} fill={`url(#g${id})`} stroke="#4d545e" />
        {bounds.slice(0, -1).map((b, i) => (
          <g key={i}>
            <rect x={68} y={y(b)} width={28} height={y(bounds[i + 1]) - y(b)} fill={colors[i]} />
            <text x={120} y={(y(b) + y(bounds[i + 1])) / 2 + 4} style={txt}>
              {names[i]}
            </text>
          </g>
        ))}
        {levels.map((p) => (
          <g key={p}>
            <line x1={56} x2={108} y1={y(p)} y2={y(p)} stroke="var(--text)" strokeWidth={1.5} />
            <text x={50} y={y(p) + 4} textAnchor="end" style={{ ...txt, fontWeight: 700 }}>
              {p}
            </text>
          </g>
        ))}
        <text x={50} y={y(p0) + 4} textAnchor="end" style={mut}>
          {p0}
        </text>
        {pb !== undefined && (
          <g>
            <path d={`M108,${y(pb)} l14,-7 v14 z`} fill="var(--c2)" />
            <line x1={60} x2={108} y1={y(pb)} y2={y(pb)} stroke="var(--c2)" strokeWidth={3} />
            <text x={20} y={y(pb) + 16} style={{ ...txt, fill: 'var(--c2)', fontWeight: 700 }}>
              p_b = {pb}
            </text>
          </g>
        )}
        <text x={82} y={16} textAnchor="middle" style={mut}>
          p_b [{unit}]
        </text>
      </svg>
    </Figure>
  );
}

/* ================================================================
 * 3-D sections built from the lib: PS8 P4 (nozzle → heated duct → shock)
 * and the Final B ramjet.
 * ================================================================ */

function cosBlend(a: number, b: number, u: number) {
  const t = Math.min(1, Math.max(0, u));
  return a + (b - a) * 0.5 * (1 - Math.cos(Math.PI * t));
}

/** PS8 P4: A/A* = 4 nozzle, supersonic Rayleigh heating 2.94 → 1.544, normal shock at the duct end (T_y = 560 K). */
export function RayleighNozzleShockFigure() {
  const g = 1.4;
  const M1 = ise.M_from_A_Astar(4, 'sup');
  const T01 = 450;
  const T0s = T01 / ra.T0_T0star(M1);
  const Ts = (T01 * ise.T_T0(M1)) / ra.T_Tstar(M1);
  const M2y = ra.M_from_T_Tstar(560 / Ts, 'sub-low');
  const M2x = ns.My(M2y);
  const T02 = T0s * ra.T0_T0star(M2x);
  const qTot = T02 / T01 - 1;
  const area = (x: number) => (x <= 0.35 ? cosBlend(2.5, 1, x / 0.35) : x <= 1 ? cosBlend(1, 4, (x - 0.35) / 0.65) : 4);
  const xh1 = 2.3;
  const field = (x: number): FieldPoint => {
    let M: number;
    let T0 = T01;
    let p: number;
    if (x <= 1) {
      M = ise.M_from_A_Astar(Math.max(1, area(x)), x <= 0.35 ? 'sub' : 'sup');
      p = ise.p_p0(M);
    } else if (x <= xh1) {
      const u = (x - 1) / (xh1 - 1);
      T0 = T01 * (1 + qTot * u);
      M = ra.M_from_T0_T0star(T0 / T0s, 'sup');
      p = (ise.p_p0(M1) * ra.p_pstar(M)) / ra.p_pstar(M1);
    } else {
      M = M2y;
      T0 = T02;
      p = (ise.p_p0(M1) * ra.p_pstar(M2x) * ns.py_px(M2x)) / ra.p_pstar(M1);
    }
    return { M, p: Math.min(1, p * 8), T: (T0 * ise.T_T0(M, g)) / T02 };
  };
  return (
    <Figure caption={`PS8 P4 from the lib: A/A* = 4 nozzle (M₁ = ${M1.toFixed(2)}), heating decelerates the supersonic flow to Mₓ = ${M2x.toFixed(3)}, and a normal shock at the duct end drops it to M_y = ${M2y.toFixed(3)} with T_y = 560 K. Drag to rotate.`}>
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={2.6}
        pipeStart={1}
        profile={(x) => 0.11 * Math.sqrt(area(x))}
        field={field}
        shocks={[xh1]}
        heatZone={[1.05, xh1 - 0.05]}
        plume={{ kind: 'subsonic' }}
        labels={[
          { x: 0.35, text: 'throat · M = 1' },
          { x: 1, text: `duct inlet · M = ${M1.toFixed(2)}`, side: 'bottom' },
          { x: 1.65, text: `q = ${(1.005 * (T02 - T01)).toFixed(1)} kJ/kg` },
          { x: xh1, text: `shock · ${M2x.toFixed(3)} → ${M2y.toFixed(3)}`, side: 'bottom' },
        ]}
        height={280}
      />
    </Figure>
  );
}

/** Final B ramjet: M∞ = 3 inlet, shock at A = 0.4, subsonic diffuser to A = 0.6, Rayleigh combustor (q = 500 kJ/kg), nozzle. */
export function RamjetSectionFigure() {
  const T0in = 700;
  const Astar1 = 1 / ise.A_Astar(3);
  const Ash = 0.4;
  const Mx = ise.M_from_A_Astar(Ash / Astar1, 'sup');
  const r0 = ns.p0y_p0x(Mx);
  const Astar2 = Astar1 / r0;
  const Mc1 = ise.M_from_A_Astar(0.6 / Astar2, 'sub');
  const T0s = T0in / ra.T0_T0star(Mc1);
  const T02 = T0in + 500 / 1;
  const Mc2 = ra.M_from_T0_T0star(T02 / T0s, 'sub');
  const p0c2 = (r0 * ra.p0_p0star(Mc2)) / ra.p0_p0star(Mc1);
  const Astar3 = 0.6 / ise.A_Astar(Mc2);
  const Me = ise.M_from_p_p0(ise.p_p0(3) / p0c2);
  const Aexit = Astar3 * ise.A_Astar(Me);
  // axial layout
  const X = { thr1: 0.6, sh: 1.0, cb0: 1.35, cb1: 2.15, thr2: 2.45, ex: 3.1 };
  const area = (x: number) => {
    if (x <= X.thr1) return cosBlend(1, Astar1, x / X.thr1);
    if (x <= X.cb0) return cosBlend(Astar1, 0.6, (x - X.thr1) / (X.cb0 - X.thr1));
    if (x <= X.cb1) return 0.6;
    if (x <= X.thr2) return cosBlend(0.6, Astar3, (x - X.cb1) / (X.thr2 - X.cb1));
    return cosBlend(Astar3, Aexit, (x - X.thr2) / (X.ex - X.thr2));
  };
  const field = (x: number): FieldPoint => {
    const A = area(x);
    let M: number;
    let T0 = T0in;
    let p0 = 1;
    if (x <= X.thr1) M = ise.M_from_A_Astar(Math.max(1, A / Astar1), 'sup');
    else if (x <= X.sh) M = ise.M_from_A_Astar(Math.max(1, A / Astar1), 'sup');
    else if (x <= X.cb0) {
      M = ise.M_from_A_Astar(Math.max(1, A / Astar2), 'sub');
      p0 = r0;
    } else if (x <= X.cb1) {
      const u = (x - X.cb0) / (X.cb1 - X.cb0);
      T0 = T0in + 500 * u;
      M = ra.M_from_T0_T0star(T0 / T0s, 'sub');
      p0 = (r0 * ra.p0_p0star(M)) / ra.p0_p0star(Mc1);
    } else {
      M = ise.M_from_A_Astar(Math.max(1, A / Astar3), x <= X.thr2 ? 'sub' : 'sup');
      T0 = T02;
      p0 = p0c2;
    }
    return { M, p: p0 * ise.p_p0(M), T: (T0 * ise.T_T0(M)) / T02 };
  };
  return (
    <Figure caption={`Final B ramjet computed from the lib: M∞ = 3 inlet, normal shock at A = 0.4 m² (Mₓ = ${Mx.toFixed(2)}), subsonic diffuser to the combustor (M = ${Mc1.toFixed(3)}), Rayleigh heating of 500 kJ/kg (M → ${Mc2.toFixed(3)}), nozzle throat ${Astar3.toFixed(2)} m² and exit ${Aexit.toFixed(2)} m² (M_e = ${Me.toFixed(2)}).`}>
      <FlowSection3D
        wall="plain"
        x0={0}
        x1={X.ex}
        profile={(x) => 0.3 * Math.sqrt(area(x))}
        field={field}
        shocks={[X.sh]}
        heatZone={[X.cb0 + 0.05, X.cb1 - 0.05]}
        plume={{ kind: 'ideal' }}
        labels={[
          { x: 0.05, text: 'M∞ = 3' },
          { x: X.thr1, text: 'inlet throat · M = 1', side: 'bottom' },
          { x: X.sh, text: `normal shock · ${Mx.toFixed(2)} → ${ns.My(Mx).toFixed(2)}` },
          { x: (X.cb0 + X.cb1) / 2, text: `combustor · M ${Mc1.toFixed(2)} → ${Mc2.toFixed(2)}`, side: 'bottom' },
          { x: X.thr2, text: 'nozzle throat · M = 1' },
          { x: X.ex, text: `exit · M = ${Me.toFixed(2)}`, side: 'bottom' },
        ]}
        height={300}
      />
    </Figure>
  );
}
