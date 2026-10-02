/* Group A figures — realistic SVG setups (metal walls, Mach-coloured flow) and 2-D charts for Ch 4–6 and PS1–PS4. */
import { ReactNode, useId } from 'react';
import { Figure } from '../../../core/ui';
import { Plot, sample } from '../../../core/Plot';
import * as ise from '../lib/isentropic';
import { rocket } from '../lib/rocket';
import { cp, gasR } from '../lib/gas';
import { machColor } from '../sims/common';
import { isentropicPath } from '../sims/simsA';

const txt = { fontSize: 12, fill: 'var(--text)' } as const;
const mut = { fontSize: 11, fill: 'var(--muted)' } as const;
const svgStyle = { width: '100%', height: 'auto' } as const;

/** Shared <defs>: brushed-metal gradients, cut-section hatching, arrow head, water and sky. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f2f4f7" />
        <stop offset="0.35" stopColor="#aeb5c0" />
        <stop offset="0.55" stopColor="#6b7380" />
        <stop offset="0.8" stopColor="#c9ced6" />
        <stop offset="1" stopColor="#7d8591" />
      </linearGradient>
      <linearGradient id={`${id}-metalH`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7d8591" />
        <stop offset="0.3" stopColor="#e9ecf0" />
        <stop offset="0.6" stopColor="#9aa2ae" />
        <stop offset="1" stopColor="#5f6672" />
      </linearGradient>
      <linearGradient id={`${id}-copper`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f3c7a1" />
        <stop offset="0.5" stopColor="#b8683a" />
        <stop offset="1" stopColor="#6e3a1f" />
      </linearGradient>
      <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#8d95a1" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="#4a515c" strokeWidth="1.4" />
      </pattern>
      <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5aa9e6" />
        <stop offset="0.5" stopColor="#2f6fe0" />
        <stop offset="1" stopColor="#1d4fa8" />
      </linearGradient>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0d1b3d" />
        <stop offset="1" stopColor="#4d7fc4" />
      </linearGradient>
      <linearGradient id={`${id}-desert`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8fc1ef" />
        <stop offset="0.75" stopColor="#f2d6a8" />
        <stop offset="1" stopColor="#c9a26b" />
      </linearGradient>
      <marker id={`${id}-arr`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10z" fill="var(--text)" />
      </marker>
    </defs>
  );
}

/** Half-height of the duct (0–1 of the band) and Mach number along s ∈ [0, 1]. */
interface DuctProps {
  id: string;
  x: number;
  y: number;
  w: number;
  /** maximum half-height of the flow passage in px */
  h: number;
  r: (s: number) => number;
  M: (s: number) => number;
  wall?: number;
}
/** A realistic duct cut-away: Mach-coloured flow passage between hatched metal walls, with streamlines. */
function Duct({ id, x, y, w, h, r, M, wall = 9 }: DuctProps) {
  const gid = `${id}-flow-${x}-${y}`;
  const n = 40;
  const pts = Array.from({ length: n + 1 }, (_, i) => i / n);
  const top = pts.map((s) => `${x + s * w},${y - r(s) * h}`).join(' L');
  const bot = pts
    .slice()
    .reverse()
    .map((s) => `${x + s * w},${y + r(s) * h}`)
    .join(' L');
  const wallTop = `M${pts.map((s) => `${x + s * w},${y - r(s) * h}`).join(' L')} L${x + w},${y - r(1) * h - wall} L${pts
    .slice()
    .reverse()
    .map((s) => `${x + s * w},${y - r(s) * h - wall}`)
    .join(' L')} Z`;
  const wallBot = `M${pts.map((s) => `${x + s * w},${y + r(s) * h}`).join(' L')} L${x + w},${y + r(1) * h + wall} L${pts
    .slice()
    .reverse()
    .map((s) => `${x + s * w},${y + r(s) * h + wall}`)
    .join(' L')} Z`;
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          {Array.from({ length: 13 }, (_, i) => i / 12).map((s) => (
            <stop key={s} offset={s} stopColor={machColor(M(s))} />
          ))}
        </linearGradient>
      </defs>
      <path d={`M${top} L${bot} Z`} fill={`url(#${gid})`} />
      {[-0.6, 0, 0.6].map((f) => (
        <path
          key={f}
          d={`M${pts.map((s) => `${x + s * w},${y + f * r(s) * h}`).join(' L')}`}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1}
          strokeDasharray="10 7"
        />
      ))}
      <path d={wallTop} fill={`url(#${id}-hatch)`} stroke="#3c424c" strokeWidth={1} />
      <path d={wallBot} fill={`url(#${id}-hatch)`} stroke="#3c424c" strokeWidth={1} />
      <path d={`M${pts.map((s) => `${x + s * w},${y - r(s) * h - wall}`).join(' L')}`} fill="none" stroke={`url(#${id}-metalH)`} strokeWidth={3} />
      <path d={`M${pts.map((s) => `${x + s * w},${y + r(s) * h + wall}`).join(' L')}`} fill="none" stroke={`url(#${id}-metalH)`} strokeWidth={3} />
    </g>
  );
}

