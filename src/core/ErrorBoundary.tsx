import { Component, ComponentType, ReactNode } from 'react';

/** Catches a crash in one embedded sim/figure so the rest of the page still renders. */
export class ErrorBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(`[component ${this.props.name}]`, error);
  }
  render() {
    if (this.state.error)
      return (
        <div className="err-box callout warn">
          <div className="callout-title">{this.props.name} failed to render</div>
          <code>{String(this.state.error.message).slice(0, 300)}</code>
        </div>
      );
    return this.props.children;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withBoundary<P extends object>(name: string, C: ComponentType<P>): ComponentType<P> {
  const Wrapped = (props: P) => (
    <ErrorBoundary name={name}>
      <C {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `Safe(${name})`;
  return Wrapped;
}
