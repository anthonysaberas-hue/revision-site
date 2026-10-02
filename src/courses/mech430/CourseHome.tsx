import { Link } from 'react-router-dom';
import { CHAPTERS, EXAMS, PROBLEM_SETS } from './meta';
import { NozzleSim } from './sims';

const WEIGHT: { topic: string; ch: string; n: number; note: string }[] = [
  { topic: 'Isentropic flow, A/A*, choked ṁ', ch: 'isentropic', n: 10, note: 'in every single problem' },
  { topic: 'Normal shocks in nozzles & ducts', ch: 'shocks-in-flow', n: 9, note: 'all quizzes + finals' },
  { topic: 'Nozzle + Fanno pipe + back pressure', ch: 'fanno', n: 8, note: 'the 50–70 pt Quiz 2 problem' },
  { topic: 'Supersonic inlet / diffuser starting', ch: 'inlets', n: 6, note: 'asked almost verbatim each year' },
  { topic: 'Rayleigh flow, thermal choking, ramjet', ch: 'rayleigh', n: 5, note: 'quiz + finals + project' },
  { topic: 'Rocket thrust & Isp', ch: 'nozzles', n: 4, note: 'sea level vs vacuum' },
  { topic: 'Oblique shocks + P-M, diamond airfoil', ch: 'airfoils', n: 4, note: 'finals' },
  { topic: 'Method of characteristics table', ch: 'moc', n: 3, note: 'one problem per final' },
  { topic: 'Unsteady: piston, rarefaction, shock tube', ch: 'unsteady', n: 3, note: 'finals + PS11' },
];

export default function CourseHome() {
  return (
    <>
      <p className="eyebrow">MECH 430 · Winter 2025 · Prof. Andrew J. Higgins</p>
      <h1>Fluid Mechanics 2 — Compressible Flow</h1>
      <p className="lede">
        What happens when a gas moves fast enough that its density changes: nozzles that choke, shocks that appear out of
        nowhere, friction and heat that drive the flow toward Mach 1, and waves that turn supersonic streams.
      </p>

      <div className="grid" style={{ margin: '1.5rem 0', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
        <Link to="/mech430/page/summary" className="card course-card" style={{ borderColor: 'var(--accent)' }}>
          <span className="code">READ FIRST</span>
          <span className="title">The whole course on one page</span>
          <span>7 ideas, 1 decision tree, the numbers to memorise, the 8 exam templates.</span>
        </Link>
        <Link to="/mech430/ch/intro" className="card course-card">
          <span className="code">RE-LEARN</span>
          <span className="title">Start from zero</span>
          <span>Read the chapters in order. Each has a plain-words idea, the equations, a simulation, and how it's examined.</span>
        </Link>
        <Link to="/mech430/page/recipes" className="card course-card">
          <span className="code">CRAM</span>
          <span className="title">Exam recipes → past exams</span>
          <span>The 8 problem templates Higgins reuses, then every past quiz & final solved step by step.</span>
        </Link>
        <Link to="/mech430/lab/engine" className="card course-card" style={{ background: 'linear-gradient(135deg, #0b1020, #1a1440)', color: '#e8ecf5', borderColor: '#2b3a6b' }}>
          <span className="code" style={{ color: '#8fb3ff' }}>3D LAB</span>
          <span className="title">Fire a rocket engine</span>
          <span>Throttle it, change altitude, cut it open. The plume is computed from this course's nozzle, shock and expansion-fan equations.</span>
        </Link>
        <Link to="/mech430/calc/isentropic" className="card course-card">
          <span className="code">LOOK UP</span>
          <span className="title">Calculators & cheat sheet</span>
          <span>Replace tables A2–A6: enter any column, get the row — plus the nearest printed row the exam would use.</span>
        </Link>
      </div>

      <NozzleSim />

      <h2>What actually gets examined</h2>
      <p>Ranked by how often each topic appears across the 6 past papers (4 Quiz 2s, 2 finals). Spend your time accordingly.</p>
      <div className="card">
        {WEIGHT.map((w) => (
          <div key={w.topic} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: '0.8rem', alignItems: 'center', padding: '0.35rem 0' }}>
            <Link to={`/mech430/ch/${w.ch}`}>{w.topic}</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 10, width: `${w.n * 10}%`, background: 'var(--accent)', borderRadius: 5, opacity: 0.35 + w.n / 16 }} />
              <span className="srcnote" style={{ whiteSpace: 'nowrap' }}>{w.note}</span>
            </div>
          </div>
        ))}
      </div>

      <h2>Map of the course</h2>
      <div className="twocol">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Chapters</h3>
          {CHAPTERS.map((c) => (
            <div key={c.slug} style={{ padding: '0.15rem 0' }}>
              <span className="srcnote" style={{ display: 'inline-block', width: '1.6rem' }}>{c.num}</span>
              <Link to={`/mech430/ch/${c.slug}`}>{c.title}</Link> <span className="srcnote">— {c.hint}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Problem sets (all solved, with the thinking)</h3>
            {PROBLEM_SETS.map((p) => (
              <div key={p.slug} style={{ padding: '0.1rem 0' }}>
                <Link to={`/mech430/ps/${p.slug}`}>PS{p.num}</Link> <span className="srcnote">— {p.title}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Past exams</h3>
            {EXAMS.map((p) => (
              <div key={p.slug} style={{ padding: '0.1rem 0' }}>
                <Link to={`/mech430/exam/${p.slug}`}>{p.title}</Link>
                <div className="srcnote">{p.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
