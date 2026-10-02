import { Children, ReactNode, createContext, isValidElement, useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import katex from 'katex';

/* ---------------- Slider ---------------- */
export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v: number) => String(Number(v.toPrecision(4))),
  unit = '',
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  unit?: string;
}) {
  return (
    <div className="slider">
      <label>
        <span>{label}</span>
        <b>
          {format(value)}
          {unit}
        </b>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

/* ---------------- Tex (inline KaTeX from TSX) ---------------- */
export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = katex.renderToString(children, { displayMode: block, throwOnError: false });
  return block ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------------- Callouts ---------------- */
type Kind = 'idea' | 'warn' | 'good' | 'exam' | 'note';
const TITLES: Record<Kind, string> = {
  idea: 'Big idea',
  warn: 'Trap',
  good: 'Remember',
  exam: 'How it’s examined',
  note: 'Note',
};
export function Callout({ kind = 'idea', title, children }: { kind?: Kind; title?: string; children: ReactNode }) {
  return (
    <div className={`callout ${kind}`}>
      <div className="callout-title">{title ?? TITLES[kind]}</div>
      {children}
    </div>
  );
}
export const Idea = (p: { title?: string; children: ReactNode }) => <Callout kind="idea" {...p} />;
export const Trap = (p: { title?: string; children: ReactNode }) => <Callout kind="warn" {...p} />;
export const Remember = (p: { title?: string; children: ReactNode }) => <Callout kind="good" {...p} />;
export const Examined = (p: { title?: string; children: ReactNode }) => <Callout kind="exam" {...p} />;

/* ---------------- Sim frame ---------------- */
export function SimFrame({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="sim">
      <div className="sim-head">
        <span className="t">▶ {title}</span>
        {subtitle && <span className="s">{subtitle}</span>}
      </div>
      <div className="sim-body">{children}</div>
    </div>
  );
}

export function Readout({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <div className="readout">
      {items.map(([k, v], i) => (
        <div key={i}>
          <div className="k">{k}</div>
          <div className="v">{v}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Links ---------------- */
/** Course slug used by NoteRef/CalcLink. Provided by CourseShell; defaults to mech430. */
export const CourseContext = createContext<string>('mech430');
export const useCourseSlug = () => useContext(CourseContext);

/** Link to a chapter section: <NoteRef ch="fanno" sec="working-relations">§10.2</NoteRef> */
export function NoteRef({ ch, sec, children }: { ch: string; sec?: string; children?: ReactNode }) {
  const course = useCourseSlug();
  return <Link to={`/${course}/ch/${ch}${sec ? `#${sec}` : ''}`}>{children ?? 'notes'}</Link>;
}

/** Link to a calculator prefilled: <CalcLink calc="isentropic" q="M=2">check</CalcLink> */
export function CalcLink({ calc, q, children }: { calc: string; q?: string; children?: ReactNode }) {
  const course = useCourseSlug();
  return (
    <Link className="calclink" to={`/${course}/calc/${calc}${q ? `?${q}` : ''}`}>
      🧮 {children ?? 'calculator'}
    </Link>
  );
}

/** A table reading, as it would be done on the exam: <T>A2 @ M = 2.0: p/p₀ = 0.1278</T> */
export const T = ({ children }: { children: ReactNode }) => <span className="table-read">{children}</span>;

/* ---------------- Problem layout ---------------- */
export function Problem({ id, title, tags, children }: { id: string; title: string; tags?: string; children: ReactNode }) {
  const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <section className="problem" id={slug}>
      <div className="problem-head">
        <span className="id">{id}</span>
        <span className="ttl">{title}</span>
        {tags &&
          tags.split(',').map((t) => (
            <span key={t} className="pill">
              {t.trim()}
            </span>
          ))}
      </div>
      <div className="problem-body">{children}</div>
    </section>
  );
}

function Section({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`problem-section ${className}`}>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}
export const Statement = ({ children }: { children: ReactNode }) => <Section label="Problem">{children}</Section>;
export const Think = ({ children }: { children: ReactNode }) => (
  <Section label="🧠 What kind of problem is this?">{children}</Section>
);
export const Plan = ({ children }: { children: ReactNode }) => <Section label="🗺 Plan of attack">{children}</Section>;
export const Answer = ({ children }: { children: ReactNode }) => (
  <Section label="✅ Answer" className="answer">
    {children}
  </Section>
);
export const Traps = ({ children }: { children: ReactNode }) => <Callout kind="warn" title="Traps & insights">{children}</Callout>;
export const Source = ({ children }: { children: ReactNode }) => <p className="srcnote">Source: {children}</p>;

/** Steps revealed one at a time. Children should be <Step> elements. */
export function Steps({ children, label = '🪜 Step by step' }: { children: ReactNode; label?: string }) {
  const items = Children.toArray(children).filter(isValidElement);
  const [shown, setShown] = useState(1);
  return (
    <Section label={label}>
      <ol className="steps">
        {items.map((c, i) => (
          <li key={i} className={`step ${i < shown ? '' : 'hidden'}`}>
            {c}
          </li>
        ))}
      </ol>
      <div className="step-controls">
        {shown < items.length && (
          <button className="btn primary" onClick={() => setShown(shown + 1)}>
            Next step ({shown}/{items.length})
          </button>
        )}
        {shown < items.length && (
          <button className="btn" onClick={() => setShown(items.length)}>
            Show all
          </button>
        )}
        {shown > 1 && (
          <button className="btn" onClick={() => setShown(1)}>
            Hide
          </button>
        )}
      </div>
    </Section>
  );
}
export function Step({ title, why, children }: { title?: ReactNode; why?: ReactNode; children?: ReactNode }) {
  return (
    <div>
      {title && <strong>{title}</strong>}
      {why && <div className="why">{why}</div>}
      {children}
    </div>
  );
}

/** Figure wrapper for inline SVG diagrams. */
export function Figure({ caption, children }: { caption?: ReactNode; children: ReactNode }) {
  return (
    <figure className="figure">
      {children}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
