# HANDOFF — read this first (written 2026-10-01 by Opus before compaction / switch to Sonnet 5.5)

This file lets a fresh session (Sonnet 5.5) continue the project without re-reading anything already processed. Read it fully, then `plans/mech412-plan.md`. Only open source PDFs for the work listed as **remaining**.

---

## 0. Who and what
- **User:** Anthony Saber, a McGill Mechanical Engineering graduate (2024–25) who is forgetting his courses. He is building a personal revision website, **one course at a time**.
- **Site:** `D:\MCGILL\revision-site`, React 18 + Vite 5 + TypeScript + MDX (remark-math, KaTeX, rehype-slug) + Three.js, with a HashRouter.
- **Dev server:** `cd /d/MCGILL/revision-site && npx vite --port 5317 --strictPort` (add `--force` if modules look stale). URL: http://localhost:5317/#/
  - If the page is blank with "does not provide an export named default", the server is serving stale modules. Kill the process on port 5317 and restart with `--force`.
- **Shells:** the Bash tool is Git Bash (use `/d/...` paths); the PowerShell tool is also available.

## 1. User preferences (also saved in memory: `C:\Users\antho\.claude\projects\C--Users-antho-Downloads\memory\`)
1. **Realistic visuals.** Every hardware schematic or demo must look like real equipment: 3D half-sections, PBR metal, a dark studio look like the rocket-engine lab. Not flat SVG boxes. Plots and charts can stay 2-D.
2. **Teaching style.**
   - Intuition first: a "30-second version", then an everyday real-life example, then "why it works", then the step-by-step math with "what this means physically", then common confusions.
   - Explain his self-marked ⚠ weak spots extra slowly.
3. **Verify everything.**
   - Recompute every official answer. Flag errors visibly ("⚠ Official solution error") and keep errata.
   - MECH 412's official corrections are known to be full of mistakes.
4. **Save incrementally.**
   - Write each finished unit to disk immediately and keep `_progress-<stage>.md` logs.
   - On resume, continue from what exists; never redo finished work.
5. **Subagents.** The most recent instruction is **"don't send subagents, do all the work yourself"**. The main session does the work directly. Earlier the user wanted planning on Opus and execution on Sonnet, with at most 3 parallel agents; he now switches the main session to Sonnet 5.5 instead. Do not spawn agents unless he asks again.
6. **Detail level (MECH 412), newest instruction.** User asked (2026-10-01): be *more detailed* in explanations and in worked solutions than MECH 430: every algebra step shown, reason for each step, physical meaning per step, a numeric check at the end.
7. **One-page summary.** He wants a one-page "whole course" summary per course, plus cheat sheets.

## 2. Repo architecture (already built, working)
- `src/core/`
  - `CourseShell.tsx`: generic course routing, layout and MDX provider. Config: `{slug, title, navGroups, pageKinds:{kind:{label, glob, list}}, components, Home, Calc?, extraRoutes?}`.
  - `ui.tsx`: components plus `CourseContext` / `useCourseSlug`. `NoteRef` and `CalcLink` are course-aware.
  - `Plot.tsx`, `Layout.tsx`, `ErrorBoundary.tsx`.
- `src/courses/index.ts` (course registry) and `src/App.tsx` (routes `/mech430/*`, `/mech412/*`).
- **Authoring rules:** `AUTHORING.md` (written for MECH 430 but generic): component list, the Problem template (`Problem > Statement / Think / Plan / Steps>Step / Answer / Traps / Source`), and MDX pitfalls (no `{}` outside math, no `<` before letters, blank lines inside JSX blocks).
- **MDX checker:** `node scripts/check-mdx.mjs <files>` (course-aware).
- **Verification:** `npx tsc --noEmit`, `npx vitest run`, `npx vite build`. All were passing at handoff (194 tests).
- **Exports:** sims and figures files may export **only capitalised React components**. CourseShell filters the component map to capitalised functions and wraps each in an ErrorBoundary.

## 3. MECH 430 (Compressible Flow, W2025, Prof. Higgins): **COMPLETE**
- 17 chapters, PS1–11, 6 exams, recipes, cheat sheet, one-page summary, 8 calculators, and the 3D rocket engine lab `/mech430/lab/engine`.
- Realistic flow sections come from `src/courses/mech430/viz/FlowSection3D.tsx`, which can be reused or adapted.
- All pages swept in the browser with no errors. Nothing to do here unless the user asks.

