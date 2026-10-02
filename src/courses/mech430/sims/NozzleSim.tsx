import { useMemo, useState } from 'react';
import { Plot } from '../../../core/Plot';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import { criticalPressures, nozzleArea, nozzleProfile, REGIME_LABEL, solveNozzle } from '../lib/nozzle';
import { M_from_A_Astar, p_p0 } from '../lib/isentropic';
import { fmt, machColor } from './common';
import { FlowSection3D, interpField } from '../viz/FlowSection3D';

/**
 * C-D nozzle back-pressure explorer (notes Ch. 6 & 8).
 */
export function NozzleSim({ initialAR = 3, initialPb = 0.7 }: { initialAR?: number; initialPb?: number }) {
  const [AR, setAR] = useState(initialAR);
  const [pb, setPb] = useState(initialPb);
  const sol = useMemo(() => solveNozzle(AR, pb), [AR, pb]);
  const prof = useMemo(() => nozzleProfile(AR, sol), [AR, sol]);
  const crit = sol.crit;

  // reference curves: choked-subsonic and fully supersonic
  const ref = useMemo(() => {
    const sub: { x: number; y: number }[] = [];
    const sup: { x: number; y: number }[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      const A = nozzleArea(x, AR);
      const Ms = M_from_A_Astar(Math.max(1, A), 'sub');
      sub.push({ x, y: p_p0(Ms) });
      sup.push({ x, y: x <= prof.xt ? p_p0(Ms) : p_p0(M_from_A_Astar(Math.max(1, A), 'sup')) });
    }
    return { sub, sup };
  }, [AR, prof.xt]);

  const presets: [string, number][] = [
    ['subsonic', (1 + crit.p3) / 2],
    ['choked', crit.p3],
    ['shock inside', (crit.p3 + crit.p4) / 2],
    ['shock at exit', crit.p4],
    ['over-expanded', (crit.p4 + crit.pd) / 2],
    ['design', crit.pd],
    ['under-expanded', crit.pd * 0.4],
  ];

  return (
    <SimFrame title="Converging–diverging nozzle" subtitle="drag the back pressure and watch the shock move">
      <div className="controls">
        <Slider label="Back pressure p_b / p₀" value={pb} min={0.005} max={1} step={0.001} onChange={setPb} format={(v) => v.toFixed(3)} />
        <Slider label="Exit / throat area A_e / A_t" value={AR} min={1.1} max={5} step={0.01} onChange={setAR} format={(v) => v.toFixed(2)} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {presets.map(([k, v]) => (
          <button key={k} className="btn" onClick={() => setPb(Math.max(0.005, Math.min(1, v)))}>
            {k}
          </button>
        ))}
      </div>
      <div className="regime">{REGIME_LABEL[sol.regime]}</div>
      <FlowSection3D
        wall="engine"
        x0={0}
        x1={1}
        profile={(x) => 0.12 * Math.sqrt(nozzleArea(x, AR))}
        field={interpField(prof.pts)}
        shocks={prof.xs !== undefined ? [prof.xs] : []}
        plume={{ kind: sol.regime === 'overexpanded' ? 'over' : sol.regime === 'underexpanded' ? 'under' : sol.regime === 'design' ? 'ideal' : sol.regime === 'no-flow' ? 'none' : 'subsonic' }}
        labels={[{ x: prof.xt, text: sol.regime === 'subsonic' ? 'throat (M < 1)' : 'throat · M = 1' }, ...(prof.xs !== undefined ? [{ x: prof.xs, text: `shock · Mₓ = ${fmt(sol.Mx, 3)}`, side: 'bottom' as const }] : []), { x: 1, text: `exit · M = ${fmt(sol.Me, 3)}` }]}
        flowSpeed={sol.regime === 'no-flow' ? 0 : 1}
        height={300}
      />
      <div className="twocol">
        <Plot
          x={[0, 1]}
          y={[0, 1.02]}
          height={260}
          xLabel="position along nozzle"
          yLabel="p / p₀"
          series={[
            { points: ref.sub, color: 'var(--muted)', dash: true, width: 1.2, label: 'choked, subsonic exit (p₃)' },
            { points: ref.sup, color: 'var(--muted)', dash: true, width: 1.2, label: 'design, supersonic' },
            { points: prof.pts.map((p) => ({ x: p.x, y: p.p })), color: 'var(--c1)', width: 3, label: 'actual' },
          ]}
          vlines={[{ x: prof.xt, label: 'throat' }, ...(prof.xs ? [{ x: prof.xs, color: 'var(--c2)', label: 'shock' }] : [])]}
          hlines={[{ y: pb, color: 'var(--c2)', label: 'p_b' }, { y: 0.5283, label: 'p* = 0.528 p₀' }]}
        />
        <Plot
          x={[0, 1]}
          y={[0, Math.max(1.2, crit.Msup * 1.1)]}
          height={260}
          xLabel="position along nozzle"
          yLabel="Mach number"
          series={[{ points: prof.pts.map((p) => ({ x: p.x, y: p.M })), color: 'var(--c2)', width: 3, label: 'M(x)' }]}
          hlines={[{ y: 1, label: 'M = 1' }]}
          vlines={[{ x: prof.xt, label: 'throat' }, ...(prof.xs ? [{ x: prof.xs, color: 'var(--c2)', label: 'shock' }] : [])]}
        />
      </div>
      <Readout
        items={[
          ['p₃ (choke, sub exit)', fmt(crit.p3)],
          ['p₄ (shock at exit)', fmt(crit.p4)],
          ['p_d (design)', fmt(crit.pd)],
          ['Exit Mach M_e', fmt(sol.Me)],
          ['Exit pressure p_e/p₀', fmt(sol.pe)],
          ['Shock area A_s/A_t', sol.As ? fmt(sol.As) : '—'],
          ['Shock Mach M_x', sol.Mx ? fmt(sol.Mx) : '—'],
          ['p₀ loss p₀e/p₀', fmt(sol.p0e)],
          ['ṁ / ṁ_choked', fmt(sol.mdotRatio)],
        ]}
      />
    </SimFrame>
  );
}

