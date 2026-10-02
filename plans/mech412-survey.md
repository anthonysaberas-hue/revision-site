MECH 412 (Winter 2024) survey for the revision site. Everything was read-only and no files were changed. All paths are under `D:\MCGILL\mech 412\`.

Two points shape the site:
- **The course has three exam blocks, not two.**
  - MT1 covers L1–8.
  - MT2 covers L9–16.
  - The final is effectively "Midterm 3": 4 problems on L17–23, plus 2 review problems.
- **Most sources are images, not text.** The lecture PDFs are mainly slide images, with only poll text and headings extractable. Almost all solutions, scanned exams, tutorials and Anthony's reviews are handwritten. I viewed them as images and sampled the long ones; I did not read them all page by page.

---

## 0. Instructor, logistics, grading

- **Instructor:** Prof. Luc Mongeau (L01 bio: BSc and MSc Polytechnique Montréal, PhD Acoustics Penn State, Bell Labs, Purdue, McGill since 2006).
  - Older exams were set by other examiners. Final F2009: Prof. M. Nahon, with Prof. I. Sharf as associate examiner. Final F2010: Prof. I. Sharf, with Mongeau as associate examiner.
- **Textbook:** Ogata, *Modern Control Engineering* 5e. Many slide figures are Ogata (Figs 4-19 to 4-24, 7-26 to 7-35, 11-31 to 11-34). Some content follows Dorf & Bishop: the HW9/HW10 solutions are pages from the Dorf solutions manual.
- **In-class polls:** each lecture opens with slido polls that review the previous lecture.
- **Matlab and Simulink** are used throughout (`residue`, `step`, `impulse`, `lsim`, `ss`, `tf2ss`, `rlocus`, `bode`, `nyquist`, `rltool`/Control System Designer).
- **Grading scheme:** not found in any file.

Exam logistics, from the slides:
- **MT1:** Mon Feb 12 2024, in class, 120 min, 4 problems, lectures 1–8. Closed book. One handwritten 2-sided crib sheet, no worked solutions on it. Answers in booklets.
- **MT2:** Mon Mar 18 2024, 11:35–13:30, 115 min, 4 problems, lectures 9–16. Rooms: A–G in ENGMD 267, H–Z in ENGMC 13. Two handwritten crib sheets. The handout is posted on MyCourses.
- **Final:** Tue Apr 23 2024, 9:00–12:00. Open book (original bound copies only), closed notes. Three handwritten 2-sided crib sheets and a Faculty calculator. Format is "Mid-term 3 (4 problems) + 2 review problems", with emphasis on lectures 17–24.

---

## 1. Course map (L01–L23)

The headers come from the slides (title, date). Topics come from slide text, polls, Anthony's `reviews\review-full.pdf` (lecture-by-lecture notes with slide photos), and the homework.

**L01 – Jan 5 – Introduction to control systems**
- Topics: elements of a feedback control problem (controller, actuator, process, sensor, disturbance); open loop vs closed loop; history (Watt's flyball governor); future of controls.
- Examples: Watt flyball governor, boiler-generator, 3D printing, national income model, smart grid, insulin delivery.
- Linked homework: HW1 Q1 (video-game feedback block diagram).

**L02 – Jan 8 – Review of complex numbers and Laplace transforms**
- Topics: complex numbers, polar/phasor form `z = x + jy = A e^{jφ}`; Laplace definition `F(s) = ∫₀^∞ f(t) e^{-st} dt`; properties (linearity, shifting, differentiation, integration); IVT and FVT; inverse Laplace by partial fractions (distinct, repeated and complex poles, residues); proper vs improper rational functions.
- Key equations:
  - `L[f'] = sF − f(0)`
  - `L[f''] = s²F − s f(0) − f'(0)`
  - `L[∫f] = F/s + f⁻¹(0)/s`
  - Shift: `L[f(t−a)1(t−a)] = e^{-as}F(s)`
  - IVT: `f(0+) = lim_{s→∞} sF(s)`
  - FVT: `f(∞) = lim_{s→0} sF(s)`
  - Residue of a simple pole: `a_k = [(s+p_k)F(s)]_{s=−p_k}`
  - Repeated pole: `b_{r−j} = (1/j!) dʲ/dsʲ[(s+p)^r F(s)]`
- Poll examples:
  - `(s+3)/((s+1)(s+2))`
  - `(s³+5s²+9s+7)/((s+1)(s+2))` (improper)
  - `(2s+12)/(s²+2s+5)` (damped sinusoids)
  - `(s²+2s+3)/(s+1)³`

**L03 – "Dec 12" on the slide (actually ~Jan 10–12) – Mechanical systems; transient and steady-state response; nonlinear systems**
- Topics:
  - ODE solution = free (IC) response + forced response, split into transient and steady-state parts.
  - Poles and zeros.
  - Lumped mechanical EOMs by Newton, by energy methods (T and V), and by Lagrange; kinetic energy about an instantaneous centre of zero velocity.
  - Introduction to nonlinear systems.
- Key equations:
  - `m ÿ + b ẏ + k y = u`
  - `T = ½mv² + ½Iω²`
  - `V = ½kx² + mgh`
  - Lagrange: `d/dt(∂T/∂q̇) − ∂T/∂q + ∂V/∂q = Q`
- Examples:
  - Underdamped mass-spring-damper, m=1 kg, k=100 N/m, b=2 Ns/m, unit step (`ω_d = √99`), with Matlab decomposition of `y_IC + y_SS + y_U`.
  - Moving cart, 2-DOF system, inverted pendulum on a cart (rolling without slipping).

**L04 – Jan 15 – Transient response specifications and pole/zero locations**
- Topics: control objectives in the time domain; dominant poles (any stable LTI response is DC + 1st-order + 2nd-order terms); effect of extra poles and zeros; zero-placement strategy (simple but not robust).
- Key equations (2nd-order standard form `ω_n²/(s²+2ζω_n s+ω_n²)`):
  - `ω_d = ω_n√(1−ζ²)`
  - `σ = ζω_n`
  - `t_r ≈ 1.8/ω_n`, or exactly `(π−β)/ω_d` with `β = cos⁻¹ζ`
  - `t_p = π/ω_d`
  - `M_p = e^{−ζπ/√(1−ζ²)}`
  - `t_s(2%) = 4/(ζω_n)`, `t_s(5%) = 3/(ζω_n)`
  - `ζ = −ln(OS)/√(π² + ln²OS)`
  - Pole angle: `θ = cos⁻¹ζ`
- Matlab examples:
  - `13/(s²+4s+17)`
  - `(13s+52)/(4s²+16s+68)`

**L05 – Jan 19 – Transfer functions, block diagrams, introduction to Simulink**
- Topics: formal TF definition (zero ICs); block-diagram algebra (series, parallel, feedback, moving summing and pickoff points); multi-block TFs in Matlab; Simulink. Poll review of L04: moving poles vertically, radially or horizontally; collocated zeros; ζ from pole angle.
- Key equations:
  - `G(s) = Y/X = (b₀s^m + … + b_m)/(a₀sⁿ + … + a_n)`
  - Closed loop: `C/R = G/(1+GH)`
  - Error ratio: `E/R = 1/(1+GH)`
  - Impulse response: `g(t) = L⁻¹[G(s)]`
- Examples: `6/(5s²+2s+4)` step response; mass-spring-damper TF; inverted pendulum in Simulink.

**L06 – MISSING – inferred: frequency response and Bode plots (plus the TF approach to IC response)**
- Evidence:
  - L21 contains a slide titled "Bode plots – lecture 6 / Lecture 6 slides".
  - L07's opening polls (which review L06) ask about the response of systems with poles on the jω axis via frequency response, 1 dB raise and penalty as a %, corner frequency from a Bode plot, ζ from a Bode plot, cutoff frequency, Matlab residue output, and the TF approach to IC response.
  - HW3 Q5 (due Jan 31) is Bode plots of factored TFs.
  - MT1 W2019 Q3 is a Bode sketch.
- Likely content:
  - Sinusoidal transfer function `G(jω)`; steady-state response `|G(jω)| A sin(ωt + ∠G)`.
  - dB scale `20log₁₀|G|`.
  - Bode building blocks: gain, `(jω)^±1` at ±20 dB/dec, first-order `1/(1+jωT)` with corner `1/T`, −3 dB and −45° at the corner, second-order resonance.
  - Asymptotic sketching, octave and decade slopes, superposition of components.
  - Response to ICs via the TF approach.
  - Partial fractions via Matlab `residue`.
- A one-sheet summary of this material is in `reviews\review-full.pdf` (~p.73–75).

**L07 – Jan 26 – Signal-flow graphs, Mason's gain formula, state-space models**
- Topics:
  - SFG rules: nodes, branches, paths, loops, touching and non-touching loops.
  - Mason's formula.
  - Converting a block diagram to an SFG.
  - Introduction to state space (A, B, C, D) and its analytical solution; Matlab solution.
- Key equations:
  - Mason: `T = Σ P_k Δ_k / Δ`
  - `Δ = 1 − ΣL_i + ΣL_iL_j(non-touching) − ΣL_iL_jL_k + …`
  - State space: `ẋ = Ax + Bu`, `y = Cx + Du`
- Examples: block diagram → SFG conversions.

**L08 – deck dated "Fall 2022 Sept 27", used Feb 2024 – State-space models: matrix ODE, systems with input derivatives; MT1 info**
- Topics:
  - State variables (not the same count as DOF).
  - Converting an ODE to SS when the input is differentiated: "Method 0" (ignore input derivatives, which is wrong), Method 1 (β coefficients), Method 2 (split `Y/U = (Y/Z)(Z/U)`).
  - TF vs SS step, impulse and ramp responses.
  - Transfer matrix.
- Key equations:
  - Method 1 (n=2):
    - `x₁ = y − β₀u`, `x₂ = ẋ₁ − β₁u`
    - `β₀ = b₀`, `β₁ = b₁ − a₁β₀`, `β₂ = b₂ − a₁β₁ − a₂β₀`
    - `A = [0 1; −a₂ −a₁]`, `B = [β₁; β₂]`, `y = x₁ + β₀u`
  - Method 2:
    - `A` in companion form, `B = [0; …; 1]`
    - `C = [b_n − a_nb₀, …, b₁ − a₁b₀]`, `D = b₀`
  - `G(s) = C(sI−A)⁻¹B + D`
- Examples:
  - Ogata Ex 3-3: `(2s+10)/(s²+2s+10)`. Residues `r = −0.5 ∓ 0.1667i, 1`. Step response `1 − e^{−t}cos3t + (1/3)e^{−t}sin3t`. Ramp and impulse. The b=0 case. Asks why the initial impulse position is not zero.
  - Ogata Ex 5-7: 4th-order system with input derivatives, noting a textbook error.

**L09 – Feb 2 – Electrical circuits (plus SS transformations and diagonalisation)**
- Topics:
  - Poll review: `x = P x̂` gives `x̂̇ = P⁻¹AP x̂ + P⁻¹Bu`, `y = CP x̂ + Du`.
  - Eigenvalues of A (example `A = [0 1 0; 0 0 1; −2 −1 −2]` and `[0 1 0; 0 0 1; −6 −11 −6]` with λ = −1, −2, −3).
  - Vandermonde diagonalisation `P = [1 1 1; λ₁ λ₂ λ₃; λ₁² λ₂² λ₃²]`; Jordan form for repeated roots.
  - Method 1 and 2 on `R₁(u̇−ẏ) + k₁(u−y) = R₂ẏ`.
  - Circuit review: two-terminal elements, impedance, gyrators, voltage divider; nonlinear circuit.
- Key equations:
  - `Z_R = R`, `Z_L = Ls`, `Z_C = 1/(Cs)`
  - Divider: `E_o/E_i = Z₁/(Z₁+Z₂)`
- Examples:
  - `1/(0.2s+1)` (series RL).
  - `1/(0.2s²+0.1s+1)` with `tf2ss`.
  - Design a low-pass filter with cutoff 106.1 Hz and DC gain ½, solved four ways: Kirchhoff, SFG, block diagram, then tuning.

**L10 – Feb 5 – Op-amps, nonlinear systems, introduction to stability**
- Topics:
  - R, L, C laws; equivalent resistance and impedance.
  - Minimal realisation: pole-zero cancellation, non-minimal SS, observability and controllability.
  - Biquad (ζ = 0.1, 0.5, 1.0).
  - Linearisation by Taylor series about an equilibrium.
  - Time-varying trajectories.
  - Lyapunov stability: A is Hurwitz if all eigenvalues are in the LHP.
  - Simple and inverted pendulum.
  - Full "circuit problem" workflow: LRC → SS → TF → SFG → block diagram → state transition matrix.
- Key equations:
  - Linearisation: `ẋ = f(x,u)`, `A = ∂f/∂x|_(x̄,ū)`, `B = ∂f/∂u|_(x̄,ū)`, `x̂ = x − x̄`
  - State transition matrix: `Φ(t) = L⁻¹[(sI−A)⁻¹] = e^{At}`
  - Full solution: `x(t) = Φ(t)x(0) + ∫₀ᵗ Φ(t−τ)Bu(τ)dτ`
  - Step input: `x(t) = e^{At}x(0) + A⁻¹(e^{At} − I)B`

**L11 – Feb 9 – Electro-mechanical analogies**
- Topics:
  - Op-amp poll review: inverting `E_o/E_i = −Z₂/Z₁`; lead/lag op-amp network `−(R₂/R₁)(R₁C₁s+1)/(R₂C₂s+1)`.
  - Ad hoc vs standard analogies (potential × flux = power).
  - Impedance analogy (force ↔ voltage, velocity ↔ current) vs mobility analogy (velocity ↔ voltage, force ↔ current).
  - Drawing circuits by inspection; dot method to convert between analogies; validity checks (EOM, FBD vs KVL/KCL).
- Key element maps:
  - Mass: impedance → inductor `M_M`; mobility → capacitor `M_M`.
  - Spring: impedance → capacitor `C_M = 1/k`; mobility → inductor `C_M`.
  - Dashpot: impedance → resistor `R_M`; mobility → resistor `1/R_M`.
  - Velocity source and force source swap between voltage and current source.
- Analogy table (handout 2) spans electrical, hydraulic, mechanical, pneumatic, acoustic, thermal and liquid level.

**L12 – Feb 16 – Electro-mechanical systems, transducers, stepper motors**
- Topics: moving-coil transducer (loudspeaker, dynamic microphone) as a gyrator or transformer; electrostatic (piezo) transducer; stepper motor modelled several ways; DC motor.
- Key equations:
  - Moving coil: `f = Bli`, `e = Blu`
  - Piezo: `e = φx`, `f = φq`
  - DC motor: `T = K_t i_a`, `e_b = K_b ω`
  - Armature: `E_a = (R_a + L_a s)I_a + K_bΩ`
  - Mechanical: `(Js+b)Ω = K_t I_a`
  - Servomotor TF: `Θ/E_a = K/[s(R_aJs + R_ab + KK_b)]` (poll in L13)
- Examples: moving-coil loudspeaker; "Lecture 12 representative problem" (DC motor terminals: `V_A − V_B = I_A R_A + K_e ω`).

**L13 – Feb 19 – Acoustic systems, pneumatic systems**
- Topics:
  - Acoustic pressure and volume velocity; speed of sound and bulk modulus.
  - Acoustic mass, compliance and resistance.
  - Two-port and four-port passive elements.
  - Helmholtz resonator side branch; cavity with two ports.
  - Coupling acoustic and mechanical systems through transformer area ratio `S:1`, or a gyrator `1/S` for mobility.
  - Relation to pneumatic (low frequency, mass negligible) and hydraulic systems (incompressible, accumulators, valves).
- Key equations:
  - `M_A = ρL/A`
  - `C_A = V/(ρc²) = V/(ργRT)`
  - `R_A = d(Δp)/dU`
  - Helmholtz frequency: `ω = 1/√(M_A C_A)`

**L14 – Feb 23 (deck header says "MECH 413") – Pneumatic systems (slides also list "Bode plot")**
- Topics:
  - Pneumatic properties.
  - Pressure systems and their electrical analog; pneumatic capacitance and resistance differ from the acoustic ones by a factor ρ (mass flux).
  - Nozzle-flapper amplifier; bleeding and non-bleeding relays; reverse-acting relay.
  - On-off controller; force-distance and force-balance (stack) P controllers.
  - Pneumatic valve; pneumatic P, PD, PI and PID controllers built from bellows, restrictions and capacitances.
- Key equations:
  - Nozzle-flapper lever: `x = (b/(a+b))e − (a/(a+b))y`, `P_b = K₁x`
  - Bellows: `P_i A = k(x − z)`
  - Valve-capacitance-bellows example: `X/P_i = (A/k)/[R(C + A²/k)s + 1]` (from Anthony's notes)
  - Lever: `y/a = z/b`
- Examples: Ogata pneumatic controller figures. HW6 Q3 PID pneumatic controller.

**L15 – Feb 26 – Liquid-level, hydraulic and thermal systems**
- Topics:
  - Small-oscillation models of tanks.
  - Electrical equivalents of hydraulic systems.
  - Hydraulic servomotor with linearisation; dashpot as a feedback element.
  - Hydraulic P, PI, PD and PID controllers (Ogata Figs 4-19 to 4-24).
  - Thermal systems.
  - Pros and cons of fluid power.
- Key equations:
  - Tank: `q_in − q_out = C dh/dt`, `C = A_tank`
  - Valve: `q = (h₁ − h₂)/R`, linearised `R = 2H̄/Q̄`
  - Single tank: `H/Q = R/(RCs+1)`
  - Two non-interacting tanks: `H₂/Q = R₂/[(R₁C₁s+1)(R₂C₂s+1)]`
  - Hydraulic servo valve-piston: `Y/X = K/s`
  - Dashpot feedback: `Z/Y = Ts/(Ts+1)`, or `1/(Ts+1)` depending on the variable chosen
  - Thermal: `R_t = Δθ/q_h`, `C_t = mc_p`
  - Thermometer: `Θ/Θ_b = 1/(RCs+1)`
- Examples: Ogata B-4-3 pneumatic (polls); typical electro-hydraulic example.

**L16 – MISSING – inferred: characteristics of feedback systems (sensitivity, disturbance rejection, noise), possibly with MT2 review**
- Evidence:
  - The L17 opening polls review L16. They cover system sensitivity `S = (∂T/T)/(∂G/G)`, open loop vs closed loop sensitivity, disturbance definition, and the advantages of feedback. Two of them: the sensitivity to τ of loop `50/(τs+10)`, and comparing `S_{K1}` for two configurations with K₁ = K₂ = 100.
  - The L17 slide states that MT2 covers "lectures 9–16", and MT2 W2024 Q4 is closed-loop sensitivity `S^{T}_{Km}` plus disturbance steady-state error.
  - L16 would fall around Feb 29–Mar 1, just before reading week (L17 is Mar 11).
- Likely content:
  - `S^T_G = 1/(1+GH)`
  - `S^T_H = −GH/(1+GH)`
  - Chain rule: `S^T_K = S^T_G · S^G_K`
  - Disturbance transfer `Y/T_d = G₂/(1+G₁G₂H)`
  - Noise attenuation; open- vs closed-loop error with FVT (Anthony's "Review Final" page works this example: `e_open = 1 − K` vs `e_closed = 1/(1+K)`; a 10 % gain change gives 10 % vs 0.11 % error change)
  - Probably more liquid-level and thermal examples (HW6 was due Mar 10).
  - Feedback-system examples such as the tank level regulator and DC motor tachometer feedback (MT2 W2011 and W2012).

**L17 – Mar 11 – Steady-state error; stability (Routh–Hurwitz)**
- Topics:
  - Objectives of feedback (A–F).
  - System type N; standard test inputs.
  - Error constants table.
  - BIBO stability; absolute vs relative stability; pole and eigenvalue locations; marginal stability (e.g. `(s+10)(s²+16)`).
  - Introduction to Routh.
- Key equations:
  - `G = K∏(T_is+1)/[s^N ∏(T_js+1)]`
  - `K_p = lim_{s→0} GH`, `K_v = lim sGH`, `K_a = lim s²GH`
  - `e_ss(step) = 1/(1+K_p)`, `e_ss(ramp) = 1/K_v`, `e_ss(parabola) = 1/K_a`
  - Higher type means more accuracy and less stability
  - `e_ss = lim_{s→0} sE(s)`, `E = R/(1+GH)`
- Examples:
  - Simulink `G = 1/(2s(1+s))`
  - `q = (s−2)(s+1−j√3)(s+1+j√3)` (shows sign changes)
  - `s⁴ + 2s³ + 3s² + 4s + 5`

**L18 – Mar 15 – Stability: Routh–Hurwitz (continued)**
- Topics: constructing the Routh array; necessary condition (all coefficients same sign and non-zero); special cases (zero in first column → ε; whole row zero → auxiliary polynomial and its derivative); relative stability via shifting `s = z − σ`.
- Key equations:
  - `b₁ = (a₁a₂ − a₀a₃)/a₁`
  - Third order `a₀s³ + a₁s² + a₂s + a₃` is stable iff all aᵢ > 0 and `a₁a₂ > a₀a₃`
- Examples:
  - `s³ + 2s² + s + 2` (ε case)
  - `s⁵ + 2s⁴ + 24s³ + 48s² − 25s − 50` (auxiliary polynomial `2s⁴ + 48s² − 50`)
  - `s³ + 3s² + 2s + K` → `0 < K < 6`

**L19 – Mar 22 – PID controllers; Ziegler–Nichols tuning**
- Topics:
  - Controller types: on-off (two-position, with a liquid-level example), P, I, PI, PD, PID.
  - Effect of each action: integral removes offset, derivative adds damping.
  - Pole-zero structure of PID.
  - Ziegler–Nichols step-response (S-curve L, T) and ultimate-gain (K_cr, P_cr) rules.
  - Analog op-amp PID circuit.
  - Position control with velocity (tach) feedback.
- Key equations:
  - `G_c = K_p(1 + 1/(T_i s) + T_d s) = K_p + K_i/s + K_d s`
  - Z-N method 1: `K_p = 1.2T/L`, `T_i = 2L`, `T_d = 0.5L`
  - Z-N method 2: `K_p = 0.6K_cr`, `T_i = 0.5P_cr`, `T_d = 0.125P_cr`
- Examples:
  - Matlab/Simulink water tank P/PI/PID with `lsiminfo` (settling time, overshoot, rise time).
  - Temperature control demo.
  - Proportional control of a first-order system.
  - HW7 paper machine `e^{−2s}/(3s+1)`.

**L20 – Mar 25 – Root-locus method of controller design**
- Topics:
  - Definition; angle and magnitude conditions.
  - Sketching rules: branches; real-axis segments; asymptote angles `±180°(2k+1)/(n−m)`; centroid `σ_a = (Σp − Σz)/(n−m)`; breakaway `dK/ds = 0`; jω crossing via Routh; departure and arrival angles.
  - Parameter design and sensitivity.
  - Pole-placement design via root locus (desired region from `t_s` and OS%).
- Key equations:
  - `1 + KG(s)H(s) = 0`
  - Magnitude: `|KGH| = 1`
  - Angle: `∠GH = ±180°(2k+1)`
  - Desired region: `σ ≥ 4/T_s`; `θ = cos⁻¹ζ ≤ tan⁻¹(π/ln(100/OS%))`
- Examples:
  - `K/[s(s+2)]`
  - Parameter variation `as/(s²+K)`
  - Steps on `2(s+2)/(s²+4s)`, `K(s+1)/[s(s+2)(s+4)²]`, `K(s+1)/[s(s+2)(s+3)]`
  - `K/[(s+p)³(s²+2ζω_ns+ω_n²)]`
  - `K/(s⁴+12s³+64s²+128s)`
  - Practice: `K/[s(s+1)(s+2)]` (centroid −1, breakaway −0.4226, K = 0.385, jω crossing at K = 6, ω = √2, ζ = 0.5 gain)
  - Valve-controlled hydraulic cylinder velocity loop: controller `G_c = 0.0523(s+100)`, T_s < 0.5 s, OS < 25 %
  - Two-loop `20/((s+1)(s+4))` with tach k for ζ = 0.4

**L21 – Apr 5 – Frequency response: Bode and polar plots, margins**
- Topics:
  - Root-locus poll review.
  - Steady-state sinusoidal response.
  - Bode building blocks and drawing.
  - Polar (Nyquist) plots of simple TFs, type 0/1/2 shapes.
  - Resonant peak `M_r`, `ω_r`.
  - Reading error constants from Bode (K_p from the low-frequency asymptote; K_v where the −20 dB/dec line crosses ω = 1; K_a likewise).
  - Gain and phase margins (stable vs unstable).
  - Introduction to the lead compensator.
- Key equations:
  - RC circuit: `G = 1/(jωRC + 1)`; polar plot is a semicircle `(X − ½)² + Y² = ¼`
  - `K/[jω(jωτ+1)]`
  - `GM = 1/|L(jω_pc)|` at phase −180°, in dB
  - `PM = 180° + ∠L(jω_gc)` at |L| = 1
  - `M_r = 1/(2ζ√(1−ζ²))`, `ω_r = ω_n√(1−2ζ²)`
- Examples:
  - RC Bode and Nyquist `1/(4s+1)`
  - `G = 5(0.1s+1)/[s(0.5s+1)((s/50)² + 0.6(s/50) + 1)]` drawn piece by piece
  - Margins for K = 10 and K = 100

**L22 – Apr 8 – Frequency-domain compensator design: lead and lag**
- Topics:
  - Margins review; non-minimum phase zeros.
  - Lead design procedure, 6 steps.
  - Lag design procedure.
  - Lead vs lag vs lag-lead comparison.
  - PID as a special case of lag-lead (PD ≈ lead, PI ≈ lag).
- Key equations:
  - Lead: `G_c = K_cα(Ts+1)/(αTs+1)`, 0 < α < 1
    - `sin φ_m = (1−α)/(1+α)`
    - `ω_m = 1/(T√α)`
    - New crossover where the uncompensated gain is `−20log(1/√α)`
  - Lag: `G_c = K_cβ(Ts+1)/(βTs+1)`, β > 1
    - Zero about one decade below the new crossover
    - `β` from the required attenuation `−20logβ`
    - Add 5–12° of margin
  - Lag-lead: `K_c[(s+1/T₁)/(s+γ/T₁)][(s+1/T₂)/(s+1/(βT₂))]`
- Examples:
  - Lead: `G = 4/[s(s+2)]`, K_v = 20 → `40/[s(s+2)]`, PM 50°, α = 0.24, `G_c = 41.7(s+4.41)/(s+18.4)`, comparing step and ramp responses.
  - Lag (Ogata Ex 11-7): `1/[s(s+1)(0.5s+1)]`, K_v = 5, PM ≥ 40°, GM ≥ 10 dB. Uncompensated PM is −20°. β = 10, zero at 0.1, pole at 0.01, `G_c = 0.5·(10s+1)/(100s+1)·10`. Result: PM 40°, GM 11 dB, ω_c ≈ 0.5.

**L23 – Apr 11 (deck header says "Fall 2022") – Nyquist stability criterion; compensator examples**
- Topics:
  - Stability in the frequency domain; `F(s) = 1 + L(s)`.
  - Contour mapping (conformal maps); encirclement convention.
  - Cauchy's argument principle `N = Z − P`.
  - Nyquist contour; −1 point criterion `Z = N + P`. With P = 0 we need N = 0; otherwise P counter-clockwise encirclements.
  - Relative stability.
  - Recap of time domain vs frequency domain, applying all four compensator methods (RL lead, RL lag, Bode lead, Bode lag) to one plant.
- Mapping examples: `F = 2s+1`; `s/(s+2)`; `s/(s+0.5)`; `(s−z₁)(s−z₂)/((s−p₁)(s−p₂))`.
- Nyquist examples:
  - `K/((τ₁s+1)(τ₂s+1))`
  - `K/[s(τs+1)]`
  - `K/[s(τ₁s+1)(τ₂s+1)]`
  - `K/[s²(τs+1)]`
  - `K₁/[s(s−1)]`, then with derivative feedback `K₁(1+K₂s)/[s(s−1)]`
  - `K(s−2)/(s+1)²`
- Compensator example on `G = K/[s(s+1)]`:
  - Ex 1: lead by root locus. Make τ = 1 and ζ = 0.5, so poles at −1 ± j√3. Needs +30°. a = 10, compensator pole at about −37.
  - Ex 2: lag by root locus for K_v = 10.

---

## 2. Homework map (`homework\`, `homework-solutions\`, `my-homework\`)

**HW1 (due Jan 17)** — solution: `HW01-sol.pdf` (13 p, handwritten)
- Q1: component block diagram of a person playing a video game with a joystick.
- Q2: Laplace transform of a pulse-type f(t), with the limit as a → 0 (an impulse).
- Q3: Laplace of `f(t)sin t` and `e^{−(t−1)}1(t−1)`-type shifted functions.
- Q4: inverse Laplace of five TFs by partial fractions, with Matlab `residue` check.
- Q5: ODEs by Laplace:
  - `ÿ + 3ẏ + 7y = 0`, y(0) = 2, ẏ(0) = 1 (reused as MT1 F2011 Q1)
  - `ÿ + 5ẏ = cos t`
  - `ÿ + y = cos 2t`
- Q6: sample-and-hold is linear but not time-invariant.

**HW2 (due Jan 24)** — solution: `HW02-sol.pdf` (9 p). Anthony's work: `HW02-mine-a/b/c.pdf` and `my-homework\Mech412-unknown.pdf`, which is HW2 Q1 work (`ω_n²(s+2)/2(...)` decomposition).
- Q1: 2nd-order system with an extra zero `H = ω_n²(s+z)/[z(s² + 2ζω_ns + ω_n²)]`. Derive the step response `1 − Ce^{−σt}cos(ω_dt + β)`, `M_p`, and how to get ζ and ω_n from `M_p`.
- Q2: pinned bar (m = 3 kg, L = 10 cm) driven through a slider with spring k = 12 kN/m and dashpot b = 400 Ns/m, input x = 1 mm step. EOM, TF, ω_n, ζ, final value, Matlab step.
- Q3: disk rolling on a cable (m = 50 kg, R = 0.6 m), spring k = 250, torsional damping c_t = 18, F = 200 N step. EOM using the instant centre, LTDE coefficients, poles and zeros, final position.

**HW3 (due Jan 31)** — solution: `HW03-sol.pdf` (21 p). Anthony's work: `HW03-mine.pdf`, `HW03-mine-b.pdf`.
- Q1: block diagram reduction (2 diagrams).
- Q2: bridged-T network TF `(1 + 2R₁Cs + R₁R₂C²s²)/(1 + (2R₁+R₂)Cs + R₁R₂C²s²)`. Pole-zero map, step response, peak time and overshoot vs the "cookbook" formulas, how to reduce overshoot. Reused as MT1 W2019 Q3/Q4.
- Q3: tracking-error and disturbance steady-state error vs gain K (0–10).
- Q4: closed-loop TF plus Simulink with a₁..₃ = 6, 11, 6 and b₁..₃ = 1, 2, 3.
- Q5: factor four TFs into 1st/2nd-order factors; Bode of components and their superposition; corner frequencies.

**HW4 (due Feb 8)** — solution: `HW04-sol.pdf` (15 p). Anthony's work: `HW04-mine.pdf`.
- Q1: autonomous vehicle position control `(s+2)/(s+4) · 1/(s(s+3))`-type. State variable model; step response with and without the controller.
- Q2: block diagram → SS model and state transition matrix.
- Q3: multi-loop block diagram → SS and characteristic equation.
- Q4: SISO SS → TF, eigenvalues, diagonal (principal-coordinate) form.
- Q5 (extra): Φ(t) and the response for x(0) = (1, −1).
- Q6 (extra): laser printer belt drive with DC motor. EOM, SS with `x₁ = rθ − y`, `x₂ = ẏ`, `x₃ = θ̇`; fill in the Simulink model. Reused as MT1 W2019 Q2.

**HW5 (due Feb 23)** — **no official solution** (the `HW05` gap). Only Anthony's `my-homework\HW05-mine.pdf` (13 p).
- Q1: maglev train `F = k i²/z²` vs mg. EOM, equilibrium, Taylor linearisation, TF. Same problem as T06 Q3.
- Q2: TFs of node circuits.
- Q3: mobility and impedance analogs of a spring-mass-damper network.
- Q4: mobility circuit → impedance circuit for a vertical device; effect of a rigid rod linking M₁ and M₂.
- Q5: lever system (k at L/4, m and c at 3L/4) with transformers. Reused as MT2 F2022 Q1a.

**HW6 (due Mar 10)** — solution: `HW06-07-sol.pdf` (10 p). Despite the file name it contains the HW6 solutions; page 1 is Q2's hydro-acoustic circuit (the file numbers it "2", although that horn problem is Q1 in the HW6 sheet). Anthony's work: `HW06-mine.pdf`.
- Q1: hydro-acoustic water-level tunable horn equivalent circuit.
- Q2: hydraulic dashpot `m_p`, `m_c`, k, R, ρ. Circuit with transformers or gyrators; show `Z/Y` for massless pistons. Reused as MT2 F2022 Q1b and MT2 W2024 Q2.
- Q3: pneumatic PID controller standard circuit vs ad hoc block diagram; relate K, C, k_s.
- Optional: Ogata B-4-2, B-4-7, B-4-9.

**HW7 (due Apr 3)** — solution: `HW07-sol.pdf` (10 p). Anthony's work: `HW07-mine.pdf`, `-b`, `-c` (the last includes some typed text).
- Q1: Routh for `s⁴ + 8s³ + 32s² + 80s + 100` and `s⁴ + 2s³ + 7s² − 2s + 8`.
- Q2: range of k for `s⁵ + 5s⁴ + 10s³ + 10s² + 5s + k`.
- Q3: PI controller on `1/[s(s+15)(s+25)]` for ζ = 0.707. Peak time, t_s, position/velocity/acceleration errors.
- Q4: Ziegler–Nichols PID for the paper machine `e^{−2s}/(3s+1)`; K_u = 3.044.
- Q5: root locus to pick K for OS < 10 % and t_s < 4 s.

**HW8-2024 (practice only, not handed in)** — no exact matching solution. Its problems are the same as HW10 Q2/Q4/Q5, so `HW10-sol.pdf` (Dorf manual pages) covers them.
- Q1: lead (ω_c = 10) and lag (ramp e_ss = 0.05) for `40/[s(s+2)]`, PM 30°.
- Q2: Bode and margins of `10(1+0.4s)/[s(1+2s)(1+0.24s+0.04s²)]`.
- Q3: Nyquist of `K/[s(s²+s+6)]` and `K(s+1)/[s²(s+6)]`, plus K_max.

**HW8-alt (2019, due Mar 28 2019)**
- Q1: multi-loop gains K₁…K₅. Closed-loop TF and Routh conditions on the gains. Solution: `HW08-sol.pdf` (worked by Routh on `(s+1+k₁k₃)(s−10)(2s+k₂k₅−4) + 30k₁k₂k₄`).
- Q2/Q3: same as HW7 Q3/Q4. `HW08b-sol.pdf` (12 p) is most likely the solutions to these.

**HW9 (2019 sheet)** — solution: `HW09-sol.pdf` (Dorf solutions-manual pages).
- Q1: satellite antenna, armature-controlled motor. Ramp e_ss ≤ 0.01B, OS < 5 %, T_s < 2 s. Z-N first cut, then `rltool` tuning, step plot, effect of disturbance `Q/s`.
- Q2: root locus sketch, K for OS < 10 % and T_s < 4 s.
- Q3: verify four high-order root-locus shapes.

**HW10 (2019 sheet)** — solution: `HW10-sol.pdf` (Dorf pages).
- Q1: PI on `400/[s(s+40)]` with K_I = 1, K_P for about 20 % OS, t_s.
- Q2: lead/lag on `40/[s(s+2)]`.
- Q3: lead-lag for `100/[s(s+5)(s+10)]` with K_v = 100, GM ≥ 10 dB, PM ≥ 40°.
- Q4: Bode and margins (same as HW8-2024 Q2).
- Q5: Nyquist (same as HW8-2024 Q3).

**Extra solutions in `homework-solutions\`**
- `lect10-exercise-sol.pdf` (4 p)
- `lect12-13-exercise-sol.pdf` (4 p)
- `lect14-15-exercise-sol.pdf` (6 p)
These are the "representative problems" from the lectures (circuit and nonlinear; DC motor and transducers; pneumatic and hydraulic). Scanned; I did not open them.

**Gaps**
- No HW5 solution.
- The HW6 solution is filed only as `HW06-07-sol.pdf` (contents are HW6).
- No exact HW8-2024 solution, but HW10-sol covers the same problems.
- The 2024 HW9/HW10 sheets are not present; only the 2019 versions.
- No Anthony work for HW8–10.

---

## 3. Exam analysis

### Per-paper question list

**MT1 F2007** (`past-MT1\MT1 F2007.pdf`, partial: 3 questions plus solutions, open book)
1. Response of `1/[s(s²+s)]` to a rectangular pulse 0.5–1 s, using shifted Laplace and repeated-pole PFE. Type: Laplace / time response.
2. Two-mass system k₁, k₂, b → TF from f to the velocity of mass 1. Type: modelling / TF.
3. Interpret Matlab `residue` output (multiple choice).

**MT1 W2009** (paper and solution, Prof. Mongeau)
1. Block diagram reduction of an electromechanical loop: `1/(Ls+R) · K_f · 1/(ms²+bs+k)` with `K_e s` feedback.
2. PFE and inverse Laplace of `(3s²+2s+2)/[(s+2)(s²+2s+5)]`, completing the square. Answer: `2e^{−2t} + e^{−t}cos2t − 2.5e^{−t}sin2t`.
3. Mass with spring k₁ and series k₂-b (m = 0.1, b = 0.4, k₁ = 6, k₂ = 4). TF, ODE, well-posed SS. Type: modelling → TF → SS with input derivative.
4. Multiple choice:
   - IVT
   - EOM of a spring-mass-pulley system
   - bullet into a sprung block (momentum)
   - naming feedback elements (G, H, R, C, B, E)
   - matching Matlab commands (`impulse`, `step`, `tf2ss`, `residue`, `lsim`)

**MT1 F2011** (paper with handwritten solutions)
1. SS with `A = [0 1; −3 −1]`, `initial(...,[1;2])` plot → ODE `ÿ + ẏ + 3y = 0` and closed-form y(t) by Laplace. Same as HW1 Q5a.
2. Block diagram with three integrators and feedforward b₁, b₂, b₃ → `T = (b₁s² + b₂s + b₃)/(s³ + a₁s² + a₂s + a₃)` and SS by Methods 1 and 2.
3. Spring k parallel with R_M1, in series with R_M2 (massless) → `Y/U = (s+3)/(2s+3)`, SS with input derivative, frequency response at ω = 5 (|G| = 0.56, −14°).
4. Aircraft TF with a zero `τω_n²(s+1/τ)/(s²+2ζω_ns+ω_n²)`. Pick τ, ω_n, ζ for OS 16.3 % and t_r 2.4 s using given design charts; pole-zero plot; effect of moving the zero.

**MT1 W2017** (paper and solution, text-extractable)
1. SS → ODE by eliminating states; ICs on y; Laplace coefficients; fit `Ae^{−σt}sin ωt`.
2. Block diagram (attitude control with D(s), disturbance T_d) → closed-loop TF; SS for D(s) = s.
3. Nonlinear resistor `i = e_C³` circuit (R = 1, L = 3, C = 2). Nonlinear state equations, DC operating point for `e_i = 2 + ê_i`, linearised SS.
4. SDOF (M, b, k) with sinusoidal force and ICs, given X(s). Identify M, b, k, x(0), u(0), and the pole angle.

**MT1 W2019** (paper and solution)
1. Two-axis coupled block diagram and SFG. SS, characteristic equation, Φ(t) for K₁ = 1, K₂ = 2, transfer matrix.
2. Laser-printer belt drive and DC motor. EOM, SS with given states, complete the Simulink diagram. Same as HW4 Q6.
3. Bridged-T network. TF, sinusoidal TF, sketch Bode magnitude given the phase (notch filter).
4. Same bridged-T TF. Pole-zero diagram, choice of state variables, peak time and overshoot from the step plot, reducing overshoot. Same as HW3 Q2.

**MT2 W2009** (paper and solution)
1. Hydraulic dashpot with piston and cylinder, fluid compliances, hose inertance, valve. Acoustic circuit; impedance mechanical circuit; coupled circuit with A_p:1 transformers; show the reduction to spring-in-series-with-resistor `R_M = R_f A_p²ρ`.
2. State transition matrix of a 2nd-order ODE.
3. Two op-amp circuits. TFs; loading advantage; why R₂ is large.
4. Multiple choice and true/false:
   - dynamic absorber
   - tank valve resistance from a 5 % rise in 2 s
   - servomotor torque
   - linearised orifice resistance
   - true/false: superposition of 1st/2nd-order modes, heat-transfer resistance, pneumatic vs hydraulic in prosthetics, ω_d < ω_n, rotating unbalance

**MT2 W2010** (paper and solution)
1. Soft-tissue suction device: tissue (M_t, C_t, R_t), acoustic pipe and cavity, hydraulic hose and cylinder, piston with a force source. Full impedance circuit with transformers. Why a force generator.
2. Time-domain response y(t) of an SS system to a unit step (Φ or Laplace).
3. Tape-drive DC servomotor. TF `e_a → θ`; characteristic roots with and without load; time constant and oscillation; maximum step voltage given torque/speed/current limits (motor as a transformer with ratio K_t).
4. Multiple choice: circuit TF, op-amp TF, two-tank liquid-level head changes.

**MT2 W2011** (paper only)
1. Analog circuits of a mechanical system and of a hydro-pneumatic system (liquid tank, piston M_M with area A_p, air cavity).
2. Tank level regulator. E(s); e_ss for a step disturbance with G = K and with G = K/s; sensitivity to tank capacitance C.
3. DC motor. TF va → θ_m; position servo with gain K; maximum K for M_p < 20 %.
4. Inverting op-amp = PID. TF, show the PID form, relate K_p, K_i, K_d to R and C.

**MT2 W2012** (paper only)
1. Analog circuits of a mechanical system and of a DC-motor-actuated flow valve.
2. Two-tank system (S₁ = S₂ = 2 m², R = 1). Circuit analog; `q_out/q_in` TF; Matlab script for the step response.
3. DC motor with tachometer feedback (K_m = 10, J = 1, R_a = 1, K_b = 0.1). T(s); K_p for step e_ss = 0.1; choice of K_p to minimise sensitivity to R_a drift at low and high frequency.
4. Current amplifier op-amp for a DC motor. C(s) = I_a/V_in; limit R_f → ∞.

**MT2 W2019** (paper and solution)
1. Analog circuits:
   - (a) mechanical system with two velocity generators
   - (b) liquid-level system
   - (c) coupled tank and float with spring and dashpot (parameter table given)
2. Hydraulic speed governor (fly-ball, pilot valve, power piston, dashpot feedback). Block diagram in k, b, a₁, a₂, K; Y/E; reduce to PI and find K_p, T_i.
3. Choose K and n so the ramp 10t error is 1/6000; sensitivity of T to K.
4. Op-amp feedback amplifier with a potentiometer (β = R₃/(R₂+R₃)). Exact TF; matching block diagram; large-K approximation.

**MT2 Make-up W2019** (paper only)
1. Disk-drive read/write head (two inertias, flexible shaft k, b). FBD, EOM, analog circuit, head/motor velocity TF.
2. Robot gripper DC-motor position control (K_m = 30, R_f = 1, K_f = K_i = 1, J = 0.1, b = 1). θ(t) for a step with K = 20; disturbance `T_d = A/s`; ramp e_ss; sensitivity to b.
3. Two interacting tanks (A = 2.56 m², R = 5×10⁵). Circuit; 2 % response time; effect of doubling tank 2.
4. Op-amp active filter (R₁ = 1.1k, R₂ = 1.2k, R₃ = 150k, C = 0.01 µF). TF; what if C₂ becomes an inductor; C₁ voltage if R₂ is shorted.

**MT2 F2022 "solution"** (`exams\MT2-F2022-solution.pdf`, Nov 3 2022, 80 min). It is the question paper with solution space.
1. (a) Lever system with transformers (= HW5 Q5). (b) Hydraulic dashpot circuit and Z/Y (= HW6 Q2).
2. Hydraulic controller with power piston `y = (K/s)x`. Block diagram in A, k, b, R; Y/E.
3. Nonlinear circuit `i_o = |e_o|e_o`, `e_i = 4 + ê_i`, given the nonlinear ODE. Operating point; linearised ODE; linearised circuit. Same as T04 P2.
4. Electro-mechanical transducer (moving mass in a magnetic field, Bl). TF of velocity over voltage.

**MT2 W2024 solution** (`exams\MT2-W2024-solution.pdf`, Mongeau handwritten, points shown)
1. (a) Mechanical → mobility and impedance analogs (15 pts: 4 elements × 2 + 6 labels). (b) Pneumatic/hydraulic–mechanical coupled circuit with 1/A transformers, compliances C/ρ, resistances ρR, springs 1/k₁ and 1/k₂ in mechanical mobility (15 pts).
2. Hydraulic dashpot with lever (20 + 15 + 5 pts):
   - `k(y−z) = A(P₂−P₁)`, `q = (P₂−P₁)/R`, `q dt = ρA dz` → `Z/Y = 1/(Ts+1)`, `T = RA²ρ/k`
   - Block diagram with lever ratios b/(a+b), a/(a+b) and K/s
   - `Y/E = (b/(a+b))(K/s) / [1 + (a/(a+b))(K/s)/(Ts+1)]`
3. Nonlinear circuit (R₁ = 1, R₂ = 2, C_A = ½, C_B = ⅙, L = 3), `i_o = ¼e_o³`, `e_i = 8 + e'_i` (25 pts). Three state equations; operating point `ē_o = 2`, `ī_L = 2`, `ē_A = 6`; linearised resistor `i'_o = 3e'_o`, i.e. R = ⅓.
4. Block diagram of a motor plus thermal/flow plant with disturbances ΔT and ΔV₁ (10 + 8 + 7 pts):
   - closed-loop `T_c(s) = 2K_m/(τs² + s + 4K_mK₂/K₁)`
   - sensitivity `S^{T_c}_{K_m} = s(τs+1)/(τs² + s + 4K_mK₂/K₁)`
   - steady-state output for a step disturbance `ΔV₁ = A/s` by FVT: `−AK₁/(4K_mK₂)`

**Final F2009** (Nahon/Sharf, open book, 6 equal questions)
1. Impulse response x₂(t) of a coupled 1st/2nd-order ODE (Laplace).
2. SS (A, B, C, D) of a spring-damper network with displacement input; output is the force at A.
3. RC circuit with a switch: pulse of duration D, find v₁(t).
4. DC servomotor steady-state current for `v = 10 sin 5t` (frequency response).
5. DC motor with PD speed control. K_p and K_d for e_ss < 3 % and ζ = 0.707; root locus vs K_p.
6. Given Matlab ss2tf and Bode of a 4th-order plant, find GM and PM with K_p = 5.

**Final F2010** (Sharf/Mongeau, open book, 7 questions)
1. SS `ẋ₂ = −25x₁ − 10x₂ + f`: stability; x₂ response to ICs.
2. Torsional transmission (J₁, J₂, k, viscous coupling b) with a Bode plot. TF; ω_n and ζ from the given roots; settling time; steady-state speed for `T = 20 + 10 sin 2t`.
3. Loudspeaker electromechanical model (R, L, C circuit, `F = K₁i₂`, `e_b = K₂ẋ`). Model and voltage→cone TF.
4. Rocket/inverted pendulum on a cart `MLθ̈ − (M+m)gθ = f`. Design a control law for ζ = 0.707 and t_s = 8 s (PD stabilisation).
5. Match 12 pole locations to 12 free-response plots.
6. Nonlinear RLC with `v_R = 300 i^{3/2}`. Linearise at i_e = 5 mA; solve for `v = t e^{−3t}`.
7. Unstable plant `(s+3)/(s² − 2s + 10)` with feedback gain K and its root locus. Minimum K for stability; maximum K for oscillation; K for steady state 0.6 to a step of 3.

### Topic frequency (counted over all papers, about 60 question slots)

| Rank | Topic | Approx. count | Where it shows up |
|---|---|---|---|
| 1 | Modelling / EOM / electrical-analog circuits (impedance and mobility, transformers and gyrators, mechanical–acoustic–hydraulic–pneumatic coupling) | ~16 | Every MT2 has a Q1 analog-circuit question; also MT1 F2007, F2009 Q2, F2010 Q2/Q3 |
| 2 | Transfer-function derivation (circuits, op-amps, DC motors, mechanical) | ~14 | Nearly every paper |
| 3 | State space (SS ↔ ODE/TF, input-derivative methods, Φ(t), diagonalisation, Simulink) | ~11 | MT1 every year, MT2 W2009/W2010, finals |
| 4 | Time response (Laplace/PFE, step specs OS/t_p/t_s, pole-zero effects, frequency response at one ω) | ~11 | — |
| 5 | Linearisation of nonlinear circuits and systems (operating point, Taylor, linearised R) | 6 | MT1 W2017, MT2 F2022, MT2 W2024, F2010; also T04, T06, HW5 |
| 6 | Block diagram reduction / SFG / Mason | ~7 | — |
| 7 | Op-amp circuits | 6 | — |
| 8 | Steady-state error and sensitivity, disturbance | 6 | MT2 W2011, W2012, W2019, makeup, W2024, F2009 |
| 9 | Hydraulic/pneumatic controllers (lever + servo + dashpot → PI form) | 4 | MT2 W2019, F2022, W2024; T08 |
| 10 | Liquid-level tanks | 4 | — |
| 11 | DC motor servo | ~6 | Overlaps with rows 2 and 8 |
| 12 | Root locus | 3 | F2009, F2010, plus HW |
| 13 | Bode / margins | 3 | — |
| 14 | PID / Z-N / controller design | 3 | — |
| 15 | Routh | ~2 explicit | Implicit in several |
| 16 | Nyquist | 0 in the archive | HW only |

The archive has no "final" for the 2024 format. The 2024 final ("MT3") will be weighted to steady-state error, Routh, PID/Z-N, root locus, Bode/margins, lead/lag and Nyquist (L17–23). That block is under-represented in past papers, so HW7–HW10, HW8-2024 and the L20–L23 worked examples are the best predictors.

### Recurring question templates
1. **"Draw any valid equivalent circuit"** (mobility and/or impedance), with labelled potential/flux and transformers (lever ratio, piston area A, Bl, K_t) between domains. Marks are per element and per label. This appears in every MT2.
2. **Nonlinear element circuit.** Write the state equations, find the DC operating point for `e_i = ē + ê`, linearise with Taylor (`dI/de` at the operating point gives an equivalent resistor), and draw the linearised circuit or SS. Nonlinearities used: `i = |e|e`, `¼e³`, `e³`, `300 i^{3/2}`.
3. **Hydraulic dashpot / servo with lever feedback.** Derive Z/Y = 1/(Ts+1) or Ts/(Ts+1), build the block diagram with a/(a+b) ratios and K/s, then reduce to P or PI form (K_p, T_i).
4. **DC motor.** Find the TF `Θ/E_a` or `Ω/E_a`, close a loop (position or tach), then ask for gain for a spec, e_ss, a disturbance step, or sensitivity to a drifting parameter.
5. **SS from an ODE with input derivatives (Method 1 / Method 2)**, or from a block diagram. Also Φ(t) via `L⁻¹[(sI−A)⁻¹]`, eigenvalues, and diagonalisation.
6. **Second-order spec problems.** Given OS%, t_r, t_p or t_s, find ζ, ω_n, gains; or read them from a plot. Includes the effect of an extra zero.
7. **Steady-state error / sensitivity.** Use `E = R/(1+GH)` and the FVT; `S^T_K = (∂T/∂K)(K/T)`; type number; step/ramp disturbance.
8. **Op-amp TF by the impedance method** `−Z₂/Z₁`, often recognised as a PID, lead or lag network.
9. **Matlab interpretation.** `residue`, `initial`, `ss2tf`, `bode` output, and filling in a Simulink diagram.
10. **(Final/MT3)** Routh range of K; root locus K for ζ; Z-N tuning; lead/lag via Bode to meet K_v and PM; GM/PM from a Bode plot; Nyquist encirclements.

### Permitted materials and handouts
- **`handouts\handout1.pdf` ("MECH 412 HANDOUT – MID-TERM 1", 4 p).** Stapled to MT1 and MT2 papers. Contains:
  - TF definition for an LTDE and the impulse-response definition `g = L⁻¹[G]`.
  - General state and output equations with the A, B, C, D matrix definitions.
  - Method 1 (β coefficients `β₀ = b₀`, `β₁ = b₁ − a₁β₀`, …, `β_n = b_n − a₁β_{n−1} − … − a_nβ₀`) and Method 2 (companion form; `C = [b_n − a_nb₀ … b₁ − a₁b₀]`, `D = b₀`).
  - Ogata Table 2-1 of Laplace transform pairs (#1–31, including the standard 2nd-order step/impulse forms with `φ = tan⁻¹(√(1−ζ²)/ζ)`).
- **`handouts\handout2.pdf` (analogies table, 5 p).** Attached to MT2 papers. Rows: liquid level, pneumatic, acoustic, hydraulic, thermal, mechanical impedance, mechanical mobility, electrical. Columns: potential, flux, R, C, L. Entries include:
  - Liquid level: `R_l = 2H/Q`, `C_l = A_tank`, `M_l = L_pipe/(gA_pipe)`.
  - Pneumatic: `C_pn = V/(nR_gasT)`, `M_pn = L/A`.
  - Acoustic: `C_A = V/(ρc₀²)`, `M_A = ρL/A`.
  - Hydraulic: `C_h = ρV/β`.
  - Thermal: `R_t = 1/K`, `C_t = mc_p`.
  - Mechanical: `C_M = 1/k`, `M_M`, `R_M` (mobility `r_M = 1/R_M`).
  - Handout 2 also re-includes the MT1 handout pages.
- **Crib sheets.**
  - MT1: one 2-sided handwritten sheet (2009–2024).
  - MT2: two sheets.
  - 2024 final: three sheets plus the original bound textbook.
  - Older finals were open book.

---

## 4. Tutorials and Anthony's review files

### Tutorials
- **T01 (`T01-sol.pdf`, Jan 9 2024).** Laplace solution of ODEs:
  - `ẍ + 2ẋ + x = δ(t−τ)` (critically damped)
  - `ẍ + 2ẋ + 2x = 1` (underdamped, ζ = 1/√2)
  - `ẍ + 3ẋ + 2x = sin t` (transient + steady state)
  - Time response, steady state, ζ and ω_n, sketches.
- **T02/T03:** not present.
- **T04 (`T04.pdf` problems) and T05 (`T05-sol.pdf`) — T05-sol solves the T04 problems.**
  - P1: RLC circuit (5 Ω, 2 H, 1 F, 10 Ω). Block diagram, SFG, SS, `TF = 1/(s² + 5.2s + 1.5)`, Φ(t).
  - P2: nonlinear `i_o = |e_o|e_o`, `e_i = 4 + ê`. Operating point, linearised `(2s+1)/(s²+7s+1)`, SS, block diagram, SFG, steady state.
  - P3: TF / pole-zero / SS of a given system.
- **T06 (`T06-sol.pdf`).**
  - Q1: Sallen-Key Butterworth op-amp filter (2nd order, plus a cascaded 1st-order RC = 3rd order). TFs, corner frequency, Bode slopes −20/−40/−60 dB/dec.
  - Q2: DC motor with field and armature in parallel. Nonlinear `ω̇ + ω + ωe_i = e_i²`, linearised `ω̂̇ + 2ω̂ = 1.5ê_i − τ_L`, t_s = 2 s.
  - Q3: maglev linearisation `F = ki²/z²`.
- **T07 (`T07.pdf` and `T07-sol.pdf`).**
  - Q1: DC motor (constant field) as a circuit with a transformer. `Ω/E_i = −K_tI_f/[(L_As + R_A)(Js + B) − K_bK_tI_f]` (sign convention as in his notes).
  - Q2: two-mass system M₁, M₂, K₁, K₂, B₁–B₃. Mobility and impedance analogs, coupled loop equations.
  - Q3: acoustic–mechanical–acoustic chain (cavities C_A, masses M_A, piston S₁/S₂). Circuit and SS for the cavity pressures.
- **T08 (`T08-sol.pdf`).**
  - Q1: two-tank liquid level with P controller and disturbance q_d:
    - `H₂/Q_i = R₂/[(R₁C₁s+1)(R₂C₂s+1)]`
    - `H₂/Q_d = R₂/(R₂C₂s+1)`
    - closed loop `K_p/(s² + 2s + 1 + K_p)`
  - Q2: Ogata Fig 4-48 pneumatic controller (nozzle-flapper, bellows, R₁C₁R₂C₂ network) → block diagram.
  - Q3: bellows-lever-hydraulic servo → `Y/P_i = A/(ks/K_H + 1)`, step `1 − e^{−t}`.
- **`exams\MT2-tutorials.pdf` (27 p).** Compilation of the T05–T08 solutions as an MT2 study pack.

### Anthony's reviews (`reviews\`)
- **`cheat-sheet-mine.pdf` (1 dense page; his MT1 crib sheet).** Contents:
  - L1 feedback loop; unit step and Dirac properties.
  - L2 complex numbers; Laplace definition and inverse integral; IVT and FVT; derivative rules; PFE methods 1–3 (real, complex via completing the square, repeated).
  - ODE solution split into forced and free parts.
  - L4 specs: `t_r = 1.8/ω_n`, `t_p = π/ω_d`, `t_s = 4/(ζω_n)` (2 %) and `3/(ζω_n)` (5 %), `OS = 100e^{−ζπ/√(1−ζ²)}`, `ζ = −ln(OS)/√(π² + ln²OS)`, overshoot with a zero.
  - L5 error ratio `1/(1+GH)` and feedback ratio `HG/(1+HG)`; Bode phase and magnitude by hand, e.g. `(s+3)/((s+1)(s+2))`.
  - Mason's rule.
  - State-space method 2, block diagram with b₁ b₂ b₃.
  - Principal coordinates `P = [1 1; λ₁ λ₂]`, `P⁻¹AP` diagonal.
  - `G = C(sI−A)⁻¹B + D`; `Φ = L⁻¹[(sI−A)⁻¹]`.
  - Linearity and time invariance, convolution.
  - Moments of inertia; `ω_n = √(k/m)`, `c/m = 2ζω_n`.
  - Mechanical worked notes (rolling disk, instant centre).
- **`MT2-review.pdf` (12 p).** His MT2 crib material:
  - Electrical laws and impedances, transformer (`e₃₄ = m e₁₂`, `i_b = i_a/m`), gyrator, series/parallel impedance, KVL/KCL, voltage divider and double divider, sinusoidal response.
  - Op-amp rules (`V⁻ = V⁺`, `i = 0`, `−Z₂/Z₁`).
  - Linearisation formula.
  - Mobility/impedance table with mobility rules (start from the force input; lever → transformer `(l₁/l₂):1`; gears `m₂/m₁`).
  - DC motor circuit and `E_i/Ω`.
  - Acoustic elements, mechanical→acoustic transformer S:1 or gyrator 1/S, example circuits.
  - Pneumatic: lever, nozzle-flapper, bellows `P_iA = k(x−z)`, servo `y/w = K_H/s`, `X/P_i` result.
  - Hydraulic tanks with superposition for multiple inputs (T08 Q1); tank circuits with ρg scaling; thermometer RC.
  - He flags weak spots with red warning signs: Bode plotting, the double divider, the nonlinear circuit example, and T08 Q2.
- **`review-final-early.pdf` (21 p), `review-4.pdf` (27 p), `review-5.pdf` (41 p).** Progressively longer versions of lecture-by-lecture notes (Goodnotes, slide snippets with handwriting). final-early ends at state space (transition matrix, Method 1/2 derivation, P⁻¹AP, eigenvalues, Vandermonde/Jordan).
- **`review-full.pdf` (97 p, Apr 14 2024).** The complete version and the best single source for summary pages. It runs:
  1. L1–L10: math, Laplace, specs, block diagrams, SFG, state space.
  2. MT2 material (sampled around p.60–64): analogies, tanks, pneumatics.
  3. "Review Final" (p.65–66): open- vs closed-loop e_ss, gain-sensitivity example, system types.
  4. Routh with special cases and the K range example (p.70–71).
  5. L19 PID forms (p.71).
  6. A root-locus compensator example `G_c = 1.6(s+2)/(s+4)` on `5/[s(0.5s+1)]` at `s = −2 ± j2√3` (p.80).
  7. Valve-cylinder pole placement (p.81–83).
  8. Root-locus example with tach k for ζ = 0.4 (K' = 9, k = 0.45) (p.84–86).
  9. L21 Bode building blocks, polar plots, drawing Bode, error constants from Bode (p.73–75).
  10. L22 lead/lag/lag-lead summary and the lead example result `G_c = (10/0.24)(s+4.4)/(s+18.4)` (p.87–90).
  11. Lag Ex 11-7 (p.91–93).
  12. L23 Cauchy and Nyquist premise (p.94); pages 95–97 are blank, so Nyquist is unfinished.
- **`additional-problems.pdf` (13 p).** "Mech 412: Supplementary problems on electrical analog models", problems 1–6 with solutions (e.g. a transformer for a mechanical lever).

---

## 5. `notes-unsorted\` classification

**None of the unsorted files is MECH 412.**

| File | Course | Contents |
|---|---|---|
| `Alex_240321_195442.pdf` | Not a course (French tutoring) | Trigonometry: law of cosines, SOH-CAH-TOA |
| `Antoine_240319_175847 (1).pdf` | Not a course (French tutoring) | Proportionality tables / cross-multiplication |
| `Gabriel_240321_182919.pdf` | Not a course (French tutoring) | Dot product / projection `AH = AC·cos(BAC)` |
| `Notes_240116_175751 (1).pdf` | Not a course (French tutoring) | Pythagoras |
| `ass2.pdf` | MECH 559 (design optimisation) | Monotonicity analysis: f = x₂ − x₁ with g₁–g₃ linear constraints, active-constraint reasoning |
| `Notes_240128_175434 (3).pdf` | MECH 559 | Same monotonicity analysis as `ass2.pdf` (duplicate) |
| `Notes_240128_180613.pdf` | MECH 559 | Same monotonicity analysis (duplicate) |
| `Note Jan 27, 2024.pdf` | MECH 559 | Relaxation theorem, monotonicity principles, can-design min-area example, Taylor optimality conditions |
| `Representative problems .pdf` | MECH 559 | Constrained minimum-distance problem, reduced gradient (state/decision variables) |
| `Representative problems  2.pdf` | MECH 559 | Near-duplicate of the above |
| `Notes_240107_140720.pdf` | Probably MECH 559 | Cantilever beam mass `ρbhL`, `σ_max = 6PL/(bh²)`, deflection `4PL³/(Ebh³)` (design-optimisation formulation; possibly a mechanics refresher) |
| `Exercise_240218_121038.pdf` | MECH 346 (heat transfer) | Nuclear fuel rod in a steel tube, cylindrical conduction plus convection resistances |
| `Notes_240427_202341 (2).pdf` | MECH 346 | Final-exam Q3: radioactive cylinder heating an oil pipeline, laminar internal-flow Nusselt (Re = 636, Hausen correlation) |
| `Notes_240427_203939.pdf` | MECH 346 | Same Q3 (duplicate) |
| `Binder1.pdf` | ECSE 223 (model-based programming) | UML sequence diagrams (sync/async messages, combined fragments `alt`, bank/cheque example) |
| `March 13_240313_111203 (2).pdf` | ECSE 223 | State-machine exercise "Printer with integrated scanner" (photo of slide plus notes on states, history state) |
| `whatsapp-2024-03-25\` (10 photos) | ECSE 223 | UML state machines: initial pseudostate, trigger [guard] / action, traffic light, auction bid example, hierarchical/concurrent "Spa Management System" (Jacuzzi levels with history state, sauna stove/fan/water regions) |
| `whatsapp-2024-04-17\` (11 photos) | ECSE 223 | UML sequence diagrams and object-diagram walkthroughs of association operations (`d1.addComment(c3)`, discovery/comment links, step-by-step object states) |

From the WhatsApp folders I sampled 2 photos per folder; the rest look like the same series. Only Anthony's `my-homework\Mech412-unknown.pdf` (10 p) is MECH 412: it is HW2 Q1, the 2nd-order system with a zero, decomposed into the standard `ω_n²/(s²+2ζω_n s+ω_n²)` plus `½·sω_n²/(…)` terms.

---

## 6. Simulation ideas (realistic hardware, tied to course examples)

1. **Mass-spring-damper workbench (L3, L4, T01, HW2, MT1 F2011 Q3).**
   - A rendered steel block on rails, a coil spring that visibly compresses, and an oil dashpot.
   - Sliders for m, k, b and the input type (step, impulse, sinusoid, ICs). Live x(t) next to the s-plane poles. Show OS, t_p, t_s and ω_d markers.
   - Preset the L03 example (m = 1, k = 100, b = 2) and display free + forced decomposition curves as in the L03 Matlab script.
   - Toggle "add zero" for the HW2 Q1 / MT1 F2011 Q4 effect.
2. **Pole-location → response explorer (L4/L5 polls, Final F2010 Q5).**
   - Drag poles in the s-plane, with a little car suspension or pendulum responding beside it.
   - Include a "match the 12 free responses" quiz mode.
3. **DC motor lab (L12, T07, MT2 W2010/W2011/W2012, makeup Q2, F2009 Q4/5).**
   - Cutaway brushed DC motor (armature R_a, L_a, back-EMF) driving an inertia or flywheel load, with tachometer and potentiometer.
   - Modes: open-loop voltage step (current spike, speed rise); tach-feedback speed loop with K_p and an R_a drift slider to show sensitivity; position servo / robot gripper with a load-torque disturbance and visible steady-state error.
   - Show the equivalent transformer circuit alongside.
4. **Mechanical ↔ electrical analogy morpher (L11, handout 2, every MT2 Q1).**
   - Build a mechanical network by drag-and-drop (masses, springs, dashpots, force or velocity sources, levers).
   - The site auto-draws the mobility and impedance circuits, animating mass → capacitor/inductor and so on. Lever → transformer with ratio l₁/l₂.
   - Also run both simulations side by side to prove identical responses. Include the HW5 Q5 / MT2 F2022 Q1a lever and the MT2 W2024 Q1 system.
5. **Liquid-level tanks (L15, T08 Q1, MT2 W2012 Q2, makeup Q3, MT2 W2011 Q2).**
   - Two water tanks with valves (adjustable R), inflow pump, and a disturbance inflow q_d.
   - Animated water levels; interacting vs non-interacting configurations.
   - Toggle a P / PI level controller (float sensor + valve) to show offset with P and none with PI.
   - Live circuit analog with capacitors = tanks.
6. **Hydraulic servo with dashpot feedback / speed governor (L15, MT2 W2019 Q2, F2022 Q2, W2024 Q2, T08 Q3).**
   - Spool valve, power piston (`Y/X = K/s`), floating lever (a, b), and dashpot (`T = RA²ρ/k`).
   - The user moves the input lever and watches the piston and dashpot. Show how the dashpot feedback turns it into P or PI action (K_p, T_i).
   - Optionally add a fly-ball governor on an engine.
7. **Pneumatic nozzle-flapper controller (L14, T08 Q2, HW6 Q3).**
   - Flapper gap, nozzle back-pressure gauge, bellows, restrictions R and capacitances C.
   - Switch the feedback bellows arrangement to produce P / PD / PI / PID.
8. **Nonlinear circuit linearisation (L10, T04 P2, MT1 W2017, MT2 F2022, MT2 W2024 Q3, F2010 Q6).**
   - A breadboard circuit with a nonlinear resistor (`i = ¼e³` or `|e|e`).
   - Plot the i–e curve with a tangent line at the operating point; show the small-signal resistor R = 1/slope, e.g. ⅓ Ω at ē = 2.
   - Overlay the nonlinear vs linearised step responses for small and large input perturbations.
9. **Op-amp filter / PID circuit bench (L10–L11, T06 Butterworth, MT2 W2011 Q4, makeup Q4).**
   - An op-amp schematic with editable R and C. Live Bode plot and oscilloscope (input/output sine).
   - Presets: inverting, lead/lag network, Sallen-Key Butterworth, PID op-amp.
10. **Cruise control / water-heater PID tuner (L19, HW7 Q3/Q4, HW10 Q1).**
    - A car climbing hills (disturbance) or the L19 water-tank/temperature demo.
    - Sliders for K_p, K_i, K_d; live OS, t_s and e_ss readouts (as in the L19 `lsiminfo` script).
    - Z-N "find K_u" button (ramp the gain until sustained oscillation), applied to the paper machine `e^{−2s}/(3s+1)` with K_u = 3.044.
11. **Inverted pendulum / rocket attitude (L3, L10, Final F2010 Q4).**
    - Cart-pole graphic. Open loop it falls; with a PD law (sliders) it stabilises.
    - Show root locus and pole migration live; design for ζ = 0.707 and t_s = 8 s.
12. **Maglev train linearisation (HW5 Q1, T06 Q3).**
    - Train car floating over a rail with an adjustable coil current.
    - Shows the unstable equilibrium, the Taylor-linearised model, and the need for feedback.
13. **Root-locus sandbox (L20, HW7 Q5, HW9, F2010 Q7, MT3).**
    - Place poles and zeros and drag K along the locus. Show asymptotes, centroid, breakaway and jω crossing (with the Routh row).
    - Paired with a physical plant animation, e.g. the valve-controlled hydraulic cylinder `0.01087/(2.488e−6s² + …)` with controller `K_c(s+100)`, or `K/[s(s+1)(s+2)]`.
    - ζ and t_s constraint wedges overlaid.
14. **Bode / margins / lead-lag designer (L21–L22, HW8-2024, HW10).**
    - The plant `40/[s(s+2)]` as a positioning table or antenna dish.
    - Add a lead or lag compensator by dragging its zero and pole on the Bode plot. Show PM, GM and ω_c, and the resulting dish step response.
    - Walk through the 6-step lead and lag procedures and Ogata Ex 11-7.
15. **Nyquist encirclement visualiser (L23, HW8/10 Q5).**
    - An animated Nyquist contour in the s-plane mapping to an L(jω) trace, with a counter of encirclements of −1 and the formula Z = N + P.
    - Examples: `K/[s(s+1)]`, `K/[s(s−1)]` plus derivative feedback, `K(s−2)/(s+1)²`.
    - Tie it to a real loop such as the antenna or DC motor so that crossing −1 visibly destabilises the hardware.
16. **Loudspeaker / moving-coil transducer (L12, Final F2010 Q3, MT2 F2022 Q4).**
    - Animated cone and voice coil (`f = Bli`, `e = Blu`). Frequency sweep showing the resonance and the coupled electrical–mechanical circuit with a gyrator.

### Suggested site structure
Three exam tracks:
- **MT1:** L1–8. Laplace, specs, block diagrams/SFG, state space.
- **MT2:** L9–16. Circuits, op-amps, linearisation, analogies, transducers, acoustic, pneumatic, hydraulic, liquid, thermal, sensitivity.
- **MT3 / final:** L17–23. e_ss, Routh, PID/Z-N, root locus, Bode, lead/lag, Nyquist.

Each track gets a formula page (seeded from Anthony's cheat sheet and MT2 review), the handouts content, past-exam templates, and the simulations above. Add a note that the L06 and L16 content is reconstructed from evidence in the other files.