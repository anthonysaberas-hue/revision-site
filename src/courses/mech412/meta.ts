export interface Entry {
  slug: string;
  title: string;
  num?: string;
  /** Short hint shown in lists */
  hint?: string;
  /** exam block 1 = MT1 (L1-8), 2 = MT2 (L9-16), 3 = final / "Midterm 3" (L17-23) */
  block?: 1 | 2 | 3;
}

export const BLOCKS = [
  { n: 1 as const, title: 'Block 1 — Midterm 1', lectures: 'L1–8', blurb: 'Laplace, mechanical models, 2nd-order response, block diagrams, state space.' },
  { n: 2 as const, title: 'Block 2 — Midterm 2', lectures: 'L9–16', blurb: 'Circuits, linearisation, analogies, motors, acoustic / pneumatic / hydraulic / thermal, sensitivity.' },
  { n: 3 as const, title: 'Block 3 — Final ("Midterm 3")', lectures: 'L17–23', blurb: 'Steady-state error, Routh, PID, root locus, Bode, lead / lag, Nyquist.' },
];

export const CHAPTERS: Entry[] = [
  // Block 1
  { slug: 'intro', num: '1', block: 1, title: 'Feedback control systems', hint: 'L01' },
  { slug: 'laplace', num: '2', block: 1, title: 'Complex numbers, Laplace, partial fractions, IVT/FVT', hint: 'L02, T01, HW1' },
  { slug: 'mech-models', num: '3', block: 1, title: 'Mechanical models: Newton, energy, Lagrange; free + forced response', hint: 'L03, HW2' },
  { slug: 'time-response', num: '4', block: 1, title: '2nd-order specs, dominant poles, effect of zeros', hint: 'L04, HW2 Q1' },
  { slug: 'block-diagrams', num: '5', block: 1, title: 'Transfer functions, block diagram algebra, SFG and Mason', hint: 'L05, L07, HW3' },
  { slug: 'frequency-basics', num: '6', block: 1, title: 'Frequency response and Bode sketching', hint: 'L06 (reconstructed), HW3 Q5' },
  { slug: 'state-space', num: '7', block: 1, title: 'State space: methods 1 and 2, Φ(t), transfer matrix, diagonalisation', hint: 'L07–L09, HW4' },
  // Block 2
  { slug: 'circuits-opamps', num: '8', block: 2, title: 'Circuits, impedance, op-amps', hint: 'L09–L11' },
  { slug: 'linearization', num: '9', block: 2, title: 'Nonlinear systems and linearisation', hint: 'L10, T04/T05, T06' },
  { slug: 'analogies', num: '10', block: 2, title: 'Impedance and mobility analogies, transformers and gyrators', hint: 'L11, handout 2, HW5' },
  { slug: 'electromechanical', num: '11', block: 2, title: 'DC motors, transducers, loudspeaker', hint: 'L12, T07' },
  { slug: 'acoustic-pneumatic', num: '12', block: 2, title: 'Acoustic and pneumatic systems, nozzle-flapper, pneumatic controllers', hint: 'L13–L14, HW6 Q3' },
  { slug: 'hydraulic-thermal', num: '13', block: 2, title: 'Liquid level, hydraulic servos, thermal systems', hint: 'L15, T08' },
  { slug: 'sensitivity', num: '14', block: 2, title: 'Feedback characteristics: sensitivity, disturbances', hint: 'L16 (reconstructed)' },
  // Block 3
  { slug: 'steady-state-error', num: '15', block: 3, title: 'System type, error constants', hint: 'L17' },
  { slug: 'routh', num: '16', block: 3, title: 'Routh–Hurwitz stability', hint: 'L17–L18, HW7 Q1–2' },
  { slug: 'pid', num: '17', block: 3, title: 'PID controllers and Ziegler–Nichols', hint: 'L19, HW7 Q3–4' },
  { slug: 'root-locus', num: '18', block: 3, title: 'Root-locus sketching and design', hint: 'L20, HW7 Q5, HW9' },
  { slug: 'bode-margins', num: '19', block: 3, title: 'Bode, polar plots, gain and phase margins', hint: 'L21, HW8/HW10' },
  { slug: 'lead-lag', num: '20', block: 3, title: 'Lead, lag and lag-lead compensation', hint: 'L22, HW10' },
  { slug: 'nyquist', num: '21', block: 3, title: 'Nyquist stability criterion', hint: 'L23' },
];

export const HOMEWORK: Entry[] = [
  { slug: 'hw01', num: '1', title: 'HW1 — Laplace and partial fractions', hint: 'L02' },
  { slug: 'hw02', num: '2', title: 'HW2 — Mechanical models, 2nd-order response', hint: 'L03–L04' },
  { slug: 'hw03', num: '3', title: 'HW3 — Block diagrams, Bode (Q5)', hint: 'L05–L07' },
  { slug: 'hw04', num: '4', title: 'HW4 — State space', hint: 'L07–L09' },
  { slug: 'hw05', num: '5', title: 'HW5 — Analogies (my solutions; no official ones)', hint: 'L11' },
  { slug: 'hw06', num: '6', title: 'HW6 — Electromechanical, acoustic, pneumatic', hint: 'HW06-07-sol' },
  { slug: 'hw07', num: '7', title: 'HW7 — Routh, PID / Z-N, root locus', hint: 'L17–L20' },
  { slug: 'hw08', num: '8', title: 'HW8 — Bode, margins (2024 practice sheet)', hint: 'solutions from HW10-sol' },
  { slug: 'hw09', num: '9', title: 'HW9 — Root locus (2019 sheet)', hint: 'L20' },
  { slug: 'hw10', num: '10', title: 'HW10 — Bode, lead / lag (2019 sheet)', hint: 'L21–L22' },
];

