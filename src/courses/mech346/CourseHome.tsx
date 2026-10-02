import { Link } from 'react-router-dom';
import { Callout } from '../../core/ui';
import { BLOCKS, chaptersOfBlock, examsOfBlock, TOOLS, LABS } from './meta';

/** Topic frequency over the past papers in the archive (MT1 ×3, MT2 ×3 incl. Concordia 2021; final unavailable). */
const WEIGHT: { topic: string; ch: string; n: number; note: string }[] = [
  { topic: 'Conduction with heat generation (T(r), BCs, centre temperature)', ch: 'conduction-eq', n: 5, note: 'every MT1' },
  { topic: 'Fins: η, ε, adiabatic tip', ch: 'fins', n: 3, note: 'MT1' },
  { topic: 'Resistance networks, composite walls, cylinders and spheres', ch: 'steady-conduction', n: 4, note: 'MT1, MT2 Q3 and final' },
  { topic: 'Lumped system: Bi check, time, Q', ch: 'transient', n: 3, note: 'every MT2 Q1' },
  { topic: 'One-term solution (wall, cylinder, sphere, product solution)', ch: 'transient', n: 3, note: 'every MT2 Q2' },
  { topic: 'External forced convection with a resistance network', ch: 'external-flow', n: 3, note: 'MT2 Q3' },
  { topic: 'Internal flow in tubes (entry length, Nu, Tm)', ch: 'internal-flow', n: 2, note: 'MT2 2023 + final' },
  { topic: 'Natural convection', ch: 'natural-convection', n: 1, note: 'final' },
  { topic: 'Heat exchangers (LMTD, ε–NTU)', ch: 'heat-exchangers', n: 1, note: 'final' },
  { topic: 'Radiation exchange and view factors', ch: 'radiation-exchange', n: 1, note: 'final' },
];

export default function CourseHome() {
  const maxN = Math.max(...WEIGHT.map((w) => w.n));
  return (
    <>
      <p className="eyebrow">MECH 346 · Winter 2024 · Dr. Wael Saleh</p>
      <h1>Heat Transfer</h1>
      <p className="lede">
        Heat flows from hot to cold in three ways: through solids (conduction), into moving fluids (convection) and as light (radiation).
        Every problem in the course is a thermal circuit: find the resistances, add them, and read off the heat rate.
      </p>

      <Callout kind="warn" title="Check the answers">
        <p>
          Past-exam solutions in the archive are student-graded scans with mistakes, and some assignment answers differ by the
          rounding of the textbook. Every answer here is recomputed; see <Link to="/mech346/page/errata">Errata</Link>.
        </p>
      </Callout>

      <h2>Three exam blocks</h2>
      <p>
        Midterm 1 (Chapters 1–3), Midterm 2 (Chapters 4–7) and a three-hour final on everything with six problems (one comes straight
        from the assignments). Closed book: the instructor hands out a formula sheet and Tables 4-2 and 4-3.
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
                <span className="srcnote" style={{ display: 'inline-block', width: '1.8rem' }}>{c.num}</span>
                <Link to={`/mech346/ch/${c.slug}`}>{c.title}</Link>
              </div>
            ))}
            <h4 style={{ margin: '0.8rem 0 0.2rem' }}>Past papers</h4>
            {examsOfBlock(b.n).map((e) => (
              <div key={e.slug} style={{ padding: '0.08rem 0' }}>
                <Link to={`/mech346/exam/${e.slug}`}>{e.title}</Link>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid" style={{ margin: '1.5rem 0', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
        <Link to="/mech346/page/summary" className="card course-card" style={{ borderColor: 'var(--accent)' }}>
          <span className="code">READ FIRST</span>
          <span className="title">The whole course on one page</span>
          <span>The thermal-circuit idea, the decision trees and the formulas.</span>
        </Link>
        <Link to="/mech346/page/recipes" className="card course-card">
          <span className="code">CRAM</span>
          <span className="title">Exam recipes</span>
          <span>The question templates that keep coming back.</span>
        </Link>
        <Link to="/mech346/tool/resistance" className="card course-card">
          <span className="code">CALCULATE</span>
          <span className="title">Calculators</span>
          <span>{TOOLS.length} tools: resistances, fins, transient, convection, heat exchangers, radiation, properties.</span>
        </Link>
        <Link to="/mech346/lab/pipe" className="card course-card">
          <span className="code">3D LABS</span>
          <span className="title">Hardware you can poke</span>
          <span>{LABS.length} labs: insulated pipe, fins, quenching, boundary layer, exchanger, furnace, plume.</span>
        </Link>
      </div>

      <h2>What actually gets examined</h2>
      <p>Counted over the papers in the archive (no past final survives; the final adds the last block of chapters).</p>
      <div className="card">
        {WEIGHT.map((w, i) => (
          <div key={w.topic} style={{ display: 'grid', gridTemplateColumns: '1.6rem minmax(0,1.3fr) minmax(0,1fr)', gap: '0.8rem', alignItems: 'center', padding: '0.35rem 0' }}>
            <span className="srcnote">{i + 1}</span>
            <Link to={`/mech346/ch/${w.ch}`}>{w.topic}</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 10, width: `${Math.max(2, (w.n / maxN) * 60)}%`, background: 'var(--accent)', borderRadius: 5, opacity: 0.35 + (0.65 * w.n) / maxN }} />
              <span className="srcnote" style={{ whiteSpace: 'nowrap' }}>
                ~{w.n}
                {w.note ? ` · ${w.note}` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
