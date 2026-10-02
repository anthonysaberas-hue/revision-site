# MECH 412 — System Dynamics and Control (Winter 2024, Prof. Luc Mongeau): build plan

The plan was made by Opus; Sonnet agents execute it, **one stage at a time**. Each stage brief below is self-contained. Read `AUTHORING.md` for the shared conventions, the visual standard and the MDX pitfalls; the MECH 430 site is the reference implementation.

## ⚠ Ground rules for MECH 412 (from Anthony — read before any stage)

This course was **disorganised, and the official corrections of assignments and exams contain many mistakes**. Anthony **struggled** with it. Every agent follows these rules.

### 0. Save incrementally; be resumable (every agent, every stage)
Network errors and usage limits can kill an agent at any moment, and finished work must never be lost.
- Write each output file as soon as that unit is done: one lecture, one problem set, one exam, one page, one sim component. Never batch everything for the end.
- For long files, write the skeleton first, then fill sections with Edit calls, so partial progress is on disk.
- **On start, and on resume, check what already exists on disk and continue from there.** Never redo or overwrite a finished file unless told to.
- Keep a short progress log at `D:\MCGILL\mech 412\digests\_progress-<stage>.md` (one line per finished unit), so a resumed or replacement agent knows exactly where to pick up.

### 1. Trust nothing; verify everything
- Recompute **every** official answer (homework solutions, exam solutions, slide examples, Dorf/Ogata manual pages) with the `mech412/lib` engine, or by hand algebra, before writing it down.
- Record each check in the digests as `✔ verified` or `✘ official says X, correct is Y (reason)`.
- On the site, every disagreement gets a visible "⚠ Official solution error" callout. It says what the official answer was, what the correct one is, and the one-line reason (sign convention, algebra slip, wrong table value, wrong formula).
- Never silently "fix" anything.
- Watch for:
  - **Sign conventions:** analogies, op-amps, DC motor back-EMF, mobility vs impedance.
  - **Unit slips:** rad/s vs Hz, dB vs ratio.
  - **Copied-but-wrong textbook pages:** the lectures note an Ogata Ex 5-7 error.
  - **The "Fall 2022" decks reused in 2024 with stale details.**
- When a problem is **ambiguous or badly posed**, say so, state the interpretation used, and show how the answer changes under the other reading.
- Keep a running list in `D:\MCGILL\mech 412\digests\errata.md` (source, location, issue, correction). The site gets an **Errata** page built from it.

### 2. Simplify; intuition before algebra
Every chapter and every problem opens with plain language before any equation:
- **"The 30-second version":** what this tool is *for*, in 2–3 sentences a first-year student would understand.
- **A real-life example the reader has experienced.** Examples:
  - car suspension (mass-spring-damper, overshoot)
  - shower temperature (time delay, PID oscillation)
  - cruise control on a hill (disturbance, steady-state error, integral action)
  - home thermostat (on-off control, hysteresis)
  - drone hover (instability, Routh)
  - phone camera stabiliser / robot arm (DC motor servo)
  - toilet tank float valve (liquid-level P control)
  - car audio speaker (moving-coil transducer)
  - hydraulic excavator arm (hydraulic servo)
  - microphone hiss filtering (frequency response, Bode)
  - a bathroom scale settling (2nd-order specs)
- **"Why this works":** the intuition. For example:
  - poles = natural "personalities" of a system;
  - root locus = where those personalities move as you turn the gain knob;
  - phase margin = how much extra lag before the loop starts chasing its own tail;
  - Nyquist = "how many times does the loop's response circle the −1 danger point".
- Only then the **math**, derived step by step with one-line justifications, and a **"what this means physically"** line after each key equation.
- **"Common confusions":** the specific things students mix up (impedance vs mobility, type vs order, GM in dB vs ratio, Method 1 vs Method 2).
- Use Anthony's ⚠ weak-spot marks (Bode plotting, double divider, nonlinear circuit, T08 Q2) as signals to explain those topics **especially slowly**, with an extra worked example.
- **Prefer pictures:** every concept gets a realistic hardware visual (stage 2) or a clear plot. Show the physical system doing the thing (the suspension overshooting, the motor settling, the tank filling) next to the math.

