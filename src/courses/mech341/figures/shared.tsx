import { ReactNode } from 'react';
import { Callout } from '../../../core/ui';
import { TsDiagramView, PsychroChartView, TsPoint, PsyPoint } from '../viz/Diagrams';

export { Ch, Asg, Ex, ToolLink, LabLink } from '../viz/Links';

/** Real-world callout used under every worked problem and chapter opener. */
export function RealWorld({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Callout kind="note" title={`🌍 ${title ?? 'Real world'}`}>
      {children}
    </Callout>
  );
}

/** Chapter-opener card: the machine behind the chapter and its key real numbers. */
export function Machine({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="card" style={{ borderColor: 'var(--accent)', margin: '1rem 0' }}>
      <h3 style={{ marginTop: 0 }}>⚙️ The machine: {name}</h3>
      {children}
    </div>
  );
}

export function TsDiagram({ fluid, points, path, height, isobars }: { fluid: 'water' | 'r134a'; points: TsPoint[]; path?: number[]; height?: number; isobars?: number[] }) {
  return <TsDiagramView fluid={fluid} points={points} path={path} height={height} isobars={isobars} />;
}

export function PsychroChart({ points, P }: { points?: PsyPoint[]; P?: number }) {
  return <PsychroChartView points={points} P={P} />;
}
