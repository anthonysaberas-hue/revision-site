/**
 * MECH 341 sims for chapters 8-12 (review, gas cycles, vapor cycles, refrigeration, property relations).
 * Every number comes from the tested lib (cycles.ts, props.ts, refrig.ts, realgas.ts, gas.ts) so the sims agree with the worked examples.
 */
import { useMemo, useState } from 'react';
import { Plot, Series } from '../../../core/Plot';
import { Readout, SimFrame, Slider } from '../../../core/ui';
import { f, range, Sel } from '../viz/Kit';
import { TsDiagramView, TsPoint } from '../viz/Diagrams';
import { water, r134a } from '../lib/props';
import { brayton, rpMaxWork, turbojet, rankine } from '../lib/cycles';
import { vcr, flashTwoStage } from '../lib/refrig';
import { leeKesler } from '../lib/realgas';
import { atmosphere } from '../lib/gas';

const pct = (v: number) => (Number.isFinite(v) ? `${(100 * v).toFixed(1)} %` : '—');
const num = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem', margin: '6px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/* ====================================================================== chapter 8 */

/** Adiabatic steam turbine: isentropic efficiency, entropy generation, exergy destruction, second-law efficiency. */
export function TurbineExergySim() {
  const [P1, setP1] = useState(4000);
  const [T1, setT1] = useState(400);
  const [P2, setP2] = useState(10);
  const [eta, setEta] = useState(0.85);
  const [T0, setT0] = useState(298.15);
  const r = useMemo(() => {
    const Teff = Math.max(T1, water.Tsat(P1) + 15);
    const s1 = water.PT(P1, Teff);
    const s2s = water.Ps(P2, s1.s);
    const h2 = s1.h - eta * (s1.h - s2s.h);
    const s2 = water.Ph(P2, h2);
    const ws = s1.h - s2s.h;
    const wa = s1.h - h2;
    const wrev = s1.h - s2.h - T0 * (s1.s - s2.s);
    const sgen = s2.s - s1.s;
    return { Teff, s1, s2s, s2, ws, wa, wrev, sgen, xd: T0 * sgen, eta2: wa / wrev };
  }, [P1, T1, P2, eta, T0]);
  const pts: TsPoint[] = [
    { s: r.s1.s, T: r.s1.T, P: P1, label: '1' },
    { s: r.s2s.s, T: r.s2s.T, label: '2s' },
    { s: r.s2.s, T: r.s2.T, label: '2' },
  ];
  return (
    <SimFrame title="Steam turbine: where the work goes" subtitle="adiabatic, steady flow; T₀ is the environment for exergy">
      <div className="controls">
        <Slider label="inlet pressure P₁" value={P1} min={1000} max={15000} step={100} onChange={setP1} unit=" kPa" />
        <Slider label="inlet temperature T₁" value={T1} min={250} max={600} step={5} onChange={setT1} unit=" °C" />
        <Slider label="exit pressure P₂" value={P2} min={5} max={200} step={1} onChange={setP2} unit=" kPa" />
        <Slider label="isentropic efficiency η_T" value={eta} min={0.5} max={1} step={0.01} onChange={setEta} format={(v) => v.toFixed(2)} />
        <Slider label="environment T₀" value={T0} min={263} max={318} step={1} onChange={setT0} unit=" K" format={(v) => v.toFixed(0)} />
      </div>
      <TsDiagramView fluid="water" points={pts} path={[0, 2]} height={300} isobars={[P1, P2]} />
      <Readout
        items={[
          ['T₁ used', `${num(r.Teff, 0)} °C`],
          ['exit state', r.s2.x !== undefined ? `x = ${r.s2.x.toFixed(3)}` : `${num(r.s2.T, 0)} °C (superheated)`],
          ['w isentropic h₁ − h₂s', `${num(r.ws, 0)} kJ/kg`],
          ['w actual h₁ − h₂', `${num(r.wa, 0)} kJ/kg`],
          ['s_gen = s₂ − s₁', `${r.sgen.toFixed(4)} kJ/kg·K`],
          ['exergy destroyed T₀ s_gen', `${num(r.xd, 0)} kJ/kg`],
          ['reversible work', `${num(r.wrev, 0)} kJ/kg`],
          ['second-law efficiency', pct(r.eta2)],
        ]}
      />
      <p className="srcnote">
        w_rev = (h₁ − h₂) − T₀(s₁ − s₂) is the most work the same end states could deliver. w_rev − w_actual = T₀ s_gen: every kJ of entropy generated costs T₀ kJ of work. Note that η_II (about 0.86 at η_T = 0.85) is not η_T.
      </p>
    </SimFrame>
  );
}

