export interface Entry {
  slug: string;
  title: string;
  num?: string;
  hint?: string;
  /** exam block 1 = MT1 (ch 1-3), 2 = MT2 (ch 4-7), 3 = final (ch 8-13) */
  block?: 1 | 2 | 3;
}

export const BLOCKS = [
  { n: 1 as const, title: 'Block 1 — Midterm 1', lectures: 'Ch 1–3', blurb: 'Modes of heat transfer, the conduction equation, steady conduction, resistance networks, fins.' },
  { n: 2 as const, title: 'Block 2 — Midterm 2', lectures: 'Ch 4–7', blurb: 'Lumped and one-term transient conduction, convection fundamentals, external forced convection.' },
  { n: 3 as const, title: 'Block 3 — Final', lectures: 'Ch 8–13', blurb: 'Internal flow, natural convection, heat exchangers, thermal radiation and radiation exchange.' },
];

export const CHAPTERS: Entry[] = [
  { slug: 'intro', num: '1', block: 1, title: 'Introduction: energy balance and the three modes', hint: 'Fourier, Newton, Stefan–Boltzmann' },
  { slug: 'conduction-eq', num: '2', block: 1, title: 'The heat conduction equation', hint: 'derivation, boundary conditions, generation' },
  { slug: 'steady-conduction', num: '3', block: 1, title: 'Steady conduction: walls, cylinders, spheres, resistance networks', hint: 'critical radius, contact resistance' },
  { slug: 'fins', num: '3b', block: 1, title: 'Extended surfaces (fins)', hint: 'η, ε, tip conditions' },
  { slug: 'transient', num: '4', block: 2, title: 'Transient conduction: lumped, one-term, semi-infinite', hint: 'Bi, Fo, Table 4-2' },
  { slug: 'numerical', num: '5', block: 2, title: 'Numerical methods in conduction (reading)', hint: 'finite differences' },
  { slug: 'convection-basics', num: '6', block: 2, title: 'Fundamentals of convection', hint: 'boundary layers, Re, Pr, Nu' },
  { slug: 'external-flow', num: '7', block: 2, title: 'External forced convection', hint: 'plates, cylinders, spheres, tube banks' },
  { slug: 'internal-flow', num: '8', block: 3, title: 'Internal forced convection', hint: 'tubes, entry lengths, mean temperature' },
  { slug: 'natural-convection', num: '9', block: 3, title: 'Natural convection', hint: 'Ra, Churchill–Chu' },
  { slug: 'heat-exchangers', num: '11', block: 3, title: 'Heat exchangers: LMTD and ε–NTU', hint: 'rating and sizing' },
  { slug: 'radiation-basics', num: '12', block: 3, title: 'Thermal radiation: blackbody and surface properties', hint: 'Planck, Wien, ε, α, ρ, τ' },
  { slug: 'radiation-exchange', num: '13', block: 3, title: 'Radiation exchange: view factors, networks, shields', hint: 'enclosures' },
];

/** Assignment-style problem sets ("hw" routes). a01/a03/a07 are the instructor-solved sets; the rest are original practice sets. */
export const ASSIGNMENTS: Entry[] = [
  { slug: 'a01', num: '1', title: 'Chapter 1 assignment (solutions provided)', hint: '1-19 … 1-137' },
  { slug: 'a02', num: '2', title: 'Chapter 2 exercises (from your notes)', hint: '2-19 … 2-106, then extra practice' },
  { slug: 'a03', num: '3', title: 'Chapter 3 assignment (solutions provided)', hint: '3-25 … 3-145' },
  { slug: 'a03b', num: '3b', title: 'Fins practice', hint: 'original set' },
  { slug: 'a04', num: '4', title: 'Chapter 4 practice: transient conduction', hint: 'original set' },
  { slug: 'a06', num: '6', title: 'Chapter 6 practice: convection fundamentals', hint: 'original set' },
  { slug: 'a07', num: '7', title: 'Chapter 7 assignment (solutions provided)', hint: '7-26 … 7-106' },
  { slug: 'a08', num: '8', title: 'Chapter 8 practice: internal flow', hint: 'original set' },
  { slug: 'a09', num: '9', title: 'Chapter 9 practice: natural convection', hint: 'original set' },
  { slug: 'a11', num: '11', title: 'Chapter 11 practice: heat exchangers', hint: 'original set' },
  { slug: 'a12', num: '12', title: 'Chapter 12–13 practice: radiation', hint: 'original set' },
];

export const EXAMS: Entry[] = [
  { slug: 'mt1-f2021', block: 1, title: 'Midterm 1 — Oct 2021 (Concordia MECH 352, same instructor)' },
  { slug: 'mt1-f2023', block: 1, title: 'Midterm 1 — Oct 19, 2023' },
  { slug: 'mt1-w2024', block: 1, title: 'Midterm 1 — Feb 19, 2024 (Q3)' },
  { slug: 'mt2-f2022', block: 2, title: 'Midterm 2 — Nov 15, 2022' },
  { slug: 'mt2-f2023', block: 2, title: 'Midterm 2 — Nov 14, 2023' },
  { slug: 'final-mock-a', block: 3, title: 'Final practice A (mock, 6 problems)' },
  { slug: 'final-mock-b', block: 3, title: 'Final practice B (mock, 6 problems)' },
];

export const TOOLKIT: Entry[] = [
  { slug: 'real-world', title: 'Heat transfer you meet every day' },
  { slug: 'summary', title: 'The whole course on one page' },
  { slug: 'cheatsheet-mt1', title: 'Cheat sheet — Midterm 1' },
  { slug: 'cheatsheet-mt2', title: 'Cheat sheet — Midterm 2' },
  { slug: 'cheatsheet-final', title: 'Cheat sheet — Final' },
  { slug: 'recipes', title: 'Exam recipes', hint: 'the question templates' },
  { slug: 'tables', title: 'Tables: Table 4-2/4-3, properties, constants' },
  { slug: 'errata', title: 'Errata — mistakes in the exams and graded solutions' },
];

export const TOOLS: Entry[] = [
  { slug: 'resistance', title: 'Thermal resistance networks' },
  { slug: 'fin', title: 'Fin calculator' },
  { slug: 'transient', title: 'Transient conduction (lumped and one-term)' },
  { slug: 'plate', title: 'External flow: plate, cylinder, sphere' },
  { slug: 'internal', title: 'Internal flow in a tube' },
  { slug: 'natural', title: 'Natural convection' },
  { slug: 'hx', title: 'Heat exchanger (LMTD and ε–NTU)' },
  { slug: 'radiation', title: 'Radiation enclosure and view factors' },
  { slug: 'props', title: 'Fluid properties (air, water)' },
];

export const LABS: Entry[] = [
  { slug: 'pipe', title: 'Insulated pipe and critical radius' },
  { slug: 'fin', title: 'Heat-sink fin lab' },
  { slug: 'quench', title: 'Transient cooling lab (Bi and Fo)' },
  { slug: 'boundary-layer', title: 'Boundary-layer lab (flat plate)' },
  { slug: 'exchanger', title: 'Heat-exchanger lab' },
  { slug: 'furnace', title: 'Radiation furnace lab' },
  { slug: 'plume', title: 'Natural-convection plume lab' },
];

export const chaptersOfBlock = (b: 1 | 2 | 3) => CHAPTERS.filter((c) => c.block === b);
export const examsOfBlock = (b: 1 | 2 | 3) => EXAMS.filter((c) => c.block === b);
