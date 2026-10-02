# Authoring guide — MECH 430 revision site

**Who reads this site:** Anthony, a McGill mechanical-engineering graduate who took MECH 430 (Compressible Flow, Prof. A.J. Higgins, Winter 2025) and has forgotten most of it.

**The guiding test:** *if he opens this in 5 years with nothing else, can he solve the Quiz 2 and the final?* So every page must teach the **thinking** — why this relation, why this regime — and not just the algebra. Visualize as much as possible.

## Where things are

| What | Path |
|---|---|
| Chapters | `src/courses/mech430/chapters/<slug>.mdx` — slugs are in `src/courses/mech430/meta.ts` (`CHAPTERS`) |
| Problem sets | `src/courses/mech430/problemsets/ps01.mdx` … `ps11.mdx` |
| Exams | `src/courses/mech430/exams/q2-w2019.mdx`, `q2-w2023`, `q2-f2023`, `q2-w2024`, `final-a`, `final-b` |
| Toolkit pages | `src/courses/mech430/pages/recipes.mdx`, `cheatsheet.mdx` |
| Your simulations | `src/courses/mech430/sims/sims<GROUP>.tsx` (**only your group's file**) |
| Your static figures | `src/courses/mech430/figures/figs<GROUP>.tsx` (**only your group's file**) |
| Gas-dynamics engine | `src/courses/mech430/lib/*.ts` (tested — **do not edit**; add new files like `lib/moc.ts` if you need them) |
| Your regression tests | `src/courses/mech430/lib/<yourname>.test.ts` (new file) |

**Source digests** are the authoritative content, with every number already checked. They are in `D:\MCGILL\mech 430\2025\digests\`:
- `PS01.md` … `PS11.md`
- `exam-*.md` and `exam-prep-method.md`
- `lecture-notes-*.md`

**Course notes** (typed, 157 pp): `D:\MCGILL\mech 430\2025\notes\Fluids 2 Notes 2025.pdf`.
- Extract text with `C:\Users\antho\AppData\Local\Programs\MiKTeX\miktex\bin\x64\pdftotext.exe -layout -f <page> -l <page> file.pdf -`.
- The equations are garbled in the text extraction. Use the clean **official equation sheet** (pages 3–5 of `notes\Fluids 2 Complete Tables For Printing.pdf`), or view pages as images with the Read tool (`pages` parameter).
- Unsteady flow: `notes\Unsteady Flow Lecture Notes_2025.pdf`, `notes\Unsteady Flow from Anderson.pdf`, and `Lecture 22/23 (mech 430).pdf`.

**Notation** (Higgins):
- x/y = upstream/downstream of a shock.
- σ = shock angle, δ = deflection angle, ν = Prandtl–Meyer function, μ = Mach angle.
- Subscript 0 = stagnation, * = sonic, a prime = lab-frame velocity.
- 4fL/D uses the Fanning friction factor.
- Tables: A2 isentropic, A3 normal shock, A4 Fanno, A5 Rayleigh, A6 P-M. Exams read the **nearest row, no interpolation**.

## Components available in every MDX page (no imports needed)

**Callouts** — markdown and math go inside; put **blank lines** after the opening tag and before the closing tag:
- `<Idea title="…">` — big idea
- `<Trap>` — common mistake
- `<Remember>` — key fact
- `<Examined>` — "How it's examined"
- `<Callout kind="note" title="…">`

**Problem layout** (use for every problem set and exam problem):
```mdx
<Problem id="PS7 P4" title="Nozzle + duct: back pressure for a shock at the exit" tags="Fanno, normal shock, table lookup">

<Statement>

Full statement with all numbers…

</Statement>

<Think>

What kind of problem is this? Name the regime, which tables, the recipe to use (link it), and what makes it tricky.

</Think>

<Plan>

The chain before any numbers: reservoir → throat (M=1) → … → exit. A small figure goes here if possible.

</Plan>

<Steps>
<Step title="1. Find the Mach number entering the duct">

Why: … Equation, substitution, table reading <T>A2 @ A/A* = 3.0 (sup): M = 2.64</T> — <CalcLink calc="isentropic" q="in=A&v=3&b=sup">check</CalcLink>

</Step>
<Step title="2. …">

…

</Step>
</Steps>

<Answer>

- $p_b = 153$ kPa …

</Answer>

<Traps>

- Anthony's own mistake here: …
- Higgins: "you cannot subtract L* from L when L > L*".

</Traps>

<Source>official 2025 solution · Anthony's tablet solution PS07-mine</Source>

</Problem>
```
- `<Steps>` reveals its `<Step>` children one at a time.
- `title` and `why` props are **plain strings**. Put math in the children, not in props.
- `<T>…</T>` marks a table reading. Unicode subscripts (₀ ₁ ₓ ᵧ *) are fine inside it; math is not.
- `<CalcLink calc="…" q="…">` opens a prefilled calculator:
  - `calc` is one of `isentropic | normal | fanno | rayleigh | pm | oblique | moving | nozzle-pipe`.
  - Table calculators take `q`: `in=<inputKey>&v=<value>&b=<sub|sup>&g=<gamma>`. Input keys:
    - isentropic: `M, p, T, rho, A, mu`
    - normal: `Mx, My, pr, rr, tr, p0, pitot`
    - fanno: `M, fL, T, p, p0`
    - rayleigh: `M, T0, p, T, p0`
    - pm: `M, nu, mu`
  - oblique: `M=3&in=delta&v=10&b=weak` (`in` = `delta | sigma | pr`).
  - nozzle-pipe: `AR=4&fL=0.75&pb=0.2&p0=1000` (pb is a fraction of p0; p0 only sets the displayed units).
- `<NoteRef ch="fanno" sec="working-relations">§10.2</NoteRef>` links to a chapter heading. Heading ids are auto-generated: lower-case, spaces become `-`, punctuation dropped, so `## Working relations` becomes `working-relations`. Plain markdown links also work: `[text](#/mech430/ch/fanno)`.
- `<Figure caption="…">` wraps inline SVG. `<Tex>{'\\frac{a}{b}'}</Tex>` renders math inside JSX.

**Existing simulations** (embed them with props as presets wherever they illuminate a problem):
- `NozzleSim` (`initialAR`, `initialPb`)
- `NozzlePipeSim` (`AR`, `fL`, `pb`, `p0`)
- `AreaMachSim`, `MassFluxSim`, `NormalShockSim`, `InfluenceTable`
- `MachConeSim`, `CompressibilitySim`, `ConvergingNozzleSim`, `RocketThrustSim`

**Static figures** in `figures/base.tsx`: `CVFigure`, `SoundWaveFigure`, `MachConeFigure`, `StationsFigure`.

**3D rocket lab**: link `#/mech430/lab/engine`.

## MDX pitfalls (the checker catches most of them)

- `{` and `}` in plain text are JavaScript. Keep braces inside `$…$` or `$$…$$` math only.
- `<` directly followed by a letter starts a JSX tag. Write math `$M<1$` or the words "less than".
- Display math: `$$` on its own line, with blank lines around the block.
- No HTML comments `<!-- -->`. Use `{/* comment */}`.
- Inside JSX blocks, markdown needs blank lines around it (see the template).
- Tables are GitHub-flavoured markdown pipes. Math works inside table cells.

## ⭐ VISUAL STANDARD — realistic 3D sections, not flat diagrams

Anthony's requirement: every schematic and demo of hardware must look like real equipment (like the 3D engine lab), not flat SVG boxes. A 2-D cross-cut is fine, but render it realistically.

**Use `FlowSection3D`** (`src/courses/mech430/viz/FlowSection3D.tsx`) for anything that is a duct, nozzle, pipe, inlet, diffuser, engine, combustor, heated duct or shock tube. It renders a half-section of an axisymmetric body with:
- PBR metal walls and solid cut faces;
- the flow field on the cut plane as a CFD-style colour map (Mach / p / T), with streaklines moving at the local velocity and tracer particles;
- glowing normal shocks;
- an exhaust plume (subsonic / ideal / over / under);
- heater coils (Rayleigh) and a roughened wall (Fanno);
- projected labels.

```tsx
import { FlowSection3D, interpField } from '../viz/FlowSection3D';
<FlowSection3D
  wall="engine" | "duct" | "plain"   // engine = steel chamber + injector dome + ribbed graphite bell
  x0={0} x1={2} pipeStart={1}         // axial extent; pipeStart = where a constant-area pipe begins
  profile={(x) => radius(x)}          // inner radius vs x (keep radii ≈ 0.05–0.3 × length)
  field={(x) => ({ M, p, T })}        // 1-D state along x from the lib (p/p0, T/T0). interpField(pts) builds one from samples
  colorBy="M" | "p" | "T"
  shocks={[xShock]}                   // normal-shock positions
  plume={{ kind: 'none' | 'subsonic' | 'ideal' | 'over' | 'under', strength: 1 }}
  heatZone={[a, b]} frictionZone={[a, b]}
  labels={[{ x: 0.35, text: 'throat · M = 1' }, { x: 1.4, text: 'shock', side: 'bottom' }]}
  height={300}
/>
```

- **The field must come from the lib solution**, so the picture is the physics.
- See `sims/NozzleSim.tsx` and `sims/NozzlePipeSim.tsx` for complete examples.
- It is also available directly in MDX as `<FlowSection3D … />` (JSX expressions such as `profile={(x) => 0.1 + 0.05*x}` work in MDX). Prefer wrapping it in a named sim component in your group file so the MDX stays clean.

**Other hardware** that `FlowSection3D` doesn't cover (wedges, airfoils, pistons in tubes, corners, wind-tunnel test sections):
- Draw it with Three.js in your group file, in the same style. Reuse patterns from `viz/FlowSection3D.tsx` and `engine/EngineScene.ts`:
  - PBR metal via `RoomEnvironment` environment;
  - dark studio background `#070a12` with a blue rim light;
  - flow shown as a colour field plus moving tracers;
  - shocks as bright glowing sheets, expansion fans as fans of faint lines.
- Or at minimum use rich, realistic SVG (gradients, metallic shading, cut-hatching, flow colouring by Mach using `machColor`). No plain outline boxes.

**Plots** (p(x), M(x), charts, T–s diagrams) stay as `Plot`. Charts are fine as 2-D.

**Performance:** each `FlowSection3D` is a WebGL context and it pauses when off-screen. Keep to about 6 per page. For many small per-problem setup sketches, use one `FlowSection3D` per problem at most, and realistic SVG for the rest.

## Writing your own simulations and figures

- React + TypeScript in **your group's file only** (`sims/sims<G>.tsx`, `figures/figs<G>.tsx`). Export named components with distinctive names; check with `grep -r "export function <Name>" src/`.
- Reuse the core pieces:
  - `import { Plot, sample } from '../../../core/Plot'` — SVG line plots with `series`, `vlines`, `hlines`, `dots`, `bands`, and a `children(sx, sy)` render-prop for custom drawing in data coordinates.
  - `import { SimFrame, Slider, Readout, Tex, Figure } from '../../../core/ui'`
  - `import { machColor, MachLegend, fmt } from './common'`
  - lib functions from `../lib/...`
- Colours: CSS variables only (`var(--c1)` … `var(--c5)`, `var(--text)`, `var(--muted)`, `var(--border)`, `var(--surface)`, `var(--surface-2)`, `var(--accent)`), so light and dark themes both work.
- SVG: `viewBox` plus `style={{ width: '100%', height: 'auto' }}`; text uses `fill: 'var(--text)'`.
- Animations use `requestAnimationFrame` in `useEffect` with cleanup.
- **All physics must come from the lib**, so the sims agree with the worked answers.

## Quality bar

- **Chapters:**
  - eyebrow + `#` title + `lede`.
  - `##` sections: plain-words idea → equations in the equation sheet's form → derivation sketch where it builds understanding → the notes' worked example with numbers → embedded sims.
  - `<Examined>` linking the PS and exam problems that use the chapter.
  - A "Check yourself" list of 3–5 quick questions with answers.
  - Weave in Anthony's own lecture-note explanations and analogies from the digests. They are the best teaching voice. Example: the Bell Centre exit and latex-balloon analogies for choking.
- **Problem pages:**
  - Every problem: `Statement → Think → Plan → Steps → Answer → visual → Traps → Source`.
  - Every numeric step shows the equation, the substitution, the table value **and** the exact value.
  - Every problem gets a visual: a figure of the setup, a sim preset, or a plot.
  - Derivations get a stepped derivation with one-line justifications.
  - Where the official solution has an error (the digests flag these), give the corrected value and say so politely.
- **Regression test:** put the key final answers in `lib/<yourname>.test.ts` using the lib, with a tolerance that matches table reading (1–3%).

## Verify before you finish

```bash
cd /d/MCGILL/revision-site
node scripts/check-mdx.mjs src/courses/mech430/<your files>.mdx
npx tsc --noEmit
npx vitest run src/courses/mech430/lib/<yourname>.test.ts
```
- Do **not** run `vite build`, start dev servers, or use the browser; other agents are working at the same time.
- Do not edit files owned by other groups, `meta.ts`, `Course.tsx`, `core/*`, or the lib's existing files.
- If `tsc` reports an error in a file you don't own, ignore it and mention it in your report.
