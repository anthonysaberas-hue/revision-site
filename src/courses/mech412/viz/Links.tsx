import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** <ToolLink tool="pfe">open the calculator</ToolLink> → /mech412/tool/pfe */
export function ToolLink({ tool, children }: { tool: string; children?: ReactNode }) {
  return (
    <Link className="calclink" to={`/mech412/tool/${tool}`}>
      🧮 {children ?? 'calculator'}
    </Link>
  );
}
export function LabLink({ lab, children }: { lab: string; children?: ReactNode }) {
  return (
    <Link className="calclink" to={`/mech412/lab/${lab}`}>
      🎛️ {children ?? '3D lab'}
    </Link>
  );
}
/** <Ex id="mt2-w2012" q="Q2">MT2 W2012 Q2</Ex> link to an exam page */
export function Ex({ id, children }: { id: string; q?: string; children?: ReactNode }) {
  return <Link to={`/mech412/exam/${id}`}>{children ?? id}</Link>;
}
export function Hw({ n, children }: { n: string; children?: ReactNode }) {
  return <Link to={`/mech412/hw/hw${n.padStart(2, '0')}`}>{children ?? `HW${n}`}</Link>;
}
export function Ch({ slug, children }: { slug: string; children?: ReactNode }) {
  return <Link to={`/mech412/ch/${slug}`}>{children ?? slug}</Link>;
}
