# Capstone concept — regeneratively cooled liquid rocket engine with MDO (saved 2026-10-20)

Status: **concept only**. Starts after MECH 341 is finished; goes through brainstorming → spec → CEO review → plan.

## Idea
One engine designed end to end from the physics of the courses below, each course a discipline or a constraint, coupled and optimized (MECH 559). Page style: Alex Younes's project pages — live solver on the page, mental model, governing equations, validation against independent references, gaps stated.

## Courses kept
- **Core:** MECH 240, 309, 315, 321, 331, 341, 346, 393, 412, 430
- **Added:** MECH 360, MECH 383, MECH 559 (MDO), ECSE 461, MECH 220, CIVE 205/207
- **Maths:** MATH 133, 263, 264, 271
- **Software:** COMP 322 (C++ core), ECSE 223 (start-up sequencer state machine), ECSE 429 (validation/test strategy), ECSE 321/428 (architecture, CI, versioned modules), COMP 417 (Kalman filter), COMP 208/206, ECSE 250

Removed by Anthony: FACC 300, MECH 292/463, MECH 289, FACC 250/400, GEOG 302, CCOM 206, MIME 250/261, MECH 262, MECH 314, MECH 362, ECSE 326 (also BUSA 270, CLAS 203; MECH 500 unless its topic fits). Consequences: no cost objective, no material-selection trade (liner/jacket properties are fixed datasheet inputs), no Monte Carlo uncertainty bands, no gimbal linkage kinematics, no test-stand plan, no requirements traceability.

## Disciplines → course
| Discipline | Course |
|---|---|
| Combustion, equilibrium chemistry (Tc, γ, M, dissociation) | 341 |
| Nozzle: throat, expansion, Isp, separation | 430 |
| Regenerative cooling: Bartz heat flux, liner conduction, channel convection | 346 (+ 309 FD) |
| Feed system: friction, minor losses, injector ΔP, pump head | 331 |
| Tank pressurization, energy/exergy closure | 240 |
| Chamber hoop stress, liner thermal stress, low-cycle fatigue | 321, CIVE 205/207 |
| Turbopump shaft, bearings, flange | 393 |
| Electric-pump alternative: motors, battery | ECSE 461 |
| POGO, rotordynamics, structural modes, gimbal dynamics | 315 |
| Throttle control | 412 |
| Sensors, conditioning, sampling, filtering | 383 (+ COMP 417 Kalman) |
| Additive-manufacturing limits, roughness | 360 |
| Mission Δv (point-mass ascent) | 220 |
| Coupled solve, optimizer, gradients | 309, 559 |

## Build rings (each one working + validated before the next)
1. **Core engine:** 341 + 430 + 346 + 309 — chemistry → nozzle → cooling, coupled solve. Validate vs NASA CEA, published Isp (RL-10, Merlin), Bartz data.
2. **Hardware:** + 331 + 240 + 321 (+ CIVE 205/207) — feed lines, injector, tanks, stresses, fatigue.
3. **Machinery:** + 393 + ECSE 461 + 360 — turbopump vs electric pump, shaft/bearings/flange, manufacturing constraints.
4. **Live machine:** + 412 + 383 + 315 + COMP 417 + ECSE 223 — throttle control, sensors, Kalman, POGO, sequencer.
5. **MDO (559):** + 220 — mission Δv; optimize everything; Pareto fronts; sensitivities; turbopump vs electric decided by the optimizer.
Software (C++ core, tests, CI, versioned modules) runs through every ring.

## Objectives
Maximize Isp; maximize thrust-to-weight (minimize engine mass); maximize mission Δv. (No cost objective.)

## Variable budget (≈ 30 continuous + 2 discrete)
Pc, O/F (341) · ε, Rt, bell fraction (430) · channel count, width, depth at 3 stations, liner thickness (346/321) · fuel and oxidizer line diameters, injector ΔP fraction (331) · tank pressure (240) · jacket thickness (321) · pump speed, shaft diameter, bearing span (393) · motor power, battery capacity (ECSE 461) · POGO accumulator volume, mount stiffness (315) · Kp, Ki, Kd (412) · sampling rate, filter cutoff (383) · surface roughness / build limit (360) · propellant mass / burn time (220). Discrete: propellant pair (CH4/LOX, RP-1/LOX), pump architecture (turbopump, electric).
Constraints (~15): liner T ≤ 800 K, coolant ΔP ≤ 20 % Pc, injector ΔP ≥ 15 % Pc, no sea-level separation, stress/fatigue life, critical speeds and modes ±15 % from forcing, POGO margin, settling < 0.5 s and overshoot < 5 %, minimum printable wall/channel.

## Working model (Anthony, 2026-10-20) — hands-on, Anthony in control
The capstone is NOT delegated to subagents. Anthony builds it; Claude coaches.
1. Anthony decides what each module must answer; Claude lays out options and trade-offs.
2. Anthony derives the governing equations; Claude checks them and links the revision-site chapter where each comes from.
3. Anthony writes the solver; Claude reviews, proposes tests, helps debug, and only writes code pieces when asked.
4. Validation together: Anthony predicts first, then compare with an independent reference; disagreements are investigated, never tuned away.
5. Anthony writes the page text; Claude edits.
Every module page opens with a "What MECH xxx gives this engine" card (equations supplied, outputs, consumers); one coupling map (mental model) maintained as modules are added; a decision log in the repo owned by Anthony; Claude keeps a done/open/blocked checklist, Anthony sets order and scope.
