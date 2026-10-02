/**
 * CircuitBoard — a ladder-style schematic renderer for the equivalent circuits of the analogy chapters.
 * Series elements sit on the top rail, shunt branches (stacks of elements) hang down to the ground rail,
 * sources and transformers/gyrators span rail → ground. Rendered like a printed schematic with copper-coloured traces.
 */
import { ReactNode } from 'react';

export type Kind = 'R' | 'L' | 'C' | 'Vs' | 'Is';
export interface El {
  kind: Kind;
  label: string;
  /** small second line, e.g. what it stands for ("mass m₁") */
  sub?: string;
}
export type Section =
  | { type: 'series'; el: El }
  | { type: 'shunt'; stack: El[]; node?: string }
  | { type: 'xfmr'; ratio: string; gyrator?: boolean }
  | { type: 'bridge'; els: El[]; node?: string }
  | { type: 'wire'; node?: string };

const COPPER = 'var(--c4)';
const INK = 'var(--text)';
const LAB = 'var(--muted)';

function symbol(kind: Kind) {
  // horizontal symbol centred at (0,0), 60 px long
  switch (kind) {
    case 'R':
      return <path d="M-30 0 H-22 L-18 -9 L-10 9 L-2 -9 L6 9 L14 -9 L18 0 H30" fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />;
    case 'L':
      return (
        <g fill="none" stroke={INK} strokeWidth="2.2">
          <path d="M-30 0 H-22" />
          <path d="M-22 0 a6 8 0 0 1 12 0 a6 8 0 0 1 12 0 a6 8 0 0 1 12 0 a6 8 0 0 1 12 0" transform="translate(0,0)" />
          <path d="M26 0 H30" />
        </g>
      );
    case 'C':
      return (
        <g stroke={INK} strokeWidth="2.4" fill="none">
          <path d="M-30 0 H-5 M5 0 H30" />
          <path d="M-5 -13 V13" />
          <path d="M5 -13 V13" />
        </g>
      );
    case 'Vs':
      return (
        <g stroke={INK} strokeWidth="2.2" fill="var(--surface)">
          <path d="M-30 0 H-14 M14 0 H30" />
          <circle r="14" />
          <path d="M-8 -3 H-2 M-5 -6 V0" />
          <path d="M3 3 H9" />
        </g>
      );
    case 'Is':
      return (
        <g stroke={INK} strokeWidth="2.2" fill="var(--surface)">
          <path d="M-30 0 H-14 M14 0 H30" />
          <circle r="14" />
          <path d="M-8 0 H8 M3 -5 L8 0 L3 5" fill="none" />
        </g>
      );
  }
}

function Element({ el, vertical, x, y }: { el: El; vertical?: boolean; x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <g transform={vertical ? 'rotate(90)' : undefined}>{symbol(el.kind)}</g>
      <text x={vertical ? 22 : 0} y={vertical ? -2 : -16} textAnchor={vertical ? 'start' : 'middle'} fontSize="13" fontWeight="600" fill={INK}>
        {el.label}
      </text>
      {el.sub && (
        <text x={vertical ? 22 : 0} y={vertical ? 12 : 26} textAnchor={vertical ? 'start' : 'middle'} fontSize="10.5" fill={LAB}>
          {el.sub}
        </text>
      )}
    </g>
  );
}

