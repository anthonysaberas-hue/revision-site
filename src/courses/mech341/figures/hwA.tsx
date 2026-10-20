/**
 * MECH 341 figures for the assignment pages a01-a05 (Thermo 1 review, jet engines, vapor cycles, refrigeration, property relations).
 * Numbers come from the lib; schematics use the site's CSS variables.
 */
import { Figure } from '../../../core/ui';
import { Plot, Series } from '../../../core/Plot';
import { water } from '../lib/props';

const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/* ---------------------------------------------------------------- 4-9 */
/** v(P) of steam at 200 °C between 100 and 200 kPa: the true curve against the straight line the notebook interpolated. */
export function InterpTrapFigure({ T = 200, P1 = 100, P2 = 200, Pm = 150 }: { T?: number; P1?: number; P2?: number; Pm?: number }) {
  const v1 = water.PT(P1, T).v;
  const v2 = water.PT(P2, T).v;
  const vTrue = water.PT(Pm, T).v;
  const vLin = v1 + ((v2 - v1) * (Pm - P1)) / (P2 - P1);
  const curve: Series = { points: range(P1, P2, 40).map((P) => ({ x: P, y: water.PT(P, T).v })), color: 'var(--c1)', width: 2.4, label: 'true v(P) (v ∝ 1/P)' };
  const chord: Series = { points: [{ x: P1, y: v1 }, { x: P2, y: v2 }], color: 'var(--c3)', width: 2, dash: true, label: 'straight line between the two table rows' };
  return (
    <Figure caption={`Specific volume of steam at ${T} °C. The table gives only ${P1} and ${P2} kPa (v = ${v1.toFixed(4)} and ${v2.toFixed(4)} m³/kg). Halfway in pressure the straight line gives ${vLin.toFixed(4)}, but the real curve is bent like 1/P and gives ${vTrue.toFixed(4)} m³/kg, so the line is ${(((vLin - vTrue) / vTrue) * 100).toFixed(0)} % too high. Interpolating P·v (almost constant) or 1/v removes the bend.`}>
      <Plot
        x={[P1 - 5, P2 + 5]}
        y={[v2 * 0.9, v1 * 1.05]}
        height={280}
        xLabel="P (kPa)"
        yLabel="v (m³/kg)"
        series={[curve, chord]}
        vlines={[{ x: Pm, color: 'var(--muted)', dash: true, label: `${Pm} kPa` }]}
        dots={[
          { x: P1, y: v1, label: 'table' },
          { x: P2, y: v2, label: 'table' },
          { x: Pm, y: vTrue, label: 'true', color: 'var(--c1)' },
          { x: Pm, y: vLin, label: 'linear', color: 'var(--c3)' },
        ]}
      />
    </Figure>
  );
}

/* ---------------------------------------------------------------- gas cycles on T-s */
export interface GasPoint {
  T: number; // K
  P: number; // kPa
  label: string;
}

/**
 * T-s sketch of a gas cycle with constant specific heats. The points are listed around the cycle; consecutive points at the
 * same pressure are joined along the isobar (heat exchange), points at different pressures by a straight line (compression or expansion).
 */
export function GasCycleTs({ points, cp = 1.005, R = 0.287, caption }: { points: GasPoint[]; cp?: number; R?: number; caption?: string }) {
  const P0 = points[0].P;
  const T0 = points[0].T;
  const s = (T: number, P: number) => cp * Math.log(T / T0) - R * Math.log(P / P0);
  const path: { x: number; y: number }[] = [];
  const closed = [...points, points[0]];
  for (let k = 0; k < closed.length; k++) {
    const b = closed[k];
    const a = k > 0 ? closed[k - 1] : undefined;
    if (a && Math.abs(a.P - b.P) / b.P < 0.005 && a.T !== b.T) {
      for (const T of range(a.T, b.T, 24)) path.push({ x: s(T, b.P), y: T });
    } else path.push({ x: s(b.T, b.P), y: b.T });
  }
  const xs = points.map((p) => s(p.T, p.P));
  const ys = points.map((p) => p.T);
  const pad = 0.06 * (Math.max(...xs) - Math.min(...xs));
  return (
    <Figure caption={caption}>
      <Plot
        x={[Math.min(...xs) - pad, Math.max(...xs) + pad]}
        y={[Math.min(...ys) - 60, Math.max(...ys) + 80]}
        height={300}
        xLabel="s − s₁ (kJ/kg·K, constant c_p)"
        yLabel="T (K)"
        series={[{ points: path, color: 'var(--c1)', width: 2.4 }]}
        dots={points.map((p) => ({ x: s(p.T, p.P), y: p.T, label: p.label, color: 'var(--c2)' }))}
        legend={false}
      />
    </Figure>
  );
}

