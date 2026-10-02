/**
 * Check a computed number (or array of numbers) against an expected value, for the digest/verification stage.
 * Returns the string 'ok' or a message describing the first mismatch. The tolerance is relative
 * (|actual - expected| <= tolerance * |expected|), with an absolute fallback of `tolerance` when expected is ~0.
 */
export function verify(expected: number | number[], actual: number | number[], tolerance = 0.01): 'ok' | string {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return 'mismatch: one value is an array and the other is not';
    if (expected.length !== actual.length) return `mismatch: expected ${expected.length} values, got ${actual.length}`;
    for (let i = 0; i < expected.length; i++) {
      const r = verify(expected[i], actual[i], tolerance);
      if (r !== 'ok') return `[${i}] ${r}`;
    }
    return 'ok';
  }
  if (Number.isNaN(actual) || Number.isNaN(expected)) return `mismatch: expected ${expected}, got ${actual}`;
  if (expected === actual) return 'ok';
  const err = Math.abs(actual - expected);
  const limit = Math.abs(expected) > 1e-9 ? tolerance * Math.abs(expected) : tolerance;
  return err <= limit ? 'ok' : `mismatch: expected ${expected}, got ${actual} (error ${((err / (Math.abs(expected) || 1)) * 100).toFixed(2)} %, tolerance ${(tolerance * 100).toFixed(2)} %)`;
}
