/** Block-diagram figures: a generic single-loop diagram and the full control-loop picture of Lecture 1. */
import { ReactNode } from 'react';

const INK = 'var(--text)';
const WIRE = 'var(--c1)';
const FILL = 'var(--surface)';

function Box({ x, y, w = 96, h = 44, label, sub, accent }: { x: number; y: number; w?: number; h?: number; label: string; sub?: string; accent?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="7" fill={FILL} stroke={accent ?? INK} strokeWidth="1.8" />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -2 : 5)} textAnchor="middle" fontSize="13.5" fontWeight="600" fill={INK}>
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize="10.5" fill="var(--muted)">
          {sub}
        </text>
      )}
    </g>
  );
}
function Sum({ x, y, signs = ['+', '−'] }: { x: number; y: number; signs?: [string, string] | string[] }) {
  return (
    <g>
      <circle cx={x} cy={y} r="14" fill={FILL} stroke={INK} strokeWidth="1.8" />
      <path d={`M${x - 8} ${y - 8} L${x + 8} ${y + 8} M${x + 8} ${y - 8} L${x - 8} ${y + 8}`} stroke={INK} strokeWidth="1.4" opacity=".55" />
      <text x={x - 22} y={y - 6} fontSize="12" fill={INK}>{signs[0]}</text>
      <text x={x - 6} y={y + 28} fontSize="12" fill={INK}>{signs[1]}</text>
    </g>
  );
}
const Arrow = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={WIRE} strokeWidth="2" />
    <path d={`M${x2} ${y2} l${x2 > x1 ? -8 : x2 < x1 ? 8 : 0} ${y2 > y1 ? -8 : y2 < y1 ? 8 : -4} m0 0`} stroke="none" />
    <polygon points={x2 > x1 ? `${x2},${y2} ${x2 - 9},${y2 - 5} ${x2 - 9},${y2 + 5}` : x2 < x1 ? `${x2},${y2} ${x2 + 9},${y2 - 5} ${x2 + 9},${y2 + 5}` : y2 > y1 ? `${x2},${y2} ${x2 - 5},${y2 - 9} ${x2 + 5},${y2 - 9}` : `${x2},${y2} ${x2 - 5},${y2 + 9} ${x2 + 5},${y2 + 9}`} fill={WIRE} />
  </g>
);

/** Single-loop diagram: R → ⊕ → [blocks…] → Y with a feedback block (or a plain wire). */
export function BlockDiagram({
  blocks,
  feedback,
  input = 'R(s)',
  output = 'Y(s)',
  errorLabel,
  caption,
  open = false,
}: {
  blocks: { label: string; sub?: string }[];
  feedback?: { label: string; sub?: string } | 'unity';
  input?: string;
  output?: string;
  errorLabel?: string;
  caption?: ReactNode;
  open?: boolean;
}) {
  const bw = 110;
  const gap = 46;
  const x0 = 80;
  const sumX = x0;
  const y = 60;
  const n = blocks.length;
  const start = open ? 30 : sumX + 14 + gap;
  const W = start + n * (bw + gap) + 40;
  const H = feedback && !open ? 170 : 110;
  const xs = blocks.map((_, i) => start + i * (bw + gap));
  const endX = xs[n - 1] + bw;
  return (
    <figure style={{ margin: '1rem 0' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <text x="10" y={y - 10} fontSize="13" fontWeight="700" fill={INK}>{input}</text>
        {!open && <Arrow x1={30} y1={y} x2={sumX - 14} y2={y} />}
        {!open && <Sum x={sumX} y={y} />}
        {!open && <Arrow x1={sumX + 14} y1={y} x2={xs[0]} y2={y} />}
        {open && <Arrow x1={10} y1={y} x2={xs[0]} y2={y} />}
        {!open && errorLabel && <text x={sumX + 22} y={y - 8} fontSize="11.5" fill="var(--muted)">{errorLabel}</text>}
        {blocks.map((b, i) => (
          <g key={i}>
            <Box x={xs[i]} y={y - 22} w={bw} label={b.label} sub={b.sub} />
            {i < n - 1 && <Arrow x1={xs[i] + bw} y1={y} x2={xs[i + 1]} y2={y} />}
          </g>
        ))}
        <Arrow x1={endX} y1={y} x2={endX + 38} y2={y} />
        <text x={endX + 4} y={y - 10} fontSize="13" fontWeight="700" fill={INK}>{output}</text>
        {feedback && !open && (
          <g>
            <line x1={endX + 20} y1={y} x2={endX + 20} y2={y + 70} stroke={WIRE} strokeWidth="2" />
            <circle cx={endX + 20} cy={y} r="3.5" fill={WIRE} />
            {feedback === 'unity' ? (
              <line x1={endX + 20} y1={y + 70} x2={sumX} y2={y + 70} stroke={WIRE} strokeWidth="2" />
            ) : (
              <>
                <line x1={endX + 20} y1={y + 70} x2={(sumX + endX) / 2 + 55} y2={y + 70} stroke={WIRE} strokeWidth="2" />
                <Box x={(sumX + endX) / 2 - 55} y={y + 48} w={110} label={feedback.label} sub={feedback.sub} />
                <line x1={(sumX + endX) / 2 - 55} y1={y + 70} x2={sumX} y2={y + 70} stroke={WIRE} strokeWidth="2" />
              </>
            )}
            <Arrow x1={sumX} y1={y + 70} x2={sumX} y2={y + 14} />
          </g>
        )}
      </svg>
      {caption && <figcaption style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 4 }}>{caption}</figcaption>}
    </figure>
  );
}