/* ---------------------------------------------------------------- 10-61 */
/** Corrected layout of problem 10-61 (the instructor's redraw): closed heater with the drain pumped forward into a mixing chamber. */
export function CfwhForwardFigure() {
  const box = (x: number, y: number, w: number, h: number, t: string, fill = 'var(--surface-2)') => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke="var(--text)" strokeWidth={1.4} />
      <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
        {t}
      </text>
    </g>
  );
  const lbl = (x: number, y: number, t: string, c = 'var(--text)', size = 12.5) => (
    <text x={x} y={y} style={{ fill: c, fontSize: size }}>
      {t}
    </text>
  );
  const line = (d: string, c = 'var(--text)') => <path d={d} fill="none" stroke={c} strokeWidth={2} markerEnd="url(#cfArrow)" />;
  return (
    <Figure caption="Problem 10-61 as the instructor redrew it. The bled steam (fraction y, state 6) condenses in the closed heater; the feedwater (1−y) leaves at the drain's saturation temperature, T₉ = T₃. The drain, saturated liquid at 0.8 MPa, is pumped forward to 10 MPa (state 10) and meets the feedwater in a mixing chamber. Because h₉ ≈ h₃ + v₃(P₁₀ − P₃) = h₁₀, the mixture has h₄ = h₉ = h₁₀.">
      <svg viewBox="0 0 820 300" style={{ width: '100%', height: 'auto' }} role="img" aria-label="closed feedwater heater with drain pumped forward">
        <defs>
          <marker id="cfArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--text)" />
          </marker>
        </defs>
        {box(20, 100, 90, 54, 'Pump I')}
        {box(230, 100, 150, 54, 'Closed FWH')}
        {box(520, 100, 120, 54, 'Mixing chamber', 'var(--surface)')}
        {box(680, 100, 100, 54, 'Boiler')}
        {box(300, 215, 100, 40, 'Pump II')}
        {lbl(20, 90, '1 (10 kPa)')}
        {line('M110 127 H228', 'var(--c1)')}
        {lbl(118, 118, '2 (10 MPa), 1−y', 'var(--c1)')}
        {line('M382 127 H518', 'var(--c1)')}
        {lbl(392, 118, '9, T₉ = T₃', 'var(--c1)')}
        {line('M642 127 H678', 'var(--c1)')}
        {lbl(646, 118, '4', 'var(--c1)')}
        {line('M305 40 V98', 'var(--c3)')}
        {lbl(315, 62, '6 bled steam y (0.8 MPa)', 'var(--c3)')}
        {line('M305 156 V190 H350 V213', 'var(--c3)')}
        {lbl(240, 176, '3 sat. liquid (drain)', 'var(--c3)')}
        {line('M402 235 H580 V156', 'var(--c3)')}
        {lbl(430, 227, '10 (10 MPa), y', 'var(--c3)')}
        {lbl(20, 280, 'heater: y (h₆ − h₃) = (1−y)(h₉ − h₂)', 'var(--text)')}
        {lbl(430, 280, 'mixing chamber: (1−y)h₉ + y h₁₀ = h₄ ⇒ h₄ = h₉ = h₁₀', 'var(--text)')}
      </svg>
    </Figure>
  );
}

/* ---------------------------------------------------------------- 11-62 */
/** Layout of problem 11-62 (state numbers as in the textbook figure): two evaporators at different temperatures served by one compressor. */
export function TwoEvaporatorFigure() {
  const box = (x: number, y: number, w: number, h: number, t: string, fill = 'var(--surface-2)') => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke="var(--text)" strokeWidth={1.4} />
      <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
        {t}
      </text>
    </g>
  );
  const lbl = (x: number, y: number, t: string, c = 'var(--text)') => (
    <text x={x} y={y} style={{ fill: c, fontSize: 12.5 }}>
      {t}
    </text>
  );
  const line = (d: string, c = 'var(--text)') => <path d={d} fill="none" stroke={c} strokeWidth={2} markerEnd="url(#teArrow)" />;
  return (
    <Figure caption="Problem 11-62. Saturated liquid leaves the condenser (state 3, 800 kPa) and splits. Branch 1 (flow ṁ₁): valve to 293 kPa (4), evaporator 1 at 0 °C, saturated vapor (5), then a pressure-reducing valve down to 100 kPa. Branch 2 (flow ṁ₂): valve to 100 kPa (6), evaporator 2 at −26.4 °C, saturated vapor (7). The two vapor streams mix at state 1 and one compressor takes all ṁ = 0.1 kg/s from 100 kPa to 800 kPa (state 2).">
      <svg viewBox="0 0 820 310" style={{ width: '100%', height: 'auto' }} role="img" aria-label="two evaporator refrigeration layout">
        <defs>
          <marker id="teArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--text)" />
          </marker>
        </defs>
        {box(330, 14, 160, 44, 'Condenser (800 kPa)')}
        {box(40, 110, 170, 46, 'Evaporator 1 (0 °C)')}
        {box(40, 215, 170, 46, 'Evaporator 2 (−26.4 °C)')}
        {box(650, 110, 120, 52, 'Compressor')}
        {box(330, 118, 120, 30, 'reducing valve', 'var(--surface)')}
        {line('M330 36 H125 V108', 'var(--c3)')}
        {lbl(135, 30, '3 → 4  ṁ₁ (valve to 293 kPa)', 'var(--c3)')}
        {line('M330 36 H22 V238 H38', 'var(--c3)')}
        {lbl(8, 205, '6  ṁ₂', 'var(--c3)')}
        {line('M212 133 H328', 'var(--c1)')}
        {lbl(222, 124, '5  sat. vapor, 0 °C', 'var(--c1)')}
        {line('M452 133 H520 V190', 'var(--c1)')}
        {line('M212 238 H520 V190', 'var(--c1)')}
        {lbl(222, 230, '7  sat. vapor, −26.4 °C', 'var(--c1)')}
        {line('M520 190 H710 V164', 'var(--c1)')}
        {lbl(540, 182, '1  mixture, 100 kPa', 'var(--c1)')}
        {line('M710 108 V36 H492', 'var(--c3)')}
        {lbl(560, 30, '2  800 kPa', 'var(--c3)')}
        {lbl(40, 296, 'Q̇₂ = ṁ₂ (h₇ − h₆) = 8 kW;  ṁ₁ = 0.1 − ṁ₂;  h₁ = (ṁ₂ h₇ + ṁ₁ h₅)/0.1;  Ẇ = 0.1 (h₂s − h₁)', 'var(--text)')}
      </svg>
    </Figure>
  );
}
