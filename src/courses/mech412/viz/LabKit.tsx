import { ReactNode, useEffect, useRef, useState } from 'react';
import { Plot } from '../../../core/Plot';

/** Rolling multi-channel time series recorded by a lab's update loop */
export class Trace {
  t: number[] = [];
  ch: number[][];
  constructor(public names: string[], public keep = 40) {
    this.ch = names.map(() => []);
  }
  push(t: number, vals: number[]) {
    this.t.push(t);
    vals.forEach((v, i) => this.ch[i].push(v));
    while (this.t.length && t - this.t[0] > this.keep) {
      this.t.shift();
      this.ch.forEach((c) => c.shift());
    }
  }
  clear() {
    this.t = [];
    this.ch = this.names.map(() => []);
  }
}

/** Re-render the component about `hz` times per second */
export function useTick(hz = 8) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
}

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

export function LiveChart({
  trace,
  window: win = 10,
  height = 220,
  yLabel,
  show,
  yRange,
  refs,
}: {
  trace: Trace;
  window?: number;
  height?: number;
  yLabel?: string;
  /** indices of channels to draw (default all) */
  show?: number[];
  yRange?: [number, number];
  /** horizontal reference lines */
  refs?: { y: number; label?: string }[];
}) {
  const n = trace.t.length;
  const t1 = n ? trace.t[n - 1] : win;
  const t0 = Math.max(0, t1 - win);
  const idx = show ?? trace.names.map((_, i) => i);
  let lo = Infinity;
  let hi = -Infinity;
  const series = idx.map((ci, k) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (trace.t[i] < t0) continue;
      const v = trace.ch[ci][i];
      if (Number.isFinite(v)) {
        pts.push({ x: trace.t[i], y: v });
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    return { points: pts, color: COLORS[k % COLORS.length], label: trace.names[ci] };
  });
  if (!Number.isFinite(lo)) {
    lo = -1;
    hi = 1;
  }
  (refs ?? []).forEach((r) => {
    lo = Math.min(lo, r.y);
    hi = Math.max(hi, r.y);
  });
  const pad = (hi - lo) * 0.12 || 0.5;
  const yr: [number, number] = yRange ?? [lo - pad, hi + pad];
  return (
    <Plot
      x={[t0, Math.max(t0 + win, t1)]}
      y={yr}
      series={series}
      height={height}
      xLabel="time (s)"
      yLabel={yLabel}
      hlines={(refs ?? []).map((r) => ({ y: r.y, dash: true, color: 'var(--muted)', label: r.label }))}
      legend
    />
  );
}

export function Controls({ running, onToggle, onReset, children }: { running: boolean; onToggle: () => void; onReset: () => void; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
      <button className="btn" onClick={onToggle}>
        {running ? '⏸ Pause' : '▶ Run'}
      </button>
      <button className="btn" onClick={onReset}>
        ↺ Reset
      </button>
      {children}
    </div>
  );
}

/** Two-column layout used by every lab: 3D + chart left, sliders right (stacks on phones) */
export function LabGrid({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="labgrid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(220px,1fr)', gap: 14, alignItems: 'start' }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

/** Keep a mutable copy of props/state in a ref so the 3D loop always reads the newest values */
export function useLatest<T>(v: T) {
  const r = useRef(v);
  r.current = v;
  return r;
}
