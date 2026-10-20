import { Link } from 'react-router-dom';
import { Callout } from '../../core/ui';
import { BLOCKS, chaptersOfBlock, examsOfBlock, TOOLS, LABS } from './meta';

/** Rough topic weight, from the April 2021 final and the instructor's "marathon" review session. */
const WEIGHT: { topic: string; ch: string; n: number; note: string }[] = [
  { topic: 'Jet engines and Brayton cycles (thrust, efficiencies, stagnation)', ch: 'gas-cycles', n: 5, note: 'mandatory, 25 marks' },
  { topic: 'Combustion and adiabatic flame temperature', ch: 'combustion', n: 4, note: 'mandatory, 15 marks' },
  { topic: 'Chemical equilibrium (Kp, dissociation)', ch: 'equilibrium', n: 3, note: 'mandatory with conceptual part, 10 marks' },
  { topic: 'Rankine cycles and cogeneration', ch: 'vapor-cycles', n: 3, note: 'optional problem, 25 marks' },
  { topic: 'Psychrometrics and air conditioning', ch: 'psychrometrics', n: 3, note: 'optional problem, 25 marks' },
  { topic: 'Refrigeration and heat pumps', ch: 'refrigeration', n: 3, note: 'optional problem, 25 marks' },
  { topic: 'Property relations (qualitative)', ch: 'property-relations', n: 2, note: 'conceptual questions' },
  { topic: 'Gas mixtures', ch: 'mixtures', n: 2, note: 'often folded into other problems' },
  { topic: 'Compressible flow and nozzles', ch: 'compressible', n: 2, note: 'often folded into the jet engine' },
];

export default function CourseHome() {
  const maxN = Math.max(...WEIGHT.map((w) => w.n));
  return (
    <>
      <p className="eyebrow">MECH 341 · Fall 2023 · Prof. Wagdi Habashi</p>
      <h1>Thermodynamics 2</h1>
      <p className="lede">
        This course is about machines that turn heat into thrust, power and cold: jet engines, steam and gas power plants,
        refrigerators and heat pumps, air-conditioning units, burners and nozzles. Every chapter opens with the real machine,
        then gives you the cycle, the property lookups and the exam recipe.
      </p>

      <Callout kind="note" title="Exam format">
        <p>
          Final: Problems 1–3 are mandatory (50 marks): jet engine 25, combustion / adiabatic flame temperature 15, equilibrium and
          conceptual questions 10. Then choose any two of Problems 4–6 (25 marks each). The info sheets are provided at the exam.
        </p>
        <p className="srcnote">Based on the April 2021 final and the instructor’s review session; the exact mix can change.</p>
      </Callout>

      <div className="grid" style={{ margin: '1.5rem 0', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
        <Link to="/mech341/page/summary" className="card course-card" style={{ borderColor: 'var(--accent)' }}>
          <span className="code">READ FIRST</span>
          <span className="title">The whole course on one page</span>
          <span>The cycles, the property lookups and the decision trees.</span>
        </Link>
        <Link to="/mech341/page/real-world" className="card course-card">
          <span className="code">REAL WORLD</span>
          <span className="title">The machines</span>
          <span>Turbofans, combined-cycle plants, heat pumps, HVAC, burners and nozzles with real numbers.</span>
        </Link>
        <Link to="/mech341/page/recipes" className="card course-card">
          <span className="code">CRAM</span>
          <span className="title">Exam recipes</span>
          <span>The question templates and the traps students fall into.</span>
        </Link>
        <Link to="/mech341/tool/props" className="card course-card">
          <span className="code">CALCULATE</span>
          <span className="title">Calculators</span>
          <span>{TOOLS.length} tools: properties, Brayton, Rankine, refrigeration, psychrometrics, combustion, equilibrium, nozzle.</span>
        </Link>
        <Link to="/mech341/lab/turbofan" className="card course-card">
          <span className="code">3D LABS</span>
          <span className="title">Hardware you can poke</span>
          <span>{LABS.length} labs: turbofan, power plant, heat pump, HVAC, burner, nozzle.</span>
        </Link>
      </div>

      <h2>Two exam blocks</h2>
      <div className="grid" style={{ margin: '1rem 0', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
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
                <Link to={`/mech341/ch/${c.slug}`}>{c.title}</Link>
              </div>
            ))}
            <h4 style={{ margin: '0.8rem 0 0.2rem' }}>Past papers and mocks</h4>
            {examsOfBlock(b.n).map((e) => (
              <div key={e.slug} style={{ padding: '0.08rem 0' }}>
                <Link to={`/mech341/exam/${e.slug}`}>{e.title}</Link>
              </div>
            ))}
          </div>
        ))}
      </div>

      <h2>What actually gets examined</h2>
      <p>Approximate weight, based on the April 2021 final and the instructor’s “marathon” review session.</p>
      <div className="card">
        {WEIGHT.map((w, i) => (
          <div key={w.topic} style={{ display: 'grid', gridTemplateColumns: '1.6rem minmax(0,1.3fr) minmax(0,1fr)', gap: '0.8rem', alignItems: 'center', padding: '0.35rem 0' }}>
            <span className="srcnote">{i + 1}</span>
            <Link to={`/mech341/ch/${w.ch}`}>{w.topic}</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 10, width: `${Math.max(2, (w.n / maxN) * 60)}%`, background: 'var(--accent)', borderRadius: 5, opacity: 0.35 + (0.65 * w.n) / maxN }} />
              <span className="srcnote" style={{ whiteSpace: 'nowrap' }}>{w.note}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