/** Exergy content of heat: the Carnot factor 1 − T0/T. */
export function HeatExergySim() {
  const [T, setT] = useState(1500);
  const [T0, setT0] = useState(298.15);
  const fac = (t: number) => Math.max(0, 1 - T0 / t);
  const curve = range(T0, 2500, 120).map((t) => ({ x: t, y: fac(t) }));
  return (
    <SimFrame title="How much work is 1 MJ of heat worth?" subtitle="exergy of heat = Q (1 − T₀/T)">
      <div className="controls">
        <Slider label="temperature at which heat is available T" value={T} min={300} max={2500} step={10} onChange={setT} unit=" K" format={(v) => v.toFixed(0)} />
        <Slider label="environment T₀" value={T0} min={263} max={318} step={1} onChange={setT0} unit=" K" format={(v) => v.toFixed(0)} />
      </div>
      <Plot
        x={[T0, 2500]}
        y={[0, 1]}
        height={260}
        xLabel="T (K)"
        yLabel="Carnot factor"
        series={[{ points: curve, color: 'var(--c1)', width: 2.4, label: '1 − T₀/T' }]}
        dots={[{ x: T, y: fac(T), color: 'var(--c2)', label: pct(fac(T)) }]}
        legend={false}
      />
      <Readout
        items={[
          ['Carnot factor', pct(fac(T))],
          ['work from 1000 kJ of heat (max)', `${num(1000 * fac(T), 0)} kJ`],
          ['lost to entropy generation if just dumped to T₀', `${num(1000 * fac(T), 0)} kJ`],
        ]}
      />
      <p className="srcnote">A flame at about 2000 K is worth about 85 % of its heat as work; hot water at 350 K only about 15 %. This is why burning fuel just to make low-grade heat wastes most of its exergy.</p>
    </SimFrame>
  );
}

/* ====================================================================== chapter 9 */

/** Brayton cycle: η and w_net vs pressure ratio, component efficiencies, regeneration. */
export function BraytonSim() {
  const [T1, setT1] = useState(300);
  const [T3, setT3] = useState(1300);
  const [rp, setRp] = useState(8);
  const [eC, setEC] = useState(1);
  const [eT, setET] = useState(1);
  const [regen, setRegen] = useState(false);
  const [eps, setEps] = useState(0.8);
  const run = (r: number, withRegen: boolean) => {
    const base = brayton({ T1, rp: r, T3, etaC: eC, etaT: eT });
    const e = withRegen && base.T4 > base.T2 ? eps : 0;
    return brayton({ T1, rp: r, T3, etaC: eC, etaT: eT, regen: e });
  };
  const cur = run(rp, regen);
  const grid = range(1.5, 40, 130);
  const etaS: Series = { points: grid.map((x) => ({ x, y: run(x, false).eta })), color: 'var(--c1)', width: 2.4, label: 'simple' };
  const etaR: Series = { points: grid.map((x) => ({ x, y: run(x, true).eta })), color: 'var(--c3)', width: 2.4, label: 'with regenerator' };
  const wS: Series = { points: grid.map((x) => ({ x, y: run(x, false).wnet })), color: 'var(--c1)', width: 2.4, label: 'w_net' };
  const rpOpt = rpMaxWork(T1, T3);
  const wmax = Math.max(...wS.points.map((p) => (Number.isFinite(p.y) ? p.y : 0)), 50) * 1.1;
  const noRegenUseful = regen && cur.T4 <= cur.T2;
  return (
    <SimFrame title="Brayton cycle explorer" subtitle="cold-air standard, c_p = 1.005, k = 1.4; lib brayton()">
      <div className="controls">
        <Slider label="pressure ratio r_p" value={rp} min={2} max={40} step={0.5} onChange={setRp} />
        <Slider label="turbine inlet T₃" value={T3} min={900} max={1900} step={10} onChange={setT3} unit=" K" format={(v) => v.toFixed(0)} />
        <Slider label="compressor inlet T₁" value={T1} min={250} max={330} step={1} onChange={setT1} unit=" K" format={(v) => v.toFixed(0)} />
        <Slider label="compressor η_C" value={eC} min={0.7} max={1} step={0.01} onChange={setEC} format={(v) => v.toFixed(2)} />
        <Slider label="turbine η_T" value={eT} min={0.7} max={1} step={0.01} onChange={setET} format={(v) => v.toFixed(2)} />
        <div>
          <Check label="add a regenerator" checked={regen} onChange={setRegen} />
          {regen && <Slider label="effectiveness ε" value={eps} min={0.1} max={1} step={0.05} onChange={setEps} format={(v) => v.toFixed(2)} />}
        </div>
      </div>
      <Plot
        x={[0, 40]}
        y={[0, 0.8]}
        height={260}
        xLabel="pressure ratio r_p"
        yLabel="thermal efficiency η"
        series={regen ? [etaS, etaR] : [etaS]}
        dots={[{ x: rp, y: cur.eta, color: 'var(--c2)', label: pct(cur.eta) }]}
      />
      <Plot
        x={[0, 40]}
        y={[0, wmax]}
        height={240}
        xLabel="pressure ratio r_p"
        yLabel="w_net (kJ/kg)"
        series={[wS]}
        vlines={[{ x: rpOpt, color: 'var(--c4)', dash: true, label: 'r_p for max work (ideal)' }]}
        dots={[{ x: rp, y: cur.wnet, color: 'var(--c2)', label: `${num(cur.wnet, 0)}` }]}
        legend={false}
      />
      <Readout
        items={[
          ['T₂ (compressor exit)', `${num(cur.T2, 0)} K`],
          ['T₄ (turbine exit)', `${num(cur.T4, 0)} K`],
          ['w_c', `${num(cur.wc, 0)} kJ/kg`],
          ['w_t', `${num(cur.wt, 0)} kJ/kg`],
          ['w_net', `${num(cur.wnet, 0)} kJ/kg`],
          ['back-work ratio w_c/w_t', pct(cur.rbw)],
          ['q_in', `${num(cur.qin, 0)} kJ/kg`],
          ['η (ideal 1 − r_p^−(k−1)/k)', `${pct(cur.eta)} (${pct(cur.etaIdeal)})`],
        ]}
      />
      {noRegenUseful && <p className="srcnote">T₄ ≤ T₂: the exhaust is no hotter than the compressed air, so the regenerator cannot help and is bypassed (η falls back to the simple cycle).</p>}
      <p className="srcnote">Max work at r_p = (T₃/T₁)^(k/(2(k−1))) = {num(rpOpt, 1)}, where T₂ = T₄ = √(T₁T₃). Best efficiency is at much higher r_p. Losses (η_C, η_T below 1) pull the work peak down and to the left, and efficiency can even drop at high r_p.</p>
    </SimFrame>
  );
}

