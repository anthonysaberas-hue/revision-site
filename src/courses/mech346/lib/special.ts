/** Special functions needed by the course: Bessel J0/J1, erf/erfc, and a robust bisection solver. */

export function J0(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const b = 57568490411.0 + y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
    return a / b;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 0.785398164;
  const a = 1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const b = -0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * a - z * Math.sin(xx) * b);
}

export function J1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const b = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a / b;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 2.356194491;
  const a = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const b = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * a - z * Math.sin(xx) * b);
  return x < 0 ? -ans : ans;
}

/** Complementary error function (Numerical Recipes erfcc, |error| < 1.2e-7) refined with a series for small x. */
export function erf(x: number): number {
  if (Math.abs(x) < 2.5) {
    // Maclaurin series: erf(x) = 2/sqrt(pi) * sum (-1)^n x^(2n+1) / (n! (2n+1))
    let sum = x;
    let term = x;
    for (let n = 1; n < 80; n++) {
      term *= (-x * x) / n;
      sum += term / (2 * n + 1);
      if (Math.abs(term) < 1e-17) break;
    }
    return (2 / Math.sqrt(Math.PI)) * sum;
  }
  return Math.sign(x) * (1 - erfcPos(Math.abs(x)));
}
function erfcPos(x: number): number {
  // continued fraction for large x
  let f = 0;
  for (let k = 60; k >= 1; k--) f = k / 2 / (x + f);
  return Math.exp(-x * x) / (Math.sqrt(Math.PI) * (x + f));
}
export const erfc = (x: number) => (x < 2.5 ? 1 - erf(x) : erfcPos(x));

/** Bisection on [a, b]; assumes a sign change. */
export function bisect(f: (x: number) => number, a: number, b: number, tol = 1e-12, maxIter = 200): number {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error('bisect: no sign change');
  for (let i = 0; i < maxIter; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0 || (b - a) / 2 < tol) return m;
    if (fa * fm < 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  return 0.5 * (a + b);
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-300) throw new Error('singular matrix');
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

// ---- modified Bessel functions (Numerical Recipes rational approximations, ~1e-7) --------------
export function I0(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3.75) {
    const y = (x / 3.75) ** 2;
    return 1 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.360768e-1 + y * 0.45813e-2)))));
  }
  const y = 3.75 / ax;
  return (Math.exp(ax) / Math.sqrt(ax)) * (0.39894228 + y * (0.1328592e-1 + y * (0.225319e-2 + y * (-0.157565e-2 + y * (0.916281e-2 + y * (-0.2057706e-1 + y * (0.2635537e-1 + y * (-0.1647633e-1 + y * 0.392377e-2))))))));
}
export function I1(x: number): number {
  const ax = Math.abs(x);
  let ans: number;
  if (ax < 3.75) {
    const y = (x / 3.75) ** 2;
    ans = ax * (0.5 + y * (0.87890594 + y * (0.51498869 + y * (0.15084934 + y * (0.2658733e-1 + y * (0.301532e-2 + y * 0.32411e-3))))));
  } else {
    const y = 3.75 / ax;
    ans = 0.2282967e-1 + y * (-0.2895312e-1 + y * (0.1787654e-1 - y * 0.420059e-2));
    ans = 0.39894228 + y * (-0.3988024e-1 + y * (-0.362018e-2 + y * (0.163801e-2 + y * (-0.1031555e-1 + y * ans))));
    ans *= Math.exp(ax) / Math.sqrt(ax);
  }
  return x < 0 ? -ans : ans;
}
export function K0(x: number): number {
  if (x <= 2) {
    const y = (x * x) / 4;
    return -Math.log(x / 2) * I0(x) + (-0.57721566 + y * (0.4227842 + y * (0.23069756 + y * (0.3488590e-1 + y * (0.262698e-2 + y * (0.10750e-3 + y * 0.74e-5))))));
  }
  const y = 2 / x;
  return (Math.exp(-x) / Math.sqrt(x)) * (1.25331414 + y * (-0.7832358e-1 + y * (0.2189568e-1 + y * (-0.1062446e-1 + y * (0.587872e-2 + y * (-0.251540e-2 + y * 0.53208e-3))))));
}
export function K1(x: number): number {
  if (x <= 2) {
    const y = (x * x) / 4;
    return Math.log(x / 2) * I1(x) + (1 / x) * (1 + y * (0.15443144 + y * (-0.67278579 + y * (-0.18156897 + y * (-0.1919402e-1 + y * (-0.110404e-2 + y * -0.4686e-4))))));
  }
  const y = 2 / x;
  return (Math.exp(-x) / Math.sqrt(x)) * (1.25331414 + y * (0.23498619 + y * (-0.3655620e-1 + y * (0.1504268e-1 + y * (-0.780353e-2 + y * (0.325614e-2 + y * -0.68245e-3))))));
}