/** Isentropic duct from M1 to M2 (via a throat if needed), drawn as a cut-away. */
function PathDuct({ id, x, y, w, h, M1, M2, g = 1.4 }: { id: string; x: number; y: number; w: number; h: number; M1: number; M2: number; g?: number }) {
  const p = isentropicPath(M1, M2, g);
  return <Duct id={id} x={x} y={y} w={w} h={h} r={(s) => Math.sqrt(p.A(s) / p.Amax)} M={p.M} />;
}

function Wrap({ caption, vb, children }: { caption: ReactNode; vb: string; children: (id: string) => ReactNode }) {
  const id = useId().replace(/:/g, '');
  return (
    <Figure caption={caption}>
      <svg viewBox={vb} style={svgStyle}>
        <Defs id={id} />
        {children(id)}
      </svg>
    </Figure>
  );
}

/* ======================= Velocity–area sign diagram ======================= */
export function VelocityAreaFigure() {
  const cells: [string, number, number, string][] = [
    ['subsonic nozzle', 0.3, 0.8, 'M < 1, dA < 0 → V ↑, p ↓'],
    ['subsonic diffuser', 0.8, 0.3, 'M < 1, dA > 0 → V ↓, p ↑'],
    ['supersonic diffuser', 2.6, 1.4, 'M > 1, dA < 0 → V ↓, p ↑'],
    ['supersonic nozzle', 1.4, 2.6, 'M > 1, dA > 0 → V ↑, p ↓'],
  ];
  return (
    <Wrap vb="0 0 600 300" caption="The four cases of dV/V = (dA/A)/(M² − 1). Colour = local Mach number (blue subsonic, orange supersonic). Subsonic and supersonic flow do exactly opposite things in the same duct.">
      {(id) =>
        cells.map(([name, a, b, rule], i) => {
          const cx = (i % 2) * 300;
          const cy = Math.floor(i / 2) * 150;
          return (
            <g key={name}>
              <text x={cx + 20} y={cy + 18} style={{ ...txt, fontWeight: 600 }}>
                {name}
              </text>
              <PathDuct id={id} x={cx + 20} y={cy + 75} w={260} h={34} M1={a} M2={b} />
              <text x={cx + 20} y={cy + 140} style={mut}>
                {rule}
              </text>
            </g>
          );
        })
      }
    </Wrap>
  );
}

/* ======================= Generic isentropic duct (realistic SVG) ======================= */
export function DuctSetupFigure({
  M1,
  M2,
  g = 1.4,
  left = [],
  right = [],
  middle,
  caption,
}: {
  M1: number;
  M2: number;
  g?: number;
  left?: string[];
  right?: string[];
  middle?: string;
  caption: string;
}) {
  return (
    <Wrap vb="0 0 600 200" caption={caption}>
      {(id) => (
        <g>
          <PathDuct id={id} x={150} y={100} w={300} h={60} M1={M1} M2={M2} g={g} />
          <line x1={150} x2={150} y1={20} y2={180} stroke="var(--c2)" strokeDasharray="4 3" />
          <line x1={450} x2={450} y1={20} y2={180} stroke="var(--c2)" strokeDasharray="4 3" />
          {left.map((l, i) => (
            <text key={l} x={140} y={60 + i * 16} textAnchor="end" style={txt}>
              {l}
            </text>
          ))}
          {right.map((l, i) => (
            <text key={l} x={460} y={60 + i * 16} style={txt}>
              {l}
            </text>
          ))}
          {middle && (
            <text x={300} y={195} textAnchor="middle" style={mut}>
              {middle}
            </text>
          )}
        </g>
      )}
    </Wrap>
  );
}

