export interface Entry {
  slug: string;
  title: string;
  num?: string;
  hint?: string;
  /** machine spine of the chapter */
  machine?: string;
  /** exam block 1 = Midterm (ch 8-11), 2 = Final (ch 12-17 + everything) */
  block?: 1 | 2;
}

export const BLOCKS = [
  { n: 1 as const, title: 'Block 1 — Midterm', lectures: 'Ch 8–11', blurb: 'Thermo 1 refresher and exergy, gas power cycles and jet engines, vapor power cycles, refrigeration.' },
  { n: 2 as const, title: 'Block 2 — Final', lectures: 'Ch 12–17 + everything', blurb: 'Property relations, mixtures, psychrometrics, combustion, chemical equilibrium, compressible flow, plus the jet engine again.' },
];

export const CHAPTERS: Entry[] = [
  { slug: 'review', num: '8', block: 1, title: 'Thermo 1 refresher, exergy and the second law', hint: 'entropy balance, isentropic efficiency, exergy', machine: 'car engine and power plant loss audit' },
  { slug: 'gas-cycles', num: '9', block: 1, title: 'Gas power cycles and jet engines', hint: 'Brayton, stagnation properties, thrust, ESFC', machine: 'CFM56 / LEAP turbofan; GE 7FA industrial turbine' },
  { slug: 'vapor-cycles', num: '10', block: 1, title: 'Vapor power cycles', hint: 'Rankine, reheat, feedwater heaters, cogeneration', machine: 'combined-cycle plant; nuclear PWR' },
  { slug: 'refrigeration', num: '11', block: 1, title: 'Refrigeration and heat pumps', hint: 'VCR, COP, cascade, flash, gas cycle', machine: 'house heat pump, fridge, supermarket cascade, aircraft air-cycle pack' },
  { slug: 'property-relations', num: '12', block: 2, title: 'Thermodynamic property relations', hint: 'Maxwell, Clapeyron, J-T, Z', machine: 'LNG liquefaction (J-T), CO2 transport' },
  { slug: 'mixtures', num: '13', block: 2, title: 'Gas mixtures', hint: 'Dalton, Amagat, Kay, mixing entropy', machine: 'scuba nitrox / trimix, natural gas' },
  { slug: 'psychrometrics', num: '14', block: 2, title: 'Psychrometrics and air conditioning', hint: 'ω, φ, Tdp, Twb, chart, cooling towers', machine: 'rooftop HVAC unit; power-plant cooling tower' },
  { slug: 'combustion', num: '15', block: 2, title: 'Combustion and adiabatic flame temperature', hint: 'balance, AF, dew point, HHV/LHV, AFT', machine: 'car engine (λ sensor), condensing boiler, jet combustor' },
  { slug: 'equilibrium', num: '16', block: 2, title: 'Chemical and phase equilibrium', hint: 'Gibbs, Kp, dissociation, van ’t Hoff', machine: 'NOx formation, catalytic converter, Haber process' },
  { slug: 'compressible', num: '17', block: 2, title: 'Compressible flow and nozzles', hint: 'stagnation state, Ma, choking, C-D nozzles', machine: 'airliner cruise, rocket nozzle' },
];

export const ASSIGNMENTS: Entry[] = [
  { slug: 'a01', num: '1', title: 'Assignment 1: Thermo 1 review and Brayton / jet engines', hint: '4-9 … 9-137' },
  { slug: 'a02', num: '2', title: 'Assignment 2/3: vapor power cycles', hint: '10-28 … 10-98' },
  { slug: 'a04', num: '4', title: 'Assignment 4: refrigeration', hint: '11-21 … 11-79' },
  { slug: 'a05', num: '5', title: 'Assignment 5: property relations', hint: '12-11 … 12-97' },
  { slug: 'a06', num: '6', title: 'Assignment 6: gas mixtures', hint: '13-34 … 13-72' },
  { slug: 'a07', num: '7', title: 'Assignment 7: psychrometrics', hint: '14-14 … 14-132' },
  { slug: 'a08', num: '8', title: 'Assignment 8: combustion', hint: '15-24 … 15-79' },
  { slug: 'a09', num: '9', title: 'Assignment 9: chemical equilibrium', hint: '16-4C … 16-56' },
  { slug: 'a10', num: '10', title: 'Assignment 10: compressible flow', hint: '17-18 … 17-62' },
];

export const EXAMS: Entry[] = [
  { slug: 'final-2021', block: 2, title: 'Final — April 20, 2021' },
  { slug: 'midterm-review', block: 1, title: 'Midterm review class — Oct 2023 (ch 9–11)' },
  { slug: 'tutorial-16', block: 2, title: 'Tutorial: chapter 16 problems' },
  { slug: 'tutorial-17', block: 2, title: 'Tutorial: chapter 17 problems' },
  { slug: 'final-mock-a', block: 2, title: 'Final practice A (mock, reconstruction)' },
  { slug: 'final-mock-b', block: 2, title: 'Final practice B (mock, reconstruction)' },
];

export const TOOLKIT: Entry[] = [
  { slug: 'real-world', title: 'Where the thermodynamics lives: the machines' },
  { slug: 'summary', title: 'The whole course on one page' },
  { slug: 'cheatsheet-midterm', title: 'Cheat sheet — Midterm (ch 8–11)' },
  { slug: 'cheatsheet-final', title: 'Cheat sheet — Final (ch 12–17 + jet engine)' },
  { slug: 'recipes', title: 'Exam recipes', hint: 'question templates and traps' },
  { slug: 'tables', title: 'Tables: which one to use when' },
  { slug: 'errata', title: 'Errata — mistakes in the exams and solutions' },
];

export const TOOLS: Entry[] = [
  { slug: 'props', title: 'Fluid properties (water, R-134a)' },
  { slug: 'brayton', title: 'Brayton cycle and turbojet' },
  { slug: 'rankine', title: 'Rankine cycle (reheat, feedwater heaters)' },
  { slug: 'refrigeration', title: 'Refrigeration cycles' },
  { slug: 'psychro', title: 'Psychrometric chart and processes' },
  { slug: 'combustion', title: 'Combustion and flame temperature' },
  { slug: 'equilibrium', title: 'Chemical equilibrium' },
  { slug: 'nozzle', title: 'Isentropic nozzle flow' },
];

export const LABS: Entry[] = [
  { slug: 'turbofan', title: 'Turbofan cutaway lab' },
  { slug: 'power-plant', title: 'Power-plant lab' },
  { slug: 'heat-pump', title: 'Heat-pump lab' },
  { slug: 'hvac', title: 'HVAC and cooling-tower lab' },
  { slug: 'burner', title: 'Burner lab (equivalence ratio)' },
  { slug: 'nozzle', title: 'Converging-diverging nozzle lab' },
];

export const chaptersOfBlock = (b: 1 | 2) => CHAPTERS.filter((c) => c.block === b);
export const examsOfBlock = (b: 1 | 2) => EXAMS.filter((c) => c.block === b);
