import { ReactNode, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CALCS } from '../meta';
import * as ise from '../lib/isentropic';
import * as ns from '../lib/normalShock';
import * as fa from '../lib/fanno';
import * as ra from '../lib/rayleigh';
import * as pm from '../lib/prandtlMeyer';
import * as ob from '../lib/obliqueShock';
import * as un from '../lib/unsteady';
import { GASES, gasR, soundSpeed } from '../lib/gas';
import { sig } from '../lib/solve';
import { NozzlePipeSim } from '../sims';
import { Tex } from '../../../core/ui';

type Out = [string, number][];
interface InputSpec {
  key: string;
  label: string;
  branches?: string[];
  /** Convert given value → Mach (the table row). */
  toM: (v: number, g: number, branch: string) => number;
}
interface TableCalc {
  title: string;
  intro: ReactNode;
  inputs: InputSpec[];
  columns: (M: number, g: number) => Out;
  /** Minimum Mach of the table */
  minM?: number;
}

const TABLES: Record<string, TableCalc> = {
  isentropic: {
    title: 'Isentropic flow — Table A2',
    intro: <>Stagnation and sonic ratios for steady adiabatic, frictionless flow. <Tex>{'T_0/T = 1+\\tfrac{\\gamma-1}{2}M^2'}</Tex>.</>,
    inputs: [
      { key: 'M', label: 'M', toM: (v) => v },
      { key: 'p', label: 'p / p₀', toM: (v, g) => ise.M_from_p_p0(v, g) },
      { key: 'T', label: 'T / T₀', toM: (v, g) => ise.M_from_T_T0(v, g) },
      { key: 'rho', label: 'ρ / ρ₀', toM: (v, g) => ise.M_from_rho_rho0(v, g) },
      { key: 'A', label: 'A / A*', branches: ['sub', 'sup'], toM: (v, g, b) => ise.M_from_A_Astar(v, b as ise.Branch, g) },
      { key: 'mu', label: 'Mach angle μ (deg)', toM: (v) => 1 / Math.sin((v * Math.PI) / 180) },
    ],
    columns: (M, g) => [
      ['M', M],
      ['p / p₀', ise.p_p0(M, g)],
      ['T / T₀', ise.T_T0(M, g)],
      ['ρ / ρ₀', ise.rho_rho0(M, g)],
      ['A / A*', ise.A_Astar(M, g)],
      ['μ (deg)', M >= 1 ? ise.machAngle(M) : NaN],
      ['ν (deg)', pm.nu(M, g)],
      ['(ṁ/A)/(ṁ/A*)', 1 / ise.A_Astar(M, g)],
    ],
  },
  normal: {
    title: 'Normal shock — Table A3',
    intro: <>x = upstream (supersonic), y = downstream. Across the shock: <Tex>{'T_0'}</Tex> constant, <Tex>{'p_0'}</Tex> drops, <Tex>{'p_{0y}/p_{0x} = A^*_x/A^*_y'}</Tex>.</>,
    minM: 1,
    inputs: [
      { key: 'Mx', label: 'Mₓ', toM: (v) => v },
      { key: 'My', label: 'M_y', toM: (v, g) => ns.Mx_from_My(v, g) },
      { key: 'pr', label: 'p_y / p_x', toM: (v, g) => ns.Mx_from_py_px(v, g) },
      { key: 'rr', label: 'ρ_y / ρ_x', toM: (v, g) => ns.Mx_from_rho(v, g) },
      { key: 'tr', label: 'T_y / T_x', toM: (v, g) => ns.Mx_from_Ty_Tx(v, g) },
      { key: 'p0', label: 'p₀y / p₀x', toM: (v, g) => ns.Mx_from_p0y_p0x(v, g) },
      { key: 'pitot', label: 'p₀y / pₓ (pitot)', toM: (v, g) => ns.Mx_from_p0y_px(v, g) },
    ],
    columns: (M, g) => [
      ['Mₓ', M],
      ['M_y', ns.My(M, g)],
      ['p_y / p_x', ns.py_px(M, g)],
      ['ρ_y / ρ_x', ns.rhoy_rhox(M, g)],
      ['T_y / T_x', ns.Ty_Tx(M, g)],
      ['p₀y / p₀x', ns.p0y_p0x(M, g)],
      ['p₀y / pₓ', ns.p0y_px(M, g)],
      ['Δs / R', ns.deltaS_R(M, g)],
    ],
  },
  fanno: {
    title: 'Fanno flow — Table A4',
    intro: <>Adiabatic flow with friction in a constant-area duct. * = the (hypothetical) sonic state reached after length L*. Uses <Tex>{'4f L^*/D'}</Tex> with the Fanning friction factor.</>,
    inputs: [
      { key: 'M', label: 'M', toM: (v) => v },
      { key: 'fL', label: '4fL*/D', branches: ['sub', 'sup'], toM: (v, g, b) => fa.M_from_fLmax(v, b as ise.Branch, g) },
      { key: 'T', label: 'T / T*', toM: (v, g) => fa.M_from_T_Tstar(v, g) },
      { key: 'p', label: 'p / p*', toM: (v, g) => fa.M_from_p_pstar(v, g) },
      { key: 'p0', label: 'p₀ / p₀*', branches: ['sub', 'sup'], toM: (v, g, b) => fa.M_from_p0_p0star(v, b as ise.Branch, g) },
    ],
    columns: (M, g) => [
      ['M', M],
      ['4fL*/D', fa.fLmax(M, g)],
      ['T / T*', fa.T_Tstar(M, g)],
      ['p / p*', fa.p_pstar(M, g)],
      ['p₀ / p₀*', fa.p0_p0star(M, g)],
      ['V / V* = ρ*/ρ', fa.V_Vstar(M, g)],
    ],
  },
  rayleigh: {
    title: 'Rayleigh flow — Table A5',
    intro: <>Frictionless constant-area flow with heat transfer <Tex>{'q = c_p (T_{02} - T_{01})'}</Tex>. Max heat before choking: <Tex>{'q^* = c_p(T_0^* - T_{01})'}</Tex>.</>,
    inputs: [
      { key: 'M', label: 'M', toM: (v) => v },
      { key: 'T0', label: 'T₀ / T₀*', branches: ['sub', 'sup'], toM: (v, g, b) => ra.M_from_T0_T0star(v, b as ise.Branch, g) },
      { key: 'p', label: 'p / p*', toM: (v, g) => ra.M_from_p_pstar(v, g) },
      { key: 'T', label: 'T / T*', branches: ['sub-low', 'sub-high', 'sup'], toM: (v, g, b) => ra.M_from_T_Tstar(v, b as 'sub-low', g) },
      { key: 'p0', label: 'p₀ / p₀*', branches: ['sub', 'sup'], toM: (v, g, b) => ra.M_from_p0_p0star(v, b as ise.Branch, g) },
    ],
    columns: (M, g) => [
      ['M', M],
      ['T₀ / T₀*', ra.T0_T0star(M, g)],
      ['T / T*', ra.T_Tstar(M, g)],
      ['p / p*', ra.p_pstar(M, g)],
      ['p₀ / p₀*', ra.p0_p0star(M, g)],
      ['V / V*', ra.V_Vstar(M, g)],
    ],
  },
  pm: {
    title: 'Prandtl–Meyer function — Table A6',
    intro: <>Turning a supersonic flow by θ through an expansion fan: <Tex>{'\\nu_2 = \\nu_1 + \\theta'}</Tex>; isentropic, so <Tex>{'p_0'}</Tex> is constant.</>,
    minM: 1,
    inputs: [
      { key: 'M', label: 'M', toM: (v) => v },
      { key: 'nu', label: 'ν (deg)', toM: (v, g) => pm.M_from_nu(v, g) },
      { key: 'mu', label: 'μ (deg)', toM: (v) => 1 / Math.sin((v * Math.PI) / 180) },
    ],
    columns: (M, g) => [
      ['M', M],
      ['ν (deg)', pm.nu(M, g)],
      ['μ (deg)', ise.machAngle(M)],
      ['p / p₀', ise.p_p0(M, g)],
      ['T / T₀', ise.T_T0(M, g)],
    ],
  },
};