/* ======================= PS1 P4: four-port water junction ======================= */
export function BranchPipeFigure() {
  // port: centre-line start, direction, radius (px), label
  return (
    <Wrap vb="0 0 600 340" caption="PS1 P4 setup. Water enters at ports 1 and 2 and leaves at 3 and 4. Every port contributes its impulse function (p + ρV²)A along its flow direction; the pressure terms (hundreds of kPa × m²) dwarf the momentum terms.">
      {(id) => (
        <g>
          {/* body */}
          <circle cx={300} cy={190} r={70} fill={`url(#${id}-metal)`} stroke="#3c424c" />
          {/* port 1: from left */}
          <rect x={60} y={190 - 20} width={190} height={40} fill={`url(#${id}-metal)`} stroke="#3c424c" />
          <rect x={60} y={190 - 14} width={190} height={28} fill={`url(#${id}-water)`} />
          {/* port 2: from below */}
          <rect x={300 - 40} y={240} width={80} height={90} fill={`url(#${id}-metalH)`} stroke="#3c424c" />
          <rect x={300 - 32} y={240} width={64} height={90} fill={`url(#${id}-water)`} />
          {/* port 3: to right */}
          <rect x={350} y={190 - 30} width={200} height={60} fill={`url(#${id}-metal)`} stroke="#3c424c" />
          <rect x={350} y={190 - 22} width={200} height={44} fill={`url(#${id}-water)`} />
          {/* port 4: 30° up-right */}
          <g transform="rotate(-30 300 190)">
            <rect x={340} y={190 - 100} width={210} height={64} fill={`url(#${id}-metal)`} stroke="#3c424c" />
            <rect x={340} y={190 - 92} width={210} height={48} fill={`url(#${id}-water)`} />
            <line x1={420} x2={520} y1={190 - 68} y2={190 - 68} stroke="white" strokeWidth={2} markerEnd={`url(#${id}-arr)`} />
          </g>
          <line x1={70} x2={160} y1={190} y2={190} stroke="white" strokeWidth={2} markerEnd={`url(#${id}-arr)`} />
          <line x1={300} x2={300} y1={325} y2={260} stroke="white" strokeWidth={2} markerEnd={`url(#${id}-arr)`} />
          <line x1={440} x2={540} y1={190} y2={190} stroke="white" strokeWidth={2} markerEnd={`url(#${id}-arr)`} />
          <text x={60} y={160} style={txt}>1: 350 kPa, 3 m/s, R = 0.2 m</text>
          <text x={340} y={334} style={txt}>2: 300 kPa, 1.8 m/s, R = 0.4 m</text>
          <text x={400} y={245} style={txt}>3: 150 kPa, 2.1 m/s, R = 0.3 m</text>
          <text x={350} y={22} style={txt}>4: 200 kPa, V₄ = ?, R = 0.32 m, 30°</text>
          <text x={10} y={20} style={mut}>water, ρ = 1000 kg/m³ · x →, y ↑</text>
        </g>
      )}
    </Wrap>
  );
}

