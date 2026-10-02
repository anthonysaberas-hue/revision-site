import { useMemo, useState } from 'react';
import { Plot } from '../../../core/Plot';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import { nozzlePipeProfile, PIPE_REGIME_LABEL, solveNozzlePipe } from '../lib/nozzlePipe';
import { fmt } from './common';
import { FlowSection3D, interpField } from '../viz/FlowSection3D';

/**
 * C-D nozzle + Fanno pipe (the Quiz 2 classic). Defaults = Quiz 2 W2024 P1.
 */
/** Same nozzle contour as lib/nozzlePipe.ts nozzlePipeProfile (throat at x = 0.35). */
function pipeArea(x: number, AR: number) {
  const xt = 0.35;
  if (x <= xt) return 1 + 1.5 * 0.5 * (1 + Math.cos((Math.PI * x) / xt));
  return 1 + (AR - 1) * 0.5 * (1 - Math.cos((Math.PI * (x - xt)) / (1 - xt)));
}

export function NozzlePipeSim({ AR: AR0 = 4, fL: fL0 = 0.75, pb: pb0 = 0.2, p0 = 0 }: { AR?: number; fL?: number; pb?: number; p0?: number }) {
  const [AR, setAR] = useState(AR0);
  const [fL, setFL] = useState(fL0);
  const [pb, setPb] = useState(pb0);
  const sol = useMemo(() => solveNozzlePipe(AR, fL, pb), [AR, fL, pb]);
  const prof = useMemo(() => nozzlePipeProfile(AR, fL, sol), [AR, fL, sol]);
  const th = sol.thresholds;
  const unit = (v?: number) => (v === undefined ? '—' : p0 ? `${fmt(v * p0)} (${fmt(v, 3)} p₀)` : fmt(v));
  const hl = [
    { y: pb, color: 'var(--c2)', label: 'p_b' },
    ...(th.pbShockAtPipeEntrance ? [{ y: th.pbShockAtPipeEntrance, label: 'shock at pipe inlet', color: 'var(--c4)' }] : []),
    ...(th.pbShockAtExit ? [{ y: th.pbShockAtExit, label: 'shock at pipe exit', color: 'var(--c3)' }] : []),
  ];
  return (
    <SimFrame title="Nozzle + friction pipe" subtitle="the most-examined problem in MECH 430">
      <div className="controls">
        <Slider label="Back pressure p_b / p₀" value={pb} min={0.01} max={1} step={0.001} onChange={setPb} format={(v) => v.toFixed(3)} />
        <Slider label="Pipe / throat area ratio" value={AR} min={1.2} max={6} step={0.01} onChange={setAR} format={(v) => v.toFixed(2)} />
        <Slider label="Pipe friction length 4fL/D" value={fL} min={0.01} max={2} step={0.005} onChange={setFL} format={(v) => v.toFixed(3)} />
      </div>
      <div className="regime">{PIPE_REGIME_LABEL[sol.regime]}</div>
      <FlowSection3D
        wall="engine"
        x0={0}
        x1={2}
        pipeStart={1}
        profile={(x) => 0.12 * Math.sqrt(x <= 1 ? pipeArea(x, AR) : AR)}
        field={interpField(prof.pts)}
        shocks={prof.xShock !== undefined ? [prof.xShock] : []}
        frictionZone={[1, 2]}
        plume={{ kind: sol.regime === 'supersonic-exit' ? 'over' : sol.exitChoked ? 'under' : 'subsonic' }}
        labels={[
          { x: prof.xt, text: sol.regime === 'subsonic' || sol.regime === 'friction-choked' ? 'throat (M < 1)' : 'throat · M = 1' },
          { x: 1, text: `pipe inlet · M = ${fmt(sol.M1, 3)}`, side: 'bottom' },
          ...(prof.xShock !== undefined ? [{ x: prof.xShock, text: `shock · Mₓ = ${fmt(sol.Mx, 3)}` }] : []),
          { x: 2, text: `exit · M = ${fmt(sol.M2, 3)}${sol.exitChoked ? ' (choked)' : ''}`, side: 'bottom' },
        ]}
        height={300}
      />
      <div className="twocol">
        <Plot
          x={[0, 2]}
          y={[0, 1.02]}
          height={250}
          xLabel="nozzle (0–1)  |  pipe (1–2)"
          yLabel="p / p₀"
          series={[{ points: prof.pts.map((p) => ({ x: p.x, y: p.p })), width: 3, label: 'p(x)' }]}
          vlines={[{ x: prof.xt, label: 'throat' }, { x: 1, label: 'pipe inlet', color: 'var(--text)' }, ...(prof.xShock ? [{ x: prof.xShock, color: 'var(--c2)', label: 'shock' }] : [])]}
          hlines={hl}
        />
        <Plot
          x={[0, 2]}
          y={[0, 4]}
          height={250}
          xLabel="nozzle (0–1)  |  pipe (1–2)"
          yLabel="Mach number"
          series={[{ points: prof.pts.map((p) => ({ x: p.x, y: p.M })), color: 'var(--c2)', width: 3, label: 'M(x)' }]}
          hlines={[{ y: 1, label: 'M = 1' }]}
          vlines={[{ x: 1, color: 'var(--text)' }, ...(prof.xShock ? [{ x: prof.xShock, color: 'var(--c2)' }] : [])]}
        />
      </div>
      <Readout
        items={[
          ['M entering pipe', fmt(sol.M1)],
          ['M at pipe exit', fmt(sol.M2)],
          ['p_exit / p₀', unit(sol.pe)],
          ['exit choked?', sol.exitChoked ? 'yes (p_e ≠ p_b allowed)' : 'no (p_e = p_b)'],
          ['shock', sol.shockWhere ? (sol.shockWhere === 'nozzle' ? `nozzle, A/A_t = ${fmt(sol.shockLoc)}` : `pipe, x/L = ${fmt(sol.shockLoc, 3)}`) : 'none inside'],
          ['M_x → M_y', sol.Mx ? `${fmt(sol.Mx, 3)} → ${fmt(sol.My, 3)}` : '—'],
          ['p_b to first choke', unit(th.pbChoke)],
          ['p_b shock @ pipe inlet', unit(th.pbShockAtPipeEntrance)],
          ['p_b shock @ pipe exit', unit(th.pbShockAtExit)],
          ['supersonic pipe possible?', th.supersonicPossible ? 'yes (L ≤ L*)' : 'no (L > L*)'],
          ['ṁ / ṁ_choked', fmt(sol.mdotRatio)],
        ]}
      />
    </SimFrame>
  );
}