function num(s: string | null, d: number) {
  const v = s === null ? NaN : parseFloat(s);
  return isFinite(v) ? v : d;
}

function TableCalculator({ spec }: { spec: TableCalc }) {
  const [params, setParams] = useSearchParams();
  const inKey = params.get('in') ?? spec.inputs[0].key;
  const input = spec.inputs.find((i) => i.key === inKey) ?? spec.inputs[0];
  const [val, setVal] = useState(params.get('v') ?? params.get('M') ?? '2');
  const [branch, setBranch] = useState(params.get('b') ?? input.branches?.[0] ?? '');
  const [g, setG] = useState(num(params.get('g'), 1.4));
  let M = NaN;
  let err = '';
  try {
    M = input.toM(parseFloat(val), g, branch || input.branches?.[0] || '');
    if (!isFinite(M)) err = 'No solution on this branch for that value.';
  } catch (e) {
    err = 'Out of range for this quantity.';
  }
  const cols = isFinite(M) ? spec.columns(M, g) : [];
  // printed-table neighbourhood: step 0.01 below M=2, 0.02 to 4, 0.1 above
  const step = M < 2 ? 0.01 : M < 4 ? 0.02 : 0.1;
  const base = Math.round(M / step) * step;
  const rows = isFinite(M) ? [-2, -1, 0, 1, 2].map((k) => base + k * step).filter((m) => m > (spec.minM ?? 0) - 1e-9 && m > 0) : [];
  const setIn = (k: string) => {
    const next = new URLSearchParams(params);
    next.set('in', k);
    setParams(next, { replace: true });
    const s = spec.inputs.find((i) => i.key === k);
    setBranch(s?.branches?.[0] ?? '');
  };
  return (
    <>
      <h1>{spec.title}</h1>
      <p className="lede">{spec.intro}</p>
      <div className="calc-grid">
        <div className="card">
          <div className="field">
            <label>Known quantity</label>
            <select value={input.key} onChange={(e) => setIn(e.target.value)}>
              {spec.inputs.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Value of {input.label}</label>
            <input type="number" step="any" value={val} onChange={(e) => setVal(e.target.value)} />
          </div>
          {input.branches && (
            <div className="field">
              <label>Branch</label>
              <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                {input.branches.map((b) => (
                  <option key={b} value={b}>
                    {{ sub: 'subsonic (M < 1)', sup: 'supersonic (M > 1)', 'sub-low': 'subsonic, M < 1/√γ', 'sub-high': 'subsonic, 1/√γ < M < 1' }[b] ?? b}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>γ</label>
            <select value={String(g)} onChange={(e) => setG(parseFloat(e.target.value))}>
              {[1.4, 5 / 3, 1.3, 1.29, 1.2, 1.1].map((v) => (
                <option key={v} value={String(v)}>
                  {v === 5 / 3 ? '1.667 (monatomic)' : v}
                </option>
              ))}
            </select>
          </div>
          {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
        </div>
        <div className="card">
          <table className="results">
            <tbody>
              {cols.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{sig(v, 5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length > 0 && (
        <>
          <h3>What the printed table shows around this row</h3>
          <p className="srcnote">The exam uses the nearest printed row, no interpolation (≈1% tolerance). Highlighted: nearest row.</p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {spec.columns(rows[0], g).map(([k]) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m} style={Math.abs(m - base) < 1e-9 ? { background: 'var(--accent-soft)', fontWeight: 600 } : undefined}>
                    {spec.columns(m, g).map(([k, v]) => (
                      <td key={k}>{sig(v, 4)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function ObliqueCalc() {
  const [params] = useSearchParams();
  const [M, setM] = useState(num(params.get('M'), 3));
  const [mode, setMode] = useState(params.get('in') ?? 'delta');
  const [v, setV] = useState(num(params.get('v'), 10));
  const [branch, setBranch] = useState<'weak' | 'strong'>((params.get('b') as 'weak') ?? 'weak');
  const [g, setG] = useState(1.4);
  const r = useMemo(() => {
    try {
      if (mode === 'delta') return ob.obliqueShock(M, v, branch, g);
      if (mode === 'sigma') return ob.obliqueFromSigma(M, v, g);
      return ob.obliqueFromSigma(M, ob.sigmaFromPressureRatio(M, v, g), g);
    } catch {
      return null;
    }
  }, [M, mode, v, branch, g]);
  return (
    <>
      <h1>Oblique shock</h1>
      <p className="lede">
        Decompose: the normal component <Tex>{'M_{n1} = M_1\\sin\\sigma'}</Tex> goes through a normal shock (Table A3); the
        tangential component is unchanged. Then <Tex>{'M_2 = M_{n2}/\\sin(\\sigma-\\delta)'}</Tex>.
      </p>
      <div className="calc-grid">
        <div className="card">
          <div className="field">
            <label>Upstream Mach M₁</label>
            <input type="number" step="any" value={M} onChange={(e) => setM(parseFloat(e.target.value))} />
          </div>
          <div className="field">
            <label>Known</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="delta">deflection δ (deg)</option>
              <option value="sigma">shock angle σ (deg)</option>
              <option value="pr">pressure ratio p₂/p₁</option>
            </select>
          </div>
          <div className="field">
            <label>Value</label>
            <input type="number" step="any" value={v} onChange={(e) => setV(parseFloat(e.target.value))} />
          </div>
          {mode === 'delta' && (
            <div className="field">
              <label>Solution branch</label>
              <select value={branch} onChange={(e) => setBranch(e.target.value as 'weak')}>
                <option value="weak">weak (the one nature picks for attached shocks)</option>
                <option value="strong">strong</option>
              </select>
            </div>
          )}
          <div className="field">
            <label>γ</label>
            <input type="number" step="any" value={g} onChange={(e) => setG(parseFloat(e.target.value))} />
          </div>
          <p className="srcnote">
            For M₁ = {M}: δ_max = {sig(ob.deltaMax(M, g), 4)}° at σ = {sig(ob.sigmaAtDeltaMax(M, g), 4)}°; Mach angle μ ={' '}
            {sig(ise.machAngle(M), 4)}°.
          </p>
        </div>
        <div className="card">
          {r && !r.detached ? (
            <table className="results">
              <tbody>
                {(
                  [
                    ['shock angle σ (deg)', r.sigma],
                    ['deflection δ (deg)', r.delta],
                    ['M_n1 = M₁ sin σ', r.Mn1],
                    ['M_n2', r.Mn2],
                    ['M₂', r.M2],
                    ['p₂ / p₁', r.p2_p1],
                    ['T₂ / T₁', r.T2_T1],
                    ['ρ₂ / ρ₁', r.rho2_rho1],
                    ['p₀₂ / p₀₁', r.p02_p01],
                  ] as [string, number][]
                ).map(([k, x]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{sig(x, 5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--bad)' }}>Detached shock — δ exceeds δ_max for this Mach number. A curved bow shock stands off the body.</p>
          )}
        </div>
      </div>
    </>
  );
}

function MovingShockCalc() {
  const [gasKey, setGas] = useState('air');
  const [T1, setT1] = useState(300);
  const [mode, setMode] = useState<'Ms' | 'up' | 'tube'>('Ms');
  const [v, setV] = useState(2);
  const [p41, setP41] = useState(10);
  const [gas4, setGas4] = useState('He');
  const [T4, setT4] = useState(300);
  const gas = GASES[gasKey];
  const c1 = soundSpeed(gas.gamma, gasR(gas.MW), T1);
  const Ms = mode === 'Ms' ? v : un.Ms_from_up(v / c1, gas.gamma);
  const s = un.movingShock(Ms, c1, gas.gamma);
  const g4 = GASES[gas4];
  const c4 = soundSpeed(g4.gamma, gasR(g4.MW), T4);
  let tube: ReturnType<typeof un.shockTube> | null = null;
  try {
    tube = mode === 'tube' ? un.shockTube({ p4_p1: p41, g1: gas.gamma, g4: g4.gamma, c1, c4 }) : null;
  } catch {
    tube = null;
  }
  const gasSel = (val: string, set: (s: string) => void) => (
    <select value={val} onChange={(e) => set(e.target.value)}>
      {Object.entries(GASES).map(([k, gg]) => (
        <option key={k} value={k}>
          {gg.name} (γ={sig(gg.gamma, 3)}, MW={gg.MW})
        </option>
      ))}
    </select>
  );
  return (
    <>
      <h1>Moving shock & shock tube</h1>
      <p className="lede">
        A shock moving at <Tex>{'V_s = M_s c_1'}</Tex> into still gas is a stationary normal shock seen from a moving frame.
        The gas behind it follows at the piston speed <Tex>{"V_p' = \\tfrac{2}{\\gamma+1}\\tfrac{M_s^2-1}{M_s}c_1"}</Tex>.
      </p>
      <div className="calc-grid">
        <div className="card">
          <div className="field">
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as 'Ms')}>
              <option value="Ms">given shock Mach M_s</option>
              <option value="up">given piston velocity (m/s)</option>
              <option value="tube">shock tube: given p₄/p₁</option>
            </select>
          </div>
          <div className="field">
            <label>Driven gas (state 1)</label>
            {gasSel(gasKey, setGas)}
          </div>
          <div className="field">
            <label>T₁ (K)</label>
            <input type="number" value={T1} onChange={(e) => setT1(parseFloat(e.target.value))} />
          </div>
          {mode !== 'tube' ? (
            <div className="field">
              <label>{mode === 'Ms' ? 'M_s' : 'piston velocity (m/s)'}</label>
              <input type="number" step="any" value={v} onChange={(e) => setV(parseFloat(e.target.value))} />
            </div>
          ) : (
            <>
              <div className="field">
                <label>p₄ / p₁ (driver / driven)</label>
                <input type="number" step="any" value={p41} onChange={(e) => setP41(parseFloat(e.target.value))} />
              </div>
              <div className="field">
                <label>Driver gas (state 4)</label>
                {gasSel(gas4, setGas4)}
              </div>
              <div className="field">
                <label>T₄ (K)</label>
                <input type="number" value={T4} onChange={(e) => setT4(parseFloat(e.target.value))} />
              </div>
            </>
          )}
        </div>
        <div className="card">
          <table className="results">
            <tbody>
              {(mode !== 'tube'
                ? ([
                    ['c₁ (m/s)', c1],
                    ['shock Mach M_s', s.Ms],
                    ['shock speed V_s (m/s)', s.Vs],
                    ['gas velocity behind shock (m/s)', s.up],
                    ['p₂ / p₁', s.p2_p1],
                    ['T₂ / T₁', s.T2_T1],
                    ['T₂ (K)', T1 * s.T2_T1],
                    ['lab-frame Mach behind shock', s.M2lab],
                  ] as [string, number][])
                : tube
                  ? ([
                      ['p₂ / p₁ (= p₃/p₁)', tube.p2_p1],
                      ['shock Mach M_s', tube.Ms],
                      ['shock speed (m/s)', tube.Vs],
                      ['contact surface speed u₂ = u₃ (m/s)', tube.u2],
                      ['T₂ (K)', T1 * tube.T2_T1],
                      ['T₃ (K)', T4 * tube.T3_T4],
                      ['expansion head speed (m/s)', tube.headSpeed],
                      ['expansion tail speed (m/s)', tube.tailSpeed],
                      ['reflected shock M_R', un.reflectedShock(tube.Ms, gas.gamma).MR],
                    ] as [string, number][])
                  : []
              ).map(([k, x]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{sig(x, 5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function NozzlePipeCalc() {
  const [params] = useSearchParams();
  return (
    <>
      <h1>Nozzle + friction pipe solver</h1>
      <p className="lede">
        The exact solver behind the Quiz 2 problems: finds whether the throat chokes, where the shock sits (nozzle or pipe)
        and whether the exit chokes. Defaults: Quiz 2 W2024 P1.
      </p>
      <NozzlePipeSim AR={num(params.get('AR'), 4)} fL={num(params.get('fL'), 0.75)} pb={num(params.get('pb'), 0.2)} p0={num(params.get('p0'), 0)} />
    </>
  );
}

export default function Calculators() {
  const { slug = 'isentropic' } = useParams();
  let body: ReactNode;
  if (TABLES[slug]) body = <TableCalculator key={slug} spec={TABLES[slug]} />;
  else if (slug === 'oblique') body = <ObliqueCalc />;
  else if (slug === 'moving') body = <MovingShockCalc />;
  else if (slug === 'nozzle-pipe') body = <NozzlePipeCalc />;
  else body = <p>Unknown calculator.</p>;
  return (
    <>
      <div className="tabs">
        {CALCS.map((c) => (
          <Link key={c.slug} to={`/mech430/calc/${c.slug}`} className={c.slug === slug ? 'active' : ''}>
            {c.title}
          </Link>
        ))}
      </div>
      {body}
    </>
  );
}