/** Side view of the nozzle with Mach-coloured flow, shock and plume. */
export function NozzleDrawing({
  AR,
  pts,
  xs,
  regime,
  pipe,
}: {
  AR: number;
  pts: { x: number; A: number; M: number }[];
  xs?: number;
  regime: string;
  /** If set, the drawing extends to x = 2 as a constant-area pipe */
  pipe?: boolean;
}) {
  const W = 760;
  const H = 190;
  const xMax = pipe ? 2 : 1;
  const nozzleW = pipe ? 380 : 560;
  const plumeW = pipe ? 0 : 150;
  const sx = (x: number) => 20 + (x <= 1 ? x * nozzleW : nozzleW + (x - 1) * (W - 60 - nozzleW));
  const maxA = Math.max(2.5, AR);
  const hScale = (H / 2 - 12) / maxA;
  const cy = H / 2;
  const top = (A: number) => cy - A * hScale;
  const bot = (A: number) => cy + A * hScale;
  const strips = pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1];
    return (
      <polygon
        key={i}
        points={`${sx(p.x)},${top(p.A)} ${sx(q.x) + 0.6},${top(q.A)} ${sx(q.x) + 0.6},${bot(q.A)} ${sx(p.x)},${bot(p.A)}`}
        fill={machColor(p.M)}
      />
    );
  });
  const wallTop = pts.map((p) => `${sx(p.x)},${top(p.A)}`).join(' ');
  const wallBot = pts.map((p) => `${sx(p.x)},${bot(p.A)}`).join(' ');
  const ex = sx(pipe ? 2 : 1);
  const eA = AR;
  const plume = [];
  if (!pipe && plumeW) {
    if (regime === 'overexpanded') {
      // oblique shocks from lips toward the axis
      plume.push(
        <path key="os" d={`M${ex},${top(eA)} L${ex + plumeW * 0.8},${cy} L${ex},${bot(eA)}`} stroke="var(--c2)" strokeWidth={2.2} fill="none" />,
        <text key="ost" x={ex + 8} y={top(eA) - 4} style={{ fontSize: 11, fill: 'var(--c2)' }}>
          oblique shocks
        </text>,
      );
    } else if (regime === 'underexpanded') {
      for (let k = 0; k < 5; k++) {
        const a = (k / 4) * 0.7;
        plume.push(
          <line key={`t${k}`} x1={ex} y1={top(eA)} x2={ex + plumeW * Math.cos(a) * 0.9} y2={top(eA) + plumeW * Math.sin(a) * 0.9} stroke="var(--c1)" strokeWidth={1.2} />,
          <line key={`b${k}`} x1={ex} y1={bot(eA)} x2={ex + plumeW * Math.cos(a) * 0.9} y2={bot(eA) - plumeW * Math.sin(a) * 0.9} stroke="var(--c1)" strokeWidth={1.2} />,
        );
      }
      plume.push(
        <text key="pmt" x={ex + 8} y={top(eA) - 4} style={{ fontSize: 11, fill: 'var(--c1)' }}>
          Prandtl–Meyer fans
        </text>,
      );
    } else if (regime === 'design') {
      plume.push(
        <path key="jet" d={`M${ex},${top(eA)} L${ex + plumeW},${top(eA)} M${ex},${bot(eA)} L${ex + plumeW},${bot(eA)}`} stroke="var(--c3)" strokeDasharray="5 4" strokeWidth={1.6} />,
        <text key="jt" x={ex + 8} y={top(eA) - 4} style={{ fontSize: 11, fill: 'var(--c3)' }}>
          straight jet, p_e = p_b
        </text>,
      );
    } else if (regime !== 'no-flow') {
      plume.push(
        <text key="sj" x={ex + 8} y={top(eA) - 4} style={{ fontSize: 11, fill: 'var(--muted)' }}>
          subsonic jet, p_e = p_b
        </text>,
      );
    }
  }
  const shockX = xs !== undefined ? sx(xs) : undefined;
  const shockA = xs !== undefined ? pts.reduce((best, p) => (Math.abs(p.x - xs) < Math.abs(best.x - xs) ? p : best), pts[0]).A : 0;
  void xMax;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {strips}
      <polyline points={wallTop} fill="none" stroke="var(--text)" strokeWidth={3} />
      <polyline points={wallBot} fill="none" stroke="var(--text)" strokeWidth={3} />
      {shockX !== undefined && (
        <g>
          <line x1={shockX} x2={shockX} y1={top(shockA) + 2} y2={bot(shockA) - 2} stroke="var(--text)" strokeWidth={3.5} />
          <text x={shockX + 5} y={top(shockA) - 5} style={{ fontSize: 11, fill: 'var(--text)', fontWeight: 700 }}>
            normal shock
          </text>
        </g>
      )}
      {plume}
      <line x1={sx(0.35)} x2={sx(0.35)} y1={cy - 6} y2={cy + 6} stroke="var(--text)" opacity={0.4} />
    </svg>
  );
}
