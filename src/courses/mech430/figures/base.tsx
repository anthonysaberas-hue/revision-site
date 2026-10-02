/** Static explanatory diagrams (inline SVG) used in chapters and solutions. */
import { Figure } from '../../../core/ui';

const txt = { fontSize: 12, fill: 'var(--text)' } as const;
const mut = { fontSize: 11, fill: 'var(--muted)' } as const;

/** Control volume with inflow/outflow stations 1 → 2 */
export function CVFigure() {
  return (
    <Figure caption="Control volume: account for what crosses the dashed boundary, not what happens inside.">
      <svg viewBox="0 0 520 170" width="520">
        <path d="M40,60 C160,40 360,40 480,70 L480,120 C360,140 160,140 40,120 Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeDasharray="6 5" strokeWidth={2} />
        <line x1="0" y1="90" x2="36" y2="90" stroke="var(--text)" strokeWidth={2} markerEnd="url(#a1)" />
        <line x1="484" y1="95" x2="515" y2="95" stroke="var(--text)" strokeWidth={2} markerEnd="url(#a1)" />
        <defs>
          <marker id="a1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10z" fill="var(--text)" />
          </marker>
        </defs>
        <text x="4" y="80" style={txt}>1: p₁, ρ₁, V₁, A₁</text>
        <text x="400" y="60" style={txt}>2: p₂, ρ₂, V₂, A₂</text>
        <text x="200" y="95" style={mut}>Q̇ in, Ẇ, F_wall</text>
      </svg>
    </Figure>
  );
}

/** Sound-wave derivation frame change */
export function SoundWaveFigure() {
  return (
    <Figure caption="Ride with the wave: in the wave frame the gas enters at c and leaves at c − dV. Mass + momentum ⇒ c² = dp/dρ.">
      <svg viewBox="0 0 560 140" width="560">
        <rect x="10" y="30" width="250" height="80" fill="var(--surface-2)" stroke="var(--border)" />
        <rect x="300" y="30" width="250" height="80" fill="var(--surface-2)" stroke="var(--border)" />
        <line x1="135" y1="30" x2="135" y2="110" stroke="var(--c2)" strokeWidth={3} />
        <line x1="425" y1="30" x2="425" y2="110" stroke="var(--c2)" strokeWidth={3} />
        <text x="20" y="22" style={txt}>Lab frame</text>
        <text x="310" y="22" style={txt}>Wave frame</text>
        <text x="145" y="60" style={mut}>wave → c</text>
        <text x="20" y="60" style={mut}>p+dp, ρ+dρ</text>
        <text x="20" y="80" style={mut}>moving dV</text>
        <text x="160" y="85" style={mut}>p, ρ, at rest</text>
        <text x="435" y="60" style={mut}>← c</text>
        <text x="435" y="80" style={mut}>p, ρ</text>
        <text x="310" y="60" style={mut}>← c − dV</text>
        <text x="310" y="80" style={mut}>p+dp, ρ+dρ</text>
      </svg>
    </Figure>
  );
}

/** Mach cone / zone of silence */
export function MachConeFigure({ M = 2 }: { M?: number }) {
  const mu = Math.asin(1 / M);
  const L = 260;
  const circles = [0, 1, 2, 3, 4].map((k) => {
    const t = 4 - k; // time since emission
    const x = 300 - M * 40 * t;
    const r = 40 * t;
    return <circle key={k} cx={x} cy={90} r={r} fill="none" stroke="var(--c1)" opacity={0.6} />;
  });
  return (
    <Figure caption={`Supersonic source at M = ${M}: the pulses pile up on a cone of half-angle μ = asin(1/M) = ${((mu * 180) / Math.PI).toFixed(1)}°. Outside it: the zone of silence.`}>
      <svg viewBox="0 0 340 180" width="340">
        <clipPath id="mc">
          <rect x="0" y="0" width="340" height="180" />
        </clipPath>
        <g clipPath="url(#mc)">
          {circles}
          <line x1="300" y1="90" x2={300 - L * Math.cos(mu)} y2={90 - L * Math.sin(mu)} stroke="var(--c2)" strokeWidth={2} />
          <line x1="300" y1="90" x2={300 - L * Math.cos(mu)} y2={90 + L * Math.sin(mu)} stroke="var(--c2)" strokeWidth={2} />
          <circle cx="300" cy="90" r="4" fill="var(--text)" />
        </g>
        <text x="250" y="20" style={txt}>zone of silence</text>
      </svg>
    </Figure>
  );
}

/** Shock-in-nozzle schematic with stations */
export function StationsFigure({ labels = ['0 reservoir', 't throat', 'x before shock', 'y after shock', 'e exit'] }: { labels?: string[] }) {
  return (
    <Figure caption="Name every station before touching a table. T₀ is constant everywhere (adiabatic); p₀ and A* change only across the shock.">
      <svg viewBox="0 0 560 150" width="560">
        <path d="M20,30 C120,30 150,65 200,65 C280,65 420,20 540,15 L540,135 C420,130 280,85 200,85 C150,85 120,120 20,120 Z" fill="var(--accent-soft)" stroke="var(--text)" strokeWidth={2} />
        <line x1="360" y1="38" x2="360" y2="112" stroke="var(--c2)" strokeWidth={4} />
        {[
          [40, labels[0]],
          [200, labels[1]],
          [330, labels[2]],
          [372, labels[3]],
          [520, labels[4]],
        ].map(([x, l], i) => (
          <g key={i}>
            <circle cx={x as number} cy={75} r={4} fill="var(--text)" />
            <text x={(x as number) - 10} y={i % 2 ? 148 : 12} style={mut}>
              {l}
            </text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}