/* ======================= PS1 P7: Yeager vs Green ======================= */
export function SoundBarrierFigure() {
  const c1 = Math.sqrt(1.4 * 287 * 216);
  const c2 = Math.sqrt(1.4 * 287 * 303);
  return (
    <Wrap vb="0 0 600 260" caption={`Mach 1 is not a fixed speed. At 13 km (−57 °C) c ≈ ${c1.toFixed(0)} m/s; on a hot desert floor (30 °C) c ≈ ${c2.toFixed(0)} m/s (√(γRT)), so Green had to go faster.`}>
      {(id) => (
        <g>
          <rect x={0} y={0} width={295} height={260} fill={`url(#${id}-sky)`} rx={8} />
          <rect x={305} y={0} width={295} height={260} fill={`url(#${id}-desert)`} rx={8} />
          {/* X-1: orange bullet */}
          <g transform="translate(70 110)">
            <path d="M0,10 C30,-6 110,-6 150,10 C110,26 30,26 0,10 Z" fill="#e8892b" stroke="#7a3d0c" />
            <path d="M60,10 L40,-22 L80,10 Z M60,10 L40,42 L80,10 Z" fill="#c96d16" />
            <path d="M5,10 L-10,0 L-10,20 Z" fill="#c96d16" />
          </g>
          <text x={14} y={24} style={{ fontSize: 13, fill: '#fff', fontWeight: 600 }}>Bell X-1 · 1947 · 13 000 m</text>
          <text x={14} y={42} style={{ fontSize: 12, fill: '#dbe6ff' }}>T = −57 °C = 216 K</text>
          <text x={14} y={226} style={{ fontSize: 14, fill: '#fff', fontWeight: 700 }}>c = √(γRT) = {c1.toFixed(0)} m/s</text>
          {/* Thrust SSC */}
          <g transform="translate(340 170)">
            <rect x={0} y={0} width={200} height={22} rx={8} fill={`url(#${id}-metal)`} stroke="#333" />
            <rect x={20} y={-14} width={55} height={16} rx={5} fill={`url(#${id}-metal)`} stroke="#333" />
            <rect x={120} y={-14} width={55} height={16} rx={5} fill={`url(#${id}-metal)`} stroke="#333" />
            <circle cx={30} cy={26} r={9} fill="#222" />
            <circle cx={170} cy={26} r={9} fill="#222" />
            <path d="M200,8 L250,2 L250,22 L200,16 Z" fill="rgba(200,160,110,0.6)" />
          </g>
          <text x={318} y={24} style={{ fontSize: 13, fill: '#1b2333', fontWeight: 600 }}>Thrust SSC · 1997 · Black Rock</text>
          <text x={318} y={42} style={{ fontSize: 12, fill: '#1b2333' }}>T = 30 °C = 303 K</text>
          <text x={318} y={240} style={{ fontSize: 14, fill: '#1b2333', fontWeight: 700 }}>c = √(γRT) = {c2.toFixed(0)} m/s</text>
        </g>
      )}
    </Wrap>
  );
}

/* ======================= Piston in a tube: compression vs rarefaction ======================= */
export function PistonWaveFigure() {
  const row = (id: string, y: number, push: boolean) => (
    <g>
      <rect x={20} y={y - 32} width={560} height={64} fill={`url(#${id}-metal)`} rx={4} />
      <rect x={20} y={y - 24} width={560} height={48} fill={machColor(0.05)} opacity={0.35} />
      <rect x={20} y={y - 24} width={260} height={48} fill={push ? 'var(--c2)' : 'var(--c1)'} opacity={push ? 0.35 : 0.25} />
      <rect x={push ? 60 : 30} y={y - 24} width={30} height={48} fill={`url(#${id}-metalH)`} stroke="#333" />
      <rect x={push ? 0 : -30} y={y - 6} width={60} height={12} fill={`url(#${id}-metal)`} stroke="#333" />
      <line x1={280} x2={280} y1={y - 26} y2={y + 26} stroke={push ? 'var(--c2)' : 'var(--c1)'} strokeWidth={4} />
      <line x1={290} x2={350} y1={y - 40} y2={y - 40} stroke="var(--text)" strokeWidth={1.6} markerEnd={`url(#${id}-arr)`} />
      <text x={355} y={y - 36} style={txt}>wave runs at c</text>
      <line x1={push ? 150 : 210} x2={push ? 210 : 150} y1={y} y2={y} stroke="var(--text)" strokeWidth={2} markerEnd={`url(#${id}-arr)`} />
      <text x={110} y={y + 44} style={txt}>
        {push ? 'gas behind moves WITH the wave: p + dp, ρ + dρ' : 'gas behind moves AGAINST the wave: p − dp, ρ − dρ'}
      </text>
      <text x={400} y={y + 6} style={mut}>still gas: p, ρ, V = 0</text>
    </g>
  );
  return (
    <Wrap vb="0 0 600 260" caption="Lab frame. Top: a piston pushed in makes a compression wave (dp > 0) and the gas follows the wave. Bottom: a piston pulled out makes a rarefaction (dp < 0) and the gas moves the other way. Both run at the same c = √(γRT) because the waves are infinitesimal.">
      {(id) => (
        <g>
          {row(id, 70, true)}
          {row(id, 190, false)}
        </g>
      )}
    </Wrap>
  );
}