## 4. MECH 412 (System Dynamics and Control, W2024, Prof. Luc Mongeau): IN PROGRESS

### Key files
- `plans/mech412-plan.md`: **the full plan**: ground rules, sources and priorities, site structure (21 chapters in 3 blocks, HW1–10, tutorials, 16 exam pages, toolkit, 8 tools, 6 labs), stages 0–4 with briefs.
- `plans/mech412-survey.md`: the full course map (every lecture's equations and examples), homework map, every exam question, topic frequencies, simulation ideas.
- **Sources:** `D:\MCGILL\mech 412\`
  - `reviews\review-full.pdf`: 97 pages, **Anthony's own complete review; the most important source**. Identical to `C:\Users\antho\Downloads\Mech 412 review.pdf`.
  - `tablet-notes\Mech 412\`: his handwritten HW, tutorial and lecture notes.
  - `drive-download\PHOTO-*.jpg`: photos of **his actual exam crib sheets**. Feb 9–11 = MT1, Mar 15–17 = MT2, Apr 16–22 = final.
  - Also: lectures, homework, solutions, tutorials, exams, handouts, textbook (see the plan).
- **Digests (the content source of truth):** `D:\MCGILL\mech 412\digests\`

### Stage status
| Stage | Status |
|---|---|
| 0 infra + control lib | ✅ DONE. `src/courses/mech412/lib/` (complex, poly, pfe, lti, specs, routh, rootLocus, freq, stateSpace, design, verify) with 49 tests; scaffold `meta.ts`, `Course.tsx`, `CourseHome.tsx`; empty sims/figures A–G; empty content folders. |
| 1a lecture digests | ✅ **COMPLETE** (L01–L23, crib-sheets.md, anthony-review-index.md, errata-1a.md) |
| 1b HW and tutorial digests | ✅ **COMPLETE**: HW01–HW10, T01, T04-05, T06, T07, T08, lecture-exercises.md (T03 has no file in the archive; tablet notes `Tutorial 3_*.pdf` not digested), errata-1b.md updated |
| 1c exam digests | ✅ **ALL 16 PAPERS DONE** (mt1-f2007/w2009/f2011/w2017/w2019; mt2-w2009/w2010/w2011/w2012/w2019/w2019-makeup/f2022/w2024; final-f2009/f2010). **Remaining: `exam-patterns.md` only** (topic-frequency + recurring templates; use the survey §3 + these digests) and merge any new errata into errata-1c.md (new findings: MT2-W2010 'solutions' file is a graded student sheet; MT1-W2009 bullet MCQ hedge; MT1-F2011 Q4 alpha=10 gives 16.7% OS; F2010 P7c inconsistent; MT2-W2019 '36' typo; MT2-F2022 Q1a impedance capacitor label) |
| 1d "complete the puzzle" | ✅ DONE: all 23 lecture digests have `## Back-filled from solutions` and `## What the exams expect`; `coverage-matrix.md`, `exam-patterns.md`, merged `errata.md` (in digests/) written |
| 2 realistic visuals, labs, tools | not started |
| 3 content pages | not started |
| 4 review | not started |

**Cleanup needed:** delete the leftover scratch tests `src/courses/mech412/lib/scratch-1a.test.ts`, `scratch-1b.test.ts` and `scratch-1c.test.ts` (they were throwaway computation files; check they don't break `vitest run`).

**Digest format:** copy the style of the existing files (e.g. `lecture-L09.md`, `HW05.md`, `exam-mt2-w2024.md`). Every problem has:
- the full statement;
- Type/concepts;
- **Methods used** (with lecture tags);
- the official solution, or a "digest-author solution";
- Anthony's version;
- answers;
- Traps;
- figure descriptions;
- **Real-world meaning**;
- **Verification status** (✔ / ✘ with reason).
Lecture digests have: Topics, Key equations, Worked examples (verified), **Gaps noticed**, Anthony's weak spots, Suggested real-life example.

## 5. What the last session already READ but has not yet written (no need to re-read)

### review-full.pdf page map (verified pp.1–57; pp.58–97 from the survey)
| Pages | Content |
|---|---|
| 1–27 | L01–L08 (already digested) |
| 28–30 | L09 |
| 31–32 | L10 |
| 33–35 | L11 |
| 36 | L12 |
| 37–38 | L13 |
| 39 | L14 |
| 40–41 | L15 |
| **42–57** | **"Review Midterm 2"**: his MT2 crib material, still to be written into `crib-sheets.md` |
| 58–97 (from survey; **still to read**) | L16 material; p.65–66 "Review Final" (open- vs closed-loop e_ss, gain sensitivity, system types); p.70–71 Routh (special cases, K range); p.71 PID forms; p.73–75 Bode building blocks, polar plots, error constants from Bode; p.80 root-locus compensator Gc = 1.6(s+2)/(s+4) on 5/[s(0.5s+1)] at s = −2 ± j2√3; p.81–83 valve-cylinder pole placement; p.84–86 tach-feedback root locus for ζ = 0.4 (K′ = 9, k = 0.45); p.87–90 lead/lag/lag-lead summary + lead example Gc = (10/0.24)(s+4.4)/(s+18.4); p.91–93 lag Ogata Ex 11-7; p.94 Nyquist premise; p.95–97 blank |

### Content of review pp.42–57 ("Review Midterm 2"), already read; use it for crib-sheets.md
- **Electrical:**
  - Z_R = R, Z_C = 1/(Cs), Z_L = Ls; stored energy ½Li².
  - Transformer 1:m: e₃₄ = m·e₁₂, i_b = i_a/m, e₃₄i_b = e₁₂i_a.
  - Gyrator: I₁ = U₂/S, U₁ = I₂S.
  - Series and parallel impedance.
  - KVL two-loop example; sign rule: going − → + counts as −V, + → − as +V.
  - KCL node example: (V_A − V_in)/R₁ + V_A/R₂ + (V_A − V_o)/R₃ = 0.
  - Voltage divider E_out/E_in = Z₁/(Z₁ + Z₂), with Z₁ the element the output is across.
  - **Double divider** (Z₂ series, Z₁ shunt, Z₃ series, Z₄ shunt): he wrote "e_out/e_in = ???" with a red ⚠. This is an **explicit gap**. Correct result:
    - E_out/E_in = Z₁Z₄ / [Z₁(Z₃ + Z₄) + Z₂(Z₁ + Z₃ + Z₄)]
    - equivalently, the first divider is loaded by (Z₃ + Z₄).
    - Verify with the lib before using.
  - Sinusoidal response: set s = jω, A = |V_out/V_in|, φ = ∠(V_out/V_in).
  - "Bode plot diagram ⚠??": an **explicit gap / weak spot**.
- **Op-amps:**
  - V⁻ = V⁺ ≈ 0, i⁻ = 0, KCL at node a: (e_i − V_a)/Z₁ = (V_a − e_o)/Z₂, so V_out = −(Z₂/Z₁)V_in.
  - T-network Z₁–Z₂–Z₃ left "V_out/V_in = ?": a gap.
  - **"⚠ Tut 6 Q1: always take i at nodes"**: write KCL at every node, e.g. (V_a − V_in)/Z + (V_a − V_c)/Z + (V_a − V_b)/Z = 0. Examples:
    - R₁ input with R₂ ∥ C feedback: (V_a − V_out)/R₂ + (V_a − V_out)/Z_C + (V_a − V_in)/R₁ = 0
    - R₁ input with (R₂ + C) feedback: (V_a − V_in)/R₁ + (V_a − V_out)/Z_eq = 0
- **Nonlinear systems:**
  - F(x, u) ≈ F(x̄, ū) + A(x − x̄) + B(u − ū), A = ∂F/∂x and B = ∂F/∂u at (x̄, ū), x̂ = x − x̄, û = u − ū.
  - "Non-linear circuit example ⚠⚠??" and "Linear vs Non-linear circuits (Tut 3) Q2!": explicit gaps, high priority.
- **Analogies table** (mobility | impedance):
  - mass → capacitor M_M | inductor M_M
  - spring → inductor C_M = 1/k | capacitor C_M = 1/k
  - dashpot → resistor 1/R_M | resistor R_M
  - constant-velocity source → voltage source | current source
  - constant-force source → current source | voltage source
- **Mobility rules:**
  - Two masses joined by k ∥ R_M: masses are capacitors to ground, with the spring and damper between their nodes.
  - F(t) → spring → mass gives a series F–C_M–M_M loop.
  - A wall-mounted spring and dashpot plus a mass gives everything in parallel: M_M ∥ C_M ∥ 1/R_M.
  - **"If there is a force input, start with that component."**
  - Chain 1–k–2–k–3.
  - **Lever** (l₂ on the M₂ side, l₁ on the M₁ side): mobility transformer (l₁/l₂):1; impedance (l₂/l₁):1. A lever with three masses uses ratio (l₁+l₂)/l₁ : 1 and l₁/l₂ : 1.
  - **Gears** m₁, m₂: mobility (m₂/m₁):1; impedance (m₁/m₂):1. (m = number of teeth, i.e. radius.)
- **DC motor** (his p.47–48):
  - τ_L − τ_m = τ_e, τ_e = K_tI_f i_a(t), E_mf = K_bω.
  - Circuit: e_i → R_A → L_A → transformer K:1 → J (capacitor) ∥ 1/B.
  - E_i(s) = E_mf + (R_A + L_As)I_A(s); (J_As + B)ω(s) + τ_e = 0, so I_A = −(J_As + B)ω/(K_tI_f).
  - Boxed result: **E_i(s)/ω(s) = [K_tI_fK_b − (R_A + L_As)(J_As + B)] / (K_tI_f)**.
  - ✘ **Sign-convention issue:** with the usual convention (J s + B)ω = K_t I_f I_A, the result is E_i/ω = [K_tI_fK_b + (R_A + L_As)(J_As + B)]/(K_tI_f). His minus sign comes from defining τ_e with the opposite sign (τ_L − τ_m = τ_e); T07 Q1 uses the same convention.
  - Flag in errata as "convention-dependent; physically the denominator must be + for a stable motor". Check what T07-sol (the official tutorial solution) uses before declaring which is "official".
- **"Lecture 12 rep prob"** (p.48, 57): the DC motor between terminals A and B gives V_A − V_B = I_AR_A + K_eω(s). And I_A = V_B(1/R + 1/R_S); for R_S ≪ R, V_B = I_AR_S (current-sensing resistor).
- **Acoustic** (p.49):
  - Mechanical impedance → acoustic impedance uses an **S:1 transformer**; mechanical mobility → acoustic impedance uses a **1/S gyrator**.
  - Air mass → inductor M_A, cavity → capacitor C_A, resistance → R_A (acoustic impedance analog).
  - Two worked circuits:
    - (1) Piston M_p (mechanical) → A:1 transformer → network of M_A1–M_A4, C_A1–C_A3, R_f, Z_term, with coloured groupings for the side branches.
    - (2) Tube M_A1 with a side Helmholtz branch (M_A3 + C_A) and a tail M_A2 → R_f: a source, then series M_A1, then the shunt (M_A3 + C_A) branch, then series M_A2, then R_A.
- **Pneumatic** (p.50–51):
  - Lever y/a = z/b.
  - Nozzle-flapper x = (b/(a+b))e − (a/(a+b))y, P_b = K₁x.
  - Pressure separation (relay) P_b = K₁z, P_c = K₂z.
  - Bellows P_iA = k(x − z).
  - Hydraulic servo y/w = K_H/s.
  - TF = output/input, or output/error.
  - **"Tut 8 Q2 ⚠⚠?"**: weak spot.
  - Lecture 14 theory PD/PI/PID; valve R → bellows capacitance C with area A and spring k gives **X(s)/P_i(s) = (A/k)·1/[R(C + A²/k)s + 1]**.
    - His handwriting is ambiguous ("C + 1/(KA²)"). The physically correct effective compliance is C + A²/k, since bellows volume change is dV = A·dx = A²dp/k. Verify and use C + A²/k.
- **Hydraulic** (p.52–53):
  - Tank: q_in − q_out = C dh/dt = CsH. Valve: q = (h₁ − h₂)/R, or h₁/R when draining to atmosphere.
  - **Multiple inputs (Tut 8 Q1), superposition:**
    - Tank 1: q_i − q₁ = C₁sH₁, q₁ = H₁/R₁. Tank 2: (q₁ + q_d) − q_o = C₂sH₂, q_o = H₂/R₂.
    - Case 1 (q_d = 0) gives H₂/Q_i; case 2 (q_i = 0) gives H₂/Q_d.
    - H₂ = (case 1)Q_i + (case 2)Q_d.
    - Block diagram: Q_i → (−) → K_p → [case 1] → (+, with Q_d·[case 2]) → H₂, with unity feedback.
  - Tank circuits: a single tank is a current source q_i with C_l ∥ R_l. Two tanks: q_i → C_l1 to ground → R₁ρg → C_l2 to ground ∥ R₂ρg.
  - Thermometer: θ_b → R → θ(t) across C.
- **Electrical KVL example** (p.54):
  - E₁ with R₁, E₂ with R₂, R₃.
  - Loop 1: −E₁ + E₂ + R₂(i₁ − i₂) + R₁i₁ = 0. Loop 2: −E₂ + R₃i₂ + R₂(i₂ − i₁) = 0.
  - Bridged-T node equations: (V₂ − V_in)/Z_C + (V₂ − 0)/R + (V₂ − V_o)/Z_C = 0 and (V_out − V₂)/Z_C + (V_out − V_in)/R = 0 (HW3 Q2 / MT1 W2019 bridged-T).
- **Representative problems:**
  - Sinusoidal response: set s = jω.
  - R: e = iR; C: e = (1/C)∫i dt + e(0); L: e = L di/dt.

### Errata found so far by the main session (to merge into the errata page)
1. Ogata Ex 11-7 lag: quoted "PM ≈ 40°, GM ≈ 11 dB, uncompensated PM −20°". Exact: **PM 41.6°, GM 14.2 dB, uncompensated PM ≈ −13°** (lib test asserts this).
2. review p.28: transformer "e₃₄ = e₁₂" is missing m. Correct: e₃₄ = m·e₁₂ (his p.42 is right).
3. review p.30: voltage divider "1/(RCs + L)". Correct: **1/(RCs + 1)**.
4. review p.39: PD controller labelled "K_p(1 + 1/(T_d s))", which is the PI form. PD = K_p(1 + T_d s).
5. review p.47–48: DC motor E_i/ω sign (see above): convention-dependent.
6. review p.50: bellows effective capacitance written ambiguously. Use C + A²/k.
7. Paper-machine Ku: computed 3.03 vs the quoted 3.044 (0.5%, fine).
8. Gear-ratio direction on the L11 slide: (n₂/n₁):1 is shown on both analogs. His crib sheet: mobility (m₂/m₁):1, impedance (m₁/m₂):1. Verify against a homework or exam solution.
- Errata inside the existing digests: see `errata-1b.md`, `errata-1c.md`, and "✘" lines in `lecture-L0x.md`.

## 6. Exact next steps (in order)
(STATUS 2026-10-01 night: STAGE 1 (1a-1d) FULLY DONE incl. exam-patterns, coverage-matrix, errata.md. NEXT = step 6 Stage 2 (viz/labs/tools), then Stage 3 content, Stage 4 review. Also delete scratch tests + .tmp-pages/.tmp-photos.)
1. **[DONE] Finish 1a:**
   - Read `review-full.pdf` pp.58–97 (in chunks of ≤ 10 pages with the Read tool) plus the relevant lecture slides.
   - Write `lecture-L16.md` (reconstructed: sensitivity S^T_G = 1/(1+GH), S^T_H = −GH/(1+GH), disturbance rejection, open- vs closed-loop error; see the survey's L16) through `lecture-L23.md`.
   - Then `crib-sheets.md`: transcribe the `drive-download\` photos (MT1, MT2, final) **and** the review pp.42–57 material summarised above.
   - Then `anthony-review-index.md` (use the page map above) and `errata-1a.md` (merge §5 errata and "✘" lines from the lecture digests).
   - Append each to `_progress-1a.md`.
2. **[DONE] Finish 1b:** HW06–HW10 and the tutorial digests (see `_progress-1b.md`; sources in the plan). HW8 = the 2024 practice sheet, solved via HW10-sol.
3. **[almost done: only exam-patterns.md] Finish 1c:** the remaining 12 exam papers plus `exam-patterns.md`. Start with those that have solutions: mt2-w2019, mt1-w2009, mt2-w2009, mt2-w2010, mt1-f2011.
4. **1d "complete the puzzle":** back-fill lectures from the "Methods used" lines; write coverage-matrix.md. Prioritise L06, L16, the ⚠ gaps above (double divider, nonlinear circuits, Bode plotting, T08 Q2, Tut 3 Q2) and the analogy drawing rules.
5. **Merge** errata-1a/1b/1c/1d into `errata.md`.
6. **Stage 2:** visuals, labs and tools. Build `src/courses/mech412/viz/`: MassSpringDamper3D, DCMotor3D (cutaway), Tanks3D, HydraulicServo3D, CartPendulum3D, Car3D, CircuitBoard. Use the MECH 430 engine-lab and FlowSection3D style. Then the 6 lab pages and 8 tool calculators (see the plan for slugs).
7. **Stage 3:** content.
   - 21 chapters (3 blocks), HW1–10, tutorials.
   - 16 exam pages: mt1-*, mt2-*, final-*, mt3-practice.
   - Toolkit: real-world, summary, cheatsheet-mt1/mt2/final, recipes, handouts, errata.
   - Follow the teaching-style rules and the visual standard; save each page as it's finished.
8. **Stage 4:** run tsc, check-mdx, vitest and build; sweep every route in the browser; spot-check the visuals.

## 7. Useful facts
- **Lib conventions:**
  - Polynomials are real arrays, highest power first.
  - `TF = {num, den, delay?}`, `SS = {A,B,C,D}`, complex numbers are `{re, im}`.
  - `verify(expected, actual, tol)` returns 'ok' or a message.
  - For quick computations, write a throwaway vitest file that console.logs, run it, then delete it.
- **MECH 412 routes:** `/mech412/{ch,hw,tut,exam,page,tool,lab}/:slug`. Slugs are in `src/courses/mech412/meta.ts`; unwritten slugs show a "Being written" placeholder.
- **Exam blocks:** MT1 = L1–8, MT2 = L9–16, the final ("MT3") = L17–23 plus 2 review problems. No 2024-format final exists, so build `mt3-practice` from HW7–10 and the L20–L23 examples.
- **Most examined:** analog circuits (every MT2 Q1), TF derivation, state space, time response, linearisation of nonlinear circuits, block diagrams, op-amps, e_ss and sensitivity.


## 8. STATUS UPDATE (2026-10-02): Stage 2 done, Stage 3 started
- **Stage 2 DONE:** `src/courses/mech412/viz/` has Studio3D (shared Three.js host), LabKit, MassSpringDamper3D, DCMotor3D, Tanks3D, HydraulicServo3D, CartPendulum3D, Car3D, CircuitBoard (SVG ladder renderer), Blocks (BlockDiagram, ControlLoopFigure), ToolUI/ToolsA/ToolsB (8 calculators), Links (ToolLink, LabLink, Ex, Hw, Ch). `lib/plants.ts` (+tests), `lib/parse.ts` (+tests). All registered via `sims/simsA.tsx` (labs), `sims/simsB.tsx` (tools), `figures/figsA.tsx` (CircuitBoard, links), `figures/figsB.tsx` (blocks). The 6 lab pages (`labs/*.mdx`) and 8 tool pages (`tools/*.mdx`) are written and verified in the browser.
- **Stage 3 (content) in progress.** Pages go in `chapters/`, `homework/`, `tutorials/`, `exams/`, `pages/`. Written so far: see `ls src/courses/mech412/chapters` etc. Chapter template (follow `chapters/intro.mdx`): eyebrow, `# title`, `<div className="lede">`, `<Idea title="The 30-second version">`, real-life example, why it works, derivations with "what this means physically", embedded lab/tool, `<Examined>`, "Check yourself". **Detail level: more detailed than MECH 430** (user request). Use `<ToolLink tool="pfe">`, `<LabLink lab="tanks">`, `<Ex id="mt2-w2012">`, `<Hw n="6">`, `<Ch slug="analogies">`; blocks via `<BlockDiagram blocks=[...] feedback=... />`; circuits via `<CircuitBoard source=... sections=[...] />` (see `viz/CircuitBoard.tsx` for the Section types).
- Dev server: `cd /d/MCGILL/revision-site && npx vite --port 5317 --strictPort`.

- **2026-10-02 later: ALL 21 CHAPTERS WRITTEN and sweep-verified (no KaTeX errors).** Remaining Stage 3: homework pages hw01-hw10, tutorials t01 t03 t04 t06 t07 t08, exams (16 pages, slugs in meta.ts), toolkit pages (real-world, summary, cheatsheet-mt1/mt2/final, recipes, handouts, errata). Use `<Problem>` template (see AUTHORING.md). Sweep helper: in the browser console define `window.sweep(routes)` (navigate by location.hash, wait 4.5 s, count .katex-error).

- **2026-10-01 (later): Stage 3 progress.** DONE and check-mdx clean: homework hw01–hw10 (all 10), tutorials t01 t03 t04 t06 t07 t08 (t03 reconstructed from Anthony's method page — no source file), ALL 16 exam pages (mt1-w2009/w2017/w2019/f2011/f2007; mt2-w2024/f2022/w2019/w2019-makeup/w2010/w2009/w2011/w2012; final-f2009/f2010; mt3-practice, a constructed mock on the plant K/[s(s+1)(s+5)] + Ogata 11-6 lead + Nyquist + 2 review items). **REMAINING Stage 3:** toolkit pages in `src/courses/mech412/pages/`: real-world, summary, cheatsheet-mt1, cheatsheet-mt2, cheatsheet-final, recipes, handouts, errata (sources: digests/crib-sheets.md, exam-patterns.md, errata.md, handout info in L-digests). Then Stage 4: tsc, check-mdx on all, vitest, `npx vite build`, browser sweep of every route (ch, hw, tut, exam, page, tool, lab), CourseHome review, update memory. New errata found while writing (add to errata page): MT1 W2019 Q4 official overshoot 39% should be 40.7% and "no way to reduce" is false; MT1 F2011 Q4 α=10 gives 16.7%; MT2 W2019-MU (no key); L21 digest peak +1.9 dB for ζ=0.5 section should be +1.25 dB (T6 Q1); F2010 P7(c) K=5/3 unstable; MT2 W2019 Q3 "36" typo; T07 Q3 elimination; HW10 Q3 AP10.9 missing gain 50; HW10 Q5(b) wrong L; F2009 P5 zero makes OS 13.9%; MT2 F2022 Q1a impedance capacitor label.

- **2026-10-01 (latest): STAGE 3 CONTENT COMPLETE.** All pages written: 21 chapters, hw01–hw10, t01 t03 t04 t06 t07 t08, 16 exams (incl. mt3-practice mock), 8 toolkit pages (real-world, summary, cheatsheet-mt1/mt2/final, recipes, handouts, errata). **NEXT = Stage 4:** `npx tsc --noEmit`, `node scripts/check-mdx.mjs` on all, `npx vitest run`, `npx vite build`, browser sweep of every route (ch, hw, tut, exam, page, tool, lab) for .katex-error / error text, spot-check CircuitBoard figures in hw05, hw06, mt2-w2024, mt2-w2019, mt2-w2019-makeup, mt2-w2010, mt2-w2012, mt2-w2009, mt3-practice; review CourseHome; update memory file revision-site-project.md.
- Build needs a bigger heap (many MDX pages): package.json build script now uses --max-old-space-size=8192 (npx vite build alone OOMs).

- **2026-10-01 STAGE 4 DONE:** tsc clean; check-mdx clean on all 75 MECH 412 pages; vitest 205/205; `npm run build` OK; browser sweep of every route (ch, hw, tut, exam, page, tool, lab): 0 KaTeX errors, 0 component errors. Long CircuitBoards split in two for legibility (hw06 Q1, mt2-w2010 Q1). **MECH 412 is COMPLETE.** Optional polish: digest Anthony's tablet "Tut 3" notes (none in archive), proofread, deploy. Next course (per memory): MECH 331 / MECH 315 / MECH 393 — repeat survey → digests → pages loop.
