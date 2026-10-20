/**
 * MECH 341 static figures for chapters 8-12. Numbers come from the lib (cycles.ts, refrig.ts); schematics are drawn in SVG with the site's CSS variables.
 */
import { Figure } from '../../../core/ui';
import { Plot, Series } from '../../../core/Plot';
import { brayton, turbojet } from '../lib/cycles';
import { vcr } from '../lib/refrig';
import { r134a } from '../lib/props';

const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/* ---------------------------------------------------------------- ch 8 */
/** Where the fuel energy of a car engine goes (typical values, labelled ≈). */
export function EngineLossFigure({ brake = 30, exhaust = 35, coolant = 28, other = 7 }: { brake?: number; exhaust?: number; coolant?: number; other?: number }) {
  const parts = [
    { t: 'brake work', v: brake, c: 'var(--c2)' },
    { t: 'exhaust heat', v: exhaust, c: 'var(--c3)' },
    { t: 'coolant + radiator', v: coolant, c: 'var(--c1)' },
    { t: 'friction, pumping, other', v: other, c: 'var(--muted)' },
  ];
  let x = 20;
  const W = 600;
  return (
    <Figure caption="Typical fuel-energy audit of a petrol car engine at part load (values ≈, they vary with load and engine). Only the green slice is work; the rest leaves as heat, which the second law says cannot be avoided.">
      <svg viewBox="0 0 640 150" style={{ width: '100%', height: 'auto' }} role="img" aria-label="fuel energy split">
        <text x={20} y={22} style={{ fill: 'var(--text)', fontSize: 14, fontWeight: 600 }}>
          100 % of the fuel's chemical energy
        </text>
        {parts.map((p) => {
          const w = (p.v / 100) * W;
          const el = (
            <g key={p.t}>
              <rect x={x} y={34} width={w} height={46} fill={p.c} opacity={0.85} stroke="var(--surface)" strokeWidth={2} rx={3} />
              <text x={x + w / 2} y={62} textAnchor="middle" style={{ fill: '#fff', fontSize: 15, fontWeight: 700 }}>
                ≈{p.v} %
              </text>
              <text x={x + w / 2} y={102} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 11.5 }}>
                {p.t}
              </text>
            </g>
          );
          x += w;
          return el;
        })}
        <line x1={20} y1={118} x2={620} y2={118} stroke="var(--muted)" strokeWidth={1} />
        <text x={20} y={136} style={{ fill: 'var(--muted)', fontSize: 11 }}>
          Carnot limit for 2000 K to 300 K is 85 %: the real engine runs far below it because of finite-rate combustion, heat loss, and friction.
        </text>
      </svg>
    </Figure>
  );
}

/* ---------------------------------------------------------------- ch 9 */
/** Ideal and actual Brayton cycles on the T–s diagram of an ideal gas. */
export function BraytonTsFigure({ rp = 8, T1 = 300, T3 = 1300, etaC = 0.85, etaT = 0.88 }: { rp?: number; T1?: number; T3?: number; etaC?: number; etaT?: number }) {
  const cp = 1.005;
  const R = 0.287;
  const k = 1.4;
  const s = (T: number, P: number) => cp * Math.log(T / T1) - R * Math.log(P);
  const id = brayton({ T1, rp, T3 });
  const ac = brayton({ T1, rp, T3, etaC, etaT });
  const isobar = (P: number, Ta: number, Tb: number) => range(Ta, Tb, 40).map((T) => ({ x: s(T, P), y: T }));
  const ideal: Series = {
    points: [{ x: 0, y: T1 }, { x: 0, y: id.T2 }, ...isobar(rp, id.T2, T3), { x: s(T3, rp), y: T3 }, { x: s(id.T4, 1), y: id.T4 }, ...isobar(1, id.T4, T1).slice(0)],
    color: 'var(--c1)',
    width: 2.4,
    label: 'ideal (isentropic)',
  };
  const actual: Series = {
    points: [{ x: 0, y: T1 }, { x: s(ac.T2, rp), y: ac.T2 }, ...isobar(rp, ac.T2, T3), { x: s(ac.T4, 1), y: ac.T4 }, ...isobar(1, ac.T4, T1)],
    color: 'var(--c3)',
    width: 2.2,
    dash: true,
    label: 'actual (η_C, η_T)',
  };
  const smax = Math.max(s(T3, rp), s(ac.T4, 1)) * 1.05;
  return (
    <Figure caption={`Brayton cycle, r_p = ${rp}, T₁ = ${T1} K, T₃ = ${T3} K. Solid: ideal (T₂ = ${id.T2.toFixed(0)} K, T₄ = ${id.T4.toFixed(0)} K). Dashed: η_C = ${etaC}, η_T = ${etaT} (T₂ = ${ac.T2.toFixed(0)} K, T₄ = ${ac.T4.toFixed(0)} K). The area enclosed is the net specific work; irreversibilities move the end points to the right (entropy increases) and shrink the area.`}>
      <Plot
        x={[-0.05, smax]}
        y={[T1 - 40, T3 + 100]}
        height={300}
        xLabel="s − s₁ (kJ/kg·K)"
        yLabel="T (K)"
        series={[ideal, actual]}
        dots={[
          { x: 0, y: T1, label: '1' },
          { x: 0, y: id.T2, label: '2s' },
          { x: s(ac.T2, rp), y: ac.T2, label: '2' },
          { x: s(T3, rp), y: T3, label: '3' },
          { x: s(id.T4, 1), y: id.T4, label: '4s' },
          { x: s(ac.T4, 1), y: ac.T4, label: '4' },
        ]}
      />
    </Figure>
  );
}

