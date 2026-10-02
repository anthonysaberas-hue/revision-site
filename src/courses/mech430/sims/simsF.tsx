/* Group F simulations: Quiz 2 walkthroughs (W2019, W2023, F2023, W2024). All physics comes from ../lib. */
import { useMemo, useState } from 'react';
import { Plot, sample } from '../../../core/Plot';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import { A_Astar, M_from_A_Astar, M_from_p_p0, massFlux, p_p0, pstar_p0, T0_T, T_T0 } from '../lib/isentropic';
import { My as shockMy, Mx_from_p0y_p0x, p0y_p0x } from '../lib/normalShock';
import { fannoDuct, fLmax, M_from_fLmax, p_pstar as fanno_p_pstar } from '../lib/fanno';
import { M_from_T0_T0star, p_pstar as ray_p_pstar, rayleighHeat, T0_T0star, T_Tstar as ray_T_Tstar } from '../lib/rayleigh';
import { shockAt } from '../lib/nozzlePipe';
import { nozzleArea } from '../lib/nozzle';
import { startingMach, startingThroatRatio, throatOpeningFactor } from '../lib/inlet';
import { exitVelocity, infiniteNozzleVe } from '../lib/rocket';
import { bisect } from '../lib/solve';
import { FlowSection3D } from '../viz/FlowSection3D';
import { twoThroatSolution } from '../lib/twoThroat';
import { fmt } from './common';