/* ======================= PS1 P1: control volume, stream tube, steady/uniform ======================= */
export function StreamTubeFigure() {
  return (
    <Wrap vb="0 0 600 220" caption="A stream tube (walls made of streamlines, so nothing crosses them) inside a duct, with a dashed control volume. 1-D flow: properties vary only along x, while the area A(x) may change.">
      {(id) => (
        <g>
          <PathDuct id={id} x={40} y={110} w={520} h={80} M1={0.25} M2={0.5} />
          <path d="M40,95 C200,95 400,102 560,104 L560,116 C400,118 200,125 40,125 Z" fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth={1.5} />
          <rect x={150} y={20} width={260} height={180} fill="none" stroke="var(--c2)" strokeDasharray="7 5" strokeWidth={2} />
          <text x={160} y={16} style={txt}>control volume (fixed in space)</text>
          <text x={420} y={95} style={{ fontSize: 12, fill: '#fff' }}>stream tube</text>
          <text x={40} y={215} style={mut}>streamline: tangent to V everywhere · steady: no ∂/∂t · uniform: no change across a section</text>
        </g>
      )}
    </Wrap>
  );
}

/* ======================= PS3 P3: balloon, airliner and sample bottle ======================= */
export function BottleValveFigure() {
  return (
    <Wrap vb="0 0 600 260" caption="Same air, three observers. On the balloon the air is at rest (p₀ = p = 0.26 atm). The airliner sees it at M 0.86 (p₀ = 0.421 atm). At the bottle's valve the air rushes into vacuum and chokes: p* = 0.5283 × 0.26 = 0.137 atm.">
      {(id) => (
        <g>
          <rect x={0} y={0} width={600} height={260} fill={`url(#${id}-sky)`} rx={8} />
          {/* balloon */}
          <ellipse cx={110} cy={70} rx={55} ry={62} fill="#d94f3d" stroke="#7a1f14" />
          <path d="M70,110 L95,160 M150,110 L125,160" stroke="#ddd" />
          <rect x={90} y={160} width={40} height={26} fill="#8a5a2b" stroke="#3d260f" />
          {/* bottle */}
          <rect x={210} y={140} width={46} height={100} rx={18} fill={`url(#${id}-metalH)`} stroke="#333" />
          <rect x={226} y={118} width={14} height={24} fill={`url(#${id}-copper)`} />
          <path d="M218,112 L248,112 L233,124 Z" fill="#c22" />
          <text x={214} y={200} style={{ fontSize: 12, fill: '#111', fontWeight: 600 }}>p = 0</text>
          <circle cx={233} cy={126} r={6} fill={machColor(1)} stroke="#fff" />
          <text x={180} y={104} style={{ fontSize: 11, fill: '#fff' }}>valve: M = 1, p* = 0.137 atm</text>
          {/* airliner */}
          <g transform="translate(330 60)">
            <path d="M0,20 C20,6 200,6 230,16 C240,20 240,26 230,30 C200,38 20,38 0,24 Z" fill={`url(#${id}-metal)`} stroke="#333" />
            <path d="M110,22 L70,70 L95,70 L150,26 Z" fill={`url(#${id}-metalH)`} stroke="#333" />
            <path d="M10,18 L-10,-12 L10,-12 L30,14 Z" fill={`url(#${id}-metalH)`} stroke="#333" />
          </g>
          {[0, 1, 2].map((k) => (
            <line key={k} x1={590} x2={575} y1={70 + k * 12} y2={70 + k * 12} stroke={machColor(0.86)} strokeWidth={3} />
          ))}
          <text x={340} y={160} style={{ fontSize: 12, fill: '#fff' }}>airliner frame: air arrives at M = 0.86</text>
          <text x={340} y={178} style={{ fontSize: 12, fill: '#fff' }}>p = 0.26 atm, p₀ = 0.421 atm</text>
          <text x={14} y={210} style={{ fontSize: 12, fill: '#fff' }}>balloon frame: p = p₀ = 0.26 atm</text>
          <text x={14} y={250} style={{ fontSize: 11, fill: '#dbe6ff' }}>10 km · T = −50 °C</text>
        </g>
      )}
    </Wrap>
  );
}

