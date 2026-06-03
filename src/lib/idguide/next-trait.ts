import { speciesValuesFor, TRAIT_KEYS, type TraitKey } from "./narrow";
import type { SpeciesTraits } from "./traits";

/**
 * The single most-discriminating question to ask next, for Rung 3 of the
 * "Spot It" flow. Given the species still in contention, it returns the
 * (trait, value) whose yes/no split divides the candidate set most evenly,
 * which is the question with the highest information gain.
 *
 * The yes/no framing matches the UX: each Rung 3 prompt is one binary visual
 * question ("chin barbel? yes / no", "kinked vs straight lateral line"). A
 * value that everyone or no-one has carries zero information, so it is
 * skipped. Pure and deterministic for unit testing.
 */
export type NextTrait = {
  key: TraitKey;
  /** The trait value to ask about ("does it have this?"). */
  value: string;
  /** Candidates that carry `value`. */
  yesCount: number;
  /** Candidates that do not. */
  noCount: number;
  /** Binary entropy of the split, 0..1 (1.0 = a perfect 50/50 question). */
  score: number;
};

function binaryEntropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

const keyIndex = (k: TraitKey): number => TRAIT_KEYS.indexOf(k);

export function nextBestTrait(
  candidates: SpeciesTraits[],
  askedKeys: Iterable<TraitKey> = [],
): NextTrait | null {
  const n = candidates.length;
  // Nothing left to discriminate.
  if (n < 2) return null;

  const asked = new Set<TraitKey>(askedKeys);
  const splits: NextTrait[] = [];

  for (const key of TRAIT_KEYS) {
    if (asked.has(key)) continue;

    // How many candidates carry each value of this trait.
    const counts = new Map<string, number>();
    for (const c of candidates) {
      for (const v of speciesValuesFor(c, key)) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }

    for (const [value, yes] of counts) {
      // Degenerate split: every candidate (or none) has this value.
      if (yes <= 0 || yes >= n) continue;
      splits.push({ key, value, yesCount: yes, noCount: n - yes, score: binaryEntropy(yes / n) });
    }
  }

  if (splits.length === 0) return null;

  // Highest information first; deterministic tie-break by trait order then
  // value, so the picker is stable across runs and candidate orderings.
  splits.sort(
    (a, b) =>
      b.score - a.score || keyIndex(a.key) - keyIndex(b.key) || a.value.localeCompare(b.value),
  );

  return splits[0];
}
