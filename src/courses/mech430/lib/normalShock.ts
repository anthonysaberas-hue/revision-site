/** Stationary normal shock, x = upstream, y = downstream (notes Ch. 7; Table A3). */
import { bisect } from './solve';

export function My(Mx: number, g = 1.4): number {
  return Math.sqrt((2 + (g - 1) * Mx * Mx) / (2 * g * Mx * Mx - (g - 1)));
}
export const py_px = (Mx: number, g = 1.4) => (2 * g * Mx * Mx - (g - 1)) / (g + 1);
export const rhoy_rhox = (Mx: number, g = 1.4) => ((g + 1) * Mx * Mx) / (2 + (g - 1) * Mx * Mx);
export const Ty_Tx = (Mx: number, g = 1.4) => py_px(Mx, g) / rhoy_rhox(Mx, g);

/** Stagnation-pressure ratio p0y/p0x = A*x/A*y (always < 1: entropy rises). */
export function p0y_p0x(Mx: number, g = 1.4): number {
  const a = Math.pow(py_px(Mx, g), -1 / (g - 1));
  const b = Math.pow(rhoy_rhox(Mx, g), g / (g - 1));
  return a * b;
}

/** Rayleigh pitot formula p0y/px (supersonic pitot probe). */
export function p0y_px(Mx: number, g = 1.4): number {
  const num = Math.pow(((g + 1) / 2) * Mx * Mx, g / (g - 1));
  const den = Math.pow((2 * g * Mx * Mx) / (g + 1) - (g - 1) / (g + 1), 1 / (g - 1));
  return num / den;
}

/** Entropy rise across the shock, Δs/R = −ln(p0y/p0x). */
export const deltaS_R = (Mx: number, g = 1.4) => -Math.log(p0y_p0x(Mx, g));

/** Inverse: Mx from My (the relation is symmetric). */
export const Mx_from_My = (my: number, g = 1.4) => My(my, g);
/** Inverse: Mx from py/px (closed form). */
export const Mx_from_py_px = (r: number, g = 1.4) => Math.sqrt((r * (g + 1) + (g - 1)) / (2 * g));
/** Inverse: Mx from p0y/p0x (monotone decreasing on Mx > 1). */
export function Mx_from_p0y_p0x(r: number, g = 1.4): number {
  if (r >= 1) return 1;
  return bisect((M) => p0y_p0x(M, g) - r, 1, 100);
}
/** Inverse: Mx from ρy/ρx. */
export const Mx_from_rho = (r: number, g = 1.4) => Math.sqrt((2 * r) / ((g + 1) - r * (g - 1)));
/** Inverse: Mx from Ty/Tx. */
export const Mx_from_Ty_Tx = (r: number, g = 1.4) => bisect((M) => Ty_Tx(M, g) - r, 1, 100);
/** Inverse: Mx from pitot ratio p0y/px. */
export const Mx_from_p0y_px = (r: number, g = 1.4) => bisect((M) => p0y_px(M, g) - r, 1, 100);

/** All Table-A3 columns at once. */
export function normalShock(Mx: number, g = 1.4) {
  return {
    Mx,
    My: My(Mx, g),
    py_px: py_px(Mx, g),
    rhoy_rhox: rhoy_rhox(Mx, g),
    Ty_Tx: Ty_Tx(Mx, g),
    p0y_p0x: p0y_p0x(Mx, g),
    p0y_px: p0y_px(Mx, g),
  };
}
