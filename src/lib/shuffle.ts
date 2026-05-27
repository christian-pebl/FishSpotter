/**
 * Deterministic shuffle utilities (S2-T06 + S8-T1).
 *
 * Lifted out of `biodiversity/candidates.ts` so quiz-candidate selection
 * and feed-ordering can share one PRNG. Pure module — no Prisma, no DOM,
 * no Node-only APIs — so it's importable from middleware, server
 * components, client components, and unit tests alike.
 */

/**
 * FNV-1a hash → 32-bit unsigned int. Stable across Node and modern browsers.
 * Use as the seed input to `mulberry32`.
 */
export function hashStringToSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Mulberry32 PRNG. Deterministic, ~2^32 period, fine for non-cryptographic
 * shuffling (which is all we use it for).
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * In-place-style Fisher-Yates shuffle on a copy of `items`. The original
 * array is untouched. Same `(items, rng)` always yields the same order.
 */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
