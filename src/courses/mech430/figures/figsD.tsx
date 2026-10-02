/* Group D figures — realistic SVG setups for Ch. 12–14 and PS9 (metal bodies, Mach-coloured flow, drawn to scale from the lib). */
import { ReactNode, useId } from 'react';
import { Figure } from '../../../core/ui';
import * as ob from '../lib/obliqueShock';
import * as rf from '../lib/shockReflection';
import { diamondAirfoil } from '../lib/diamondAirfoil';
import { machColor } from '../sims/common';

const R = Math.PI / 180;
const cosd = (a: number) => Math.cos(a * R);
const sind = (a: number) => Math.sin(a * R);
const tand = (a: number) => Math.tan(a * R);
const f3 = (v: number) => String(Number(v.toPrecision(3)));
const lbl = { fontSize: 12.5, fill: '#f4f6fb', fontWeight: 600 } as const;
const dim = { fontSize: 11.5, fill: '#dfe6f5' } as const;

/** Shared defs: brushed-metal gradient, cut hatching, glow filter and arrowhead. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eef1f5" />
        <stop offset="0.25" stopColor="#b7bfca" />
        <stop offset="0.6" stopColor="#7d8693" />
        <stop offset="1" stopColor="#4c535e" />
      </linearGradient>
      <pattern id={`${id}h`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="#8d96a3" />
        <rect width="8" height="4" fill="#a7afba" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="#3b414a" strokeWidth="1.2" opacity="0.55" />
      </pattern>
      <filter id={`${id}g`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker id={`${id}a`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10z" fill="#f4f6fb" />
      </marker>
    </defs>
  );
}
function Shock({ id, d }: { id: string; d: string }) {
  return (
    <g filter={`url(#${id}g)`}>
      <path d={d} stroke="#ffd9a8" strokeWidth={6} opacity={0.45} fill="none" />
      <path d={d} stroke="#fffaf0" strokeWidth={2.2} fill="none" />
    </g>
  );
}
const useSvgId = () => 'gd' + useId().replace(/[^a-zA-Z0-9]/g, '');
const svgStyle = { width: '100%', height: 'auto', borderRadius: 10, background: '#0b1020' } as const;

/** Flow over a concave corner / wedge with its attached oblique shock (drawn to scale). */
export function ObliqueCornerFigure({ M = 2, delta = 10, up, down, caption }: { M?: number; delta?: number; up?: string; down?: string; caption?: ReactNode }) {
  const id = useSvgId();
  const s = ob.obliqueShock(M, delta);
  const W = 560;
  const H = 260;
  const ax = 230;
  const wy = 210;
  const X = (x: number) => ax + x;
  const Y = (y: number) => wy - y;
  const top = 190;
  const xs = top / tand(s.sigma);
  const rampEnd = (W - ax) * tand(delta);
  return (
    <Figure caption={caption ?? `M₁ = ${M}, δ = ${delta}°: weak oblique shock at σ = ${f3(s.sigma)}°, M₂ = ${f3(s.M2)}.`}>
      <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle}>
        <Defs id={id} />
        <rect x={0} y={0} width={W} height={wy} fill={machColor(M)} opacity={0.75} />
        <polygon points={`${X(0)},${Y(0)} ${X(xs)},${Y(top)} ${W},${Y(top)} ${W},${Y(rampEnd)}`} fill={machColor(s.M2)} opacity={0.85} />
        {[30, 70, 110, 150].map((y0) => {
          const xh = y0 / tand(s.sigma);
          return <path key={y0} d={`M10,${Y(y0)} L${X(xh)},${Y(y0)} L${W - 10},${Y(y0 + (W - 10 - X(xh)) * tand(delta))}`} stroke="#ffffff" strokeOpacity={0.6} fill="none" markerEnd={`url(#${id}a)`} />;
        })}
        <polygon points={`0,${wy} ${X(0)},${wy} ${W},${Y(rampEnd)} ${W},${H} 0,${H}`} fill={`url(#${id}h)`} stroke="#e6ebf2" strokeWidth={1.5} />
        <Shock id={id} d={`M${X(0)},${Y(0)} L${X(xs)},${Y(top)}`} />
        <path d={`M${X(0)},${wy} L${X(150)},${wy}`} stroke="#f4f6fb" strokeDasharray="4 4" />
        <path d={`M${X(80)},${wy} A80,80 0 0 0 ${X(80 * cosd(delta))},${Y(80 * sind(delta))}`} stroke="#f4f6fb" fill="none" />
        <text x={X(86)} y={wy - 4} style={dim}>
          δ = {delta}°
        </text>
        <path d={`M${X(125)},${wy} A125,125 0 0 0 ${X(125 * cosd(s.sigma))},${Y(125 * sind(s.sigma))}`} stroke="#ffd9a8" fill="none" />
        <text x={X(130 * cosd(s.sigma / 2)) + 4} y={Y(130 * sind(s.sigma / 2))} style={{ ...dim, fill: '#ffe2b8' }}>
          σ
        </text>
        <text x={12} y={22} style={lbl}>
          {up ?? `① M₁ = ${M}`}
        </text>
        <text x={W - 12} y={22} textAnchor="end" style={lbl}>
          {down ?? `② M₂ = ${f3(s.M2)}`}
        </text>
      </svg>
    </Figure>
  );
}