/** Turbojet schematic with the stagnation state at each station for a chosen operating point. */
export function TurbojetStationsFigure({ Ta = 288, Pa = 100, rc = 12, T04 = 1400, etaC = 0.87, etaT = 0.9 }: { Ta?: number; Pa?: number; rc?: number; T04?: number; etaC?: number; etaT?: number }) {
  const r = turbojet({ Ta, Pa, V: 0, mdot: 1, rc, T04, etaC, etaT, cpg: 1.147, kg: 1.333, nozzle: 'CD' });
  const st = [
    { n: '1–2', x: 70, T: r.T02, P: r.P02 },
    { n: '3', x: 235, T: r.T03, P: r.P03 },
    { n: '4', x: 405, T: T04, P: r.P04 },
    { n: '5', x: 520, T: r.T05, P: r.P05 },
    { n: '6', x: 690, T: r.Te, P: r.Pe },
  ];
  return (
    <Figure caption={`Stations of a turbojet at sea level, no ram (ex. in the text): r_c = ${rc}, T₀₄ = ${T04} K, η_C = ${etaC}, η_T = ${etaT}. T and P are stagnation values at stations 1–5 and static exit values at 6. 1→2 intake (T₀ constant), 2→3 compressor, 3→4 combustor (P₀ constant), 4→5 turbine (w_T = w_C), 5→6 nozzle.`}>
      <svg viewBox="0 0 780 250" style={{ width: '100%', height: 'auto' }} role="img" aria-label="turbojet stations">
        <defs>
          <linearGradient id="tjMetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--muted)', stopOpacity: 0.95 }} />
            <stop offset="0.5" style={{ stopColor: 'var(--border)', stopOpacity: 0.7 }} />
            <stop offset="1" style={{ stopColor: 'var(--muted)', stopOpacity: 0.95 }} />
          </linearGradient>
          <linearGradient id="tjHot" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--c3)', stopOpacity: 0.15 }} />
            <stop offset="1" style={{ stopColor: 'var(--c3)', stopOpacity: 0.7 }} />
          </linearGradient>
          <linearGradient id="tjCold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--c1)', stopOpacity: 0.1 }} />
            <stop offset="1" style={{ stopColor: 'var(--c1)', stopOpacity: 0.55 }} />
          </linearGradient>
        </defs>
        {/* casing */}
        <path d="M20 85 Q50 70 130 62 L330 70 L330 70 L420 62 L520 78 L650 92 L740 105 L740 145 L650 158 L520 172 L420 188 L330 180 L130 188 Q50 180 20 165 Z" fill="url(#tjMetal)" stroke="var(--text)" strokeWidth={1.2} opacity={0.55} />
        {/* gas path */}
        <path d="M30 95 L135 75 L330 88 L415 80 L520 92 L650 102 L735 112 L735 138 L650 148 L520 158 L415 170 L330 162 L135 175 L30 155 Z" fill="url(#tjCold)" />
        <path d="M335 88 L415 80 L520 92 L650 102 L735 112 L735 138 L650 148 L520 158 L415 170 L335 162 Z" fill="url(#tjHot)" />
        {/* shaft */}
        <rect x={110} y={118} width={430} height={14} fill="var(--text)" opacity={0.55} rx={3} />
        <ellipse cx={34} cy={125} rx={22} ry={12} fill="var(--text)" opacity={0.5} />
        {/* compressor blades */}
        {range(0, 7, 7).map((i) => (
          <g key={`c${i}`}>
            <line x1={150 + i * 22} y1={77 + i * 1.6} x2={150 + i * 22} y2={118} stroke="var(--c1)" strokeWidth={3} opacity={0.9} />
            <line x1={150 + i * 22} y1={132} x2={150 + i * 22} y2={172 - i * 1.4} stroke="var(--c1)" strokeWidth={3} opacity={0.9} />
          </g>
        ))}
        {/* combustor cans */}
        <rect x={335} y={90} width={70} height={30} rx={14} fill="var(--c4)" opacity={0.65} stroke="var(--text)" />
        <rect x={335} y={130} width={70} height={30} rx={14} fill="var(--c4)" opacity={0.65} stroke="var(--text)" />
        {/* turbine blades */}
        {range(0, 2, 2).map((i) => (
          <g key={`t${i}`}>
            <line x1={430 + i * 28} y1={84 + i * 2} x2={430 + i * 28} y2={118} stroke="var(--c3)" strokeWidth={4} />
            <line x1={430 + i * 28} y1={132} x2={430 + i * 28} y2={166 - i * 2} stroke="var(--c3)" strokeWidth={4} />
          </g>
        ))}
        {/* flow arrows */}
        <path d="M5 125 H26" stroke="var(--text)" strokeWidth={2} markerEnd="url(#none)" />
        <path d="M735 125 H770" stroke="var(--c3)" strokeWidth={3} />
        <path d="M762 119 L772 125 L762 131" fill="none" stroke="var(--c3)" strokeWidth={3} />
        {/* station ticks and values */}
        {st.map((s) => (
          <g key={s.n}>
            <line x1={s.x} y1={60} x2={s.x} y2={190} stroke="var(--text)" strokeDasharray="3 4" opacity={0.45} />
            <text x={s.x} y={50} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 15, fontWeight: 700 }}>
              {s.n}
            </text>
            <text x={s.x} y={212} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 12 }}>
              {s.T.toFixed(0)} K
            </text>
            <text x={s.x} y={228} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 12 }}>
              {s.P.toFixed(0)} kPa
            </text>
          </g>
        ))}
        <text x={190} y={245} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 11 }}>
          compressor
        </text>
        <text x={370} y={245} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 11 }}>
          combustor
        </text>
        <text x={470} y={245} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 11 }}>
          turbine
        </text>
        <text x={640} y={245} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 11 }}>
          nozzle
        </text>
      </svg>
    </Figure>
  );
}

