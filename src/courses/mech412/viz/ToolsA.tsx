/** MECH 412 calculators A: partial fractions, 2nd-order specs, Routh, state space. All maths comes from ../lib. */
import { useMemo, useState } from 'react';
import { Plot } from '../../../core/Plot';
import { SimFrame, Slider } from '../../../core/ui';
import { fmt as cfmt, c } from '../lib/complex';
import { inverseLaplace, stepExpr } from '../lib/pfe';
import { stepResponse, tf as mkTF } from '../lib/lti';
import { routhArray, stableKRange } from '../lib/routh';
import { designFromSpecs, specsFromWnZeta, stepInfo } from '../lib/specs';
import { roots, add, scale, trim, mul as mulPoly } from '../lib/poly';
import { eigenvalues, method1, method2, phiTimeTerms, ss2tf, expm, Mat } from '../lib/stateSpace';
import { polyToString } from '../lib/parse';
import { Chips, Grid2, PolyField, Presets, safePoly, useTF } from './ToolUI';

/* ------------------------------------------------------------------ partial fractions */
export function PfeTool() {
  const [num, setNum] = useState('3s^2+2s+2');
  const [den, setDen] = useState('(s+2)(s^2+2s+5)');
  const [mode, setMode] = useState<'F' | 'step'>('F');
  const { tf, ok } = useTF(num, den);
  const res = useMemo(() => {
    if (!ok) return null;
    try {
      return mode === 'F' ? inverseLaplace(tf.num, tf.den) : stepExpr(tf.num, tf.den);
    } catch {
      return null;
    }
  }, [num, den, mode, ok]);
  const pts = useMemo(() => {
    if (!res) return [];
    const rts = roots(mode === 'F' ? tf.den : [...tf.den, 0]);
    const slow = Math.min(...rts.filter((r) => r.re < -1e-9).map((r) => -r.re), Infinity);
    const T = Number.isFinite(slow) ? Math.min(60, 6 / slow) : 10;
    return Array.from({ length: 300 }, (_, i) => ({ x: (T * i) / 299, y: res.f((T * i) / 299) }));
  }, [res]);
  const ys = pts.map((p) => p.y);
  return (
    <SimFrame title="Partial fractions and inverse Laplace" subtitle="L02 · T01 · HW1">
      <Grid2
        left={
          <>
            <PolyField label="numerator N(s)" value={num} onChange={setNum} hint="e.g. 3s^2+2s+2" />
            <PolyField label="denominator D(s)" value={den} onChange={setDen} hint="e.g. (s+2)(s^2+2s+5)" />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`btn ${mode === 'F' ? 'primary' : ''}`} onClick={() => setMode('F')}>
                f(t) = ℒ⁻¹ N/D
              </button>
              <button className={`btn ${mode === 'step' ? 'primary' : ''}`} onClick={() => setMode('step')}>
                step response
              </button>
            </div>
            <Presets
              items={[
                { name: 'MT1 W2009 Q2', set: () => (setNum('3s^2+2s+2'), setDen('(s+2)(s^2+2s+5)')) },
                { name: 'MT1 F2007 Q1', set: () => (setNum('1'), setDen('s^3(s+1)')) },
                { name: 'F2011 Q1', set: () => (setNum('s+3'), setDen('s^2+s+3')) },
                { name: '3rd order T01', set: () => (setNum('1'), setDen('s(s+2)(s+3)(s+4)')) },
              ]}
            />
          </>
        }
        right={
          res ? (
            <>
              <Chips items={res.pfe.terms.map((t, i) => [`pole ${cfmt(t.pole, 4)}${t.order > 1 ? ` (order ${t.order})` : ''}`, `residue ${cfmt(t.residue, 4)}`] as [string, string])} />
              <div style={{ margin: '6px 0' }}>
                <b>f(t) = </b>
                <code>{res.text}</code>
              </div>
              <Plot x={[0, pts.length ? pts[pts.length - 1].x : 1]} y={[Math.min(0, ...ys) - 0.1, Math.max(0.1, ...ys) * 1.1]} series={[{ points: pts, color: 'var(--c1)' }]} height={230} xLabel="t (s)" yLabel="f(t)" />
            </>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Enter a proper rational function.</p>
          )
        }
      />
    </SimFrame>
  );
}