/** Channel with a wedge on the lower wall: incident shock and its regular reflection from the upper wall (PS9 P4). */
export function ChannelReflectionFigure({ M = 4, delta = 20, caption }: { M?: number; delta?: number; caption?: ReactNode }) {
  const id = useSvgId();
  const r = rf.regularReflection(M, delta);
  if (!r) return null;
  const W = 600;
  const H = 250;
  const s = 150;
  const x0 = 70;
  const yb = 215;
  const X = (x: number) => x0 + x * s;
  const Y = (y: number) => yb - y * s;
  const tD = tand(delta);
  const tI = tand(r.incident.sigma);
  const xh = 1 / tI;
  const tP = tand(r.reflected.sigma - delta);
  const xr = (1 + xh * tP) / (tD + tP);
  const yr = xr * tD;
  const xm = Math.min((W - x0) / s, 0.97 / tD);
  return (
    <Figure caption={caption ?? `M₁ = ${M}, δ₁ = ${delta}°: σ₁ = ${f3(r.incident.sigma)}°; the reflected shock sits at σ₂ = ${f3(r.reflected.sigma)}° from the region-② flow, i.e. ${f3(r.reflected.sigma - delta)}° to the wall.`}>
      <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle}>
        <Defs id={id} />
        <rect x={0} y={Y(1)} width={W} height={s} fill={machColor(M)} opacity={0.75} />
        <polygon points={`${X(0)},${Y(0)} ${X(xh)},${Y(1)} ${X(xr)},${Y(yr)}`} fill={machColor(r.incident.M2)} opacity={0.85} />
        <polygon points={`${X(xh)},${Y(1)} ${W},${Y(1)} ${W},${Y(xm * tD)} ${X(xr)},${Y(yr)}`} fill={machColor(r.M3)} opacity={0.85} />
        {[0.3, 0.65].map((y0) => {
          const xa = y0 / tI;
          const xb = (1 - y0 + xa * tD + xh * tP) / (tD + tP);
          const y2 = y0 + (xb - xa) * tD;
          return <path key={y0} d={`M8,${Y(y0)} L${X(xa)},${Y(y0)} L${X(xb)},${Y(y2)} L${W - 8},${Y(y2)}`} stroke="#fff" strokeOpacity={0.6} fill="none" markerEnd={`url(#${id}a)`} />;
        })}
        <polygon points={`0,${Y(0)} ${X(0)},${Y(0)} ${X(xm)},${Y(xm * tD)} ${W},${Y(xm * tD)} ${W},${H} 0,${H}`} fill={`url(#${id}h)`} stroke="#e6ebf2" strokeWidth={1.5} />
        <rect x={0} y={Y(1) - 26} width={W} height={26} fill={`url(#${id}h)`} stroke="#e6ebf2" strokeWidth={1.5} />
        <Shock id={id} d={`M${X(0)},${Y(0)} L${X(xh)},${Y(1)} L${X(xr)},${Y(yr)}`} />
        <path d={`M${X(xh)},${Y(1)} L${X(xh + 0.9)},${Y(1 - 0.9 * tD)}`} stroke="#f4f6fb" strokeDasharray="4 4" opacity={0.7} />
        <text x={10} y={Y(0.5)} style={lbl}>
          ① M₁ = {M}
        </text>
        <text x={X(xh * 0.62)} y={Y(0.33)} style={lbl}>
          ② {f3(r.incident.M2)}
        </text>
        <text x={Math.min(W - 70, X(xh + 0.5))} y={Y(0.82)} style={lbl}>
          ③ {f3(r.M3)}
        </text>
        <text x={X(0.25)} y={Y(0.04)} style={dim}>
          δ₁ = {delta}°
        </text>
        <text x={X(xh) + 6} y={Y(1) + 16} style={{ ...dim, fill: '#ffe2b8' }}>
          reflection point
        </text>
      </svg>
    </Figure>
  );
}

