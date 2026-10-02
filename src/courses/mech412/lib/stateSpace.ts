/**
 * State-space tools: small dense matrix utilities, characteristic polynomial and eigenvalues, the matrix
 * exponential Phi(t) (numerical and as closed-form modes), SS -> TF by Faddeev-LeVerrier, the handout-1
 * realisations "Method 1" (beta coefficients) and "Method 2" (controllable companion form), Vandermonde
 * diagonalisation of a companion matrix, and numerical linearisation.
 * Matrices are arrays of rows.
 */
import { C, ONE, ZERO, abs, c, conj, div as cdiv, exp as cexp, mul as cmul, sub as csub, add as cadd, scale as cscale } from './complex';
import { Poly, roots, trim } from './poly';
import { SS, tf2ss } from './lti';
import { TimeTerm, timeTermsToString } from './pfe';

export type Mat = number[][];
export type CMat = C[][];

export const zeros = (n: number, m = n): Mat => Array.from({ length: n }, () => new Array<number>(m).fill(0));
export const identity = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const transpose = (A: Mat): Mat => (A.length ? A[0].map((_, j) => A.map((r) => r[j])) : []);
export const matAdd = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((v, j) => v + B[i][j]));
export const matSub = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((v, j) => v - B[i][j]));
export const matScale = (A: Mat, k: number): Mat => A.map((r) => r.map((v) => v * k));
export function matMul(A: Mat, B: Mat): Mat {
  const n = A.length;
  const m = B[0]?.length ?? 0;
  const p = B.length;
  const out = zeros(n, m);
  for (let i = 0; i < n; i++) for (let k = 0; k < p; k++) {
    const a = A[i][k];
    if (a !== 0) for (let j = 0; j < m; j++) out[i][j] += a * B[k][j];
  }
  return out;
}
export const matVec = (A: Mat, v: number[]): number[] => A.map((r) => r.reduce((s, a, j) => s + a * v[j], 0));
export const trace = (A: Mat): number => A.reduce((s, r, i) => s + r[i], 0);
const norminf = (A: Mat): number => Math.max(0, ...A.map((r) => r.reduce((s, v) => s + Math.abs(v), 0)));

/** Inverse by Gauss-Jordan with partial pivoting. */
export function inverse(A: Mat): Mat {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...identity(n)[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-300) throw new RangeError('inverse: singular matrix');
    [M[i], M[p]] = [M[p], M[i]];
    const d = M[i][i];
    for (let j = 0; j < 2 * n; j++) M[i][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r][i];
      if (f !== 0) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[i][j];
    }
  }
  return M.map((r) => r.slice(n));
}

export function det(A: Mat): number {
  const n = A.length;
  const M = A.map((r) => r.slice());
  let d = 1;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (M[p][i] === 0) return 0;
    if (p !== i) {
      [M[i], M[p]] = [M[p], M[i]];
      d = -d;
    }
    d *= M[i][i];
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i];
      for (let j = i; j < n; j++) M[r][j] -= f * M[i][j];
    }
  }
  return d;
}

/**
 * Faddeev-LeVerrier: returns det(sI - A) (highest power first, length n+1) and the matrices M_k with
 * adj(sI - A) = sum_{k=1}^{n} M_k s^{n-k} (stored as adj[k-1] = M_k).
 */
export function faddeev(A: Mat): { den: Poly; adj: Mat[] } {
  const n = A.length;
  const coef = new Array<number>(n + 1).fill(0); // coef[i] multiplies s^i
  coef[n] = 1;
  const M: Mat[] = new Array(n + 1);
  M[0] = zeros(n);
  for (let k = 1; k <= n; k++) {
    M[k] = matAdd(matMul(A, M[k - 1]), matScale(identity(n), coef[n - k + 1]));
    coef[n - k] = -trace(matMul(A, M[k])) / k;
  }
  return { den: coef.slice().reverse(), adj: M.slice(1) };
}

/** Characteristic polynomial det(sI - A), highest power first. */
export const charPolyOf = (A: Mat): Poly => (A.length ? faddeev(A).den : [1]);
/** Eigenvalues of A (roots of the characteristic polynomial). */
export const eigenvalues = (A: Mat): C[] => (A.length ? roots(charPolyOf(A)) : []);

/** Matrix exponential exp(A t) by scaling and squaring with a 20-term Taylor series. */
export function expm(A: Mat, t = 1): Mat {
  const n = A.length;
  let B = matScale(A, t);
  const nrm = norminf(B);
  const sq = nrm > 0.5 ? Math.max(0, Math.ceil(Math.log2(nrm / 0.5))) : 0;
  B = matScale(B, Math.pow(2, -sq));
  let term = identity(n);
  let sum = identity(n);
  for (let k = 1; k <= 20; k++) {
    term = matScale(matMul(term, B), 1 / k);
    sum = matAdd(sum, term);
  }
  for (let i = 0; i < sq; i++) sum = matMul(sum, sum);
  return sum;
}
/** State-transition matrix Phi(t) = exp(A t). */
export const phi = (A: Mat, t: number): Mat => expm(A, t);