/* ------------------------------------------------------------------ second-order specs */
export function SecondOrderTool() {
  const [wn, setWn] = useState(5);
  const [zeta, setZeta] = useState(0.4);
  const [osMax, setOs] = useState(20);
  const [tsMax, setTs] = useState(1);
  const sp = specsFromWnZeta(wn, zeta);
  const des = designFromSpecs(osMax, tsMax);
  const resp = useMemo(() => stepResponse(mkTF([wn * wn], [1, 2 * zeta * wn, wn * wn]), Math.min(40, 8 / (zeta * wn))), [wn, zeta]);
  const info = stepInfo(resp.t, resp.y, 1);
  return (
    <SimFrame title="2nd-order specifications" subtitle="L04 · HW2 Q1 · MT1 F2011 Q4">
      <Grid2
        left={
          <>
            <Slider label="natural frequency ω_n" value={wn} min={0.2} max={20} step={0.1} onChange={setWn} unit=" rad/s" />
            <Slider label="damping ratio ζ" value={zeta} min={0.05} max={1.6} step={0.01} onChange={setZeta} />
            <Chips
              items={[
                ['OS', `${sp.os.toFixed(1)} %`],
                ['t_r = (π−β)/ω_d', `${sp.tr.toFixed(3)} s`],
                ['t_p = π/ω_d', zeta < 1 ? `${sp.tp.toFixed(3)} s` : '—'],
                ['t_s (2 %)', `${sp.ts2.toFixed(3)} s`],
                ['t_s (5 %)', `${sp.ts5.toFixed(3)} s`],
                ['poles', zeta < 1 ? `−${(zeta * wn).toFixed(2)} ± j${sp.wd.toFixed(2)}` : 'real'],
                ['β = cos⁻¹ ζ', `${sp.betaDeg.toFixed(1)}°`],
              ]}
            />
            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '12px 0' }} />
            <b>Design direction</b>
            <Slider label="max overshoot" value={osMax} min={1} max={60} step={1} onChange={setOs} unit=" %" />
            <Slider label="max 2 % settling time" value={tsMax} min={0.2} max={10} step={0.1} onChange={setTs} unit=" s" />
            <Chips items={[['ζ ≥', des.zeta.toFixed(3)], ['σ = ζω_n ≥', des.sigma.toFixed(2)], ['pole angle ≤', `${des.betaDeg.toFixed(1)}°`], ['ω_n ≥', des.wnMin.toFixed(2)]]} />
          </>
        }
        right={
          <>
            <Plot x={[0, resp.t[resp.t.length - 1]]} y={[0, Math.max(1.2, 1 + info.overshoot / 100 + 0.1)]} series={[{ points: resp.t.map((t, i) => ({ x: t, y: resp.y[i] })), color: 'var(--c1)' }]} hlines={[{ y: 1, dash: true, color: 'var(--muted)' }, { y: 1.02, dash: true, color: 'var(--c4)' }, { y: 0.98, dash: true, color: 'var(--c4)' }]} height={240} xLabel="t (s)" yLabel="y(t)" />
            <PoleMap poles={[c(-zeta * wn, sp.wd), c(-zeta * wn, -sp.wd)]} betaDeg={zeta < 1 ? sp.betaDeg : undefined} wn={wn} />
          </>
        }
      />
    </SimFrame>
  );
}

