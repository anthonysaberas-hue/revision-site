/** MECH 412 calculators B: root locus, Bode + margins, Nyquist, lead/lag designer. All maths comes from ../lib. */
import { useMemo, useState } from 'react';
import { Plot } from '../../../core/Plot';
import { SimFrame, Slider } from '../../../core/ui';
import { abs, c, fmt as cfmt } from '../lib/complex';
import { errorConstants, leadDesign, lagDesign } from '../lib/design';
import { bode, bodeAsymptotes, margins, nyquistEncirclements, nyquistPoints, freqResponse as freqResponseFn } from '../lib/freq';
import { series, stepResponse, TF } from '../lib/lti';
import { roots, add, scale, trim } from '../lib/poly';
import { asymptotes, breakawayPoints, closedLoopPoles, gainAtZeta, jwCrossings, rootLocusBranches } from '../lib/rootLocus';
import { stepInfo } from '../lib/specs';
import { Chips, Grid2, LogPlot, PolyField, Presets, clampRange, useTF } from './ToolUI';

const closed = (g: TF, K: number): TF => ({ num: scale(g.num, K), den: trim(add(g.den, scale(g.num, K))) });
const dbOf = (K: number) => 20 * Math.log10(K);

/* ------------------------------------------------------------------ root locus */
export function RootLocusTool() {
  const [num, setNum] = useState('1');
  const [den, setDen] = useState('s(s+1)(s+2)');
  const [kdb, setKdb] = useState(-12);
  const [zeta, setZeta] = useState(0.5);
  const { tf, ok } = useTF(num, den);
  const K = Math.pow(10, kdb / 20);
  const info = useMemo(() => {
    if (!ok) return null;
    try {
      const poles = roots(tf.den);
      const zeros = tf.num.length > 1 ? roots(tf.num) : [];
      const jw = jwCrossings(tf.num, tf.den);
      const bk = breakawayPoints(tf.num, tf.den).filter((b) => b.onLocus);
      const asy = asymptotes(tf.num, tf.den);
      const scaleR = Math.max(1, ...poles.map(abs), ...zeros.map(abs));
      const Kmax = Math.max(50 * (jw[0]?.K ?? 1), 20 * scaleR ** Math.max(1, tf.den.length - tf.num.length)) * 2;
      const br = rootLocusBranches(tf.num, tf.den, Kmax, 500);
      const zg = zeta < 1 ? gainAtZeta(tf.num, tf.den, zeta) : [];
      return { poles, zeros, jw, bk, asy, br, scaleR, zg };
    } catch {
      return null;
    }
  }, [num, den, ok, zeta]);
  const cl = info ? closedLoopPoles(tf.num, tf.den, K) : [];
  const resp = useMemo(() => {
    if (!info) return null;
    try {
      const T = closed(tf, K);
      if (T.num.length > T.den.length) return null;
      const rts = roots(T.den);
      const slow = Math.min(...rts.filter((r) => r.re < -1e-9).map((r) => -r.re), Infinity);
      const tEnd = Number.isFinite(slow) ? Math.min(60, 6 / slow) : 10;
      const r = stepResponse(T, tEnd);
      return { r, info: stepInfo(r.t, r.y), stable: rts.every((r) => r.re < 0) };
    } catch {
      return null;
    }
  }, [num, den, kdb, info]);
  const R = info ? info.scaleR * 2 : 5;
  return (
    <SimFrame title="Root locus" subtitle="L20 · HW7 Q5 · HW9">
      <Grid2
        left={
          <>
            <PolyField label="N(s)" value={num} onChange={setNum} />
            <PolyField label="D(s)" value={den} onChange={setDen} hint="open loop K·N/D, unity feedback" />
            <Presets
              items={[
                { name: 'K/[s(s+1)(s+2)]', set: () => (setNum('1'), setDen('s(s+1)(s+2)')) },
                { name: 'tach loop (L20)', set: () => (setNum('s'), setDen('s^3+5s^2+4s+20')) },
                { name: 'HW7 Q5', set: () => (setNum('(s+2)^2'), setDen('s(s^2+3s+3.5)(s+10)(s+20)')) },
                { name: 'F2010 P7', set: () => (setNum('s+3'), setDen('s^2-2s+10')) },
                { name: 'HW9 Q3a', set: () => (setNum('s^2+7s+8.25'), setDen('s^3+6s^2+5s')) },
              ]}
            />
            <Slider label="gain K (dB)" value={kdb} min={-40} max={60} step={0.5} onChange={setKdb} format={(v) => v.toFixed(1)} unit={` dB  (K = ${K.toPrecision(3)})`} />
            <Slider label="damping-ratio ray ζ" value={zeta} min={0.05} max={0.99} step={0.01} onChange={setZeta} />
            {info && (
              <Chips
                items={[
                  ['asymptotes', info.asy.count ? `${info.asy.count} at ${info.asy.anglesDeg.map((a) => a.toFixed(0) + '°').join(', ')}` : 'none'],
                  ['centroid', Number.isFinite(info.asy.centroid) ? info.asy.centroid.toFixed(3) : '—'],
                  ['breakaway/in', info.bk.length ? info.bk.map((b) => `${b.s.re.toFixed(3)} (K=${b.K.toFixed(3)})`).join('; ') : 'none'],
                  ['jω crossing', info.jw.length ? info.jw.map((j) => `ω=${j.w.toFixed(3)}, K=${j.K.toFixed(3)}`).join('; ') : 'none'],
                  ['K at ζ ray', info.zg.length ? info.zg.slice(0, 3).map((z) => `K=${z.K.toFixed(3)} @ ${cfmt(z.s, 3)}`).join('; ') : '—'],
                ]}
              />
            )}
          </>
        }
        right={
          info ? (
            <>
              <Plot
                x={[-R, R * 0.4]}
                y={[-R * 0.7, R * 0.7]}
                height={300}
                xLabel="Re s"
                yLabel="Im s"
                series={info.br.paths.map((p, i) => ({ points: p.map((z) => ({ x: z.re, y: z.im })).filter((q) => Math.abs(q.x) < R * 6 && Math.abs(q.y) < R * 6), color: `var(--c${(i % 5) + 1})` }))}
                vlines={[{ x: 0, color: 'var(--muted)' }]}
                dots={[
                  ...info.poles.map((p) => ({ x: p.re, y: p.im, color: 'var(--text)', label: '×' })),
                  ...info.zeros.map((p) => ({ x: p.re, y: p.im, color: 'var(--text)', label: '○' })),
                  ...cl.map((p) => ({ x: p.re, y: p.im, color: 'var(--c3)', r: 5 })),
                ]}
              />
              <Chips items={[['closed-loop poles', cl.map((p) => cfmt(p, 3)).join(',  ')], ['stable', cl.every((p) => p.re < 0) ? 'yes' : 'NO']]} />
              {resp && (
                <>
                  <Plot x={[0, resp.r.t[resp.r.t.length - 1]]} y={clampRange(Math.min(0, ...resp.r.y), Math.max(1, ...resp.r.y))} height={190} xLabel="t (s)" yLabel="step response" series={[{ points: resp.r.t.map((t, i) => ({ x: t, y: resp.r.y[i] })), color: 'var(--c1)' }]} hlines={[{ y: 1, dash: true, color: 'var(--muted)' }]} />
                  {resp.stable && <Chips items={[['OS', `${resp.info.overshoot.toFixed(1)} %`], ['t_s (2 %)', `${resp.info.settling2.toFixed(2)} s`], ['final value', resp.info.finalValue.toFixed(3)]]} />}
                </>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Enter a proper open-loop transfer function.</p>
          )
        }
      />
    </SimFrame>
  );
}

/* ------------------------------------------------------------------ Bode */
export function BodeTool() {
  const [num, setNum] = useState('40');
  const [den, setDen] = useState('s(s+2)');
  const [kdb, setKdb] = useState(0);
  const [asy, setAsy] = useState(true);
  const { tf: g0, ok } = useTF(num, den);
  const K = Math.pow(10, kdb / 20);
  const g: TF = { num: scale(g0.num, K), den: g0.den };
  const data = useMemo(() => (ok ? bode(g) : null), [num, den, kdb, ok]);
  const m = useMemo(() => (ok ? margins(g) : null), [num, den, kdb, ok]);
  const ec = ok ? errorConstants(g) : null;
  const asyD = useMemo(() => {
    try {
      return ok ? bodeAsymptotes(g) : null;
    } catch {
      return null;
    }
  }, [num, den, kdb, ok]);
  const cl = ok ? roots(trim(add(g.den, g.num))) : [];
  return (
    <SimFrame title="Bode plot with margins" subtitle="L21 · HW8-2024 Q2 · HW10 Q4 · F2009 P6">
      <Grid2
        left={
          <>
            <PolyField label="N(s)" value={num} onChange={setNum} />
            <PolyField label="D(s)" value={den} onChange={setDen} hint="open loop L(s) = K N/D" />
            <Presets
              items={[
                { name: 'HW8 Q2', set: () => (setNum('10(0.4s+1)'), setDen('s(2s+1)(0.04s^2+0.24s+1)')) },
                { name: 'K/[s(s+1)(s+5)]', set: () => (setNum('1'), setDen('s(s+1)(s+5)')) },
                { name: 'Ogata 11-7', set: () => (setNum('5'), setDen('s(s+1)(0.5s+1)')) },
                { name: 'F2009 P6', set: () => (setNum('0.1s+0.1'), setDen('s^4+4s^3+3s^2+0.75s')) },
              ]}
            />
            <Slider label="extra gain K (dB)" value={kdb} min={-40} max={60} step={0.5} onChange={setKdb} format={(v) => v.toFixed(1)} unit=" dB" />
            <label style={{ fontSize: '.85rem' }}>
              <input type="checkbox" checked={asy} onChange={(e) => setAsy(e.target.checked)} /> show straight-line asymptotes
            </label>
            {m && (
              <Chips
                items={[
                  ['GM', Number.isFinite(m.gm) ? `${m.gm.toFixed(2)} dB at ${m.wpc.toFixed(3)} rad/s` : '∞'],
                  ['PM', Number.isFinite(m.pm) ? `${m.pm.toFixed(1)}° at ${m.wgc.toFixed(3)} rad/s` : '∞'],
                  ['closed loop', cl.every((p) => p.re < 0) ? 'stable' : 'UNSTABLE'],
                  ['type', ec ? String(ec.type) : '—'],
                  ['K_v', ec && ec.type === 1 ? ec.Kv.toPrecision(4) : ec && ec.type > 1 ? '∞' : '0'],
                  ['K_p', ec && ec.type === 0 ? ec.Kp.toPrecision(4) : ec && ec.type > 0 ? '∞' : '—'],
                ]}
              />
            )}
          </>
        }
        right={
          data && m ? (
            <>
              <LogPlot
                yLabel="|L| (dB)"
                y={clampRange(Math.min(...data.magDb), Math.max(...data.magDb))}
                series={[
                  { w: data.w, v: data.magDb, label: 'exact', color: 'var(--c1)' },
                  ...(asy && asyD ? [{ w: data.w, v: data.w.map((w) => asyD.magDb(w)), label: 'asymptotes', color: 'var(--c4)', dash: true }] : []),
                ]}
                hlines={[{ y: 0 }]}
                vlines={Number.isFinite(m.wgc) ? [{ w: m.wgc, label: 'ω_gc' }] : []}
              />
              <LogPlot
                yLabel="phase (°)"
                y={clampRange(Math.min(-200, ...data.phaseDeg), Math.max(10, ...data.phaseDeg))}
                series={[{ w: data.w, v: data.phaseDeg, color: 'var(--c2)' }]}
                hlines={[{ y: -180, label: '−180°' }]}
                vlines={Number.isFinite(m.wpc) ? [{ w: m.wpc, label: 'ω_pc' }] : []}
              />
            </>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Enter a transfer function.</p>
          )
        }
      />
    </SimFrame>
  );
}

/* ------------------------------------------------------------------ Nyquist */
export function NyquistTool() {
  const [num, setNum] = useState('1');
  const [den, setDen] = useState('s(s^2+s+6)');
  const [kdb, setKdb] = useState(0);
  const { tf: g0, ok } = useTF(num, den);
  const K = Math.pow(10, kdb / 20);
  const g: TF = { num: scale(g0.num, K), den: g0.den };
  const pts = useMemo(() => (ok ? nyquistPoints(g, undefined, undefined, 1500) : []), [num, den, kdb, ok]);
  const nq = useMemo(() => {
    if (!ok) return null;
    try {
      return nyquistEncirclements(g);
    } catch {
      return null;
    }
  }, [num, den, kdb, ok]);
  const m = ok ? margins(g) : null;
  const L = 3;
  const seg = (sign: 1 | -1) => {
    const out: { x: number; y: number }[][] = [];
    let cur: { x: number; y: number }[] = [];
    for (const p of pts) {
      const q = { x: p.re, y: sign * p.im };
      if (Math.abs(q.x) <= L * 2 && Math.abs(q.y) <= L * 2) cur.push(q);
      else if (cur.length) (out.push(cur), (cur = []));
    }
    if (cur.length) out.push(cur);
    return out;
  };
  const kcr = m && Number.isFinite(m.gm) ? K * Math.pow(10, m.gm / 20) : NaN;
  return (
    <SimFrame title="Nyquist plot" subtitle="L23 · HW8-2024 Q3 · HW10 Q5">
      <Grid2
        left={
          <>
            <PolyField label="N(s)" value={num} onChange={setNum} />
            <PolyField label="D(s)" value={den} onChange={setDen} hint="open loop L(s) = K N/D" />
            <Presets
              items={[
                { name: 'K/[s(s²+s+6)]', set: () => (setNum('1'), setDen('s(s^2+s+6)')) },
                { name: 'K(s+1)/[s²(s²+6)]', set: () => (setNum('s+1'), setDen('s^2(s^2+6)')) },
                { name: 'K/[s(s−1)]', set: () => (setNum('1'), setDen('s(s-1)')) },
                { name: 'K/[(s+1)(s+2)(s+3)]', set: () => (setNum('1'), setDen('(s+1)(s+2)(s+3)')) },
              ]}
            />
            <Slider label="gain K (dB)" value={kdb} min={-40} max={60} step={0.5} onChange={setKdb} format={(v) => v.toFixed(1)} unit={` dB (K=${K.toPrecision(3)})`} />
            <Chips
              items={[
                ['P (RHP open-loop poles)', nq ? String(nq.P) : '—'],
                ['N (clockwise encirclements of −1)', nq ? String(nq.N) : '—'],
                ['Z = N + P', nq ? String(nq.Z) : '—'],
                ['closed loop', nq ? (nq.stable ? 'stable' : 'UNSTABLE') : '—'],
                ['critical gain', Number.isFinite(kcr) ? `K_cr ≈ ${kcr.toPrecision(4)}` : '—'],
              ]}
            />
          </>
        }
        right={
          ok ? (
            <Plot
              x={[-L * 1.2, L * 0.8]}
              y={[-L, L]}
              height={340}
              xLabel="Re L(jω)"
              yLabel="Im L(jω)"
              series={[...seg(1).map((s) => ({ points: s, color: 'var(--c1)' })), ...seg(-1).map((s) => ({ points: s, color: 'var(--c1)', dash: true }))]}
              hlines={[{ y: 0, color: 'var(--muted)' }]}
              vlines={[{ x: 0, color: 'var(--muted)' }]}
              dots={[{ x: -1, y: 0, color: 'var(--c3)', label: '−1', r: 5 }]}
            >
              {(sx, sy) => <circle cx={sx(0)} cy={sy(0)} r={Math.abs(sx(1) - sx(0))} fill="none" stroke="var(--c4)" strokeDasharray="4 3" />}
            </Plot>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Enter a transfer function.</p>
          )
        }
      />
    </SimFrame>
  );
}

/* ------------------------------------------------------------------ lead / lag designer */
export function LeadLagTool() {
  const [num, setNum] = useState('40');
  const [den, setDen] = useState('s(s+2)');
  const [Kv, setKv] = useState(20);
  const [pm, setPm] = useState(50);
  const [safety, setSafety] = useState(5);
  const { tf: plant, ok } = useTF(num, den);
  const out = useMemo(() => {
    if (!ok) return null;
    const ec = errorConstants(plant);
    if (ec.type !== 1) return { err: 'The Bode procedure here needs a type-1 plant (one integrator) so that K_v is meaningful.' };
    const res: any = {};
    try {
      res.lead = leadDesign(plant, { Kv, pmTarget: pm, safetyDeg: safety });
    } catch (e) {
      res.leadErr = (e as Error).message;
    }
    try {
      res.lag = lagDesign(plant, { Kv, pmTarget: pm, safetyDeg: safety });
    } catch (e) {
      res.lagErr = (e as Error).message;
    }
    const K = Kv / ec.Kv;
    res.K = K;
    res.plantK = series({ num: [K], den: [1] }, plant);
    return res;
  }, [num, den, Kv, pm, safety, ok]);
  const loops: { name: string; g: TF; color: string }[] = [];
  if (out && !out.err) {
    loops.push({ name: 'K·G (gain only)', g: out.plantK, color: 'var(--c4)' });
    if (out.lead) loops.push({ name: 'lead', g: series(out.lead.Gc, plant), color: 'var(--c1)' });
    if (out.lag) loops.push({ name: 'lag', g: series(out.lag.Gc, plant), color: 'var(--c2)' });
  }
  const bd = loops.map((l) => ({ ...l, d: bode(l.g, 1e-2, 1e3, 400) }));
  const steps = loops.map((l) => {
    try {
      const T = closed(l.g, 1);
      return { ...l, r: stepResponse(T, 8) };
    } catch {
      return null;
    }
  });
  const fmtG = (Gc: TF) => `(${Gc.num.map((v) => Number(v.toPrecision(4))).join(' s + ').replace(/ s \+ (?=[^s]*$)/, ' s + ')}) / (${Gc.den.map((v) => Number(v.toPrecision(4))).join(' s + ')})`;
  void fmtG;
  return (
    <SimFrame title="Lead / lag designer (Bode procedure)" subtitle="L22 · HW8-2024 Q1 · HW10 Q2–Q3">
      <Grid2
        left={
          <>
            <PolyField label="plant N(s)" value={num} onChange={setNum} />
            <PolyField label="plant D(s)" value={den} onChange={setDen} />
            <Presets
              items={[
                { name: 'Ogata 11-6 (lead)', set: () => (setNum('4'), setDen('s(s+2)'), setKv(20), setPm(50)) },
                { name: 'HW8-2024 Q1', set: () => (setNum('40'), setDen('s(s+2)'), setKv(20), setPm(30)) },
                { name: 'Ogata 11-7 (lag)', set: () => (setNum('1'), setDen('s(s+1)(0.5s+1)'), setKv(5), setPm(40)) },
              ]}
            />
            <Slider label="required velocity constant K_v" value={Kv} min={1} max={200} step={1} onChange={setKv} unit=" s⁻¹" />
            <Slider label="required phase margin" value={pm} min={20} max={80} step={1} onChange={setPm} unit="°" />
            <Slider label="safety allowance" value={safety} min={0} max={15} step={1} onChange={setSafety} unit="°" />
            {out?.err && <p style={{ color: 'var(--c3)' }}>{out.err}</p>}
            {out && !out.err && (
              <>
                <Chips items={[['gain for K_v', `K = ${out.K.toPrecision(4)}`], ['PM with gain only', out.lead ? `${out.lead.pmUncompensated.toFixed(1)}°` : out.lag ? `${out.lag.pmUncompensated.toFixed(1)}°` : '—']]} />
                {out.lead ? (
                  <Chips
                    items={[
                      ['LEAD φ_m', `${out.lead.phiMaxDeg.toFixed(1)}°`],
                      ['α', out.lead.alpha.toFixed(4)],
                      ['ω_m', out.lead.wm.toFixed(3)],
                      ['zero, pole', `${out.lead.zero.toFixed(3)}, ${out.lead.pole.toFixed(3)}`],
                      ['G_c', `${out.lead.Kc.toFixed(3)}(s + ${(-out.lead.zero).toFixed(3)})/(s + ${(-out.lead.pole).toFixed(3)})`],
                      ['achieved', `PM ${out.lead.achieved.pm.toFixed(1)}° at ${out.lead.achieved.wgc.toFixed(2)} rad/s, GM ${Number.isFinite(out.lead.achieved.gm) ? out.lead.achieved.gm.toFixed(1) + ' dB' : '∞'}`],
                    ]}
                  />
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Lead: {out.leadErr}</p>
                )}
                {out.lag ? (
                  <Chips
                    items={[
                      ['LAG β', out.lag.beta.toFixed(3)],
                      ['new crossover', `${out.lag.wc.toFixed(3)} rad/s`],
                      ['zero, pole', `${out.lag.zero.toFixed(4)}, ${out.lag.pole.toFixed(4)}`],
                      ['achieved', `PM ${out.lag.achieved.pm.toFixed(1)}° at ${out.lag.achieved.wgc.toFixed(2)} rad/s, GM ${Number.isFinite(out.lag.achieved.gm) ? out.lag.achieved.gm.toFixed(1) + ' dB' : '∞'}`],
                    ]}
                  />
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Lag: {out.lagErr}</p>
                )}
              </>
            )}
          </>
        }
        right={
          bd.length ? (
            <>
              <LogPlot yLabel="|L| (dB)" y={clampRange(-60, 60)} series={bd.map((b) => ({ w: b.d.w, v: b.d.magDb, color: b.color, label: b.name }))} hlines={[{ y: 0 }]} />
              <LogPlot yLabel="phase (°)" y={clampRange(-270, 0)} series={bd.map((b) => ({ w: b.d.w, v: b.d.phaseDeg, color: b.color }))} hlines={[{ y: -180 }]} />
              <Plot x={[0, 8]} y={[0, 1.8]} height={190} xLabel="t (s)" yLabel="closed-loop step" series={steps.filter(Boolean).map((s) => ({ points: s!.r.t.map((t, i) => ({ x: t, y: s!.r.y[i] })), color: s!.color, label: s!.name }))} hlines={[{ y: 1, dash: true, color: 'var(--muted)' }]} legend />
            </>
          ) : null
        }
      />
    </SimFrame>
  );
}
void c;

/* ------------------------------------------------------------------ sensitivity */
export function SensitivitySim() {
  const [num, setNum] = useState('1');
  const [den, setDen] = useState('s(0.1s+1)');
  const [kdb, setKdb] = useState(30);
  const { tf: g0, ok } = useTF(num, den);
  const K = Math.pow(10, kdb / 20);
  const L: TF = { num: scale(g0.num, K), den: g0.den };
  const w: number[] = Array.from({ length: 300 }, (_, i) => Math.pow(10, -2 + (5 * i) / 299));
  const mags = ok
    ? w.map((x) => {
        const l = freqResponseFn(L, x);
        const s = 1 / Math.hypot(1 + l.re, l.im);
        const t = Math.hypot(l.re, l.im) * s;
        return { S: 20 * Math.log10(s), T: 20 * Math.log10(t), L: 20 * Math.log10(Math.hypot(l.re, l.im)) };
      })
    : [];
  return (
    <SimFrame title="Sensitivity S = 1/(1+L) versus frequency" subtitle="L16 · MT2 W2012 Q3 · W2019 Q3 · W2011 Q2">
      <Grid2
        left={
          <>
            <PolyField label="plant N(s)" value={num} onChange={setNum} />
            <PolyField label="plant D(s)" value={den} onChange={setDen} hint="loop L = K·N/D, unity feedback" />
            <Slider label="loop gain K" value={kdb} min={-20} max={60} step={1} onChange={setKdb} unit=" dB" />
            <Chips items={[['reading', 'where |L| ≫ 1: S ≈ 1/L, small (feedback helps)'], ['and where |L| ≪ 1', 'S ≈ 1 (feedback does nothing)']]} />
          </>
        }
        right={ok ? <LogPlot yLabel="dB" y={[-80, 30]} series={[{ w, v: mags.map((m) => m.S), label: '|S| = |1/(1+L)|', color: 'var(--c1)' }, { w, v: mags.map((m) => m.T), label: '|T| = |L/(1+L)|', color: 'var(--c2)' }, { w, v: mags.map((m) => m.L), label: '|L|', color: 'var(--c4)', dash: true }]} hlines={[{ y: 0 }]} /> : <p>Enter a plant.</p>}
      />
    </SimFrame>
  );
}