/* ---------- complex matrices (small, for modes and diagonalisation) ---------- */
export const toCMat = (A: Mat): CMat => A.map((r) => r.map((v) => c(v)));
export const cMatMul = (A: CMat, B: CMat): CMat => {
  const n = A.length;
  const m = B[0]?.length ?? 0;
  const out: CMat = Array.from({ length: n }, () => new Array<C>(m).fill(ZERO));
  for (let i = 0; i < n; i++) for (let k = 0; k < B.length; k++) for (let j = 0; j < m; j++) out[i][j] = cadd(out[i][j], cmul(A[i][k], B[k][j]));
  return out;
};
export function cInverse(A: CMat): CMat {
  const n = A.length;
  const M: CMat = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO))]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (abs(M[r][i]) > abs(M[p][i])) p = r;
    if (abs(M[p][i]) < 1e-300) throw new RangeError('cInverse: singular matrix');
    [M[i], M[p]] = [M[p], M[i]];
    const d = M[i][i];
    for (let j = 0; j < 2 * n; j++) M[i][j] = cdiv(M[i][j], d);
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r][i];
      for (let j = 0; j < 2 * n; j++) M[r][j] = csub(M[r][j], cmul(f, M[i][j]));
    }
  }
  return M.map((r) => r.slice(n));
}

/** Closed-form modes of Phi(t) for distinct eigenvalues: Phi(t) = sum_i e^{lambda_i t} Z_i, Z_i = prod_{j != i} (A - lambda_j I)/(lambda_i - lambda_j). */
export interface PhiMode {
  lambda: C;
  Z: CMat;
}
export function phiModes(A: Mat): PhiMode[] {
  const n = A.length;
  const lam = eigenvalues(A);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (abs(csub(lam[i], lam[j])) < 1e-7) throw new RangeError('phiModes: repeated eigenvalues are not supported (use expm)');
  return lam.map((li, i) => {
    let Z: CMat = toCMat(identity(n));
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const F: CMat = toCMat(A).map((r, a) => r.map((v, b) => (a === b ? csub(v, lam[j]) : v)));
      Z = cMatMul(Z, F).map((r) => r.map((v) => cdiv(v, csub(li, lam[j]))));
    }
    return { lambda: li, Z };
  });
}
/** Evaluate Phi(t) from its modes (real part). */
export const phiFromModes = (modes: PhiMode[], t: number): Mat => {
  const n = modes[0].Z.length;
  const out = zeros(n);
  for (const m of modes) {
    const e = cexp(cscale(m.lambda, t));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i][j] += cmul(e, m.Z[i][j]).re;
  }
  return out;
};
/** Readable entries of Phi(t): result[i][j] is the TimeTerm list (and string) of Phi_ij(t). */
export function phiTimeTerms(A: Mat): { terms: TimeTerm[][][]; text: string[][] } {
  const modes = phiModes(A);
  const n = A.length;
  const terms: TimeTerm[][][] = Array.from({ length: n }, () => Array.from({ length: n }, () => [] as TimeTerm[]));
  for (const m of modes) {
    const real = Math.abs(m.lambda.im) < 1e-9 * (1 + abs(m.lambda));
    if (!real && m.lambda.im < 0) continue;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const z = m.Z[i][j];
      if (real) {
        if (Math.abs(z.re) > 1e-10) terms[i][j].push({ coef: z.re, power: 0, sigma: m.lambda.re, omega: 0, trig: 'none' });
      } else {
        if (Math.abs(z.re) > 1e-10) terms[i][j].push({ coef: 2 * z.re, power: 0, sigma: m.lambda.re, omega: m.lambda.im, trig: 'cos' });
        if (Math.abs(z.im) > 1e-10) terms[i][j].push({ coef: -2 * z.im, power: 0, sigma: m.lambda.re, omega: m.lambda.im, trig: 'sin' });
      }
    }
  }
  return { terms, text: terms.map((row) => row.map((t) => timeTermsToString(t))) };
}

/* ---------- SS -> TF ---------- */
/**
 * Transfer matrix G(s) = C (sI - A)^{-1} B + D by Faddeev-LeVerrier. Returns den (common) and num[i][j] polynomials.
 */
export function transferMatrix(ss: SS): { num: Poly[][]; den: Poly } {
  const n = ss.A.length;
  const p = ss.C.length;
  const m = ss.B[0]?.length ?? ss.D[0].length;
  const { den, adj } = n ? faddeev(ss.A) : { den: [1], adj: [] };
  const scaleV = Math.max(1, ...den.map(Math.abs));
  const num: Poly[][] = [];
  for (let i = 0; i < p; i++) {
    const row: Poly[] = [];
    for (let j = 0; j < m; j++) {
      // adj coefficients: M_k multiplies s^(n-k), so it sits at index k of the descending list (length n+1)
      const poly = new Array<number>(n + 1).fill(0);
      for (let k = 1; k <= n; k++) {
        const Mk = adj[k - 1];
        let v = 0;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) v += ss.C[i][a] * Mk[a][b] * ss.B[b][j];
        poly[k] = v;
      }
      for (let k = 0; k <= n; k++) poly[k] += ss.D[i][j] * den[k];
      row.push(trim(poly, 1e-11 * scaleV));
    }
    num.push(row);
  }
  return { num, den };
}
/** SISO convenience: G(s) = num/den. */
export function ss2tf(ss: SS): { num: Poly; den: Poly } {
  const { num, den } = transferMatrix(ss);
  return { num: num[0][0], den };
}