export const TUTORIALS: Entry[] = [
  { slug: 't01', num: '1', title: 'Tutorial 1', hint: 'Laplace, from tablet notes' },
  { slug: 't03', num: '3', title: 'Tutorial 3', hint: 'from tablet notes' },
  { slug: 't04', num: '4', title: 'Tutorial 4 (with the T05 solutions)', hint: 'linearisation' },
  { slug: 't06', num: '6', title: 'Tutorial 6', hint: 'nonlinear circuits' },
  { slug: 't07', num: '7', title: 'Tutorial 7', hint: 'electromechanical' },
  { slug: 't08', num: '8', title: 'Tutorial 8', hint: 'hydraulic / thermal' },
];

export const EXAMS: Entry[] = [
  // MT1
  { slug: 'mt1-w2009', block: 1, title: 'Midterm 1 — Winter 2009' },
  { slug: 'mt1-w2017', block: 1, title: 'Midterm 1 — Winter 2017' },
  { slug: 'mt1-w2019', block: 1, title: 'Midterm 1 — Winter 2019' },
  { slug: 'mt1-f2011', block: 1, title: 'Midterm 1 — Fall 2011' },
  { slug: 'mt1-f2007', block: 1, title: 'Midterm 1 — Fall 2007' },
  // MT2
  { slug: 'mt2-w2024', block: 2, title: 'Midterm 2 — Winter 2024' },
  { slug: 'mt2-f2022', block: 2, title: 'Midterm 2 — Fall 2022' },
  { slug: 'mt2-w2019', block: 2, title: 'Midterm 2 — Winter 2019' },
  { slug: 'mt2-w2019-makeup', block: 2, title: 'Midterm 2 — Winter 2019 (makeup)' },
  { slug: 'mt2-w2010', block: 2, title: 'Midterm 2 — Winter 2010' },
  { slug: 'mt2-w2009', block: 2, title: 'Midterm 2 — Winter 2009' },
  { slug: 'mt2-w2011', block: 2, title: 'Midterm 2 — Winter 2011' },
  { slug: 'mt2-w2012', block: 2, title: 'Midterm 2 — Winter 2012' },
  // Finals and MT3
  { slug: 'final-f2009', block: 3, title: 'Final — Fall 2009' },
  { slug: 'final-f2010', block: 3, title: 'Final — Fall 2010' },
  { slug: 'mt3-practice', block: 3, title: 'Midterm 3 practice', hint: 'built from HW7–HW10 and L20–L23 (no 2024-format final exists)' },
];

export const TOOLKIT: Entry[] = [
  { slug: 'real-world', title: 'Control systems you use every day' },
  { slug: 'summary', title: 'The whole course on one page' },
  { slug: 'cheatsheet-mt1', title: 'Cheat sheet — Midterm 1' },
  { slug: 'cheatsheet-mt2', title: 'Cheat sheet — Midterm 2' },
  { slug: 'cheatsheet-final', title: 'Cheat sheet — Final' },
  { slug: 'recipes', title: 'Exam recipes', hint: 'the 10 question templates' },
  { slug: 'handouts', title: 'Handouts 1 and 2', hint: 'Laplace table, methods 1 and 2, analogies table' },
  { slug: 'errata', title: 'Errata — mistakes in the official solutions' },
];

export const TOOLS: Entry[] = [
  { slug: 'pfe', title: 'Partial fractions & inverse Laplace' },
  { slug: 'second-order', title: '2nd-order specs (ζ, ωn ↔ OS, tr, tp, ts)' },
  { slug: 'routh', title: 'Routh array' },
  { slug: 'root-locus', title: 'Root locus' },
  { slug: 'bode', title: 'Bode plot with margins' },
  { slug: 'nyquist', title: 'Nyquist plot' },
  { slug: 'lead-lag', title: 'Lead / lag designer' },
  { slug: 'state-space', title: 'State space (Φ(t), eigenvalues, SS ↔ TF)' },
];

export const LABS: Entry[] = [
  { slug: 'msd', title: 'Mass-spring-damper workbench' },
  { slug: 'dc-motor', title: 'DC motor servo lab' },
  { slug: 'tanks', title: 'Two-tank level control' },
  { slug: 'hydraulic-servo', title: 'Hydraulic servo', hint: 'spool valve + piston + lever + dashpot' },
  { slug: 'pendulum', title: 'Inverted pendulum on a cart' },
  { slug: 'cruise', title: 'PID tuner / cruise control' },
];

export const chaptersOfBlock = (b: 1 | 2 | 3) => CHAPTERS.filter((c) => c.block === b);
export const examsOfBlock = (b: 1 | 2 | 3) => EXAMS.filter((c) => c.block === b);