/* ======================= PS4 P2: rocket control volume ======================= */
export function RocketCVFigure() {
  return (
    <Wrap vb="0 0 600 240" caption="Rocket control volume (notes §6.3). p_amb acts everywhere on the surface except the exit plane, where p_e acts over A_e; the only momentum flux is ṁV_e out of the exit. Result: F = ṁV_e + A_e(p_e − p_amb).">
      {(id) => (
        <g>
          <rect x={0} y={0} width={600} height={240} fill="#0b1020" rx={8} />
          {/* chamber + bell */}
          <path d="M120,70 L240,70 C270,70 280,100 300,104 C340,104 400,60 470,40 L470,200 C400,180 340,136 300,136 C280,140 270,170 240,170 L120,170 Z" fill={`url(#${id}-metal)`} stroke="#222" />
          <path d="M130,82 L238,82 C262,82 276,110 300,114 C340,114 400,78 462,54 L462,186 C400,162 340,126 300,126 C276,130 262,158 238,158 L130,158 Z" fill="url(#rocketflow)" />
          <defs>
            <linearGradient id="rocketflow" x1="0" x2="1">
              <stop offset="0" stopColor={machColor(0.1)} />
              <stop offset="0.45" stopColor={machColor(0.8)} />
              <stop offset="0.52" stopColor={machColor(1)} />
              <stop offset="1" stopColor={machColor(3)} />
            </linearGradient>
          </defs>
          <path d="M470,40 L590,20 L590,220 L470,200 Z" fill={machColor(3)} opacity={0.35} />
          <rect x={95} y={24} width={385} height={192} fill="none" stroke="#ffd166" strokeDasharray="8 5" strokeWidth={2} />
          {[50, 90, 130, 170].map((y) => (
            <line key={y} x1={60} x2={92} y1={y} y2={y} stroke="#9fb0d6" strokeWidth={1.5} markerEnd={`url(#${id}-arr)`} />
          ))}
          <line x1={90} x2={20} y1={120} y2={120} stroke="#ff7a2a" strokeWidth={4} markerEnd={`url(#${id}-arr)`} />
          <text x={14} y={110} style={{ fontSize: 13, fill: '#ff9b5a', fontWeight: 700 }}>F</text>
          <text x={30} y={40} style={{ fontSize: 11, fill: '#9fb0d6' }}>p_amb</text>
          <text x={486} y={110} style={{ fontSize: 12, fill: '#fff' }}>p_e, V_e, A_e</text>
          <text x={150} y={124} style={{ fontSize: 12, fill: '#fff' }}>p₀, T₀ (chamber)</text>
          <text x={300} y={232} style={{ fontSize: 11, fill: '#ffd166' }}>control volume</text>
        </g>
      )}
    </Wrap>
  );
}

