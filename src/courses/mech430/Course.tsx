import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { CourseShell, CourseConfig, Loader } from '../../core/CourseShell';
import { CALCS, CHAPTERS, EXAMS, LABS, PROBLEM_SETS, TOOLS } from './meta';
import * as sims from './sims';
import * as figs from './figures';
import CourseHome from './CourseHome';
import Calculators from './calculators/Calculators';

const EngineExplorer = lazy(() => import('./engine/EngineExplorer'));

// import.meta.glob needs literal paths, so each course lists its own globs.
const chapters = import.meta.glob('./chapters/*.mdx') as Record<string, Loader>;
const problemsets = import.meta.glob('./problemsets/*.mdx') as Record<string, Loader>;
const exams = import.meta.glob('./exams/*.mdx') as Record<string, Loader>;
const pages = import.meta.glob('./pages/*.mdx') as Record<string, Loader>;

const config: CourseConfig = {
  slug: 'mech430',
  title: 'MECH 430 — Compressible Flow',
  navGroups: [
    { title: 'Visual labs', base: '/mech430/lab', items: LABS },
    { title: 'Course notes', base: '/mech430/ch', items: CHAPTERS },
    { title: 'Problem sets — fully solved', base: '/mech430/ps', items: PROBLEM_SETS },
    { title: 'Past exams — step by step', base: '/mech430/exam', items: EXAMS },
    { title: 'Exam toolkit', base: '/mech430/page', items: TOOLS },
    { title: 'Calculators (replace the tables)', base: '/mech430/calc', items: CALCS },
  ],
  pageKinds: {
    ch: { label: 'Course notes', glob: chapters, list: CHAPTERS },
    ps: { label: 'Problem sets', glob: problemsets, list: PROBLEM_SETS },
    exam: { label: 'Past exams', glob: exams, list: EXAMS },
    page: { label: 'Exam toolkit', glob: pages, list: TOOLS },
  },
  components: { ...sims, ...figs },
  Home: CourseHome,
  Calc: Calculators,
  extraRoutes: (
    <Route
      path="lab/engine"
      element={
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#05070d', color: '#8ea2d4', display: 'grid', placeItems: 'center' }}>Loading the test stand…</div>}>
          <EngineExplorer />
        </Suspense>
      }
    />
  ),
};

export default function Course() {
  return <CourseShell config={config} />;
}