function PoleMap({ poles, zeros = [], betaDeg, wn }: { poles: { re: number; im: number }[]; zeros?: { re: number; im: number }[]; betaDeg?: number; wn?: number }) {
  const all = [...poles, ...zeros];
  const R = Math.max(1, ...all.map((p) => Math.hypot(p.re, p.im))) * 1.3;
  const lim = R;
  return (
    <Plot x={[-lim, lim * 0.3]} y={[-lim * 0.65, lim * 0.65]} height={210} xLabel="Re s" yLabel="Im s" series={[{ points: [{ x: -lim, y: 0 }, { x: lim * 0.3, y: 0 }], color: 'var(--border)' }]} vlines={[{ x: 0, color: 'var(--muted)' }]}
      dots={poles.map((p) => ({ x: p.re, y: p.im, color: 'var(--c3)', label: '×' })).concat(zeros.map((z) => ({ x: z.re, y: z.im, color: 'var(--c2)', label: '○' })))}>
      {(sx, sy) => (
        <g>
          {betaDeg !== undefined && wn !== undefined && (
            <>
              <line x1={sx(0)} y1={sy(0)} x2={sx(-wn * Math.cos((betaDeg * Math.PI) / 180) * 1.0 * (lim / wn) * 0.6)} y2={sy(wn * Math.sin((betaDeg * Math.PI) / 180) * (lim / wn) * 0.6)} stroke="var(--c4)" strokeDasharray="4 3" />
              <line x1={sx(0)} y1={sy(0)} x2={sx(-wn * Math.cos((betaDeg * Math.PI) / 180) * (lim / wn) * 0.6)} y2={sy(-wn * Math.sin((betaDeg * Math.PI) / 180) * (lim / wn) * 0.6)} stroke="var(--c4)" strokeDasharray="4 3" />
            </>
          )}
        </g>
      )}
    </Plot>
  );
}

