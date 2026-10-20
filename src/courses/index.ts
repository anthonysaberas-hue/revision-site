export interface CourseInfo {
  code: string;
  slug: string;
  title: string;
  term?: string;
  blurb: string;
  status: 'live' | 'soon';
}

/** Every course on the home page. Add a folder under src/courses/<slug>/ and flip status to 'live'. */
export const COURSES: CourseInfo[] = [
  {
    code: 'MECH 430',
    slug: 'mech430',
    title: 'Fluid Mechanics 2 — Compressible Flow',
    term: 'Winter 2025 · Prof. A.J. Higgins',
    blurb: 'Nozzles, shocks, Fanno & Rayleigh, oblique shocks, expansion fans, characteristics, shock tubes.',
    status: 'live',
  },
  {
    code: 'MECH 412',
    slug: 'mech412',
    title: 'System Dynamics and Control',
    term: 'Winter 2024 · Prof. Luc Mongeau',
    blurb: 'Laplace and state space, mechanical / electrical / fluid analogies, Routh, root locus, Bode, Nyquist, PID and lead-lag design.',
    status: 'live',
  },
  {
    code: 'MECH 346',
    slug: 'mech346',
    title: 'Heat Transfer',
    term: 'Winter 2024 · Dr. Wael Saleh',
    blurb: 'Conduction, fins, transient conduction, forced and natural convection, heat exchangers, thermal radiation.',
    status: 'live',
  },
  {
    code: 'MECH 341',
    slug: 'mech341',
    title: 'Thermodynamics 2',
    term: 'Fall 2023 · Prof. Wagdi Habashi',
    blurb: 'Jet engines, power plants, refrigeration, mixtures, psychrometrics, combustion, chemical equilibrium and nozzles.',
    status: 'live',
  },
  {
    code: 'MECH 331',
    slug: 'mech331',
    title: 'Fluid Mechanics 1',
    term: 'Fall 2022',
    blurb: 'Coming next — sources already found in Downloads.',
    status: 'soon',
  },
  {
    code: 'MECH 315',
    slug: 'mech315',
    title: 'Mechanics 3',
    term: 'Fall 2023',
    blurb: 'Planned.',
    status: 'soon',
  },
  {
    code: 'MECH 393',
    slug: 'mech393',
    title: 'Design 2 — Machine Element Design',
    term: 'Winter 2023',
    blurb: 'Planned.',
    status: 'soon',
  },
];
