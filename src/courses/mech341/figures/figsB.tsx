/**
 * MECH 341 static figures for chapters 13-17. Numbers come from the lib (psychro.ts, combustion.ts, compressible.ts); schematics are SVG with the site's CSS variables.
 */
import { Figure } from '../../../core/ui';
import { Plot, Series } from '../../../core/Plot';
import { psyState, mixStreams } from '../lib/psychro';
import { Hprod, Hreact, burn, aft } from '../lib/combustion';
import { machFromAreaRatio, areaRatio, critical } from '../lib/compressible';

const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/* ---------------------------------------------------------------- ch 13 */
/** Dalton (add pressures at the same volume) versus Amagat (add volumes at the same pressure) for two ideal gases. */
export function DaltonAmagatFigure({ yA = 0.3 }: { yA?: number }) {
  const dots = (x0: number, y0: number, w: number, h: number, n: number, seed: number, c: string) =>
    Array.from({ length: n }, (_, i) => {
      const a = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
      const b = Math.sin(seed * 39.346 + i * 11.135) * 24634.6345;
      return <circle key={`${seed}-${i}`} cx={x0 + 8 + (a - Math.floor(a)) * (w - 16)} cy={y0 + 8 + (b - Math.floor(b)) * (h - 16)} r={3.4} fill={c} opacity={0.9} />;
    });
  const nA = Math.round(yA * 20);
  const nB = 20 - nA;
  const box = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} rx={5} fill="var(--surface-2)" stroke="var(--text)" strokeWidth={1.4} />;
  const t = (x: number, y: number, s: string, c = 'var(--text)', sz = 12.5, anchor: 'start' | 'middle' = 'middle') => (
    <text x={x} y={y} textAnchor={anchor} style={{ fill: c, fontSize: sz }}>
      {s}
    </text>
  );
  const wA = 150 * yA;
  return (
    <Figure caption="Same two gases, same T. Dalton: each gas alone in the full volume V exerts its partial pressure; the pressures add to P. Amagat: each gas alone at the mixture pressure P occupies a partial volume; the volumes add to V. For ideal gases both give pᵢ/P = Vᵢ/V = yᵢ.">
      <svg viewBox="0 0 760 250" style={{ width: '100%', height: 'auto' }} role="img" aria-label="Dalton and Amagat laws">
        {t(380, 20, 'Dalton: same V, T → add pressures', 'var(--text)', 14)}
        {box(20, 40, 150, 90)}
        {dots(20, 40, 150, 90, nA, 1, 'var(--c1)')}
        {t(95, 150, `A alone: p_A = y_A P`, 'var(--c1)')}
        {t(190, 90, '+', 'var(--text)', 22)}
        {box(210, 40, 150, 90)}
        {dots(210, 40, 150, 90, nB, 2, 'var(--c3)')}
        {t(285, 150, `B alone: p_B = y_B P`, 'var(--c3)')}
        {t(385, 90, '=', 'var(--text)', 22)}
        {box(405, 40, 150, 90)}
        {dots(405, 40, 150, 90, nA, 1, 'var(--c1)')}
        {dots(405, 40, 150, 90, nB, 2, 'var(--c3)')}
        {t(480, 150, 'mixture: P = p_A + p_B', 'var(--text)')}
        {t(380, 185, 'Amagat: same P, T → add volumes', 'var(--text)', 14)}
        <rect x={20} y={195} width={wA} height={40} fill="var(--surface-2)" stroke="var(--c1)" strokeWidth={1.6} />
        {dots(20, 195, wA, 40, Math.max(1, Math.round(nA * 0.6)), 1, 'var(--c1)')}
        <rect x={20 + wA} y={195} width={150 - wA} height={40} fill="var(--surface-2)" stroke="var(--c3)" strokeWidth={1.6} />
        {dots(20 + wA, 195, 150 - wA, 40, Math.round(nB * 0.6), 2, 'var(--c3)')}
        {t(200, 220, 'V_A + V_B = V', 'var(--text)', 12.5, 'start')}
        {t(330, 220, `V_A/V = y_A = ${yA.toFixed(2)}`, 'var(--muted)', 12.5, 'start')}
      </svg>
    </Figure>
  );
}

