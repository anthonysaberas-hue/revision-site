import { useEffect, useMemo, useRef, useState } from 'react';
import { Plot, sample } from '../../../core/Plot';
import { Readout, SimFrame, Slider, Tex } from '../../../core/ui';
import * as ise from '../lib/isentropic';
import { exitVelocity } from '../lib/rocket';
import { gasR } from '../lib/gas';
import { fmt } from './common';

/* ======================= Mach cone (animated wave fronts) ======================= */
export function MachConeSim() {
  const [M, setM] = useState(1.8);
  const [t, setT] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      setT((v) => (v + (now - last) / 1000) % 1000);
      last = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);
  const W = 640;
  const H = 280;
  const c = 55; // px per second (sound speed)
  const period = 0.35; // s between beeps
  const xs = 80 + ((t * M * c) % (W - 120)); // source position (wraps)
  const age0 = (t % period);
  const circles = [];
  for (let k = 0; k < 14; k++) {
    const age = age0 + k * period;
    const x0 = xs - M * c * age;
    if (x0 < -200) break;
    circles.push(<circle key={k} cx={x0} cy={H / 2} r={c * age} fill="none" stroke="var(--c1)" strokeOpacity={Math.max(0.1, 0.8 - k * 0.05)} strokeWidth={1.4} />);
  }
  const mu = M > 1 ? Math.asin(1 / M) : 0;
  const L = 700;
  return (
    <SimFrame title="Sound waves from a moving source" subtitle="subsonic: waves run ahead · supersonic: waves pile into a Mach cone">
      <div className="controls">
        <Slider label="Source Mach number M" value={M} min={0} max={3} step={0.01} onChange={setM} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'var(--surface-2)', borderRadius: 8 }}>
        <clipPath id="mcclip">
          <rect width={W} height={H} />
        </clipPath>
        <g clipPath="url(#mcclip)">
          {circles}
          {M > 1 && (
            <>
              <line x1={xs} y1={H / 2} x2={xs - L * Math.cos(mu)} y2={H / 2 - L * Math.sin(mu)} stroke="var(--c2)" strokeWidth={2.5} />
              <line x1={xs} y1={H / 2} x2={xs - L * Math.cos(mu)} y2={H / 2 + L * Math.sin(mu)} stroke="var(--c2)" strokeWidth={2.5} />
            </>
          )}
          <circle cx={xs} cy={H / 2} r={5} fill="var(--text)" />
        </g>
      </svg>
      <Readout
        items={[
          ['regime', M < 1 ? 'subsonic — ahead of the source hears it coming' : M === 1 ? 'sonic — waves stack at the source' : 'supersonic — zone of silence ahead'],
          ['Mach angle μ = asin(1/M)', M > 1 ? `${fmt((mu * 180) / Math.PI, 3)}°` : '—'],
        ]}
      />
    </SimFrame>
  );
}

/* ======================= Compressibility: Bernoulli vs exact ======================= */
export function CompressibilitySim() {
  const [M, setM] = useState(0.3);
  const g = 1.4;
  // (p0 − p)/(½ρV²) = compressibility factor
  const factor = (m: number) => (m === 0 ? 1 : (ise.p0_p(m, g) - 1) / ((g / 2) * m * m));
  return (
    <SimFrame title="When can I use Bernoulli?" subtitle="error of p₀ − p = ½ρV² vs the exact isentropic result">
      <div className="controls">
        <Slider label="Mach number" value={M} min={0} max={1.5} step={0.01} onChange={setM} />
      </div>
      <Plot
        x={[0, 1.5]}
        y={[0.95, 1.7]}
        height={250}
        xLabel="M"
        yLabel="(p₀ − p) / ½ρV²"
        series={[
          { points: sample(factor, 0.001, 1.5), label: 'exact (compressible)', width: 3 },
          { points: sample((m) => 1 + (m * m) / 4, 0, 1.5), label: '1 + M²/4 (first correction)', dash: true },
          { points: [{ x: 0, y: 1 }, { x: 1.5, y: 1 }], label: 'Bernoulli (incompressible)', color: 'var(--muted)' },
        ]}
        vlines={[{ x: 0.3, label: 'M = 0.3 rule of thumb' }]}
        dots={[{ x: M, y: factor(M), label: `${((factor(M) - 1) * 100).toFixed(1)}% error` }]}
      />
    </SimFrame>
  );
}

