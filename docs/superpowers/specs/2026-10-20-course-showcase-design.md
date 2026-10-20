# Course showcase pages — design

Date: 2026-10-20 · Status: design approved in chat; spec pending review (then /plan-ceo-review)

## 1. Intent

Each course gets **one page that summarizes the whole course the way Alexandre Younes's project pages do** (reference: alexoyou.github.io/portfolio, e.g. the Industrial Chiller Design Solver page). They are tidy, the mental model is explicit, the physics and governing equations are laid out, and a simulation **computes live on the page**, with the checks that could have proved it wrong shown on the page.

- *User said:* one page per course, Alex's way; live computation as in his refrigeration project; mental model + physics + governing equations + simulation; **light mode, black on white — no navy**; capstone projects come later (after MECH 341).
- *Assumptions:* pages live inside the private revision site; MECH 430, 412, 346 now, MECH 341 when its build is done; every number comes from that course's tested `lib/`; publishing publicly is decided separately.
- *Not copying:* structure and spirit (live solver, proof, stated gaps), not his layout pixel for pixel or his wording.

Success: someone opening `/mech430/page/showcase` understands in two minutes what the course is about, can drive the central machine and watch the physics respond, sees which equations govern it and where to learn each one, and sees how far the site's numbers have been checked.

## 2. Page anatomy (identical order for every course)

1. **Hero** — eyebrow `COURSE CODE · TERM · INSTRUCTOR`, large title (the course's machine-level question, e.g. "Why a nozzle chokes, and what a shock costs you"), one-paragraph lede in first person ("I took this in…; this page is the course compressed into one machine"), meta line (`React · tested lib · N chapters · M problems solved`).
2. **Drive it yourself** — card with 3–4 labelled sliders (monospace label left, value right), the live sim (plot/diagram), and a readout strip of 4–6 big monospace numbers. Under it, one **on-screen sanity check** that is evaluated live and shown as PASS/FAIL text (e.g. "COP 3.1 < Carnot 6.7 ✓").
3. **Proof strip** — 4–5 large numbers with one-line captions, e.g. `145 tests pass`, `65 problem answers reproduced`, `worst gap vs official solution 0.9 %`, `14 errors found and listed`. Values come from a generated file (§5), never typed by hand.
4. **01 · The mental model** — one diagram: inputs (what you are given) → the balances/equations solved (grouped) → outputs (what you are asked), drawn with the same box-and-arrow language as Alex's "one solve" figure. A caption says in two sentences how every exam problem in the course is an instance of this diagram.
5. **02 · The physics and governing equations** — 6–10 equation cards (KaTeX), each: name, the equation in the course's form, one-line physical meaning, "used in" chips linking to the chapter and 1–2 problems.
6. **03 · The machine** — the course's existing 3D lab embedded (one WebGL context), with a caption tying it to the sim above.
7. **04 · Accuracy stance** — short paragraph ("parameters are the textbook's; nothing is tuned; disagreements are listed") + table `Check · Against · Result · State` built from that course's verification data (official solutions, textbook answers, closed-form limits), including the rows that are not yet checked, marked as gaps.
8. **05 · Where it stands / where to go next** — status list (DONE / PARTIAL / GAP) and 4–6 entry links (summary, cheat sheet, best exam walkthrough, recipes, calculators).

## 3. Visual language (light mode first)

- Background `#ffffff`, text `#0a0a0a`, secondary `#555`, hairlines `#e5e5e5`; cards white with 1 px hairline border, 6 px radius, no shadows. Accent: the site's existing `--accent` (one colour), used for slider tracks, active values and the "PASS" state.
- Typography: titles in the site's sans (bold, tight leading, ~2.6 rem hero); **all labels, section numbers, slider names and readouts in a monospace** (`ui-monospace, "JetBrains Mono", "IBM Plex Mono", monospace`), uppercase with letter-spacing for labels (`01 · THE MENTAL MODEL`).
- Readout strip: value large (1.4 rem mono), unit small, caption muted beneath.
- Dark mode: honoured through the existing theme variables (black background `#000`, white text) — no navy anywhere.
- Max content width ~ 960 px; generous whitespace; phone width works (sliders full width, readouts wrap).
- All styles scoped under `.showcase` so the rest of the site is unchanged.

## 4. Flagship simulations (one per course, all physics from `lib/`)

| Course | Machine | Sliders | Live outputs | On-screen check |
|---|---|---|---|---|
| MECH 430 | Converging–diverging nozzle | back pressure p_b/p0, area ratio Ae/At, (γ) | p/p0(x) and M(x) plot, shock position, exit Mach, regime label, thrust per unit throat area | ṁ is unchanged as p_b drops below the first critical (choked) |
| MECH 412 | Closed-loop servo (DC motor plant) with PID/lead | Kp, Ki (or zero), Kd/lead zero, plant time constant | step response plot, overshoot, settling time, steady-state error, phase margin; pole map | %OS from the dominant poles agrees with the simulated peak within 2 % (or flags non-dominant cases) |
| MECH 346 | Finned heat sink on a chip | air speed, fin count, fin height, power | chip temperature, fin efficiency, h, sink resistance; temperature profile along a fin | energy balance closes: Q_in = Σ fin + base losses within 0.1 % |
| MECH 341 (later) | Air-source heat pump on a house | outdoor T, indoor T, compressor η, superheat | live P-h (and T-s) cycle, COP, Carnot COP, heating capacity, compressor work | COP < Carnot for its own temperatures across the slider range |

Sims reuse existing pieces where possible (`NozzleSim`, `FinLab`, mech412 step/locus code, MECH 341 `lib/refrig`). Each flagship is exported from its course's `sims/` as a capitalized component (`ShowcaseNozzle`, `ShowcaseServo`, `ShowcaseHeatSink`, `ShowcaseHeatPump`).

## 5. Architecture

- `src/core/showcase/` — `Showcase.tsx` exporting `ShowcaseHero`, `DriveIt`, `Readouts`, `CheckLine`, `ProofStrip`, `MentalModel` (nodes + groups as props, rendered SVG), `EqCard`, `AccuracyTable`, `Section`, `StatusList`; `showcase.css` (scoped tokens). Registered in the MDX component map once (core), available to all courses.
- Per course: `pages/showcase.mdx` + a `TOOLKIT` entry `{ slug: 'showcase', title: 'The course in one page (showcase)' }` placed first; a card on the course home linking to it; the site home page shows each live course's showcase card.
- Proof numbers: `scripts/gen-showcase-stats.mjs` writes `src/courses/<slug>/showcaseStats.json` (test count from `vitest --reporter=json`, problems with `<Problem>` in homework/exams MDX, errata rows, sims/labs counts). Run before build; the JSON is committed.
- Accuracy rows: per course `showcaseChecks.ts` (array of `{check, against, result, state}`) authored from existing verification (digests, errata, regression tests); each row with `state: 'PASS'` must name the test that proves it.

## 6. Testing / verification

- Lib-level tests for each flagship: the values the readouts show at the default slider positions (e.g. 430 default shock position and exit Mach; 341 default COP), and the sanity check asserted over a sweep of the slider range.
- `node scripts/check-mdx.mjs` on the four MDX pages, `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
- Browser sweep of the three (later four) showcase routes in light and dark mode and at phone width: no console errors, sliders update readouts, the check line shows PASS at defaults.

## 7. Scope and order

1. Core showcase components + CSS + stats script.
2. MECH 430 showcase (first, sets the template) → MECH 346 → MECH 412.
3. MECH 341 showcase added as the final phase of the MECH 341 plan.

Out of scope: capstone projects, public hosting, restyling other pages.
