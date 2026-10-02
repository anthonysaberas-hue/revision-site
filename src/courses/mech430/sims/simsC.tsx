/* Group C simulations — Fanno (Ch 10) and Rayleigh (Ch 11). All physics from ../lib. */
import { useMemo, useState } from 'react';
import { Plot, sample } from '../../../core/Plot';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import * as fa from '../lib/fanno';
import * as ra from '../lib/rayleigh';
import * as ise from '../lib/isentropic';
import * as ns from '../lib/normalShock';
import { fmt, machColor } from './common';
import { FlowSection3D, type FieldPoint } from '../viz/FlowSection3D';

type Pt = { x: number; y: number };
type Dot = { x: number; y: number; color?: string; label?: string; r?: number };

const safe = (f: () => number) => {
  try {
    const v = f();
    return isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
};

/* ================================================================
 * Fanno duct solver: fixed inlet Mach M1, friction length fL = 4fL/D,
 * back pressure given as pb / p*, where p* is the sonic pressure of the
 * inlet flow — the SAME on both sides of any normal shock in the duct.
 * ================================================================ */

type FannoRegime = 'sub-open' | 'sub-choked' | 'sup-expansion' | 'sup-oblique' | 'sup-shock' | 'sup-choked-shock' | 'sup-shock-upstream';

const FANNO_LABEL: Record<FannoRegime, string> = {
  'sub-open': 'Subsonic, L < L*: friction speeds the flow up, but it never reaches M = 1',
  'sub-choked': 'Frictionally choked (L > L*): the inlet Mach and ṁ must drop so that the new L* equals L',
  'sup-expansion': 'Supersonic throughout; p_b is below the exit pressure, so expansion fans form outside',
  'sup-oblique': 'Supersonic throughout; p_b is above the exit pressure, so oblique shocks form outside the duct',
  'sup-shock': 'Normal shock inside the duct; subsonic exit with p_exit = p_b',
  'sup-choked-shock': 'L > L*: normal shock in the duct and M = 1 at the exit, so p_exit = p* (not p_b)',
  'sup-shock-upstream': 'Back pressure too high: the shock is pushed out of the duct, upstream into the nozzle',
};

/** Exit state (M2, p2/p*) for a shock at fraction xs of the duct. */
function fannoShockAt(M1: number, fL: number, xs: number) {
  const fs = fa.fLmax(M1);
  const left = fs - xs * fL;
  if (left < -1e-12) return { valid: false, Mx: NaN, My: NaN, M2: NaN, pe: NaN };
  const Mx = left <= 0 ? 1 : fa.M_from_fLmax(left, 'sup');
  const My = ns.My(Mx);
  const rem = fL * (1 - xs);
  const avail = fa.fLmax(My);
  if (avail < rem - 1e-12) return { valid: false, Mx, My, M2: NaN, pe: NaN };
  const M2 = fa.M_from_fLmax(Math.max(0, avail - rem), 'sub');
  return { valid: true, Mx, My, M2, pe: fa.p_pstar(M2) };
}

function bisectX(f: (x: number) => number, a: number, b: number) {
  let fa0 = f(a);
  for (let i = 0; i < 80; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (Math.sign(fm) === Math.sign(fa0)) {
      a = m;
      fa0 = fm;
    } else b = m;
  }
  return 0.5 * (a + b);
}

interface FannoSolution {
  regime: FannoRegime;
  /** Mach actually entering the duct */
  M1: number;
  M2: number;
  /** shock position as a fraction of L */
  xs?: number;
  Mx?: number;
  My?: number;
  /** exit static pressure / p* */
  pe: number;
  /** ṁ / ṁ requested (subsonic choking only) */
  mdot: number;
  thresholds: { peSup?: number; peExitShock?: number; peInletShock?: number };
}

function solveFannoDuct(M1: number, fL: number, pbr: number): FannoSolution {
  const fs = fa.fLmax(M1);
  if (M1 < 1) {
    if (fL <= fs) {
      const M2 = fa.M_from_fLmax(fs - fL, 'sub');
      return { regime: 'sub-open', M1, M2, pe: fa.p_pstar(M2), mdot: 1, thresholds: {} };
    }
    const M1n = fa.M_from_fLmax(fL, 'sub');
    // same reservoir (p0, T0) and same duct area: ṁ ∝ 1 / (A/A*) at the duct inlet
    const mdot = ise.A_Astar(M1) / ise.A_Astar(M1n);
    return { regime: 'sub-choked', M1: M1n, M2: 1, pe: 1, mdot, thresholds: {} };
  }
  const th: FannoSolution['thresholds'] = {};
  const at0 = fannoShockAt(M1, fL, 0);
  if (at0.valid) th.peInletShock = at0.pe;
  if (fL <= fs) {
    const M2s = fa.M_from_fLmax(fs - fL, 'sup');
    th.peSup = fa.p_pstar(M2s);
    th.peExitShock = th.peSup * ns.py_px(M2s);
    if (pbr <= th.peSup + 1e-9) return { regime: 'sup-expansion', M1, M2: M2s, pe: th.peSup, mdot: 1, thresholds: th };
    if (pbr <= th.peExitShock) return { regime: 'sup-oblique', M1, M2: M2s, pe: th.peSup, mdot: 1, thresholds: th };
    if (!at0.valid || pbr > at0.pe) return { regime: 'sup-shock-upstream', M1, M2: NaN, pe: pbr, mdot: 1, thresholds: th };
    const xs = bisectX((x) => fannoShockAt(M1, fL, x).pe - pbr, 0, 1);
    const s = fannoShockAt(M1, fL, xs);
    return { regime: 'sup-shock', M1, M2: s.M2, xs, Mx: s.Mx, My: s.My, pe: s.pe, mdot: 1, thresholds: th };
  }
  // L > L*: a shock is unavoidable
  if (!at0.valid) return { regime: 'sup-shock-upstream', M1, M2: NaN, pe: pbr, mdot: 1, thresholds: th };
  // most-downstream valid shock position: exit just sonic
  const xv = bisectX((x) => (fannoShockAt(M1, fL, x).valid ? -1 : 1), 0, Math.min(1, fs / fL));
  if (pbr <= 1) {
    const s = fannoShockAt(M1, fL, xv);
    return { regime: 'sup-choked-shock', M1, M2: 1, xs: xv, Mx: s.Mx, My: s.My, pe: 1, mdot: 1, thresholds: th };
  }
  if (pbr > at0.pe) return { regime: 'sup-shock-upstream', M1, M2: NaN, pe: pbr, mdot: 1, thresholds: th };
  const xs = bisectX(
    (x) => {
      const s = fannoShockAt(M1, fL, x);
      return (s.valid ? s.pe : 1) - pbr;
    },
    0,
    xv,
  );
  const s = fannoShockAt(M1, fL, xs);
  return { regime: 'sup-shock', M1, M2: s.M2, xs, Mx: s.Mx, My: s.My, pe: s.pe, mdot: 1, thresholds: th };
}

/** Mach profile along the duct (x = x/L), including the fictitious extension to L*. */
function fannoProfile(sol: FannoSolution, fL: number, xMax: number, n = 240) {
  const pts: { x: number; M: number; ext: boolean }[] = [];
  const M1 = sol.M1;
  const fs = fa.fLmax(M1);
  const br = M1 < 1 ? 'sub' : 'sup';
  for (let i = 0; i <= n; i++) {
    const x = (xMax * i) / n;
    let M: number;
    if (sol.regime === 'sup-shock-upstream') M = NaN;
    else if (sol.xs !== undefined && x > sol.xs) {
      const used = (x - sol.xs) * fL;
      M = safe(() => fa.M_from_fLmax(Math.max(0, fa.fLmax(sol.My!) - used), 'sub'));
    } else {
      const left = fs - x * fL;
      M = left < -1e-9 ? NaN : safe(() => fa.M_from_fLmax(Math.max(0, left), br));
    }
    pts.push({ x, M, ext: x > 1 + 1e-9 });
  }
  return pts;
}

/**
 * Fanno duct: inlet Mach, 4fL/D and back pressure (as a fraction of p*).
 * Shows M(x), p(x), p0(x) and the path along the Fanno line on a T–s diagram.
 */
export function FannoDuctSim({ M1: M10 = 0.5, fL: fL0 = 0.6, pb: pb0 = 0.5 }: { M1?: number; fL?: number; pb?: number }) {
  const [M1raw, setM1] = useState(M10);
  const [fL, setFL] = useState(fL0);
  const [pb, setPb] = useState(pb0);
  const M1 = Math.abs(M1raw - 1) < 0.01 ? (M1raw < 1 ? 0.99 : 1.01) : M1raw;
  const sol = useMemo(() => solveFannoDuct(M1, fL, pb), [M1, fL, pb]);
  const fsReq = fa.fLmax(M1);
  const fsAct = fa.fLmax(sol.M1);
  const showExt = fsAct > fL + 1e-9 && sol.xs === undefined && sol.regime !== 'sup-shock-upstream';
  const xMax = showExt ? Math.min(fsAct / fL, 2.5) : 1;
  const prof = useMemo(() => fannoProfile(sol, fL, xMax), [sol, fL, xMax]);

  // pressures referred to the stagnation pressure entering the duct (p01)
  const pStar = ise.p_p0(sol.M1) / fa.p_pstar(sol.M1);
  const p0Ref = fa.p0_p0star(sol.M1);
  const inDuct = prof.filter((p) => !p.ext);
  const ext = prof.filter((p) => p.ext || Math.abs(p.x - 1) < 1e-9);
  const pSeries = (arr: typeof prof) => arr.map((p) => ({ x: p.x, y: pStar * fa.p_pstar(p.M) }));
  const p0Series = (arr: typeof prof) => arr.map((p) => ({ x: p.x, y: fa.p0_p0star(p.M) / p0Ref }));
  const pMax = Math.max(1.05, ...pSeries(prof).map((p) => (isFinite(p.y) ? p.y : 0)));

  // T–s: T/T* against (s − s*)/R = −ln(p0/p0*)
  const Ts = (M: number): Pt => ({ x: -Math.log(fa.p0_p0star(M)), y: fa.T_Tstar(M) });
  const lineSub = useMemo(() => sample((M) => M, 0.14, 1, 150).map((p) => Ts(p.x)), []);
  const lineSup = useMemo(() => sample((M) => M, 1, 3.6, 150).map((p) => Ts(p.x)), []);
  const pathUp = inDuct.filter((p) => sol.xs === undefined || p.x <= sol.xs).map((p) => Ts(p.M));
  const pathDn = sol.xs !== undefined ? inDuct.filter((p) => p.x >= sol.xs!).map((p) => Ts(p.M)) : [];
  const dots: Dot[] = [];
  if (sol.regime !== 'sup-shock-upstream') {
    dots.push({ ...Ts(sol.M1), color: machColor(sol.M1), label: '1 (inlet)' });
    if (isFinite(sol.M2)) dots.push({ ...Ts(sol.M2), color: machColor(sol.M2), label: '2 (exit)' });
  }
  if (sol.regime === 'sub-choked') dots.push({ ...Ts(M1), color: 'var(--muted)', r: 3.5, label: 'requested inlet' });
  if (sol.Mx && sol.My) {
    dots.push({ ...Ts(sol.Mx), color: machColor(sol.Mx), label: 'x' });
    dots.push({ ...Ts(sol.My), color: machColor(sol.My), label: 'y' });
  }
  dots.push({ x: 0, y: 1, color: 'var(--text)', r: 3.5, label: '* (M = 1)' });

  // 3-D section field (x runs 0..2 over the duct), T/T0 from the adiabatic relation
  const fannoField = (x: number): FieldPoint => {
    const u = Math.min(1, Math.max(0, x / 2));
    const i = Math.min(inDuct.length - 1, Math.round(u * (inDuct.length - 1)));
    const M = inDuct[i]?.M ?? NaN;
    return { M, p: pStar * fa.p_pstar(M), T: ise.T_T0(M) };
  };
  const plumeKind =
    sol.regime === 'sup-expansion' ? 'under' : sol.regime === 'sup-oblique' ? 'over' : sol.regime === 'sub-choked' || sol.regime === 'sup-choked-shock' ? 'under' : 'subsonic';
  const th = sol.thresholds;
  const unitP = (v?: number) => (v === undefined || !isFinite(v) ? '—' : `${fmt(v, 3)} p*`);
  const warn = sol.regime.includes('choked') || sol.regime === 'sup-shock-upstream';
  return (
    <SimFrame title="Fanno duct explorer" subtitle="friction drives M toward 1 from both sides; p₀ always falls">
      <div className="controls">
        <Slider label="Inlet Mach M₁" value={M1raw} min={0.1} max={4} step={0.01} onChange={setM1} format={(v) => v.toFixed(2)} />
        <Slider label="Duct friction length 4fL/D" value={fL} min={0.01} max={3} step={0.005} onChange={setFL} format={(v) => v.toFixed(3)} />
        <Slider label="Back pressure p_b / p* (supersonic inlet only)" value={pb} min={0.05} max={3} step={0.005} onChange={setPb} format={(v) => v.toFixed(3)} />
      </div>
      <div className="regime" style={warn ? { background: 'var(--warn-soft)', color: 'var(--warn)' } : undefined}>
        {FANNO_LABEL[sol.regime]}
      </div>
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={2}
        pipeStart={0}
        profile={() => 0.2}
        field={fannoField}
        shocks={sol.xs !== undefined ? [2 * sol.xs] : []}
        frictionZone={[0, 2]}
        plume={{ kind: plumeKind }}
        labels={[
          { x: 0.05, text: `inlet · M = ${fmt(sol.M1, 3)}` },
          ...(sol.xs !== undefined ? [{ x: 2 * sol.xs, text: `shock · ${fmt(sol.Mx, 3)} → ${fmt(sol.My, 3)}`, side: 'bottom' as const }] : []),
          { x: 1.95, text: sol.regime === 'sup-shock-upstream' ? 'shock left the duct' : `exit · M = ${fmt(sol.M2, 3)}${Math.abs(sol.M2 - 1) < 1e-6 ? ' (choked)' : ''}` },
        ]}
        height={260}
      />
      <div className="twocol">
        <Plot
          x={[0, xMax]}
          y={[0, Math.max(2, M1 * 1.1, sol.M1 * 1.1)]}
          height={240}
          xLabel={showExt ? 'x / L  (dashed = fictitious extension to L*)' : 'x / L'}
          yLabel="Mach number"
          series={[
            { points: inDuct.map((p) => ({ x: p.x, y: p.M })), color: 'var(--c2)', width: 3, label: 'M(x)' },
            ...(showExt ? [{ points: ext.map((p) => ({ x: p.x, y: p.M })), color: 'var(--c2)', dash: true }] : []),
          ]}
          hlines={[{ y: 1, label: 'M = 1' }]}
          vlines={[...(showExt ? [{ x: 1, color: 'var(--text)', label: 'duct exit' }] : []), ...(sol.xs !== undefined ? [{ x: sol.xs, color: 'var(--c4)', label: 'shock', dash: false }] : [])]}
        />
        <Plot
          x={[0, xMax]}
          y={[0, Math.min(pMax * 1.05, 6)]}
          height={240}
          xLabel="x / L"
          yLabel="pressure / p₀₁"
          series={[
            { points: pSeries(inDuct), color: 'var(--c1)', width: 3, label: 'p / p₀₁' },
            { points: p0Series(inDuct), color: 'var(--c3)', width: 3, label: 'p₀ / p₀₁' },
            ...(showExt ? [{ points: pSeries(ext), color: 'var(--c1)', dash: true }, { points: p0Series(ext), color: 'var(--c3)', dash: true }] : []),
          ]}
          hlines={[{ y: pStar, label: 'p* (unchanged by the shock)', color: 'var(--c1)' }]}
          vlines={sol.xs !== undefined ? [{ x: sol.xs, color: 'var(--c4)', dash: false }] : []}
        />
      </div>
      <Plot
        x={[-1.5, 0.1]}
        y={[0.25, 1.25]}
        height={280}
        xLabel="(s − s*) / R = −ln(p₀/p₀*)"
        yLabel="T / T*"
        series={[
          { points: lineSub, color: 'var(--muted)', width: 1.5, label: 'Fanno line, subsonic branch' },
          { points: lineSup, color: 'var(--muted)', width: 1.5, dash: true, label: 'supersonic branch' },
          { points: pathUp, color: 'var(--c2)', width: 4, label: 'this duct' },
          ...(pathDn.length ? [{ points: pathDn, color: 'var(--c2)', width: 4 }] : []),
        ]}
        dots={dots}
      >
        {(sx, sy) =>
          sol.Mx && sol.My ? (
            <line x1={sx(Ts(sol.Mx).x)} y1={sy(Ts(sol.Mx).y)} x2={sx(Ts(sol.My).x)} y2={sy(Ts(sol.My).y)} stroke="var(--c4)" strokeWidth={2} strokeDasharray="5 4" />
          ) : null
        }
      </Plot>
      <Readout
        items={[
          ['4fL*/D at requested M₁', fmt(fsReq)],
          ['L / L*', fmt(fL / fsReq, 3)],
          ['M entering duct', fmt(sol.M1)],
          ['M at exit', fmt(sol.M2)],
          ['p_exit', sol.regime === 'sup-shock-upstream' ? '—' : unitP(sol.pe)],
          ['p₀ exit / p₀₁', fmt(isFinite(sol.M2) ? fa.p0_p0star(sol.M2) / p0Ref : NaN)],
          ['shock', sol.xs !== undefined ? `x/L = ${fmt(sol.xs, 3)}, M ${fmt(sol.Mx, 3)} → ${fmt(sol.My, 3)}` : '—'],
          ['ṁ / ṁ requested', sol.regime === 'sub-choked' ? fmt(sol.mdot, 3) : '1'],
          ['p_b for supersonic exit', unitP(th.peSup)],
          ['p_b for shock at exit', unitP(th.peExitShock)],
          ['p_b for shock at inlet', unitP(th.peInletShock)],
          ['supersonic limit of 4fL*/D', fmt(fa.fLmaxInfinity(), 4)],
        ]}
      />
    </SimFrame>
  );
}

/* ================================================================
 * Rayleigh heat-addition explorer
 * ================================================================ */

export function RayleighHeatSim({ M1: M10 = 0.5, q: q0 = 0.2 }: { M1?: number; q?: number }) {
  const [M1raw, setM1] = useState(M10);
  const [q, setQ] = useState(q0);
  const [colorBy, setColorBy] = useState<'M' | 'T' | 'p'>('M');
  const M1 = Math.abs(M1raw - 1) < 0.01 ? (M1raw < 1 ? 0.99 : 1.01) : M1raw;
  const qStar = 1 / ra.T0_T0star(M1) - 1; // q*/(cp T01)
  const choked = q > qStar + 1e-12;
  // Actual inlet Mach: unchanged unless thermally choked; then T0* = T01 (1 + q) and the duct inlet is subsonic
  const Min = choked ? safe(() => ra.M_from_T0_T0star(1 / (1 + q), 'sub')) : M1;
  const inBr = Min < 1 ? 'sub' : 'sup';
  const rIn = ra.T0_T0star(Min);
  const M2 = choked ? 1 : safe(() => ra.M_from_T0_T0star(rIn * (1 + q), inBr));
  const impossible = !isFinite(M2);

  // (s − s*)/cp = ln(T/T*) − ((γ−1)/γ) ln(p/p*)
  const Ts = (M: number): Pt => ({ x: Math.log(ra.T_Tstar(M)) - (0.4 / 1.4) * Math.log(ra.p_pstar(M)), y: ra.T_Tstar(M) });
  const line = useMemo(() => sample((M) => M, 0.12, 4, 400).map((p) => ({ ...Ts(p.x), M: p.x })), []);
  const coolBand = line.filter((p) => p.M >= ra.M_Tmax() && p.M <= 1);
  const path = useMemo(() => {
    if (impossible) return [] as { qq: number; M: number }[];
    return sample((t) => t, 0, 1, 160).map((p) => {
      const qq = q * p.x;
      const M = safe(() => ra.M_from_T0_T0star(Math.min(1, rIn * (1 + qq)), inBr));
      return { qq, M };
    });
  }, [q, rIn, inBr, impossible]);
  const T1 = ra.T_Tstar(Min);
  const dots: Dot[] = [
    { ...Ts(ra.M_Tmax()), color: 'var(--c4)', r: 3.5, label: 'T max at M = 1/√γ' },
    { x: 0, y: 1, color: 'var(--text)', r: 3.5, label: '* (M = 1)' },
  ];
  if (choked) dots.push({ ...Ts(M1), color: 'var(--muted)', r: 3.5, label: 'requested inlet' });
  if (isFinite(Min)) dots.push({ ...Ts(Min), color: machColor(Min), label: '1' });
  if (!impossible) dots.push({ ...Ts(M2), color: machColor(M2), label: '2' });

  const tone = choked || impossible ? { background: 'var(--warn-soft)', color: 'var(--warn)' } : undefined;
  const msg = impossible
    ? 'Cannot remove this much heat on the supersonic branch'
    : choked
      ? M1 < 1
        ? 'THERMALLY CHOKED (q > q*): the inlet Mach must drop, and ṁ with it, so that this q becomes the new q*'
        : 'THERMALLY CHOKED (q > q*): a normal shock moves upstream into the nozzle; the duct runs subsonic and ends at M = 1'
      : q >= 0
        ? `Heating drives M toward 1 (${M1 < 1 ? 'subsonic: the flow accelerates' : 'supersonic: the flow decelerates'})`
        : 'Cooling drives M away from 1';
  // 3-D section: inlet run 0–0.3, heater 0.3–1.7 (q added linearly), exit run 1.7–2
  const pIn = ise.p_p0(Min);
  const rayField = (x: number): FieldPoint => {
    const u = Math.min(1, Math.max(0, (x - 0.3) / 1.4));
    const qq = q * u;
    const M = impossible ? NaN : safe(() => ra.M_from_T0_T0star(Math.min(1, rIn * (1 + qq)), inBr));
    // T scaled by T* of this Rayleigh line (max 1.03), p by p01
    return { M, p: (pIn * ra.p_pstar(M)) / ra.p_pstar(Min), T: ra.T_Tstar(M) / 1.03 };
  };
  const Tratios = path.map((p) => ra.T_Tstar(p.M) / T1).filter(isFinite);
  const Ms = path.map((p) => p.M).filter(isFinite);
  return (
    <SimFrame title="Rayleigh heat-addition explorer" subtitle="heat drives M toward 1; T peaks at M = 1/√γ">
      <div className="controls">
        <Slider label="Inlet Mach M₁" value={M1raw} min={0.1} max={4} step={0.01} onChange={setM1} format={(v) => v.toFixed(2)} />
        <Slider label="Heat added q / (c_p T₀₁)" value={q} min={-0.3} max={2} step={0.002} onChange={setQ} format={(v) => v.toFixed(3)} />
      </div>
      <div className="regime" style={tone}>
        {msg}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, margin: '0 0 0.4rem' }}>
        <span style={{ color: 'var(--muted)' }}>colour the flow by</span>
        {(['M', 'T', 'p'] as const).map((c) => (
          <button key={c} className={`btn ${colorBy === c ? 'primary' : ''}`} onClick={() => setColorBy(c)}>
            {c === 'M' ? 'Mach' : c === 'T' ? 'static T' : 'static p'}
          </button>
        ))}
      </div>
      <FlowSection3D
        wall="duct"
        x0={0}
        x1={2}
        pipeStart={0}
        profile={() => 0.2}
        field={rayField}
        colorBy={colorBy}
        heatZone={q > 0 ? [0.3, 1.7] : undefined}
        plume={{ kind: choked ? 'under' : Min > 1 && !impossible ? 'ideal' : 'subsonic' }}
        labels={[
          { x: 0.1, text: `inlet · M = ${fmt(Min, 3)}` },
          { x: 1, text: q >= 0 ? `q = ${fmt(q, 3)} c_p T₀₁` : 'cooling', side: 'bottom' },
          { x: 1.9, text: `exit · M = ${fmt(M2, 3)}${choked ? ' (thermally choked)' : ''}` },
        ]}
        height={260}
      />
      <div className="twocol">
        <Plot
          x={[-2, 0.1]}
          y={[0, 1.15]}
          height={280}
          xLabel="(s − s*) / c_p"
          yLabel="T / T*"
          series={[
            { points: line, color: 'var(--muted)', width: 1.5, label: 'Rayleigh line' },
            { points: coolBand, color: 'var(--c4)', width: 4, label: '0.845 < M < 1: heating cools' },
            { points: path.map((p) => Ts(p.M)), color: 'var(--c2)', width: 4, label: 'this duct' },
          ]}
          dots={dots}
        />
        <Plot
          x={[0, Math.max(0.02, Math.abs(q))]}
          y={[0, Math.max(1.6, ...Ms.map((m) => m * 1.1), ...Tratios.map((t) => t * 1.05))]}
          height={280}
          xLabel={q >= 0 ? 'heat added so far, q / (c_p T₀₁)' : 'heat removed so far, |q| / (c_p T₀₁)'}
          yLabel="M  and  T / T₁"
          series={[
            { points: path.map((p) => ({ x: Math.abs(p.qq), y: p.M })), color: 'var(--c2)', width: 3, label: 'M' },
            { points: path.map((p) => ({ x: Math.abs(p.qq), y: ra.T_Tstar(p.M) / T1 })), color: 'var(--c1)', width: 3, label: 'T / T₁' },
          ]}
          hlines={[{ y: 1, label: 'M = 1' }]}
        />
      </div>
      <Readout
        items={[
          ['q* / (c_p T₀₁) at M₁', fmt(qStar, 4)],
          ['M entering duct', fmt(Min)],
          ['M at exit', fmt(M2)],
          ['T₀₂ / T₀₁', fmt(1 + q)],
          ['T₂ / T₁', fmt(ra.T_Tstar(M2) / T1)],
          ['p₂ / p₁', fmt(ra.p_pstar(M2) / ra.p_pstar(Min))],
          ['p₀₂ / p₀₁', fmt(ra.p0_p0star(M2) / ra.p0_p0star(Min))],
          ['ṁ / ṁ requested', choked && M1 < 1 ? fmt(ise.A_Astar(M1) / ise.A_Astar(Min), 3) : '1'],
          ['M of T max = 1/√γ', fmt(ra.M_Tmax(), 4)],
          ['thermal choking?', choked ? 'yes' : 'no'],
        ]}
      />
    </SimFrame>
  );
}

