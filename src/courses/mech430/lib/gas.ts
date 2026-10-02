/** Perfect-gas properties. Universal gas constant ℜ = 8314 J/(kmol·K), as on the MECH 430 equation sheet. */

export const R_UNIVERSAL = 8314;

export interface Gas {
  name: string;
  gamma: number;
  /** Molecular weight, kg/kmol */
  MW: number;
}

export const GASES: Record<string, Gas> = {
  air: { name: 'Air', gamma: 1.4, MW: 28.9 },
  air28: { name: 'Air (MW 28)', gamma: 1.4, MW: 28 },
  N2: { name: 'Nitrogen N₂', gamma: 1.4, MW: 28 },
  O2: { name: 'Oxygen O₂', gamma: 1.4, MW: 32 },
  H2: { name: 'Hydrogen H₂', gamma: 1.4, MW: 2 },
  He: { name: 'Helium He', gamma: 5 / 3, MW: 4 },
  Ar: { name: 'Argon Ar', gamma: 5 / 3, MW: 40 },
  CO2: { name: 'Carbon dioxide CO₂', gamma: 1.29, MW: 44 },
  SF6: { name: 'Sulfur hexafluoride SF₆', gamma: 1.1, MW: 146 },
};

/** Specific gas constant R = ℜ/MW  [J/(kg·K)] */
export const gasR = (MW: number) => R_UNIVERSAL / MW;
/** cp = γR/(γ−1) */
export const cp = (gamma: number, R: number) => (gamma * R) / (gamma - 1);
/** cv = R/(γ−1) */
export const cv = (gamma: number, R: number) => R / (gamma - 1);
/** Speed of sound c = √(γRT) */
export const soundSpeed = (gamma: number, R: number, T: number) => Math.sqrt(gamma * R * T);
