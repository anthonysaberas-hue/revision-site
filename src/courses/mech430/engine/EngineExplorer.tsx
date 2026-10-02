import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EngineScene, FollowMode, LabelOut, ViewMode } from './EngineScene';
import { ALTITUDES, AltitudeKey, DIAMOND_DISPLAY_SCALE, ENGINE, engineState, EngineState, GEOM, REGIME_TEXT } from './engineModel';
import './engine.css';

const STEPS = [
  { title: 'Propellant inlets', text: 'Liquid oxygen (blue) and liquid methane (orange) arrive from the tanks at a few bar — far too low to push into a 250-bar chamber.' },
  { title: 'Turbopumps + preburners', text: 'Each pump is spun by its own turbine, driven by a preburner that burns a sliver of propellant. Full-flow: ALL the oxygen and ALL the methane pass through a turbine.' },
  { title: 'Main combustion chamber', text: 'Hot gas at p₀ ≈ 250 bar, T₀ ≈ 3600 K and almost zero velocity: this is the "reservoir" of every nozzle problem. It accelerates to M = 1 at the throat, which chokes: ṁ ∝ p₀.' },
  { title: 'Nozzle + exhaust', text: 'The diverging bell takes the flow supersonic (A/A* sets M_e). What happens next depends only on p_e vs p_a: shocks pinch an over-expanded jet, expansion fans open an under-expanded one.' },
];

const FOLLOW_CAPTION: Record<FollowMode, string> = {
  all: '',
  oxygen: 'Oxygen path: pump → oxygen-rich preburner → turbine → injector → chamber → nozzle.',
  methane: 'Methane path: pump → cools the nozzle wall (regenerative cooling) → fuel-rich preburner → injector → chamber → nozzle.',
  fire: 'The exhaust: a supersonic jet whose shape is set by the pressure mismatch p_e / p_a at the nozzle lip.',
};

const fmt = (v: number, d = 0) => (isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '∞');

function altitudeText(alt: AltitudeKey, s: EngineState) {
  const pe = fmt(s.pe / 1e5, 2);
  const pa = fmt(s.pa / 1e5, 2);
  if (s.regime === 'off') return 'Engine off. Push the throttle up to light it.';
  if (alt === 'vac')
    return `No air to push against (p_a = 0). The exhaust leaves at ${pe} bar and keeps expanding: the lip turns the flow by up to ${fmt(s.lipAngle, 0)}° (ν_max − ν(M_e)). The plume blooms — long, smooth and translucent, with no shock diamonds at all.`;
  if (alt === 'mid')
    return `Thinner air at 14 km (p_a = ${pa} bar). The exhaust leaves at ${pe} bar — ${fmt(s.ratio, 1)}× ambient, so it is under-expanded: Prandtl–Meyer fans at the lip turn it outward by ${fmt(s.lipAngle, 1)}°. The jet widens, and the shock cells stretch and fade.`;
  if (s.regime === 'separated')
    return `Sea level at low throttle: the exhaust would leave at only ${pe} bar against ${pa} bar of air (p_e/p_a = ${fmt(s.ratio, 2)} < 0.4). A real nozzle can't hold that — the flow separates from the wall inside the bell. This is why sea-level engines can't throttle deeply.`;
  if (s.regime === 'ideal') return `Exit pressure ${pe} bar ≈ ambient ${pa} bar: ideally expanded. The jet leaves almost parallel; the diamonds are faint.`;
  return `Full power at sea level. The exhaust leaves at ${pe} bar, just under the ${pa} bar of air around it — slightly over-expanded. The air pinches the jet through oblique shocks at the lip (${fmt(-s.lipAngle, 1)}° inward), and bright shock diamonds glow where it recompresses.`;
}