/* ---------------------------------------------------------------- ch 14 */
/** Rooftop air-handling unit: mixing box, cooling coil, reheat coil, fan; states and loads from the psychrometric lib. */
export function AirHandlerFigure({ Tout = 35, phiOut = 0.45, Tret = 24, phiRet = 0.5, share = 0.25, Tcoil = 12, Tsupply = 16 }: { Tout?: number; phiOut?: number; Tret?: number; phiRet?: number; share?: number; Tcoil?: number; Tsupply?: number }) {
  const P = 101.325;
  const oa = psyState({ T: Tout, P, phi: phiOut });
  const ra = psyState({ T: Tret, P, phi: phiRet });
  const m = mixStreams({ ma: share, w: oa.w, h: oa.h }, { ma: 1 - share, w: ra.w, h: ra.h }, P);
  const mix = psyState({ T: m.T, P, w: m.w });
  const coil = psyState({ T: Tcoil, P, phi: 1 });
  const sup = psyState({ T: Tsupply, P, w: coil.w });
  const states: [string, string, ReturnType<typeof psyState>][] = [
    ['OA', 'outside air', oa],
    ['RA', 'return air', ra],
    ['M', 'after mixing', mix],
    ['C', 'coil exit', coil],
    ['S', 'supply', sup],
  ];
  const box = (x: number, w: number, label: string, fill = 'var(--surface-2)') => (
    <g>
      <rect x={x} y={70} width={w} height={70} rx={6} fill={fill} stroke="var(--text)" strokeWidth={1.4} />
      <text x={x + w / 2} y={110} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 12.5, fontWeight: 600 }}>
        {label}
      </text>
    </g>
  );
  return (
    <Figure caption="Cooling coil with reheat: the coil is colder than the dew point of the mixed air, so it removes both sensible heat and moisture; the reheat coil then raises the temperature without adding water, which lowers the relative humidity (here from 100 % to about 77 %; mixing with the room air finishes the job). Values computed for the stated conditions (≈ typical summer day).">
      <svg viewBox="0 0 760 330" style={{ width: '100%', height: 'auto' }} role="img" aria-label="air handling unit">
        <defs>
          <marker id="ahArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--text)" />
          </marker>
        </defs>
        <path d="M10 85 H70" stroke="var(--c3)" strokeWidth={2.5} markerEnd="url(#ahArrow)" fill="none" />
        <path d="M10 125 H70" stroke="var(--c1)" strokeWidth={2.5} markerEnd="url(#ahArrow)" fill="none" />
        <text x={10} y={78} style={{ fill: 'var(--c3)', fontSize: 12 }}>
          OA
        </text>
        <text x={10} y={146} style={{ fill: 'var(--c1)', fontSize: 12 }}>
          RA
        </text>
        {box(70, 100, 'mixing box')}
        {box(220, 110, 'cooling coil', 'var(--surface)')}
        {box(380, 110, 'reheat coil', 'var(--surface)')}
        {box(540, 90, 'supply fan')}
        {[170, 330, 490, 630].map((x) => (
          <path key={x} d={`M${x} 105 H${x + 50}`} stroke="var(--text)" strokeWidth={2} markerEnd="url(#ahArrow)" fill="none" />
        ))}
        <path d="M630 105 H730" stroke="var(--text)" strokeWidth={2.5} markerEnd="url(#ahArrow)" fill="none" />
        <text x={700} y={95} style={{ fill: 'var(--text)', fontSize: 12 }}>
          S
        </text>
        <text x={160} y={62} style={{ fill: 'var(--muted)', fontSize: 11.5 }}>
          M
        </text>
        <text x={323} y={62} style={{ fill: 'var(--muted)', fontSize: 11.5 }}>
          C
        </text>
        <path d="M275 142 V175" stroke="var(--c1)" strokeWidth={2} markerEnd="url(#ahArrow)" fill="none" />
        <text x={285} y={168} style={{ fill: 'var(--c1)', fontSize: 11.5 }}>
          condensate
        </text>
        {states.map(([id, name, s], i) => (
          <text key={id} x={20} y={210 + i * 22} style={{ fill: 'var(--text)', fontSize: 12.5, fontFamily: 'ui-monospace, monospace' }}>
            {id.padEnd(3)} {name.padEnd(13)} T {s.T.toFixed(1)} °C · φ {(100 * s.phi).toFixed(0)} % · ω {(1000 * s.w).toFixed(2)} g/kg · h {s.h.toFixed(1)} kJ/kg
          </text>
        ))}
        <text x={20} y={322} style={{ fill: 'var(--muted)', fontSize: 12 }}>
          per kg dry air: cooling coil {(mix.h - coil.h).toFixed(1)} kJ (incl. condensate), reheat {(sup.h - coil.h).toFixed(1)} kJ
        </text>
      </svg>
    </Figure>
  );
}