/** The full control loop of Lecture 1: controller → actuator → process, disturbance, sensor with noise. */
export function ControlLoopFigure({ caption }: { caption?: ReactNode }) {
  return (
    <figure style={{ margin: '1rem 0' }}>
      <svg viewBox="0 0 760 250" style={{ width: '100%', height: 'auto', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <text x="8" y="56" fontSize="12" fontWeight="700" fill={INK}>desired</text>
        <text x="8" y="70" fontSize="12" fontWeight="700" fill={INK}>output</text>
        <Arrow x1={60} y1={62} x2={96} y2={62} />
        <Sum x={110} y={62} />
        <Arrow x1={124} y1={62} x2={160} y2={62} />
        <text x={128} y={52} fontSize="11" fill="var(--muted)">error</text>
        <Box x={160} y={40} w={104} label="Controller" sub="decides" />
        <Arrow x1={264} y1={62} x2={316} y2={62} />
        <Sum x={330} y={62} signs={['+', '+']} />
        <text x={322} y={20} fontSize="11.5" fill="var(--c3)">disturbance (wind, load, hill…)</text>
        <Arrow x1={330} y1={28} x2={330} y2={48} />
        <Arrow x1={344} y1={62} x2={380} y2={62} />
        <Box x={380} y={40} w={96} label="Actuator" sub="valve, motor, heater" />
        <Arrow x1={476} y1={62} x2={512} y2={62} />
        <Box x={512} y={40} w={96} label="Process" sub="the thing controlled" />
        <Arrow x1={608} y1={62} x2={700} y2={62} />
        <text x={640} y={52} fontSize="12" fontWeight="700" fill={INK}>actual output</text>
        <line x1={650} y1={62} x2={650} y2={182} stroke={WIRE} strokeWidth="2" />
        <circle cx={650} cy={62} r="3.5" fill={WIRE} />
        <Sum x={560} y={182} signs={['+', '+']} />
        <Arrow x1={650} y1={182} x2={574} y2={182} />
        <text x={540} y={226} fontSize="11.5" fill="var(--c3)">measurement noise</text>
        <Arrow x1={560} y1={214} x2={560} y2={198} />
        <Arrow x1={546} y1={182} x2={474} y2={182} />
        <Box x={380} y={160} w={94} label="Sensor" sub="measures" />
        <line x1={380} y1={182} x2={110} y2={182} stroke={WIRE} strokeWidth="2" />
        <text x={240} y={174} fontSize="11.5" fill="var(--muted)">measured output (feedback)</text>
        <Arrow x1={110} y1={182} x2={110} y2={76} />
      </svg>
      {caption && <figcaption style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 4 }}>{caption}</figcaption>}
    </figure>
  );
}

