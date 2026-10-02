import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** <ToolLink tool="fin">open the calculator</ToolLink> → /mech346/tool/fin */
export function ToolLink({ tool, children }: { tool: string; children?: ReactNode }) {
  return (
    <Link className="calclink" to={`/mech346/tool/${tool}`}>
      🧮 {children ?? 'calculator'}
    </Link>
  );
}
export function LabLink({ lab, children }: { lab: string; children?: ReactNode }) {
  return (
    <Link className="calclink" to={`/mech346/lab/${lab}`}>
      🎛️ {children ?? '3D lab'}
    </Link>
  );
}
/** <Ex id="mt2-f2022">MT2 Nov 2022</Ex> link to an exam page */
export function Ex({ id, children }: { id: string; q?: string; children?: ReactNode }) {
  return <Link to={`/mech346/exam/${id}`}>{children ?? id}</Link>;
}
/** <Asg n="03">Chapter 3 assignment</Asg> link to an assignment page (slug a03, a03b, a07 ...) */
export function Asg({ n, children }: { n: string; children?: ReactNode }) {
  return <Link to={`/mech346/hw/a${n}`}>{children ?? `Assignment ${n}`}</Link>;
}
export function Ch({ slug, children }: { slug: string; children?: ReactNode }) {
  return <Link to={`/mech346/ch/${slug}`}>{children ?? slug}</Link>;
}