/* ---------- Handout-1 realisations ---------- */
const normalised = (num: Poly, den: Poly) => {
  const d = trim(den);
  const n = d.length - 1;
  const a = d.map((x) => x / d[0]);
  const nn = trim(num);
  if (nn.length > d.length) throw new RangeError('improper transfer function');
  const b = new Array<number>(n + 1 - nn.length).fill(0).concat(nn.map((x) => x / d[0]));
  return { n, a, b };
};

/**
 * Method 1 (handout 1): beta_0 = b_0, beta_k = b_k - a_1 beta_{k-1} - ... - a_k beta_0.
 * x' = A x + B u, y = [1 0 ... 0] x + beta_0 u with B = [beta_1 ... beta_n]^T and A the companion matrix with last row [-a_n ... -a_1].
 */
export function method1(num: Poly, den: Poly): { beta: number[]; ss: SS } {
  const { n, a, b } = normalised(num, den);
  const beta: number[] = [];
  for (let k = 0; k <= n; k++) {
    let v = b[k];
    for (let i = 1; i <= k; i++) v -= a[i] * beta[k - i];
    beta.push(v);
  }
  const A = zeros(n);
  for (let i = 0; i < n - 1; i++) A[i][i + 1] = 1;
  for (let j = 0; j < n; j++) A[n - 1][j] = -a[n - j];
  return {
    beta,
    ss: { A, B: beta.slice(1).map((v) => [v]), C: [[1, ...new Array<number>(n - 1).fill(0)]], D: [[beta[0]]] },
  };
}
/** Method 2 (handout 1): controllable companion form with C = [b_n - a_n b_0, ..., b_1 - a_1 b_0], D = b_0. */
export const method2 = (num: Poly, den: Poly): SS => tf2ss({ num, den });

/* ---------- Vandermonde diagonalisation ---------- */
export interface Diagonalised {
  lambdas: C[];
  /** Vandermonde matrix P_ij = lambda_j^(i-1): columns are the eigenvectors [1, lambda, lambda^2, ...]^T of a companion matrix */
  P: CMat;
  Ad: CMat;
  Bd: CMat;
  Cd: CMat;
  Dd: CMat;
}
export function vandermonde(lam: C[]): CMat {
  const n = lam.length;
  return Array.from({ length: n }, (_, i) =>
    lam.map((l) => {
      let v: C = ONE;
      for (let k = 0; k < i; k++) v = cmul(v, l);
      return v;
    }),
  );
}
/**
 * Diagonalise a system in controllable companion form with distinct eigenvalues: x = P z, z' = Lambda z + P^{-1} B u, y = C P z + D u.
 * (Only valid when A is in the Method-2 companion form; the Vandermonde matrix is then the eigenvector matrix.)
 */
export function diagonalizeCompanion(ss: SS): Diagonalised {
  const lambdas = eigenvalues(ss.A);
  const P = vandermonde(lambdas);
  const Pi = cInverse(P);
  const Ad = cMatMul(cMatMul(Pi, toCMat(ss.A)), P);
  return { lambdas, P, Ad, Bd: cMatMul(Pi, toCMat(ss.B)), Cd: cMatMul(toCMat(ss.C), P), Dd: toCMat(ss.D) };
}
export const cMatConj = (A: CMat): CMat => A.map((r) => r.map(conj));

/* ---------- linearisation ---------- */
/** Central-difference derivative of f at x0. */
export function derivative1(f: (x: number) => number, x0: number, h = 1e-6 * Math.max(1, Math.abs(x0))): number {
  return (f(x0 + h) - f(x0 - h)) / (2 * h);
}
/** Jacobian df_i/dx_j at x0 by central differences. */
export function jacobian(f: (x: number[]) => number[], x0: number[], h = 1e-6): Mat {
  const cols = x0.map((_, j) => {
    const hh = h * Math.max(1, Math.abs(x0[j]));
    const xp = x0.slice();
    const xm = x0.slice();
    xp[j] += hh;
    xm[j] -= hh;
    const fp = f(xp);
    const fm = f(xm);
    return fp.map((v, i) => (v - fm[i]) / (2 * hh));
  });
  return transpose(cols);
}
/** Small-signal resistance of a nonlinear resistor i = f(e) at the operating point e0: r = 1 / (di/de). */
export const linearizedResistance = (iOfE: (e: number) => number, e0: number): number => 1 / derivative1(iOfE, e0);