/** Turbojet: ram, pressure ratio, turbine inlet temperature, component efficiencies, nozzle type. */
export function TurbojetSim() {
  const [z, setZ] = useState(0);
  const [Ma, setMa] = useState(0.8);
  const [rc, setRc] = useState(12);
  const [T04, setT04] = useState(1400);
  const [eD, setED] = useState(1);
  const [eC, setEC] = useState(0.87);
  const [eT, setET] = useState(0.9);
  const [noz, setNoz] = useState<'CD' | 'C'>('CD');
  const atm = atmosphere(z);
  const a = Math.sqrt(1.4 * 287 * atm.T);
  const V = Ma * a;
  const run = (r: number) =>
    turbojet({ Ta: atm.T, Pa: atm.P, V, mdot: 1, rc: r, T04, etaD: eD, etaC: eC, etaT: eT, cpg: 1.147, kg: 1.333, nozzle: noz, QHV: 42700 });
  const cur = run(rc);
  const grid = range(3, 40, 74);
  const sp = grid.map((x) => ({ x, y: run(x).F }));
  const sf = grid.map((x) => ({ x, y: run(x).TSFC * 1e6 }));
  const ok = (v: number) => Number.isFinite(v) && v > 0;
  const Fmax = Math.max(...sp.map((p) => (ok(p.y) ? p.y : 0)), 100) * 1.1;
  const Smax = Math.max(...sf.map((p) => (ok(p.y) && p.y < 200 ? p.y : 0)), 20) * 1.1;
  const bad = !ok(cur.F);
  return (
    <SimFrame title="Turbojet explorer" subtitle="stagnation-based analysis per kg/s of air; fuel LHV 42.7 MJ/kg; lib turbojet()">
      <div className="controls">
        <Slider label="altitude" value={z} min={0} max={13000} step={500} onChange={setZ} unit=" m" format={(v) => v.toFixed(0)} />
        <Slider label="flight Mach number" value={Ma} min={0} max={1.2} step={0.05} onChange={setMa} format={(v) => v.toFixed(2)} />
        <Slider label="compressor pressure ratio r_c" value={rc} min={3} max={40} step={1} onChange={setRc} />
        <Slider label="turbine inlet T₀₄" value={T04} min={1000} max={1900} step={25} onChange={setT04} unit=" K" format={(v) => v.toFixed(0)} />
        <Slider label="diffuser η_D" value={eD} min={0.8} max={1} step={0.01} onChange={setED} format={(v) => v.toFixed(2)} />
        <Slider label="compressor η_C" value={eC} min={0.7} max={1} step={0.01} onChange={setEC} format={(v) => v.toFixed(2)} />
        <Slider label="turbine η_T" value={eT} min={0.7} max={1} step={0.01} onChange={setET} format={(v) => v.toFixed(2)} />
        <Sel label="nozzle" value={noz} options={[{ v: 'CD', t: 'converging–diverging (expands to ambient)' }, { v: 'C', t: 'converging (chokes)' }]} onChange={setNoz} />
      </div>
      <Plot x={[3, 40]} y={[0, Fmax]} height={220} xLabel="compressor pressure ratio r_c" yLabel="specific thrust F/ṁ (N·s/kg)" series={[{ points: sp, color: 'var(--c1)', width: 2.4 }]} dots={bad ? [] : [{ x: rc, y: cur.F, color: 'var(--c2)', label: num(cur.F, 0) }]} legend={false} />
      <Plot x={[3, 40]} y={[0, Smax]} height={220} xLabel="compressor pressure ratio r_c" yLabel="TSFC (mg/N·s)" series={[{ points: sf, color: 'var(--c3)', width: 2.4 }]} dots={bad ? [] : [{ x: rc, y: cur.TSFC * 1e6, color: 'var(--c2)', label: num(cur.TSFC * 1e6, 1) }]} legend={false} />
      {bad ? (
        <p className="srcnote">This combination produces no net thrust (the turbine cannot drive the compressor or the nozzle has nothing to expand through). Raise T₀₄ or lower r_c.</p>
      ) : (
        <Readout
          items={[
            ['flight speed V', `${num(V, 0)} m/s`],
            ['ram ratio P₀₁/P_a', num(cur.ramRatio, 2)],
            ['T₀₃ after compressor', `${num(cur.T03, 0)} K`],
            ['T₀₅ after turbine', `${num(cur.T05, 0)} K`],
            ['exit velocity V_e', `${num(cur.Ve, 0)} m/s`],
            ['nozzle', cur.choked ? 'choked, P_e = P*' : 'fully expanded to P_a'],
            ['fuel/air ratio f', cur.f.toFixed(4)],
            ['specific thrust F/ṁ', `${num(cur.F, 0)} N·s/kg`],
            ['TSFC', `${num(cur.TSFC * 1e6, 1)} mg/(N·s)`],
            ['propulsive efficiency P/Q_in', pct(cur.etaP)],
          ]}
        />
      )}
      <p className="srcnote">Raise r_c: thrust first rises (more expansion) then falls (the compressor eats the turbine's work); TSFC keeps improving. Raise T₀₄: thrust rises strongly, efficiency modestly. Ram helps the intake pressure ratio, but at higher V the η_P term (V/V_e) is what matters.</p>
    </SimFrame>
  );
}

/* ====================================================================== chapter 10 */

/** Rankine cycle on a T–s diagram with reheat and open feedwater heater toggles. */
export function RankineSim() {
  const [Pb, setPb] = useState(4000);
  const [Tb, setTb] = useState(400);
  const [Pc, setPc] = useState(10);
  const [eT, setET] = useState(1);
  const [eP, setEP] = useState(1);
  const [rh, setRh] = useState(false);
  const [Prh, setPrh] = useState(400);
  const [of, setOf] = useState(false);
  const [Pof, setPof] = useState(400);
  const Tuse = Math.max(Tb, water.Tsat(Pb) + 30);
  const Prh2 = Math.min(Prh, 0.6 * Pb);
  const Pof2 = Math.min(Pof, rh ? 0.6 * Prh2 : 0.6 * Pb);
  const r = useMemo(
    () =>
      rankine({
        Pb,
        Tb: Tuse,
        Pc,
        etaT: eT,
        etaP: eP,
        reheat: rh ? { P: Prh2, T: Tuse } : undefined,
        ofwh: of && Pof2 > Pc * 1.5 ? { P: Pof2 } : undefined,
      }),
    [Pb, Tuse, Pc, eT, eP, rh, Prh2, of, Pof2],
  );
  const S = r.states;
  const pts: TsPoint[] = [];
  const path: number[] = [];
  const add = (st: { s: number; T: number }, P: number | undefined, label: string) => {
    pts.push({ s: st.s, T: st.T, P, label });
    path.push(pts.length - 1);
  };
  add(S.condExit, Pc, '1');
  add(S.pump1Exit, of ? Pof2 : Pb, '2');
  if (of) {
    add(S.fwhExit, Pof2, '3');
    add(S.pump2Exit, Pb, '4');
  }
  add(S.turbineIn, Pb, 'in');
  if (rh) {
    add(S.reheatIn, Prh2, 'rh₁');
    add(S.reheatOut, Prh2, 'rh₂');
  }
  if (of) add(S.bleed, Pof2, 'y');
  add(S.turbineExit, Pc, 'out');
  path.push(0);
  return (
    <SimFrame title="Rankine cycle explorer" subtitle="water; lib rankine(); steam tables behind every point">
      <div className="controls">
        <Slider label="boiler pressure" value={Pb} min={1000} max={15000} step={100} onChange={setPb} unit=" kPa" />
        <Slider label="turbine inlet temperature" value={Tb} min={300} max={650} step={5} onChange={setTb} unit=" °C" />
        <Slider label="condenser pressure" value={Pc} min={5} max={100} step={1} onChange={setPc} unit=" kPa" />
        <Slider label="turbine η_T" value={eT} min={0.6} max={1} step={0.01} onChange={setET} format={(v) => v.toFixed(2)} />
        <Slider label="pump η_P" value={eP} min={0.6} max={1} step={0.01} onChange={setEP} format={(v) => v.toFixed(2)} />
        <div>
          <Check label="reheat (back to the inlet temperature)" checked={rh} onChange={setRh} />
          {rh && <Slider label="reheat pressure" value={Prh} min={100} max={3000} step={50} onChange={setPrh} unit=" kPa" />}
          <Check label="one open feedwater heater" checked={of} onChange={setOf} />
          {of && <Slider label="bleed pressure" value={Pof} min={50} max={2000} step={25} onChange={setPof} unit=" kPa" />}
        </div>
      </div>
      <TsDiagramView fluid="water" points={pts} path={path} height={340} />
      <Readout
        items={[
          ['thermal efficiency', pct(r.eta)],
          ['w_net', `${num(r.wnet, 0)} kJ/kg`],
          ['q_in', `${num(r.qin, 0)} kJ/kg`],
          ['q_out', `${num(r.qout, 0)} kJ/kg`],
          ['turbine exit quality', Number.isFinite(r.x_exit) ? r.x_exit.toFixed(3) : 'superheated'],
          ['back-work ratio', pct(r.bwr)],
          ['bled fraction y', of ? r.y.toFixed(4) : '—'],
          ['T inlet used', `${num(Tuse, 0)} °C`],
        ]}
      />
      {(Prh2 < Prh && rh) || (Pof2 < Pof && of) ? (
        <p className="srcnote">
          Pressures used: {rh ? `reheat ${num(Prh2, 0)} kPa` : ''}
          {rh && of ? ', ' : ''}
          {of ? `bleed ${num(Pof2, 0)} kPa` : ''} (the reheat is kept below 0.6 P_boiler and the bleed below 0.6 of the pressure it comes after, so the states stay in order).
        </p>
      ) : null}
      <p className="srcnote">
        Area under the T–s path is heat (not work). Lower P_c lowers the average T of heat rejection; higher P_b or T raises the average T of heat addition; reheat adds a high-T heat addition and dries the exhaust; the feedwater heater removes the coolest heat addition. Watch η, not w_net.
      </p>
    </SimFrame>
  );
}

/* ====================================================================== chapter 11 */

/** COP vs evaporator temperature: Carnot vs ideal vapour-compression vs actual (η_C, superheat, subcooling). */
export function CopSim() {
  const [TH, setTH] = useState(40);
  const [TL, setTL] = useState(-10);
  const [eC, setEC] = useState(0.8);
  const [sh, setSh] = useState(5);
  const [hp, setHp] = useState(false);
  const carnot = (tl: number) => 1 / ((TH + 273.15) / (tl + 273.15) - 1) + (hp ? 1 : 0);
  const ideal = (tl: number) => {
    const v = vcr({ TL: tl, TH });
    return hp ? v.COPHP : v.COPR;
  };
  const actual = (tl: number) => {
    const v = vcr({ TL: tl, TH, etaC: eC, superheat: sh, subcool: 5 });
    return hp ? v.COPHP : v.COPR;
  };
  const grid = range(-35, Math.min(20, TH - 8), 55);
  const cur = { c: carnot(TL), i: ideal(TL), a: actual(TL) };
  const ymax = Math.max(...grid.map((x) => carnot(x))) * 1.05;
  return (
    <SimFrame title="COP: Carnot vs the real refrigerator" subtitle="R-134a; lib vcr(); actual = η_C, 5 K superheat, 5 K subcooling">
      <div className="controls">
        <Slider label="condenser saturation T_H" value={TH} min={25} max={60} step={1} onChange={setTH} unit=" °C" format={(v) => v.toFixed(0)} />
        <Slider label="evaporator saturation T_L" value={Math.min(TL, TH - 10)} min={-35} max={15} step={1} onChange={setTL} unit=" °C" format={(v) => v.toFixed(0)} />
        <Slider label="compressor η_C" value={eC} min={0.6} max={1} step={0.01} onChange={setEC} format={(v) => v.toFixed(2)} />
        <Slider label="superheat at the evaporator exit" value={sh} min={0} max={15} step={1} onChange={setSh} unit=" K" format={(v) => v.toFixed(0)} />
        <Check label="show heat-pump COP (COP_R + 1)" checked={hp} onChange={setHp} />
      </div>
      <Plot
        x={[-35, Math.min(20, TH - 8)]}
        y={[0, ymax]}
        height={290}
        xLabel="evaporator temperature T_L (°C)"
        yLabel={hp ? 'COP of a heat pump' : 'COP of a refrigerator'}
        series={[
          { points: grid.map((x) => ({ x, y: carnot(x) })), color: 'var(--muted)', width: 2, dash: true, label: 'Carnot (reversible)' },
          { points: grid.map((x) => ({ x, y: ideal(x) })), color: 'var(--c1)', width: 2.4, label: 'ideal vapour-compression' },
          { points: grid.map((x) => ({ x, y: actual(x) })), color: 'var(--c3)', width: 2.4, label: 'actual' },
        ]}
        dots={[{ x: Math.min(TL, TH - 10), y: cur.a, color: 'var(--c2)', label: cur.a.toFixed(2) }]}
      />
      <Readout
        items={[
          ['Carnot COP', cur.c.toFixed(2)],
          ['ideal VCR', cur.i.toFixed(2)],
          ['actual', cur.a.toFixed(2)],
          ['actual / Carnot', pct(cur.a / cur.c)],
        ]}
      />
      <p className="srcnote">The COP falls fast as the lift T_H − T_L grows: that is why two stages help at large lift and why a heat pump's COP drops on the coldest days. The real machine tracks Carnot's shape, at roughly 55–70 % of its value.</p>
    </SimFrame>
  );
}

/** Single-stage vs two-stage compression: COP vs intermediate pressure. */
export function TwoStageSim() {
  const [TL, setTL] = useState(-25);
  const [TH, setTH] = useState(31.3);
  const [x, setX] = useState(0.5);
  const PL = r134a.Psat(TL);
  const PH = r134a.Psat(TH);
  const Pgm = Math.sqrt(PL * PH);
  const lo = PL * 1.15;
  const hi = PH * 0.85;
  const Pm = lo * Math.pow(hi / lo, x);
  const single = vcr({ PL, PH });
  const two = (P: number) => flashTwoStage({ PH, Pm: P, PL, QL: 1 });
  const grid = range(0, 1, 60).map((t) => lo * Math.pow(hi / lo, t));
  const cur = two(Pm);
  return (
    <SimFrame title="One stage or two? Intermediate pressure" subtitle="R-134a, ideal compressors, flash separator between the stages; lib flashTwoStage()">
      <div className="controls">
        <Slider label="evaporator T_L" value={TL} min={-40} max={0} step={1} onChange={setTL} unit=" °C" format={(v) => v.toFixed(0)} />
        <Slider label="condenser T_H" value={TH} min={30} max={60} step={0.5} onChange={setTH} unit=" °C" />
        <Slider label="intermediate pressure P_m (log scale)" value={x} min={0} max={1} step={0.01} onChange={setX} format={() => `${Pm.toFixed(0)} kPa`} />
      </div>
      <Plot
        x={[lo, hi]}
        y={[Math.min(single.COPR, ...grid.map((p) => two(p).COP)) * 0.9, Math.max(...grid.map((p) => two(p).COP)) * 1.05]}
        height={260}
        xLabel="intermediate pressure P_m (kPa)"
        yLabel="COP"
        series={[{ points: grid.map((p) => ({ x: p, y: two(p).COP })), color: 'var(--c1)', width: 2.4, label: 'two-stage' }]}
        hlines={[{ y: single.COPR, color: 'var(--c3)', dash: true, label: 'single stage' }]}
        vlines={[{ x: Pgm, color: 'var(--c4)', dash: true, label: '√(P_L P_H)' }]}
        dots={[{ x: Pm, y: cur.COP, color: 'var(--c2)', label: cur.COP.toFixed(2) }]}
      />
      <Readout
        items={[
          ['P_L / P_H', `${PL.toFixed(0)} / ${PH.toFixed(0)} kPa`],
          ['single-stage COP', single.COPR.toFixed(2)],
          ['two-stage COP at this P_m', cur.COP.toFixed(2)],
          ['geometric mean √(P_L P_H)', `${Pgm.toFixed(0)} kPa`],
          ['flash quality x₆', cur.x6.toFixed(3)],
          ['gain over single stage', pct(cur.COP / single.COPR - 1)],
        ]}
      />
      <p className="srcnote">The curve is flat near the optimum, so the geometric mean √(P_L P_H) is a sound rule of thumb. The gain comes from (1) two smaller compressions at lower T and (2) flashing the liquid at P_m, so less liquid needs to boil in the cold evaporator.</p>
    </SimFrame>
  );
}

/* ====================================================================== chapter 12 */

/** Clapeyron slope on the saturation curve and h_fg from it. */
export function ClapeyronSim() {
  const [fl, setFl] = useState<'water' | 'r134a'>('r134a');
  const [T, setT] = useState(20);
  const [dT, setDT] = useState(4);
  const F = fl === 'water' ? water : r134a;
  const R = fl === 'water' ? 8.314 / 18.015 : 8.314 / 102.03;
  const [lo, hi] = fl === 'water' ? [20, 300] : [-30, 90];
  const Tc = Math.min(Math.max(T, lo + dT), hi - dT);
  const s = F.satT(Tc);
  const slope = (F.Psat(Tc + dT) - F.Psat(Tc - dT)) / (2 * dT);
  const Tk = Tc + 273.15;
  const hfgC = Tk * s.vfg * slope;
  const hfgCC = (R * Tk * Tk * slope) / s.P;
  const grid = range(lo, hi, 90).map((t) => ({ x: t, y: F.Psat(t) }));
  const pmax = F.Psat(hi);
  const tang = [-1, 1].map((k) => ({ x: Tc + k * 0.18 * (hi - lo), y: s.P + slope * k * 0.18 * (hi - lo) }));
  return (
    <SimFrame title="Clapeyron: the slope of the saturation curve is h_fg / (T v_fg)" subtitle="slope by central difference of lib Psat(T)">
      <div className="controls">
        <Sel label="fluid" value={fl} options={[{ v: 'r134a', t: 'R-134a' }, { v: 'water', t: 'water' }]} onChange={(v) => { setFl(v); setT(v === 'water' ? 100 : 20); }} />
        <Slider label="temperature" value={Tc} min={lo + 4} max={hi - 4} step={1} onChange={setT} unit=" °C" format={(v) => v.toFixed(0)} />
        <Slider label="half-width ΔT of the finite difference" value={dT} min={0.5} max={10} step={0.5} onChange={setDT} unit=" K" />
      </div>
      <Plot
        x={[lo, hi]}
        y={[0, pmax]}
        height={280}
        xLabel="T (°C)"
        yLabel="P_sat (kPa)"
        series={[
          { points: grid, color: 'var(--c1)', width: 2.4, label: 'saturation curve' },
          { points: tang, color: 'var(--c3)', width: 1.6, dash: true, label: 'tangent' },
        ]}
        dots={[{ x: Tc, y: s.P, color: 'var(--c2)', label: `${s.P.toFixed(0)} kPa` }]}
        legend={false}
      />
      <Readout
        items={[
          ['dP/dT (central difference)', `${slope.toFixed(3)} kPa/K`],
          ['v_fg', `${s.vfg.toFixed(5)} m³/kg`],
          ['T in kelvin', `${Tk.toFixed(2)} K`],
          ['h_fg from Clapeyron T v_fg dP/dT', `${hfgC.toFixed(1)} kJ/kg`],
          ['h_fg from the table', `${s.hfg.toFixed(1)} kJ/kg`],
          ['error', `${(100 * (hfgC / s.hfg - 1)).toFixed(2)} %`],
          ['Clausius–Clapeyron  R T² (dP/dT)/P', `${hfgCC.toFixed(1)} kJ/kg`],
          ['its error', `${(100 * (hfgCC / s.hfg - 1)).toFixed(1)} %`],
        ]}
      />
      <p className="srcnote">Clausius–Clapeyron assumes v_f is negligible and the vapour is ideal (v_fg ≈ RT/P). It is excellent at low P and drifts as the critical point nears; the full Clapeyron equation has no such assumption. Always use T in kelvin.</p>
    </SimFrame>
  );
}

/** Compressibility factor and departure factors from the Lee–Kesler correlation. */
export function ZChartSim() {
  const [Tr, setTr] = useState(1.2);
  const [Pr, setPr] = useState(2);
  const cur = leeKesler(Tr, Pr);
  const TRS = [1.0, 1.2, 1.5, 2, 3];
  const cols = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
  const series: Series[] = useMemo(
    () =>
      TRS.map((t, i) => ({
        points: range(0.05, 10, 70).map((p) => ({ x: p, y: leeKesler(t, p).Z })),
        color: cols[i],
        width: 2,
        label: `T_R = ${t}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <SimFrame title="Compressibility factor Z(T_R, P_R)" subtitle="Lee–Kesler simple fluid (the generalized chart); vapour or supercritical branch">
      <div className="controls">
        <Slider label="reduced temperature T_R = T/T_cr" value={Tr} min={1} max={3} step={0.01} onChange={setTr} format={(v) => v.toFixed(2)} />
        <Slider label="reduced pressure P_R = P/P_cr" value={Pr} min={0.05} max={10} step={0.05} onChange={setPr} format={(v) => v.toFixed(2)} />
      </div>
      <Plot
        x={[0, 10]}
        y={[0, 1.4]}
        height={290}
        xLabel="P_R"
        yLabel="Z = Pv/RT"
        series={series}
        hlines={[{ y: 1, color: 'var(--muted)', dash: true }]}
        dots={Number.isFinite(cur.Z) ? [{ x: Pr, y: cur.Z, color: 'var(--text)', label: `Z = ${cur.Z.toFixed(3)}` }] : []}
      />
      <Readout
        items={[
          ['Z', f(cur.Z, 4)],
          ['Z_h = (h* − h)/(R_u T_cr)', f(cur.Zh, 4)],
          ['Z_s = (s* − s)/R_u', f(cur.Zs, 4)],
          ['deviation from ideal', Number.isFinite(cur.Z) ? pct(cur.Z - 1) : '—'],
        ]}
      />
      <p className="srcnote">Near the critical point (T_R ≈ 1, P_R ≈ 1) Z drops to about 0.29; at high T_R and low P_R, Z → 1. Z_h and Z_s are the enthalpy and entropy departure factors read from the lower charts: Δh̄ = Δh̄_ideal − R_u T_cr (Z_h2 − Z_h1).</p>
    </SimFrame>
  );
}

/** Throttling (h = const) of water or R-134a: temperature along the isenthalp, J–T coefficient. */
export function JouleThomsonSim() {
  const [fl, setFl] = useState<'water' | 'r134a'>('r134a');
  const [P1, setP1] = useState(800);
  const [T1, setT1] = useState(30);
  const [P2, setP2] = useState(101.3);
  const F = fl === 'water' ? water : r134a;
  const p1 = fl === 'water' ? Math.min(P1, 10000) : Math.min(P1, 2500);
  const st1 = F.PT(p1, T1);
  const p2 = Math.min(P2, p1 * 0.95);
  const st2 = F.Ph(p2, st1.h);
  const curve = range(p2, p1, 80)
    .map((p) => ({ x: p, y: F.Ph(p, st1.h).T }))
    .filter((q) => Number.isFinite(q.y));
  const mu = (st2.T - st1.T) / (p2 - p1);
  const xs = st2.x;
  return (
    <SimFrame title="Throttling: constant enthalpy, falling pressure" subtitle="lib Ph(P, h): the J–T effect and the refrigerator's expansion valve">
      <div className="controls">
        <Sel label="fluid" value={fl} options={[{ v: 'r134a', t: 'R-134a' }, { v: 'water', t: 'water' }]} onChange={(v) => { setFl(v); if (v === 'water') { setP1(1000); setT1(300); setP2(800); } else { setP1(800); setT1(30); setP2(101.3); } }} />
        <Slider label="inlet pressure" value={p1} min={fl === 'water' ? 200 : 300} max={fl === 'water' ? 10000 : 2500} step={fl === 'water' ? 100 : 50} onChange={setP1} unit=" kPa" format={(v) => v.toFixed(0)} />
        <Slider label="inlet temperature" value={T1} min={fl === 'water' ? 150 : -10} max={fl === 'water' ? 600 : 90} step={5} onChange={setT1} unit=" °C" format={(v) => v.toFixed(0)} />
        <Slider label="outlet pressure" value={p2} min={fl === 'water' ? 50 : 100} max={p1 * 0.95} step={fl === 'water' ? 25 : 10} onChange={setP2} unit=" kPa" format={(v) => v.toFixed(0)} />
      </div>
      <Plot x={[p2, p1]} y={[Math.min(...curve.map((c) => c.y)) - 5, Math.max(...curve.map((c) => c.y)) + 5]} height={260} xLabel="P (kPa)" yLabel="T along h = const (°C)" series={[{ points: curve, color: 'var(--c1)', width: 2.4 }]} dots={[{ x: p1, y: st1.T, color: 'var(--c2)', label: '1' }, { x: p2, y: st2.T, color: 'var(--c3)', label: '2' }]} legend={false} />
      <Readout
        items={[
          ['inlet phase', st1.phase],
          ['h (unchanged)', `${st1.h.toFixed(1)} kJ/kg`],
          ['outlet T₂', `${st2.T.toFixed(1)} °C`],
          ['outlet state', xs !== undefined ? `mixture, x = ${xs.toFixed(3)}` : st2.phase],
          ['mean μ_JT = ΔT/ΔP', xs !== undefined ? 'n/a (phase change)' : `${(1000 * mu).toFixed(2)} K/MPa`],
        ]}
      />
      <p className="srcnote">Throttling an ideal gas does not change its temperature (h depends on T only: μ_JT = 0). A real gas cools when it expands below the inversion curve (μ_JT positive). A saturated or subcooled liquid throttled below its saturation pressure flashes: part of it boils, drawing the latent heat from the rest and dropping T to T_sat. That is the expansion valve of ch. 11 and the liquefier of LNG plants.</p>
    </SimFrame>
  );
}