export default function EngineExplorer() {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EngineScene | null>(null);
  const [throttle, setThrottle] = useState(1);
  const [alt, setAlt] = useState<AltitudeKey>('sea');
  const [view, setView] = useState<ViewMode>('whole');
  const [follow, setFollow] = useState<FollowMode>('all');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [help, setHelp] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [labels, setLabels] = useState<LabelOut[]>([]);
  const [ticks, setTicks] = useState<{ x: number; y: number; label: string }[]>([]);
  const [live, setLive] = useState<EngineState>(() => engineState(1, ALTITUDES.sea.pa));
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!host.current) return;
    let sc: EngineScene;
    try {
      sc = new EngineScene(host.current);
    } catch (e) {
      setErr('WebGL is not available in this browser.');
      return;
    }
    sceneRef.current = sc;
    sc.onLabels = setLabels;
    sc.onRuler = setTicks;
    const id = window.setInterval(() => setLive({ ...sc.state }), 120);
    return () => {
      window.clearInterval(id);
      sc.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => sceneRef.current?.setThrottle(throttle), [throttle]);
  useEffect(() => sceneRef.current?.setAmbient(ALTITUDES[alt].pa), [alt]);
  useEffect(() => sceneRef.current?.setView(view), [view]);
  useEffect(() => sceneRef.current?.setPlaying(playing), [playing]);
  const chooseFollow = (f: FollowMode) => {
    setFollow(f);
    setStep(0);
    sceneRef.current?.setFollow(f);
  };
  const chooseStep = (n: number) => {
    const next = step === n ? 0 : n;
    setStep(next);
    if (next === 0) sceneRef.current?.setFollow(follow);
    else sceneRef.current?.setStep(next);
  };

  const tf = live.thrust / (ENGINE.g0 * 1000);
  const caption = step > 0 ? `${step}. ${STEPS[step - 1].title} — ${STEPS[step - 1].text}` : FOLLOW_CAPTION[follow];

  return (
    <div className="eng">
      <div className="eng-canvas" ref={host} />
      {err && <div className="eng-error">{err}</div>}

      {/* projected labels */}
      <div className="eng-labels">
        {labels.map((l) => (
          <div key={l.id} className={`eng-label ${l.kind ? 'small' : ''} ${l.visible ? 'on' : ''}`} style={{ transform: `translate(${l.x}px, ${l.y}px)` }}>
            <span className="dot" />
            <span className="pill">
              {l.text}
              {l.sub && <em>{l.sub}</em>}
            </span>
          </div>
        ))}
      </div>

      {/* floor ruler */}
      <div className="eng-ruler">
        {ticks.map((t) => (
          <div key={t.label} className="tick" style={{ transform: `translate(${t.x}px, ${t.y}px)` }}>
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      {/* left panel */}
      <aside className={`eng-panel eng-left ${panelOpen ? '' : 'collapsed'}`}>
        <div className="eng-brand">
          <Link to="/mech430/ch/nozzles">← MECH 430</Link>
          <span>VISUAL LAB</span>
          <button className="eng-collapse" onClick={() => setPanelOpen(!panelOpen)} aria-label="Toggle panel">
            {panelOpen ? '–' : '+'}
          </button>
        </div>
        <div className="eng-kicker">Inside a</div>
        <h1 className="eng-title">Rocket Engine</h1>
        {panelOpen && (
          <>
            <p className="eng-sub">
              Every nozzle problem in this course lives inside this machine. Open it up, follow the propellant and throttle it
              yourself — the plume is computed from the same equations as the notes.
            </p>
            <div className="eng-stats">
              <div>
                <b>{fmt(tf, 0)}</b>
                <span>tf</span>
                <label>Thrust</label>
              </div>
              <div>
                <b>{fmt(live.p0 / 1e5, 0)}</b>
                <span>bar</span>
                <label>Chamber</label>
              </div>
              <div>
                <b>{fmt(live.mdot, 0)}</b>
                <span>kg/s</span>
                <label>Burning</label>
              </div>
            </div>
            <div className="eng-info">{altitudeText(alt, live)}</div>
            <details className="eng-physics" open>
              <summary>The physics, live</summary>
              <table>
                <tbody>
                  <tr>
                    <td>Exit pressure p_e</td>
                    <td>{fmt(live.pe / 1e5, 3)} bar</td>
                  </tr>
                  <tr>
                    <td>Ambient p_a</td>
                    <td>{fmt(live.pa / 1e5, 3)} bar</td>
                  </tr>
                  <tr>
                    <td>p_e / p_a</td>
                    <td>{live.pa > 0 ? fmt(live.ratio, 2) : '∞'}</td>
                  </tr>
                  <tr>
                    <td>Exit Mach M_e (A/A* = {fmt(GEOM.AR, 1)})</td>
                    <td>{fmt(GEOM.Me, 2)}</td>
                  </tr>
                  <tr>
                    <td>Exhaust velocity V_e</td>
                    <td>{fmt(live.Ve, 0)} m/s</td>
                  </tr>
                  <tr>
                    <td>Momentum thrust ṁV_e</td>
                    <td>{fmt(live.momentumThrust / 1e3, 0)} kN</td>
                  </tr>
                  <tr>
                    <td>Pressure thrust A_e(p_e − p_a)</td>
                    <td>{fmt(live.pressureThrust / 1e3, 0)} kN</td>
                  </tr>
                  <tr>
                    <td>Specific impulse I_sp</td>
                    <td>{fmt(live.Isp, 0)} s</td>
                  </tr>
                  <tr>
                    <td>Flow turn at the lip</td>
                    <td>{live.regime === 'off' ? '—' : `${live.lipAngle > 0 ? '+' : ''}${fmt(live.lipAngle, 1)}°`}</td>
                  </tr>
                  <tr>
                    <td>Shock-cell spacing ≈ 1.31√(M_j²−1)·D_e</td>
                    <td>{live.pa > 0 && live.regime !== 'off' ? `${fmt(live.cellSpacing_De, 1)} D_e` : '—'}</td>
                  </tr>
                </tbody>
              </table>
              <p className={`eng-regime r-${live.regime}`}>{REGIME_TEXT[live.regime]}</p>
              <p className="eng-links">
                Relearn it: <Link to="/mech430/ch/nozzles">rocket thrust</Link> · <Link to="/mech430/ch/isentropic">A/A* & choking</Link> ·{' '}
                <Link to="/mech430/ch/oblique">oblique shocks</Link> · <Link to="/mech430/ch/prandtl-meyer">expansion fans</Link> ·{' '}
                <Link to="/mech430/ps/ps04">PS4 rockets</Link>
              </p>
              <p className="eng-foot">
                Generic methalox engine: γ = {ENGINE.gamma}, MW = {ENGINE.MW}, T₀ = {ENGINE.T0} K. Shock cells drawn ×{DIAMOND_DISPLAY_SCALE} compressed along
                the axis so several fit on screen.
              </p>
            </details>
          </>
        )}
      </aside>

      {/* control panel */}
      <div className="eng-panel eng-controls">
        <div className="row">
          <span className="lbl">Follow</span>
          <div className="seg">
            {(['all', 'oxygen', 'methane', 'fire'] as FollowMode[]).map((f) => (
              <button key={f} className={follow === f && step === 0 ? 'on' : ''} onClick={() => chooseFollow(f)}>
                {f === 'all' ? 'All' : f === 'oxygen' ? 'Oxygen' : f === 'methane' ? 'Methane' : 'Fire'}
              </button>
            ))}
          </div>
          <div className="steps" title="Guided tour">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} className={step === n ? 'on' : ''} onClick={() => chooseStep(n)}>
                {n}
              </button>
            ))}
          </div>
          <span className="lbl">Throttle</span>
          <b className="readout">{Math.round(throttle * 100)}%</b>
          <input className="range" type="range" min={0} max={1} step={0.01} value={throttle} onChange={(e) => setThrottle(parseFloat(e.target.value))} />
        </div>
        <div className="row">
          <span className="lbl">Altitude</span>
          <div className="seg">
            {(Object.keys(ALTITUDES) as AltitudeKey[]).map((k) => (
              <button key={k} className={alt === k ? 'on' : ''} onClick={() => setAlt(k)}>
                {ALTITUDES[k].label}
              </button>
            ))}
          </div>
          <span className="lbl">Engine</span>
          <div className="seg">
            {(['whole', 'cutaway', 'exploded'] as ViewMode[]).map((v) => (
              <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button className="icon" onClick={() => setPlaying(!playing)} title={playing ? 'Pause' : 'Play'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <button className="icon" onClick={() => sceneRef.current?.resetCamera()} title="Reset camera">
            ⟲
          </button>
          <button className="icon" onClick={() => setHelp(true)} title="Help">
            ?
          </button>
        </div>
      </div>

      {caption && <div className="eng-caption">{caption}</div>}

      {help && (
        <div className="eng-help" onClick={() => setHelp(false)}>
          <div className="eng-panel" onClick={(e) => e.stopPropagation()}>
            <h3>How to use this lab</h3>
            <ul>
              <li><b>Drag</b> to orbit, <b>scroll</b> to zoom, <b>right-drag</b> to pan. The camera drifts slowly if you leave it alone.</li>
              <li><b>Follow</b>: isolate the oxygen path, the methane path (see it cool the nozzle), or the fire.</li>
              <li><b>1 2 3 4</b>: guided tour from the tanks to the exhaust. Click again to leave the tour.</li>
              <li><b>Throttle</b>: scales p₀ → ṁ, thrust and p_e all scale with it (choked throat). Drop it at sea level and watch the jet over-expand, then separate.</li>
              <li><b>Altitude</b>: changes p_a only. Same engine, same p_e — the plume changes because p_e/p_a changes.</li>
              <li><b>Engine</b>: Cutaway opens the chamber and nozzle; Exploded separates the assemblies.</li>
            </ul>
            <p>Exam link: this is PS4 and Quiz 2 W2019 P2 — thrust = ṁV_e + A_e(p_e − p_a), maximum when p_e = p_a.</p>
            <button className="btn primary" onClick={() => setHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
