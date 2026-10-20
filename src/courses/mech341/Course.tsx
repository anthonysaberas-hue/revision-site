import { NavGroup } from '../../core/Layout';
import { CourseShell, CourseConfig, Loader } from '../../core/CourseShell';
import { ASSIGNMENTS, BLOCKS, CHAPTERS, EXAMS, LABS, TOOLKIT, TOOLS, chaptersOfBlock, examsOfBlock } from './meta';
import * as sims from './sims';
import * as figs from './figures';
import CourseHome from './CourseHome';

// import.meta.glob needs literal paths, so each course lists its own globs.
const chapters = import.meta.glob('./chapters/*.mdx') as Record<string, Loader>;
const homework = import.meta.glob('./homework/*.mdx') as Record<string, Loader>;
const exams = import.meta.glob('./exams/*.mdx') as Record<string, Loader>;
const pages = import.meta.glob('./pages/*.mdx') as Record<string, Loader>;
const tools = import.meta.glob('./tools/*.mdx') as Record<string, Loader>;
const labs = import.meta.glob('./labs/*.mdx') as Record<string, Loader>;

const navGroups: NavGroup[] = [
  { title: 'Exam toolkit', base: '/mech341/page', items: TOOLKIT },
  ...BLOCKS.map((b) => ({ title: `${b.title} (${b.lectures}) — notes`, base: '/mech341/ch', items: chaptersOfBlock(b.n) })),
  { title: 'Assignments — solved', base: '/mech341/hw', items: ASSIGNMENTS },
  { title: 'Past papers & mocks', base: '/mech341/exam', items: [...examsOfBlock(1), ...examsOfBlock(2)] },
  { title: 'Calculators', base: '/mech341/tool', items: TOOLS },
  { title: '3D labs', base: '/mech341/lab', items: LABS },
];

const config: CourseConfig = {
  slug: 'mech341',
  title: 'MECH 341 — Thermodynamics 2',
  navGroups,
  pageKinds: {
    ch: { label: 'Course notes', glob: chapters, list: CHAPTERS },
    hw: { label: 'Assignments', glob: homework, list: ASSIGNMENTS },
    exam: { label: 'Past papers & mocks', glob: exams, list: EXAMS },
    page: { label: 'Exam toolkit', glob: pages, list: TOOLKIT },
    tool: { label: 'Calculators', glob: tools, list: TOOLS },
    lab: { label: '3D labs', glob: labs, list: LABS },
  },
  components: { ...sims, ...figs },
  Home: CourseHome,
};

export default function Course() {
  return <CourseShell config={config} />;
}