/** Velocity triangles: an oblique shock is a normal shock plus a tangential velocity. */
export function ObliqueVelocityFigure() {
  const id = useSvgId();
  const W = 560;
  const H = 280;
  const sg = 40;
  const L = 190;
  const O = [300, 160];
  const s = [cosd(sg), -sind(sg)]; // along the shock (screen coords)
  const n = [sind(sg), cosd(sg)]; // shock normal, downstream side
  const vxn = L * sind(sg);
  const vt = L * cosd(sg);
  const vyn = vxn / 2.2;
  const add = (p: number[], v: number[], k: number) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const tail = [O[0] - L, O[1]];
  const k1 = add(tail, n, vxn);
  const k2 = add(O, n, vyn);
  const head = add(k2, s, vt);
  const seg = (a: number[], b: number[], col: string, w = 2.5) => <path d={`M${a.join(',')} L${b.join(',')}`} stroke={col} strokeWidth={w} markerEnd={`url(#${id}a)`} fill="none" />;
  return (
    <Figure caption="The same tangential velocity V_T on both sides; only the normal component is shocked (V_xN → V_yN, smaller). The shorter normal leg tilts V_y toward the shock: that tilt is the deflection δ.">
      <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle}>
        <Defs id={id} />
        <Shock id={id} d={`M${add(O, s, -150).join(',')} L${add(O, s, 150).join(',')}`} />
        {seg(tail, k1, '#7cc4ff')}
        {seg(k1, O, '#9effc2')}
        {seg(tail, O, '#ffffff', 3)}
        {seg(O, k2, '#7cc4ff')}
        {seg(k2, head, '#9effc2')}
        {seg(O, head, '#ffffff', 3)}
        <path d={`M${O[0]},${O[1]} L${O[0] + 120},${O[1]}`} stroke="#f4f6fb" strokeDasharray="4 4" opacity={0.6} />
        <text x={tail[0] + 50} y={tail[1] - 8} style={lbl}>
          Vₓ
        </text>
        <text x={(tail[0] + k1[0]) / 2 - 8} y={(tail[1] + k1[1]) / 2 + 8} textAnchor="end" style={{ ...dim, fill: '#7cc4ff' }}>
          VₓN = Vₓ sin σ
        </text>
        <text x={(k1[0] + O[0]) / 2 + 6} y={(k1[1] + O[1]) / 2 + 16} style={{ ...dim, fill: '#9effc2' }}>
          V_T
        </text>
        <text x={(k2[0] + head[0]) / 2 + 6} y={(k2[1] + head[1]) / 2 + 16} style={{ ...dim, fill: '#9effc2' }}>
          V_T (unchanged)
        </text>
        <text x={head[0] + 8} y={head[1]} style={lbl}>
          V_y (turned by δ)
        </text>
        <text x={(O[0] + k2[0]) / 2 - 6} y={(O[1] + k2[1]) / 2 + 14} textAnchor="end" style={{ ...dim, fill: '#7cc4ff' }}>
          V_yN
        </text>
        <text x={add(O, s, 150)[0] - 10} y={add(O, s, 150)[1] - 8} textAnchor="end" style={{ ...dim, fill: '#ffe2b8' }}>
          oblique shock (σ = {sg}°)
        </text>
      </svg>
    </Figure>
  );
}

