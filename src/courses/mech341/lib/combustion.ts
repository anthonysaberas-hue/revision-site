/**
 * Combustion of hydrocarbon fuels (and fuel mixtures) with air: balance, dew point, steady-flow heat, closed-system heat,
 * adiabatic flame temperature. Products are CO2, CO, H2O(g), O2, N2 (no dissociation). Molar units: kmol per kmol of fuel (mixture).
 * Fuels are lists of [mole fraction, SPECIES key]. SPECIES keys such as C3H8 / C4H10 are the gas-phase formation data;
 * append "_l" (e.g. 'C3H8_l') for the liquid (hf − M·hfg, needs hfg). C8H18l, CH3OHl, C2H5OHl are already liquid keys.
 */
import { SPECIES, hbar, dh, Ru, Sp, solve } from './gas';

export type Fuel = [number, string][];
export type Products = Record<'CO2' | 'CO' | 'H2O' | 'O2' | 'N2', number>;
const MAIR = 28.97;

/** formation enthalpy of a fuel species, kJ/kmol */
export function fuelHf(key: string) {
  if (key.endsWith('_l')) {
    const sp = SPECIES[key.slice(0, -2)];
    if (sp.hfg === undefined) throw new Error(`no hfg for ${key}`);
    return sp.hf - sp.M * sp.hfg;
  }
  const sp = SPECIES[key];
  if (!sp) throw new Error(`unknown species ${key}`);
  return sp.hf;
}
const fuelM = (key: string) => SPECIES[key.endsWith('_l') ? key.slice(0, -2) : key].M;
const fuelAtoms = (key: string) => SPECIES[key.endsWith('_l') ? key.slice(0, -2) : key];

export interface BurnIn {
  fuel: Fuel;
  theoAir: number; // actual / theoretical air (1 = stoichiometric, 1.5 = 150 % theoretical)
  coFraction?: number; // fraction of the carbon that goes to CO
  airMoistureMolPerKmolAir?: number; // kmol H2O vapour carried per kmol dry air
}
export function burn(i: BurnIn) {
  let C = 0, H = 0, O = 0, N = 0, Mf = 0;
  for (const [y, key] of i.fuel) {
    const s = fuelAtoms(key);
    C += y * (s.C ?? 0);
    H += y * (s.H ?? 0);
    O += y * (s.O ?? 0);
    N += y * (s.N ?? 0);
    Mf += y * fuelM(key);
  }
  const aTh = C + H / 4 - O / 2;
  const a = i.theoAir * aTh;
  const co = i.coFraction ?? 0;
  const nAir = a * 4.76;
  const CO2 = C * (1 - co);
  const CO = C * co;
  const H2O = H / 2 + (i.airMoistureMolPerKmolAir ?? 0) * nAir;
  // O balance: 2a + O_fuel + (O in air moisture) = 2CO2 + CO + H2O + 2 O2
  const O2 = (2 * a + O - 2 * CO2 - CO - H / 2) / 2;
  const N2 = 3.76 * a + N / 2;
  const products: Products = { CO2, CO, H2O, O2, N2 };
  const Nprod = CO2 + CO + H2O + O2 + N2;
  const AF = (nAir * MAIR) / Mf;
  return { a, products, AF, FA: 1 / AF, Nprod, nAir, Mfuel: Mf };
}

const SP_OF: Record<string, Sp> = { CO2: 'CO2', CO: 'CO', H2O: 'H2O', O2: 'O2', N2: 'N2' };
/** dew-point temperature (°C) of the products at total pressure P (kPa) */
export function dewPoint(products: Products, P = 101.325) {
  const N = Object.values(products).reduce((a, b) => a + b, 0);
  return water.Tsat((products.H2O / N) * P);
}
import { water } from './props';

/** total enthalpy of product mixture at T (K), kJ per kmol fuel */
export function Hprod(products: Products, T: number) {
  let H = 0;
  for (const [k, n] of Object.entries(products)) if (n) H += n * hbar(SP_OF[k], T);
  return H;
}
export interface HIn {
  fuel: Fuel;
  theoAir: number;
  Tfuel: number;
  Tair: number;
  coFraction?: number;
  airMoistureMolPerKmolAir?: number;
  /** molar heat capacity of the fuel for T ≠ 298.15 K, kJ/kmol·K (default 0: fuel enthalpy = hf) */
  cpFuel?: number;
}
/** enthalpy of the reactants (fuel + air [+ moisture]) per kmol fuel */
export function Hreact(i: HIn) {
  const b = burn(i);
  let H = 0;
  for (const [y, key] of i.fuel) H += y * (fuelHf(key) + (i.cpFuel ?? 0) * (i.Tfuel - 298.15));
  H += b.a * (hbar('O2', i.Tair) + 3.76 * hbar('N2', i.Tair));
  H += (i.airMoistureMolPerKmolAir ?? 0) * b.nAir * hbar('H2O', i.Tair);
  return H;
}
/** steady-flow heat transfer, kJ per kmol fuel; positive = heat OUT of the combustor */
export function steadyQ(i: HIn & { Tprod: number }) {
  return Hreact(i) - Hprod(burn(i).products, i.Tprod);
}
/** constant-volume heat transfer, kJ per kmol fuel; positive = heat OUT. u = h − Ru T for every gas. */
export function closedQ(i: HIn & { Tinit: number; Tfinal: number }) {
  const b = burn(i);
  const nR = i.fuel.reduce((a, [y]) => a + y, 0) + b.a * 4.76 * (1 + (i.airMoistureMolPerKmolAir ?? 0));
  const UR = Hreact({ ...i, Tair: i.Tinit, Tfuel: i.Tinit }) - nR * Ru * i.Tinit;
  const UP = Hprod(b.products, i.Tfinal) - b.Nprod * Ru * i.Tfinal;
  return UR - UP;
}
/** same for arbitrary reactant/product mole lists (SPECIES-style gas keys: CH4, O2, CO2, H2O, …), kmol, heat OUT in kJ */
export function closedQMoles(reac: [number, string][], Tinit: number, prod: [number, string][], Tfinal: number) {
  const U = (list: [number, string][], T: number) =>
    list.reduce((a, [n, k]) => {
      const gas = (SP_OF as Record<string, Sp>)[k];
      const h = gas ? hbar(gas, T) : fuelHf(k);
      return a + n * (h - Ru * T);
    }, 0);
  return U(reac, Tinit) - U(prod, Tfinal);
}
/** adiabatic flame temperature (K); Qloss in kJ per kmol fuel */
export function aft(i: { fuel: Fuel; theoAir: number; Tfuel: number; Tair: number; Qloss?: number; coFraction?: number; cpFuel?: number }) {
  const b = burn(i);
  const HR = Hreact(i) - (i.Qloss ?? 0);
  return solve((T) => Hprod(b.products, T) - HR, 300, 5800, 1e-12);
}
export { dh };
