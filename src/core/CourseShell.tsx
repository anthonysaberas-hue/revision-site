import { ComponentType, lazy, ReactNode, Suspense, useMemo } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { MDXProvider } from '@mdx-js/react';
import { Layout, NavGroup } from './Layout';
import * as ui from './ui';
import { withBoundary } from './ErrorBoundary';

export interface ShellEntry {
  slug: string;
  title: string;
  num?: string;
  hint?: string;
}
export type Loader = () => Promise<{ default: ComponentType }>;

export interface PageKind {
  /** Breadcrumb label, e.g. "Course notes" */
  label: string;
  /** Result of a literal `import.meta.glob('./chapters/*.mdx')` in the course's own Course.tsx */
  glob: Record<string, Loader>;
  /** Ordered entries (drives prev/next and the NotYet placeholder) */
  list: ShellEntry[];
}

export interface CourseConfig {
  /** URL slug, e.g. 'mech412'. Routes live under /<slug>/<kind>/:slug */
  slug: string;
  /** Sidebar title, e.g. 'MECH 412 — System Dynamics and Control' */
  title: string;
  /** Short name for breadcrumbs; defaults to the part of `title` before ' — ' */
  code?: string;
  navGroups: NavGroup[];
  /** kind -> page source. Route is /<slug>/<kind>/:slug */
  pageKinds: Record<string, PageKind>;
  /** Course-specific MDX components (typically `{ ...sims, ...figs }`); core/ui is added automatically */
  components: Record<string, unknown>;
  Home: ComponentType;
  /** Optional calculator page: routes /<slug>/calc and /<slug>/calc/:slug (wide layout) */
  Calc?: ComponentType;
  /** Extra <Route> elements (rendered inside <Routes>), e.g. a full-screen lab */
  extraRoutes?: ReactNode;
}

/** Only capitalised functions are MDX components; sims/figs get an error boundary, ui components don't. */
export function buildComponents(extra: Record<string, unknown>): Record<string, ComponentType<any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  return Object.fromEntries(
    Object.entries({ ...ui, ...extra })
      .filter(([k, v]) => /^[A-Z]/.test(k) && typeof v === 'function')
      .map(([k, v]) => [k, k in ui ? v : withBoundary(k, v as ComponentType<object>)]),
  ) as Record<string, ComponentType<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function NotYet({ entry }: { entry?: ShellEntry }) {
  return (
    <>
      <h1>{entry?.title ?? 'Not found'}</h1>
      <ui.Callout kind="note" title="Being written">
        <p>This page hasn’t been written yet — it’s on the build list. Use the calculators and the chapters that are live in the meantime.</p>
      </ui.Callout>
    </>
  );
}

export function Pager({ prev, next, base }: { prev?: ShellEntry; next?: ShellEntry; base: string }) {
  return (
    <div className="pager">
      {prev ? (
        <Link to={`${base}/${prev.slug}`} className="card">
          <div className="dir">← Previous</div>
          {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={`${base}/${next.slug}`} className="card" style={{ textAlign: 'right' }}>
          <div className="dir">Next →</div>
          {next.title}
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

function shellLayoutProps(c: CourseConfig) {
  return { nav: c.navGroups, courseTitle: c.title, courseHome: `/${c.slug}` };
}
const shortName = (c: CourseConfig) => c.code ?? c.title.split(' — ')[0];

function ContentPage({ config, kind }: { config: CourseConfig; kind: string }) {
  const { slug = '' } = useParams();
  const pk = config.pageKinds[kind];
  const key = Object.keys(pk.glob).find((k) => k.endsWith(`/${slug}.mdx`));
  const loader = key ? pk.glob[key] : undefined;
  const Comp = useMemo(() => (loader ? lazy(loader) : null), [loader]);
  const idx = pk.list.findIndex((e) => e.slug === slug);
  const entry = pk.list[idx];
  return (
    <Layout {...shellLayoutProps(config)} crumbs={<>{shortName(config)} › {pk.label} › {entry?.title ?? slug}</>}>
      {Comp ? (
        <Suspense fallback={<p>Loading…</p>}>
          <Comp />
        </Suspense>
      ) : (
        <NotYet entry={entry} />
      )}
      <Pager prev={pk.list[idx - 1]} next={pk.list[idx + 1]} base={`/${config.slug}/${kind}`} />
    </Layout>
  );
}

export function CourseShell({ config }: { config: CourseConfig }) {
  const { slug: course, pageKinds, Home, Calc, extraRoutes } = config;
  const code = shortName(config);
  const components = useMemo(() => buildComponents(config.components), [config.components]);
  const layoutProps = shellLayoutProps(config);

  return (
    <ui.CourseContext.Provider value={course}>
      <MDXProvider components={components}>
        <Routes>
          <Route
            index
            element={
              <Layout {...layoutProps} crumbs={<>{code}</>}>
                <Home />
              </Layout>
            }
          />
          {Object.keys(pageKinds).map((kind) => (
            <Route key={kind} path={`${kind}/:slug`} element={<ContentPage config={config} kind={kind} />} />
          ))}
          {Calc && (
            <>
              <Route
                path="calc/:slug"
                element={
                  <Layout {...layoutProps} crumbs={<>{code} › Calculators</>} wide>
                    <Calc />
                  </Layout>
                }
              />
              <Route
                path="calc"
                element={
                  <Layout {...layoutProps} crumbs={<>{code} › Calculators</>} wide>
                    <Calc />
                  </Layout>
                }
              />
            </>
          )}
          {extraRoutes}
        </Routes>
      </MDXProvider>
    </ui.CourseContext.Provider>
  );
}
