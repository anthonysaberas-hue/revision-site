export interface Entry {
  slug: string;
  title: string;
  num?: string;
  /** Short hint shown in lists */
  hint?: string;
}

export const CHAPTERS: Entry[] = [
  { slug: 'thermo', num: '0', title: 'Thermo refresher', hint: 'ideal gas, cp/cv, Tds, isentropic' },
  { slug: 'intro', num: '1', title: 'The big picture', hint: 'why compressibility, the C-D nozzle story' },
  { slug: 'conservation', num: '2', title: 'Conservation laws for a control volume', hint: 'mass, momentum, energy' },
  { slug: 'one-d', num: '3', title: '1-D steady flow equations', hint: 'integral & differential forms' },
  { slug: 'sound', num: '4', title: 'Speed of sound & Mach number', hint: 'c = √γRT, Mach cone' },
  { slug: 'isentropic', num: '5', title: 'Isentropic flow', hint: 'stagnation, A/A*, choking' },
  { slug: 'nozzles', num: '6', title: 'Nozzles & rockets', hint: 'back pressure, thrust, Isp' },
  { slug: 'normal-shock', num: '7', title: 'Normal shocks', hint: 'jump relations, entropy' },
  { slug: 'shocks-in-flow', num: '8', title: 'Flow with shocks', hint: 'shock in a nozzle, moving shocks' },
  { slug: 'inlets', num: '9', title: 'Pitot, inlets & wind tunnels', hint: 'starting, Kantrowitz' },
  { slug: 'fanno', num: '10', title: 'Fanno flow (friction)', hint: '4fL*/D, choking, shocks in pipes' },
  { slug: 'rayleigh', num: '11', title: 'Rayleigh flow (heat)', hint: 'thermal choking' },
  { slug: 'oblique', num: '12', title: 'Oblique shocks & reflections', hint: 'θ-β-M, polars, Mach reflection' },
  { slug: 'prandtl-meyer', num: '13', title: 'Prandtl–Meyer expansion', hint: 'ν(M), expansion fans' },
  { slug: 'airfoils', num: '14', title: 'Plumes & diamond airfoils', hint: 'shock-expansion theory, lift & drag' },
  { slug: 'moc', num: '15', title: 'Method of characteristics (2-D)', hint: 'C⁺/C⁻, ν ± θ' },
  { slug: 'unsteady', num: '16', title: 'Unsteady waves & shock tubes', hint: 'pistons, Riemann invariants' },
];

export const PROBLEM_SETS: Entry[] = [
  { slug: 'ps01', num: '1', title: 'Conservation laws & speed of sound' },
  { slug: 'ps02', num: '2', title: '1-D isentropic flow' },
  { slug: 'ps03', num: '3', title: 'Compressibility & isentropic applications' },
  { slug: 'ps04', num: '4', title: 'Rocket nozzles' },
  { slug: 'ps05', num: '5', title: 'Normal shocks' },
  { slug: 'ps06', num: '6', title: 'Starting inlets & wind tunnels' },
  { slug: 'ps07', num: '7', title: 'Fanno flow' },
  { slug: 'ps08', num: '8', title: 'Rayleigh flow' },
  { slug: 'ps09', num: '9', title: 'Oblique shocks' },
  { slug: 'ps10', num: '10', title: 'Prandtl–Meyer, airfoils, MOC' },
  { slug: 'ps11', num: '11', title: 'Moving shocks & shock tubes' },
];

export const EXAMS: Entry[] = [
  { slug: 'q2-w2019', title: 'Quiz 2 — Winter 2019', hint: 'diffuser starting · rocket thrust · nozzle + Fanno pipe' },
  { slug: 'q2-w2023', title: 'Quiz 2 — Winter 2023', hint: 'inlet starting · nozzle + Fanno pipe back pressures' },
  { slug: 'q2-f2023', title: 'Quiz 2 — Fall 2023', hint: 'two-throat tunnel · tank-fed Fanno duct' },
  { slug: 'q2-w2024', title: 'Quiz 2 — Winter 2024', hint: 'nozzle + Fanno shock iteration · Rayleigh choking' },
  { slug: 'final-a', title: 'Final exam A', hint: 'detonation · rockets · diamond airfoil · MOC · piston' },
  { slug: 'final-b', title: 'Final exam B', hint: 'inlet · vacuum tube · ramjet · airfoil · MOC' },
];

export const TOOLS: Entry[] = [
  { slug: 'summary', title: 'The whole course on one page', hint: 'read this first, and last' },
  { slug: 'recipes', title: 'Exam recipes', hint: 'the 8 problem templates' },
  { slug: 'cheatsheet', title: 'Formula cheat sheet', hint: 'printable' },
];

export const CALCS: Entry[] = [
  { slug: 'isentropic', title: 'Isentropic (A2)' },
  { slug: 'normal', title: 'Normal shock (A3)' },
  { slug: 'fanno', title: 'Fanno (A4)' },
  { slug: 'rayleigh', title: 'Rayleigh (A5)' },
  { slug: 'pm', title: 'Prandtl–Meyer (A6)' },
  { slug: 'oblique', title: 'Oblique shock' },
  { slug: 'moving', title: 'Moving shock / shock tube' },
  { slug: 'nozzle-pipe', title: 'Nozzle + pipe solver' },
];

export const LABS: Entry[] = [{ slug: 'engine', title: 'Rocket engine explorer (3D)', hint: 'throttle, altitude, cutaway, plume physics' }];