/** Diamond airfoil at angle of attack: four face regions, nose shocks and shoulder fans (drawn to scale from the lib). */
export function DiamondRegionsFigure({ M = 2, eps = 10, alpha = 5, caption }: { M?: number; eps?: number; alpha?: number; caption?: ReactNode }) {
  const id = useSvgId();
  const r = diamondAirfoil(M, eps, alpha);
  const [f1, f2, f3f, f4] = r.faces;
  const W = 600;
  const H = 300;
  const c = 300;
  const X = (x: number) => 140 + x * c;
  const Y = (y: number) => 150 - y * c;
  const TE = [cosd(alpha), -sind(alpha)];
  const mid = [TE[0] / 2, TE[1] / 2];
  const h = 0.5 * tand(eps);
  const TOP = [mid[0] + h * sind(alpha), mid[1] + h * cosd(alpha)];
  const BOT = [mid[0] - h * sind(alpha), mid[1] - h * cosd(alpha)];
  const mu = (m: number) => Math.asin(1 / m) / R;
  const at = (p: number[], a: number, Lr: number) => [p[0] + Lr * cosd(a), p[1] + Lr * sind(a)];
  const ray = (p: number[], a: number, Lr: number) => `M${X(p[0])},${Y(p[1])} L${X(at(p, a, Lr)[0])},${Y(at(p, a, Lr)[1])}`;
  const pts = (q: number[][]) => q.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ');
  const hU1 = f1.dir + mu(f1.M);
  const tU = f2.dir + mu(f2.M);
  const hL1 = f3f.dir - mu(f3f.M);
  const tL = f4.dir - mu(f4.M);
  const noseU = f1.wave === 'shock' ? f1.sigma : mu(M);
  const noseL = f3f.wave === 'shock' ? -f3f.sigma : -mu(M);
  return (
    <Figure caption={caption ?? `M∞ = ${M}, ε = ${eps}°, α = ${alpha}°: faces ① ${f3(f1.p * 100)}, ② ${f3(f2.p * 100)}, ③ ${f3(f3f.p * 100)}, ④ ${f3(f4.p * 100)} kPa for p∞ = 100 kPa.`}>
      <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle}>
        <Defs id={id} />
        <rect width={W} height={H} fill={machColor(M)} opacity={0.6} />
        <polygon points={pts([[0, 0], at([0, 0], noseU, 0.6), at(TOP, hU1, 0.6), TOP])} fill={machColor(f1.M)} opacity={0.85} />
        <polygon points={pts([[0, 0], at([0, 0], noseL, 0.6), at(BOT, hL1, 0.6), BOT])} fill={machColor(f3f.M)} opacity={0.85} />
        <polygon points={pts([TOP, at(TOP, tU, 0.6), [TE[0] + 0.55, TE[1] + 0.3], TE])} fill={machColor(f2.M)} opacity={0.85} />
        <polygon points={pts([BOT, at(BOT, tL, 0.6), [TE[0] + 0.55, TE[1] - 0.3], TE])} fill={machColor(f4.M)} opacity={0.85} />
        {f1.wave === 'shock' && <Shock id={id} d={ray([0, 0], f1.sigma, 0.6)} />}
        {f3f.wave === 'shock' && <Shock id={id} d={ray([0, 0], -f3f.sigma, 0.6)} />}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <path d={ray(TOP, hU1 + t * (tU - hU1), 0.6)} stroke="#cfe0ff" strokeOpacity={0.75} />
            <path d={ray(BOT, hL1 + t * (tL - hL1), 0.6)} stroke="#cfe0ff" strokeOpacity={0.75} />
          </g>
        ))}
        <polygon points={pts([[0, 0], TOP, TE])} fill={`url(#${id}m)`} />
        <polygon points={pts([[0, 0], TE, BOT])} fill="#6d7581" />
        <polygon points={pts([[0, 0], TOP, TE, BOT])} fill="none" stroke="#f4f6fb" strokeWidth={1.5} />
        <path d={`M${X(TE[0])},${Y(TE[1])} L${X(TE[0] + 0.35)},${Y(TE[1])}`} stroke="#f4f6fb" strokeDasharray="4 4" opacity={0.7} />
        <text x={X(TE[0] + 0.12)} y={Y(TE[1]) + 18} style={dim}>
          α = {alpha}° (chord to stream)
        </text>
        <text x={X(TOP[0] * 0.45) - 10} y={Y(TOP[1] * 0.5) - 8} style={lbl}>
          ①
        </text>
        <text x={X((TOP[0] + TE[0]) / 2) + 6} y={Y((TOP[1] + TE[1]) / 2) - 8} style={lbl}>
          ②
        </text>
        <text x={X(BOT[0] * 0.45) - 10} y={Y(BOT[1] * 0.5) + 18} style={lbl}>
          ③
        </text>
        <text x={X((BOT[0] + TE[0]) / 2) + 6} y={Y((BOT[1] + TE[1]) / 2) + 18} style={lbl}>
          ④
        </text>
        <text x={12} y={22} style={lbl}>
          M∞ = {M} →
        </text>
        <text x={W - 10} y={H - 10} textAnchor="end" style={dim}>
          glowing = shocks · blue rays = expansion fans
        </text>
      </svg>
    </Figure>
  );
}
