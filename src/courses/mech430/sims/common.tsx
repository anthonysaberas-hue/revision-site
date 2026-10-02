/** Shared drawing helpers for simulations. */

/** Mach number → colour. Subsonic: blue shades; sonic: white-ish; supersonic: orange → red. */
export function machColor(M: number): string {
  if (!isFinite(M)) return '#888';
  if (M < 1) {
    const t = Math.max(0, Math.min(1, M));
    // deep blue (0) → light blue (1)
    const h = 215;
    const l = 38 + 40 * t;
    return `hsl(${h} 70% ${l}%)`;
  }
  const t = Math.max(0, Math.min(1, (M - 1) / 3));
  const h = 40 - 40 * t;
  const l = 62 - 18 * t;
  return `hsl(${h} 85% ${l}%)`;
}

export function MachLegend() {
  const stops = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)', margin: '0.3rem 0' }}>
      <span>M =</span>
      <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {stops.map((m) => (
          <div key={m} style={{ width: 26, height: 12, background: machColor(m) }} title={`M = ${m}`} />
        ))}
      </div>
      <span>0 → 1 → 4</span>
    </div>
  );
}

export const fmt = (v: number | undefined, n = 4) => {
  if (v === undefined || !isFinite(v)) return '—';
  return String(Number(v.toPrecision(n)));
};
