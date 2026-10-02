# MECH 346 (Heat Transfer, Winter 2024, Dr. Wael Saleh) — source survey

Textbook: Çengel & Ghajar, *Heat and Mass Transfer*, 6th ed. Closed-book exams with an instructor "Summary/Formula Sheet" (equations + tables/charts handed out). Grading: 0 % assignments (one of six final problems comes straight from the assignments), MT1 20 % (Feb 19, 2024), MT2 20 % (Mar 25, 2024), Final 60 % (3 h, 6 problems). Syllabus chapters: 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13 (5 = recommended reading).

All raw files copied to `D:\MCGILL\mech 346\raw\`; extracted text in `txt\`; page renders in `img\`.

## Inventory (24 PDFs + 1 docx)
| File | What it really is | Quality |
|---|---|---|
| MECH_346_Course_Organization_Winter 2024 (×2) | syllabus, grading, topic/assignment table | text ✔ |
| Chapter 1, 2, 4, 6, 7, 8, 9, 12, 13 mech 346.pdf | McGraw-Hill instructor slides (Çengel) for the chapter | text ✔ (equations partly garbled; figures visual) |
| **Chapter 3 slides** | MISSING | — |
| **Chapter 11 (heat exchangers) slides** | MISSING (syllabus topic: LMTD, ε-NTU) | write from standard theory, original |
| SI_Heat_6e_SM_Chap01 | Çengel solutions manual, ALL of chapter 1 (85 p, problems 1-1C … 1-156) | text ✔ |
| Chapter1-Assignment and Solution | assignment solutions 1-19, 1-53, 1-56, 1-71, 1-79, 1-80, 1-94, 1-98, 1-123, 1-127, 1-137 | text ✔ |
| Chapter3-Assignment and Solution | solutions 3-25, 3-30, 3-33, 3-52, 3-67, 3-73, 3-75, 3-81, 3-91, 3-94, 3-102, 3-127, 3-138, 3-142, 3-145 | text ✔ |
| Assignment 7-mech346 | solutions 7-26, 7-35, 7-65, 7-69, 7-80, 7-87, 7-88, 7-106 (external flow) | scan (images) |
| Radiation Heat Transfer in three surface enclosures | textbook pages 790+ (network of 3 surfaces, Ex 13-8) | text ✔ |
| Formula Sheet (1) / Formula Sheet for final | instructor formula sheets (conduction eqs, Bi, one-term; final: + convection summary) | partly scan |
| Midterm-1-mech346 | NOT an exam: someone's typed/hand notes of chapter 1 | text |
| Midterm_MECH_346_Fall_2021_T | Concordia MECH 352 midterm Oct 2021 (same instructor): MCQ, fin, nuclear-rod cylinder | text ✔ |
| Midterm (2) MECH 346-Fall 2022 / Midterm 2 Revision Guidelines | MT2 Nov 15 2022: lumped carbon-steel cylinder, short brass cylinder (one-term), flat plate + insulation (external flow) — the "Guidelines" copy has a student's handwritten solutions | exam ✔, solutions handwritten |
| heat transfer mech 346 past exams (= heat transfer.pdf, 26 p scans) | MT1 Oct 19 2023 (graded student copy: MCQ, fin, radioactive sphere) + MT2 Nov 14 2023 (graded: lumped sphere, hemisphere one-term, radioactive cylinder + oil pipe + glass fibre) + formula sheets + Table 4-2/4-3 | scan, handwritten solutions with grader marks |
| heat transfer ex3 mech 346 (pdf+docx) | Anthony's own MT1 Feb 19 2024 Q3 (plane composite wall with generation in B) + regrade request (got 5/8) | scan; his solution + logic |

## What the exams look like (pattern)
- **MT1 (ch 1–3)**: Q1 six "select the wrong statement" MCQ; Q2 fin (adiabatic tip, η, ε, % error of infinite-fin approx); Q3 conduction with heat generation (sphere/cylinder/composite wall: derive T(r), BCs, centre temperature, sketch of q″). Feb 2024: Q3 composite wall A-B-C with generation in B (x_max where dT/dx = 0).
- **MT2 (ch 4–7)**: Q1 lumped system (Bi check, time, Q); Q2 one-term transient (Heisler: sphere/cylinder/hemisphere/short cylinder, product solution); Q3 external or internal forced convection with a resistance network (flat plate, pipe + insulation, cylinder crossflow).
- **Final (3 h, 6 problems)**: adds ch 8, 9, 11, 12, 13 (internal flow, natural convection, heat exchangers, radiation); one problem is an assignment problem.

## Gaps
- No past final; no Ch 3 or Ch 11 slides; assignments for Ch 2, 4, 6, 8, 9, 11, 12, 13 not provided (only numbers in the syllabus) → I write representative problems myself (original, recomputed), in exam style.
- Tables needed on the exams (properties of air/water, Table 4-2/4-3 coefficients, charts) are handed out; the site rebuilds them as calculators.
- The slides are copyrighted McGraw-Hill: **explain in my own words; never paste slide text.** The instructor's notices forbid redistributing exams: the site stays private (as with MECH 430).

## Plan (same loop as MECH 430/412)
Stage 1 digests (per chapter, per exam, assignments, errata) in `D:\MCGILL\mech 346\digests\`; Stage 2 engine `src/courses/mech346/lib` (properties, resistances, fins, transient one-term/Heisler, external/internal/natural correlations, LMTD/ε-NTU, view factors/radiation networks) + tests, calculators, realistic 3D labs (fin/heat sink, transient cooling, boundary layer, heat exchanger, furnace radiation, natural-convection plume, insulated pipe); Stage 3 chapters (11), assignments/problem pages, exam pages, toolkit (summary, cheat sheets MT1/MT2/Final, recipes, errata, real-world); Stage 4 verification + sweep. Detail level: as MECH 412 (every step, reason, physical meaning, numeric check); flag errors in exam solutions.