/* ------------------------------------------------------------------ Routh */
export function RouthTool() {
  const [mode, setMode] = useState<'poly' | 'K'>('poly');
  const [p, setP] = useState('s^4+2s^3+7s^2-2s+8');
  const [n, setN] = useState('1');
  const [d, setD] = useState('s(s+1)(s+2)');
  const poly = mode === 'poly' ? safePoly(p) : null;
  const res = poly && poly.length > 1 ? routhArray(poly) : null;
  const gain = useMemo(() => {
    if (mode !== 'K') return null;
    const nu = safePoly(n);
    const de = safePoly(d);
    const cp = (K: number) => trim(add(de, scale(nu, K)));
    const r = stableKRange(cp, 0, 1000);
    return { r, cp };
  }, [mode, n, d]);
  const showPoly = mode === 'poly' ? poly : null;
  const rts = showPoly ? roots(showPoly) : [];
  return (
    <SimFrame title="Routh–Hurwitz" subtitle="L17–L18 · HW7 Q1–Q2">
      <Grid2
        left={
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <button className={`btn ${mode === 'poly' ? 'primary' : ''}`} onClick={() => setMode('poly')}>
                a polynomial
              </button>
              <button className={`btn ${mode === 'K' ? 'primary' : ''}`} onClick={() => setMode('K')}>
                range of K for 1 + K N/D
              </button>
            </div>
            {mode === 'poly' ? (
              <>
                <PolyField label="characteristic polynomial" value={p} onChange={setP} />
                <Presets
                  items={[
                    { name: 'HW7 Q1a', set: () => setP('s^4+8s^3+32s^2+80s+100') },
                    { name: 'HW7 Q1b', set: () => setP('s^4+2s^3+7s^2-2s+8') },
                    { name: 's³+2s²+s+2 (zero row)', set: () => setP('s^3+2s^2+s+2') },
                    { name: 's⁵ special', set: () => setP('s^5+2s^4+24s^3+48s^2-25s-50') },
                  ]}
                />
              </>
            ) : (
              <>
                <PolyField label="N(s)" value={n} onChange={setN} />
                <PolyField label="D(s)" value={d} onChange={setD} hint="open loop G = N/D, gain K in the loop" />
                <Presets
                  items={[
                    { name: 'K/[s(s+1)(s+2)]', set: () => (setN('1'), setD('s(s+1)(s+2)')) },
                    { name: 'HW7 Q2', set: () => (setN('1'), setD('s^5+5s^4+10s^3+10s^2+5s')) },
                    { name: 'K/[s(s+1)(s+5)]', set: () => (setN('1'), setD('s(s+1)(s+5)')) },
                  ]}
                />
              </>
            )}
          </>
        }
        right={
          mode === 'poly' && res ? (
            <>
              <Chips items={[['sign changes = RHP roots', String(res.rhpRoots)], ['special case', res.special ? 'yes' : 'no'], ['verdict', res.stable ? 'stable' : res.imagRoots ? 'marginal / unstable' : 'unstable']]} />
              <table style={{ borderCollapse: 'collapse', margin: '6px 0', fontFamily: 'ui-monospace, monospace', fontSize: '.85rem' }}>
                <tbody>
                  {res.rows.map((row, i) => (
                    <tr key={i}>
                      <td style={{ padding: '2px 8px', color: 'var(--muted)' }}>s^{res.powers[i]}</td>
                      {row.map((v, j) => (
                        <td key={j} style={{ padding: '2px 10px', textAlign: 'right', background: j === 0 ? 'var(--surface-2)' : undefined, color: j === 0 && v < 0 ? 'var(--c3)' : undefined }}>
                          {Number(v.toPrecision(5))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: '.85rem' }}>
                roots: {rts.map((r) => cfmt(r, 4)).join(',  ')}
              </div>
            </>
          ) : mode === 'K' && gain ? (
            <>
              <Chips items={[['stable for K in', gain.r.intervals.length ? gain.r.intervals.map(([a, b]) => `(${a.toFixed(3)}, ${b.toFixed(3)})`).join(' ∪ ') : 'no K > 0']]} />
              {gain.r.intervals.length > 0 && (
                <div style={{ fontSize: '.85rem' }}>
                  at K = {gain.r.intervals[0][1].toFixed(4)} the characteristic polynomial is {polyToString(gain.cp(gain.r.intervals[0][1]))}; roots: {roots(gain.cp(gain.r.intervals[0][1])).map((r) => cfmt(r, 4)).join(', ')}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Enter a polynomial.</p>
          )
        }
      />
    </SimFrame>
  );
}

/* ------------------------------------------------------------------ state space */
const parseMat = (s: string): Mat => s.trim().split(/\n|;/).map((r) => r.trim()).filter(Boolean).map((r) => r.split(/[\s,]+/).map(Number));

export function StateSpaceTool() {
  const [A, setA] = useState('0 1\n-3 -1');
  const [B, setB] = useState('0\n1');
  const [C, setC] = useState('1 0');
  const [t, setT] = useState(1);
  let model: { A: Mat; B: Mat; C: Mat; D: Mat } | null = null;
  try {
    const a = parseMat(A);
    const b = parseMat(B);
    const cc = parseMat(C);
    if (a.length && a.every((r) => r.length === a.length && r.every(Number.isFinite)) && b.length === a.length && cc[0].length === a.length) model = { A: a, B: b, C: cc, D: [[0]] };
  } catch {
    model = null;
  }
  const [num, setNum] = useState('10s+100');
  const [den, setDen] = useState('s^3+10s^2+100s+600');
  const nn = safePoly(num);
  const dd = safePoly(den);
  let m1: ReturnType<typeof method1> | null = null;
  let m2 = null as ReturnType<typeof method2> | null;
  try {
    m1 = method1(nn, dd);
    m2 = method2(nn, dd);
  } catch {
    m1 = null;
  }
  const mat = (M: number[][]) => '[' + M.map((r) => r.map((v) => Number(v.toPrecision(4))).join(' ')).join('; ') + ']';
  let phi: string[][] | null = null;
  let tf: { num: number[]; den: number[] } | null = null;
  try {
    if (model) {
      tf = ss2tf(model);
      phi = phiTimeTerms(model.A).text;
    }
  } catch {
    phi = null;
  }
  const Phi = model ? expm(model.A, t) : null;
  return (
    <SimFrame title="State space" subtitle="L08 · HW4 · T04 · MT1 W2009 Q3">
      <Grid2
        left={
          <>
            <b>Given A, B, C</b>
            <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--muted)' }}>A (rows on new lines)</label>
            <textarea value={A} onChange={(e) => setA(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'ui-monospace, monospace', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
            <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--muted)' }}>B (column)</label>
            <textarea value={B} onChange={(e) => setB(e.target.value)} rows={2} style={{ width: '100%', fontFamily: 'ui-monospace, monospace', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
            <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--muted)' }}>C (row)</label>
            <input value={C} onChange={(e) => setC(e.target.value)} style={{ width: '100%', fontFamily: 'ui-monospace, monospace', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 6 }} />
            <Slider label="evaluate Φ(t) at t" value={t} min={0} max={5} step={0.05} onChange={setT} unit=" s" />
            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '12px 0' }} />
            <b>Given G(s) = N/D → state space</b>
            <PolyField label="N(s)" value={num} onChange={setNum} />
            <PolyField label="D(s)" value={den} onChange={setDen} />
          </>
        }
        right={
          <>
            {model && tf ? (
              <>
                <Chips items={[['eigenvalues', eigenvalues(model.A).map((e) => cfmt(e, 4)).join(', ')], ['G(s)', `(${polyToString(tf.num)}) / (${polyToString(tf.den)})`]]} />
                {phi && (
                  <div style={{ fontSize: '.85rem', margin: '6px 0' }}>
                    <b>Φ(t) = ℒ⁻¹[(sI−A)⁻¹]</b>
                    {phi.map((row, i) => (
                      <div key={i} style={{ fontFamily: 'ui-monospace, monospace' }}>
                        {row.map((cell, j) => (
                          <div key={j}>
                            Φ{i + 1}
                            {j + 1}(t) = {cell || '0'}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {Phi && <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.85rem' }}>Φ({t}) = {mat(Phi)}</div>}
              </>
            ) : (
              <p style={{ color: 'var(--muted)' }}>A must be square (repeated eigenvalues use e^(At) only).</p>
            )}
            {m1 && m2 && (
              <div style={{ marginTop: 10, fontSize: '.85rem' }}>
                <b>Method 1 (β recursion, handout 1):</b> β = [{m1.beta.map((v) => Number(v.toPrecision(4))).join(', ')}]
                <div style={{ fontFamily: 'ui-monospace, monospace' }}>
                  A = {mat(m1.ss.A)}
                  <br />B = {mat(m1.ss.B)}
                  <br />C = {mat(m1.ss.C)}, D = {mat(m1.ss.D)}
                </div>
                <b>Method 2 (companion, keeps u′ out of the states):</b>
                <div style={{ fontFamily: 'ui-monospace, monospace' }}>
                  A = {mat(m2.A)}
                  <br />B = {mat(m2.B)}
                  <br />C = {mat(m2.C)}, D = {mat(m2.D)}
                </div>
              </div>
            )}
          </>
        }
      />
    </SimFrame>
  );
}

/* ------------------------------------------------------------------ effect of an extra pole or zero */
export function PoleZeroSim() {
  const [zeta, setZeta] = useState(0.485);
  const [wn, setWn] = useState(4.123);
  const [p, setP] = useState(4);
  const [z, setZ] = useState(4);
  const base = mkTF([wn * wn], [1, 2 * zeta * wn, wn * wn]);
  const withPole = mkTF([wn * wn * p], mulPoly([1, p], [1, 2 * zeta * wn, wn * wn]));
  const withZero = mkTF([wn * wn / z, wn * wn], [1, 2 * zeta * wn, wn * wn]);
  const T = Math.min(30, 7 / (zeta * wn));
  const data = [
    { name: 'plain 2nd order', g: base, color: 'var(--c1)' },
    { name: `+ real pole at −${p}`, g: withPole, color: 'var(--c2)' },
    { name: `+ zero at −${z}`, g: withZero, color: 'var(--c3)' },
  ].map((d) => {
    const r = stepResponse(d.g, T);
    return { ...d, r, info: stepInfo(r.t, r.y, 1) };
  });
  return (
    <SimFrame title="What an extra pole or zero does" subtitle="L04 · MT1 F2011 Q4 · HW10 Q1 — all three have the same dominant poles and DC gain">
      <Grid2
        left={
          <>
            <Slider label="ζ of the dominant pair" value={zeta} min={0.1} max={1} step={0.01} onChange={setZeta} />
            <Slider label="ω_n" value={wn} min={1} max={10} step={0.1} onChange={setWn} unit=" rad/s" />
            <Slider label="extra pole at −p" value={p} min={0.5} max={30} step={0.5} onChange={setP} />
            <Slider label="extra zero at −z" value={z} min={0.5} max={30} step={0.5} onChange={setZ} />
            <Chips items={data.map((d) => [d.name, `OS ${d.info.overshoot.toFixed(1)} %, t_s ${d.info.settling2.toFixed(2)} s`] as [string, string])} />
          </>
        }
        right={<Plot x={[0, T]} y={[0, 1.8]} height={260} xLabel="t (s)" yLabel="step response" series={data.map((d) => ({ points: d.r.t.map((t, i) => ({ x: t, y: d.r.y[i] })), color: d.color, label: d.name }))} hlines={[{ y: 1, dash: true, color: 'var(--muted)' }]} legend />}
      />
    </SimFrame>
  );
}