export function CircuitBoard({
  source,
  sections,
  title,
  caption,
  ground = true,
  close = false,
}: {
  source?: El;
  sections: Section[];
  title?: string;
  caption?: ReactNode;
  ground?: boolean;
  /** draw a vertical wire from the end of the top rail down to ground (series loop) */
  close?: boolean;
}) {
  const SEC = 120;
  const top = 50;
  // height = tallest shunt stack
  const maxStack = Math.max(1, ...sections.map((s) => (s.type === 'shunt' ? s.stack.length : s.type === 'xfmr' ? 2 : s.type === 'bridge' ? s.els.length : 1)));
  const H = Math.max(110, maxStack * 56 + 30);
  const bottom = top + H;
  const x0 = source ? 90 : 30;
  const W = x0 + sections.length * SEC + 40;
  const nodes: ReactNode[] = [];
  let x = x0;
  const parts: ReactNode[] = [];
  sections.forEach((s, i) => {
    const cx = x + SEC / 2;
    if (s.type === 'series') {
      parts.push(<line key={`a${i}`} x1={x} y1={top} x2={cx - 30} y2={top} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(<line key={`b${i}`} x1={cx + 30} y1={top} x2={x + SEC} y2={top} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(<Element key={`e${i}`} el={s.el} x={cx} y={top} />);
    } else if (s.type === 'bridge') {
      const n = s.els.length;
      parts.push(<line key={`bl${i}`} x1={x} y1={top} x2={x + 16} y2={top} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(<line key={`br${i}`} x1={x + SEC - 16} y1={top} x2={x + SEC} y2={top} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(<line key={`bv1${i}`} x1={x + 16} y1={top} x2={x + 16} y2={top + (n - 1) * 56} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(<line key={`bv2${i}`} x1={x + SEC - 16} y1={top} x2={x + SEC - 16} y2={top + (n - 1) * 56} stroke={COPPER} strokeWidth="2.4" />);
      s.els.forEach((el, k) => {
        const yy = top + k * 56;
        parts.push(<line key={`bw1${i}-${k}`} x1={x + 16} y1={yy} x2={cx - 30} y2={yy} stroke={COPPER} strokeWidth="2.4" />);
        parts.push(<line key={`bw2${i}-${k}`} x1={cx + 30} y1={yy} x2={x + SEC - 16} y2={yy} stroke={COPPER} strokeWidth="2.4" />);
        parts.push(<Element key={`be${i}-${k}`} el={el} x={cx} y={yy} />);
      });
      if (s.node) nodes.push(<text key={`n${i}`} x={x} y={top - 12} fontSize="11" fill={LAB} textAnchor="middle">{s.node}</text>);
    } else if (s.type === 'wire') {
      parts.push(<line key={`w${i}`} x1={x} y1={top} x2={x + SEC} y2={top} stroke={COPPER} strokeWidth="2.4" />);
      if (s.node) nodes.push(<text key={`n${i}`} x={x} y={top - 12} fontSize="11" fill={LAB} textAnchor="middle">{s.node}</text>);
    } else if (s.type === 'shunt') {
      parts.push(<line key={`r${i}`} x1={x} y1={top} x2={x + SEC} y2={top} stroke={COPPER} strokeWidth="2.4" />);
      // vertical branch at the section start+SEC/2
      const n = s.stack.length;
      const span = bottom - top;
      parts.push(<line key={`v${i}`} x1={cx} y1={top} x2={cx} y2={bottom} stroke={COPPER} strokeWidth="2.4" />);
      s.stack.forEach((el, k) => {
        const yy = top + (span * (k + 0.5)) / n;
        parts.push(<rect key={`m${i}-${k}`} x={cx - 4} y={yy - 32} width="8" height="64" fill="var(--surface)" />);
        parts.push(<Element key={`s${i}-${k}`} el={el} vertical x={cx} y={yy} />);
      });
      parts.push(<circle key={`d${i}`} cx={cx} cy={top} r="3.6" fill={COPPER} />);
      if (s.node) nodes.push(<text key={`n${i}`} x={cx} y={top - 12} fontSize="11" fill={LAB} textAnchor="middle">{s.node}</text>);
    } else {
      // transformer / gyrator between rail and ground
      parts.push(<line key={`r${i}`} x1={x} y1={top} x2={x + 22} y2={top} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(<line key={`r2${i}`} x1={x + SEC - 22} y1={top} x2={x + SEC} y2={top} stroke={COPPER} strokeWidth="2.4" />);
      const mid = (top + bottom) / 2;
      const coil = (cxx: number) => (
        <path key={`c${cxx}`} d={`M${cxx} ${top + 12} a8 6 0 0 1 0 12 a8 6 0 0 1 0 12 a8 6 0 0 1 0 12 a8 6 0 0 1 0 12`} fill="none" stroke={INK} strokeWidth="2.2" transform={`translate(0,${mid - top - 36})`} />
      );
      parts.push(<line key={`l${i}`} x1={x + 22} y1={top} x2={x + 22} y2={mid - 24} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(<line key={`l2${i}`} x1={x + SEC - 22} y1={top} x2={x + SEC - 22} y2={mid - 24} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(<line key={`b1${i}`} x1={x + 22} y1={mid + 24} x2={x + 22} y2={bottom} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(<line key={`b2${i}`} x1={x + SEC - 22} y1={mid + 24} x2={x + SEC - 22} y2={bottom} stroke={COPPER} strokeWidth="2.4" />);
      parts.push(coil(x + 22));
      parts.push(coil(x + SEC - 22));
      if (s.gyrator) {
        parts.push(<path key={`g${i}`} d={`M${cx - 12} ${mid - 8} q12 -12 24 0 M${cx + 12} ${mid + 8} q-12 12 -24 0`} fill="none" stroke={INK} strokeWidth="2" markerEnd="url(#arr)" />);
      } else {
        parts.push(<line key={`k1${i}`} x1={cx - 4} y1={mid - 22} x2={cx - 4} y2={mid + 22} stroke={INK} strokeWidth="2" />);
        parts.push(<line key={`k2${i}`} x1={cx + 4} y1={mid - 22} x2={cx + 4} y2={mid + 22} stroke={INK} strokeWidth="2" />);
      }
      parts.push(<text key={`t${i}`} x={cx} y={top - 14} textAnchor="middle" fontSize="13" fontWeight="700" fill={INK}>{s.gyrator ? `gyrator ${s.ratio}` : `transformer ${s.ratio}`}</text>);
    }
    x += SEC;
  });
  if (close) {
    const xe = x0 + sections.length * SEC;
    parts.push(<line key="closev" x1={xe} y1={top} x2={xe} y2={bottom} stroke={COPPER} strokeWidth="2.4" />);
  }
  // top rail from source
  return (
    <figure style={{ margin: '1rem 0' }}>
      <svg viewBox={`0 0 ${W} ${bottom + 50}`} style={{ width: '100%', height: 'auto', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill={INK} />
          </marker>
          <pattern id="pcb" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="0.7" fill="var(--border)" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={W} height={bottom + 50} fill="url(#pcb)" />
        {title && (
          <text x="14" y="20" fontSize="13" fontWeight="700" fill={INK}>
            {title}
          </text>
        )}
        {/* ground rail */}
        {ground && <line x1={x0 - (source ? 60 : 0)} y1={bottom} x2={W - 30} y2={bottom} stroke={COPPER} strokeWidth="2.4" />}
        {ground && (
          <g stroke={INK} strokeWidth="2">
            <path d={`M${W - 50} ${bottom} v10 M${W - 62} ${bottom + 10} h24 M${W - 57} ${bottom + 15} h14 M${W - 53} ${bottom + 20} h6`} fill="none" />
          </g>
        )}
        {source && (
          <>
            <line x1={30} y1={top} x2={x0} y2={top} stroke={COPPER} strokeWidth="2.4" />
            <line x1={30} y1={top} x2={30} y2={top + (bottom - top) / 2 - 30} stroke={COPPER} strokeWidth="2.4" />
            <line x1={30} y1={bottom} x2={30} y2={top + (bottom - top) / 2 + 30} stroke={COPPER} strokeWidth="2.4" />
            <Element el={source} vertical x={30} y={top + (bottom - top) / 2} />
          </>
        )}
        {parts}
        {nodes}
      </svg>
      {caption && <figcaption style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 4 }}>{caption}</figcaption>}
    </figure>
  );
}
