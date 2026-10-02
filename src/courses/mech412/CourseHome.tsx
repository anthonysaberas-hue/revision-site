import { Link } from 'react-router-dom';
import { Callout } from '../../core/ui';
import { BLOCKS, chaptersOfBlock, examsOfBlock, TOOLS } from './meta';

/** Topic frequency over about 60 past-paper question slots (survey, section 3). */
const WEIGHT: { topic: string; ch: string; n: number; note: string }[] = [
  { topic: 'Modelling / EOM / electrical-analog circuits', ch: 'analogies', n: 16, note: 'a Q1 analog-circuit question in every MT2' },
  { topic: 'Transfer-function derivation (circuits, op-amps, motors)', ch: 'circuits-opamps', n: 14, note: 'nearly every paper' },
  { topic: 'State space (SS ↔ TF, methods 1 and 2, Φ(t), diagonalisation)', ch: 'state-space', n: 11, note: 'MT1 every year, finals' },
  { topic: 'Time response (PFE, OS / tp / ts, pole-zero effects)', ch: 'time-response', n: 11, note: 'MT1' },
  { topic: 'Block diagram reduction / SFG / Mason', ch: 'block-diagrams', n: 7, note: 'MT1' },
  { topic: 'DC motor servo', ch: 'electromechanical', n: 6, note: 'overlaps with TF derivation and error' },
  { topic: 'Linearisation of nonlinear circuits and systems', ch: 'linearization', n: 6, note: 'MT1 W2017, MT2 F2022 and W2024' },
  { topic: 'Op-amp circuits', ch: 'circuits-opamps', n: 6, note: 'impedance method' },
  { topic: 'Steady-state error, sensitivity, disturbance', ch: 'steady-state-error', n: 6, note: 'MT2 and finals' },
  { topic: 'Hydraulic / pneumatic controllers (lever + servo + dashpot)', ch: 'hydraulic-thermal', n: 4, note: 'MT2 W2019, F2022, W2024' },
  { topic: 'Liquid-level tanks', ch: 'hydraulic-thermal', n: 4, note: '' },
  { topic: 'Root locus', ch: 'root-locus', n: 3, note: 'finals + homework' },
  { topic: 'Bode / margins', ch: 'bode-margins', n: 3, note: '' },
  { topic: 'PID / Ziegler–Nichols / controller design', ch: 'pid', n: 3, note: '' },
  { topic: 'Routh', ch: 'routh', n: 2, note: 'implicit in several' },
  { topic: 'Nyquist', ch: 'nyquist', n: 0, note: 'homework only, none in the archive' },
];

export default function CourseHome() {
  const maxN = Math.max(...WEIGHT.map((w) => w.n));
  return (
    <>
      <p className="eyebrow">MECH 412 · Winter 2024 · Prof. Luc Mongeau</p>
      <h1>System Dynamics and Control</h1>
      <p className="lede">
        Model a physical system, turn it into a transfer function or a state-space model, see how it responds in time and
        frequency, then close a feedback loop around it and design the controller.
      </p>

      <Callout kind="warn" title="Check the answers">
        <p>
          This course’s official corrections contained many errors — every answer on this site is recomputed; see{' '}
          <Link to="/mech412/page/errata">Errata</Link>.
        </p>
      </Callout>

      <h2>Three exam blocks</h2>
      <p>
        The course runs as Midterm 1 (L1–8), Midterm 2 (L9–16) and a final that is really a “Midterm 3” (L17–23, four
        problems plus two review problems).
      </p>
      <div className="grid" style={{ margin: '1rem 0', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {BLOCKS.map((b) => (
          <div key={b.n} className="card">
            <h3 style={{ marginTop: 0 }}>{b.title}</h3>
            <div className="srcnote" style={{ marginBottom: '0.5rem' }}>
              {b.lectures} — {b.blurb}
            </div>
            <h4 style={{ margin: '0.6rem 0 0.2rem' }}>Notes</h4>
            {chaptersOfBlock(b.n).map((c) => (
              <div key={c.slug} style={{ padding: '0.12rem 0' }}>
                <span className="srcnote" style={{ display: 'inline-block', width: '1.6rem' }}>{c.num}</span>
                <Link to={`/mech412/ch/${c.slug}`}>{c.title}</Link>
              </div>
            ))}
            <h4 style={{ margin: '0.8rem 0 0.2rem' }}>Past papers</h4>
            {examsOfBlock(b.n).map((e) => (
              <div key={e.slug} style={{ padding: '0.08rem 0' }}>
                <Link to={`/mech412/exam/${e.slug}`}>{e.title}</Link>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid" style={{ margin: '1.5rem 0', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
        <Link to="/mech412/page/summary" className="card course-card" style={{ borderColor: 'var(--accent)' }}>
          <span className="code">READ FIRST</span>
          <span className="title">The whole course on one page</span>
          <span>The ideas, the decision trees, the formulas, the question templates.</span>
        </Link>
        <Link to="/mech412/page/recipes" className="card course-card">
          <span className="code">CRAM</span>
          <span className="title">Exam recipes</span>
          <span>The 10 question templates that keep coming back.</span>
        </Link>
        <Link to="/mech412/tool/pfe" className="card course-card">
          <span className="code">CALCULATE</span>
          <span className="title">Calculators</span>
          <span>{TOOLS.length} tools: partial fractions, 2nd-order specs, Routh, root locus, Bode, Nyquist, lead / lag, state space.</span>
        </Link>
        <Link to="/mech412/lab/msd" className="card course-card">
          <span className="code">3D LABS</span>
          <span className="title">Hardware you can poke</span>
          <span>Mass-spring-damper, DC motor, tanks, hydraulic servo, inverted pendulum, PID tuner.</span>
        </Link>
      </div>

      <h2>What actually gets examined</h2>
      <p>
        Ranked by how many of the roughly 60 question slots in the past papers each topic fills. The last block (L17–23)
        is under-represented in the archive, so the homework HW7–HW10 and the lecture examples are the best guide for the
        final.
      </p>
      <div className="card">
        {WEIGHT.map((w, i) => (
          <div key={w.topic} style={{ display: 'grid', gridTemplateColumns: '1.6rem minmax(0,1.3fr) minmax(0,1fr)', gap: '0.8rem', alignItems: 'center', padding: '0.35rem 0' }}>
            <span className="srcnote">{i + 1}</span>
            <Link to={`/mech412/ch/${w.ch}`}>{w.topic}</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 10, width: `${Math.max(2, (w.n / maxN) * 60)}%`, background: 'var(--accent)', borderRadius: 5, opacity: 0.35 + (0.65 * w.n) / maxN }} />
              <span className="srcnote" style={{ whiteSpace: 'nowrap' }}>
                {w.n > 0 ? `~${w.n}` : '0'}
                {w.note ? ` · ${w.note}` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