/* ---------------------------------------------------------------- ch 10 */
/** Open vs closed feedwater heater schematics with the state labels used in the notes. */
export function FeedwaterHeatersFigure() {
  const box = (x: number, y: number, w: number, h: number, t: string, fill = 'var(--surface-2)') => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke="var(--text)" strokeWidth={1.4} />
      <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
        {t}
      </text>
    </g>
  );
  const arrow = (d: string, c = 'var(--text)') => <path d={d} fill="none" stroke={c} strokeWidth={2} markerEnd="url(#fwArrow)" />;
  const lbl = (x: number, y: number, t: string, c = 'var(--text)') => (
    <text x={x} y={y} style={{ fill: c, fontSize: 12.5 }}>
      {t}
    </text>
  );
  return (
    <Figure caption="Open feedwater heater (left): steam and subcooled feedwater mix, exit is saturated liquid at the heater pressure, so P₂ = P₆ = P₃ and a second pump is needed. Closed feedwater heater (right): the streams exchange heat across tubes, so they can be at different pressures; the feedwater leaves at the bled steam's saturation temperature (T₅ = T₆), and the drain (saturated liquid at the bleed pressure) is throttled back or pumped forward.">
      <svg viewBox="0 0 800 270" style={{ width: '100%', height: 'auto' }} role="img" aria-label="feedwater heaters">
        <defs>
          <marker id="fwArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--text)" />
          </marker>
        </defs>
        <text x={140} y={22} style={{ fill: 'var(--text)', fontSize: 15, fontWeight: 700 }}>
          Open feedwater heater (mixing chamber)
        </text>
        {box(120, 110, 150, 70, 'OFWH', 'var(--surface-2)')}
        {arrow('M10 145 H118')}
        {lbl(14, 135, '2  from pump I (1−y)')}
        {arrow('M195 40 V108', 'var(--c3)')}
        {lbl(205, 70, '6  bled steam (y)', 'var(--c3)')}
        {arrow('M272 145 H370', 'var(--c1)')}
        {lbl(285, 135, '3  sat. liquid (1)', 'var(--c1)')}
        {lbl(14, 205, 'y h₆ + (1−y) h₂ = h₃', 'var(--text)')}
        {lbl(14, 228, 'y = (h₃ − h₂)/(h₆ − h₂)', 'var(--text)')}
        {lbl(14, 251, 'pressures: P₂ = P₃ = P₆', 'var(--muted)')}
        <line x1={400} y1={10} x2={400} y2={262} stroke="var(--border)" strokeDasharray="4 5" />
        <text x={430} y={22} style={{ fill: 'var(--text)', fontSize: 15, fontWeight: 700 }}>
          Closed feedwater heater (heat exchanger)
        </text>
        {box(500, 100, 170, 60, 'CFWH', 'var(--surface-2)')}
        <path d="M440 130 H500" fill="none" stroke="var(--c1)" strokeWidth={2} markerEnd="url(#fwArrow)" />
        <path d="M670 130 H770" fill="none" stroke="var(--c1)" strokeWidth={2} markerEnd="url(#fwArrow)" />
        {lbl(432, 120, 'feedwater in', 'var(--c1)')}
        {lbl(676, 120, 'feedwater out', 'var(--c1)')}
        {arrow('M585 40 V98', 'var(--c3)')}
        {lbl(595, 62, 'bled steam y (P₆)', 'var(--c3)')}
        {arrow('M585 162 V215', 'var(--c3)')}
        {lbl(595, 192, 'drain: sat. liquid at P₆', 'var(--c3)')}
        {box(545, 218, 80, 32, 'valve h = c', 'var(--surface)')}
        {arrow('M545 234 H440')}
        {lbl(442, 226, 'to condenser (or pump forward)')}
        {lbl(432, 262, 'ideal: T(feedwater out) = T_sat at P₆', 'var(--muted)')}
      </svg>
    </Figure>
  );
}