/* ================================================================
 * Fanno and Rayleigh lines through the same state: their two
 * intersections are the two sides of a normal shock.
 * ================================================================ */

export function FannoRayleighTsSim({ M: M0 = 2 }: { M?: number }) {
  const [Mx, setMx] = useState(M0);
  const My = ns.My(Mx);
  // (s − sx)/cp = ln(T/Tx) − ((γ−1)/γ) ln(p/px)
  const k = 0.4 / 1.4;
  const fan = (M: number): Pt => {
    const t = fa.T_Tstar(M) / fa.T_Tstar(Mx);
    const p = fa.p_pstar(M) / fa.p_pstar(Mx);
    return { x: Math.log(t) - k * Math.log(p), y: t };
  };
  const ray = (M: number): Pt => {
    const t = ra.T_Tstar(M) / ra.T_Tstar(Mx);
    const p = ra.p_pstar(M) / ra.p_pstar(Mx);
    return { x: Math.log(t) - k * Math.log(p), y: t };
  };
  const Mhi = Math.max(4, Mx * 1.25);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fanLine = useMemo(() => sample((M) => M, 0.25, Mhi, 300).map((p) => fan(p.x)), [Mx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rayLine = useMemo(() => sample((M) => M, 0.25, Mhi, 300).map((p) => ray(p.x)), [Mx]);
  const all = [...fanLine, ...rayLine];
  const xMin = Math.min(...all.map((p) => p.x));
  const xMax = Math.max(...all.map((p) => p.x));
  const yMax = Math.max(...all.map((p) => p.y));
  const y = fan(My);
  return (
    <SimFrame title="Fanno line meets Rayleigh line" subtitle="the two crossings are the two sides of a normal shock">
      <div className="controls">
        <Slider label="Upstream Mach Mₓ" value={Mx} min={1.05} max={4} step={0.01} onChange={setMx} format={(v) => v.toFixed(2)} />
      </div>
      <Plot
        x={[xMin - 0.05, xMax + 0.15]}
        y={[0, yMax * 1.08]}
        height={330}
        xLabel="(s − sₓ) / c_p"
        yLabel="T / Tₓ"
        series={[
          { points: fanLine, color: 'var(--c1)', width: 2.5, label: 'Fanno line: same ṁ/A and T₀' },
          { points: rayLine, color: 'var(--c3)', width: 2.5, label: 'Rayleigh line: same ṁ/A and p + ρV²' },
        ]}
        dots={[
          { x: 0, y: 1, color: machColor(Mx), label: `x (M = ${fmt(Mx, 3)})` },
          { ...y, color: machColor(My), label: `y (M = ${fmt(My, 3)})` },
          { ...fan(1), color: 'var(--c1)', r: 3.5, label: 'Fanno M = 1' },
          { ...ray(1), color: 'var(--c3)', r: 3.5, label: 'Rayleigh M = 1' },
        ]}
      >
        {(sx, sy) => <line x1={sx(0)} y1={sy(1)} x2={sx(y.x)} y2={sy(y.y)} stroke="var(--c2)" strokeWidth={2.5} strokeDasharray="6 4" />}
      </Plot>
      <Readout
        items={[
          ['M_y', fmt(My, 4)],
          ['T_y / Tₓ', fmt(ns.Ty_Tx(Mx), 4)],
          ['p_y / pₓ', fmt(ns.py_px(Mx), 4)],
          ['p₀y / p₀ₓ', fmt(ns.p0y_p0x(Mx), 4)],
          ['(s_y − sₓ) / R', fmt(ns.deltaS_R(Mx), 4)],
          ['Rayleigh line at M_y', `T/Tₓ = ${fmt(ray(My).y, 4)}`],
        ]}
      />
    </SimFrame>
  );
}
