import { NavGroup } from '../../core/Layout';
import { CourseShell, CourseConfig, Loader } from '../../core/CourseShell';
import { BLOCKS, CHAPTERS, EXAMS, HOMEWORK, LABS, TOOLKIT, TOOLS, TUTORIALS, chaptersOfBlock, examsOfBlock } from './meta';
import * as sims from './sims';
import * as figs from './figures';
import CourseHome from './CourseHome';

// import.meta.glob needs literal paths, so each course lists its own globs.
const chapters = import.meta.glob('./chapters/*.mdx') as Record<string, Loader>;
const homework = import.meta.glob('./homework/*.mdx') as Record<string, Loader>;
const tutorials = import.meta.glob('./tutorials/*.mdx') as Record<string, Loader>;
const exams = import.meta.glob('./exams/*.mdx') as Record<string, Loader>;
const pages = import.meta.glob('./pages/*.mdx') as Record<string, Loader>;
const tools = import.meta.glob('./tools/*.mdx') as Record<string, Loader>;
const labs = import.meta.glob('./labs/*.mdx') as Record<string, Loader>;

const navGroups: NavGroup[] = [
  { title: 'Exam toolkit', base: '/mech412/page', items: TOOLKIT },
  ...BLOCKS.map((b) => ({ title: `${b.title} (${b.lectures}) — notes`, base: '/mech412/ch', items: chaptersOfBlock(b.n) })),
  { title: 'Homework — solved', base: '/mech412/hw', items: HOMEWORK },
  { title: 'Tutorials', base: '/mech412/tut', items: TUTORIALS },
  ...BLOCKS.map((b) => ({ title: `Past papers — ${b.n === 3 ? 'finals & MT3' : `MT${b.n}`}`, base: '/mech412/exam', items: examsOfBlock(b.n) })),
  { title: 'Calculators', base: '/mech412/tool', items: TOOLS },
  { title: '3D labs', base: '/mech412/lab', items: LABS },
];

const config: CourseConfig = {
  slug: 'mech412',
  title: 'MECH 412 — System Dynamics and Control',
  navGroups,
  pageKinds: {
    ch: { label: 'Course notes', glob: chapters, list: CHAPTERS },
    hw: { label: 'Homework', glob: homework, list: HOMEWORK },
    tut: { label: 'Tutorials', glob: tutorials, list: TUTORIALS },
    exam: { label: 'Past exams', glob: exams, list: EXAMS },
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
