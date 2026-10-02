import { ReactNode } from 'react';
import { Slider } from '../../../core/ui';

/** Numeric text input with a label and unit (calculators). Empty / invalid input keeps the previous value. */
export function Num({
  label,
  value,
  onChange,
  unit,
  step,
  min,
  max,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label style={{ display: 'block', margin: '6px 0' }}>
      <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
        {label}
        {unit ? ` (${unit})` : ''}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        step={step ?? 'any'}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        style={{
          width: '100%',
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          fontFamily: 'ui-monospace, monospace',
        }}
      />
    </label>
  );
}

export function Sel<T extends string>({ label, value, options, onChange }: { label?: ReactNode; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void }) {
  return (
    <label style={{ display: 'block', margin: '6px 0' }}>
      {label && <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.t}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Two({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="labgrid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) minmax(0,1.6fr)', gap: 14, alignItems: 'start', margin: '1rem 0' }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

export function Chips({ items }: { items: [string, string, ('ok' | 'warn' | 'bad')?][] }) {
  const col = { ok: 'var(--ok, #2e9d62)', warn: 'var(--warn, #d9a21b)', bad: 'var(--c3, #d33)' };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
      {items.map(([k, v, s]) => (
        <div key={k} style={{ background: 'var(--surface-2)', border: `1px solid ${s ? col[s] : 'var(--border)'}`, borderRadius: 8, padding: '4px 10px', fontSize: '.85rem' }}>
          <span style={{ color: 'var(--muted)' }}>{k}: </span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: '.85rem', color: 'var(--muted)', margin: '6px 0' }}>{children}</p>;
}

export { Slider };

/** Compact number formatting for readouts */
export function f(v: number, d = 4): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(d - 1);
  return String(Number(v.toPrecision(d)));
}

export const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