/* ======================= Converging nozzle: choking ======================= */
export function ConvergingNozzleSim() {
  const [pb, setPb] = useState(0.8);
  const g = 1.4;
  const pstar = ise.pstar_p0(g);
  const choked = pb <= pstar;
  const Me = choked ? 1 : ise.M_from_p_p0(pb, g);
  const pe = choked ? pstar : pb;
  const mdot = (p: number) => {
    const m = p <= pstar ? 1 : ise.M_from_p_p0(p, g);
    return 1 / ise.A_Astar(m, g); // (ṁ at exit area) / ṁ_max
  };
  return (
    <SimFrame title="Converging nozzle and the Bell Centre" subtitle="lower the back pressure — the mass flow stops growing at p* = 0.528 p₀">
      <div className="controls">
        <Slider label="Back pressure p_b / p₀" value={pb} min={0.05} max={1} step={0.001} onChange={setPb} format={(v) => v.toFixed(3)} />
      </div>
      <div className="regime">{pb >= 0.999 ? 'No flow' : choked ? 'CHOKED: M_exit = 1, p_exit = p* ≠ p_b — the rest of the expansion happens outside' : 'Subsonic: p_exit = p_b ("latex balloon" — a subsonic jet can’t hold a pressure difference)'}</div>
      <div className="twocol">
        <Plot
          x={[0, 1]}
          y={[0, 1.08]}
          height={240}
          xLabel="p_b / p₀"
          yLabel="ṁ / ṁ_max"
          series={[{ points: sample(mdot, 0.001, 0.9999, 300), width: 3 }]}
          vlines={[{ x: pstar, label: 'p*' }]}
          dots={[{ x: pb, y: mdot(pb), label: 'you are here' }]}
        />
        <Plot
          x={[0, 1]}
          y={[0, 1.08]}
          height={240}
          xLabel="p_b / p₀"
          yLabel="p_exit / p₀"
          series={[{ points: sample((p) => Math.max(p, pstar), 0, 1), width: 3, label: 'p_exit' }, { points: sample((p) => p, 0, 1), dash: true, label: 'p_exit = p_b line' }]}
          dots={[{ x: pb, y: pe }]}
          vlines={[{ x: pstar }]}
        />
      </div>
      <Readout items={[['exit Mach', fmt(Me)], ['p_exit / p₀', fmt(pe)], ['ṁ / ṁ_max', fmt(mdot(pb))], ['p₀ needed to choke', `p₀ > ${fmt(1 / pstar, 3)} p_b`]]} />
    </SimFrame>
  );
}

/* ======================= Rocket thrust vs ambient pressure ======================= */
export function RocketThrustSim() {
  const [AR, setAR] = useState(8);
  const [p0bar, setP0] = useState(10);
  const g = 1.4;
  const T0 = 2000;
  const R = 300;
  const p0 = p0bar * 1e5;
  const Me = ise.M_from_A_Astar(AR, 'sup', g);
  const pe = p0 * ise.p_p0(Me, g);
  const mdotPerAt = ise.massFlux(1, p0, T0, R, g);
  const Ve = exitVelocity(pe / p0, T0, R, g);
  // thrust per unit throat area, as a function of ambient pressure
  const F = (pa: number) => mdotPerAt * Ve + AR * (pe - pa);
  // envelope: best possible nozzle at each pa (optimally expanded)
  const Fopt = (pa: number) => (pa <= 0 ? NaN : mdotPerAt * exitVelocity(Math.min(1, pa / p0), T0, R, g));
  const paMax = 1.2e5;
  const Fref = mdotPerAt * Math.sqrt(((2 * g) / (g - 1)) * R * T0);
  return (
    <SimFrame title="Why a nozzle is 'optimal' at one altitude only" subtitle="thrust = ṁV_e + A_e(p_e − p_a)">
      <div className="controls">
        <Slider label="Area ratio A_e / A_t" value={AR} min={1.5} max={40} step={0.1} onChange={setAR} />
        <Slider label="Chamber pressure p₀" value={p0bar} min={5} max={100} step={0.5} onChange={setP0} unit=" bar" />
      </div>
      <Plot
        x={[0, paMax / 1e5]}
        y={[0.4, 1.05]}
        height={260}
        xLabel="ambient pressure p_a (bar)  —  vacuum on the left, sea level on the right"
        yLabel="F / F_max"
        series={[
          { points: sample((x) => F(x * 1e5) / Fref, 0, paMax / 1e5), width: 3, label: `this nozzle (A_e/A_t = ${AR})` },
          { points: sample((x) => Fopt(x * 1e5) / Fref, 0.001, paMax / 1e5), dash: true, label: 'ideal nozzle re-shaped for every p_a' },
        ]}
        vlines={[{ x: pe / 1e5, label: 'p_a = p_e: tangent point', color: 'var(--c2)' }]}
      />
      <Readout
        items={[
          ['exit Mach M_e', fmt(Me)],
          ['exit pressure p_e', `${fmt(pe / 1e5)} bar`],
          ['V_e', `${fmt(Ve)} m/s`],
          ['sea-level / vacuum thrust', fmt(F(101325) / F(0))],
        ]}
      />
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
        The fixed nozzle's line only <em>touches</em> the ideal envelope where <Tex>{'p_a = p_e'}</Tex> — that's the proof that
        matched expansion maximises thrust (<Tex>{'dF/dA_e = p_e - p_a = 0'}</Tex>). γ = 1.4, R = 300 J/kg·K, T₀ = 2000 K — the
        numbers of Quiz 2 W2019 P2.
      </p>
    </SimFrame>
  );
}