/* ======================= Feb 5: wind through a window ======================= */
export function WindowFigure() {
  const M = ise.M_from_p_p0(0.92);
  const r = ise.A_Astar(M);
  const bl = (a: number, b: number, s: number) => a + (b - a) * 0.5 * (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, s))));
  // [label, y, area A(s) in m², sonic area A* in m²]
  const rows: [string, number, (s: number) => number, number][] = [
    [`converging, A_exit = 1 m²: M_exit = ${M.toFixed(3)}, ṁ ≈ 130 kg/s`, 30, (s) => bl(3, 1, s), 1 / r],
    ['converging extension to 0.5 m²: same M_exit, ṁ halves', 130, (s) => bl(3, 0.5, s), 0.5 / r],
    [`C-D with throat = A* = ${(1 / r).toFixed(3)} m², exit 1 m²: throat just sonic`, 230, (s) => (s < 0.5 ? bl(3, 1 / r, s / 0.5) : bl(1 / r, 1, (s - 0.5) / 0.5)), 1 / r],
  ];
  return (
    <Wrap vb="0 0 600 330" caption={`Feb 5 lecture: outside air (p₀ = 1 bar, 300 K) blows into a building at p_b = 0.92 bar. The exit Mach number ${M.toFixed(3)} is fixed by p₀/p_b alone; the area only changes ṁ. A C-D passage with throat ${(1 / r).toFixed(3)} m² makes the throat sonic.`}>
      {(id) =>
        rows.map(([lab, y, A, As]) => (
          <g key={lab}>
            <rect x={20} y={y - 6} width={70} height={76} fill="#9cc4ff" opacity={0.35} />
            <text x={24} y={y + 8} style={mut}>outside</text>
            <text x={24} y={y + 22} style={mut}>1 bar</text>
            <Duct id={id} x={90} y={y + 32} w={300} h={34} r={(s) => Math.sqrt(A(s) / 3)} M={(s) => ise.M_from_A_Astar(Math.max(1, A(s) / As), 'sub')} />
            <rect x={390} y={y - 6} width={190} height={76} fill="#e9dcc9" opacity={0.35} />
            <text x={400} y={y + 8} style={mut}>inside, p_b = 0.92 bar</text>
            <text x={20} y={y + 88} style={txt}>{lab}</text>
          </g>
        ))
      }
    </Wrap>
  );
}


/* ======================= Invariants / stagnation-state illustration ======================= */
export function InvariantsFigure() {
  return (
    <Wrap vb="0 0 600 230" caption="The three invariants of an isentropic duct. T₀ and p₀ are the state of an imaginary reservoir the gas could have come from (brought to rest isentropically); A* is the imaginary throat that would pass the same ṁ at M = 1. Compute them once, use them at every station.">
      {(id) => (
        <g>
          <rect x={10} y={40} width={120} height={150} rx={22} fill={`url(#${id}-metalH)`} stroke="#333" />
          <rect x={22} y={52} width={96} height={126} rx={16} fill={machColor(0)} opacity={0.75} />
          <text x={30} y={100} style={{ fontSize: 12, fill: '#fff', fontWeight: 600 }}>"reservoir"</text>
          <text x={30} y={118} style={{ fontSize: 12, fill: '#fff' }}>T₀, p₀, V = 0</text>
          <text x={30} y={136} style={{ fontSize: 11, fill: '#dbe6ff' }}>(may not exist)</text>
          <PathDuct id={id} x={130} y={115} w={300} h={60} M1={0.12} M2={0.8} />
          <Duct id={id} x={430} y={115} w={150} h={60 * Math.sqrt(1.0382 / ise.A_Astar(0.12))} r={(s) => Math.sqrt(1 - 0.0368 * s * (2 - s))} M={(s) => 0.8 + 0.2 * s} />
          <rect x={430} y={20} width={150} height={190} fill="var(--surface)" opacity={0.55} />
          <line x1={580} x2={580} y1={60} y2={170} stroke="var(--c2)" strokeWidth={2.5} strokeDasharray="5 4" />
          <text x={470} y={52} style={{ ...txt, fill: 'var(--c2)' }}>A* (virtual throat)</text>
          {[
            [250, '1: M = 0.5, p = 0.843 atm, A = 1 m²'],
            [420, '2: M = 0.8'],
          ].map(([x, l]) => (
            <g key={l as string}>
              <line x1={x as number} x2={x as number} y1={25} y2={205} stroke="var(--muted)" strokeDasharray="3 3" />
              <text x={(x as number) - 60} y={222} style={txt}>{l as string}</text>
            </g>
          ))}
          <text x={150} y={18} style={txt}>invariants: T₀ (adiabatic) · p₀ = 1.00 atm (isentropic) · A* = 0.746 m²</text>
        </g>
      )}
    </Wrap>
  );
}