/* ---------------------------------------------------------------- ch 15 */
/** H_P(T) of the products for several amounts of air against the constant H_R of the reactants: the intersection is the adiabatic flame temperature. */
export function AftGraphicalFigure({ fuel = 'CH4', airs = [1, 1.5, 2.5], Tair = 298.15 }: { fuel?: string; airs?: number[]; Tair?: number }) {
  const cols = ['var(--c3)', 'var(--c1)', 'var(--c4)', 'var(--c5)'];
  const F: [number, string][] = [[1, fuel]];
  const series: Series[] = airs.map((a, i) => ({
    points: range(300, 2800, 50).map((T) => ({ x: T, y: Hprod(burn({ fuel: F, theoAir: a }).products, T) / 1e3 })),
    color: cols[i % 4],
    width: 2.2,
    label: `H_P, ${(100 * a).toFixed(0)} % air`,
  }));
  const dots = airs.map((a, i) => {
    const Tad = aft({ fuel: F, theoAir: a, Tfuel: 298.15, Tair });
    return { x: Tad, y: Hreact({ fuel: F, theoAir: a, Tfuel: 298.15, Tair }) / 1e3, color: cols[i % 4], label: `${Tad.toFixed(0)} K` };
  });
  return (
    <Figure caption="Graphical meaning of the adiabatic flame temperature. Each curve is the enthalpy of the products (formation plus sensible) at temperature T; the reactants' enthalpy is a single number for each air amount (the dots' height). With Q = 0, H_P = H_R, so T_ad is where the curve reaches the dot..">
      <Plot x={[300, 2800]} y={[-900, 100]} height={280} xLabel="product temperature T (K)" yLabel="enthalpy (MJ per kmol fuel)" series={series} dots={dots} legend />
    </Figure>
  );
}

/* ---------------------------------------------------------------- ch 17 */
/** Converging–diverging nozzle contour with the design-condition Mach number along it (colour from the lib). */
export function NozzleContourFigure({ AeAt = 4, k = 1.4 }: { AeAt?: number; k?: number }) {
  const N = 90;
  const xs = range(-1, 1, N);
  const A = (x: number) => 1 + ((x < 0 ? 3 : AeAt) - 1) * x * x;
  const M = (x: number) => (Math.abs(x) < 1e-6 ? 1 : machFromAreaRatio(A(x), k, x < 0 ? 'sub' : 'sup'));
  const Mmax = machFromAreaRatio(AeAt, k, 'sup');
  const r = (x: number) => 0.45 * Math.sqrt(A(x));
  const X = (x: number) => 40 + (x + 1) * 320;
  const colorOf = (m: number) => {
    const t = Math.min(1, m / Math.max(Mmax, 1.5));
    return `hsl(${220 - 220 * t}, 75%, 50%)`;
  };
  const cy = 130;
  const seg = xs.slice(0, -1).map((x, i) => {
    const x2 = xs[i + 1];
    const m = M((x + x2) / 2);
    return <polygon key={i} points={`${X(x)},${cy - r(x) * 62} ${X(x2)},${cy - r(x2) * 62} ${X(x2)},${cy + r(x2) * 62} ${X(x)},${cy + r(x) * 62}`} fill={colorOf(m)} opacity={0.88} />;
  });
  const cr = critical(k);
  return (
    <Figure caption={`Design-condition flow in a converging–diverging nozzle (A_e/A_t = ${AeAt}, k = ${k}): subsonic in the converging part (blue), Ma = 1 exactly at the throat, supersonic in the diverging part (to red). The exit Mach number is ${Mmax.toFixed(2)} and A_e/A* = ${areaRatio(Mmax, k).toFixed(2)}; at the throat T = ${cr.T.toFixed(3)} T₀ and P = ${cr.P.toFixed(3)} P₀.`}>
      <svg viewBox="0 0 720 260" style={{ width: '100%', height: 'auto' }} role="img" aria-label="nozzle contour coloured by Mach number">
        {seg}
        <path d={`M${X(-1)} ${cy - r(-1) * 62} ` + xs.map((x) => `L${X(x)} ${cy - r(x) * 62}`).join(' ')} fill="none" stroke="var(--text)" strokeWidth={3} />
        <path d={`M${X(-1)} ${cy + r(-1) * 62} ` + xs.map((x) => `L${X(x)} ${cy + r(x) * 62}`).join(' ')} fill="none" stroke="var(--text)" strokeWidth={3} />
        <line x1={X(0)} y1={30} x2={X(0)} y2={230} stroke="var(--text)" strokeDasharray="4 4" />
        <text x={X(0)} y={24} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 12.5 }}>
          throat, Ma = 1
        </text>
        <text x={X(-1)} y={250} style={{ fill: 'var(--text)', fontSize: 12.5 }}>
          Ma = {M(-1).toFixed(2)}
        </text>
        <text x={X(1)} y={250} textAnchor="end" style={{ fill: 'var(--text)', fontSize: 12.5 }}>
          Ma = {Mmax.toFixed(2)}
        </text>
      </svg>
    </Figure>
  );
}