/** Inverting / non-inverting op-amp stage with impedance boxes Z1 (input) and Z2 (feedback). */
export function OpAmpFigure({ z1 = 'Z₁', z2 = 'Z₂', mode = 'inverting', caption }: { z1?: string; z2?: string; mode?: 'inverting' | 'buffer'; caption?: ReactNode }) {
  const w = 'var(--c4)';
  return (
    <figure style={{ margin: '1rem 0' }}>
      <svg viewBox="0 0 520 220" style={{ width: '100%', height: 'auto', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <text x="14" y="58" fontSize="13" fontWeight="700" fill={INK}>e_i</text>
        {mode === 'inverting' ? (
          <>
            <line x1="40" y1="90" x2="100" y2="90" stroke={w} strokeWidth="2.4" />
            <rect x="100" y="74" width="70" height="32" rx="6" fill={FILL} stroke={INK} strokeWidth="1.8" />
            <text x="135" y="95" textAnchor="middle" fontSize="14" fontWeight="700" fill={INK}>{z1}</text>
            <line x1="170" y1="90" x2="250" y2="90" stroke={w} strokeWidth="2.4" />
            <circle cx="210" cy="90" r="3.5" fill={w} />
            <line x1="210" y1="90" x2="210" y2="30" stroke={w} strokeWidth="2.4" />
            <line x1="210" y1="30" x2="260" y2="30" stroke={w} strokeWidth="2.4" />
            <rect x="260" y="14" width="70" height="32" rx="6" fill={FILL} stroke={INK} strokeWidth="1.8" />
            <text x="295" y="35" textAnchor="middle" fontSize="14" fontWeight="700" fill={INK}>{z2}</text>
            <line x1="330" y1="30" x2="400" y2="30" stroke={w} strokeWidth="2.4" />
            <line x1="400" y1="30" x2="400" y2="110" stroke={w} strokeWidth="2.4" />
            <text x="218" y="76" fontSize="11.5" fill="var(--muted)">node a (virtual ground, V = 0)</text>
          </>
        ) : (
          <>
            <line x1="40" y1="90" x2="250" y2="90" stroke={w} strokeWidth="2.4" />
            <line x1="250" y1="130" x2="230" y2="130" stroke={w} strokeWidth="2.4" />
            <line x1="230" y1="130" x2="230" y2="190" stroke={w} strokeWidth="2.4" />
            <line x1="230" y1="190" x2="400" y2="190" stroke={w} strokeWidth="2.4" />
            <line x1="400" y1="190" x2="400" y2="110" stroke={w} strokeWidth="2.4" />
          </>
        )}
        <polygon points="250,60 250,150 350,105" fill={FILL} stroke={INK} strokeWidth="2" />
        <text x="258" y="88" fontSize="16" fontWeight="700" fill={INK}>{mode === 'inverting' ? '−' : '+'}</text>
        <text x="258" y="132" fontSize="16" fontWeight="700" fill={INK}>{mode === 'inverting' ? '+' : '−'}</text>
        {mode === 'inverting' && (
          <>
            <line x1="250" y1="130" x2="230" y2="130" stroke={w} strokeWidth="2.4" />
            <line x1="230" y1="130" x2="230" y2="170" stroke={w} strokeWidth="2.4" />
            <path d="M214 170 h32 M220 176 h20 M226 182 h8" stroke={INK} strokeWidth="2" fill="none" />
          </>
        )}
        <line x1="350" y1="105" x2="460" y2="105" stroke={w} strokeWidth="2.4" />
        <circle cx="400" cy="105" r="3.5" fill={w} />
        <text x="468" y="100" fontSize="13" fontWeight="700" fill={INK}>e_o</text>
        <text x="270" y="206" fontSize="12" fill="var(--muted)">{mode === 'inverting' ? 'e_o/e_i = −Z₂/Z₁' : 'voltage follower: e_o = e_i, no load on the source'}</text>
      </svg>
      {caption && <figcaption style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 4 }}>{caption}</figcaption>}
    </figure>
  );
}
