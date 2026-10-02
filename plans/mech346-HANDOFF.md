# MECH 346 (Heat Transfer) — HANDOFF (read first)

Survey + inventory: `plans/mech346-survey.md`. Sources: `D:\MCGILL\mech 346\raw\` (24 PDFs + docx), text in `txt\`, page renders in `img\` (scans: `heat transfer mech 346 past exams.pdf` = MT1 Oct 19 2023 + MT2 Nov 14 2023 graded student copies; `Midterm 2 Revision Guidelines` = MT2 Nov 15 2022 with instructor-style handwritten solutions; `heat transfer ex3` = Anthony's MT1 Feb 19 2024 Q3 regrade; `Assignment 7` = solutions 7-26,7-35,7-65,7-69,7-80,7-87,7-88,7-106).
Textbook: Çengel & Ghajar 6th ed. Closed-book exams with instructor formula sheet + Tables 4-2/4-3 (one-term λ1, A1; J0/J1). MT1 = ch1–3 (incl. fins), MT2 = ch4(+lumped/one-term),6,7, Final = + ch8,9,11,12,13.

## Rules (same as MECH 430/412)
Detailed explanations (every step, why, physical meaning, numeric check), real-life examples, realistic 3D hardware visuals (Studio3D in `mech412/viz`), flag official/graded-solution errors (⚠ box + errata page), recompute everything, save incrementally, **no subagents**, don't paste slide text (McGraw-Hill copyright; write own words). Site is private.

## Done (2026-10-02)
- `src/courses/mech346/lib/`: props (CoolProp tables, propsData.ts), special (J0,J1,erf,bisect,solveLinear), conduction, fins, transient, convection, hx, radiation + `lib.test.ts` (30 tests pass: Table 4-2, assignments 3-25/3-67/3-75/3-81, MT2 2022 Q1-Q3, fin exam, Anthony's MT1 Q3, tube bank 7-106, Ex 13-8/13-9).
- Facts verified: MT2 F2022: Bi=0.002, t=179.6 s, Q=1464.7 J; brass cylinder T=42.5 °C, Q≈42.5 kJ; plate h=24.13, insulation 7.46 mm. MT1 Feb 2024 Q3: T1=132.27, T3=211.2, e_gen=4.00e6 W/m3, kB=15.5 W/mK, x_max=26.8 mm — Anthony's answers all correct (the red slash on part (a) in his scan is unexplained; regrade request in the docx).
- Graded student errors seen: MT2 Nov 2023 Q1 used Lc=0.025 for the 0.3 m sphere (V/As = D/6 = 0.05) → wrong k bound/time (52 min vs 104.7 min)/Q.

## TODO (in order)
1. Scaffold: `meta.ts`, `Course.tsx`, `CourseHome.tsx`, register in `src/courses/index.ts` (status live). Copy Studio3D/LabKit/ToolUI/Links from mech412 viz into `mech346/viz` (or import across courses).
2. Chapters (slug → file in chapters/): intro, conduction-eq, steady-conduction, fins, transient, numerical (short), convection-basics, external-flow, internal-flow, natural-convection, heat-exchangers, radiation-basics, radiation-exchange.
3. Problem pages: `practice/` or `homework/`: Ch1 assignment (1-19,53,56,71,79,80,94,98,123,127,137), Ch3 (3-25,30,33,52,67,73,75,81,91,94,102,127,138,142,145), Ch7 (7-26,35,65,69,80,87,88,106) from provided solutions; own representative sets for ch2,4,6,8,9,11,12,13.
4. Exam pages: MT1 Concordia Oct 2021, MT1 Oct 2023, MT1 Feb 2024 (Q3), MT2 Nov 2022, MT2 Nov 2023, mock finals A/B.
5. Tools (calculators) + labs (3D): conduction/pipe/wall, fin, transient (one-term), boundary layer/external, heat exchanger, radiation enclosure, natural convection.
6. Toolkit pages: summary, cheatsheet-mt1/mt2/final, recipes, errata, real-world, tables (Table 4-2/4-3, properties).
7. Stage 4: tsc, check-mdx, vitest, build (`npm run build` uses 8 GB heap), browser sweep, update memory.
- RULE: never put LaTeX in python/sed replacement strings (\t \r \f \b get eaten); use Write tool + scripts/replace_block.py. Never use | inside math in tables (use \vert). Use scripts/kt.mjs to find bad KaTeX; scripts/check-mdx.mjs for MDX.

## Progress log
- 2026-10-02: ALL 13 chapters written & clean (kt+check-mdx): intro, conduction-eq, steady-conduction, fins, transient, numerical, convection-basics, external-flow, internal-flow, natural-convection, heat-exchangers, radiation-basics, radiation-exchange.
- NEXT: homework/a07 (numbers verified; in external-flow chapter "assignment 7" section), a01, a03, then original sets a02,a03b,a04,a06,a08,a09,a11,a12; then exams/, pages/, tools+sims, labs, stage 4.
- Pitfall: python `.replace` with non-raw strings eats \n \t etc. → ALWAYS use r"..." strings in /tmp/fx.py patch scripts, and run python explicitly (echo ok does not run it).
- 2026-10-02: homework a01, a03, a07 written (verified, clean).
- a02,a03b,a04,a06,a08 written. Remaining practice: a09,a11,a12
- ALL 11 homework pages done (a01,a02,a03,a03b,a04,a06,a07,a08,a09,a11,a12). NEXT: exams/ (7), pages/ (7), tools+sims, labs, stage 4
- exams written: mt1-f2021, mt1-f2023, mt1-w2024, mt2-f2022, mt2-f2023, final-mock-a. NEXT: final-mock-b, pages/, tools+sims, labs, stage4
- final-mock-b done. exams complete. NEXT: pages/ (7), tools+sims, labs, stage4
- pages/ done: summary, real-world, cheatsheet-mt1/mt2/final, recipes, tables, errata. NEXT: tools+sims (9), labs (7), stage4 build/browser
- 2026-10-02: tools (9) + labs (7) + sims/index done; tsc clean. NEXT: stage4: check-mdx+kt all, vitest, build, browser sweep (dev server port 5317), update memory
- 2026-10-02 STAGE 4 DONE: tsc clean, check-mdx + kt on all 39 MDX, vitest 236 pass (37 in mech346), npm run build OK, browser sweep of all 55 routes (a03 had a stray `{C, B, C}` → fixed; tools+labs mount, WebGL labs render). Memory updated.
- Possible follow-ups: lab visual polish (plume particle motion, exchanger colours), no past final available (mocks are reconstructions), MT1 Feb 2024 Q1/Q2 and MT2 2024 papers not provided, deploy not set up.