### 3. Problem walkthroughs
Each homework and exam problem uses the standard template:
- *Think* (what kind of problem), *Plan*, *Steps*, *Answer*, *Traps*.
- **Plus a "Real-world meaning" line:** what the answer tells an engineer, e.g. "OS = 16% means the robot arm swings 16% past its target before settling".
- **Plus the verification status** of the official answer.

## Sources (all under `D:\MCGILL\mech 412\`)

| Priority | Source | Notes |
|---|---|---|
| ★★★ | `reviews\review-full.pdf` (97 p) | **Anthony's own lecture-by-lecture review of the whole course.** The backbone of every chapter and the summary. Handwriting plus slide snippets, so view pages as images. p.65–66 Review Final; p.70–71 Routh; p.73–75 Bode; p.80–86 root locus; p.87–93 lead/lag; p.94 Nyquist start. |
| ★★★ | `tablet-notes\Mech 412\*.pdf` (26 files) | Anthony's handwritten homework, tutorials (incl. Tutorial 3, Tut 8), "Representative prob", "Revision", and lecture notes from Jan 25 to Apr 23. Preferred voice for explanations. |
| ★★★ | `drive-download\PHOTO-*.jpg` (45 photos) | **Photos of Anthony's actual handwritten exam crib sheets**, rotated 90° and dense. Feb 9–11 = **MT1 crib sheet** (state-space method 2, IVT/FVT, completing the square, PFE). Mar 15–17 = **MT2 crib sheet** (transformers A:1, hydraulic tanks and valves, methods 1 and 2 for tank superposition, electrical analogs). Apr 16–22 = **final crib sheet** (error constants by type, Routh special cases, Z-N methods 1 and 2 with the S-curve tangent construction, P/PI/PID tables). These are the primary source for `cheatsheet-mt1/mt2/final` and a coverage check for `summary`. View with the Read tool (images). `412 midterm 2 tutorials.pdf` in this folder duplicates `exams\MT2-tutorials.pdf`. |
| ★★ | `reviews\cheat-sheet-mine.pdf`, `reviews\MT2-review.pdf` | His MT1 and MT2 crib sheets. His red ⚠ marks (Bode plotting, double divider, nonlinear circuit, T08 Q2) are known weak spots that need extra-clear treatment. |
| ★★ | `lectures\L01–L23.pdf` (no L06 or L16) | Slides are mostly images. L06 (Bode basics) and L16 (feedback sensitivity) must be reconstructed; see the survey. |
| ★★ | `homework\HW01–10`, `homework-solutions\`, `my-homework\` | HW5 has no official solution, only Anthony's. HW6 solution = `HW06-07-sol.pdf`. HW8-2024 has the same problems as HW10 Q2/Q4/Q5. |
| ★★ | `tutorials\T01, T04–T08`, `handouts\handout1.pdf` (MT1 handout: TF/SS method 1 and 2 plus the Laplace table), `handouts\handout2.pdf` (analogies table) | |
| ★★ | `exams\` | `MT2-W2024-solution.pdf`, `MT2-F2022-solution.pdf`, `MT2-tutorials.pdf`, `past-MT1\` (W2009, W2017, W2019 with solutions; F2007; F2011), `past-MT2\` (W2009, W2010, W2019 with solutions; W2011; W2012; make-up W2019), `past-finals\` (F2009, F2010) |
| ★ | `textbook\Ogata-Modern-Control-Engineering-5e.pdf` | Reference for the worked examples cited in the lectures |
| — | `notes-unsorted\` | **Not MECH 412.** Ignore. |

The full survey (course map with equations for every lecture, homework map, every exam question, topic frequency, simulation ideas) is saved at `plans\mech412-survey.md`. **Read it first.**

Pdftotext: `C:\Users\antho\AppData\Local\Programs\MiKTeX\miktex\bin\x64\pdftotext.exe`. Scans need the Read tool with `pages`.

## Site structure (`src/courses/mech412/`)

The course runs in three exam blocks. The sidebar groups chapters by block.

**Chapters** (slug: title, sources)

*Block 1 — Midterm 1 (L1–8):*
- `intro`: Feedback control systems (L01)
- `laplace`: Complex numbers, Laplace, partial fractions, IVT/FVT (L02, T01, HW1)
- `mech-models`: Mechanical models: Newton, energy, Lagrange; free + forced response (L03, HW2)
- `time-response`: 2nd-order specs, dominant poles, effect of zeros (L04, HW2 Q1)
- `block-diagrams`: Transfer functions, block diagram algebra, SFG and Mason (L05, L07, HW3)
- `frequency-basics`: Frequency response and Bode sketching (L06, reconstructed; HW3 Q5)
- `state-space`: State space: methods 1 and 2, Φ(t), transfer matrix, diagonalisation (L07–L09, HW4)

*Block 2 — Midterm 2 (L9–16):*
- `circuits-opamps`: Circuits, impedance, op-amps (L09–L11)
- `linearization`: Nonlinear systems and linearisation (L10, T04/T05, T06)
- `analogies`: Impedance and mobility analogies, transformers and gyrators (L11, handout 2, HW5)
- `electromechanical`: DC motors, transducers, loudspeaker (L12, T07)
- `acoustic-pneumatic`: Acoustic and pneumatic systems, nozzle-flapper, pneumatic controllers (L13–L14, HW6 Q3)
- `hydraulic-thermal`: Liquid level, hydraulic servos, thermal systems (L15, T08)
- `sensitivity`: Feedback characteristics: sensitivity, disturbances (L16, reconstructed)

*Block 3 — Final / "Midterm 3" (L17–23):*
- `steady-state-error`: System type, error constants (L17)
- `routh`: Routh–Hurwitz stability (L17–L18, HW7 Q1–2)
- `pid`: PID controllers and Ziegler–Nichols (L19, HW7 Q3–4)
- `root-locus`: Root-locus sketching and design (L20, HW7 Q5, HW9)
- `bode-margins`: Bode, polar plots, gain and phase margins (L21, HW8/HW10)
- `lead-lag`: Lead, lag and lag-lead compensation (L22, HW10)
- `nyquist`: Nyquist stability criterion (L23)

**Homework**: `hw01` … `hw10`. HW8 uses the 2024 practice sheet (solutions come from HW10-sol); HW9 and HW10 use the 2019 sheets.

**Tutorials**: `t01`, `t03` (from tablet notes), `t04` (the T05 solutions cover the T04 problems), `t06`, `t07`, `t08`.

**Exams (16 pages)**:
- MT1: `mt1-w2009`, `mt1-w2017`, `mt1-w2019`, `mt1-f2011`, `mt1-f2007`
- MT2: `mt2-w2024`, `mt2-f2022`, `mt2-w2019`, `mt2-w2019-makeup`, `mt2-w2010`, `mt2-w2009`, `mt2-w2011`, `mt2-w2012`
- Finals: `final-f2009`, `final-f2010`
- MT3: `mt3-practice` (built from the HW7–HW10 and L20–L23 examples, because no 2024-format final exists)

**Toolkit**:
- `summary`: the whole course on one page
- `cheatsheet-mt1`, `cheatsheet-mt2`, `cheatsheet-final`: one per crib sheet, seeded from Anthony's cheat sheets
- `recipes`: the 10 question templates from the survey
- `handouts`: the content of handouts 1 and 2 (Laplace table, method 1 and 2, analogies table)
- `errata`: every error found in the official solutions, slides and exams, with corrections (built from `digests\errata.md`)
- `real-world`: "control systems you use every day", a visual tour that maps each course concept to an everyday device (suspension, cruise control, thermostat, shower, drone, speaker), each linking to its chapter

**Tools (calculators)**:
- `pfe` (partial fractions and inverse Laplace)
- `second-order` (ζ, ωn ↔ OS, tr, tp, ts)
- `routh`
- `root-locus`
- `bode` (with margins)
- `nyquist`
- `lead-lag` designer
- `state-space` (Φ(t), eigenvalues, SS↔TF)

**3D labs (realistic hardware, per the visual standard)**:
- `msd`: mass-spring-damper workbench
- `dc-motor`: DC motor servo lab
- `tanks`: two-tank level control
- `hydraulic-servo`: spool valve + piston + lever + dashpot
- `pendulum`: inverted pendulum on a cart
- `cruise`: PID tuner / cruise control

## Stages (each run by **one Sonnet agent**, sequentially)

### Stage 0 — infrastructure + control library
1. **Generalise the site to multiple courses** without breaking MECH 430:
   - Factor `src/courses/mech430/Course.tsx` into a shared `src/core/CourseShell.tsx`. It takes `{ slug, title, nav groups, page globs map, components map, home component, extra routes }`. Each course keeps its own small `Course.tsx` because `import.meta.glob` needs literal paths.
   - `NoteRef` and `CalcLink` in `core/ui.tsx` currently hard-code `/mech430`. Make them read the course slug from a React context provided by `CourseShell`. Default to mech430 so existing pages keep working.
   - Add MECH 412 to `src/courses/index.ts` (status live) and to the routes in `App.tsx`.
   - Generalise `scripts/check-mdx.mjs` so it collects components from the course folder of the file being checked.
   - MECH 430 must still pass: `npx tsc --noEmit`, check-mdx on all mech430 pages, and the existing vitest.
2. **Control-systems library `src/courses/mech412/lib/`** (pure TypeScript, unit-tested):
   - polynomials (multiply, add, evaluate at complex s, roots via eigenvalues of the companion matrix or Durand–Kerner)
   - complex arithmetic
   - partial fractions with residues (distinct, repeated, complex)
   - an LTI simulator (TF → controllable canonical SS → RK4, supporting step, impulse, ramp, sinusoid, arbitrary u(t) and initial conditions)
   - second-order spec formulas
   - Routh array (with the ε and zero-row/auxiliary-polynomial cases)
   - root locus (points by sweeping K, plus asymptotes, centroid, breakaway via dK/ds = 0, jω crossings)
   - Bode (magnitude, phase, asymptotes)
   - margins (GM, PM, crossover frequencies)
   - Nyquist points plus an encirclement count
   - state space (eigenvalues, the matrix exponential Φ(t) via Padé or series, SS↔TF, methods 1 and 2)
   - Ziegler–Nichols
   - lead/lag design helpers
   - the sensitivity function
   - **Tests** must reproduce the survey's worked numbers, for example:
     - `s³+3s²+2s+K` gives 0 < K < 6
     - `K/[s(s+1)(s+2)]`: centroid −1, breakaway −0.4226, jω crossing at K = 6, ω = √2
     - the lead example α = 0.24, giving Gc = 41.7(s+4.41)/(s+18.4)
     - the Ogata Ex 11-7 lag example: PM ≈ 40°, GM ≈ 11 dB
     - PFE of `(3s²+2s+2)/[(s+2)(s²+2s+5)]` gives `2e^{−2t} + e^{−t}cos2t − 2.5e^{−t}sin2t`
     - the Ogata Ex 3-3 step response
     - the paper-machine Z-N value Ku = 3.044
     - MT2 W2024 Q3 linearised R = 1/3
3. **Scaffold** `src/courses/mech412/` with `meta.ts` (all entries above), `Course.tsx`, `CourseHome.tsx` (the three-block layout plus the exam-weight table from the survey), and empty `sims/simsA..G.tsx` and `figures/figsA..G.tsx` plus index files. Follow the mech430 pattern; only components are exported.

### Stage 1 — digests (three Sonnet agents, one after another)
Write markdown digests to `D:\MCGILL\mech 412\digests\`, in the same format as the MECH 430 digests (full statements, every step, table values, answers, Anthony's version and mistakes, traps, figure descriptions; never invent numbers).
- **1a. Lectures and reviews:** `lecture-L01..L23.md`, built from `review-full.pdf` (primary), the lecture slides, the tablet lecture notes, and the cheat sheets; plus `anthony-review-index.md`, mapping each page of review-full to its topic. Also **`crib-sheets.md`**: a faithful transcription of the three handwritten crib sheets in `drive-download\` (MT1, MT2, final), grouped by exam, preserving Anthony's wording, his methods and any errors (flag them).
- **1b. Homework and tutorials:** `HW01..HW10.md`, `T01.md`, `T03.md`, `T04-05.md`, `T06.md`, `T07.md`, `T08.md`.
- **1c. Exams:** `exam-<slug>.md` for all 15 papers. Papers without a solution get the agent's own worked solution, labelled as such and checked with the lib.

### Stage 1d — "complete the puzzle": back-fill lectures from solutions (one Sonnet agent, after 1a, 1b and 1c)
Many lecture details exist only implicitly, as the methods, formulas, conventions and tricks used in the homework and exam solutions. For each lecture digest `lecture-Lxx.md`:
1. List every homework, tutorial and exam problem that maps to it (from HW*.md, T*.md and exam-*.md).
2. For each such solution, extract every method, formula, convention, sign rule, shortcut or standard result it **uses**.
3. Diff that list against the lecture digest. Anything used in a solution but missing from the lecture is a gap. Add it to the lecture digest under **"## Back-filled from solutions"**, with a derivation or justification and the source (e.g. "used in HW5 Q3 and MT2 W2019 Q1a").
4. Gaps matter most for the missing L06 and L16 and for the thin slide decks. Rebuild those lectures as fully as possible from what the exams require.
5. Also add a **"What the exams expect you to do with this lecture"** list per lecture: the concrete skills, each linked to the problems that test them.
6. If a solution uses something **wrong**, it goes to errata (`errata-1d.md`), not into the lecture.

Output: the updated lecture digests (in place), plus `coverage-matrix.md`: a lecture × problem table showing which problems test which lecture, and any problem that tests something no lecture covers.

### Stage 2 — realistic hardware visuals (one Sonnet agent)
- Build `src/courses/mech412/viz/` with Three.js components in the MECH 430 engine-lab style: PBR metal, `RoomEnvironment`, the dark studio background `#070a12`, a blue rim light, and labels.
- Components: `MassSpringDamper3D`, `DCMotor3D` (cutaway, armature, brushes, shaft and load inertia, tach), `Tanks3D` (water with level animation, valves, pump), `HydraulicServo3D`, `CartPendulum3D`, `Car3D` (on a hill, for cruise control), and `CircuitBoard` (a realistic SVG schematic renderer for R, L, C, op-amp, transformer and gyrator, used by the analogy pages).
- Every component is driven by a time-series state from the lib simulator (positions, levels, angles) and runs in real time with play, pause and scrub.
- Then build the 6 lab pages and the 8 tool calculators. Calculators are interactive plots (Plot component) with the hardware visual where it fits.

### Stage 3 — content (Sonnet agents, one after another, each about 1 block)
- **3a.** Block 1 chapters (7) + HW1–HW4 + T01, T03
- **3b.** Block 2 chapters (7) + HW5–HW6 + T04, T06, T07, T08
- **3c.** Block 3 chapters (7) + HW7–HW10
- **3d.** MT1 exams (5) + MT2 exams (8)
- **3e.** Finals (2) + MT3 practice + summary + 3 cheat sheets + recipes + handouts page

Each content agent embeds the stage-2 visuals heavily: every modelling problem shows the real hardware moving.

### Stage 4 — review (Opus)
- Integration checks: tsc, check-mdx, vitest, build, a browser sweep of every route, and visual spot checks.
- Fixes go back to Sonnet with precise briefs.