/* ======================= Charts ======================= */
/** PS4 P1: thrust vs exit area for fixed chamber and ambient pressure. */
export function ThrustHumpFigure() {
  const p0 = 2e6;
  const pa = 1e5;
  const F = (AR: number) => rocket({ p0, T0: 1500, R: 300, g: 1.4, At: 1, AR, pa }).F / 1e6;
  const best = ise.A_Astar(ise.M_from_p_p0(pa / p0));
  return (
    <Figure caption={`Thrust of a fixed chamber (p₀ = 2 MPa, p_a = 100 kPa) as the exit area grows. The hump peaks exactly where p_e = p_a (A_e/A_t = ${best.toFixed(2)}): d²F/dA_e² = dp_e/dA_e < 0 for supersonic exit flow, so it is a maximum.`}>
      <Plot
        x={[1.2, 8]}
        y={[1.6, 2.4]}
        height={260}
        xLabel="A_e / A_t"
        yLabel="F per m² of throat (MN)"
        series={[{ points: sample(F, 1.2, 8, 200), width: 3, label: 'F = ṁV_e + A_e(p_e − p_a)' }]}
        vlines={[{ x: best, label: 'p_e = p_a', color: 'var(--c2)' }]}
        dots={[{ x: best, y: F(best) }]}
      />
    </Figure>
  );
}

/** PS2 P2: stagnation temperature on the nose vs Mach number. */
export function NoseTemperatureFigure() {
  return (
    <Figure caption="T₀ = T(1 + 0.2M²): the nose of the vehicle sees the stagnation temperature. At Mach 5 it is six times the static temperature.">
      <Plot
        x={[0, 5]}
        y={[0, 2000]}
        height={240}
        xLabel="flight Mach number"
        yLabel="T₀ (K)"
        series={[
          { points: sample((M) => 216 * ise.T0_T(M), 0, 5), width: 3, label: 'Yeager, T = 216 K' },
          { points: sample((M) => 303 * ise.T0_T(M), 0, 5), width: 3, label: 'Green, T = 303 K' },
        ]}
        dots={[
          { x: 1, y: 259.2, label: '259 K' },
          { x: 1, y: 363.6, label: '364 K' },
          { x: 5, y: 1296, label: '1296 K' },
          { x: 5, y: 1818, label: '1818 K' },
        ]}
      />
    </Figure>
  );
}

/** PS3 P5: V_max = √(2 c_p T₀) for several gases at T₀ = 3000 K. */
export function VmaxGasFigure() {
  const gases: [string, number, number][] = [
    ['H₂', 1.4, 2],
    ['He', 1.67, 4],
    ['H₂O', 1.33, 18],
    ['N₂', 1.4, 28],
    ['Air', 1.4, 28.9],
    ['CO₂', 1.29, 44],
  ];
  const rows = gases.map(([n, g, MW]) => ({ n, v: ise.Vmax(cp(g, gasR(MW)), 3000) }));
  const X = (v: number) => 60 + (v / 10000) * 460;
  return (
    <Figure caption="Maximum steady expansion speed V_max = √(2c_pT₀) at T₀ = 3000 K. Low molecular weight wins by far: hydrogen reaches 9.3 km/s.">
      <svg viewBox="0 0 580 200" style={svgStyle}>
        {rows.map((r, i) => (
          <g key={r.n} transform={`translate(0 ${8 + i * 31})`}>
            <text x={6} y={17} style={txt}>
              {r.n}
            </text>
            <rect x={X(0)} y={4} width={X(r.v) - X(0)} height={18} fill={i === 0 ? 'var(--c2)' : 'var(--c1)'} opacity={0.85} />
            <text x={X(r.v) + 4} y={17} style={txt}>
              {r.v.toFixed(0)} m/s
            </text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}