/* ---------------------------------------------------------------- ch 11 */
/** P–h diagram of the vapour-compression cycle (R-134a) with the actual cycle dashed. */
export function VcrPhFigure({ TL = -25, PH = 800, etaC = 0.8, superheat = 5, subcool = 5 }: { TL?: number; PH?: number; etaC?: number; superheat?: number; subcool?: number }) {
  const PL = r134a.Psat(TL);
  const id = vcr({ PL, PH });
  const ac = vcr({ PL, PH, etaC, superheat, subcool });
  const Tc = r134a.crit.T;
  const liq: { x: number; y: number }[] = [];
  const vap: { x: number; y: number }[] = [];
  for (const T of range(-45, Tc - 1, 70)) {
    const sat = r134a.satT(T);
    liq.push({ x: sat.hf, y: sat.P });
    vap.push({ x: sat.hg, y: sat.P });
  }
  const loop = (c: ReturnType<typeof vcr>) => {
    const S = c.states;
    return [S[1], S[2], S[3], S[4], S[1]].map((q) => ({ x: q.h, y: q.P }));
  };
  const lab = (c: ReturnType<typeof vcr>, sfx: string) => (['1', '2', '3', '4'] as const).map((k) => ({ x: c.states[k].h, y: c.states[k].P, label: `${k}${sfx}`, r: 3.5 }));
  return (
    <Figure caption={`R-134a vapour-compression cycle on a P–h diagram (log P): evaporator at ${TL} °C (${PL.toFixed(0)} kPa), condenser at ${PH} kPa. Solid: ideal (saturated vapour in, isentropic compressor, saturated liquid out; COP_R = ${id.COPR.toFixed(2)}). Dashed: η_C = ${etaC}, ${superheat} K superheat, ${subcool} K subcooling (COP_R = ${ac.COPR.toFixed(2)}). The throttle 3→4 is a vertical line (h = const); the compressor line leans right with irreversibility.`}>
      <Plot
        x={[40, 460]}
        y={[60, 3000]}
        logY
        height={320}
        xLabel="h (kJ/kg)"
        yLabel="P (kPa, log)"
        series={[
          { points: liq, color: 'var(--muted)', width: 1.8 },
          { points: vap, color: 'var(--muted)', width: 1.8 },
          { points: loop(id), color: 'var(--c1)', width: 2.6, label: 'ideal' },
          { points: loop(ac), color: 'var(--c3)', width: 2.2, dash: true, label: 'actual' },
        ]}
        dots={[...lab(id, ''), ...lab(ac, "'").filter((d, i) => Math.abs(d.x - lab(id, '')[i].x) > 1)]}
        legend={false}
      />
    </Figure>
  );
}