function blend(x: number, x0: number, x1: number, h0: number, h1: number) {
  const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  return h0 + (h1 - h0) * 0.5 * (1 - Math.cos(Math.PI * t));
}
function knots(k: [number, number][]) {
  return (x: number) => {
    if (x <= k[0][0]) return k[0][1];
    for (let i = 0; i < k.length - 1; i++) if (x <= k[i + 1][0]) return blend(x, k[i][0], k[i + 1][0], k[i][1], k[i + 1][1]);
    return k[k.length - 1][1];
  };
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0.4rem 0' }}>
      {options.map(([v, l]) => (
        <button key={v} className={`btn ${v === value ? 'primary' : ''}`} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/* =====================================================================
 * Shock-position iteration plot (nozzle + Fanno pipe)
 * ===================================================================== */

export interface ShockGuess {
  /** shock position in axis units (4fL_s/D, or metres if lengthPerFL is given) */
  x: number;
  label?: string;
}

/**
 * The exam's trial-and-error for the shock in a Fanno pipe, drawn as a curve.
 * mode "pe": exit pressure vs shock position (lib/nozzlePipe.ts shockAt), with the target p_b and the
 *   choked-exit pressure p* as lines. Guesses are dots.
 * mode "fit": friction length available behind the shock vs the pipe that remains. Where they cross,
 *   the exit is exactly choked. tableRef adds the curve obtained with the table's supersonic reference value.
 */
export function ShockIterationPlot({
  AR,
  fL,
  p0 = 1,
  pb,
  unit = '',
  lengthPerFL,
  guesses = [],
  mode = 'pe',
  tableRef,
  interp = false,
  explore = true,
  xMax,
}: {
  AR: number;
  fL: number;
  p0?: number;
  pb?: number;
  unit?: string;
  lengthPerFL?: number;
  guesses?: ShockGuess[];
  mode?: 'pe' | 'fit';
  tableRef?: number;
  interp?: boolean;
  explore?: boolean;
  xMax?: number;
}) {
  const k = lengthPerFL ?? 1;
  const xName = lengthPerFL ? 'shock distance from pipe inlet x_s (m)' : 'shock position 4f·x_s/D';
  const M1 = M_from_A_Astar(AR, 'sup');
  const fL1 = fLmax(M1);
  const at = (u: number) => shockAt(1 + u / fL, AR, fL);
  const uLim = useMemo(() => {
    let lo = 0;
    let hi = Math.min(fL, fL1);
    if (at(hi).valid) return hi;
    for (let i = 0; i < 80; i++) {
      const m = 0.5 * (lo + hi);
      if (at(m).valid) lo = m;
      else hi = m;
    }
    return lo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [AR, fL]);
  const pStar = p0 * (pstar_p0() / AR);
  const X1 = xMax ?? Math.min(fL, fL1) * k;
  const pe = (xs: number) => {
    const u = xs / k;
    if (u > uLim + 1e-9) return NaN;
    const r = at(u);
    return r.valid ? r.pe * p0 : NaN;
  };
  const fitExact = (xs: number) => {
    const u = xs / k;
    if (u >= fL1) return NaN;
    return fLmax(shockMy(M_from_fLmax(fL1 - u, 'sup')));
  };
  const fitTable = (xs: number) => {
    if (tableRef === undefined) return NaN;
    const u = xs / k;
    if (u >= tableRef) return NaN;
    return fLmax(shockMy(M_from_fLmax(tableRef - u, 'sup')));
  };
  const remaining = (xs: number) => fL - xs / k;
  const [trial, setTrial] = useState(Math.min(X1, guesses[0]?.x ?? X1 / 2));

  let plot;
  if (mode === 'pe') {
    const pe0 = pe(0);
    const dots = guesses
      .map((g) => ({ x: g.x, y: pe(g.x), label: g.label, color: 'var(--c2)' }))
      .filter((d) => isFinite(d.y));
    let crossing: number | undefined;
    if (interp && dots.length >= 2 && pb !== undefined) {
      const [a, b] = dots;
      crossing = a.x + ((pb - a.y) * (b.x - a.x)) / (b.y - a.y);
    }
    plot = (
      <Plot
        x={[0, X1]}
        y={[Math.min(pb ?? pStar, pStar) * 0.85, pe0 * 1.1]}
        height={280}
        xLabel={xName}
        yLabel={`p_exit ${unit ? `(${unit})` : ''}`}
        series={[
          { points: sample(pe, 0, X1, 300), width: 3, label: 'exit pressure (exact, lib)', color: 'var(--c1)' },
          ...(interp && dots.length >= 2
            ? [{ points: [dots[0], dots[1]].map((d) => ({ x: d.x, y: d.y })), dash: true, color: 'var(--c4)', label: 'straight-line interpolation' }]
            : []),
        ]}
        hlines={[
          ...(pb !== undefined ? [{ y: pb, color: 'var(--c2)', label: `target p_b = ${fmt(pb)}` }] : []),
          { y: pStar, color: 'var(--c3)', label: `p* = ${fmt(pStar, 4)} (choked exit)` },
        ]}
        vlines={[
          { x: uLim * k, color: 'var(--c3)', label: 'exit chokes here' },
          ...(crossing !== undefined ? [{ x: crossing, color: 'var(--c4)', label: `interp. ${fmt(crossing, 2)}` }] : []),
        ]}
        dots={dots}
      />
    );
  } else {
    const yMax = Math.max(fL, fitExact(X1) || 0, fitTable(X1) || 0) * 1.1;
    const dots = guesses.map((g) => ({ x: g.x, y: tableRef !== undefined ? fitTable(g.x) : fitExact(g.x), label: g.label, color: 'var(--c2)' }));
    plot = (
      <Plot
        x={[0, X1]}
        y={[0, yMax]}
        height={280}
        xLabel={xName}
        yLabel="friction length (4fL/D)"
        series={[
          { points: sample(remaining, 0, X1, 50), width: 3, color: 'var(--text)', label: 'pipe that remains, 4f(L − x)/D' },
          { points: sample(fitExact, 0, X1, 300), width: 3, color: 'var(--c1)', label: 'L* behind the shock (exact)' },
          ...(tableRef !== undefined ? [{ points: sample(fitTable, 0, X1, 300), width: 2, dash: true, color: 'var(--c4)', label: `L* behind the shock, table reference ${tableRef}` }] : []),
        ]}
        vlines={[{ x: uLim * k, color: 'var(--c3)', label: `exact: ${fmt(uLim * k, 3)}` }]}
        dots={dots}
      />
    );
  }

  const u = trial / k;
  const r = at(u);
  const Mx = u < fL1 ? M_from_fLmax(fL1 - u, 'sup') : NaN;
  const My = isFinite(Mx) ? shockMy(Mx) : NaN;
  const avail = isFinite(My) ? fLmax(My) : NaN;
  const rem = fL - u;
  return (
    <SimFrame title={mode === 'pe' ? 'Shock-position iteration: exit pressure' : 'Shock-position iteration: does the flow fit?'} subtitle="each exam guess is one dot">
      {plot}
      {explore && (
        <>
          <div className="controls">
            <Slider label="Your trial shock position" value={trial} min={0} max={X1} step={X1 / 400} onChange={setTrial} format={(v) => v.toFixed(3)} />
          </div>
          <Readout
            items={[
              ['M_x (before shock)', fmt(Mx, 3)],
              ['M_y (after shock)', fmt(My, 3)],
              ['4fL*/D available after shock', fmt(avail, 3)],
              ['4f(L − x)/D remaining', fmt(rem, 3)],
              ['verdict', r.valid ? (Math.abs(avail - rem) < 0.005 ? 'exit exactly choked' : 'fits: subsonic exit') : 'L* < remaining: impossible, shock too far down'],
              ['M_exit', r.valid ? fmt(r.M2, 3) : '—'],
              [`p_exit ${unit ? `(${unit})` : ''}`, r.valid ? fmt(r.pe * p0, 4) : '—'],
            ]}
          />
        </>
      )}
    </SimFrame>
  );
}

/* =====================================================================
 * Inlet starting map and 3-D inlet section (W2019 P1, W2023 P1)
 * ===================================================================== */

export function InletStartMap({ M = 1.5 }: { M?: number }) {
  const [Md, setMd] = useState(M);
  const design = 1 / A_Astar(Md);
  const Ms = startingMach(A_Astar(Md));
  const kant = startingThroatRatio(Md);
  const valid = isFinite(Ms) && Ms < 3;
  return (
    <SimFrame title="Starting an inlet: the two routes" subtitle="overspeed (→) or open the throat (↑)">
      <div className="controls">
        <Slider label="Design Mach" value={Md} min={1.05} max={1.9} step={0.01} onChange={setMd} format={(v) => v.toFixed(2)} />
      </div>
      <Plot
        x={[1, 2.6]}
        y={[0.5, 1.02]}
        height={270}
        xLabel="flight Mach number M∞"
        yLabel="A_t / A_in"
        series={[
          { points: sample((m) => 1 / A_Astar(m), 1, 2.6), width: 3, color: 'var(--c1)', label: 'isentropic design: A*/A at M∞' },
          { points: sample((m) => startingThroatRatio(m), 1, 2.6), width: 3, color: 'var(--c2)', label: 'Kantrowitz: shock on lip, A*_y = A_t' },
          ...(valid ? [{ points: [{ x: Md, y: design }, { x: Ms, y: design }], dash: true, color: 'var(--text)', width: 1.6 }] : []),
          { points: [{ x: Md, y: design }, { x: Md, y: kant }], dash: true, color: 'var(--c3)', width: 1.6 },
        ]}
        dots={[
          { x: Md, y: design, label: 'design', color: 'var(--c1)' },
          ...(valid ? [{ x: Ms, y: design, label: `start: M∞ = ${fmt(Ms, 3)}`, color: 'var(--c2)' }] : []),
          { x: Md, y: kant, label: `open: ×${fmt(kant / design, 4)}`, color: 'var(--c3)' },
        ]}
      />
      <Readout
        items={[
          ['A_in / A_t (design)', fmt(1 / design, 4)],
          ['(a) overspeed to', valid ? fmt(Ms, 3) : 'cannot (runs away)'],
          ['(b) throat increase', `${fmt((kant / design - 1) * 100, 3)} %`],
        ]}
      />
    </SimFrame>
  );
}

type InletState = 'design' | 'overspeed' | 'open-throat' | 'unstarted';

/** 3-D section of the C-D diffuser in its four states. Radius variation exaggerated ×3; Mach field from the real area ratios. */
export function InletSection3D({ M = 1.5, initial = 'design' }: { M?: number; initial?: InletState }) {
  const [st, setSt] = useState<InletState>(initial);
  const AR = A_Astar(M);
  const Mstart = startingMach(AR);
  const open = throatOpeningFactor(M);
  const At = st === 'open-throat' ? open : 1;
  const xt = 0.45;
  const realA = knots([
    [0, AR],
    [xt, At],
    [1, AR * 1.15],
  ]);
  const Minf = st === 'overspeed' ? Mstart : M;
  const xs = 0.015;
  const field = (x: number) => {
    let Mx: number;
    let p: number;
    if (st === 'design') {
      Mx = M_from_A_Astar(Math.max(1, realA(x)), x < xt ? 'sup' : 'sub');
      p = p_p0(Mx);
    } else if (x < xs) {
      Mx = Minf;
      p = p_p0(Mx);
    } else {
      Mx = M_from_A_Astar(Math.max(1, realA(x) / At), 'sub');
      p = p0y_p0x(Minf) * p_p0(Mx);
    }
    return { M: Mx, p, T: T_T0(Mx) };
  };
  const label =
    st === 'design'
      ? `Design: M∞ = ${M} slows isentropically to M = 1 at the throat.`
      : st === 'overspeed'
        ? `Overspeed to M∞ = ${fmt(Mstart, 3)}: shock on the lip, M_y = ${fmt(shockMy(Mstart), 3)}, throat just choked.`
        : st === 'open-throat'
          ? `M∞ = ${M}, throat opened ×${fmt(open, 4)}: shock on the lip, A*_y = the new throat.`
          : `Unstarted at M∞ = ${M}: the bow shock (really just ahead of the lip), spillage, throat choked at p0y.`;
  return (
    <SimFrame title="Supersonic diffuser, section view" subtitle="radius change exaggerated ×3">
      <Toggle<InletState>
        value={st}
        onChange={setSt}
        options={[
          ['design', 'Design point'],
          ['overspeed', 'Start by overspeed'],
          ['open-throat', 'Start by opening the throat'],
          ['unstarted', 'Unstarted'],
        ]}
      />
      <div className="regime">{label}</div>
      <FlowSection3D
        wall="plain"
        x0={0}
        x1={1}
        profile={(x) => 0.13 * (1 + 3 * (Math.sqrt(realA(x) / AR) - 1))}
        field={field}
        shocks={st === 'design' ? [] : [xs]}
        plume={{ kind: 'subsonic' }}
        labels={[
          { x: 0.02, text: `inlet · M∞ = ${fmt(Minf, 3)}` },
          { x: xt, text: 'throat · M = 1', side: 'bottom' },
          { x: 1, text: `exit · M = ${fmt(field(1).M, 2)}` },
        ]}
        height={280}
      />
    </SimFrame>
  );
}

/* =====================================================================
 * Rocket nozzle: sea level vs space (W2019 P2)
 * ===================================================================== */

export function RocketSection3D({ p0 = 1000e3, pa = 101.3e3, T0 = 2000, R = 300, g = 1.4 }: { p0?: number; pa?: number; T0?: number; R?: number; g?: number }) {
  const [where, setWhere] = useState<'sea' | 'space'>('sea');
  const Me = M_from_p_p0(pa / p0, g);
  const AR = A_Astar(Me, g);
  const Ve = exitVelocity(pa / p0, T0, R, g);
  const Te = T0 * T_T0(Me, g);
  const pTerm = (R * Te) / Ve; // p_e/(ρ_e V_e)
  const Vmax = infiniteNozzleVe(T0, R, g);
  const field = (x: number) => {
    const Mx = M_from_A_Astar(Math.max(1, nozzleArea(x, AR)), x <= 0.35 ? 'sub' : 'sup', g);
    return { M: Mx, p: p_p0(Mx, g), T: T_T0(Mx, g) };
  };
  return (
    <SimFrame title="W2019 P2 nozzle: optimal at sea level" subtitle={`A_e/A_t = ${fmt(AR, 4)}, M_e = ${fmt(Me, 4)}`}>
      <Toggle
        value={where}
        onChange={setWhere}
        options={[
          ['sea', 'Sea level, p_a = 101.3 kPa'],
          ['space', 'Space, p_a = 0'],
        ]}
      />
      <FlowSection3D
        wall="engine"
        x0={0}
        x1={1}
        profile={(x) => 0.12 * Math.sqrt(nozzleArea(x, AR))}
        field={field}
        plume={{ kind: where === 'sea' ? 'ideal' : 'under', strength: 1.4 }}
        labels={[
          { x: 0.35, text: 'throat · M = 1' },
          { x: 1, text: where === 'sea' ? 'p_e = p_a: straight jet' : 'p_e > p_a = 0: plume balloons', side: 'bottom' },
        ]}
        height={280}
      />
      <Readout
        items={[
          ['V_e (m/s)', fmt(Ve, 5)],
          ['p_e/(ρ_e V_e) = RT_e/V_e (m/s)', fmt(pTerm, 5)],
          ['F/ṁ here (m/s)', fmt(where === 'sea' ? Ve : Ve + pTerm, 5)],
          ['F_sea / F_space (same nozzle)', fmt(Ve / (Ve + pTerm), 4)],
          ['V_max (A_e → ∞) (m/s)', fmt(Vmax, 5)],
          ['F_sea / F_space,∞', fmt(Ve / Vmax, 4)],
        ]}
      />
    </SimFrame>
  );
}

/* =====================================================================
 * Two-throat channel (F2023 P1)
 * ===================================================================== */

export function TwoThroatSection3D({ initial = 'blocked' }: { initial?: 'blocked' | 'started' }) {
  const [sc, setSc] = useState<'blocked' | 'started'>(initial);
  const sol = useMemo(() => twoThroatSolution(1, 1.5, 5, 0.5), []);
  const X = { c0: 0, t1: 0.35, i0: 0.7, i1: 1.0, t2: 1.35, e0: 1.7, e1: 2 };
  const A = knots([
    [X.c0, 5],
    [X.t1, 1],
    [X.i0, 5],
    [X.i1, 5],
    [X.t2, 1.5],
    [X.e0, 5],
    [X.e1, 5],
  ]);
  const xOf = (a: number, xa: number, xb: number) => bisect((x) => A(x) - a, xa, xb);
  const s = sc === 'blocked' ? sol.blocked : sol.started;
  const xs = sc === 'blocked' ? [xOf(sol.blocked.shockAreas[0], X.t1, X.i0), xOf(sol.blocked.shockAreas[1], X.t2, X.e0)] : [xOf(sol.started.shockAreas[0], X.t2, X.e0)];
  const seg = (x: number) => (x < X.t1 ? 0 : x < X.i0 ? 1 : x < X.t2 ? 2 : 3);
  return (
    <SimFrame title="Two-throat channel, section view" subtitle="F2023 P1 · p₀ = 10 bar, p_b = 5 bar">
      <Toggle
        value={sc}
        onChange={setSc}
        options={[
          ['blocked', 'What you get: blocked tunnel'],
          ['started', 'Started (unreachable with fixed areas)'],
        ]}
      />
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={2}
        profile={(x) => 0.075 * Math.sqrt(A(x))}
        field={(x) => s.stateAt(A(x), seg(x), x, xs)}
        shocks={xs}
        plume={{ kind: 'subsonic' }}
        labels={[
          { x: X.t1, text: 't₁ · M = 1' },
          {
            x: (X.i0 + X.i1) / 2,
            text: sc === 'blocked' ? `between throats · M = ${fmt(sol.blocked.Minter, 2)}, p = ${fmt(10 * sol.blocked.pInter, 3)} bar` : `M = ${fmt(sol.started.Minter, 3)}`,
            side: 'bottom',
          },
          { x: X.t2, text: sc === 'blocked' ? 't₂ · M = 1' : `t₂ · M = ${fmt(sol.started.Mt2, 3)}` },
          ...xs.map((x, i) => ({ x, text: sc === 'blocked' ? `shock ${i + 1}` : 'shock', side: 'bottom' as const })),
        ]}
        height={280}
      />
    </SimFrame>
  );
}

/* =====================================================================
 * Tank-fed Fanno duct (F2023 P2)
 * ===================================================================== */

export function TankDuctExitPlot({ fL = 20, p0 = 10, pb = 1, unit = 'bar', guesses = [0.15] }: { fL?: number; p0?: number; pb?: number; unit?: string; guesses?: number[] }) {
  const Mmax = M_from_fLmax(fL, 'sub');
  const pe = (M: number) => {
    if (M > Mmax) return NaN;
    const d = fannoDuct(M, fL);
    return d.choked ? NaN : p0 * p_p0(M) * d.p2_p1;
  };
  const pStar = pe(Mmax * (1 - 1e-9));
  const Mlo = Math.max(0.02, Mmax * 0.5);
  return (
    <SimFrame title="Tank → friction duct: which inlet Mach number?" subtitle="a subsonic exit must match p_b; a choked exit need not">
      <Plot
        x={[Mlo, Mmax * 1.12]}
        y={[0, p0]}
        height={260}
        xLabel="guessed inlet Mach number M₁"
        yLabel={`p_exit (${unit})`}
        series={[{ points: sample(pe, Mlo, Mmax * 0.99999, 300), width: 3, label: 'subsonic Fanno solution for this M₁' }]}
        bands={[{ x0: Mmax, x1: Mmax * 1.12, color: 'var(--bad)', opacity: 0.12, label: 'L > L*' }]}
        hlines={[
          { y: pb, color: 'var(--c2)', label: `p_b = ${pb} ${unit}` },
          { y: pStar, color: 'var(--c3)', label: `p* = ${fmt(pStar, 3)} ${unit}` },
        ]}
        dots={[
          ...guesses.map((g) => ({ x: g, y: pe(g), label: `M₁ = ${g}: ${fmt(pe(g), 3)} ${unit}`, color: 'var(--c4)' })),
          { x: Mmax, y: pStar, label: `L = L*: M₁ = ${fmt(Mmax, 3)}`, color: 'var(--c3)' },
        ]}
      />
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
        Every subsonic solution sits above p*, so it can never equal p_b = {pb} {unit}. Every M₁ above {fmt(Mmax, 3)} needs a longer duct than exists. The only answer is the
        green dot: choked exit, p_exit = p* &gt; p_b.
      </p>
    </SimFrame>
  );
}

export function TankDuctSection3D({ fL = 20 }: { fL?: number }) {
  const M1 = M_from_fLmax(fL, 'sub');
  const xd = 0.3;
  const A = knots([
    [0, 6],
    [xd, 1],
  ]);
  const Astar = 1 / A_Astar(M1);
  const field = (x: number) => {
    if (x < xd) {
      const M = M_from_A_Astar(Math.max(1, A(x) / Astar), 'sub');
      return { M, p: p_p0(M), T: T_T0(M) };
    }
    const used = ((x - xd) / (2 - xd)) * fL;
    const M = M_from_fLmax(Math.max(0, fLmax(M1) - used), 'sub');
    return { M, p: p_p0(M1) * (fanno_p_pstar(M) / fanno_p_pstar(M1)), T: T_T0(M) };
  };
  return (
    <SimFrame title="Tank → long friction duct, section view" subtitle="length compressed: the real duct is 1000 diameters long">
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={2}
        pipeStart={xd}
        profile={(x) => 0.08 * Math.sqrt(A(x))}
        field={field}
        frictionZone={[xd, 2]}
        plume={{ kind: 'under', strength: 0.6 }}
        labels={[
          { x: xd, text: `① M₁ = ${fmt(M1, 3)}` },
          { x: 1.15, text: `rough wall · 4fL/D = ${fL}`, side: 'bottom' },
          { x: 2, text: '② M = 1, p = p* > p_b' },
        ]}
        height={260}
      />
    </SimFrame>
  );
}

/* =====================================================================
 * Rayleigh heat addition and thermal choking (W2024 P2)
 * ===================================================================== */

export function RayleighHeatPlot({ M1 = 0.75, T1 = 300, p1 = 100, cp = 1000, qa = 15e3, qb = 50e3 }: { M1?: number; T1?: number; p1?: number; cp?: number; qa?: number; qb?: number }) {
  const [q, setQ] = useState(qa);
  const T01 = T1 * T0_T(M1);
  const h = rayleighHeat(M1, T01, q, cp);
  const T0star = h.T0star;
  const Tstar = T1 / ray_T_Tstar(M1);
  const newRatio = T01 / (T01 + q / cp);
  const Min = h.choked ? M_from_T0_T0star(newRatio, 'sub') : M1;
  const T0starNow = h.choked ? T01 + q / cp : T0star;
  const xa = 0.3;
  const xb = 1.7;
  const field = (x: number) => {
    const s = Math.max(0, Math.min(1, (x - xa) / (xb - xa)));
    const T0 = T01 + (q / cp) * s;
    const M = M_from_T0_T0star(Math.min(1, T0 / T0starNow), 'sub');
    return { M, p: ray_p_pstar(M) / 2.4, T: Math.min(1, ray_T_Tstar(M) / 1.03) };
  };
  return (
    <SimFrame title="Heat addition on the Rayleigh line" subtitle="T₀/T₀* climbs toward 1; past it, the inlet must slow down">
      <div className="controls">
        <Slider label="Heat added Δq" value={q / 1000} min={0} max={Math.max(60, qb / 1000 + 10)} step={0.5} onChange={(v) => setQ(v * 1000)} unit=" kJ/kg" />
      </div>
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={2}
        profile={() => 0.13}
        field={field}
        heatZone={[xa, xb]}
        plume={{ kind: h.choked ? 'under' : 'subsonic', strength: 0.5 }}
        labels={[
          { x: 0.15, text: `① M = ${fmt(Min, 3)}` },
          { x: 1, text: `Δq = ${fmt(q / 1000, 3)} kJ/kg`, side: 'bottom' },
          { x: 1.9, text: `② M = ${fmt(h.choked ? 1 : h.M2, 3)}` },
        ]}
        height={240}
      />
      <Plot
        x={[0.3, 1.0]}
        y={[0.5, 1.02]}
        height={250}
        xLabel="Mach number (subsonic branch)"
        yLabel="T₀ / T₀*"
        series={[{ points: sample((m) => T0_T0star(m), 0.3, 1), width: 3, label: 'Rayleigh line (Table A5)' }]}
        hlines={[{ y: 1, color: 'var(--c3)', label: 'M = 1: thermal choking' }]}
        dots={[
          { x: M1, y: T0_T0star(M1), label: `inlet M₁ = ${M1}`, color: 'var(--c1)' },
          ...(!h.choked ? [{ x: h.M2, y: h.T02 / T0star, label: `exit M₂ = ${fmt(h.M2, 3)}`, color: 'var(--c2)' }] : []),
          ...(h.choked ? [{ x: Min, y: newRatio, label: `new inlet M = ${fmt(Min, 3)}`, color: 'var(--c5)' }] : []),
        ]}
      />
      <Readout
        items={[
          ['T₀₁', `${fmt(T01, 4)} K`],
          ['T₀* (original line)', `${fmt(T0star, 4)} K`],
          ['Δq* = c_p(T₀* − T₀₁)', `${fmt(h.qStar / 1000, 4)} kJ/kg`],
          ['status', h.choked ? 'Δq > Δq*: chokes, inlet M drops' : 'Δq < Δq*: fits'],
          ['M₂', h.choked ? '1 (with the new inlet M)' : fmt(h.M2, 3)],
          ['p₂', h.choked ? '—' : `${fmt(p1 * h.p2_p1, 4)} kPa`],
          ['T₂', h.choked ? '—' : `${fmt(T1 * h.T2_T1, 4)} K`],
          ['T* (original line)', `${fmt(Tstar, 4)} K`],
        ]}
      />
    </SimFrame>
  );
}

/* =====================================================================
 * Choked mass flow vs molecular weight (W2023 P2(c))
 * ===================================================================== */

export function ChokedFlowMWCheck({ At, p0, T0, MWs }: { At: number; p0: number; T0: number; MWs: number[] }) {
  return <Readout items={MWs.map((mw) => [`MW = ${mw}`, `ṁ = ${fmt(At * massFlux(1, p0, T0, 8314 / mw), 4)} kg/s`])} />;
}
