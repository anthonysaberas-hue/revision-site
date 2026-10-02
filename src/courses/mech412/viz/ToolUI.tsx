import { ReactNode, useState } from 'react';
import { Plot } from '../../../core/Plot';
import { parsePoly } from '../lib/parse';
import { Poly } from '../lib/poly';
import { TF } from '../lib/lti';

/** Text field that parses a polynomial in s and shows the error if any */
export function PolyField({ label, value, onChange, hint }: { label: ReactNode; value: string; onChange: (s: string) => void; hint?: string }) {
  let err = '';
  try {
    parsePoly(value);
  } catch (e) {
    err = (e as Error).message;
  }
  return (
    <label style={{ display: 'block', margin: '6px 0' }}>
      <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${err ? 'var(--c3, #d33)' : 'var(--border)'}`, background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'ui-monospace, monospace' }}
      />
      <span style={{ fontSize: '.75rem', color: err ? 'var(--c3, #d33)' : 'var(--muted)' }}>{err || hint || ' '}</span>
    </label>
  );
}

export function safePoly(s: string, fallback: Poly = [1]): Poly {
  try {
    return parsePoly(s);
  } catch {
    return fallback;
  }
}

/** G(s) = num/den typed by the user, with parse state */
export function useTF(numStr: string, denStr: string): { tf: TF; ok: boolean } {
  try {
    const num = parsePoly(numStr);
    const den = parsePoly(denStr);
    return { tf: { num, den }, ok: den.length > 0 && den.some((c) => c !== 0) };
  } catch {
    return { tf: { num: [1], den: [1, 1] }, ok: false };
  }
}

export function ToolShell({ children }: { children: ReactNode }) {
  return <div style={{ margin: '1rem 0' }}>{children}</div>;
}

export function Grid2({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="labgrid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)', gap: 14, alignItems: 'start' }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

export function Chips({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontSize: '.85rem' }}>
          <span style={{ color: 'var(--muted)' }}>{k}: </span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

export function Presets({ items, onPick }: { items: { name: string; set: () => void }[]; onPick?: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 8px' }}>
      {items.map((p) => (
        <button
          key={p.name}
          className="btn"
          onClick={() => {
            p.set();
            onPick?.();
          }}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

/** Semi-log chart (x = frequency, log scale) */
export function LogPlot({
  series,
  y,
  yLabel,
  height = 220,
  hlines,
  vlines,
  dots,
}: {
  series: { w: number[]; v: number[]; color?: string; dash?: boolean; label?: string }[];
  y: [number, number];
  yLabel: string;
  height?: number;
  hlines?: { y: number; label?: string }[];
  vlines?: { w: number; label?: string }[];
  dots?: { w: number; v: number; label?: string }[];
}) {
  const allW = series.flatMap((s) => s.w);
  const lo = Math.floor(Math.log10(Math.min(...allW)) + 1e-9);
  const hi = Math.ceil(Math.log10(Math.max(...allW)) - 1e-9);
  const ticks: number[] = [];
  for (let k = lo; k <= hi; k++) ticks.push(k);
  return (
    <Plot
      x={[lo, hi]}
      y={y}
      height={height}
      yLabel={yLabel}
      xLabel="log₁₀ ω  (rad/s)"
      xTicks={ticks}
      series={series.map((s, i) => ({ points: s.w.map((w, k) => ({ x: Math.log10(w), y: s.v[k] })), color: s.color ?? `var(--c${(i % 5) + 1})`, dash: s.dash, label: s.label }))}
      hlines={(hlines ?? []).map((h) => ({ y: h.y, dash: true, color: 'var(--muted)', label: h.label }))}
      vlines={(vlines ?? []).map((v) => ({ x: Math.log10(v.w), dash: true, color: 'var(--muted)', label: v.label }))}
      dots={(dots ?? []).map((d) => ({ x: Math.log10(d.w), y: d.v, label: d.label, color: 'var(--c3)' }))}
      legend={series.some((s) => s.label)}
    />
  );
}

export function useToggle(initial = false): [boolean, () => void] {
  const [v, set] = useState(initial);
  return [v, () => set((x) => !x)];
}

export const clampRange = (lo: number, hi: number, pad = 0.08): [number, number] => {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [-1, 1];
  const p = (hi - lo) * pad || 1;
  return [lo - p, hi + p];
};
